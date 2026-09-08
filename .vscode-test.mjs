import { defineConfig } from "@vscode/test-cli";
import * as os from "node:os";
import * as path from "node:path";

// 允许通过环境变量复用本机已安装的 VS Code，避免每次 CI/本地都重新下载
// 用法：VSCODE_PATH="/Applications/Visual Studio Code.app/Contents/MacOS/Electron" pnpm test
const localVscodePath = process.env.VSCODE_PATH;

export default defineConfig({
  // 需要加载的测试文件，必须是 .test.js 结尾
  files: "out/test/**/*.test.js",
  // 指定夹具工作区，否则 vscode.workspace.getWorkspaceFolder 恒为 undefined，
  // 别名解析（@/、~/、tsconfig paths）无法生效
  workspaceFolder: "./sample",
  ...(localVscodePath
    ? { useInstallation: { fromPath: localVscodePath } }
    : {}),
  launchArgs: [
    // 禁用其他扩展，避免其他扩展干扰测试（但也带来一个副作用——.vue 文件没装语言支持时会被识别成 plaintext，所以测试里不能走 vscode.executeCompletionItemProvider 之类的命令派发，只能直接实例化 Provider 调用。这点在 provider.test.ts 的注释里写得很清楚）
    "--disable-extensions",
    // 项目路径较长时，默认的 .vscode-test/user-data 会让 IPC socket 超出
    // 系统 103 字符上限导致启动失败，这里改用系统临时目录
    `--user-data-dir=${path.join(os.tmpdir(), "vcm-test-user-data")}`,
  ],
  mocha: {
    ui: "tdd",
    timeout: 20000,
  },
});
