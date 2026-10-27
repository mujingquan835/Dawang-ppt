# Dawang-PPT

把已有材料变成可在浏览器中编辑的中文演示文稿：先整理观点和上屏文案，再逐页设计，最后交付 **一个可离线打开、编辑、保存的 HTML 文件**。

适合经营汇报、方案提案、产品介绍、培训和技术说明。用自然语言交材料即可，不需要写工程 JSON；PPTX、PDF、图片按需导出。完整制作规则随 skill 提供，无需安装其他演示 skill 或外部规则包。

**同事分享版：`v0.2.0-preview.20261027`（预发布）。** 主要实测环境为 macOS + Node.js 22+ + Chrome；不等同于所有电脑、模型及 Office 客户端效果验收。

## 下载与安装

到 [分享版下载页](https://github.com/mujingquan835/Dawang-ppt/releases/tag/v0.2.0-preview.20261027)，下载 `dawang-ppt-v0.2.0-preview.20261027.zip`。请选这个附件，自动生成的 Source code 是完整仓库，包含维护历史文件。

解压后将 `dawang-ppt` 文件夹放在长期保留的位置，在该文件夹打开终端：

```sh
npm ci --prefix project
node scripts/install.mjs
node scripts/dawang.mjs doctor
```

`install.mjs` 默认注册到 Codex。确认 `runtime: true`、`rules.provider: "dawang-ppt"`、`rules.status: "pinned"`，再新开 AI 会话。其他客户端、已有版本升级与排错见 [详细使用说明](docs/USAGE.md)。

## 直接这样使用

> 使用 dawang-ppt，将附件整理为一份 6 页管理汇报，面向部门负责人。先提炼结论和上屏文案，再设计页面。保留数据的单位、时期和来源，不补造事实。默认交付一个可离线编辑的 HTML。

修改已有稿件：

> 使用 dawang-ppt，修改这份 HTML 的第 3 页：调整标题并放大流程图，其余文案和布局保持不变，保留已有人工编辑。

需要 PowerPoint 文件时补充：

> 同时导出可编辑 PPTX，并说明字体和目标客户端尚未验证的部分。

## 编辑与保存

用 Chrome 或 Edge 打开生成的 HTML。单击选择文字或对象，拖动移动、控制点缩放；双击文字进入编辑。顶部支持撤销、重做和保存。

第一次保存时，在文件选择框中选择**当前打开的原 HTML**并授予写入权限；之后点击“保存”或按 `⌘S / Ctrl+S` 写回该文件。重开时浏览器可能再次要求授权。浏览器草稿不能代替源文件保存，“下载 HTML 副本”是单独的导出操作。

同事仅查看或手动编辑交付 HTML 时，不需要安装 skill、Node.js 或启动服务。让 AI 继续制作或修改时，才需要完整 skill 环境。

## 能力边界

- HTML 是默认交付物；PPTX、PDF、图片不会默认一起生成。
- PPTX 中的文字、图片和基础形状可编辑；不承诺原生数据图表、SmartArt、任意 PPTX 模板导入或跨客户端像素一致。
- PDF 为截图型，正文不可按普通文本选择。PPTX 不嵌入字体，换电脑后要复核。
- 任意网页 HTML 不属于无损可编辑导入范围。
- 内容策划、逐页设计和看图复核由制作智能体执行；没有固定的整稿耗时或跨模型质量保证。

## 更多说明

[完整安装、示例与排错](docs/USAGE.md) · [本次更新与验证](docs/RELEASE-20261027.md) · [技能入口](skills/dawang-ppt/SKILL.md) · [许可证](LICENSE) · [版权与来源](NOTICE.md)

源码仓库维护者可运行 `npm ci`、`npm ci --prefix skills/dawang-ppt/project`、`npm test`；打包命令为 `node scripts/package-skill.mjs`。独立分享包不包含历史 skill、外部规则正文、个人材料、生成稿、node_modules 或 Git 历史。仓库历史文件继续保留。
