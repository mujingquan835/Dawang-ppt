---
name: dawang-ppt
description: 制作、编辑和返工中文演示文稿。依据完整制作规则理解材料与自主设计，在Dawang-PPT网页工作台编辑保存，默认只交付一个可离线编辑、下载保存的HTML，PPTX、PDF和图片由用户按需导出。
---
# Dawang-PPT

## 默认制作流程

**理解材料 → 按需读原规则 → 内容策划与取舍 → 逐页自主设计 → 网页编辑保存 → 内容与看图复核 → 单HTML交付。** 用户用自然语言提交材料；下述工程输入和CLI由制作智能体完成，不要求用户编写JSON。

先运行 `node <skill>/scripts/dawang.mjs doctor`，核对实际skill/project路径、defaultAuthoringCommand、defaultDeliverable、defaultBuild和installations。开发源码与日常安装可能不同；不得据仓库改动宣称全局安装已切换。首次检出运行 `npm ci --prefix skills/dawang-ppt/project`；不运行旧自动更新器。

1. 已有可移交HTML、authored/ProjectV2 JSON或Markdown/text材料，优先 `prepare <材料> <新准备目录> [--scenario <id>]` 提取正文与原图台账；实际阅读返回的 material.json、完整适用 rules.json 并查看必需图片，不直接cat含嵌入资源的整份HTML。不支持的HTML明确失败，其他文档按对应格式读取。完整读取用户材料，区分新建、局部修改、重构和原样模板。记录受众、用途、主场景、页数、来源时期、单位、必需图片和不可改内容。不补造业绩、目标或因果，不擅自联网扩充原材料。
2. 用 `rules:list` 查看有效场景ID，依据材料选主场景（产品介绍可评估business-plan；不假设存在product-introduction）。按 [制作规则](references/fusion/production.md) 定位并实际读取完整制作步骤、通用场景、一个主场景，必要时一个辅场景、用户指定设计系统及相关格式文档。来源由 `DAWANG_PPT_RULES_DIR`、`~/.dawang-ppt/production-rules/` 或已有兼容安装提供，版本由 `references/production-rules.lock.json` 固定（`doctor` 的 rules 显示状态）。公开包不附未获再分发许可的完整规则资料；必须配置匹配的完整资料，缺失时停止，不回退到简化规则。`rules:read` 按章节返回原文并标注 apply/adapt/replaced：apply照做，adapt按note边界执行，replaced按by指向的Dawang规则执行（默认不返回其原文）。若prepare已返回且本会话完整读过同场景、相同指纹的适用原文，复用该次读取，不重复rules:read；场景或指纹变化时重新读取。原规则与锁定版本不一致时停止并告知用户，不自行 `--allow-drift` 或重新锁定。缺必读原文明确报告；不以本文件摘要或少量关键词替代原文，不把全部风格库一次载入。
3. 按 [内容策划与取舍](references/fusion/production.md#内容策划与取舍) 确定全稿要回答的问题。新建、重构或文案优化时，实际读取并执行 [文案编辑](references/fusion/content-editing.md)：默认主动提炼、改写和组织表达，先形成可直接上屏的文案，再排版；仅改排版或指定原文不改时缩小编辑范围。保留原稿强表达，逐页短提纲记录读者任务、主张、支撑事实/机制、证据作用与必要限定。排版前定下全稿定位句 `contentPlan.throughLine` 与逐页重点句 `contentPlan.slides[i].keyLine`：各指向页面上实际的文字元素，标明来源 quoted/distilled/created 及依据；目录等确无重点的页写 `waived` 理由。只给作者看的材料（配图说明、宣传建议、示意说明等）列入 `contentPlan.authorNotes`，不上屏。`prepare` 返回的 authorNoteCandidates/keyLineCandidates 只是候选，逐条确认或舍弃。字段与检查见 [工程编写速查](references/authoring-api.md)。精简不能让主要价值或核心动作只留在截图、图注或附件里。素材与构图时按[内容与媒体判断](references/fusion/production.md#内容与媒体判断)记录关键图片的证据用途、必保留区域和取舍理由；产品介绍可评估沿用产品视觉语言，技术页可参考同文的“机制与对应实例”案例，均不作为固定版式。之后确定信息关系、图片取景和文字层级，按材料直接设计，不经过旧模板选页、`planContentSlide` 或 `REGION_PRESETS`。自主设计不受六种已适配外观限制，也不强制先选九宫格；已确认视觉方向沿用。用户指定原样模板才走下方兼容入口。
4. 按 [工程契约](references/contracts.md) 生成authored工程，使用稳定元素ID、内容引用与媒体台账。自主外观采用 `styleId:"authored/custom"`，明确页面palette、文字字体/字号和元素bounds；也可沿用已支持绘制默认值，但不将其作为强制模板。逻辑画布1920×1080，CSS字号/2转pt，不能直接照搬PPTD单位。
5. 内部工程记录规则清单，逐页记录原规则来源SHA、适用/不适用/用户覆盖/不支持、理由和实际证据路径。程序只校验清单结构与指纹，不能替代智能体判断。用文字、runs、图片、基础形状、线条和受控vector表达信息；不支持项明确报告，不静默改成整页图片。
6. 工程重复样式可用 `createTextAuthor` 与 `distributeBounds`（见工程编写速查），保留自主构图与任意坐标。新建推荐 `node <skill>/scripts/dawang.mjs make <authored.json> <用户命名.html>`；内部工程自动管理于 `~/.dawang-ppt/workspaces/<projectId>/`（可用 DAWANG_WORKSPACE_ROOT 或 --workspace 覆盖）。局部修改使用 `patch:project`，之后 `publish:html`，保留已有稳定ID和历史。低层 `build` 继续等价 `render:authored`，用于兼容/开发；严禁删除工程重建覆盖人工修改。字段、单位、错误与完整样例见 [工程编写速查](references/authoring-api.md)。
7. `preview:start <make返回的workspaceDir> [端口]`（默认自动分配空闲端口；交付HTML目录不是内部工程目录） 后在工作台的目录、画布和侧栏中编辑；保留手工位置、裁切、字号及runs，核对撤销重做、保存重开。跨run整段替换需明确保留格式或重置，不静默摊平。冲突保留两份，不能清空编辑状态。
8. `make`/`publish:html`可加`--screenshots <临时目录> --summary`，一次运行全稿QA与原尺寸截图；读取简明结果，失败按需读run.json，不反复输出全工程。逐页实际看图、集中修正，修改后仍全稿检查。按 [内容与视觉复核](references/fusion/visual-review.md) 对照原材料检查主要观点、支撑证据、使用意义和状态限定，核对强表达是否在精简中被削弱、重点句是否具体且突出，再在浏览器查看全稿与可疑页，或使用临时原尺寸截图。先改构图再解决溢出，不删必需事实或无限缩字。QA检查readiness、有限几何、缺图、溢出、覆盖；不以关键词或几何通过代替内容表达充分及用户效果认可。
9. 默认交付目录只有一个用户命名HTML，不附源目录、截图、总览、ZIP或报告。HTML内含可移交ProjectV2快照与资源；离线HTML顶部常驻“保存”和状态，⌘S/Ctrl+S与侧栏保存执行同一逻辑：首次用打开文件选择框关联已经存在的原HTML，检查文件名及projectId，获得写入权限后直接覆盖该文件，后续复用关联。关联句柄按当前页面URL保存在IndexedDB，重开后尝试恢复；浏览器可能要求重新授权，草稿/句柄存储不可用时明确提示重开需重新关联。保存绝不静默下载副本；浏览器不支持文件写入时提示换用Chrome/Edge。下载HTML副本仅由显式导出触发，导出副本不清除源文件未保存状态。取消、无权限、校验错误和写入失败都保留修改，不显示已保存；写入并关闭成功后才提示已保存，保存期间的新修改仍提示未保存。浏览器草稿不等于源文件保存。用户自行选择导出PPTX/PDF/当前页图片；任务明确要求时可主动生成所需格式。PDF截图型、PPTX字体未嵌入与目标电脑字体边界在导出帮助中说明。完整引擎回归和Office检查属于版本验收，不在每份稿件上重复导出。交付回复中列出运行结果的 contentReview：全稿定位句、每页重点句及来源；AI 新写（created）的句子单独列出，请用户确认。用户效果认可单独记录。未经用户要求不添加演讲者备注。

## 已有工程与历史输入

- ProjectV2：`render:project <deck-project.json> <index.html>`，保留旧外观、布局、人工编辑与媒体。
- 历史contentSlides brief：显式 `render:brief <brief.json> <index.html>`，保留原实测规划器；`build`不再静默消费旧brief。
- 用户指定原样模板：`templates`查看17主题，`render:goal <goal.json> <index.html>`；原模板契约保持。已有HTML导入仅走已支持的兼容契约，不承诺任意HTML/PPTX无损导入。
- `styles`、`styles:grid` 是旧规划路径的已适配外观工具，不代表自主设计可用风格总数，不是新稿前置门槛。

不承诺原生数据图表、SmartArt、任意SVG/动画或跨客户端像素一致。开发入口、日常安装、真实效果验收和正式发布分别记录；公开安装与使用说明见随包提供的 `docs/USAGE.md`，历史阶段记录在源码仓库保留。

## 提效与耗时记录

保留原规则阅读、主动文案编辑、自主构图及逐页看图，不降低模型思考档位。用确定的正文/媒体提取、样式帮助器与批量操作减少工程往返，不用固定模板替代设计判断。

`run.json`保存最新完整诊断，`runs.jsonl`追加程序阶段计时（渲染、浏览器就绪、QA、序列化）。这只测程序流水线；首次制作、模型等待、内容编辑、设计、返工与用户等待需要按真实时间另记。无法区分模型处理和平台等待时标未知，不推断思考时长，不用程序秒数承诺整稿速度。已有`benchmark-authoring.mjs`可汇总实际阶段记录。
