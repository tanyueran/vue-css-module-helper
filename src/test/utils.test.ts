import * as assert from "node:assert";
import * as vscode from "vscode";
import {
  getStyleFileIndex,
  refreshStyleFileIndex,
  findClassRangeInStyleFile,
  parseCurrentLineModuleAccess,
  isVueFile,
  isStyleModuleFile,
} from "../utils";
import {
  clearStyleContentPathAndClassMap,
  clearVueFilePathAndImportStylePathMap,
  deleteStyleContentPathAndClass,
  findVueFilesReferencingStyle,
  setVueFilePathAndImportStylePathMap,
} from "../store";
import { openSampleDoc, positionOf, samplePath } from "./helper";

suite("utils 与 store 缓存", () => {
  setup(() => {
    clearStyleContentPathAndClassMap();
    clearVueFilePathAndImportStylePathMap();
  });

  test("解析外部样式文件的类名索引", () => {
    const index = getStyleFileIndex(samplePath("src/styles/common.module.scss"));
    assert.deepStrictEqual(index?.classNames, [
      "container",
      "container__header",
      "container__header--active",
      "btn",
      "btn-primary",
      "card",
      "responsive",
    ]);
  });

  test("只解析 vue 文件中的 style module 块，且位置对应真实行列", () => {
    const vuePath = samplePath("src/components/InlineModule.vue");
    const index = getStyleFileIndex(vuePath);
    // 模板中的 :class="$style.inlineBox" 不应被当作选择器收集
    assert.deepStrictEqual(index?.classNames, [
      "inlineBox",
      "inlineBox__title",
      "themeText",
    ]);

    const range = index?.ranges.get("themeText");
    assert.ok(range);
    assert.strictEqual(range.start.character, 0);
  });

  test("findClassRangeInStyleFile 定位到类名首次定义处", () => {
    const range = findClassRangeInStyleFile(
      samplePath("src/styles/common.module.scss"),
      "btn-primary",
    );
    assert.ok(range);
    assert.strictEqual(range.start.line, 22);
    assert.strictEqual(range.start.character, 0);
  });

  test("找不到类名时返回 null", () => {
    assert.strictEqual(
      findClassRangeInStyleFile(
        samplePath("src/styles/common.module.scss"),
        "not-exist",
      ),
      null,
    );
  });

  test("refreshStyleFileIndex 覆盖已有缓存", () => {
    const stylePath = samplePath("src/styles/common.module.scss");
    getStyleFileIndex(stylePath);
    refreshStyleFileIndex(stylePath, ".fresh { color: red; }");
    assert.deepStrictEqual(getStyleFileIndex(stylePath)?.classNames, ["fresh"]);
  });

  test("deleteStyleContentPathAndClass 后重新从磁盘解析", () => {
    const stylePath = samplePath("src/styles/common.module.scss");
    refreshStyleFileIndex(stylePath, ".fresh { color: red; }");
    deleteStyleContentPathAndClass(stylePath);
    assert.ok(getStyleFileIndex(stylePath)?.classNames.includes("container"));
  });

  test("findVueFilesReferencingStyle 反查引用了样式文件的 vue", () => {
    const stylePath = samplePath("src/styles/common.module.scss");
    const vuePath = samplePath("src/components/AliasImport.vue");
    setVueFilePathAndImportStylePathMap(vuePath, [
      { varName: "style", fullPath: stylePath },
    ]);
    assert.deepStrictEqual(findVueFilesReferencingStyle(stylePath), [vuePath]);
    assert.deepStrictEqual(findVueFilesReferencingStyle("/not/exist.scss"), []);
  });

  test("读取不存在的文件返回 undefined", () => {
    assert.strictEqual(
      getStyleFileIndex(samplePath("src/styles/nope.module.scss")),
      undefined,
    );
  });

  test("parseCurrentLineModuleAccess 识别光标处的成员访问", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    const access = parseCurrentLineModuleAccess(
      document,
      positionOf(document, "style.container", "style.co".length),
    );
    assert.deepStrictEqual(
      { varName: access?.varName, typed: access?.typed },
      { varName: "style", typed: "co" },
    );
  });

  test("parseCurrentLineModuleAccess 在非成员访问处返回 undefined", async () => {
    const document = await openSampleDoc(
      "src",
      "components",
      "AliasImport.vue",
    );
    assert.strictEqual(
      parseCurrentLineModuleAccess(document, new vscode.Position(0, 3)),
      undefined,
    );
  });

  test("文件类型判断", () => {
    assert.strictEqual(isVueFile("/a/b.vue"), true);
    assert.strictEqual(isVueFile("/a/b.scss"), false);
    assert.strictEqual(isStyleModuleFile("/a/b.module.scss"), true);
    assert.strictEqual(isStyleModuleFile("/a/b.module.styl"), true);
    assert.strictEqual(isStyleModuleFile("/a/b.scss"), false);
  });
});
