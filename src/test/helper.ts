import * as path from "node:path";
import * as vscode from "vscode";

/**
 * 夹具工作区根目录
 * 测试运行时 VS Code 以 sample/ 作为唯一工作区打开
 * @returns {string} 工作区根目录绝对路径
 */
export function getSampleRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("未找到夹具工作区，请检查 .vscode-test.mjs 的 workspaceFolder 配置");
  }
  return folder.uri.fsPath;
}

/**
 * 拼接夹具工作区内的文件绝对路径
 * @param {...string} segments - 相对工作区根目录的路径片段
 * @returns {string} 绝对路径
 */
export function samplePath(...segments: string[]): string {
  return path.join(getSampleRoot(), ...segments);
}

/**
 * 拼接夹具工作区内的文件 Uri
 * @param {...string} segments - 相对工作区根目录的路径片段
 * @returns {vscode.Uri} 文件 uri
 */
export function sampleUri(...segments: string[]): vscode.Uri {
  return vscode.Uri.file(samplePath(...segments));
}

/**
 * 打开夹具工作区内的文档
 * @param {...string} segments - 相对工作区根目录的路径片段
 * @returns {Promise<vscode.TextDocument>} 已打开的文档
 */
export async function openSampleDoc(
  ...segments: string[]
): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument(sampleUri(...segments));
}

/**
 * 在文档中定位某段文本首次出现的位置
 * @param {vscode.TextDocument} document - 目标文档
 * @param {string} snippet - 要查找的文本片段
 * @param {number} [offset] - 相对片段起点的列偏移，默认落在片段末尾
 * @returns {vscode.Position} 对应位置
 */
export function positionOf(
  document: vscode.TextDocument,
  snippet: string,
  offset?: number,
): vscode.Position {
  const index = document.getText().indexOf(snippet);
  if (index < 0) {
    throw new Error(`文档中未找到片段: ${snippet}`);
  }
  return document.positionAt(index + (offset ?? snippet.length));
}
