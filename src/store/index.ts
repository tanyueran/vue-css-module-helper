import { VueImportModuleObj } from "../utils/vueUtils";
import type { StyleFileIndex } from "../utils/styleParser";

/**
 * 缓存已经解析的样式文件索引
 * key: fullPath
 * value: 该文件的 class 定义索引（含类名与位置）
 */
const styleContentPathAndClassMap = new Map<string, StyleFileIndex>();

/**
 * 设置样式文件的缓存
 * @param {string} fullPath - 样式文件的fullPath
 * @param {StyleFileIndex} index - 解析出的 class 索引
 * @returns {void}
 */
export function setStyleContentPathAndClass(
  fullPath: string,
  index: StyleFileIndex,
): void {
  styleContentPathAndClassMap.set(fullPath, index);
}

/**
 * 获取样式文件的缓存
 * @param {string} fullPath - 样式文件的fullPath
 * @returns {StyleFileIndex | undefined} class 索引，未缓存时返回 undefined
 */
export function getStyleContentPathAndClass(
  fullPath: string,
): StyleFileIndex | undefined {
  return styleContentPathAndClassMap.get(fullPath);
}

/**
 * 删除样式文件的缓存
 * @param fullPath 样式文件的fullPath
 */
export function deleteStyleContentPathAndClass(fullPath: string) {
  styleContentPathAndClassMap.delete(fullPath);
}
/**
 * 清空样式文件的缓存
 */
export function clearStyleContentPathAndClassMap() {
  styleContentPathAndClassMap.clear();
}

/**
 * 缓存解析的vue文件和引入的样式文件的内容
 * key: vueFileFullPath
 * value: {varName: 变量名称：style  fullPath: 引入样式文件的fullPath: ..../ss.module.scss}的数组
 */
const vueFilePathAndImportStylePathMap = new Map<
  string,
  VueImportModuleObj[]
>();

/**
 * 设置vue文件的缓存
 * @param vueFileFullPath vue文件的fullPath
 * @param value 引入的样式文件的数组
 */
export function setVueFilePathAndImportStylePathMap(
  vueFileFullPath: string,
  value: VueImportModuleObj[],
) {
  vueFilePathAndImportStylePathMap.set(vueFileFullPath, value);
}

/**
 * 获取vue文件的缓存
 * @param vueFileFullPath vue文件的fullPath
 * @returns 引入的样式文件的数组
 */
export function getVueFilePathAndImportStylePathMap(
  vueFileFullPath: string,
): VueImportModuleObj[] {
  return vueFilePathAndImportStylePathMap.get(vueFileFullPath) || [];
}

/**
 * 删除vue文件的缓存
 * @param vueFileFullPath vue文件的fullPath
 */
export function deleteVueFilePathAndImportStylePathMap(
  vueFileFullPath: string,
) {
  vueFilePathAndImportStylePathMap.delete(vueFileFullPath);
}

/**
 * 找出所有引用了指定样式文件的 vue 文件路径
 * 用于样式文件被删除/重命名时，连带失效相关 vue 文件的 import 缓存
 * @param {string} stylePath - 样式文件的fullPath
 * @returns {string[]} 引用了该样式文件的 vue 文件路径列表
 */
export function findVueFilesReferencingStyle(stylePath: string): string[] {
  const result: string[] = [];
  vueFilePathAndImportStylePathMap.forEach((importList, vueFilePath) => {
    if (importList.some((item) => item.fullPath === stylePath)) {
      result.push(vueFilePath);
    }
  });
  return result;
}

/**
 * 清空vue文件的缓存
 */
export function clearVueFilePathAndImportStylePathMap() {
  vueFilePathAndImportStylePathMap.clear();
}
