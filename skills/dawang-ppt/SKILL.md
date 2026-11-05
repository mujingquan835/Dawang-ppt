---
name: dawang-ppt
description: 制作、编辑和返工中文工作汇报类演示文稿（工作汇报、述职、复盘、季度/年度总结、项目进展）。以完整制作规则为唯一设计依据，在Dawang-PPT网页工作台编辑保存，经规则清单与独立复核后，默认只交付一个可离线编辑、下载保存的HTML，PPTX、PDF和图片由用户按需导出。
---
# Dawang-PPT

## 分工

- **设计依据：** 完整制作规则（制作步骤、通用规则、场景文档，用户指定时加设计系统）。由 `rules:read` 读取本机锁定版本的原文，每节标注 apply（照做）/ adapt（按 note 的边界执行）/ replaced（由 Dawang 引擎替代，多为 PPTD 格式与导出）。这些标注就是 Dawang 引擎对原规则的全部改动。
- **Dawang 提供：** 网页工作台（编辑、保存、导出）、authored 工程格式、规则锁定、程序检查与独立复核，以及用户确认过的几项交互（配色确认、重点句、单 HTML 交付）。
- **优先级：** 用户明确要求 > 原规则（apply/adapt）> Dawang 补充做法。Dawang 补充只填原规则未覆盖的细节，冲突时按原规则。引擎做不到的效果明确报告，不静默降级。

用户用自然语言提交材料；工程 JSON 和 CLI 都由制作智能体完成。保留原规则阅读、逐页设计与看图，不降低模型思考档位。

## 默认制作流程

按原规则的制作步骤执行，Dawang 只在对应步骤插入引擎操作。

0. **环境：** `node <skill>/scripts/dawang.mjs doctor`，核对 skill/project 路径、installations、rules（status 应为 pinned）与 ready（应为 true）。规则资料由 `DAWANG_PPT_RULES_DIR` 或 `~/.dawang-ppt/production-rules/` 提供，版本由 `references/production-rules.lock.json` 固定；缺失或不一致时停止并告知用户，不回退到摘要或简化规则。开发源码与日常安装可能不同，不据仓库改动宣称已安装。首次检出 `npm ci --prefix skills/dawang-ppt/project`。
1. **读材料（原规则 step1）：** `prepare <材料> <新目录> --scenario <id>` 提取正文、原图台账与该场景规则；实际阅读 material.json、rules.json 并查看必需图片。完整读取用户材料，不擅自联网扩充，不补造数据。
2. **梳理内容，找出缺口（原规则 step2，新建必做）：** 不论用户给的是大纲、一段文字、文档还是图片，先整理成结构化大纲 `outline.json`（格式见 [工程编写速查](references/authoring-api.md#内容大纲)）：汇报类型（工作汇报/复盘为 `report`，述职为 `review`）、统计时期、每页角色（整体结论、成果数据、关键动作、资源支持、问题差距、原因复盘、下一步、需支持/决策、职责定位）、重点句、带单位的数据、要点和照片。大纲写明 `scope`：用户只要一部分页面或某一块内容时为 `part`（默认），用户明确要完整汇报/述职时才是 `full`；authored 工程的 `requirements.scope` 同步填写。汇报结构要写进对应字段，页型才能被建议出来：有目标值写 `data[].target`（与实际值成对），今年/去年、亮点/待改进等成对内容写 `compare`，按月/季度展开写 `periods`，多张照片各对应一项时把事项写进 `items`（与 `photos` 同序同数量）。然后运行 `outline:check <outline.json>`：`part` 只检查所做页面本身（缺重点句、成果页无数据），`full` 才检查整稿结构（整体结论、问题差距、下一步）；同时给出每页建议页型。`rules:list` 查场景 ID，选主场景（工作汇报一般为 management-report）。
   **页数按原规则 step2 定：** 用户指定页数优先；给了逐页大纲或讲稿时按其页数；给了完整文档且没说页数时，问每页放多少内容并给出估计总页数；只给主题时推荐页数并确认。需要确认页数时，和缺口、配色候选放在同一次提问里。
   **没有缺口、页数也已确定时不问内容**，直接进入配色与制作。有缺口时只问一次，和大纲、配色候选（见第 4 步）放在同一条回复里：简短大纲（每页一句重点）、缺口清单（缺什么、为什么需要、缺了会怎样）。不要为同一份材料反复追问，不要追问用户没让做的部分。请用户二选一：补充材料，或按现有材料生成（相关页面如实标注“材料未提供”）。这个选择由用户做，不由模型判断；即使用户已委托配色和风格，缺材料仍要问，除非用户的请求里已说明缺材料时怎么处理。用户确认后按大纲制作：每页沿用大纲里的重点句、数据与照片，并按 `outline:check` 建议的页型和组件起步。[汇报版式逻辑](references/fusion/report-layout-logic.md)已拆成可放进任何区域的组件（答案块 `answerBlock`、对照组 `comparePair`、左右对照 `contrastPair`、时期色带 `periodBand`、指标带 `kpiStrip`、反白色块、深色侧栏），按页面角色默认使用，不要求材料数字与模板对上。每页 `visualDecision.pattern` 写所用页型；自由组合写 `free：理由`，汇报稿的自由页至少用一个组件，否则 `make` 会拦下；封面、目录、章节页写 `waived`，用户决定不用组件的写进 `userDecisions`。
3. **读规则，先列清单：** 实际阅读 `rules:read <主场景>` 返回的 apply/adapt 原文（本会话已读过同场景同指纹可复用）。原文与锁定版本不一致时停止并告知用户。随后运行 `rules:checklist <主场景>`，在排版前按章节写下这一章的要求打算怎么落实、落在哪页，或为何不适用（见“规则清单”）。设计从这份清单出发，不是排完再补记。
4. **配色：** 简短大纲后按 [配色推荐与确认](references/fusion/palette-selection.md) 处理：未指定且未委托时展示预览并等待选择。**主选候选取九组汇报配色**（用户确认，场景文档自带的配色参考不作主选），按内容挑 3–4 组，用 `palette-preview` 的 `{report:'blue-gold'}` 生成迷你汇报页预览；规则清单的配色参考章节记为 `applied`，`how` 写所选配色的颜色分工并引用 HS-04（红金不用于大促/促销类复盘，三原色不用于正式汇报，三原色同页不加紫绿，见 HS-05）；已指定、已委托或旧稿局部修改直接继续。
5. **文案与提纲：** 按场景规则对标题、内容的要求和 [文案编辑](references/fusion/content-editing.md) 主动改写，先形成可上屏文案再排版。记录全稿定位句 `contentPlan.throughLine`、逐页重点句 `slides[i].keyLine`（来源 quoted/distilled/created）、只给作者看的 `authorNotes`；字段见 [工程编写速查](references/authoring-api.md)。
6. **排版（原规则 step3）：** 依据清单与场景规则视觉要求逐页设计，写 authored 工程（`styleId:"authored/custom"`，1920×1080 逻辑画布）。排版前实际读取 [Dawang补充做法](references/fusion/visual-authoring.md) 与 [汇报版式逻辑](references/fusion/report-layout-logic.md)：禁止卡片不等于只用文字，每页用尺度对比、结构图、证据画面、视觉母题或色面分区之一承担主视觉。用 [排版工具与页型](references/authoring-api.md#排版工具与页型) 写工程：网格、指标组、流程、编号列表、图片网格与表格由工具保证对齐与成组，不手算坐标；先按每页内容选页型或自行组合工具，再调整。每页写 `visualDecision`，含 `zones` 分区（页型会给出初稿，按实际构图修改）；排版后运行 `wireframe <authored.json> <临时目录>` 看分区线框，确认主次区域与留白合理再进入生成。图片用文件路径作 `src`（或登记到 `media.entries` 后用 `mediaRef`），不把照片写成 data URI。
7. **生成与检查（原规则 step4）：** `make <authored.json> <用户命名.html> --screenshots <临时目录> --summary`。逐页实际看图，按原规则的 7 项看图清单和 [复核清单](references/fusion/visual-review.md) 修正（局部修改用 `patch:project`）。新稿首次 `make` 会以 `rules-review-missing` 停下，然后进入独立复核。
8. **独立复核（同一轮内闭环）：** `review:rules <workspaceDir>`。有 fail 时不结束本轮、不向用户汇报“未通过/还不能交付”：直接按理由改页面（`patch:project`），重新 `review:rules`，最多 3 轮。涉及版式、精致度、结构图、视觉母题的 fail 必须重新构图（换布局、加结构图或母题、调整图片面积），并更新 `visualDecision.layout`；只改措辞、行距或字号不算修正。通过后 `publish:html <workspaceDir> <交付.html>`（见“独立复核”）。
9. **交付（原规则 step5 由 Dawang 替代）：** 只交付一个 HTML（见“交付与保存”）。回复列出 contentReview（定位句、每页重点句及来源，created 句请用户确认）、visualReview 每页视觉重点、ruleReview 未采用的规则及理由、复核轮次与 fail→修正；用户决定覆盖了哪些检查（结果里的 `decided`、复核的 `decided`），以及第 3 轮后仍未解决、带着交付的复核意见（`rules-review-open`）逐条写明，请用户决定。用户效果认可单独记录。未经要求不加演讲者备注。

## 规则清单

`rules:checklist <场景>` 按章节列出主场景文档与通用 Requirements（`scenario#章节`、`general#Requirements`），每章附原文要点 `sections[].rules` 与待填骨架。逐条读完要点后，每章写一条到 `contentPlan.ruleChecklist:{scenario,items}`：

- `applied`：写 `how`（这一章的要求在本稿怎么落实，覆盖章内要点）与 `evidence:[{slideId,elementIds}]`，指向实际承担的元素。
- `not-applicable` / `user-override`：写 `reason`（如大纲指定配色属于 user-override；风格参考章节本稿未借用）。

任一章未记录，`make`/`publish:html` 失败；过半未采用会警告。

**Dawang 版式例外按子规则记录：** 原规则里被用户替换的个别条款（禁止卡片、禁止均分、统一圆角、场景配色、AI 配色）列在 [Dawang 版式例外](references/fusion/house-style.md) 表里，编号 HS-01…HS-05，每条写明现在允许什么、仍然要求什么。涉及的章节照常记为 `applied`，在 `how` 里写其余要求怎么落实，并引用编号（如“数字色块与结论条按 HS-01，并列指标等宽按 HS-02”）；**不要把整章记成 `user-override`**，那会把同章里无关的要求（如顶级视觉、母题）一起关掉。复核者按这张表判断这些条款。旧工程沿用逐条清单（`rules:checklist <场景> --items`）。

## 独立复核

程序只能证明每条都有记录、证据指向真实元素；是否真的做到，由复核者判定：

- `review:rules` 截图全稿，把截图、元素表、原规则和清单声明交给一个全新上下文的复核者（默认本机 Codex CLI，只读、不留会话；`DAWANG_REVIEWER_CMD` 可换成其他命令，`DAWANG_REVIEWER_MODEL` 指定模型），逐条判 pass/fail，写入工程的 `rules-review.json`。除规则外，复核者还按三条视觉标准看图：对齐（节点与说明、同行图片、数字与单位）、主次（第一眼是否读到重点、是否每页同构）、图片（关键区域看得清、未变形、无大块空白）；fail 会写出页码和具体问题。
- 不得为了通过复核而去掉数字色块、色块图标、深色侧栏或照片拼板，也不得把裁切嵌入的照片改成完整显示或缩小（裁切意见只调 `focal` 或换图）；复核因这些组件判 fail 时，检查清单对应章节的 `how` 是否引用了 HS 编号，补全后重新复核。
- 复核者看不到制作者的思考。用条形图充当结构图、页脚线充当母题、泛泛描述充当封面状态句、动作罗列充当结论标题等勉强对应会被判 fail。
- 修改后再次 `review:rules` 只复核上一轮 fail 的条目，通过项沿用（清单改动或加 `--full` 时全部重判），后续轮次更快。
- 下面放宽的只是独立复核者的意见：原规则 step4 的 7 项看图自查必须每页通过，程序检查（溢出、出界、叠压、图片未填满等）必须通过，只有用户决定能放行某项程序检查。
- `publish:html` 只接受当前修订、当前清单的复核：不通过的条目被用户决定覆盖时算已决定；没被覆盖的不通过在前 3 轮必须修改；**第 3 轮后**仍未解决的意见不再阻止发布，以 `rules-review-open` 列出，交付回复必须逐条写明这些意见并请用户决定。之后任何修改都需重新复核。按 fail 理由改页面；确实不适用时改为 not-applicable 并写理由（同样会被复核）。不得编辑或伪造 `rules-review.json`。找不到复核者时告知用户，不跳过。
- 部分页面（`scope: part`）不因缺少整体结论、下一步等整稿内容判 fail，复核提示已写明。
- fail 的原因是原材料没有、且所做页面确实需要的信息：不要改措辞反复重试，也不要自行停止或自行决定。第一次出现就向用户说明缺哪几项、复核为什么要它，请用户二选一：① 补充材料，补充后修改页面再复核；② 按现有材料生成，相关页面加一句如实说明（如“材料未提供整体目标与达成率”），清单该条改为 `not-applicable`，理由写“材料未提供……；用户确认按现有材料生成”，再复核（复核会判通过）。用户已在请求中说明缺材料时怎么处理的，按其说明执行。
- 复核意见与用户已明确的决定冲突时，不要顺着复核去改页面（例如把裁切的照片改成完整显示、把图片缩小）：把用户决定写进 `requirements.userDecisions`（见下节），重新复核即可。
- 回复必须与实际状态一致：本轮结束就是停止，不写“我会继续/接下来我会/你不需要操作”而不做。要继续就在本轮继续执行；做不到就明确说已停止、停在哪里。

## 用户决定

用户在对话里做的决定优先于原规则、Dawang 做法和复核者的判断。要让这个优先级在检查和复核里生效，必须记录到 `requirements.userDecisions`：

```json
{ "id": "p3-placeholder-photos", "quote": "图片仅作示意、不必与大纲一致", "decision": "第3页保留示意图，按行与各项对齐", "covers": ["visual#images"], "pages": ["p3"] }
```

- `quote` 是用户原话，不改写成用户没说过的话；没有用户原话就不能记录决定。
- `covers` 写被这条决定覆盖的复核条目 id（如 `visual#images`、`scenario#Color Palette Reference`）或检查 kind（如 `image-small-in-zone`）；`pages` 限定页面，省略表示全稿。
- 被覆盖的检查不再阻止 `make`/`publish:html`，在结果的 `decided` 里列出；复核者能看到用户原话，按决定判断。
- 已经确认、长期有效的偏好（数字色块、先画框再裁切、九组汇报配色等）已写进技能，不需要每份稿重复记录。

## 视觉执行检查点

每页 `visualDecision:{pattern,focus:{elementId,text?},layout,zones:[{id,role,bounds}]}`。页型和组件怎么选以 `outline:check` 的建议为准（选择逻辑只在代码里维护一份），下面只写硬性要求，`make` 会检查：

1. 先按场景规则要求定标题（如管理汇报要求标题陈述状态或结论），再在其中选出重点：最值得记住的结论、状态或数值，不是动作罗列。
2. 重点是句中一段时，用同一文字元素的 runs 让它在字号/字重/颜色/字体上区别于引导语；重点自成元素时让它成为本页最大字号。`layout` 写主视觉、证据与重点的空间关系。目录、过渡页等写 `{waived:'理由'}`。
3. 不能每页都把整块标题当重点（`visual-focus-all-titles` 会拦下）：至少有页面以大数字、关键词或结构节点为重点，或用 `focus.text` 指定标题中以 runs 区分的一段。
4. 数字默认放进色块（`metricTiles`，页型已默认）：标签在上、数字在下，重点数字用强调色竖条区分，不把一排裸数字直接摆在页面上。色块空余较大时会自动补图标填满，空间刚好则不加；图标不能关闭（不写 `icons:false`），也不要为了加图标缩小数字。自己画的色块右侧空余较大却没有图标，`make` 会以 `tile-spare-no-icon` 拦下。
5. 数据优先于图片：页面有多个数字时，数字必须进色块，不能埋进照片拼板的文字里；照片拼板 `photoPanels` 只用于文字少、几乎没有数据、每张照片对应一项的页面，拼板文字里超过 3 个数字时页型会报错。
6. **图片策略（所有照片组共用 `photoGroup`）：** 照片不拉伸，每张图的框跟着照片方向走（竖图竖框、横图横框），由工具选裁切最少的组合；照片组外边缘需要和旁边内容对齐时，先试只轻裁铺满，做不到再用裁切最少的框铺满（`listWithPhotos`）；高度可以跟着照片走时，按原图比例取图片最大的排法再轻裁对齐边缘（`itemRows`）。不要为了对称把所有照片裁成同样的框，也不要用 `fitImage` 把每张图各自缩小（`image-group-gaps`）。裁切围绕主体（`focal`），不切掉人脸和关键文字；复核说裁切切掉了内容时只调 `focal` 或换图，不改成完整显示或缩小（`image-frame-broken`、`image-letterbox`、`image-small-in-zone` 会拦下）。出现 `visual-zone-sparse` 时放大主体、收窄区域或换页型。
7. `zones` 先把页面分成几个区域（role：focus / evidence / support / flow / data / note / media），区域不重叠，页头页脚以外的文字和图片都落在区域内；`wireframe` 可预览。
8. 出现 `visual-layout-repeated` 或 `visual-text-only` 时回到构图重新分配区域，或说明内容为何要求如此。
9. 深色侧栏（需审批事项、下一步）用 `sidePanel`：标题、关键数字、编号事项按面板高度铺开，不在底部留大块空的深色；编号与缩进用工具排，不在一个文字框里用空格对齐（`text-manual-list` 会拦下）。
10. 一句收尾结论（复盘判断、下一步重点）不要单独悬在页面空白里：放进结论条 `noteBar`，贴着它总结的数据，或并入页头副标题（`text-orphan` 会拦下）。
11. **逐项对应：** 事项、数据、照片能逐项对应时落在同一列（`itemsWithPhotos`）；内容不足以逐项对应时用 `itemRows`：事项文字保持编号列表、不加底框，原来横排的数据色块改为竖排、与各自事项同行对齐，照片按第 6 条成组排列，不暗示哪张对哪项。示意照片在页脚写明，用户确认的写进 `userDecisions`。

## 交付与保存

默认交付目录只有一个用户命名的 HTML，内含可移交 ProjectV2 快照与资源，不附源目录、截图、ZIP 或报告；内部工程在 `~/.dawang-ppt/workspaces/<projectId>/`。`preview:start <workspaceDir>` 在网页工作台编辑，保留手工位置、裁切、字号及 runs。离线 HTML 顶部常驻“保存”，⌘S/Ctrl+S 与侧栏保存同一逻辑：首次关联原 HTML 并校验 projectId，之后直接覆盖；保存绝不静默下载副本，失败保留修改且不显示已保存；浏览器草稿不等于源文件保存。用户自行导出 PPTX/PDF/当前页图片，任务明确要求时可主动生成。保存与导出细节见 [工程编写速查](references/authoring-api.md)。编辑器的保存、重开、撤销重做由版本测试覆盖，单份稿件不在浏览器里重复测试；只看图检查页面本身。

## 已有工程与历史输入

- 局部修改：`patch:project` 后 `publish:html`，保留稳定 ID 与历史；严禁删除工程重建覆盖人工修改。
- ProjectV2：`render:project <deck-project.json> <index.html>`；历史 brief：`render:brief`；用户指定 dashi 原样模板：`templates` / `render:goal`（见 [旧主题与返工](references/legacy-and-revision.md)）。不承诺任意 HTML/PPTX 无损导入。
- 不支持原生数据图表、SmartArt、任意 SVG/动画；用文字、runs、图片、形状、线条和受控 vector 构建，不静默改成整页图片。

`run.json` 记最新诊断，`runs.jsonl` 追加程序阶段计时；模型思考、平台等待与返工另记，无法区分时标未知。
