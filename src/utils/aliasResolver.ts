import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 一条路径别名规则
 */
interface AliasRule {
  /** 别名前缀，通配规则形如 `@/`，精确规则形如 `@app` */
  prefix: string;
  /** 是否为通配规则（tsconfig 中的 `@/*` 形式） */
  wildcard: boolean;
  /** 候选目标目录/文件的绝对路径 */
  targets: string[];
}

/**
 * 别名规则缓存
 * key: 工作区根目录绝对路径
 * value: 已按前缀长度倒序排列的规则列表
 */
const aliasRuleCache = new Map<string, AliasRule[]>();

/**
 * 可能包含 paths 配置的配置文件名（按优先级排列）
 */
const TS_CONFIG_FILE_NAMES = [
  "tsconfig.json",
  "jsconfig.json",
  "tsconfig.app.json",
  "tsconfig.web.json",
];

/**
 * 清空别名规则缓存
 * 在 tsconfig/jsconfig 变更或用户配置变更时调用
 * @returns {void}
 */
export function clearAliasRuleCache(): void {
  aliasRuleCache.clear();
}

/**
 * 获取当前文件所属的工作区路径
 * @param {vscode.Uri} fileUri - 文件 uri
 * @returns {string | undefined} 工作区根目录绝对路径
 */
export function getWorkspacePathForFile(
  fileUri: vscode.Uri,
): string | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  return workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
}

/**
 * 去除 JSON 内容中的注释与尾逗号，使其可被 JSON.parse 解析
 * tsconfig.json 允许 jsonc 语法，必须先做清洗
 * @param {string} text - 原始文本
 * @returns {string} 清洗后的 JSON 文本
 */
function stripJsonComments(text: string): string {
  let result = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const cur = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (cur === "\n") {
        inLineComment = false;
        result += cur;
      }
      continue;
    }
    if (inBlockComment) {
      if (cur === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      result += cur;
      if (cur === "\\") {
        result += next ?? "";
        i++;
      } else if (cur === '"') {
        inString = false;
      }
      continue;
    }
    if (cur === '"') {
      inString = true;
      result += cur;
      continue;
    }
    if (cur === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (cur === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    result += cur;
  }

  // 去掉对象/数组的尾逗号
  return result.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * 读取并解析一个 jsonc 配置文件
 * @param {string} filePath - 配置文件绝对路径
 * @returns {Record<string, any> | undefined} 解析结果，读取或解析失败返回 undefined
 */
function readJsonConfigFile(
  filePath: string,
): Record<string, any> | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    return JSON.parse(stripJsonComments(fs.readFileSync(filePath, "utf-8")));
  } catch (error) {
    console.error("解析配置文件失败:", filePath, error);
    return undefined;
  }
}

/**
 * 把一条 `别名 -> 目标` 映射规范化为 AliasRule
 * @param {string} aliasKey - 别名，如 `@/*`、`@`、`~`
 * @param {string[]} targetList - 目标路径列表（相对 baseDir）
 * @param {string} baseDir - 目标路径的解析基准目录
 * @returns {AliasRule} 规范化后的规则
 */
function normalizeAliasRule(
  aliasKey: string,
  targetList: string[],
  baseDir: string,
): AliasRule {
  const wildcard = aliasKey.includes("*");
  // `@/*` -> 前缀 `@/`；不含通配符时前缀即别名本身
  const prefix = wildcard
    ? aliasKey.slice(0, aliasKey.indexOf("*"))
    : aliasKey;

  const targets = targetList.map((target) => {
    const cleaned = target.includes("*")
      ? target.slice(0, target.indexOf("*"))
      : target;
    return path.resolve(baseDir, cleaned);
  });

  return { prefix, wildcard: wildcard || prefix.endsWith("/"), targets };
}

/**
 * 从用户配置 `vueCssModuleHelper.alias` 中读取别名规则
 * @param {string} workspaceRoot - 工作区根目录
 * @returns {AliasRule[]} 别名规则列表
 */
function loadAliasFromSettings(workspaceRoot: string): AliasRule[] {
  const config = vscode.workspace
    .getConfiguration("vueCssModuleHelper")
    .get<Record<string, string | string[]>>("alias");
  if (!config) {
    return [];
  }

  return Object.entries(config).map(([aliasKey, target]) => {
    const targetList = Array.isArray(target) ? target : [target];
    // 用户配置中不带 * 的别名，统一按「目录别名」处理，如 `@` -> `@/`
    const normalizedKey =
      aliasKey.includes("*") || aliasKey.endsWith("/")
        ? aliasKey
        : `${aliasKey}/`;
    return normalizeAliasRule(normalizedKey, targetList, workspaceRoot);
  });
}

/**
 * 从 tsconfig / jsconfig 的 compilerOptions.paths 中读取别名规则
 * @param {string} workspaceRoot - 工作区根目录
 * @returns {AliasRule[]} 别名规则列表
 */
function loadAliasFromTsConfig(workspaceRoot: string): AliasRule[] {
  const rules: AliasRule[] = [];

  TS_CONFIG_FILE_NAMES.forEach((fileName) => {
    const configPath = path.join(workspaceRoot, fileName);
    const config = readJsonConfigFile(configPath);
    const paths = config?.compilerOptions?.paths;
    if (!paths || typeof paths !== "object") {
      return;
    }
    const baseUrl: string = config.compilerOptions.baseUrl || ".";
    const baseDir = path.resolve(workspaceRoot, baseUrl);

    Object.entries(paths).forEach(([aliasKey, target]) => {
      const targetList = Array.isArray(target) ? (target as string[]) : [];
      if (targetList.length === 0) {
        return;
      }
      rules.push(normalizeAliasRule(aliasKey, targetList, baseDir));
    });
  });

  return rules;
}

/**
 * 获取工作区的别名规则（带缓存）
 * 优先级：用户配置 > tsconfig/jsconfig paths > 内置默认（@ 和 ~）
 * @param {string} workspaceRoot - 工作区根目录
 * @returns {AliasRule[]} 按前缀长度倒序排列的规则列表
 */
function getAliasRules(workspaceRoot: string): AliasRule[] {
  const cached = aliasRuleCache.get(workspaceRoot);
  if (cached) {
    return cached;
  }

  const defaultRules: AliasRule[] = [
    { prefix: "@/", wildcard: true, targets: [path.join(workspaceRoot, "src")] },
    { prefix: "~/", wildcard: true, targets: [workspaceRoot] },
  ];

  const rules = [
    ...loadAliasFromSettings(workspaceRoot),
    ...loadAliasFromTsConfig(workspaceRoot),
    ...defaultRules,
  ];
  // 前缀更长的规则更具体，需要优先匹配
  rules.sort((a, b) => b.prefix.length - a.prefix.length);

  aliasRuleCache.set(workspaceRoot, rules);
  return rules;
}

/**
 * 把 import 中的模块路径解析为磁盘上的绝对路径
 *
 * 解析顺序：
 * 1. 相对路径（./ 或 ../）：相对当前文件目录解析
 * 2. 别名路径：按用户配置 / tsconfig paths / 默认规则依次尝试
 * 3. 以上都无法命中或文件不存在时返回 undefined
 *
 * @param {vscode.Uri} currentFileUri - 当前 vue 文件的 uri
 * @param {string} modulePath - import 语句中的模块路径
 * @returns {string | undefined} 存在的样式文件绝对路径，解析失败返回 undefined
 */
export function resolveStyleModulePath(
  currentFileUri: vscode.Uri,
  modulePath: string,
): string | undefined {
  // 【情况1】相对路径
  if (modulePath.startsWith("./") || modulePath.startsWith("../")) {
    const resolved = path.resolve(
      path.dirname(currentFileUri.fsPath),
      modulePath,
    );
    return fs.existsSync(resolved) ? resolved : undefined;
  }

  // 【情况2】绝对路径
  if (path.isAbsolute(modulePath)) {
    return fs.existsSync(modulePath) ? modulePath : undefined;
  }

  // 【情况3】别名路径
  const workspaceRoot = getWorkspacePathForFile(currentFileUri);
  if (!workspaceRoot) {
    return undefined;
  }

  for (const rule of getAliasRules(workspaceRoot)) {
    let restPath: string | undefined;
    if (rule.wildcard) {
      if (modulePath.startsWith(rule.prefix)) {
        restPath = modulePath.slice(rule.prefix.length);
      }
    } else if (modulePath === rule.prefix) {
      restPath = "";
    }
    if (restPath === undefined) {
      continue;
    }

    for (const target of rule.targets) {
      const candidate = restPath ? path.resolve(target, restPath) : target;
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}
