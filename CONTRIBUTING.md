# 参与开发

> 本文面向想要阅读源码、修改功能或提交 PR 的开发者。插件的功能与配置说明请见 [README.md](./README.md)。

## 项目简介

`vue-css-module-helper` 是一个 VS Code 扩展，为 `.vue` 单文件组件中的 CSS Module 提供**类名补全**与**跳转到定义**能力。

它解决的核心问题是：Vue 项目中通过 `import style from './a.module.scss'` 或 `<style module>` 使用 CSS Module 时，编辑器无法感知 `style.xxx` 里的 `xxx` 究竟有哪些、又定义在哪一行。本扩展通过解析样式文件的选择器建立索引，并解析 vue 文件的模块导入关系，把两者关联起来。

整体工作流程：

```
用户在 .vue 中输入 style.  /  Cmd+点击 style.box
              │
              ▼
   Provider 被 VS Code 派发
              │
              ├─ 1. 解析当前 vue 文件的模块来源（import / require / <style module> / useCssModule）
              │        └─ 得到 [{ varName: 'style', fullPath: '/abs/a.module.scss' }]
              │
              ├─ 2. 路径别名解析（相对路径 → 用户配置 → tsconfig paths → 内置 @ / ~）
              │
              ├─ 3. 读取样式文件并扫描选择器，建立 { 类名 → 行列位置 } 索引
              │
              └─ 4. 补全返回类名列表；跳转返回 Location
              │
              ▼
        结果写入内存缓存，由文件监听负责失效
```

## 技术栈

| 项 | 说明 |
| --- | --- |
| 语言 | TypeScript（严格模式，`tsc --noEmit` 做类型检查） |
| 打包 | esbuild，入口 `src/extension.ts`，产物 `dist/extension.js` |
| 测试 | `@vscode/test-cli` + Mocha（TDD 风格），产物 `out/` |
| 代码检查 | ESLint（flat config，`eslint.config.mjs`） |
| 包管理 | pnpm |

## 源码结构

| 目录 / 文件 | 职责 |
| --- | --- |
| `src/extension.ts` | 扩展入口。`activate` 中注册两个 Provider 与全部文件监听，`deactivate` 中清空缓存 |
| `src/provider/cssModuleCompletionProvider.ts` | 补全 Provider。输入 `.` 时触发，返回类名列表；含连字符的类名改写为 `style['a-b']` 并连带替换掉已输入的 `.` |
| `src/provider/cssModuleDefinitionProvider.ts` | 跳转 Provider。解析光标处的成员访问，返回样式定义的 `Location`；类名不存在时兜底跳到文件首行 |
| `src/utils/styleParser.ts` | **选择器扫描器**。屏蔽注释 / 字符串 / `url()` 后逐字符扫描，维护 `&` 嵌套栈拼接 BEM，产出 `ClassDefinition[]` 与 `StyleFileIndex` |
| `src/utils/vueUtils.ts` | 解析 vue 文件中的模块来源，产出 `VueImportModuleObj[]`（变量名 → 样式文件绝对路径） |
| `src/utils/aliasResolver.ts` | 路径别名解析。读取 `tsconfig/jsconfig` 的 `compilerOptions.paths`（支持 jsonc），合并用户配置与内置规则，带规则缓存 |
| `src/utils/index.ts` | 通用工具：索引读取与刷新、位置换算、光标处成员访问解析、文件类型判断、跳转执行 |
| `src/store/index.ts` | 两张内存缓存表：样式文件 → 类名索引、vue 文件 → 导入的模块列表；并提供反查「哪些 vue 引用了某样式」 |
| `src/watcher/fileWatch.ts` | 全部缓存失效逻辑：文档变更 / 保存 / 增删改名 / 配置变更 / 工作区变更 / FileSystemWatcher |
| `src/dispose/*.ts` | 文档变更事件的具体处理函数，供 `fileWatch` 调用 |
| `src/test/` | 测试用例与辅助方法 |
| `sample/` | 测试夹具工作区 |

### 两张缓存表

缓存是理解本项目的关键，都定义在 [src/store/index.ts](./src/store/index.ts)：

| 缓存 | key | value | 说明 |
| --- | --- | --- | --- |
| `styleContentPathAndClassMap` | 样式文件绝对路径 | `StyleFileIndex` | 内联 `<style module>` 也存在这里，key 是 **vue 文件路径** |
| `vueFilePathAndImportStylePathMap` | vue 文件绝对路径 | `VueImportModuleObj[]` | 变量名到样式路径的映射 |

样式文件失效时，需要通过 `findVueFilesReferencingStyle` 连带失效引用它的 vue 文件缓存，否则路径变更后仍会指向旧文件。改动缓存相关逻辑时务必注意这一点。

## 本地开发

```bash
pnpm install      # 安装依赖
pnpm watch        # 监听编译，F5 启动扩展调试
pnpm check-types  # 类型检查
pnpm lint         # 代码检查
pnpm package      # 生产构建
```

### 常见改动入口

| 想做什么 | 改哪里 |
| --- | --- |
| 支持新的样式后缀 | `src/utils/index.ts` 的 `isStyleModuleFile`，以及 `fileWatch.ts` 中 FileSystemWatcher 的 glob |
| 支持新的模块导入写法 | `src/utils/vueUtils.ts` |
| 选择器解析有误判 | `src/utils/styleParser.ts`，并在 `styleParser.test.ts` 补用例 |
| 别名解析不生效 | `src/utils/aliasResolver.ts` |
| 缓存没有及时刷新 | `src/watcher/fileWatch.ts` |
| 新增用户配置项 | `package.json` 的 `contributes.configuration`，并考虑是否需要在 `fileWatch` 中监听其变更 |

## 代码规范

- 所有函数必须带 JSDoc 注释，包含简述、`@param`、`@returns`，严禁裸函数
- 注释统一使用中文
- 提交前确保 `pnpm check-types` 与 `pnpm lint` 均通过

## 测试

测试基于 [@vscode/test-cli](https://github.com/microsoft/vscode-test-cli)，会启动一个真实的 VS Code 实例，并以 `sample/` 作为工作区运行。

### 运行

```bash
pnpm test         # 自动下载对应版本的 VS Code（首次约 300MB）

# 本机已安装 VS Code 时，可通过 VSCODE_PATH 复用，避免重复下载
VSCODE_PATH="/Applications/Visual Studio Code.app/Contents/MacOS/Code" pnpm test
```

其他常用命令：

```bash
pnpm compile-tests  # 单独把 src 编译到 out/
pnpm watch-tests    # 监听编译，便于反复调试用例
```

### 目录结构

| 路径 | 说明 |
| --- | --- |
| `src/test/*.test.ts` | 测试用例（Mocha TDD 风格，`suite` / `test`） |
| `src/test/helper.ts` | 夹具路径拼接、文档打开、按文本片段定位光标等辅助方法 |
| `sample/` | 夹具工作区：含 `tsconfig.json` 的 `paths` 别名、各类 `.module.*` 样式与覆盖不同导入写法的 vue 文件 |
| `tsconfig.test.json` | 测试专用编译配置，把 `src` 输出为 CommonJS 到 `out/` |
| `.vscode-test.mjs` | 指定用例匹配规则、夹具工作区与启动参数 |

### 覆盖范围

| 测试文件 | 覆盖内容 |
| --- | --- |
| `styleParser.test.ts` | 选择器扫描：注释 / 字符串 / `url()` 屏蔽、`&` 嵌套拼接、伪类括号、`#{}` 插值、LESS mixin、`@media` 层级继承、同前缀不误命中 |
| `aliasResolver.test.ts` | 相对路径、绝对路径、内置 `@/` 与 `~/`、tsconfig `paths`（含 jsonc 注释与尾逗号）、文件不存在的兜底 |
| `vueUtils.test.ts` | `import` / `require` / `<style module>` / `<style module="foo">` / `useCssModule` 五类模块来源的变量名映射与缓存写入 |
| `utils.test.ts` | 索引构建与位置换算、缓存增删改查、反查引用某样式的 vue 文件、光标处成员访问解析、文件类型判断 |
| `provider.test.ts` | 补全项内容与连字符改写、点号 / 下标 / 变量名三种跳转、无法解析时的返回值 |
| `fileWatch.test.ts` | 样式文件编辑中（未保存）即时刷新索引、vue 文件变更后 import 与内联索引失效 |

### 编写用例的注意事项

- **不要通过 `vscode.executeCompletionItemProvider` 等命令触发 Provider**。测试实例以 `--disable-extensions` 启动，没有 Vue 语言支持扩展，`.vue` 会被识别为 plaintext，按 `vue` 语言注册的 Provider 不会被派发到。请直接实例化 `CssModuleCompletionProvider` / `CssModuleDefinitionProvider` 调用。
- **不要依赖扩展宿主中已激活的那份缓存**。扩展宿主加载的是 `dist/` 打包产物，而测试导入的是 `out/`，两者是相互独立的模块实例，内存缓存互不可见。测试文件监听时需自行调用 `createFileWatch()` 并在 `teardown` 中释放。
- 断言样式文件中的位置时，行号以 `sample/` 中夹具文件的实际内容为准，修改夹具需同步更新用例。

## 手动验证

若需要观察真实交互效果，可用 `.vscode/launch.json` 中的两个调试配置：

- **Run Extension (空白窗口)**：启动干净的扩展开发宿主，手动 `File → Open Folder` 打开待测项目
- **Run Extension (指定项目)**：启动时输入目标项目绝对路径，直接打开（默认值为本仓库的 `sample/`）

## 打包与安装

1. 项目中安装 @vscode/vsce：`pnpm add -D @vscode/vsce`
2. 打包：`pnpm vscode-pkg`（等价于 `npx vsce package`）
3. 把生成的 `.vsix` 文件安装到自己的 VS Code 中即可使用

> README 中的图片必须使用完整的 raw 绝对链接。Marketplace 不会读取 vsix 包内的图片，相对路径会被 `vsce` 按 `package.json` 的 `repository.url` 重写，仓库地址不正确或仓库非公开都会导致图裂。

## TODO

- [x] 支持 vue 单文件中输入 `:class="style."` 时的提示
- [x] 支持 vue 单文件中点击 `:class="style.box"` 时进入具体的样式定义处
- [x] 缓存优化，以及缓存清理
- [x] 支持属性传递的情况下的跳转，类似：`<div :xx-class="commonStyle['detail-page-sub-title']">基础信息</div>`
- [x] 支持数组的情况下的跳转，类似：`<div :class="[commonStyle['detail-page-sub-title'], style['title']]">基础信息</div>`
- [x] 排除样式文件中 `:global` 等伪类括号内的 class
- [x] 输入 `:class="style."` 提示选择 `['header-wrapper']` 的形式能正确替换掉 `.`
- [x] 支持 SCSS/LESS 嵌套 BEM 命名（`&__xxx`、`&--xxx`）的提示与跳转
- [x] 支持 SFC 内联 `<style module>` 与 `useCssModule()`
- [x] 支持路径别名（用户配置 / tsconfig paths / 默认 `@`、`~`）
- [x] 补齐自动化测试（夹具工作区 + 解析 / Provider / 缓存失效用例）
- [ ] 同一 vue 文件内的多个 `<style module>` 按模块名分别建索引（目前共用一份，`$style.` 会把具名模块 `<style module="foo">` 的类名一并提示出来）
