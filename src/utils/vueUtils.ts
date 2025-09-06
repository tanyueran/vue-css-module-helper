import path from "node:path";
import { getWorkspacePathForFile } from ".";
import { Uri } from "vscode";
import {
  getVueFilePathAndImportStylePathMap,
  setVueFilePathAndImportStylePathMap,
} from "../store";

export interface VueImportModuleObj {
  varName: string;
  fullPath: string;
}

/**
 * 解析当前vue文件内容中所有的导入样式文件
 * @param content
 * @returns
 */
export function parseCurrentVueContentAllImportStyleModulePath(
  currentFileUri: Uri,
  content: string
): VueImportModuleObj[] {
  const importRegex =
    /import\s+(\w+)\s+from\s+['"]([^'"]+\.module\.(scss|less|css))['"]/g;
  const matchIterator = content.matchAll(importRegex);
  let matchList: VueImportModuleObj[] = [];
  for (let item of matchIterator) {
    let [, varName, modulePath] = item;
    if (varName) {
      let stylePath = "";
      if (modulePath.includes("@")) {
        const currentWorkSpacePath = getWorkspacePathForFile(currentFileUri);
        if (!currentWorkSpacePath) {
          continue;
        }
        // 默认认为@ 对应 当前工作区下的src
        stylePath = modulePath.replace("@", currentWorkSpacePath + "/src");
      } else {
        let dirPath = path.dirname(currentFileUri.fsPath);
        stylePath = path.resolve(dirPath, modulePath);
      }
      matchList.push({
        varName,
        fullPath: stylePath,
      });
    }
  }
  // 添加/更新进入缓存
  setVueFilePathAndImportStylePathMap(currentFileUri.fsPath, matchList);
  return matchList;
}

/**
 * 获取当前vue文件中所有的导入样式文件
 * @param currentFileUri
 * @param content  文件内容
 * @returns
 */
export function getCurrentVueFileAllImportStyleModulePath(
  currentFileUri: Uri,
  content: string
): VueImportModuleObj[] {
  let cache = getVueFilePathAndImportStylePathMap(currentFileUri.fsPath);
  if (cache.length) {
    return cache;
  }
  return parseCurrentVueContentAllImportStyleModulePath(
    currentFileUri,
    content
  );
}
