# 嵌入式软硬件笔记

用 Markdown 维护 STM32、固件、外设通信与硬件调试笔记。VitePress 从 `docs/` 生成网站。

## 本地运行

需要 Node.js 22 或更新版本。

```powershell
npm.cmd install
npm.cmd run docs:dev
```

打开终端给出的本地地址。使用 `npm.cmd run docs:build` 检查链接并生成静态文件，使用 `npm.cmd run docs:preview` 预览生成结果。

## 修改与扩充

- 正文在 `docs/`。按主题建目录，使用稳定的英文文件名。现有正文使用一个一级标题，二、三级标题会显示在右侧目录。
- 新增文章时更新 `docs/roadmap.md` 和 `docs/.vitepress/config.mts` 的侧栏。文章间使用相对链接。
- 引用芯片手册时注明型号和文档编号，区分教学片段与实测结果。保留原有引用和代码语义。
- 提交前运行 `npm.cmd run docs:build`。网页生成目录 `docs/.vitepress/dist/` 可直接用于静态托管。站点挂在子路径时，在构建环境设置 `DOCS_BASE`，例如 `/embedded-notes/`。
