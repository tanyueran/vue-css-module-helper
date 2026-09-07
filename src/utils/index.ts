import * as vscode from "vscode";
import * as fs from "node:fs";
import {
  getStyleContentPathAndClass,
  setStyleContentPathAndClass,
  getVueFilePathAndImportStylePathMap,
} from "../store";
import { buildStyleFileIndex, StyleFileIndex } from "./styleParser";
import { getWorkspacePathForFile } from "./aliasResolver";

export { getWorkspacePathForFile };
export type { StyleFileIndex };

/**
 * 匹配 vue SFC 中的 `<style module ...> ... </style>` 整块
 */
const VUE_STYLE_MODULE_BLOCK_REGEX =
  /<style\b[^>]*\bmodule\b[^>]*>([\s\S]*?)<\/style>/g;

/**
 * 读取文件内容
 * 优先取编辑器中已打开的文档（含未保存的修改），否则回落到磁盘读取
 * @param {string} filePath - 文件的完整路径
 * @returns {string | null} 文件内容，读取失败返回 null
 */
export function readStyleContent(filePath: string): string | null {
  const openedDoc = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.fsPath === filePath,
  );
  if (openedDoc) {
    return openedDoc.getText();
  }
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error("读取样式文件失败:", filePath, error);
    return null;
  }
}

/**
 * 提取可供样式解析的内容
 *
 * 对于 vue 文件（`<style module>` 内联模块），只保留 style 块内的文本，
 * 其余字符替换为等长空格，从而让解析出的位置索引仍对应 vue 文件的真实行列
 *
 * @param {string} filePath - 文件完整路径
 * @param {string} rawContent - 文件原始内容
 * @returns {string} 可直接交给样式解析器的内容
 */
function extractStyleSource(filePath: string, rawContent: string): string {
  if (!filePath.endsWith(".vue")) {
    return rawContent;
  }

  const masked = rawContent.replace(/[^\n]/g, " ").split("");
  VUE_STYLE_MODULE_BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VUE_STYLE_MODULE_BLOCK_REGEX.exec(rawContent)) !== null) {
    const blockContent = match[1];
    const blockStart = match.index + match[0].indexOf(blockContent);
    for (let i = 0; i < blockContent.length; i++) {
      masked[blockStart + i] = blockContent[i];
    }
  }
  return masked.join("");
}

/**
 * 获取样式文件的解析索引（带缓存）
 * @param {string} stylePath - 样式文件（或含内联模块的 vue 文件）完整路径
 * @returns {StyleFileIndex | undefined} 解析索引，读取失败返回 undefined
 */
export function getStyleFileIndex(
  stylePath: string,
): StyleFileIndex | undefined {
  const cached = getStyleContentPathAndClass(stylePath);
  if (cached) {
    return cached;
  }

  const rawContent = readStyleContent(stylePath);
  if (rawContent === null) {
    return undefined;
  }

  const index = buildStyleFileIndex(extractStyleSource(stylePath, rawContent));
  setStyleContentPathAndClass(stylePath, index);
  return index;
}

/**
 * 根据文件内容重建索引并写入缓存
 * 供文件变更监听调用，保证编辑中的内容即时生效
 * @param {string} filePath - 文件完整路径
 * @param {string} rawContent - 文件最新内容
 * @returns {void}
 */
export function refreshStyleFileIndex(
  filePath: string,
  rawContent: string,
): void {
  const index = buildStyleFileIndex(extractStyleSource(filePath, rawContent));
  setStyleContentPathAndClass(filePath, index);
}

/**
 * 在样式文件中查找指定 class 的定义位置
 *
 * 基于选择器扫描而非字符串查找，因此：
 * - 不会被 `.btn-primary` 前缀误命中 `.btn`
 * - 不会命中注释、字符串字面量中的内容
 * - 支持 scss / less / css 的 `&__xxx` 嵌套写法，且会校验父级层级
 * 结果走缓存，跳转时不再重复全量解析文件
 *
 * @param {string} stylePath - 样式文件的完整路径
 * @param {string} className - 要查找的类名（不含点号）
 * @returns {vscode.Range | null} 定义位置，找不到返回 null
 */
export function findClassRangeInStyleFile(
  stylePath: string,
  className: string,
): vscode.Range | null {
  const index = getStyleFileIndex(stylePath);
  return index?.ranges.get(className) ?? null;
}

/**
 * 光标处的 css module 成员访问信息
 */
export interface ModuleAccessAtCursor {
  /** 点号前的变量名，如 style、$style */
  varName: string;
  /** 点号后已输入的字符，如 `style.he` 中的 he */
  typed: string;
  /** 点号在当前行中的字符索引 */
  dotIndex: number;
}

/**
 * 解析光标所在位置的 css module 成员访问（形如 `style.` / `$style.he`）
 *
 * 变量名允许 `$` 开头，以兼容 `useCssModule()` 与 `<style module>` 的默认变量 `$style`
 *
 * @param {vscode.TextDocument} document - 当前文档
 * @param {vscode.Position} position - 光标位置
 * @returns {ModuleAccessAtCursor | undefined} 解析结果，不匹配时返回 undefined
 */
export function parseCurrentLineModuleAccess(
  document: vscode.TextDocument,
  position: vscode.Position,
): ModuleAccessAtCursor | undefined {
  const linePrefix = document
    .lineAt(position)
    .text.slice(0, position.character);
  const dotMatch = linePrefix.match(/([A-Za-z_$][\w$]*)\.([A-Za-z0-9_-]*)$/);
  if (!dotMatch) {
    return undefined;
  }
  const [, varName, typed] = dotMatch;
  return {
    varName,
    typed,
    dotIndex: dotMatch.index! + varName.length,
  };
}

/**
 * 获取当前变量所属的 import 样式文件的地址
 * @param document
 * @param text
 * @param varName
 * @returns
 */
export function getCurrentVarBelongImportStylePath(
  document: vscode.TextDocument,
  varName: string,
) {
  const list = getVueFilePathAndImportStylePathMap(document.uri.fsPath);
  const obj = list.find((item) => item.varName === varName);
  return obj?.fullPath;
}

/**
 * 获取样式文件中所有 class 的列表（支持 SCSS/LESS 嵌套选择器）
 * @param {string} cssContent - 样式文件内容
 * @returns {string[]} 所有 class 名称的数组（不含点号，已去重）
 */
export function getStyleFileTopClassList(cssContent: string): string[] {
  return buildStyleFileIndex(cssContent).classNames;
}

/**
 * 获取CSS Module文件中所有class名称（用于代码提示）
 * @param {vscode.TextDocument} document - 当前Vue文档
 * @param {string} varName - CSS Module变量名（如 style）
 * @returns {string[]} class名称数组
 */
export function getModuleCssContent(
  document: vscode.TextDocument,
  varName: string,
): string[] {
  const stylePath = getCurrentVarBelongImportStylePath(document, varName);
  if (!stylePath) {
    return [];
  }
  return getStyleFileIndex(stylePath)?.classNames ?? [];
}

/**
 * 是否是vue文件
 * @param fullPath
 * @returns
 */
export function isVueFile(fullPath: string) {
  if (fullPath.endsWith(".vue")) {
    return true;
  }

  return false;
}

/**
 * 是否是 样式module 文件
 * @param {string} fullPath - 文件完整路径
 * @returns {boolean} 是否为 css module 样式文件
 */
export function isStyleModuleFile(fullPath: string): boolean {
  return /\.module\.(scss|sass|less|styl|css)$/.test(fullPath);
}

/**
 * 跳转到文件的具体定位处
 * @param path
 * @param range
 * @returns
 */
export function jumpToFileLocation(path: string, range: vscode.Range) {
  return new vscode.Location(vscode.Uri.file(path), range);
}
