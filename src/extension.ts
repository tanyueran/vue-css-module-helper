import * as vscode from "vscode";
import { clearStyleContentPathAndClassMap, clearVueFilePathAndImportStylePathMap } from "./store";
import { CssModuleCompletionProvider } from "./provider/cssModuleCompletionProvider";
import { CssModuleDefinitionProvider } from "./provider/cssModuleDefinitionProvider";
import { createFileWatch } from "./watcher/fileWatch";

// 激活扩展
export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    // 添加提示的扩展
    vscode.languages.registerCompletionItemProvider(
      "vue",
      new CssModuleCompletionProvider(),
      "." // 触发符：输入 . 时触发
    ),
    // 添加点击进入具体的扩展
    vscode.languages.registerDefinitionProvider(
      "vue",
      new CssModuleDefinitionProvider()
    ),
    // 添加文件监听
    ...createFileWatch()
  );
}

export function deactivate() {
  // 清空缓存
  clearStyleContentPathAndClassMap();
  clearVueFilePathAndImportStylePathMap();
}
