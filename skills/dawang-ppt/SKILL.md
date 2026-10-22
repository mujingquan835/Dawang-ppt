---
name: dawang-ppt
description: 制作、编辑和返工中文演示文稿。依据Kimi原始制作规则理解材料与自主设计，在原dashi网页工作台编辑保存，默认只交付一个可离线编辑、下载保存的HTML，PPTX、PDF和图片由用户按需导出。
---
# Dawang-PPT

## 默认制作流程

**理解材料 → 按需读原规则 → 内容策划与取舍 → 逐页自主设计 → 网页编辑保存 → 内容与看图复核 → 单HTML交付。** 用户用自然语言提交材料；下述工程输入和CLI由制作智能体完成，不要求用户编写JSON。

先运行 `node <skill>/scripts/dawang.mjs doctor`，核对实际skill/project路径、defaultAuthoringCommand、defaultDeliverable、defaultBuild和installations。开发源码与日常安装可能不同；不得据仓库改动宣称全局安装已切换。首次检出运行 `npm ci --prefix skills/dawang-ppt/project`；不运行旧自动更新器。

1. 完整读取用户材料，区分新建、局部修改、重构和原样模板。记录受众、用途、主场景、页数、来源时期、单位、必需图片和不可改内容。不补造业绩、目标或因果，不擅自联网扩充原材料。
2. 按 [制作规则](references/fusion/production.md) 定位并实际读取Kimi原始制作步骤、通用场景、一个主场景，必要时一个辅场景、用户指定设计系统及相关格式文档。来源可在 `KIMI_PPT_SKILL_DIR`、`~/.dawang-ppt/kimi-reference/` 或本机open-kimi-ppt安装中，版本由 `references/kimi-rules.lock.json` 固定（`doctor` 的 kimiRules 显示状态）。`rules:read` 按章节返回原文并标注 apply/adapt/replaced：apply照做，adapt按note边界执行，replaced按by指向的Dawang规则执行（默认不返回其原文）。原规则与锁定版本不一致时停止并告知用户，不自行 `--allow-drift` 或重新锁定。缺必读原文明确报告；不以本文件摘要或少量关键词替代原文，不把全部风格库一次载入。
3. 按 [内容策划与取舍](references/fusion/production.md#内容策划与取舍) 先确定全稿要回答的问题，再写逐页短提纲：读者任务、主张、支撑事实/机制、证据作用与必要限定。将技术事实与材料支持的使用意义连接；精简不能让主要价值分支只留在截图、图注或附件里。之后确定信息关系、图片取景和文字层级，按材料直接设计，不经过旧模板选页、`planContentSlide` 或 `REGION_PRESETS`。自主设计不受六种已适配外观限制，也不强制先选九宫格；已确认视觉方向沿用。用户指定dashi原样模板才走下方兼容入口。
4. 按 [工程契约](references/contracts.md) 生成authored工程，使用稳定元素ID、内容引用与媒体台账。自主外观采用 `styleId:"authored/custom"`，明确页面palette、文字字体/字号和元素bounds；也可沿用已支持绘制默认值，但不将其作为强制模板。逻辑画布1920×1080，CSS字号/2转pt，不能直接照搬PPTD单位。
5. 内部工程记录规则清单，逐页记录原规则来源SHA、适用/不适用/用户覆盖/不支持、理由和实际证据路径。程序只校验清单结构与指纹，不能替代智能体判断。用文字、runs、图片、基础形状、线条和受控vector表达信息；不支持项明确报告，不静默改成整页图片。
6. 新建推荐 `node <skill>/scripts/dawang.mjs make <authored.json> <用户命名.html>`；内部工程自动管理于 `~/.dawang-ppt/workspaces/<projectId>/`（可用 DAWANG_WORKSPACE_ROOT 或 --workspace 覆盖）。局部修改使用 `patch:project`，之后 `publish:html`，保留已有稳定ID和历史。低层 `build` 继续等价 `render:authored`，用于兼容/开发；严禁删除工程重建覆盖人工修改。字段、单位、错误与完整样例见 [工程编写速查](references/authoring-api.md)。
7. `preview:start <输出目录> <端口>` 后在原dashi目录、画布和侧栏中编辑；保留手工位置、裁切、字号及runs，核对撤销重做、保存重开。跨run整段替换需明确保留格式或重置，不静默摊平。冲突保留两份，不能清空编辑状态。
8. 按 [内容与视觉复核](references/fusion/visual-review.md) 对照原材料检查主要观点、支撑证据、使用意义和状态限定，再在浏览器查看全稿与可疑页，或使用临时原尺寸截图。先改构图再解决溢出，不删必需事实或无限缩字。QA检查readiness、有限几何、缺图、溢出、覆盖；不以关键词或几何通过代替内容表达充分及用户效果认可。
9. 默认交付目录只有一个用户命名HTML，不附源目录、截图、总览、ZIP或报告。HTML内含可移交ProjectV2快照与资源；离线保存是“下载修改后的HTML”，不是写入原文件。用户自行选择导出PPTX/PDF/当前页图片；任务明确要求时可主动生成所需格式。PDF截图型、PPTX字体未嵌入与目标电脑字体边界在导出帮助中说明。完整引擎回归和Office检查属于版本验收，不在每份稿件上重复导出。用户效果认可单独记录。未经用户要求不添加演讲者备注。

## 已有工程与历史输入

- ProjectV2：`render:project <deck-project.json> <index.html>`，保留旧外观、布局、人工编辑与媒体。
- 历史contentSlides brief：显式 `render:brief <brief.json> <index.html>`，保留原实测规划器；`build`不再静默消费旧brief。
- 用户指定原样模板：`templates`查看17主题，`render:goal <goal.json> <index.html>`；原模板契约保持。已有HTML导入仅走已支持的兼容契约，不承诺任意HTML/PPTX无损导入。
- `styles`、`styles:grid` 是旧规划路径的已适配外观工具，不代表自主设计可用风格总数，不是新稿前置门槛。

不承诺原生数据图表、SmartArt、任意SVG/动画或跨客户端像素一致。开发入口、日常安装、真实效果验收和正式发布分别记录；本轮阶段记录见仓库 `docs/kimi-web/acceptance.md`，W5切换与回退见 `docs/kimi-web/w5-entry-and-rollback.md`。
