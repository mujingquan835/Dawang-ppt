---
name: dawang-ppt
description: 制作、编辑和返工中文演示文稿。依据Kimi原始制作规则理解材料与自主设计，在原dashi网页工作台编辑保存，交付可编辑PPTX、PDF与完整HTML源目录。
---
# Dawang-PPT

## 默认制作流程（W5开发入口）

**理解材料 → 按需读原规则 → 逐页自主设计 → 网页编辑保存 → 看图修正 → 同版本交付。** 用户用自然语言提交材料；下述工程输入和CLI由制作智能体完成，不要求用户编写JSON。

先运行 `node <skill>/scripts/dawang.mjs doctor`，核对实际skill/project路径、defaultBuild和installations。开发源码与日常安装可能不同；不得据仓库改动宣称全局安装已切换。首次检出运行 `npm ci --prefix skills/dawang-ppt/project`；不运行旧自动更新器。

1. 完整读取用户材料，区分新建、局部修改、重构和原样模板。记录受众、用途、主场景、页数、来源时期、单位、必需图片和不可改内容。不补造业绩、目标或因果，不擅自联网扩充原材料。
2. 按 [制作规则](references/fusion/production.md) 定位并实际读取Kimi原始制作步骤、通用场景、一个主场景，必要时一个辅场景、用户指定设计系统及相关格式文档。来源可在 `KIMI_PPT_SKILL_DIR`、`~/.dawang-ppt/kimi-reference/` 或本机open-kimi-ppt安装中。缺必读原文明确报告；不以本文件摘要或少量关键词替代原文，不把全部风格库一次载入。
3. 确定全稿叙事、逐页读者任务、结论、信息关系、图片取景和文字层级。按材料直接设计，不经过旧模板选页、`planContentSlide` 或 `REGION_PRESETS`。自主设计不受六种已适配外观限制，也不强制先选九宫格；已确认视觉方向沿用。用户指定dashi原样模板才走下方兼容入口。
4. 按 [工程契约](references/contracts.md) 生成authored工程，使用稳定元素ID、内容引用与媒体台账。自主外观采用 `styleId:"authored/custom"`，明确页面palette、文字字体/字号和元素bounds；也可沿用已支持绘制默认值，但不将其作为强制模板。逻辑画布1920×1080，CSS字号/2转pt，不能直接照搬PPTD单位。
5. 单稿保存 `rules-manifest.json`，逐页记录原规则来源SHA、适用/不适用/用户覆盖/不支持、理由和实际证据路径。程序只校验清单结构与指纹，不能替代智能体判断。用文字、runs、图片、基础形状、线条和受控vector表达信息；不支持项明确报告，不静默改成整页图片。
6. 新建运行 `node <skill>/scripts/dawang.mjs build <authored.json> <输出目录/index.html>`，等价 `render:authored`。已有 `deck-project.json` 用 `render:project`；唯一保存状态为ProjectV2，HTML为派生结果。严禁重新导入初始输入覆盖人工修改。
7. `preview:start <输出目录> <端口>` 后在原dashi目录、画布和侧栏中编辑；保留手工位置、裁切、字号及runs，核对撤销重做、保存重开。跨run整段替换需明确保留格式或重置，不静默摊平。冲突保留两份，不能清空编辑状态。
8. 按 [视觉复核](references/fusion/visual-review.md) 查看全稿与可疑页原尺寸截图，先改构图再解决溢出，不删必需事实或无限缩字。QA检查readiness、有限几何、缺图、溢出、覆盖；不以几何通过代替用户效果认可。
9. 从同一已保存revision交付完整HTML源目录、截图PDF和可编辑PPTX。明确PDF文字不可选、PPTX字体未嵌入、截图内部不可编辑及目标电脑字体未验证；ZIP检查、独立渲染、PowerPoint编辑保存重开与用户认可分别记录。未经用户要求不添加演讲者备注。

## 已有工程与历史输入

- ProjectV2：`render:project <deck-project.json> <index.html>`，保留旧外观、布局、人工编辑与媒体。
- 历史contentSlides brief：显式 `render:brief <brief.json> <index.html>`，保留原实测规划器；`build`不再静默消费旧brief。
- 用户指定原样模板：`templates`查看17主题，`render:goal <goal.json> <index.html>`；原模板契约保持。已有HTML导入仅走已支持的兼容契约，不承诺任意HTML/PPTX无损导入。
- `styles`、`styles:grid` 是旧规划路径的已适配外观工具，不代表自主设计可用风格总数，不是新稿前置门槛。

不承诺原生数据图表、SmartArt、任意SVG/动画或跨客户端像素一致。开发入口、日常安装、真实效果验收和正式发布分别记录；本轮阶段记录见仓库 `docs/kimi-web/acceptance.md`，W5切换与回退见 `docs/kimi-web/w5-entry-and-rollback.md`。
