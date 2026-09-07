import * as vscode from "vscode";
import {
  deleteStyleContentPathAndClass,
  deleteVueFilePathAndImportStylePathMap,
} from "../store";

/**
 * vue 文件 DidChangeTextDocument 触发的处理
 *
 * 这里不再按 script 行区间做增量判断，原因有两点：
 * 1. contentChanges 中的 range 是「变更前」文档的坐标，而 document 已是变更后的
 *    内容，多行删除/粘贴时两者会错位，导致该失效的缓存没有失效
 * 2. `<style module>` 块的增删同样会改变变量名到样式的映射，只看 script 区间会漏判
 *
 * 因此只要内容有变动就整体失效该文件的缓存，解析成本延迟到下次补全/跳转时
 *
 * @param {vscode.TextDocumentChangeEvent} event - 文档变更事件
 * @returns {void}
 */
export function vueFileDidChangeTextDocumentDispose(
  event: vscode.TextDocumentChangeEvent,
): void {
  if (event.contentChanges.length === 0) {
    return;
  }

  const fsPath = event.document.uri.fsPath;
  // vue 文件可能含有 <style module> 内联模块，其索引以 vue 路径为 key
  deleteStyleContentPathAndClass(fsPath);
  // import / require / <style module> 任一变动都会影响变量名映射
  deleteVueFilePathAndImportStylePathMap(fsPath);
}
