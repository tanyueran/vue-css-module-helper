# vue-outer-module-style-class-helper

> 这是vscode 的插件项目，用于.vue文件的使用外部module模式的样式文件helper

## 功能
- 支持vue单文件中的输入:class="style."  时的提示
- 支持vue单文件中点击:class="style.box" 时进入具体的样式定位位置

## TODO
- 输入:class="style." 提示选择["header-wrapper"]的形式不能替换代.
- 缓存优化，以及缓存清理
- 支持vue标签引入<style module src="xxx.module.sss"></style>的解析