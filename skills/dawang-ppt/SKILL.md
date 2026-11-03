---
name: dawang-ppt
description: 制作、编辑和返工中文演示文稿。以完整制作规则为唯一设计依据，在Dawang-PPT网页工作台编辑保存，经规则清单与独立复核后，默认只交付一个可离线编辑、下载保存的HTML，PPTX、PDF和图片由用户按需导出。
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
2. **理解需求（原规则 step2）：** 按原文判断用途、设计方向、输入类型、页数；`rules:list` 查场景 ID，选一个主场景（必要时一个辅场景）。需要澄清时按原文“Clarification”提问。
3. **读规则，先列清单：** 实际阅读 `rules:read <主场景>` 返回的 apply/adapt 原文（本会话已读过同场景同指纹可复用）。原文与锁定版本不一致时停止并告知用户。随后运行 `rules:checklist <主场景>`，在排版前逐条写下打算怎么做、落在哪页，或为何不适用（见“规则清单”）。设计从这份清单出发，不是排完再补记。
4. **配色：** 简短大纲后按 [配色推荐与确认](references/fusion/palette-selection.md) 处理：未指定且未委托时展示预览并等待选择，候选优先取场景文档的配色参考；已指定、已委托或旧稿局部修改直接继续。
5. **文案与提纲：** 按场景规则对标题、内容的要求和 [文案编辑](references/fusion/content-editing.md) 主动改写，先形成可上屏文案再排版。记录全稿定位句 `contentPlan.throughLine`、逐页重点句 `slides[i].keyLine`（来源 quoted/distilled/created）、只给作者看的 `authorNotes`；字段见 [工程编写速查](references/authoring-api.md)。
6. **排版（原规则 step3）：** 依据清单与场景规则视觉要求逐页设计，写 authored 工程（`styleId:"authored/custom"`，1920×1080 逻辑画布）。排版前实际读取 [Dawang补充做法](references/fusion/visual-authoring.md)：禁止卡片不等于只用文字，每页用尺度对比、结构图、证据画面、视觉母题或色面分区之一承担主视觉。每页写 `visualDecision`（见“视觉执行检查点”）。图片登记在 `media.entries`，元素用 `mediaRef` 引用，不把照片写成 data URI。
7. **生成与检查（原规则 step4）：** `make <authored.json> <用户命名.html> --screenshots <临时目录> --summary`。逐页实际看图，按原规则的 7 项看图清单和 [复核清单](references/fusion/visual-review.md) 修正（局部修改用 `patch:project`）。新稿首次 `make` 会以 `rules-review-missing` 停下，然后进入独立复核。
8. **独立复核（同一轮内闭环）：** `review:rules <workspaceDir>`。有 fail 时不结束本轮、不向用户汇报“未通过/还不能交付”：直接按理由改页面（`patch:project`），重新 `review:rules`，最多 3 轮。涉及版式、精致度、结构图、视觉母题的 fail 必须重新构图（换布局、加结构图或母题、调整图片面积），并更新 `visualDecision.layout`；只改措辞、行距或字号不算修正。通过后 `publish:html <workspaceDir> <交付.html>`（见“独立复核”）。
9. **交付（原规则 step5 由 Dawang 替代）：** 只交付一个 HTML（见“交付与保存”）。回复列出 contentReview（定位句、每页重点句及来源，created 句请用户确认）、visualReview 每页视觉重点、ruleReview 未采用的规则及理由、复核轮次与 fail→修正。用户效果认可单独记录。未经要求不加演讲者备注。

## 规则清单

`rules:checklist <场景>` 把主场景文档与通用 Requirements 拆成逐条 id（`scenario#章节#序号`、`general#Requirements#序号`），附原文摘要与待填骨架。写入 `contentPlan.ruleChecklist:{scenario,items}`：

- `applied`：逐条写 `how` 与 `evidence:[{slideId,elementIds}]`，指向实际承担该规则的元素；整章不能一次记为 applied。
- `not-applicable` / `user-override`：写 `reason`（如大纲指定配色属于 user-override）。整章确实不适用可用章节 id 一次记录。

任一条未记录，`make`/`publish:html` 失败；过半未采用会警告。

## 独立复核

程序只能证明每条都有记录、证据指向真实元素；是否真的做到，由复核者判定：

- `review:rules` 截图全稿，把截图、元素表、原规则和清单声明交给一个全新上下文的复核者（默认本机 Codex CLI，只读、不留会话；`DAWANG_REVIEWER_CMD` 可换成其他命令，`DAWANG_REVIEWER_MODEL` 指定模型），逐条判 pass/fail，写入工程的 `rules-review.json`。
- 复核者看不到制作者的思考。用条形图充当结构图、页脚线充当母题、泛泛描述充当封面状态句、动作罗列充当结论标题等勉强对应会被判 fail。
- `publish:html` 只接受当前修订、当前清单且无 fail 的复核；之后任何修改都需重新复核。按 fail 理由改页面；确实不适用时改为 not-applicable 并写理由（同样会被复核）。不得编辑或伪造 `rules-review.json`。找不到复核者时告知用户，不跳过。
- 只有两种情况停下来找用户：fail 的原因是材料缺失（具体问缺哪项数据，同时说明页面已如何标注）；3 轮后仍有 fail（附截图、剩余 fail 理由和可选方案）。停下来时如实说明已完成到哪一步、产物在哪里、需要用户做什么。
- 回复必须与实际状态一致：本轮结束就是停止，不写“我会继续/接下来我会/你不需要操作”而不做。要继续就在本轮继续执行；做不到就明确说已停止、停在哪里。

## 视觉执行检查点

每页 `visualDecision:{focus:{elementId,text?},layout}`，`make` 会检查：

1. 先按场景规则要求定标题（如管理汇报要求标题陈述状态或结论），再在其中选出重点：最值得记住的结论、状态或数值，不是动作罗列。
2. 重点是句中一段时，用同一文字元素的 runs 让它在字号/字重/颜色/字体上区别于引导语；重点自成元素时让它成为本页最大字号。`layout` 写主视觉、证据与重点的空间关系。目录、过渡页等写 `{waived:'理由'}`。
3. 不能每页都把整块标题当重点（`visual-focus-all-titles` 会拦下）：至少有页面以大数字、关键词或结构节点为重点，或用 `focus.text` 指定标题中以 runs 区分的一段。
4. 出现 `visual-layout-repeated` 或 `visual-text-only` 时回到构图重新分配区域，或说明内容为何要求如此。

## 交付与保存

默认交付目录只有一个用户命名的 HTML，内含可移交 ProjectV2 快照与资源，不附源目录、截图、ZIP 或报告；内部工程在 `~/.dawang-ppt/workspaces/<projectId>/`。`preview:start <workspaceDir>` 在网页工作台编辑，保留手工位置、裁切、字号及 runs。离线 HTML 顶部常驻“保存”，⌘S/Ctrl+S 与侧栏保存同一逻辑：首次关联原 HTML 并校验 projectId，之后直接覆盖；保存绝不静默下载副本，失败保留修改且不显示已保存；浏览器草稿不等于源文件保存。用户自行导出 PPTX/PDF/当前页图片，任务明确要求时可主动生成。保存与导出细节见 [工程编写速查](references/authoring-api.md)。

## 已有工程与历史输入

- 局部修改：`patch:project` 后 `publish:html`，保留稳定 ID 与历史；严禁删除工程重建覆盖人工修改。
- ProjectV2：`render:project <deck-project.json> <index.html>`；历史 brief：`render:brief`；用户指定 dashi 原样模板：`templates` / `render:goal`（见 [旧主题与返工](references/legacy-and-revision.md)）。不承诺任意 HTML/PPTX 无损导入。
- 不支持原生数据图表、SmartArt、任意 SVG/动画；用文字、runs、图片、形状、线条和受控 vector 构建，不静默改成整页图片。

`run.json` 记最新诊断，`runs.jsonl` 追加程序阶段计时；模型思考、平台等待与返工另记，无法区分时标未知。
