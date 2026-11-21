---
name: dawang-ppt
description: 制作、编辑和返工中文工作汇报类演示文稿（工作汇报、述职、复盘、季度/年度总结、项目进展）。使用 Dawang-PPT 极速纯 Node 组版引擎，一键生成带双字体四字重、三色协同配色、零卡顿离线网页编辑器与原生可编辑 PPTX 的演示文稿。
---
# Dawang-PPT（极速出稿手册）

> **核心效率原则**：禁止翻读引擎源码（如 `report-deck.mjs`/`fast-build.mjs`/`authoring-api.md`），禁止自己写 Python 脚本解析表格或图片，禁止自己写 Playwright 截图脚本。**本手册已包含全部命令与完整 JSON 字段，严格按以下 3 步闭环，4–6 个回合内高质量交稿。**

---

## 三步极速闭环（默认唯一主路径）

### 第 1 步：一键摄取素材（1 条命令 + 读 1 份简报 + 看 1 张拼图）

若用户提供的是文件夹、`.pptx`、`.docx`、`.xlsx`、`.md` 或多张图片，直接运行内置摄取工具：

```bash
node <skill>/scripts/dawang.mjs ingest "<素材目录或文件>" "<临时目录>"
```

- 该命令 1 秒内提取全部文档、表格统计、PPTX 文字与内嵌图，并把所有图片拼成 **1 张带编号、尺寸、宽高比和文件名的 `contact-sheet.png`**。
- 接下来**只需**：`read_file` 读取 `<临时目录>/material-brief.md`，并**仅读取 1 次** `<临时目录>/contact-sheet.png`（禁止逐张单独读原图）。
- 若用户只在对话里贴了一段纯文字，直接跳到第 2 步。

---

### 第 2 步：写 `outline.json` 并一键出稿 + 生成总览图

用 `write_file` 写出 `<临时目录>/outline.json`（严格参照下方**完整字段速查**），然后一条命令同时产出 **离线可编辑 HTML**、**原生可编辑 PPTX**（按需加 `--pptx`）以及 **单张全稿总览图**（`--preview`）和实时 DOM 溢出检查：

```bash
node <skill>/scripts/dawang.mjs fast:build "<临时目录>/outline.json" "<输出.html>" --pptx "<输出.pptx>" --preview "<临时目录>/preview.png"
```

- 引擎内置：纯 Node 确定性编排（<1 秒）、**思源黑体 300/400/700/900 四档字重 + 优设标题黑（封面及 ≤10 字短标题自动生效）**、WOFF2 `FontFace` 离线嵌入、零卡顿自由拖拽/改字/加元素/保存工作台、以及无头 IR 直出可编辑 PPTX。

---

### 第 3 步：单图目检与极速交付（最多返工 1 轮）

1. 检查第 2 步 stdout 中的 `preview.overflows`（应为空数组 `[]`）及 `compose.sparse` / `compose.loose`。
2. `read_file` **只读 1 次** `<临时目录>/preview.png`，检查：文字是否截断/重叠、数字与单位是否清晰、图片裁切是否切掉人脸/核心文字、页面是否过空或相邻页完全雷同。
3. **无硬伤直接交付**；仅在发现硬伤（溢出、错图、裁切严重、留白失衡）时，**用 `edit_file` 局部修改 `outline.json`（禁止整份重写）**重跑一次 `fast:build` 并复查 `preview.png`（**最多修 1 轮，严禁反复微调刷回合**）。

---

## `outline.json` 完整字段速查（直接照写，无需查源码）

```json
{
  "title": "项目名称（用于页脚与封面名）",
  "period": "2026年Q3",
  "palette": "blue-gold",
  "pages": [
    {
      "id": "p1",
      "role": "cover",
      "eyebrow": "可选眉标",
      "name": "可选封面大标题（默认取 title）",
      "keyLine": "一句话定调本期核心状态或核心结论",
      "focus": "核心结论",
      "subtitle": "可选副标题",
      "note": "左下角小字（如 汇报人 · 日期）",
      "data": [{ "label": "核心指标", "value": "128", "unit": "万", "target": "100万" }],
      "photos": [{ "src": "/abs/path/hero.jpg", "crop": [0, 0, 1, 1], "caption": "可选图注" }]
    },
    {
      "id": "p2",
      "role": "summary",
      "eyebrow": "01 核心结果",
      "keyLine": "完整结论型标题，主句写明结论或关键数值",
      "focus": "关键数值",
      "figureStyle": "strip",
      "itemStyle": "cards",
      "order": ["intro", "metrics", "items", "photos"],
      "statements": [
        { "id": "intro", "label": "导语", "text": "一句承上启下的背景或总述" },
        { "id": "verdict", "label": "核心判断", "text": "复盘判断/收尾结论自动放页底并用点睛色", "tone": "judgment" }
      ],
      "data": [
        { "label": "总成交额", "value": "482", "unit": "万", "highlight": true },
        { "label": "完成率", "value": "118", "unit": "%", "target": "100%" }
      ],
      "itemsHeading": "关键动作（3–5项自动排卡片或编号列表）",
      "items": [
        { "title": "2-6字短标签", "detail": "一句完整事实或动作说明，不编造数据" }
      ],
      "compare": {
        "leftLabel": "现状/问题",
        "rightLabel": "改进/目标",
        "current": "right",
        "left": [{ "title": "项名", "detail": "数值或问题说明" }],
        "right": [{ "title": "项名", "detail": "数值或改进说明" }]
      },
      "periodsHeading": "阶段推进",
      "periods": [
        { "label": "7月", "title": "筹备期", "points": ["要点一", "要点二"] }
      ],
      "table": {
        "title": "分项明细",
        "columns": ["维度", "数量", "占比"],
        "rows": [["华东区", "120", "45%"]],
        "highlight": [0]
      },
      "flows": [
        {
          "title": "闭环链路",
          "returnTo": 1,
          "steps": [{ "title": "步骤一", "detail": "简短说明" }]
        }
      ],
      "photos": [
        { "src": "/abs/path/pic1.jpg", "focal": "50% 30%", "caption": "图注说明" }
      ]
    }
  ]
}
```

### 字段要点（避免踩坑）

1. **按真实信息关系选模块，拒绝千篇一律**：
   - 有目标 vs 实际 → 写 `data[].target`（1 个目标自动画「目标 → 实际」对照块）。
   - 有前后/问题 vs 改进对比 → 用 `compare`（两侧同指标且都是数值时自动画「前值 → 后值」大数字变化条；文字对比画双栏箭头对照）。
   - 有时间推进/排期 → 用 `periods`（并行项目可加 `lane`）。
   - 有步骤/闭环链路 → 用 `flows`（需要回流闭环写 `returnTo: 1`）。
   - 有多维结构数据 → 用 `table`（含「占比/比例」百分数列自动绘制原位比例条）。
   - `items` 与 `flows.steps` 的 `title` **不要手写 `01`/`1.` 等序号**，引擎会自动渲染序号圆标或编号。
   - 多页连续呈现时，相邻页应自然错开模块形态（引擎会自动交替 `strip`/`tiles`、`cards`/`list` 及照片侧栏/底带）。
2. **封面按需使用**：完整多页独立汇报可加第 1 页 `role: "cover"`；仅做 1 页单页汇总或插入页时**不加封面**，直接做内容页。
3. **绝对忠于事实**：绝不编造材料里没有的数字或案例；标题中提到的数字必须在本页模块中真实出现。单页已有清晰导语、数据、动作和图带时保持克制，不硬塞冗余条块导致拥挤。
4. **照片选图与防裁切**：优先保留体现整体氛围的横图总览与清晰人物/现场图，跳过模糊或重复图；人物照设 `"focal": "50% 25%"` 避免切头；封面截图可设 `"crop": [x, y, w, h]`。
5. **三色协同配色表（默认 `blue-gold`）**：
   - **默认首选**：`blue-gold`（蓝金色：皇家宝蓝 + 香槟暖金 + 活力橙点睛）
   - **商务/项目**：`stone-gold`（皓石金）、`business-gold`（商务金）、`jade-gold`（翡翠金）、`blue-cyan`（蓝青色）
   - **营销/冲刺**：`purple-gold-orange`（紫金橙）、`green-red-gold`（绿红金）、`red-gold`（红金色）、`primary-colors`（三原色）
   - **深色旗舰**：`midnight-gold`（星夜曜金）、`cyber-cyan`（黑曜电青）

---

## 交付规范与按需深度流程

- **交付物**：只把最终 `.html`（及用户要求或顺带产出的 `.pptx`）放到目标路径，提供可点击的本地绝对路径链接；中间 `outline.json`、`preview.png`、`contact-sheet.png` 留在临时目录，不污染交付目录。
- **回复简明**：说明页数、配色、每页结构选择、所用素材摘要，以及若材料存在明显缺失关系（如缺目标值/基期数）一并简要提示。
- **深度合规/旧工程修订**：仅当用户明确要求运行 `ruleChecklist`、独立复核 `review:rules` 或用 `patch:project` 局部修改旧工程时，再查阅 `references/legacy-workflow.md`。
