import * as vscode from "vscode";
import { parseCurrentLineModuleAccess, getModuleCssContent } from "../utils";
import { getCurrentVueFileAllImportStyleModulePath } from "../utils/vueUtils";

/**
 * css module 模块补全提供器
 * 当用户输入 . 时触发，用于提示样式类名
 * @param document 当前编辑的文本文档
 * @param position 光标位置
 * @param token 取消令牌
 * @param context 完成上下文
 * @returns 完成项数组或完成列表对象
 */
export class CssModuleCompletionProvider
  implements vscode.CompletionItemProvider
{
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    // 解析一下vue的文件，获取所有引入的css module样式文件路径
    // 并将路径缓存起来
    getCurrentVueFileAllImportStyleModulePath(document.uri, document.getText());

    // 获取当前行的变量名与已输入字符
    const access = parseCurrentLineModuleAccess(document, position);
    if (!access) {
      return undefined;
    }
    // 获取当前行的变量名对应的样式类名数组
    const list = getModuleCssContent(document, access.varName);
    if (list.length === 0) {
      return undefined;
    }

    const replaceRange = new vscode.Range(
      new vscode.Position(position.line, access.dotIndex), // 从 . 开始
      position, // 到光标
    );

    const completions: vscode.CompletionItem[] = [];
    list.forEach((cls) => {
      const item = new vscode.CompletionItem(
        // 此处必须含有 . 才对，不然无法显示
        cls.includes("-") ? `.['${cls}']` : `.${cls}`,
        vscode.CompletionItemKind.Property,
      );
      item.insertText = cls.includes("-") ? `['${cls}']` : `.${cls}`;
      item.range = replaceRange;
      item.filterText = `.${cls}`;
      completions.push(item);
    });
    return completions;
  }
}
