import * as vscode from "vscode";
import { findClassRangeInStyleFile, jumpToFileLocation } from "../utils";
import {
  getCurrentVueFileAllImportStyleModulePath,
  VueImportModuleObj,
} from "../utils/vueUtils";

/**
 * 匹配 css module 的两种访问写法：
 * - 点号访问：style.foo
 * - 下标访问：style['foo-bar'] / style["foo-bar"] / style[`foo-bar`]
 */
const CSS_MODULE_ACCESS_REGEX =
  /([A-Za-z_$][\w$]*)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(['"`])([^'"`]+)\3\s*\])/g;

/**
 * 光标所在处解析出的 css module 访问信息
 */
interface AccessInfo {
  /** 变量名，如 style */
  varName: string;
  /** 类名，如 foo-bar */
  className: string;
  /** 光标是否落在变量名上（而非类名上） */
  onVarName: boolean;
}

/**
 * 从当前行中解析光标所在的 css module 访问表达式
 *
 * 相比逐字符向两侧扫描的做法，这里直接在整行上做全局匹配，
 * 再判断光标是否落在某个匹配区间内，可正确处理模板字符串、
 * 数组字面量、多个表达式共存等场景
 *
 * @param {string} lineContent - 光标所在行的完整文本
 * @param {number} character - 光标在该行中的列索引
 * @returns {AccessInfo | undefined} 解析结果，未命中返回 undefined
 */
function parseAccessAtPosition(
  lineContent: string,
  character: number,
): AccessInfo | undefined {
  CSS_MODULE_ACCESS_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CSS_MODULE_ACCESS_REGEX.exec(lineContent)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    // 光标需落在整个表达式范围内（含末尾，便于点在表达式右边界时也能识别）
    if (character < start || character > end) {
      continue;
    }

    const varName = match[1];
    const className = match[2] ?? match[4];
    if (!className) {
      continue;
    }

    return {
      varName,
      className,
      onVarName: character <= start + varName.length,
    };
  }

  return undefined;
}

/**
 * 跳到样式文件中指定类名的位置，找不到类名时兜底跳到文件顶部
 * @param {string} stylePath - 样式文件的完整路径
 * @param {string} className - 类名（不含点号）
 * @returns {vscode.Location} 跳转位置
 */
function jumpToStyleFileLocationByRange(
  stylePath: string,
  className: string,
): vscode.Location {
  const range = findClassRangeInStyleFile(stylePath, className);
  if (range) {
    return jumpToFileLocation(stylePath, range);
  }
  return jumpToStyleFileLocationTop(stylePath);
}

/**
 * 跳到样式文件的顶部
 * @param {string} stylePath - 样式文件的完整路径
 * @returns {vscode.Location} 指向文件首行首列的位置
 */
function jumpToStyleFileLocationTop(stylePath: string): vscode.Location {
  return jumpToFileLocation(
    stylePath,
    new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
  );
}

/**
 * 定位css module 类名
 */
export class CssModuleDefinitionProvider implements vscode.DefinitionProvider {
  /**
   * 提供 css module 类名的定义位置
   * @param {vscode.TextDocument} document - 当前文档
   * @param {vscode.Position} position - 点击的位置
   * @param {vscode.CancellationToken} token - 取消令牌
   * @returns {vscode.ProviderResult<vscode.Definition>} 目标位置，无法定位时返回 undefined
   */
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
    if (token.isCancellationRequested) {
      return undefined;
    }

    // 先解析vue文件的import 样式文件的路径
    const parseResultList: VueImportModuleObj[] =
      getCurrentVueFileAllImportStyleModulePath(
        document.uri,
        document.getText(),
      );
    if (parseResultList.length === 0) {
      return undefined;
    }

    const lineContent = document.lineAt(position.line).text;
    const access = parseAccessAtPosition(lineContent, position.character);
    if (!access) {
      return undefined;
    }

    const target = parseResultList.find(
      (item) => item.varName === access.varName,
    );
    if (!target) {
      return undefined;
    }

    // 点在变量名上时，直接打开样式文件
    if (access.onVarName) {
      return jumpToStyleFileLocationTop(target.fullPath);
    }

    return jumpToStyleFileLocationByRange(target.fullPath, access.className);
  }
}
