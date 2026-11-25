---
name: dawang-ppt
description: 整理多源汇报材料（散图、历史参考PPT、粗版草稿PPT、Word/Excel/PDF、大段文字与口述指令），提炼版式解耦的关系型汇报大纲，并制作、编辑与返工中文工作汇报类演示文稿（工作汇报、述职、复盘、季度/年度总结、项目进展）。使用 Dawang-PPT 极速纯 Node 组版引擎，一键生成带双字体四字重、三色协同配色、4 套自适应切换版式与原生可编辑 PPTX。
---
# Dawang-PPT（多源整合 · 版式解耦大纲 · 极速出稿手册）

> **核心效率原则**：禁止翻读引擎源码（如 `report-deck.mjs`/`fast-build.mjs`/`authoring-api.md`），禁止自己写 Python 脚本解析表格或图片，禁止自己写 Playwright 截图脚本。**本手册已包含全部命令与完整 JSON 字段，严格按以下 3 步闭环，4–6 个回合内高质量交稿。**

---

## 三步极速闭环（默认唯一主路径）

### 第 1 步：多源角色感知摄取（1 条命令 + 读 1 份简报 + 看 1 张拼图）

无论用户给的是散装文件、图片目录、历史参考 PPT、粗版 PPT、大段文字还是口述补充，直接用内置 `ingest` 一次全部传入并标记角色（`--draft` 粗版、`--history` 历史参考、`--note` 口述文本/要求）：

```bash
# 单目录兼容写法
node <skill>/scripts/dawang.mjs ingest "<素材目录或文件>" "<临时目录>"

# 多源混合 + 角色标记写法（推荐日常使用）
node <skill>/scripts/dawang.mjs ingest "<散图或文档目录>" --draft "<粗版.pptx>" --history "<历史参考.pptx>" --note "<大段文字或口述指令>" --out "<临时目录>"
```

- 该命令 1 秒内完成：PPTX 按页提取图文/表格/备注并**自动剔除母版重复 Logo**、DOCX 完整段落/表格/内嵌图提取、XLSX **自动排除合计行并预计算总计与 `breakdown` 占比 `pct`**、所有图片去重并拼成 **带 `IMG-XX` 编号、`[历史]`/`[截图]` 标签与宽高比的 `contact-sheet.png`（超过 80 张自动分卷生成 `contact-sheet-2.png` 等）**、同步产出资产索引 `<临时目录>/material-pack.json`。
- 接下来**只需**：`read_file` 读取 `<临时目录>/material-brief.md`（**优先遵守最顶部的 `🎯 口述要求与上屏禁令` 与 `🧩 自动识别的信息关系信号`**），并按目录中给出的拼图文件列表**一次性查看拼图**（禁止逐张单独读原图）。
- 若用户只在对话里贴了一段纯文字且无任何文件/图片，可直接跳到第 2 步。

---

### 第 2 步：写版式解耦 `outline.json`（可先审大纲 / 也可极速直出）

写出 `<临时目录>/outline.json`（严格参照下方**完整字段速查**，图片与表格可直接写 `"IMG-01"`、`"TBL-01"` 短 ID，**禁止在 `outline.json` 里强行锁死 `layouts` 或在正文里写“左三右二/放几个圆环”等几何版式词**）：

- **模式 A（用户要求“先写大纲 / 先看框架”时）**：
  写出 `outline.json` 后运行大纲预检，生成人类可读的**版式解耦大纲评审表**供用户确认：
  ```bash
  node <skill>/scripts/dawang.mjs outline:lint "<临时目录>/outline.json" --md "<临时目录>/outline-plan.md"
  ```
  向用户呈现 `outline-plan.md`（含每页结论、信息关系组件、绑定短 ID 与负载评估，**不固定死板几何版式**）；用户确认后直接运行下方 `fast:build`，**零转译失真直出成品**。
- **模式 B（用户已提供现成自由文本大纲 + 素材时 — 去版式化转译）**：
  保留用户大纲的**章节顺序、核心结论与事实数字**，剥离其中僵化的固定位置/图形指令，将各页信息关系准确映射为引擎原生模块（`data` / `breakdown` / `funnel` / `hub` / `compare` / `periods` / `flows` / `table` / `items`），并用 `outline:lint` 预检通过后出稿。
- **模式 C（默认极速直出）**：
  写出 `outline.json` 后直接一条命令同时产出 **离线可编辑 HTML**、**原生可编辑 PPTX**（按需加 `--pptx`）以及 **单张全稿总览图**（`--preview`）和实时 DOM 溢出检查（`fast:build` 内部会自动执行短 ID 解析与大纲清洗）：

```bash
node <skill>/scripts/dawang.mjs fast:build "<临时目录>/outline.json" "<输出.html>" --pptx "<输出.pptx>" --preview "<临时目录>/preview.png"
```

- 引擎内置：纯 Node 确定性编排（<1 秒）、**思源黑体 300/400/700/900 四档字重 + 优设标题黑（封面及 ≤10 字短标题自动生效）**、WOFF2 `FontFace` 离线嵌入、零卡顿自由拖拽/改字/加元素/保存工作台、每页 **4 套零丢内容一键换版式**、以及无头 IR 直出可编辑 PPTX。

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
      "role": "section",
      "part": "PART 01",
      "name": "全年核心业绩总览",
      "keyLine": "围绕三大业务主线展开核心战役复盘与增长路径拆解",
      "items": [
        { "title": "业绩达成", "detail": "核心指标与同比增长率拆解" },
        { "title": "重点战役", "detail": "跨板块协同打法与转化闭环" }
      ]
    },
    {
      "id": "p3",
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
        { "label": "年度营收", "value": "482", "unit": "万", "delta": "+24.5%", "trend": [280, 340, 410, 482], "highlight": true },
        { "label": "完成率", "value": "118", "unit": "%", "target": "100%" }
      ],
      "breakdown": {
        "title": "结构构成（Tremor 分段占比条，自动生成横条排行/主次网格等切换版式）",
        "total": "2,640 万",
        "badge": "同比 +24.8%",
        "items": [
          { "label": "核心业务", "value": "1,280 万", "pct": 48 },
          { "label": "增长业务", "value": "790 万", "pct": 30 },
          { "label": "创新业务", "value": "570 万", "pct": 22 }
        ]
      },
      "funnel": {
        "title": "转化漏斗（居中递减漏斗，自动生成横向步骤卡/阶梯进度等切换版式）",
        "steps": [
          { "label": "阶段一", "detail": "简要说明", "value": "12.4", "unit": "万", "rate": "100%" },
          { "label": "阶段二", "detail": "简要说明", "value": "3.1", "unit": "万", "rate": "25.0%", "drop": "转化 25.0%" }
        ]
      },
      "hub": {
        "title": "中心汇聚架构（多源输入→核心引擎→多端输出，自动生成分层流水切换版式）",
        "center": { "badge": "CORE", "title": "核心中台", "sub": "统一编排 · 实时同步" },
        "inputs": [{ "title": "输入源一", "detail": "简短说明" }],
        "outputs": [{ "title": "输出端一", "detail": "简短说明" }]
      },
      "matrix": {
        "title": "2×2 四象限矩阵（优先级/战略定位，自动生成四格Bento/焦点放大切换版式）",
        "xLabel": "实施难度（低 → 高）",
        "yLabel": "业务价值",
        "quadrants": [
          { "title": "优先速赢区", "tag": "P0 立即做", "highlight": true, "items": ["要点一", "要点二"] },
          { "title": "战略攻坚区", "tag": "P1 重点投", "tone": "pop", "items": ["要点一"] },
          { "title": "稳步优化区", "tag": "P2 常规做", "tone": "ok", "items": ["要点一"] },
          { "title": "低优观察区", "tag": "P3 暂缓", "tone": "muted", "items": ["要点一"] }
        ]
      },
      "diagnosis": {
        "title": "问题→归因→解法三联诊断卡（自动生成解法聚光灯/条带递进切换版式）",
        "items": [
          { "tag": "01 现状问题", "title": "痛点标题", "detail": "客观问题描述", "metric": "影响范围", "tone": "err" },
          { "tag": "02 根因定位", "title": "归因标题", "detail": "核心症结分析", "tone": "warn" },
          { "tag": "03 优化解法", "title": "解法标题", "detail": "落地动作与预期", "metric": "目标收益", "tone": "primary" }
        ]
      },
      "tracker": {
        "title": "多周期达标追踪条（Tremor Tracker，自动生成柱状追踪/网格矩阵切换版式）",
        "summary": "全年 12 个月达成追踪（10 个月达标）",
        "badge": "达标 10/12",
        "items": [
          { "label": "1月", "status": "ok", "value": "106%" },
          { "label": "2月", "status": "warn", "value": "94%", "note": "春节淡季小幅波动" },
          { "label": "3月", "status": "miss", "value": "82%", "note": "渠道切换承压" }
        ]
      },
      "featureMatrix": {
        "title": "SaaS 方案能力勾选矩阵（自动生成方案分栏卡/紧凑对比表切换版式）",
        "columns": [
          { "name": "传统方案" },
          { "name": "升级方案", "badge": "推荐", "highlight": true },
          { "name": "外部采购" }
        ],
        "rows": [
          { "feature": "离线可编辑", "values": [false, true, "partial"] },
          { "feature": "交付周期", "values": ["3 天", "10 分钟", "2 周"] }
        ]
      },
      "gauges": {
        "title": "环形达成率仪表盘（自动生成刻度仪表盘/左环右数切换版式）",
        "items": [
          { "label": "年度营收达成", "pct": 118, "value": "4,820 万", "target": "目标 4,080 万", "highlight": true },
          { "label": "按期交付率", "pct": 94, "value": "47 / 50 项", "target": "目标 90%" }
        ]
      },
      "pyramid": {
        "title": "金字塔 / 多层战略栈（自动生成等宽分层栈/阶梯卡片切换版式）",
        "layers": [
          { "level": "L1 愿景层", "title": "统一智能决策门户", "detail": "面向业务与高管的一站式洞察中心", "badge": "核心目标" },
          { "level": "L2 能力层", "title": "确定性组件中台", "detail": "沉淀现代 UI 组件与无损导出引擎" },
          { "level": "L3 底座层", "title": "多源资产与知识库", "detail": "打通文档、表格、图片与历史沉淀" }
        ]
      },
      "gantt": {
        "title": "多泳道现代甘特排期（自动生成阶段看板列 Kanban / 紧凑甘特表切换版式）",
        "columns": ["1月", "2月", "3月", "4月", "5月", "6月"],
        "lanes": [
          { "name": "引擎组", "task": "多版式内核升级", "start": 1, "end": 3, "status": "done", "owner": "核心架构" },
          { "name": "设计组", "task": "现代 UI 组件体系", "start": 2, "end": 5, "status": "active", "owner": "体验团队" }
        ]
      },
      "quotes": {
        "title": "金句证言与负责人角色卡（自动生成金句聚光灯/人物条带切换版式）",
        "items": [
          { "quote": "一句真实的客户反馈或高管定调金句", "author": "张明", "role": "区域负责人", "tag": "效率提升 8×", "highlight": true }
        ]
      },
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
        "rows": [["区域一", "120", "45%"]],
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
        { "id": "IMG-01", "focal": "50% 30%", "caption": "图注说明（或直接写短ID字符串 \"IMG-01\"）" }
      ]
    },
    {
      "id": "p_end",
      "role": "closing",
      "eyebrow": "2027 展望 · 致谢",
      "name": "持续深耕 · 感谢各位领导审阅",
      "keyLine": "2027 聚焦三条增长曲线与标准化工具复制，冲刺全年新目标",
      "data": [{ "label": "目标增长", "value": "+30", "unit": "%" }],
      "items": [
        { "title": "抓手一", "detail": "下一阶段核心承诺与节点计划" }
      ],
      "note": "汇报人 · 2026 年终汇报 · Q&A"
    }
  ]
}
```

### 字段要点（避免踩坑）

1. **按真实信息关系选模块，拒绝千篇一律（严禁连续 3 页以上只写 `data + items`）**：
   - 优先响应 `material-brief.md` 顶部的 `🧩 自动识别的信息关系信号`，将真实内容直接映射为原生语义模块：
     | 材料信息关系 | 对应 `outline.json` 字段 | 引擎自动生成的 4 套切换形态 |
     | :--- | :--- | :--- |
     | 实际 vs 目标 / 周期趋势 | `data[].target` / `delta` / `trend` | 自适应 KPI 卡 / Bento 网格 / 迷你折线 |
     | 多项百分比达成率 | `gauges` | 丝滑圆环仪表 / 刻度表盘 / 左环右数 |
     | 同比 / 环比双柱对比 | `barChart` | 分组柱状图 / 堆叠柱图 / 横向条形 |
     | 多周期平滑趋势曲线 | `lineChart` | 多序列折线 / 柔光面积图 / 柱折结合 |
     | 大区 / 渠道 TOP 排行 | `rankList` | 排行进度条 / TOP3 领奖台 / 双栏排行卡 |
     | 高管一页纸核心摘要 | `execBrief` | 左主右四格 Bento / 通栏主视觉 / 极简白底 |
     | 构成 / 占比 / 预算拆解 | `breakdown` | 分段占比条 / 横条排行 / 主次网格 |
     | 多级递减转化路径 | `funnel` | 居中漏斗 / 横向步骤卡 / 阶梯进度 |
     | 连续多周期达标与预警 | `tracker` | Tremor 色块追踪 / 柱状追踪 / 网格矩阵 |
     | 优先级 / 战略定位四象限 | `matrix` | 坐标系四象限 / 四格 Bento / 焦点放大 |
     | 问题 → 归因 → 解法复盘 | `diagnosis` | 三联箭头诊断 / 解法聚光灯 / 条带递进 |
     | 多方案 / 竞品能力对比 | `featureMatrix` | SaaS 勾选对比表 / 方案分栏卡 / 紧凑表 |
     | 前后 / 新旧对比 | `compare` | SaaS 虚实对比 / 双顶栏对比 / 数值跃迁 |
     | 多源输入→中枢→多端输出 | `hub` | 左右中心汇聚 / 上下分层流水 |
     | 愿景→能力→底座战略分层 | `pyramid` | 居中金字塔 / 等宽分层栈 / 阶梯卡片 |
     | 增长飞轮 / 生态正循环 | `orbit` | 环形增长飞轮 / 闭环卡片流 / 中枢 Bento |
     | 水面表象 vs 深层根因 | `iceberg` | 冰山双层归因 / 深海强对比 / 左右显隐对照 |
     | 多维能力 / 成熟度评估 | `radar` | SVG 多边形雷达 / 能力评测条 / 多维得分卡 |
     | 跨团队并行排期 / 任务状态 | `gantt` | 多泳道甘特图 / 阶段看板列 Kanban / 紧凑表 |
     | 阶段里程碑推进 | `periods` | 三态水平步进 / 纵向时间轴 / 实色色带 |
     | 步骤链路 / 闭环回流 | `flows`（`returnTo: 1`） | 水印序号步骤卡 + 虚线回流飞轮 |
     | 一线证言 / 金句 / 负责人 | `quotes` | 证言头像卡 / 金句聚光灯 / 人物条带 |
     | 立项档案 / 属性键值 | `specCard` | 3×2 键值卡 / 焦点档案卡 / 双列属性表 |
     | OKR 目标与关键结果 | `okr` | 左目标右 KR 树 / 顶栏目标树 / 紧凑 OKR |
     | 风险分级与应对预案 | `risks` | 风险分级横条 / 风险卡片组 / 紧凑预案表 |
     | 业务×技术双轨路线图 | `dualTrack` | 上下双轨推进 / 阶段咬合列 / 紧凑双轨 |
     | 多维明细表 | `table`（或 `"TBL-01"`） | 斑马清淡表 + 原位占比条 |
   - 当全稿包含 ≥ 2 个 `role: "section"` 章节过渡页（或顶层配置 `sections: [...]`）时，引擎自动在每个正文页右上角渲染 **顶部章节分段导航条（Segmented Tabs）**，高亮当前所属章节。
   - `items` 与 `flows.steps` 的 `title` **不要手写 `01`/`1.` 等序号**，引擎会自动渲染序号圆标或编号。
   - **右侧「当前页版式 · 一键切换」全自动生成**：引擎会为每一页自动基于真实数据算出 3–4 套零内容丢失、零溢出的高精切换版式，无需人工二次排版。
2. **封面、章节过渡页与收尾页按需使用（页数严格由大纲决定，引擎不自动拆页）**：
   - `role: "cover"`：多页独立汇报第 1 页（支持 `1–4` 项核心 `data` 指标）；单页汇总或插入页可不加封面。
   - `role: "section"`：适合 8 页以上多板块长篇汇报的章节过渡页（聚焦 `part`/`eyebrow` 章节号、章节大标题、一句话导引与右侧 `items` 本章议题导航卡；**禁止在章节过渡页提前堆放 `data` 数据块**，把具体数字留给后续正文页，并自动生成「极简白底 / Bento导览 / 深色旗舰」切换版式）。
   - `role: "closing"`：收尾总结与致谢页，与封面视觉首尾呼应（支持核心收官 `data`、下阶段承诺 `items`、`photos[0]` 与底部署名 `note`，同样自带 4 套切换版式）。
3. **绝对忠于事实**：绝不编造材料里没有的数字或案例；标题中提到的数字必须在本页模块中真实出现。单页已有清晰导语、数据、动作和图带时保持克制，不硬塞冗余条块导致拥挤。
4. **照片选图、截图/海报完整装框与防裁切**：
   - 直接用 `"IMG-XX"` 引用：`ingest` 自动将后台/看板/表格截图标记为 `[截图]`（`kind: "screenshot"`），将海报/战报/超长竖图标记为 `[海报/长图]`（`kind: "poster"`）。组版引擎与 PPTX 导出会自动为截图（桌面横屏截图带精致窗口顶栏）与海报启用 `contain` **原比例完整装框**，边缘文字与坐标轴**零裁切**，无需手算 `crop`；也可手动指定 `"fit": "contain"` 或 `"fit": "cover"` 覆盖。
   - 普通实景照自动 `cover` 铺满，竖图自动预设 `"focal": "50% 25%"` 防切头；注意区分 `[历史]` 标记的旧图，勿误当本期现场照；显式设置 `"crop": [x, y, w, h]` 时按裁框裁切。
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
