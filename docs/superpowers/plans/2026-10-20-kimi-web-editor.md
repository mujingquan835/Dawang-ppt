# Kimi 制作规则与 dashi 网页工作台整合方案 v4

> 2026-10-20 执行更新：用户已授权逐小版本开发，完成一个检查点后反馈并暂停。本轮 W0 工程接口已实现，失败稿目录已确认并固定历史修订，两次失败对应的具体 revision 待核；W1—W5 未开始。原文“当前只规划”描述为本方案成文时状态，不再限制本轮已授权的 W0 开发。

> 执行方式：后续实施按 `superpowers:executing-plans` 逐项推进；本文是规划，不表示能力已实现或效果已通过。

**Goal:** 保留 Kimi 的材料理解、叙事、设计判断和视觉复核要求，以 dashi 网页工作台完成快速预览、修改、保存及 HTML／PDF／PPTX 交付。

**Architecture:** 智能体直接依据 Kimi 原始适用规范设计页面，生成可保存的页面元素描述；网页运行时负责渲染，编辑器负责修改与保存，测量器负责反馈，导出器负责格式转换。新制作路径不经过旧模板选页和有限区域规划器，不再用少量 preset 解释完整设计系统。

**Tech Stack:** 沿用现有 Node.js >=22、React、HTML/CSS、Playwright、ProjectV2 与独立 PPTX 导出；按需要扩展元素表达，不新增远端制作服务。

**Spec:** 本文第 1—6 节为整合规格，第 7—9 节为实施与验收计划。承接本轮用户对 HTML 制作速度、网页修改便利、Kimi 规则保真及多格式交付的要求；历史数据与保存契约继续参考 `docs/融合规格-v2.md`。

## 1. 本轮结论与范围

采用“Kimi 负责制作，dashi 提供网页工作台”的分工。原 dashi 制作逻辑与现有有限规划器退出新路径，历史工程仍可打开。当前不删除旧代码、不改变默认 build、不替换全局安装、不发布、不推送。

本次交付只包含方案、新分支及分支盘点。后续先实施两张代表页验证，效果认可后再扩展整稿和切换默认入口。避免先全量改造、最后才第一次看效果。

### 仓库基线

- 开发仓库：Dawang-ppt-fusion-v1。
- 新分支：`codex/kimi-web-editor`。
- 起点：`codex/fusion-v1` 的 `493e3d8`，包含该分支尚未推送的两个检查点。
- 不基于 `grok/fusion-opt-v1`；不引入其中本地保留的上游原文或历史。
- 旧八页稿已验收；S2 日常流程开发完成不等于本方案已验收。
- 本方案是新制作路径的设计调整；既有编辑、媒体、保存与导出保障不因调整被取消。

## 2. 三层分工及主数据

| 层 | 决定什么 | 不应决定什么 |
|---|---|---|
| Kimi 制作规则＋智能体 | 受众、叙事、结论、信息关系、构图、字号层级、取景、节奏 | 凭空补造事实、绕过明确的用户约束 |
| 网页工作台 | 渲染、字体加载、逐元素编辑、撤销、保存、重开、素材打包 | 强制统一封面骨架、把风格缩为配色、静默改构图 |
| 测量与导出 | 溢出、覆盖、缺图、包结构、格式差异与交付报告 | 用几何分数代替审美、用截图冒充可编辑内容 |

制作流程：用户材料 → 按需读取 Kimi 原规则 → 智能体逐页设计 → 页面元素工程 → HTML 预览与编辑 → 看图修正 → 同一 revision 导出。

### 页面表达决策

1. 延续 ProjectV2 为唯一可写工程；HTML 是派生产物，避免 HTML 与 JSON 双主数据相互覆盖。
2. 新页仍用 `mode:"composition"`，新增可选 `authoring:{engine:"kimi-authored-v1"}` 标识；旧页没有该字段时按原逻辑处理。
3. 智能体直接编写稳定 ID 的文字、图片、形状、线条及扩展元素；明确坐标和样式，不经过 `planContentSlide` 或 `REGION_PRESETS`。编辑操作不重新调用旧规划器。
4. 复用通用绘制、字体、编辑和导出代码，不逐稿重复生成工作台源代码。允许组件帮助生成元素，但组件不成为每页必须套用的骨架。
5. 逻辑画布沿用 1920×1080、导出 13⅓×7½ 英寸及既有 CSS 字号/2→pt 契约；制作适配明确单位，禁止将 Kimi 示例中的 pt 直接当 CSS px。字体与尺寸验证在同一浏览器布局中进行。
6. 扩展文本为可选 `runs:[{text,style}]`，纯文本旧字段继续支持；新增受控 `vector` 元素承接图标与形状。不接受任意脚本作为页面内容。
7. 不承诺把任意 HTML 无损导入现有编辑器。HTML/CSS 的可视自由度与元素的可编辑程度分别记录。

## 3. Kimi 规则保留机制

每份稿读取：原技能制作步骤、通用场景规则、一个主场景（必要时一个辅场景）、用户指定的设计系统或风格参考、相关表达格式说明。自主设计不强制选择 Kimi 预设；用户选 dashi 外观时，只把它作为视觉参考并明确调整后的路径，不再锁原模板。

原始规则按本机路径读取并记录文件哈希，不将二次摘要作为唯一依据，不把全部设计系统一次载入。不复制未明确许可的上游原文入公开仓库。

单稿本地生成 `rules-manifest.json`：

```text
sources: [{id, path, sha256, section}]
decisions: [{ruleId, sourceId, status, reason, slideIds, evidencePaths}]
status: applicable | not-applicable | user-overridden | unsupported
```

缺失必读来源时明确报缺，不悄悄降级为少量关键词。规则适用性由智能体判断，程序只检查记录完整性，不声称自动理解全部规范。

优先级：用户明确要求 > 所选设计系统的明确覆盖关系 > 主场景 > 通用建议。不能为遵守原文中的目标/业绩要求补造数据；冲突记理由与处理，不能静默丢弃。

| 原有要求 | 落实位置 | 证明方式 |
|---|---|---|
| 读者任务、结论、叙事 | contentPlan 与逐页设计说明 | 对照原材料，标题连读和内容检查 |
| 封面、观点、数据、图像页构图区别 | 智能体页面设计 | 整稿总览与逐页图 |
| 字号层级、句内强调 | runs 与样式 | 浏览器、保存重开、PPTX 对照 |
| 图片主次、裁切、比例、主体 | 图片框、fit、focal；必要时源裁切 | 保留原图，预览与导出取景一致 |
| 图标、细线、页码等 | 元素层 | 按风格适用性检查，不强制每页装饰 |
| 密度、留白、节奏 | 设计说明与视觉复核 | 不设全稿统一填满率 |
| 必须看图再交付 | review-report | 全稿总览、可疑页原尺寸复查、修正记录 |
| 字体与多格式交付 | export-report | 实际文件、字体状态、Office 检查 |

“完整保留规则”指适用条款持续参与设计并有处理记录；不表示全部上游运行时功能已移植、全部风格已实现或官方效果已复现。

## 4. 编辑、导出与能力边界

| 能力 | 目标 | 不支持时处理 |
|---|---|---|
| 改字、字号、颜色、位置 | 原生编辑、撤销、保存重开 | 明确冲突，不丢人工修改 |
| 句内强调 | 按 run 保留样式；整段替换需明确保留或重置策略 | 不把整段静默展平成纯文本 |
| 换图、contain/cover、焦点 | 同一状态驱动预览与导出 | 报具体差异，不自行改回 contain |
| 图标与矢量 | 支持范围内保留矢量 | 仅经记录的装饰可栅格化，注明可编辑程度 |
| HTML | 完整离线目录及可浏览成品 | 单 HTML 只有依赖已内嵌时才称独立文件 |
| PDF | 优先验证当前截图 PDF 的视觉交付 | 明确文字不可选；可选文字 PDF 另列能力 |
| PPTX | 文字与基础图形可编辑，裁切正确 | 不把整页截图作为可编辑 PPTX 交付 |
| 字体 | 报实际使用、回退、嵌入与目标环境状态 | 本机存在不等于接收方可用 |
| 动画、原生图表、任意 SVG | 不作为首个两页验证的成功承诺 | 逐项列 supported/unsupported，不改写原需求掩盖 |

正文证据截图优先完整显示；封面或重点解释允许有目的裁切，必需事实不得被裁掉，完整源图保留在媒体目录。不要未经用户要求自动加演讲者备注。

现有独立导出继续使用。原 dashi 专有导出包不进入本产品；本方案没有授权重新分发该包，也不以复用工作台界面推导导出器可直接复用。

## 5. 速度与 token 验证

HTML 并不天然比 PPTD 更省 token。保留工作台与绘制代码复用，减少模型反复输出源码；Kimi 与本方案均是模型生成文本工程，再由程序导出文件。

固定同一份材料、页数、图片、外观方向、模型及要求，记录旧路径与新路径：规则读取量、首次生成实际 token、修正实际 token、总墙钟时间、程序渲染/QA/导出时间、修改轮数和可编辑程度。实际用量不可取得时标 unavailable，文件大小、字符数只能单独列为估算代理，不冒充 token。

区分首次出稿速度与达到认可的总成本。两页验证只证明可行性；另一个真实场景通过前，不宣布普遍更快或普遍更省。

## 6. 全局约束与重点检查

- 当前只规划；不得借本文自动开始运行时代码改造。
- 旧工程可打开，既有人工几何/字体/裁切优先；既有稳定 ID 不随排序改变。
- 私人材料、真实生成稿、上游规范正文、字体文件、依赖不提交公开 Git。
- 不自动搜索补事实，不编造缺失素材；用户限制和事实边界高于参考设计中的通用建议。
- 新方式经效果与编辑导出验证后才考虑默认切换；不静默改全局安装，不合 main、不正式发布。

重点检查：长中文标题换行、句内强调改字、带文字截图裁切、缺字体/字体替代、编辑后同 revision 导出。以下任务分别覆盖这些输入，不能只测静态样稿截图。

## 7. 实施任务（未开始）

路径均相对仓库根目录；`P=skills/dawang-ppt/project`。本阶段编号用 W0—W5，避免与旧 S1/S2 混淆。

### W0：建立规则与真实对照基准

**文件：** 新建 `docs/kimi-web/rules-and-capabilities.md`；扩展 `P/src/fusion/kimi/reference-index.mjs`；新增 `P/src/fusion/kimi/rule-manifest.mjs`、`tests/fusion/kimi-rule-manifest.test.mjs`。真实业务基准与截图只存忽略目录 `output/kimi-web/`。

**接口：** `createRuleManifest({sourceFiles, decisions}) -> {sources, decisions}`；每个 source 保留路径/哈希；`validateRuleManifest(manifest) -> issues[]` 检查引用、来源缺失和状态。

- [x] 建合成测试：来源缺失、哈希变化、not-applicable 有理由、unsupported 不得被写成通过；先确认失败。
- [x] 实现上述最小接口；运行 `node --test tests/fusion/kimi-rule-manifest.test.mjs` 通过。
- [ ] 固定《旅行导演》的原材料、两版失败稿、参考稿和对照页；缺失基准先定位，不把文档描述当作已看过实物。
- [x] 记录封面和功能页各自的读者任务、必需文字、取景目的与具体视觉问题，作为 W1—W3 验收依据。
- [x] 只提交源码、合成测试与自行撰写说明；不提交业务基准。

### W1：增加直接设计入口，绕开旧规划器

**文件：** 新建 `P/src/fusion/authoring/create-project.mjs`；修改 `P/scripts/fusion-cli.jsx`、`P/src/fusion/project/schema.mjs`；新增 `tests/fusion/kimi-authoring.test.mjs`。

**接口：** `createAuthoredProject(input) -> ProjectV2`；输入为 requirements、sources、media、contentPlan、designChoice、带稳定 ID 的 slides/elements。新命令 `render:authored <input.json> <output/index.html>`；`build` 仍保持原别名。

- [ ] 先测：相同内容的两种明显不同构图被原样保留，包含长中文标题、空白区与裁切图片；未知元素明确失败。
- [ ] 最小实现直接入口，不调用 `planContentSlide`；保留输入边界和样式，不自动换页型或替换配色。
- [ ] 运行 `node --test tests/fusion/kimi-authoring.test.mjs`，断言元素结构保存、校验可用、原入口契约不变。
- [ ] 使用现有渲染器完成两页可看版本；记录表达层缺口，不能退回旧 preset 凑样稿。
- [ ] 保存独立检查点。

### W2：补两页必需表达，并贯穿编辑状态

**文件：** 修改 `P/src/fusion/scene/render.jsx`、`scene/model.mjs`、`project/schema.mjs`、`editor/commands.mjs`、`editor/inspector.jsx`；新增 `P/src/fusion/authoring/text-runs.mjs`、`tests/fusion/kimi-edit-roundtrip.test.mjs`。矢量渲染可拆入 `scene/vector.jsx`，避免继续膨胀主渲染器。

**接口：** `text` 支持可选 runs；`vector` 包含 viewBox/path 与受控样式；新增 `command.type="text-runs"`、`command.runs`，全段普通 text 替换含 runs 元素时返回 `rich-text-reset-required`，只有显式 `resetRuns:true` 才重置。图片沿用 fit/focal，不强制 contain。

- [ ] 先写状态回环测试：强调词改字保样式、撤销重做、保存重开、换图保焦点、手工移动后重渲染不回跳。
- [ ] 按需补富文本、矢量、细线和图片焦点；不做任意 SVG/HTML 解释器，不建设大组件库。
- [ ] 运行 `node --test tests/fusion/kimi-edit-roundtrip.test.mjs`；再在真实浏览器中完成上述操作并保存证据。
- [ ] 将封面和功能页交用户看实际效果；未认可前不扩展全稿。相同问题三轮无有效改善时提供证据和取舍。
- [ ] 保存检查点，分别标记工程通过与视觉待确认/通过。

### W3：打通可信 QA 与同 revision 多格式交付

**文件：** 修改 `P/src/fusion/qa/measure.mjs`、`export/collect.mjs`、`export/pptx-core.mjs`、`export/write.mjs`、`export/from-url.mjs`；新增 `tests/fusion/kimi-export.spec.mjs`、`tests/fusion/qa-readiness.spec.mjs`。

**接口：** QA 报告新增 readiness、finiteBounds；导出报告新增 fonts、unsupported、rasterized、revision。字段增加保持旧消费方兼容；字体状态不以本机可用替代嵌入状态。

- [ ] 先测布局未就绪、零 scale、未加载图片、缺字体、富文本导出、裁切一致、包内引用不存在等故障；等待采用有效尺寸与布局稳定条件，不硬编码屏幕宽度 >900。
- [ ] 确保字体与图片加载、全部测量值有限；不支持的元素显式报告；信息内容不静默栅格化。
- [ ] 运行 `node --test tests/fusion/qa-readiness.spec.mjs tests/fusion/kimi-export.spec.mjs`；对实际输出文件做包结构与内容核对。
- [ ] 导出完整 HTML 源目录、PDF、PPTX，记录当前 PDF 为截图模式；PPTX 在 PowerPoint 打开、改字、保存重开并与网页取景对照。
- [ ] 只有两页的效果、编辑和三种交付均达标，才通过首个可行性门槛。

### W4：扩展真实整稿，验证迁移与成本

**文件：** 新建 `docs/kimi-web/acceptance.md`、`P/scripts/benchmark-authoring.mjs`；实测记录存 `output/kimi-web/`，不入 Git。

**接口：** `benchmark-authoring.mjs <runs.json> <report.json>` 校验并汇总页数、模型、时间段、实际 token 或 unavailable、修正次数、验收状态；不调用模型、不用字符数推造 token。

- [ ] 首先用合成记录验证缺少 token 的运行显示 unavailable，重叠计时不重复相加。
- [ ] 扩展《旅行导演》整稿，检查页间节奏和必需内容，记录每页规则决定。
- [ ] 再用管理汇报或培训中的一个不同真实场景验证；同材料同要求作旧/新路径对照，避免把两页结果推广到全部任务。
- [ ] 检查旧八页的对象、内容、布局和渲染无非预期变化；不以 ZIP 逐字节相同为标准。
- [ ] 运行 `npm test` 一次全量回归；确认视觉认可、编辑可靠与成本实测，再建议是否切换。

### W5：经认可后切换日常入口

**文件：** 修改 `skills/dawang-ppt/SKILL.md`、`references/contracts.md`、`references/fusion/production.md`、`references/fusion/visual-review.md`、`scripts/dawang.mjs`、`docs/kimi-web/acceptance.md`；旧 `build` 的迁移方案另测 `tests/fusion/kimi-entry.test.mjs`。

- [ ] 在 W4 达标后给出具体入口切换与回退说明；历史 `render:brief`、`render:goal`、`render:project` 可显式调用。
- [ ] 新稿默认按 Kimi 制作步骤读取原规则，再直接设计；不再限制六种外观，不强制以旧九宫格作为 Kimi 自主设计前提。
- [ ] 程序 CLI 面向工程，用户仍用自然语言提交材料，不要求用户编写元素 JSON。
- [ ] 核对全局安装实际路径、入口与源目录；切换单独执行并留回退点，不因本次建分支自动改变安装。
- [ ] 完成旧入口/新入口回归后记录开发、安装、用户认可和发布各自状态；未经授权不推送、不合 main、不正式发布。

## 8. 首个成功门槛与停止条件

首个门槛只看两张真实代表页：封面和功能页。必须证明构图不再受旧骨架限制、内容齐全、截图可读、句内强调存在、网页编辑保存有效、PPTX 可编辑且无修复提示、PDF/HTML 可交付。用户对效果的明确认可单独记录，程序检查不能代替。

不设“标题统一 44pt、内容底边必须 85%、每页必须有图标”的全局门槛。具体比例按所选设计方向及两页任务确定。

若直接元素表达仍需要不断绕过保存/导出限制，停止扩大范围，先报告哪些功能缺失、解决代价与可编辑程度；不得回退到全页截图并宣称成功。

## 9. 自检与交接

- 规则覆盖：通用规则、场景、设计系统、内容事实、图片、层级、节奏、视觉复核均有落实与证据位置。
- 接口一致：authoring 标识、runs、text-runs/resetRuns、vector 与报告字段由上述任务统一定义。
- 核心异常分别由 W1 长标题/边界、W2 富文本/焦点/人工修改、W3 加载/字体/导出、W4 成本缺失数据覆盖。
- 新路径与旧路径共存只用于验证及恢复，不再维护两套相互干扰的新稿制作判断。
- 没有预估“节省百分比”或承诺固定工期；先以首个门槛决定后续投入。
- 本文写入与建分支完成，不代表 W0—W5 已执行。
