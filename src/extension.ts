import * as vscode from "vscode";
import {
  clearStyleContentPathAndClassMap,
  clearVueFilePathAndImportStylePathMap,
} from "./store";
import { CssModuleCompletionProvider } from "./provider/cssModuleCompletionProvider";
import { CssModuleDefinitionProvider } from "./provider/cssModuleDefinitionProvider";
import { createFileWatch } from "./watcher/fileWatch";

/**
 * 激活扩展
 * 当用户安装扩展后，会自动调用此函数
 * 用于注册扩展的事件和命令
 * @param context
 */
export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    /**
     * 注册提示的扩展
     * 当用户输入 . 时触发
     */
    vscode.languages.registerCompletionItemProvider(
      "vue",
      new CssModuleCompletionProvider(),
      ".", // 触发符：输入 . 时触发
    ),
    /**
     * 注册点击进入具体的扩展
     * 当用户点击提示的类名时触发
     */
    vscode.languages.registerDefinitionProvider(
      "vue",
      new CssModuleDefinitionProvider(),
    ),
    /**
     * 注册文件监听
     * 当用户打开或关闭文件时触发
     */
    ...createFileWatch(),
  );
}

/**
 * 失活扩展
 * 当用户卸载扩展后，会自动调用此函数
 * 用于清理扩展的资源
 */
export async function deactivate() {
  /**
   * 清空缓存
   */
  clearStyleContentPathAndClassMap();
  /**
   * 清空导入的样式文件路径缓存
   */
  clearVueFilePathAndImportStylePathMap();
}
