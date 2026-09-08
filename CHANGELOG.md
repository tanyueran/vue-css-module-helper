# [0.0.1]

### Features

- 支持 vue 单文件中引入的外部 css module 的文件，在输入时提示，以及链接进入定义的地方

# [0.0.2]

### Features

- 添加对应\*.module.css|less|scss 文件的监听，并清理缓存

# [0.0.3]

### Features

- 优化了解析的缓存策略
- 代码重构，支持更多的方式的跳转

# [0.0.4]

### Fixed

- 修复输入:class="style." 提示选择["header-wrapper"]的形式不能替换代.的问题

# [0.0.5]

### Features

- 升级vscode 引擎版本


# [0.0.6]

### Features

- 支持vue中引入Scss文件CSS Module的BEM命名规范的，提示和跳转功能

# [0.0.7]

### Features

- 支持 SFC 内联 `<style module>` / `<style module="foo">` / `useCssModule()` 的提示与跳转
- 支持 `require()` 引入样式文件，以及 `.module.sass` / `.module.styl` 后缀
- 新增路径别名解析，优先级：用户配置 `vueCssModuleHelper.alias` > tsconfig/jsconfig 的 `compilerOptions.paths` > 默认的 `@`、`~`
- 新增 `vueCssModuleHelper.alias` 配置项，可自定义别名映射
- 跳转支持数组、模板字符串、多表达式共存等场景；点击变量名可直接打开对应样式文件
- 完善缓存失效策略：样式文件编辑中即时刷新，文件创建/删除/重命名、配置变更、磁盘侧变更（如 git 切分支）均会失效相关缓存

### Fixed

- 修复类名前缀误命中的问题（如 `.btn` 命中 `.btn-primary`）
- 修复注释、字符串字面量、`url(...)` 与伪类括号内（如 `:not(.b)`、`:global(.foo)`）的类名被误识别的问题
- 跳过 LESS mixin（`.mixin()`）与含 `#{...}` 插值的选择器

# [0.0.8]

### Features

- 接入 `@vscode/test-cli` 测试体系，补齐样式解析、别名解析、vue 导入解析、缓存失效与 Provider 补全/跳转的测试用例
- 新增 `sample/` 测试夹具工作区（含别名 import、混合 import、内联 `<style module>`、SCSS/LESS 样式等场景）
- 新增 `pnpm test`、`pnpm compile-tests`、`pnpm watch-tests` 脚本与独立的 `tsconfig.test.json`
- 支持通过 `VSCODE_PATH` 环境变量复用本机已安装的 VS Code 运行测试，避免重复下载
- 新增 CONTRIBUTING.md，README 精简为使用文档，开发/测试/打包说明迁移至 CONTRIBUTING.md

### Fixed

- 修复 `package.json` 中仓库地址仍指向旧仓库名的问题
- 修复 README 在插件市场中示例动图无法显示的问题（改用绝对地址）

### Chore

- `tsconfig.json` 增加 `include: ["src"]`，避免类型检查扫描无关目录
- `.gitignore` 忽略 `out/`、`.vscode-test/`；`.vscodeignore` 排除 `sample/` 与 `CONTRIBUTING.md`，减小打包体积
- 移除模板遗留的示例测试 `src/test/extension.test.ts`