# 欢迎使用你的 VS Code 扩展

## 文件夹内容说明

* 此文件夹包含扩展所需的所有文件。
* `package.json` - 这是声明扩展和命令的清单文件。
  * 示例插件注册了一个命令并定义了其标题和命令名称。VS Code 可以通过这些信息在命令面板中显示该命令，而无需加载插件。
* `src/extension.ts` - 这是你提供命令实现的主文件。
  * 该文件导出一个 `activate` 函数，在扩展首次激活时调用（在此示例中是通过执行命令激活）。在 `activate` 函数内部，我们调用 `registerCommand`。
  * 我们将包含命令实现的函数作为第二个参数传递给 `registerCommand`。

## 安装设置

* 安装推荐的扩展（amodio.tsl-problem-matcher、ms-vscode.extension-test-runner 和 dbaeumer.vscode-eslint）

## 快速上手

* 按 `F5` 打开一个加载了你的扩展的新窗口。
* 通过按（`Ctrl+Shift+P` 或 Mac 上的 `Cmd+Shift+P`）打开命令面板，输入 `Hello World` 来运行你的命令。
* 在 `src/extension.ts` 中的代码设置断点来调试你的扩展。
* 在调试控制台中查找扩展的输出。

## 进行更改

* 在修改 `src/extension.ts` 中的代码后，你可以从调试工具栏重新启动扩展。
* 你也可以通过重新加载（`Ctrl+R` 或 Mac 上的 `Cmd+R`）VS Code 窗口来加载你的更改。

## 探索 API

* 当你打开文件 `node_modules/@types/vscode/index.d.ts` 时，可以查看完整的 API 集。

## 运行测试

* 安装 [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* 通过 **Tasks: Run Task** 命令运行 "watch" 任务。确保它正在运行，否则可能无法发现测试。
* 从活动栏打开测试视图，点击"运行测试"按钮，或使用快捷键 `Ctrl/Cmd + ; A`
* 在测试结果视图中查看测试结果的输出。
* 修改 `src/test/extension.test.ts` 或在 `test` 文件夹内创建新的测试文件。
  * 提供的测试运行器只会考虑匹配名称模式 `**.test.ts` 的文件。
  * 你可以在 `test` 文件夹内创建文件夹来以任何方式组织你的测试。

## 进一步扩展

* 通过[打包你的扩展](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)来减小扩展大小并提高启动时间。
* 在 VS Code 扩展市场上[发布你的扩展](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)。
* 通过设置[持续集成](https://code.visualstudio.com/api/working-with-extensions/continuous-integration)来自动化构建。
