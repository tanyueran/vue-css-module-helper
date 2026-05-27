import * as vscode from "vscode";
import { findStringRangeInFile, jumpToFileLocation } from "../utils";
import {
  getCurrentVueFileAllImportStyleModulePath,
  VueImportModuleObj,
} from "../utils/vueUtils";

/**
 * 跳到样式文件指定位置
 * @param stylePath
 * @param className
 * @returns
 */
function jumpToStyleFileLocationByRange(stylePath: string, className: string) {
  // 获取在样式文件中的位置，并跳到对应的地方去
  const range = findStringRangeInFile(stylePath, `.${className}`);
  if (range) {
    return jumpToFileLocation(stylePath, range);
  }
  return undefined;
}

/**
 * 跳到样式文件的顶部
 * @param stylePath
 * @returns
 */
function jumpToStyleFileLocationTop(stylePath: string) {
  return jumpToFileLocation(
    stylePath,
    new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
  );
}

/**
 * 定位css module 类名
 * @param document 当前文档
 * @param position 点击的位置
 * @param token 取消令牌，用于取消异步操作，当用户 取消时调用
 * @returns
 */
export class CssModuleDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
    // 先解析vue文件的import 样式文件的路径
    const parseResultList: VueImportModuleObj[] =
      getCurrentVueFileAllImportStyleModulePath(
        document.uri,
        document.getText(),
      );
    // 解析为空，说明没有import的内容
    if (parseResultList.length === 0) {
      return undefined;
    }
    // 获取点击的单词范围
    const wordRange = document.getWordRangeAtPosition(position, /[\w\[\]'"]+/);
    if (!wordRange) {
      return undefined;
    }
    // 点击的单词内容
    const clickText = document.getText(wordRange);
    console.log("点击的text为：", clickText);
    const lineRange = document.lineAt(position.line).range;
    // 点击的当前行的内容
    let lineContent = document.getText(lineRange);

    /**
     * 点击的内容含有 .
     */
    if (clickText.includes(".")) {
      console.log("===========走的含点的逻辑============");
      const splitList = clickText.split(".");
      if (splitList.length !== 2) {
        return undefined;
      }
      const [varName, styleName] = splitList;
      const obj = parseResultList.find((item) => item.varName === varName);
      if (!obj) {
        return undefined;
      }
      return jumpToStyleFileLocationByRange(obj.fullPath, styleName);
      /**
       * 点击的内容是 style['xxx-xxx']
       */
    } else if (/(\w+)\[['"]([a-zA-z_-]+)['"]\]/.test(clickText)) {
      console.log("===========走的含【】的逻辑============");
      const match = /(\w+)\[['"]([a-zA-z_-]+)['"]\]/.exec(clickText);
      if (!match) {
        return undefined;
      }
      const [, varName, styleName] = match;
      const obj = parseResultList.find((item) => item.varName === varName);
      if (!obj) {
        return undefined;
      }
      return jumpToStyleFileLocationByRange(obj.fullPath, styleName);
      /**
       * 点击的内容是 stye['xx-
       */
    } else if (clickText.includes("[")) {
      console.log("===========走的含【的逻辑============");
      let _clickText = clickText;
      if (/^['"]\[/.test(clickText)) {
        _clickText = clickText.replace(/^['"]\[/, "");
      }
      const splitList = _clickText.split(/\[['"]{1}/);
      if (splitList.length !== 2) {
        return undefined;
      }
      const [varName, portStyleName] = splitList.map((item) => {
        let startReg = /^['"]/g;
        if (startReg.test(item)) {
          return item.replace(startReg, "");
        }
        let endReg = /['"]$/g;
        if (endReg.test(item)) {
          return item.replace(endReg, "");
        }
        return item;
      });
      const obj = parseResultList.find((item) => item.varName === varName);
      if (!obj) {
        return undefined;
      }
      const reg = new RegExp(
        `${varName}\\[['"\`](${portStyleName}[a-zA-Z-_]*)['"\`]\\]`,
      );
      const match = lineContent.match(reg);
      if (!match) {
        return undefined;
      }
      const [, styleName] = match;
      // 跳转样式文件指定位置
      return jumpToStyleFileLocationByRange(obj.fullPath, styleName);

      /**
       * 点击的是style 或者 点击的是变量中的某一个
       */
    } else {
      console.log("===========走的最后的一步逻辑============");
      // 当前点击的位置，在当前行的index值
      const index = position.character;
      let startIndex = index;
      let endIndex = index;
      while (!/['",]/.test(lineContent[startIndex])) {
        startIndex--;
        if (startIndex <= 0) {
          break;
        }
      }
      while (!/['",]/.test(lineContent[endIndex])) {
        endIndex++;
        if (endIndex >= lineContent.length) {
          break;
        }
      }
      // 结果不应该含有引号
      let likeStyleName = lineContent.slice(startIndex + 1, endIndex).trim();
      console.log("styleName", likeStyleName);
      if (likeStyleName.includes(".")) {
        console.log("----styleName 包含.-----");
        const match = likeStyleName.match(/(\w+).(\w+)/);
        if (!match) {
          return undefined;
        }
        const [, varName, styleName] = match;
        console.log("varName", varName);
        console.log("styleName", styleName);
        const obj = parseResultList.find((item) => item.varName === varName);
        if (!obj) {
          return undefined;
        }
        return jumpToStyleFileLocationByRange(obj.fullPath, styleName);
      } else {
        console.log("----styleName 不包含.-----");
        let splitCaret: string | RegExp = likeStyleName;
        if (likeStyleName.includes("-")) {
          splitCaret = new RegExp(`\\[['"]${likeStyleName}['"]\\]`);
        }
        const splitList = lineContent.split(splitCaret);
        if (!splitList.length) {
          return undefined;
        }
        const match = splitList[0].match(/(\w+)$/);
        if (!match) {
          return undefined;
        }
        const [, varName] = match;
        const obj = parseResultList.find((item) => item.varName === varName);
        if (!obj) {
          return undefined;
        }
        return jumpToStyleFileLocationByRange(obj.fullPath, likeStyleName);
      }
    }
  }
}
