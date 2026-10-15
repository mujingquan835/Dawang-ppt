# Dawang-PPT

以原 dashi-PPT 操作台为制作、编辑基座，融入 Kimi 的材料理解、叙事、图片组织与关系排版规则。旧模板页与新组合页共用目录、画布、侧栏、保存和可编辑PPTX导出。

**当前分支为 0.2.0-dev。用户效果验收尚未通过，未合入主分支。** 0.1.0 的简化渲染器保留恢复历史，不再作为融合主链路。

## V3 开发

按 [开发规划 V3](docs/开发规划-v3.md) 与 [实施进度](docs/开发进度-v3.md) 逐步开发，继续使用 `codex/fusion-v1`，不新建集成分支。新稿目标为统一的内容分析、版式规划、场景图和原编辑器链路；原样模板与旧稿保留兼容入口。M0 基础整合不代表通用规划器已完成。

当前处于本地开发及个人使用阶段，尚未通过正式效果验收。Kimi 原始参考资料仅从本机路径读取，不随公开代码再分发；缺少资料时明确报告。设置 `KIMI_PPT_SKILL_DIR` 可指定本机资料目录，或使用 `~/.dawang-ppt/kimi-reference/`。

## 运行

要求Node.js 22+、Chrome；完整实测环境为macOS。LibreOffice与pdftoppm用于独立渲染验证。

```sh
git clone https://github.com/mujingquan835/Dawang-ppt.git
cd Dawang-ppt
git switch codex/fusion-v1
npm ci --prefix skills/dawang-ppt/project
node skills/dawang-ppt/scripts/dawang.mjs doctor
node skills/dawang-ppt/scripts/dawang.mjs styles
```

[技能入口](skills/dawang-ppt/SKILL.md) · [命令与工程契约](skills/dawang-ppt/references/contracts.md)。开发版可在当前仓库直接调用；不需要覆盖原技能。安装入口仍由`node skills/dawang-ppt/scripts/install.mjs`创建独立符号链接，已有不同安装时拒绝覆盖。测试安装使用`--target <临时目录>/dawang-ppt`，不修改日常安装。

## 第一版范围

| 能力 | 当前实现与边界 |
|---|---|
| 原编辑器与模板 | 保留17主题、18项本地扩展及原编辑操作；新组合控件挂在原侧栏 |
| 原风格使用新对象 | theme13钴蓝经营、theme09深蓝杂志、theme16奶油蓝图；其他主题仅保留原模板能力 |
| 首批Kimi家族 | 靛蓝尽调、月白影像、蓝线课件；各自构图/字体/照片/关系图规则，待用户视觉验收 |
| 新对象 | 图片组合、时间轴、表格、流程/层级/循环/矩阵/比较/因果关系、条形/折线 |
| 编辑与保存 | 节点、行列、连接、组与子对象、撤销重做、媒体引用、浏览器草稿、修订冲突保护 |
| 导出 | 独立PptxGenJS适配器；文字/图片/形状/线条可编辑，PDF按截图生成 |
| 全库迁移 | 60份源资料有哈希与批次，3份适配中，57份待后续批次；索引不是完成迁移 |

表格/图表/关系图不要求原生数据表、图表或SmartArt。不支持任意PPTX模板导入。字体与复杂旧模板装饰的跨客户端效果需逐项复核，不能把文件生成成功当作通过。

## 验证与维护

```sh
npm ci
npm test
npm run test:fusion
```

浏览器回归使用公开合成夹具；真实图片、原稿对照、生成稿留在本地output，不进入公开Git。新增改动先在开发分支提交，真实效果验收通过后才合入main并发布0.2.0。恢复点为`v0.1.0-recovery`。

[当前验收](docs/acceptance-v0.2.md) · [架构](docs/architecture.md) · [迁移台账](docs/style-migration-v2.json) · [来源与许可](NOTICE.md)。
