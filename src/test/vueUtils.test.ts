import * as assert from "node:assert";
import { parseCurrentVueContentAllImportStyleModulePath } from "../utils/vueUtils";
import { clearVueFilePathAndImportStylePathMap } from "../store";
import { openSampleDoc, samplePath, sampleUri } from "./helper";

/**
 * 解析指定夹具 vue 文件的 import 映射，并转成便于断言的普通对象
 * @param {string} fileName - components 目录下的文件名
 * @returns {Promise<Record<string, string>>} varName -> 样式文件绝对路径
 */
async function parseFixture(fileName: string): Promise<Record<string, string>> {
  const document = await openSampleDoc("src", "components", fileName);
  const list = parseCurrentVueContentAllImportStyleModulePath(
    sampleUri("src", "components", fileName),
    document.getText(),
  );
  return Object.fromEntries(list.map((item) => [item.varName, item.fullPath]));
}

suite("vueUtils 导入解析", () => {
  setup(() => {
    clearVueFilePathAndImportStylePathMap();
  });

  test("解析别名 import 的默认导入", async () => {
    const map = await parseFixture("AliasImport.vue");
    assert.deepStrictEqual(map, {
      style: samplePath("src/styles/common.module.scss"),
    });
  });

  test("解析相对 import、tsconfig 别名 import 与 require", async () => {
    const map = await parseFixture("MixedImport.vue");
    assert.deepStrictEqual(map, {
      relStyle: samplePath("src/styles/nested.module.less"),
      tsStyle: samplePath("src/styles/common.module.scss"),
      reqStyle: samplePath("src/styles/nested.module.less"),
    });
  });

  test("解析 style module 内联模块与 useCssModule 绑定", async () => {
    const map = await parseFixture("InlineModule.vue");
    const selfPath = samplePath("src/components/InlineModule.vue");
    assert.deepStrictEqual(map, {
      $style: selfPath,
      theme: selfPath,
      s: selfPath,
    });
  });

  test("解析结果写入缓存供后续读取", async () => {
    await parseFixture("AliasImport.vue");
    const cached = await parseFixture("AliasImport.vue");
    assert.strictEqual(
      cached.style,
      samplePath("src/styles/common.module.scss"),
    );
  });
});
