import * as vscode from "vscode";
import {
  styleContentPathAndClassMap,
  findStringRangeInFile,
  getCurrentVarBelongImportStylePath,
  parseModuleCssContent,
  parseCurrentLineVarName,
} from "./utils";

class CssModuleCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > {
    const varName = parseCurrentLineVarName(document, position);
    if (!varName) {
      return undefined;
    }
    const list = parseModuleCssContent(document, varName!);
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

class CssModuleDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
    const wordRange = document.getWordRangeAtPosition(position, /[\w\[\]'"]+/);
    if (!wordRange) {
      return undefined;
    }

    const clickText = document.getText(wordRange);
    console.log("点击的text为：", clickText);
    const lineRange = document.lineAt(position.line).range;
    // 点击的当前行的内容
    let lineContent = document.getText(lineRange);
    // TODO ？
    let result = lineContent
      .split(/\s+/)
      .filter((item) => item.includes(":class") && item.includes(clickText));
    if (result.length === 0) {
      return undefined;
    }
    lineContent = result[0];
    // 1、考虑点击的是style 还是类名
    // 2、考虑class 是['xxx'] 的情况
    if (lineContent.includes(clickText) && lineContent.includes(":class")) {
      // 找出：class=" 之间的内容  "
      const match = /:class=['"]+(.+)['"]/g.exec(lineContent);
      if (!match) {
        return undefined;
      }
      const [, classContent] = match;
      let className = "",
        varName = "";
      // 含点的情况
      if (classContent.includes(".")) {
        const classContentList = classContent.split(".");
        varName = classContentList[0];
        className = classContentList[1];
        // 不含点的情况
      } else {
        const classContentList = classContent
          .replace(/['"]\]/, "")
          .split(/\[['"]/);
        if (classContentList.length === 2) {
          className = classContentList[1];
          varName = classContentList[0];
        }
      }

      if (!className || !varName) {
        return undefined;
      }

      const stylePath = getCurrentVarBelongImportStylePath(
        document,
        document.getText(),
        varName
      );
      if (!stylePath) {
        return undefined;
      }
      // 点击的是变量，跳到页面上去
      if (clickText.startsWith(varName)) {
        // 跳到页面第一个字符去
        return new vscode.Location(
          vscode.Uri.file(stylePath),
          new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
        );
      } else {
        // 获取在样式文件中的位置，并跳到对应的地方去
        const range = findStringRangeInFile(stylePath, `.${className}`);
        if (range) {
          return new vscode.Location(vscode.Uri.file(stylePath), range);
        }
      }
    }

    return undefined;
  }
}

/**
 * 添加样式文件监听器
 * @returns
 */
function createStyleModuleFileWatchers(): vscode.FileSystemWatcher[] {
  return ["css", "less", "scss"].map((item) => {
    let watcher = vscode.workspace.createFileSystemWatcher(
      `**/*.module.${item}`
    );

    // 监听文件内容变化
    watcher.onDidChange((uri) => {
      console.log("File changed:", uri.fsPath);
      styleContentPathAndClassMap.delete(uri.fsPath);
    });

    // 监听文件删除
    watcher.onDidDelete((uri) => {
      console.log("File deleted:", uri.fsPath);
      styleContentPathAndClassMap.delete(uri.fsPath);
    });
    return watcher;
  });
}

// 激活扩展
export async function activate(context: vscode.ExtensionContext) {
  // 创建文件监听器

  // 添加提示的扩展
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    "vue",
    new CssModuleCompletionProvider(),
    "." // 触发符：输入 . 时触发
  );

  // 添加点击进入具体的扩展
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    "vue",
    new CssModuleDefinitionProvider()
  );

  context.subscriptions.push(completionProvider, definitionProvider);

  // 添加样式文件的监听器
  createStyleModuleFileWatchers().forEach((watcher) => {
    context.subscriptions.push(watcher);
  });
}

export function deactivate() {
  // 清空缓存
  styleContentPathAndClassMap.clear();
}
