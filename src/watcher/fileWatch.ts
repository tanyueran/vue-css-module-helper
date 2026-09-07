import * as vscode from "vscode";
import { vueFileDidChangeTextDocumentDispose } from "../dispose/vueDispose";
import { styleFileDidChangeTextDocumentDispose } from "../dispose/styleDispose";
import { isStyleModuleFile, isVueFile } from "../utils";
import { clearAliasRuleCache } from "../utils/aliasResolver";
import {
  deleteStyleContentPathAndClass,
  deleteVueFilePathAndImportStylePathMap,
  findVueFilesReferencingStyle,
} from "../store";

/**
 * 会影响路径别名解析的配置文件名
 */
const ALIAS_CONFIG_FILE_PATTERN = /(tsconfig[\w.]*\.json|jsconfig\.json)$/;

/**
 * 清除某个文件相关的所有缓存
 * 样式文件失效时，连带清除引用它的 vue 文件的 import 缓存，
 * 避免路径变更后仍指向旧文件
 * @param {string} fsPath - 文件完整路径
 * @returns {void}
 */
function invalidateCacheForPath(fsPath: string): void {
  if (isStyleModuleFile(fsPath)) {
    deleteStyleContentPathAndClass(fsPath);
    findVueFilesReferencingStyle(fsPath).forEach(
      deleteVueFilePathAndImportStylePathMap,
    );
    return;
  }
  if (isVueFile(fsPath)) {
    deleteVueFilePathAndImportStylePathMap(fsPath);
    // vue 文件的 <style module> 内联索引也以 vue 路径为 key
    deleteStyleContentPathAndClass(fsPath);
  }
}

/**
 * 创建一些文件监听器
 * @returns {vscode.Disposable[]} 需要随扩展一同释放的监听器列表
 */
export function createFileWatch(): vscode.Disposable[] {
  // 文本内容被修改
  let w1 = vscode.workspace.onDidChangeTextDocument((event) => {
    let fsPath = event.document.uri.fsPath;
    // 处理vue文件的import的解析
    if (isVueFile(fsPath)) {
      vueFileDidChangeTextDocumentDispose(event);
    } else if (isStyleModuleFile(fsPath)) {
      // 样式文件编辑中即刷新缓存，无需等到保存
      styleFileDidChangeTextDocumentDispose(event.document);
    }
  });

  // 文本文档被保存
  let w2 = vscode.workspace.onDidSaveTextDocument((document) => {
    let fsPath = document.uri.fsPath;
    // 保存 tsconfig/jsconfig 后，别名规则需要重新读取
    if (ALIAS_CONFIG_FILE_PATTERN.test(fsPath)) {
      clearAliasRuleCache();
      return;
    }
    if (isStyleModuleFile(fsPath)) {
      styleFileDidChangeTextDocumentDispose(document);
    }
  });

  // 文件被删除
  let w3 = vscode.workspace.onDidDeleteFiles((event) => {
    event.files.forEach((file) => invalidateCacheForPath(file.fsPath));
  });

  // 文件被重命名
  let w4 = vscode.workspace.onDidRenameFiles((event) => {
    event.files.forEach((file) => {
      invalidateCacheForPath(file.oldUri.fsPath);
      invalidateCacheForPath(file.newUri.fsPath);
    });
  });

  // 文件被创建：可能是新增样式文件，清除引用了同名路径的失效缓存
  let w5 = vscode.workspace.onDidCreateFiles((event) => {
    event.files.forEach((file) => invalidateCacheForPath(file.fsPath));
  });

  // 用户配置变更时，别名规则需要重新读取
  let w6 = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("vueCssModuleHelper.alias")) {
      clearAliasRuleCache();
    }
  });

  // 工作区文件夹增删时，别名规则的基准目录变化
  let w7 = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    clearAliasRuleCache();
  });

  // 监听磁盘侧的样式文件变更（git 切分支、外部编辑器修改等）
  const styleWatcher = vscode.workspace.createFileSystemWatcher(
    "**/*.module.{scss,sass,less,styl,css}",
  );
  styleWatcher.onDidChange((uri) => deleteStyleContentPathAndClass(uri.fsPath));
  styleWatcher.onDidCreate((uri) => invalidateCacheForPath(uri.fsPath));
  styleWatcher.onDidDelete((uri) => invalidateCacheForPath(uri.fsPath));

  return [w1, w2, w3, w4, w5, w6, w7, styleWatcher];
}
