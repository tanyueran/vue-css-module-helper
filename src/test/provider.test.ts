import * as assert from "node:assert";
import * as vscode from "vscode";
import { CssModuleCompletionProvider } from "../provider/cssModuleCompletionProvider";
import { CssModuleDefinitionProvider } from "../provider/cssModuleDefinitionProvider";
import {
  clearStyleContentPathAndClassMap,
  clearVueFilePathAndImportStylePathMap,
} from "../store";
import { openSampleDoc, positionOf, samplePath } from "./helper";

/**
 * 一个永不取消的 CancellationToken，供直接调用 Provider 时使用
 */
const noopToken = new vscode.CancellationTokenSource().token;

/**
 * 直接调用补全 Provider 并返回补全项 label 列表
 *
 * 不走 `vscode.executeCompletionItemProvider` 命令，原因是测试实例以
 * `--disable-extensions` 启动，没有 vue 语言支持扩展，`.vue` 会被识别为
 * plaintext，按 `vue` 语言注册的 Provider 不会被命令派发到
 *
 * @param {vscode.TextDocument} document - 目标文档
 * @param {vscode.Position} position - 光标位置
 * @returns {Promise<string[]>} 补全项 label 列表
 */
async function getCompletionLabels(
  document: vscode.TextDocument,
  position: vscode.Position,
): Promise<string[]> {
  const result = await new CssModuleCompletionProvider().provideCompletionItems(
    document,
    position,
    noopToken,
    {
      triggerKind: vscode.CompletionTriggerKind.TriggerCharacter,
      triggerCharacter: ".",
    },
  );
  const items = Array.isArray(result) ? result : (result?.items ?? []);
  return items.map((item) =>
    typeof item.label === "string" ? item.label : item.label.label,
  );
}

/**
 * 直接调用跳转 Provider 并返回目标位置
 * @param {vscode.TextDocument} document - 目标文档
 * @param {vscode.Position} position - 光标位置
 * @returns {Promise<vscode.Location | undefined>} 跳转目标
 */
async function getDefinition(
  document: vscode.TextDocument,
  position: vscode.Position,
): Promise<vscode.Location | undefined> {
  const result = await new CssModuleDefinitionProvider().provideDefinition(
    document,
    position,
    noopToken,
  );
  return result as vscode.Location | undefined;
}

suite("Provider 集成", () => {
  setup(() => {
    clearStyleContentPathAndClassMap();
    clearVueFilePathAndImportStylePathMap();
  });

  test("补全：外部 import 的样式类名", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    const labels = await getCompletionLabels(
      document,
      positionOf(document, "style.container\"", "style.".length),
    );
    assert.ok(labels.includes(".container"));
    // 含连字符的类名以下标访问形式提示
    assert.ok(labels.includes(".['btn-primary']"));
  });

  test("补全：style module 内联模块的 $style", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "InlineModule.vue",
    );
    const labels = await getCompletionLabels(
      document,
      positionOf(document, "$style.inlineBox", "$style.".length),
    );
    assert.ok(labels.includes(".inlineBox"));
    assert.ok(labels.includes(".inlineBox__title"));
    // 已知局限：同一 vue 文件内的多个 style module 块共用一份索引
    //（缓存 key 是 vue 文件路径），因此具名模块 theme 的类名也会出现在 $style 中
    assert.ok(labels.includes(".themeText"));
  });

  test("补全：具名模块与 useCssModule 绑定的变量", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "InlineModule.vue",
    );
    const themeLabels = await getCompletionLabels(
      document,
      positionOf(document, "theme.themeText", "theme.".length),
    );
    assert.ok(themeLabels.includes(".themeText"));

    const sLabels = await getCompletionLabels(
      document,
      positionOf(document, "s.inlineBox", "s.".length),
    );
    assert.ok(sLabels.includes(".inlineBox"));
  });

  test("补全：未知变量不返回任何提示", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    const labels = await getCompletionLabels(
      document,
      positionOf(document, "unknownVar."),
    );
    assert.deepStrictEqual(labels, []);
  });

  test("跳转：点号访问跳到类名定义处", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    const location = await getDefinition(
      document,
      positionOf(document, "style.container\"", "style.cont".length),
    );
    assert.strictEqual(
      location?.uri.fsPath,
      samplePath("src/styles/common.module.scss"),
    );
    assert.strictEqual(location?.range.start.line, 3);
  });

  test("跳转：下标访问支持连字符类名", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    const location = await getDefinition(
      document,
      positionOf(document, "style['btn-primary']", "style['btn".length),
    );
    assert.strictEqual(
      location?.uri.fsPath,
      samplePath("src/styles/common.module.scss"),
    );
    assert.strictEqual(location?.range.start.line, 22);
  });

  test("跳转：点在变量名上时打开样式文件顶部", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    const location = await getDefinition(
      document,
      positionOf(document, "style.container\"", "sty".length),
    );
    assert.strictEqual(
      location?.uri.fsPath,
      samplePath("src/styles/common.module.scss"),
    );
    assert.strictEqual(location?.range.start.line, 0);
  });

  test("跳转：内联模块跳到 vue 文件自身的 style 块", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "InlineModule.vue",
    );
    const location = await getDefinition(
      document,
      positionOf(document, "theme.themeText", "theme.theme".length),
    );
    assert.strictEqual(
      location?.uri.fsPath,
      samplePath("src/components/InlineModule.vue"),
    );
    assert.strictEqual(
      document.lineAt(location!.range.start.line).text.trim(),
      ".themeText {",
    );
  });

  test("跳转：无法解析的表达式返回 undefined", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    assert.strictEqual(
      await getDefinition(document, new vscode.Position(0, 3)),
      undefined,
    );
  });

  test("跳转：变量未绑定任何样式模块时返回 undefined", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    assert.strictEqual(
      await getDefinition(
        document,
        positionOf(document, "unknownVar.container", "unknownVar.cont".length),
      ),
      undefined,
    );
  });
});
