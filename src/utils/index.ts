import * as vscode from "vscode";
import * as fs from "node:fs";
import {
  getStyleContentPathAndClass,
  getVueFilePathAndImportStylePathMap,
} from "../store";

/**
 * 获取字符串在文件中的位置范围（用于定义跳转）
 *
 * 【实现思路】
 * 1. 首先尝试精确匹配搜索字符串（如 .xx-page）
 * 2. 若精确匹配失败且文件是SCSS文件，则尝试匹配嵌套选择器形式
 * 3. SCSS嵌套选择器转换规则：
 *    - 输入: .xx-page__content
 *    - 提取: parent=xx-page, separator=__, suffix=content
 *    - 搜索: &__content（SCSS中嵌套写法）
 * 4. 定位到位置后，根据实际匹配的字符串长度计算结束位置
 *
 * @param fileUri - 文件路径
 * @param searchString - 要搜索的字符串（通常是 .className 形式）
 * @returns 位置范围，找不到返回 null
 */
export function findStringRangeInFile(
  fileUri: string,
  searchString: string,
): vscode.Range | null {
  try {
    // 读取文件内容
    const contentBuffer = fs.readFileSync(fileUri);
    const fileContent = new TextDecoder().decode(contentBuffer);

    // 【步骤1】优先精确匹配（适用于普通CSS选择器）
    let startIndex = fileContent.indexOf(searchString);

    // 【步骤2】精确匹配失败时，处理SCSS嵌套选择器
    if (startIndex === -1 && fileUri.endsWith(".scss")) {
      // BEM命名规范：block__element 或 block--modifier
      // 从完整className中提取父级和后缀部分
      const nestedMatch = searchString.match(
        /^.([a-zA-Z0-9_-]+)(__|--)([a-zA-Z0-9_-]+)$/,
      );
      if (nestedMatch) {
        // 转换为SCSS嵌套写法：&__element 或 &--modifier
        const nestedSelector = "&" + nestedMatch[2] + nestedMatch[3];
        startIndex = fileContent.indexOf(nestedSelector);
      }
    }

    // 【步骤3】仍未找到则返回null
    if (startIndex === -1) {
      return null;
    }

    /**
     * 辅助函数：将字符索引转换为VS Code的Position（行号和列号）
     */
    function indexToPosition(content: string, index: number): vscode.Position {
      const lines = content.substring(0, index).split("\n");
      const line = lines.length - 1;
      const character = lines[line].length;
      return new vscode.Position(line, character);
    }

    // 【步骤4】确定匹配长度（处理SCSS嵌套选择器的长度差异）
    let matchLength = searchString.length;
    if (fileUri.endsWith(".scss")) {
      const nestedMatch = searchString.match(
        /^.([a-zA-Z0-9_-]+)(__|--)([a-zA-Z0-9_-]+)$/,
      );
      if (nestedMatch) {
        const nestedSelector = "&" + nestedMatch[2] + nestedMatch[3];
        // 确认当前找到的位置是嵌套选择器
        if (fileContent.indexOf(nestedSelector) === startIndex) {
          matchLength = nestedSelector.length;
        }
      }
    }

    // 【步骤5】计算起始和结束位置
    const startPos = indexToPosition(fileContent, startIndex);
    const endPos = indexToPosition(fileContent, startIndex + matchLength);
    return new vscode.Range(startPos, endPos);
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
}

/**
 * 解析.前面的变量明文
 * @param document
 * @param position
 * @returns
 */
export function parseCurrentLineVarName(
  document: vscode.TextDocument,
  position: vscode.Position,
) {
  // 解析出变量名称：style.
  const linePrefix = document
    .lineAt(position)
    .text.slice(0, position.character);
  const dotMatch = linePrefix.match(/(\w+)\.([a-zA-Z0-9_]*)$/);
  if (!dotMatch) {
    return undefined;
  }
  const [, varName] = dotMatch;
  return varName;
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
 * 获取当前文件所属的工作区路径
 * * @param fileUri
 * @returns
 */
export function getWorkspacePathForFile(
  fileUri: vscode.Uri,
): string | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  return workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
}

/**
 * 获取样式文件中所有class的列表（支持SCSS嵌套选择器）
 *
 * 【实现思路】
 * 1. 预处理：移除单行注释（// 开头的行），避免注释中的伪类名被误识别
 * 2. 使用栈结构管理嵌套层级：遇到 { 压栈，遇到 } 弹栈
 * 3. 解析规则：
 *    - 普通class选择器（.xxx）：直接添加到结果，同时压入父级栈
 *    - SCSS嵌套选择器（&__xxx 或 &--xxx）：与栈顶父级组合后添加到结果，不压栈
 * 4. 去重处理：同一class可能在多个位置定义，返回唯一结果
 *
 * 【支持的SCSS语法示例】
 * ```scss
 * .xx-page {           // 解析：xx-page（压入栈）
 *   &__content {       // 解析：xx-page__content（与父级组合）
 *     width: 100%;
 *   }
 *   &--active {        // 解析：xx-page--active（与父级组合）
 *     color: red;
 *   }
 * }
 * ```
 *
 * @param cssContent - 样式文件内容
 * @returns 所有class名称的数组（不含点号）
 */
export function getStyleFileTopClassList(cssContent: string) {
  // 【步骤1】预处理：移除单行注释，避免干扰解析
  let processedContent = cssContent
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  // 【步骤2】初始化数据结构
  // parentClasses: 父级class栈，用于处理嵌套关系
  // classList: 最终收集的所有class名称
  const parentClasses: string[] = [];
  const classList: string[] = [];

  // 【步骤3】正则匹配：同时匹配class选择器（.xxx { 或 &__xxx {）和闭合花括号（}）
  // 正则说明：
  // - ([.\&][a-zA-Z0-9_-]+)\s*\{ : 匹配 .className { 或 &__xxx {
  // - ^\} : 匹配行首的闭合花括号（处理嵌套结束）
  const classRegex = /([.\&][a-zA-Z0-9_-]+)\s*\{|^\}/gm;
  let match;

  // 【步骤4】遍历所有匹配结果
  while ((match = classRegex.exec(processedContent)) !== null) {
    if (match[0] === "}") {
      // 【情况A】遇到闭合花括号：弹出父级栈顶元素（表示当前嵌套层级结束）
      parentClasses.pop();
    } else {
      // 【情况B】遇到class选择器定义
      const classSelector = match[1];
      let className = "";

      if (classSelector.startsWith(".")) {
        // 【子情况B1】普通class选择器（如 .xx-page）
        className = classSelector.slice(1); // 移除开头的点号
        if (className) {
          classList.push(className); // 添加到结果列表
          parentClasses.push(className); // 压入父级栈，供子选择器使用
        }
      } else if (classSelector.startsWith("&")) {
        // 【子情况B2】SCSS嵌套选择器（如 &__content 或 &--active）
        const suffix = classSelector.slice(1); // 获取 __content 或 --active
        if (parentClasses.length > 0) {
          // 与父级class组合：父级 + 后缀 = 完整class名
          className = parentClasses[parentClasses.length - 1] + suffix;
          if (className) {
            classList.push(className);
          }
        }
        // 注意：嵌套选择器不压入栈，因为它不是独立的父级
      }
    }
  }

  // 【步骤5】去重并返回
  return [...new Set(classList)];
}

/**
 * 获取CSS Module文件中所有class名称（用于代码提示）
 *
 * 【实现思路】
 * 1. 根据变量名（如 style）查找对应的样式文件路径
 * 2. 优先从缓存获取，避免重复读取文件
 * 3. 缓存未命中时，读取文件并解析所有class
 * 4. 支持 .module.css、.module.scss、.module.less 文件
 *
 * 【调用链】
 * parseCurrentLineVarName → getModuleCssContent → getStyleFileTopClassList
 *
 * @param document - 当前Vue文档
 * @param varName - CSS Module变量名（如 style）
 * @returns class名称数组
 */
export function getModuleCssContent(
  document: vscode.TextDocument,
  varName: string,
): string[] {
  // 【步骤1】根据变量名查找对应的样式文件路径
  const stylePath = getCurrentVarBelongImportStylePath(document, varName);
  if (!stylePath) {
    return [];
  }

  // 【步骤2】优先使用缓存，提升性能
  let res = getStyleContentPathAndClass(stylePath);
  if (res) {
    return res;
  }

  // 【步骤3】缓存未命中，读取文件并解析
  const cssContent = fs.readFileSync(stylePath).toString();
  return getStyleFileTopClassList(cssContent);
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
 * @param fullPath
 * @returns
 */
export function isStyleModuleFile(fullPath: string) {
  if (
    fullPath.endsWith(".module.css") ||
    fullPath.endsWith(".module.less") ||
    fullPath.endsWith(".module.scss")
  ) {
    return true;
  }

  return false;
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
