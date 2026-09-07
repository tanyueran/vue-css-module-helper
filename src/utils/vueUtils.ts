import { Uri } from "vscode";
import {
  getVueFilePathAndImportStylePathMap,
  setVueFilePathAndImportStylePathMap,
} from "../store";
import { resolveStyleModulePath } from "./aliasResolver";

/**
 * vue文件中导入的样式文件的路径对象
 */
export interface VueImportModuleObj {
  varName: string; // 导入的变量名
  fullPath: string; // 样式文件的完整路径
}

/**
 * 支持的 css module 样式文件扩展名
 */
const MODULE_STYLE_EXT = "(?:scss|sass|less|styl|css)";

/**
 * 匹配 `import style from 'xxx.module.scss'`
 * 同时兼容 `import style, { a } from '...'`
 */
const IMPORT_DEFAULT_REGEX = new RegExp(
  `import\\s+([A-Za-z_$][\\w$]*)\\s*(?:,\\s*\\{[^}]*\\})?\\s*from\\s*['"]([^'"]+\\.module\\.${MODULE_STYLE_EXT})['"]`,
  "g",
);

/**
 * 匹配 `const style = require('xxx.module.scss')`
 */
const REQUIRE_REGEX = new RegExp(
  `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*require\\s*\\(\\s*['"]([^'"]+\\.module\\.${MODULE_STYLE_EXT})['"]\\s*\\)`,
  "g",
);

/**
 * 匹配 `const style = useCssModule()` / `useCssModule('foo')`
 * useCssModule 对应的是 SFC 内的 `<style module>`，没有外部文件路径
 */
const USE_CSS_MODULE_REGEX =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useCssModule\s*\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;

/**
 * 匹配 SFC 内的 `<style module>` / `<style module="foo">` 开标签
 */
const STYLE_MODULE_TAG_REGEX = /<style\b[^>]*\bmodule\b(?:\s*=\s*["']([^"']*)["'])?[^>]*>/g;

/**
 * 解析 vue 文件中通过 import / require 引入的外部 css module 样式文件
 * @param {Uri} currentFileUri - 当前 vue 文件的 uri
 * @param {string} content - 文件内容
 * @returns {VueImportModuleObj[]} 变量名与样式文件绝对路径的映射列表
 */
function parseExternalStyleImports(
  currentFileUri: Uri,
  content: string,
): VueImportModuleObj[] {
  const result: VueImportModuleObj[] = [];

  [IMPORT_DEFAULT_REGEX, REQUIRE_REGEX].forEach((regex) => {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const [, varName, modulePath] = match;
      if (!varName || !modulePath) {
        continue;
      }
      const fullPath = resolveStyleModulePath(currentFileUri, modulePath);
      if (!fullPath) {
        continue;
      }
      result.push({ varName, fullPath });
    }
  });

  return result;
}

/**
 * 解析 vue 文件中的 `<style module>` 内联模块及其对应的变量名
 *
 * 对应关系：
 * - `<style module>` 在模板中通过 `$style` 访问
 * - `<style module="foo">` 在模板中通过 `foo` 访问
 * - `const s = useCssModule('foo')` 在脚本中把内联模块绑定到变量 s
 * 内联模块的样式就写在 vue 文件自身，因此 fullPath 指向该 vue 文件
 *
 * @param {Uri} currentFileUri - 当前 vue 文件的 uri
 * @param {string} content - 文件内容
 * @returns {VueImportModuleObj[]} 变量名与 vue 文件自身路径的映射列表
 */
function parseInlineStyleModules(
  currentFileUri: Uri,
  content: string,
): VueImportModuleObj[] {
  const result: VueImportModuleObj[] = [];
  const selfPath = currentFileUri.fsPath;

  // 收集 <style module> 声明的模块名
  const declaredNames = new Set<string>();
  STYLE_MODULE_TAG_REGEX.lastIndex = 0;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = STYLE_MODULE_TAG_REGEX.exec(content)) !== null) {
    declaredNames.add(tagMatch[1] || "$style");
  }

  if (declaredNames.size === 0) {
    return result;
  }

  // 模板中直接以模块名访问
  declaredNames.forEach((name) => {
    result.push({ varName: name, fullPath: selfPath });
  });

  // 脚本中通过 useCssModule 绑定到自定义变量名
  USE_CSS_MODULE_REGEX.lastIndex = 0;
  let useMatch: RegExpExecArray | null;
  while ((useMatch = USE_CSS_MODULE_REGEX.exec(content)) !== null) {
    const [, varName, moduleName] = useMatch;
    if (!varName) {
      continue;
    }
    // 未传参时对应默认的 $style 模块
    const targetName = moduleName || "$style";
    if (declaredNames.has(targetName)) {
      result.push({ varName, fullPath: selfPath });
    }
  }

  return result;
}

/**
 * 解析当前vue文件内容中所有的导入样式文件
 * 覆盖 import / require / `<style module>` / useCssModule 四种来源
 * @param {Uri} currentFileUri - 当前vue文件的uri
 * @param {string} content - 文件内容
 * @returns {VueImportModuleObj[]} 变量名与样式文件路径的映射列表
 */
export function parseCurrentVueContentAllImportStyleModulePath(
  currentFileUri: Uri,
  content: string,
): VueImportModuleObj[] {
  const matchList = [
    ...parseExternalStyleImports(currentFileUri, content),
    ...parseInlineStyleModules(currentFileUri, content),
  ];

  // 同名变量以先解析到的为准（外部 import 优先）
  const uniqueList: VueImportModuleObj[] = [];
  const seen = new Set<string>();
  matchList.forEach((item) => {
    if (seen.has(item.varName)) {
      return;
    }
    seen.add(item.varName);
    uniqueList.push(item);
  });

  // 添加/更新进入缓存
  setVueFilePathAndImportStylePathMap(currentFileUri.fsPath, uniqueList);
  return uniqueList;
}

/**
 * 获取当前vue文件中所有的导入样式文件
 * @param currentFileUri
 * @param content  文件内容
 * @returns
 */
export function getCurrentVueFileAllImportStyleModulePath(
  currentFileUri: Uri,
  content: string,
): VueImportModuleObj[] {
  let cache = getVueFilePathAndImportStylePathMap(currentFileUri.fsPath);
  if (cache.length) {
    return cache;
  }
  return parseCurrentVueContentAllImportStyleModulePath(
    currentFileUri,
    content,
  );
}
