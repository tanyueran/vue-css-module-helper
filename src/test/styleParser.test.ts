import * as assert from "node:assert";
import { buildStyleFileIndex } from "../utils/styleParser";

suite("styleParser 样式解析", () => {
  test("收集普通类名与逗号分组", () => {
    const index = buildStyleFileIndex(`
.btn,
.btn-primary {
  padding: 4px;
}
`);
    assert.deepStrictEqual(index.classNames, ["btn", "btn-primary"]);
  });

  test("屏蔽注释、字符串与 url() 中的伪选择器", () => {
    const index = buildStyleFileIndex(`
// .line-comment
/* .block-comment */
.real {
  content: ".in-string";
  background: url(./a//b.png);
}
`);
    assert.deepStrictEqual(index.classNames, ["real"]);
  });

  test("支持 & 嵌套拼接并校验父级层级", () => {
    const index = buildStyleFileIndex(`
.container {
  &__header {
    &--active {
      color: blue;
    }
  }
  &:hover {
    color: green;
  }
}
`);
    assert.deepStrictEqual(index.classNames, [
      "container",
      "container__header",
      "container__header--active",
    ]);
  });

  test("伪类括号内的类名不计入定义", () => {
    const index = buildStyleFileIndex(`.card:not(.excluded) { margin: 0; }`);
    assert.deepStrictEqual(index.classNames, ["card"]);
  });

  test("跳过含 SCSS 插值的选择器", () => {
    const index = buildStyleFileIndex(`.#{$dynamic}-item { color: pink; }`);
    assert.deepStrictEqual(index.classNames, []);
  });

  test("跳过 LESS mixin 定义与调用", () => {
    const index = buildStyleFileIndex(`
.rounded(@radius: 2px) {
  border-radius: @radius;
}
.less-card {
  .rounded(4px);
  &-title {
    font-weight: bold;
  }
}
`);
    assert.deepStrictEqual(index.classNames, ["less-card", "less-card-title"]);
  });

  test("@media 包裹层继承外层父类名", () => {
    const index = buildStyleFileIndex(`
.box {
  @media (max-width: 600px) {
    &__inner {
      display: none;
    }
  }
}
`);
    assert.deepStrictEqual(index.classNames, ["box", "box__inner"]);
  });

  test("记录类名首次出现的位置", () => {
    const index = buildStyleFileIndex(`.a { color: red; }\n.a { color: blue; }`);
    const range = index.ranges.get("a");
    assert.ok(range);
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.start.character, 0);
    assert.strictEqual(range.end.character, 2);
  });

  test("不会被同前缀类名误命中", () => {
    const index = buildStyleFileIndex(`.btn-primary { padding: 4px; }`);
    assert.strictEqual(index.ranges.has("btn"), false);
    assert.strictEqual(index.ranges.has("btn-primary"), true);
  });
});
