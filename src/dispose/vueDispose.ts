import * as vscode from "vscode";
import { deleteVueFilePathAndImportStylePathMap } from "../store";

/**
 * vue 文件DidChangeTextDocument 触发的处理
 * @param event
 */
export function vueFileDidChangeTextDocumentDispose(
  event: vscode.TextDocumentChangeEvent
) {
  const content = event.document.getText();
  const lineList = content.split("\n");
  const scriptStartLine = lineList.findIndex((item) => {
    if (item.includes("<script")) {
      return true;
    }
    return false;
  });
  const scriptEndLine = lineList.findIndex((item) => {
    if (item.includes("</script>")) {
      return true;
    }
    return false;
  });

  // 判断修改的内容是否在脚本区域
  const changeContentInScriptArea = event.contentChanges.every((item) => {
    let range = item.range;
    if (
      (range.start.line <= scriptStartLine ||
        range.start.line >= scriptEndLine) &&
      (range.end.line <= scriptStartLine || range.end.line >= scriptEndLine)
    ) {
      return false;
    }
    return false;
  });

  // 在的话，删除之前的缓存
  if (changeContentInScriptArea) {
    deleteVueFilePathAndImportStylePathMap(event.document.uri.fsPath);
  }
}
