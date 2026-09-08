# vue-css-module-helper

> 为 `.vue` 单文件组件中的 CSS Module 提供类名**补全**与**跳转到定义**，外部样式文件与 SFC 内联 `<style module>` 均支持。

![image](https://raw.githubusercontent.com/tanyueran/vue-css-module-helper/main/images/example.gif)

## 功能特性

### 类名补全

在模板或脚本中输入 `style.` 时，自动列出该模块中定义的全部类名：

- 普通类名直接插入为 `style.header`
- 含连字符的类名自动改写为下标写法 `style['header-wrapper']`，并正确替换掉已输入的 `.`

### 跳转到定义

按住 `Cmd/Ctrl` 点击（或 `F12`）即可跳转到样式定义处，支持：

| 场景 | 示例 |
| --- | --- |
| 点号访问 | `<div :class="style.box">` |
| 下标访问 | `<div :class="commonStyle['detail-page-sub-title']">` |
| 数组写法 | `<div :class="[commonStyle['title'], style.active]">` |
| 任意属性传递 | `<Child :xx-class="style.box" />` |
| 点在变量名上 | 点击 `style` 直接打开对应样式文件 |

类名在样式文件中不存在时，兜底跳转到文件顶部。

### 支持的模块来源

| 来源 | 写法 |
| --- | --- |
| 默认导入 | `import style from '@/styles/a.module.scss'`（兼容 `import style, { x } from '...'`） |
| require | `const style = require('./a.module.less')` |
| 内联模块 | `<style module>` → 模板中用 `$style` |
| 具名内联模块 | `<style module="foo">` → 模板中用 `foo` |
| 组合式 API | `const s = useCssModule()` / `useCssModule('foo')` |

支持的样式后缀：`.module.scss` / `.module.sass` / `.module.less` / `.module.styl` / `.module.css`。

### 路径别名解析

导入路径按以下优先级解析：

1. 相对路径（`./`、`../`）与绝对路径
2. 用户配置 `vueCssModuleHelper.alias`
3. `tsconfig.json` / `jsconfig.json` / `tsconfig.app.json` / `tsconfig.web.json` 中的 `compilerOptions.paths`（支持 `baseUrl`、jsonc 注释与尾逗号）
4. 内置默认规则：`@/` → `<工作区>/src`，`~/` → `<工作区>`

### 选择器解析能力

样式文件通过选择器扫描而非简单文本匹配来建立索引，因此：

- 支持 SCSS / LESS 嵌套与 BEM 拼接：`&__title`、`&--active`、`&-item`
- 支持逗号分组选择器、`@media` 等外层包裹中的嵌套 `&`
- 忽略注释、字符串字面量与 `url(...)` 中的伪选择器
- 忽略伪类括号内的类名，如 `:not(.b)`、`:global(.foo)`；但 `.a:not(.b)` 中的 `.a` 仍会收集
- 跳过 LESS mixin（`.mixin()`）与含 `#{...}` 插值的选择器
- `.btn-primary` 不会被 `.btn` 误命中；同名类取首次定义位置

### 缓存与失效策略

解析结果会缓存在内存中，并在以下时机自动失效或刷新：

- 样式文件编辑中（无需保存）即时重建索引
- vue 文件内容变化时失效其 import 映射与内联模块索引
- 文件创建 / 删除 / 重命名时失效相关缓存，样式文件变动会连带失效引用它的 vue 文件
- 通过 FileSystemWatcher 监听磁盘侧变更（git 切分支、外部编辑器修改等）
- 保存 `tsconfig/jsconfig`、修改 `vueCssModuleHelper.alias`、增删工作区文件夹时，清空别名规则缓存

## 配置项

| 配置 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `vueCssModuleHelper.alias` | `object` | `{}` | 自定义路径别名映射，优先级高于 `tsconfig/jsconfig` 的 `compilerOptions.paths`。键为别名，值为相对工作区根目录的路径（字符串或字符串数组） |

```json
{
  "vueCssModuleHelper.alias": {
    "@": "src",
    "~": ["src", "packages"]
  }
}
```

## 已知限制

- 同一 vue 文件内的多个 `<style module>` 目前共用一份索引，`$style.` 会把具名模块 `<style module="foo">` 的类名一并提示出来。

## 参与开发

本地开发、测试与打包说明见 [CONTRIBUTING.md](https://github.com/tanyueran/vue-css-module-helper/blob/main/CONTRIBUTING.md)。
