import { VueImportModuleObj } from "../utils/vueUtils";

/**
 * 缓存已经解析的样式文件中的内容
 * key: fullPath
 * value: class 的 string[]
 */
const styleContentPathAndClassMap = new Map();

export function setStyleContentPathAndClass(
  fullPath: string,
  classNameList: string[]
) {
  styleContentPathAndClassMap.set(fullPath, classNameList);
}

export function getStyleContentPathAndClass(fullPath: string): string[] | undefined {
  return styleContentPathAndClassMap.get(fullPath);
}

export function deleteStyleContentPathAndClass(fullPath: string) {
  styleContentPathAndClassMap.delete(fullPath);
}

export function clearStyleContentPathAndClassMap() {
  styleContentPathAndClassMap.clear();
}

/**
 * 缓存解析的vue文件和引入的样式文件的内容
 * key: vueFileFullPath
 * value: {varName: 变量名称：style  fullPath: 引入样式文件的fullPath: ..../ss.module.scss}的数组
 */
const vueFilePathAndImportStylePathMap = new Map();

export function setVueFilePathAndImportStylePathMap(
  vueFileFullPath: string,
  value: VueImportModuleObj[]
) {
  vueFilePathAndImportStylePathMap.set(vueFileFullPath, value);
}

export function getVueFilePathAndImportStylePathMap(
  vueFileFullPath: string
): VueImportModuleObj[] {
  return vueFilePathAndImportStylePathMap.get(vueFileFullPath) || [];
}

export function deleteVueFilePathAndImportStylePathMap(
  vueFileFullPath: string
) {
  vueFilePathAndImportStylePathMap.delete(vueFileFullPath);
}

export function clearVueFilePathAndImportStylePathMap() {
  vueFilePathAndImportStylePathMap.clear();
}
