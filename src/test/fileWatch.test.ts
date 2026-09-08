import * as assert from "node:assert";
import * as vscode from "vscode";
import { createFileWatch } from "../watcher/fileWatch";
import { getStyleFileIndex } from "../utils";
import {
  clearStyleContentPathAndClassMap,
  clearVueFilePathAndImportStylePathMap,
  getStyleContentPathAndClass,
  getVueFilePathAndImportStylePathMap,
  setVueFilePathAndImportStylePathMap,
} from "../store";
import { openSampleDoc, samplePath } from "./helper";

/**
 * 等待若干毫秒，给 VS Code 的事件回调留出执行时间
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 在文档末尾追加一段文本（不保存），触发 onDidChangeTextDocument
 * @param {vscode.TextDocument} document - 目标文档
 * @param {string} text - 追加内容
 * @returns {Promise<void>}
 */
async function appendText(
  document: vscode.TextDocument,
  text: string,
): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  edit.insert(
    document.uri,
    document.lineAt(document.lineCount - 1).range.end,
    text,
  );
  await vscode.workspace.applyEdit(edit);
  await delay(300);
}

suite("fileWatch 缓存失效", () => {
  // 测试内自行注册监听，避免依赖扩展宿主里 dist/ 那份独立的模块实例
  let disposables: vscode.Disposable[] = [];

  setup(() => {
    clearStyleContentPathAndClassMap();
    clearVueFilePathAndImportStylePathMap();
    disposables = createFileWatch();
  });

  teardown(async () => {
    disposables.forEach((item) => item.dispose());
    disposables = [];
    // 回滚测试中产生的未保存修改
    await vscode.commands.executeCommand(
      "workbench.action.revertAndCloseActiveEditor",
    );
  });

  test("编辑样式文件后（未保存）缓存即时刷新", async () => {
    const stylePath = samplePath("src/styles/watch-target.module.scss");
    const document = await openSampleDoc(
      "src",
      "styles",
      "watch-target.module.scss",
    );
    await vscode.window.showTextDocument(document);

    assert.deepStrictEqual(getStyleFileIndex(stylePath)?.classNames, [
      "watch-target",
    ]);

    await appendText(document, "\n.newly-added { color: blue; }\n");

    assert.ok(
      getStyleContentPathAndClass(stylePath)?.classNames.includes(
        "newly-added",
      ),
      "编辑中的样式类名应即时进入缓存",
    );
  });

  test("编辑 vue 文件后 import 与内联索引缓存失效", async () => {
    const vuePath = samplePath("src/components/WatchCase.vue");
    const document = await openSampleDoc("src", "components", "WatchCase.vue");
    await vscode.window.showTextDocument(document);

    // 预置缓存，模拟已经解析过该 vue 文件
    setVueFilePathAndImportStylePathMap(vuePath, [
      {
        varName: "watchStyle",
        fullPath: samplePath("src/styles/watch-target.module.scss"),
      },
    ]);
    getStyleFileIndex(vuePath);

    await appendText(document, "\n<!-- touch -->\n");

    assert.strictEqual(getVueFilePathAndImportStylePathMap(vuePath).length, 0);
    assert.strictEqual(getStyleContentPathAndClass(vuePath), undefined);
  });
});
