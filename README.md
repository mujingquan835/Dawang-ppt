# Dawang-PPT

以原 dashi-PPT 操作台为制作、编辑基座，融入 Kimi 的材料理解、叙事、图片组织与关系排版规则。旧模板页与新组合页共用目录、画布、侧栏、保存和可编辑PPTX导出。

**当前分支为 0.2.0-dev。S1 八页真实稿于2026-10-20获用户确认可用；S2 统一日常制作入口，尚未合 main 或正式发布。**

## 本分支接续开发

`codex/kimi-web-editor` 已交付整合方案v4的W0—W4工程检查点，W5候选入口开发检查已通过；最终视觉认可与可比成本门槛仍待完成。换电脑继续请先看 [换机接续说明](docs/kimi-web/continue-on-another-computer.md) 与 [W4验收记录](docs/kimi-web/acceptance.md)。本分支候选`build`现走直接制作；日常安装启用单独核对，详见 [W5入口与回退](docs/kimi-web/w5-entry-and-rollback.md)。

## 日常流程

材料 → 读取原Kimi规则 → 智能体逐页直接设计 → 原编辑器调整保存 → 同版本导出。候选`build`等价`render:authored`，自主外观用`authored/custom`，不要求从六种外观或九宫格选择。历史brief显式用`render:brief`，已有工程用`render:project`；原样模板保留`templates`/`render:goal`。

沿用 [V3.1规划](docs/开发规划-v3.1.md)，实时执行状态见 [S2记录](docs/S2-执行记录.md)。原17主题与原编辑器保留，0.1 runtime及旧家族构图仅用于兼容恢复。

当前处于本地开发及个人使用阶段，不代表所有风格与场景已通过效果验收。Kimi 原始参考资料仅从本机路径读取，不随公开代码再分发；缺少资料时明确报告。设置 `KIMI_PPT_SKILL_DIR` 可指定本机资料目录，或使用 `~/.dawang-ppt/kimi-reference/`。

## 运行

要求Node.js 22+、Chrome；完整实测环境为macOS。LibreOffice与pdftoppm用于独立渲染验证。

```sh
git clone https://github.com/mujingquan835/Dawang-ppt.git
cd Dawang-ppt
git switch codex/kimi-web-editor
npm ci --prefix skills/dawang-ppt/project
node skills/dawang-ppt/scripts/dawang.mjs doctor
node skills/dawang-ppt/scripts/dawang.mjs styles
```

[技能入口](skills/dawang-ppt/SKILL.md) · [命令与工程契约](skills/dawang-ppt/references/contracts.md)。开发版可在当前仓库直接调用；不需要覆盖原技能。安装入口仍由`node skills/dawang-ppt/scripts/install.mjs`创建独立符号链接，已有不同安装时拒绝覆盖。测试安装使用`--target <临时目录>/dawang-ppt`，不修改日常安装。

## 第一版范围

| 能力 | 当前实现与边界 |
|---|---|
| 原编辑器与模板 | 保留17主题、18项本地扩展及原编辑操作；新组合控件挂在原侧栏 |
| 原风格使用新对象 | theme13钴蓝经营、theme09深蓝杂志、theme16奶油蓝图，以及 theme14、theme06、theme17；数据化适配待真实稿件效果验收 |
| Kimi规则与历史工程 | 方法与检查进入统一流程；历史三个家族仅保留工程恢复，不作为新建候选 |
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
