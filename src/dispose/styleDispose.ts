import * as vscode from "vscode";
import { refreshStyleFileIndex } from "../utils";

/**
 * 样式文件内容变化（编辑中或保存后）触发的处理
 * 直接重新解析并覆盖缓存，保证未保存的修改也能即时生效
 * @param {vscode.TextDocument} document - 样式文档
 * @returns {void}
 */
export function styleFileDidChangeTextDocumentDispose(
  document: vscode.TextDocument,
): void {
  refreshStyleFileIndex(document.uri.fsPath, document.getText());
}
