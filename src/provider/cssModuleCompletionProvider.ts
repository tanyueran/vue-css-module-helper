import * as vscode from "vscode";
import { parseCurrentLineVarName, getModuleCssContent } from "../utils";
import { getCurrentVueFileAllImportStyleModulePath } from "../utils/vueUtils";

/**
 * css module 模块补全
 */
export class CssModuleCompletionProvider
  implements vscode.CompletionItemProvider
{
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    // 解析一下vue的文件
    getCurrentVueFileAllImportStyleModulePath(document.uri, document.getText());

    const varName = parseCurrentLineVarName(document, position);
    if (!varName) {
      return undefined;
    }
    const list = getModuleCssContent(document, varName!);
    if (list.length === 0) {
      return undefined;
    }

    const lineText = document.lineAt(position).text;
    const prefix = lineText.slice(0, position.character);
    const match = prefix.match(/(\w+)\.([a-zA-Z0-9_]*)$/); // 匹配 style.xxx

    if (!match) {
      return undefined;
    }
    // 计算 . 的位置：varName 结束的位置
    const dotIndex = match.index! + match[1].length; // match[1] 是 varName
    const replaceRange = new vscode.Range(
      new vscode.Position(position.line, dotIndex), // 从 . 开始
      position // 到光标
    );

    const completions: vscode.CompletionItem[] = [];
    list.forEach((cls) => {
      // TODO
      // 含有-的class 应该替换掉 . 才对，但是现在替换不了
      const text = cls.includes("-") ? `.['${cls}']` : `.${cls}`;
      let item = new vscode.CompletionItem(
        text,
        vscode.CompletionItemKind.Text
      );
      item.insertText = text;
      item.range = replaceRange;
      completions.push(item);
    });
    return completions;
  }
}
