import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 获取字符串儿在某个文件的Range
 * @param fileUri
 * @param searchString
 * @returns
 */
export function findStringRangeInFile(
  fileUri: string,
  searchString: string
): vscode.Range | null {
  try {
    // 获取的文件buff
    const contentBuffer = fs.readFileSync(fileUri);
    const fileContent = new TextDecoder().decode(contentBuffer);

    const startIndex = fileContent.indexOf(searchString);
    if (startIndex === -1) {
      return null;
    }

    function indexToPosition(content: string, index: number): vscode.Position {
      const lines = content.substring(0, index).split("\n");
      const line = lines.length - 1;
      const character = lines[line].length;
      return new vscode.Position(line, character);
    }

    const startPos = indexToPosition(fileContent, startIndex);
    const endPos = indexToPosition(
      fileContent,
      // 结束的索引
      startIndex + searchString.length
    );
    return new vscode.Range(startPos, endPos);
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
}

/**
 * 解析变量名称
 * @param document
 * @param position
 * @returns
 */
export function parseVarName(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  // 解析出变量名称：style.
  const linePrefix = document
    .lineAt(position)
    .text.slice(0, position.character);
  const dotMatch = linePrefix.match(/(\w+)\.([a-zA-Z0-9_]*)$/);
  if (!dotMatch) {
    return undefined;
  }
  const [, varName, partial] = dotMatch;
  return varName;
}

/**
 * 获取 import 样式文件的地址
 * @param document
 * @param text
 * @param varName
 * @returns
 */
export function getImportScssModulePath(
  document: vscode.TextDocument,
  text: string,
  varName: string
) {
  const importRegex =
    /import\s+(\w+)\s+from\s+['"]([^'"]+\.module\.scss|less|css)['"]/g;
  const matchIterator = text.matchAll(importRegex);
  let match;
  for (let item of matchIterator) {
    let [, _varName] = item;
    if (_varName === varName) {
      match = item;
      break;
    }
  }
  // [, varName, modulePath]
  if (!match) {
    return undefined;
  }
  const [, , modulePath] = match!;

  if (!modulePath) {
    return undefined;
  }

  // 走的@的相对路径
  let stylePath = "";
  if (modulePath.includes("@")) {
    const currentWorkSpacePath = getWorkspacePathForFile(document.uri);
    if(!currentWorkSpacePath){
      return undefined;
    }
    // 默认认为@ 对应 当前工作区下的src
    stylePath = modulePath.replace('@', currentWorkSpacePath + '/src');
  } else {
    let dirPath = path.dirname(document.uri.fsPath);
    stylePath = path.resolve(dirPath, modulePath);
  }

  return stylePath;
}

/**
 * 获取工作区
 * @param fileUri
 * @returns
 */
export function getWorkspacePathForFile(
  fileUri: vscode.Uri
): string | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  return workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
}
