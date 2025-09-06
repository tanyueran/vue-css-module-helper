import * as vscode from "vscode";
import { vueFileDidChangeTextDocumentDispose } from "../dispose/vueDispose";
import { styleFileDidChangeTextDocumentDispose } from "../dispose/styleDispose";
import { isStyleModuleFile, isVueFile } from "../utils";
import {
  deleteStyleContentPathAndClass,
  deleteVueFilePathAndImportStylePathMap,
} from "../store";

/**
 * 创建一些文件监听器
 */
export function createFileWatch() {
  // 文本内容被修改
  let w1 = vscode.workspace.onDidChangeTextDocument((event) => {
    let fsPath = event.document.uri.fsPath;
    // 处理vue文件的import的解析
    if (isVueFile(fsPath)) {
      vueFileDidChangeTextDocumentDispose(event);
    }
  });

  // 文本文档被保存
  let w2 = vscode.workspace.onDidSaveTextDocument((document) => {
    let fsPath = document.uri.fsPath;
    // 处理样式文件
    if (isStyleModuleFile(fsPath)) {
      styleFileDidChangeTextDocumentDispose(document);
    }
  });

  // 文件被删除
  let w3 = vscode.workspace.onDidDeleteFiles((event) => {
    const deletedFiles = event.files;
    deletedFiles.forEach((file) => {
      let path = file.fsPath;
      if (isStyleModuleFile(path)) {
        deleteStyleContentPathAndClass(path);
      } else if (isVueFile(path)) {
        deleteVueFilePathAndImportStylePathMap(path);
      }
    });
  });

  // 文件被重命名
  let w4 = vscode.workspace.onDidRenameFiles((event) => {
    const renameFiles = event.files;
    renameFiles.forEach((file) => {
      let oldPath = file.oldUri.fsPath;
      if (isStyleModuleFile(oldPath)) {
        deleteStyleContentPathAndClass(oldPath);
      } else if (isVueFile(oldPath)) {
        deleteVueFilePathAndImportStylePathMap(oldPath);
      }
    });
  });

  return [w1, w2, w3, w4];
}
