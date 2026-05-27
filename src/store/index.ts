import { VueImportModuleObj } from "../utils/vueUtils";

/**
 * 缓存已经解析的样式文件中的内容
 * key: fullPath
 * value: class 的 string[]
 */
const styleContentPathAndClassMap = new Map<string, string[]>();

/**
 * 设置样式文件的缓存
 * @param fullPath 样式文件的fullPath
 * @param classNameList 类名数组
 */
export function setStyleContentPathAndClass(
  fullPath: string,
  classNameList: string[],
) {
  styleContentPathAndClassMap.set(fullPath, classNameList);
}
/**
 * 获取样式文件的缓存
 * @param fullPath 样式文件的fullPath
 * @returns 类名数组
 */
export function getStyleContentPathAndClass(
  fullPath: string,
): string[] | undefined {
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
 * 清空vue文件的缓存
 */
export function clearVueFilePathAndImportStylePathMap() {
  vueFilePathAndImportStylePathMap.clear();
}
