import * as assert from "node:assert";
import {
  clearAliasRuleCache,
  resolveStyleModulePath,
} from "../utils/aliasResolver";
import { samplePath, sampleUri } from "./helper";

suite("aliasResolver 路径别名解析", () => {
  setup(() => {
    clearAliasRuleCache();
  });

  test("解析相对路径", () => {
    const resolved = resolveStyleModulePath(
      sampleUri("src", "components", "MixedImport.vue"),
      "../styles/nested.module.less",
    );
    assert.strictEqual(resolved, samplePath("src/styles/nested.module.less"));
  });

  test("解析内置默认别名 @/", () => {
    const resolved = resolveStyleModulePath(
      sampleUri("src", "components", "AliasImport.vue"),
      "@/styles/common.module.scss",
    );
    assert.strictEqual(resolved, samplePath("src/styles/common.module.scss"));
  });

  test("解析内置默认别名 ~/", () => {
    const resolved = resolveStyleModulePath(
      sampleUri("src", "components", "AliasImport.vue"),
      "~/src/styles/common.module.scss",
    );
    assert.strictEqual(resolved, samplePath("src/styles/common.module.scss"));
  });

  test("解析 tsconfig paths 中的别名（含 jsonc 注释与尾逗号）", () => {
    const resolved = resolveStyleModulePath(
      sampleUri("src", "components", "MixedImport.vue"),
      "#styles/common.module.scss",
    );
    assert.strictEqual(resolved, samplePath("src/styles/common.module.scss"));
  });

  test("解析绝对路径", () => {
    const absolute = samplePath("src/styles/common.module.scss");
    assert.strictEqual(
      resolveStyleModulePath(sampleUri("src", "components", "AliasImport.vue"), absolute),
      absolute,
    );
  });

  test("文件不存在时返回 undefined", () => {
    assert.strictEqual(
      resolveStyleModulePath(
        sampleUri("src", "components", "AliasImport.vue"),
        "@/styles/not-exist.module.scss",
      ),
      undefined,
    );
  });
});
