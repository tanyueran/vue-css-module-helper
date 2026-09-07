import * as vscode from "vscode";

/**
 * 样式文件中一个 class 定义的位置信息
 */
export interface ClassDefinition {
  /** 解析后的完整类名，如 xx-page__content */
  name: string;
  /** 选择器片段在原文中的起始索引（指向 . 或 &） */
  index: number;
  /** 选择器片段的长度 */
  length: number;
}

/**
 * 一个样式文件的解析索引
 * 同时缓存类名列表（供补全）与定义位置（供跳转），避免跳转时重复全量解析
 */
export interface StyleFileIndex {
  /** 去重后的类名列表 */
  classNames: string[];
  /** 类名 -> 定义位置范围（同名取首次出现处） */
  ranges: Map<string, vscode.Range>;
}

/**
 * 把注释与字符串字面量替换为等长空格
 * 保持字符索引不变，避免注释/字符串中的伪选择器被误识别
 * @param {string} content - 样式文件原始内容
 * @returns {string} 屏蔽后的内容，长度与入参一致
 */
function maskNonSelectorText(content: string): string {
  const chars = content.split("");
  let i = 0;
  while (i < chars.length) {
    const cur = chars[i];
    const next = chars[i + 1];

    // 块注释 /* ... */
    if (cur === "/" && next === "*") {
      while (i < chars.length) {
        const isEnd = chars[i] === "*" && chars[i + 1] === "/";
        if (chars[i] !== "\n") {
          chars[i] = " ";
        }
        i++;
        if (isEnd) {
          if (chars[i] !== "\n") {
            chars[i] = " ";
          }
          i++;
          break;
        }
      }
      continue;
    }

    // url() 函数调用，跳过其内容，避免内部的 // 被误判为行注释
    if (content.slice(i, i + 4).toLowerCase() === "url(") {
      for (let j = 0; j < 4; j++) {
        chars[i + j] = " ";
      }
      i += 4;
      // 限定在同一行内，避免 url( 未闭合时吞掉整个文件
      while (i < chars.length && chars[i] !== ")" && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      if (i < chars.length && chars[i] === ")") {
        chars[i] = " ";
        i++;
      }
      continue;
    }

    // 行注释 // ...
    if (cur === "/" && next === "/") {
      while (i < chars.length && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      continue;
    }

    // 字符串字面量 '...' / "..."
    if (cur === "'" || cur === '"') {
      const quote = cur;
      chars[i] = " ";
      i++;
      while (i < chars.length && chars[i] !== quote && chars[i] !== "\n") {
        chars[i] = " ";
        i++;
      }
      if (i < chars.length && chars[i] === quote) {
        chars[i] = " ";
        i++;
      }
      continue;
    }

    i++;
  }
  return chars.join("");
}

/**
 * 将选择器中括号内的内容替换为等长空格
 *
 * 用于剥离 `:not(.b)`、`:global(.foo)`、`:nth-child(2n)` 等伪类参数，
 * 避免括号内的 `.b` 被误当作本文件定义的类；保留括号本身以便后续判断 mixin
 *
 * @param {string} text - 单个选择器分组文本
 * @returns {string} 处理后的文本，长度与入参一致
 */
function maskParenContent(text: string): string {
  const chars = text.split("");
  let depth = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === "(") {
      depth++;
      continue;
    }
    if (chars[i] === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

/**
 * 判断一个选择器分组是否为 LESS mixin 定义／调用
 *
 * 依据是左括号紧跟在类名之后（如 `.mixin()`），
 * 而伪类的左括号前必然是 `:xxx`（如 `.a:not(...)`），据此区分二者
 *
 * @param {string} maskedSegment - 已剥离括号内容的选择器分组文本
 * @returns {boolean} 是否为 mixin
 */
function isLessMixinSegment(maskedSegment: string): boolean {
  return /[.&][\w-]+\s*\(/.test(maskedSegment);
}

/**
 * 解析一段选择器文本，收集其中定义的 class
 *
 * 处理规则：
 * - 按逗号拆分为多个选择器
 * - `.xxx` 直接作为一个类名
 * - `&__xxx` / `&--xxx` / `&-xxx` 与父级类名拼接
 * - 每个逗号分组取「最后一个 class」作为子层级的父类名（贴近 SCSS 中 & 的语义）
 * - 含 `#{...}` 插值的选择器无法静态求值，直接跳过
 * - 伪类括号内的类名（如 `:not(.b)`）不计入定义，但 `.a:not(.b)` 中的 `.a` 仍会收集
 * - LESS mixin（如 `.mixin()`）不是类定义，整组跳过
 *
 * @param {string} selectorText - 选择器文本（不含花括号）
 * @param {number} offset - selectorText 在原文中的起始索引
 * @param {string[]} parentNames - 上一层级的父类名列表
 * @returns {{definitions: ClassDefinition[], selfNames: string[]}} 收集到的类定义与本层父类名列表
 */
function parseSelectorGroup(
  selectorText: string,
  offset: number,
  parentNames: string[],
): { definitions: ClassDefinition[]; selfNames: string[] } {
  const definitions: ClassDefinition[] = [];
  const selfNames: string[] = [];

  let segmentStart = 0;
  const segments: Array<{ text: string; start: number }> = [];
  for (let i = 0; i <= selectorText.length; i++) {
    if (i === selectorText.length || selectorText[i] === ",") {
      segments.push({
        text: selectorText.slice(segmentStart, i),
        start: segmentStart,
      });
      segmentStart = i + 1;
    }
  }

  segments.forEach((segment) => {
    // SCSS 插值无法静态求值，跳过整个分组
    if (segment.text.includes("#{")) {
      return;
    }

    // 将括号内的内容替换为空格，避免伪类参数中的选择器被误识别
    const maskedSegment = maskParenContent(segment.text);

    // LESS mixin 定义（如 `.mixin()` 或 `.mixin(@a)`）不是类定义
    if (isLessMixinSegment(maskedSegment)) {
      return;
    }

    // 一个逗号分组内最后出现的 class，作为子层级的父类名
    let lastNameInSegment: string | undefined;
    const tokenRegex = /([.&])([a-zA-Z0-9_-]*)/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(maskedSegment)) !== null) {
      // maskedSegment 与原文等长，索引可直接换算回原文位置
      const [raw, symbol, suffix] = match;
      const rawIndex = offset + segment.start + match.index;

      if (symbol === ".") {
        if (!suffix) {
          continue;
        }
        definitions.push({ name: suffix, index: rawIndex, length: raw.length });
        lastNameInSegment = suffix;
      } else {
        // & 开头：与父级拼接；`&:hover` 这类没有后缀的直接跳过
        if (!suffix) {
          continue;
        }
        parentNames.forEach((parent) => {
          const fullName = parent + suffix;
          definitions.push({
            name: fullName,
            index: rawIndex,
            length: raw.length,
          });
          lastNameInSegment = fullName;
        });
      }
    }

    if (lastNameInSegment) {
      selfNames.push(lastNameInSegment);
    }
  });

  return { definitions, selfNames };
}

/**
 * 扫描样式文件内容，收集所有 class 的定义及其位置
 *
 * 采用逐字符扫描 + 层级栈的方式：
 * - 遇到 `{` 解析缓冲区中的选择器并入栈
 * - 遇到 `}` 出栈
 * - 遇到 `;` 清空缓冲区（属性声明，不是选择器）
 * 由此可正确处理缩进的闭合括号、@media 包裹、多选择器逗号分组等场景
 *
 * @param {string} cssContent - 样式文件内容
 * @returns {ClassDefinition[]} 所有 class 定义（按出现顺序）
 */
export function collectClassDefinitions(cssContent: string): ClassDefinition[] {
  const content = maskNonSelectorText(cssContent);
  const definitions: ClassDefinition[] = [];
  // 每一层的父类名列表，用于 & 拼接
  const stack: string[][] = [];
  let bufferStart = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === "{") {
      const selectorText = content.slice(bufferStart, i);
      const parentNames = stack.length ? stack[stack.length - 1] : [];
      const { definitions: found, selfNames } = parseSelectorGroup(
        selectorText,
        bufferStart,
        parentNames,
      );
      definitions.push(...found);
      // @media 等没有 class 的层级，继承外层父类名，保证内部 & 仍可拼接
      stack.push(selfNames.length ? selfNames : parentNames);
      bufferStart = i + 1;
      continue;
    }

    if (char === "}") {
      stack.pop();
      bufferStart = i + 1;
      continue;
    }

    if (char === ";") {
      bufferStart = i + 1;
    }
  }

  return definitions;
}

/**
 * 将字符索引转换为 VS Code 的 Position
 * @param {number[]} lineStartOffsets - 每一行起始字符索引的升序数组
 * @param {number} index - 字符索引
 * @returns {vscode.Position} 对应的行列位置
 */
function indexToPosition(
  lineStartOffsets: number[],
  index: number,
): vscode.Position {
  // 二分查找 index 所在行
  let low = 0;
  let high = lineStartOffsets.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineStartOffsets[mid] <= index) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return new vscode.Position(low, index - lineStartOffsets[low]);
}

/**
 * 计算每一行在内容中的起始字符索引
 * @param {string} content - 文件内容
 * @returns {number[]} 每行起始索引的升序数组
 */
function computeLineStartOffsets(content: string): number[] {
  const offsets = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * 解析样式文件内容，构建包含类名与位置的索引
 * @param {string} cssContent - 样式文件内容
 * @returns {StyleFileIndex} 该文件的 class 索引
 */
export function buildStyleFileIndex(cssContent: string): StyleFileIndex {
  const definitions = collectClassDefinitions(cssContent);
  const lineStartOffsets = computeLineStartOffsets(cssContent);
  const ranges = new Map<string, vscode.Range>();

  definitions.forEach((definition) => {
    // 同名类取首次出现的位置
    if (ranges.has(definition.name)) {
      return;
    }
    const start = indexToPosition(lineStartOffsets, definition.index);
    const end = indexToPosition(
      lineStartOffsets,
      definition.index + definition.length,
    );
    ranges.set(definition.name, new vscode.Range(start, end));
  });

  return { classNames: [...ranges.keys()], ranges };
}
