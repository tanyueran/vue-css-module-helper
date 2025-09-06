import * as vscode from "vscode";
import {
  getStyleContentPathAndClass,
  setStyleContentPathAndClass,
} from "../store";
import { getStyleFileTopClassList } from "../utils";

/**
 * 样式文件DidChangeTextDocument 触发的处理
 * @param document
 */
export function styleFileDidChangeTextDocumentDispose(
  document: vscode.TextDocument
) {
  const fsPath = document.uri.fsPath;
  const classNameList = getStyleContentPathAndClass(fsPath);
  // 之前缓存过，更新缓存
  if (classNameList) {
    const content = document.getText();
    const newStyleFileTopClassList = getStyleFileTopClassList(content);
    setStyleContentPathAndClass(fsPath, newStyleFileTopClassList);
  }
}
