# Dawang-PPT 技能开发与龙湖双11方案重做 · Claude 接手文档 (Handoff Guide)

> **生成时间**：2026-11-08  
> **开发仓库**：`/Users/meimaodawang/Documents/Dawang-ppt-w1-w2`  
> **当前分支**：`codex/content-page-contracts`  
> **状态**：P0 技能能力补齐、36 项契约与浏览器实测单测、P3/P5 设计样张、以及 **5 页龙湖双11直播方案完整重做稿** 均已完成并通过零错误/零警告验证。

---

## 一、核心红线与仓库纪律（必读）

接手任何后续迭代前，必须严格遵守 [`/Users/meimaodawang/Documents/Dawang-ppt-w1-w2/AGENTS.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/AGENTS.md) 中的开发铁律：

1. **正确的工作流顺序**：
   - 必须遵循：**“理解原稿 → 确定重点与关系 → 逐页设计 → 技能实现 → 视觉复核”**。
   - **严禁**跳过逐页设计直接跑脚本出图；**严禁**从已排好的 `slide.elements` 反向生成 `content-baseline.json`。
2. **独立内容基线先行 (`source-baseline-v1`)**：
   - 必须先从用户原始材料（如 Markdown 原稿）独立提取 `content-baseline.json`（包含完整 `nodes`、`relations`、`gaps`、`dispositions` 及精确到行号的 `sourceLocations`），落盘后再进入排版。
   - 原稿中的待核实数据（如无出处的行业引用、估算值）必须标记为 `status: 'user-provided-unverified'`；缺失素材（如 C 主播照片、未提供的流程图）必须在 `gaps` 与 `dispositions` 中显式声明，不得静默删除或伪造。
3. **禁止用自动化检测代替肉眼看图**：
   - 每次生成或修改页面后，除了通过 `validateProject`、`reviewPagePlan`、`validateVisualAuthoredProject` 和浏览器 `measureProject` 外，**必须直接查看渲染出的 PNG 截图**（`screens/01.png`—`05.png`），检查字号层级、裁切、引线、留白和视觉主次。
4. **隔离与安全边界**：
   - 未经用户明确指令，**不要**合并到 `main` 分支，**不要**替换日常技能安装目录（`~/.codex/skills/dawang-ppt` 或 `~/.gemini/config/skills/dawang-ppt`），**不要**覆盖历史对照产物（`output/longhu-candidate/*`、`output/longhu-design-first/*`）。

---

## 二、架构总览与五大契约体系

当前系统在 `skills/dawang-ppt/project/src/fusion/` 下通过五层契约保障制作质量：

| 契约字段 | 当前版本值 | 核心验证器文件 | 职责说明 |
| :--- | :--- | :--- | :--- |
| `visualContract` | `visual-decisions-v2` | [`visual-contract.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/visual-contract.mjs) | 校验每页 `readerTask`、`keyLine`、`visualDecision`（焦点、版式、分区）与 `layout-lint` / `composition-lint` |
| `semanticContract` | `content-relations-v1` | [`content-plan.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/content-plan.mjs) | 校验内容节点 (`nodes`)、关系 (`sequence` / `cycle` / `assignment` / `comparison` / `composition`)、缺口 (`gaps`) 与处置 (`dispositions`) |
| `pageDesignContract` | `page-design-v1` | [`page-plan.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/page-plan.mjs) | 校验每页 `requiredRefs` 全覆盖、区域 (`regions`) 内部元素绑定 (`bindings`)、关系边 (`edgeId`) 与行 (`rowId`) 的真实可见性 |
| `contentBaselineContract` | `source-baseline-v1` | [`content-baseline.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/content-baseline.mjs) | 校验 `contentPlan` 与排版前独立落盘的 `content-baseline.json` 一致，防止排版阶段悄悄删改原稿信息或篡改关系 |
| `compositionContract` | `regional-composition-v1` | [`composition-contract.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/composition-contract.mjs) | 校验跨区域顶/底/左/右齐边 (`alignments` 容差 `≤ 1.5px`)、区域间距 (`gaps`)、内边距 (`padding`)、主次层级 (`hierarchy`) 及 8 级字号体系真实验证 |

---

## 三、本轮已完成的技能代码改动清单

### 1. 统一 8 级字号层级与数字+单位同基线工具
- **文件**：[`skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs)
- **新增能力**：
  - `theme.roles` 固定全稿 8 级字号角色：
    1. `pageTitle`: `52px`（粗体，`headingFamily` 宋体标题字体）
    2. `heroMetric`: `80px`（粗体，核心目标/主摘要数字，`lineHeight: 1.3`）
    3. `metricUnit`: `26px`（字重 500，与大数字同色同基线单位）
    4. `sectionTitle`: `30px`（粗体，栏标题/节点主名）
    5. `keyNumber`: `34px`（粗体，列表重点金额/步骤序号/时限强调）
    6. `body`: `26px`（常规正文）
    7. `tableBody`: `24px`（表格正文与紧凑说明）
    8. `caption`: `20px`（表头、角标、底部出处与口径说明）
  - `theme.roleStyle(role, extra)`：按角色名生成标准文本样式。
  - `theme.metricRuns(value, unit, opts)`：生成同文本框 `runs`，确保 `80px` 数值与 `26px` 单位同色同基线，彻底告别手工硬编码 `x` 偏移导致的重叠或脱节。

### 2. 区域组合契约扩展（字号元素级真校验 + 开放文字分组对齐）
- **文件**：[`skills/dawang-ppt/project/src/fusion/authoring/composition-contract.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/composition-contract.mjs)
- **新增能力**：
  - 当页面声明 `typographyRoles` 或区域声明 `typography.strict = true` 时，自动遍历该区域所有绑定的文本元素（含 `runs`），校验其实测 `fontSize` 是否在允许字号集合内，违规抛出 `region-typography-mismatch`。
  - 支持无背景框的开放文字分组（如 P4 上半部左右两栏）：区域声明 `openGroup: true` 或 `anchorElementIds` 时，`alignments` 与 `gaps` 自动基于绑定元素的包络矩形 (`envelopeOf`) 计算顶/底/左/右齐边，无需为了通过校验而强套浅色背景大框。

### 3. 容量测量模块库扩展 (`capacity-kit.mjs`)
- **文件**：[`skills/dawang-ppt/project/src/fusion/authoring/capacity-kit.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/capacity-kit.mjs)
- **新增与增强模块**：
  1. `capacityCycle(spec)`（**新增，解决 P3 真环形闭环**）：
     - 渲染中心时长/主指标 (`center: { value, unit, label, ref }`)、3–6 个顺时针圆周节点（默认起点①用金色 `#B58A42` 突出，其余用深蓝 `#23338B`）、圆周 SVG `vector` 顺时针弧线与切向箭头（④→① 返场弧默认金色高亮）、短引线 (`leader`)、外侧实测标题与说明、以及底部图例说明 (`note`)。
     - 自动输出全部节点与闭合边 (`edgeId: 'e1'..'e4'`) 的 `bindings`，并与 `measureModule` 实测容量集成。
  2. `allocationList(spec)`（**新增，解决 P5 预算比例条与主次渠道分层**）：
     - 顶部渲染按 `shares` 宽度比例切分的彩色比例条（如 `60:25:15`），下方渲染渠道行卡片。
     - 支持 `highlight: true` 主投入行（浅金底 `#F7F0E3` + 左侧 `6px` 金色竖条 + 金色底白字占比徽标 `28px` 粗体），金额采用 `34px` `keyNumber` 与 `20px` 单位同基线 `runs`，支持 `distributeRows` 纵向均分。
  3. `panelGroup(spec)`（**增强，解决 P5 非等宽双栏与大数摘要**）：
     - 新增 `shares` 参数（如 `[0.44, 0.56]` 或 `[0.48, 0.52]`）支持非等宽分栏并保持顶底严丝合缝齐边。
     - `panel.summary` 支持结构化 `{ value, unit }`，自动调用 `theme.metricRuns` 生成 `80px` 数值 + `26px` 同基线单位。
  4. `capacityTable(spec)`（**增强，解决 P2/P5 表格重点行高亮**）：
     - 支持行级 `highlight: true` / `tone: 'primary'`（浅金底 `#F7F0E3` + 首列及数值列加粗深蓝）与 `tone: 'secondary'`（次重点行加粗深蓝）。
     - 当任意行开启高亮时，自动对首列应用统一内缩 `inset0 = 12px`，保证高亮底色条不越界且各行左边缘 `0px` 对齐（零 `near-misaligned` 警告）。
  5. `capacityFlow(spec)` 与 `roleGroup(spec)`（**增强，解决 P1 阶段高亮与 P2 C主播占位**）：
     - `capacityFlow` 支持单步自定义 `nodeFill`、`nodeColor`、`titleColor`（如 P1 突出中间“直播爆发日”）。
     - `roleGroup` 支持 `placeholderBadge`（如 `'C'` + 双行 `'形象\n待补'`），生成与 A/B 照片框同尺寸的设计感占位卡。

---

## 四、目录结构与交付物路径导航

### 1. 龙湖双11方案 · 五页完整重做稿（最新正式产物）
目录：[`/Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2)
- **可离线编辑与导出的最终 HTML**：  
  [`龙湖天街双11直播方案-五页完整重做稿.html`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/龙湖天街双11直播方案-五页完整重做稿.html)
- **排版前独立提取的五页内容基线**：  
  [`content-baseline.json`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/content-baseline.json)
- **完整构建与验证脚本**：  
  [`build-full.jsx`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/build-full.jsx)
- **五页契约与浏览器 QA 报告（0 issues, 0 warnings）**：  
  [`qa.json`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/qa.json)
- **五页高清渲染截图（已逐张视觉复核）**：
  - P1：[`screens/01.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/screens/01.png)
  - P2：[`screens/02.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/screens/02.png)
  - P3：[`screens/03.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/screens/03.png)
  - P4：[`screens/04.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/screens/04.png)
  - P5：[`screens/05.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/screens/05.png)

### 2. 样稿 B（跨团队交接试点 · 四页公开合成示例重做稿，W5）
目录：[`/Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2)
- **最终可离线编辑与导出的单文件 HTML**：  
  [`跨团队交接试点-四页合成样稿.html`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/%E8%B7%A8%E5%9B%A2%E9%98%9F%E4%BA%A4%E6%8E%A5%E8%AF%95%E7%82%B9-%E5%9B%9B%E9%A1%B5%E5%90%88%E6%88%90%E6%A0%B7%E7%A8%BF.html)
- **排版前独立提取的四页内容基线**：  
  [`content-baseline.json`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/content-baseline.json)
- **完整构建与验证脚本（含 `capacityBranch` 条件分支与返回回路）**：  
  [`build-showcase.jsx`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/build-showcase.jsx)
- **四页契约与浏览器 QA 报告（0 issues, 0 warnings）**：  
  [`qa.json`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/qa.json)
- **四页高清渲染截图（已逐张视觉复核）**：
  - B1：[`screens/01.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/01.png)
  - B2：[`screens/02.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/02.png)
  - B3：[`screens/03.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/03.png)
  - B4：[`screens/04.png`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/04.png)

### 3. P3 与 P5 专项设计样张
目录：[`/Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-p3-p5-samples/`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-p3-p5-samples)
- [`龙湖方案-P3与P5样张预览.html`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-p3-p5-samples/龙湖方案-P3与P5样张预览.html)
- [`build-samples.jsx`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-p3-p5-samples/build-samples.jsx)

### 4. 设计文档与实施记录（W1—W5）
- 逐页设计基准：[`output/longhu-design-first/龙湖方案-逐页设计与能力对照.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-design-first/龙湖方案-逐页设计与能力对照.md)
- W1–W3 实现记录：[`docs/plans/authoring-system-v2/w1-w3-composition-implementation.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/docs/plans/authoring-system-v2/w1-w3-composition-implementation.md)
- W4 三类复核与局部失效实现记录：[`docs/plans/authoring-system-v2/w4-implementation.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/docs/plans/authoring-system-v2/w4-implementation.md)
- W5 条件分支模块与样稿 B 实现记录：[`docs/plans/authoring-system-v2/w5-implementation.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/docs/plans/authoring-system-v2/w5-implementation.md)
- 模块与契约文档：
  - [`skills/dawang-ppt/SKILL.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/SKILL.md)
  - [`skills/dawang-ppt/references/authoring-api.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/references/authoring-api.md)
  - [`skills/dawang-ppt/references/capacity-modules.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/references/capacity-modules.md)
  - [`skills/dawang-ppt/references/composition-contracts.md`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/references/composition-contracts.md)

---

## 五、常用验证与构建命令

在 `/Users/meimaodawang/Documents/Dawang-ppt-w1-w2` 根目录下执行：

```bash
# 1. 运行全部 Fusion 契约、容量模块、内容基线与浏览器实测单元测试（共 36 项测试）
node --test \
  tests/fusion/composition-contracts.test.mjs \
  tests/fusion/capacity-kit.test.mjs \
  tests/fusion/content-page-contracts.test.mjs \
  tests/fusion/capacity-browser.test.mjs \
  tests/fusion/semantic-portable.test.mjs

# 2. 重新构建并验证 P3/P5 专项样张
skills/dawang-ppt/project/node_modules/.bin/tsx output/longhu-p3-p5-samples/build-samples.jsx

# 3. 重新构建并验证 5 页龙湖完整重做稿（含 Playwright 浏览器测量与截图导出）
skills/dawang-ppt/project/node_modules/.bin/tsx output/longhu-full-v2/build-full.jsx
```

---

## 六、关键踩坑经验与避坑指南（供 Claude 后续开发参考）

1. **80px 超大数字的 `lineHeight` 与 `text-overflow`**：
   - PingFang SC 在 `80px` 字号下，若 `lineHeight < 1.25`，浏览器实测 `scrollHeight` 会比 `clientHeight` 大 4–8px，触发 `measureProject` 的 `text-overflow`。`theme.roles.heroMetric` 已统一设为 `lineHeight: 1.3`，请保持该设置。
2. **金色徽标 (`#B58A42`) 上的白字对比度 (`low-contrast-small-text`)**：
   - `#FFFFFF` 在 `#B58A42` 上的 WCAG 对比度为 `3.14:1`。`measure.mjs` 对小字号要求 `>= 4.5:1`，对大字号（`fontSize >= 36` 或 `fontWeight >= 600 && fontSize >= 28`）要求 `>= 3.0:1`。因此金色徽标上的白字（如 `60%`、节点序号 `1`）字号必须保持 `>= 28px` 且 `fontWeight >= 700`。
3. **跨区域关系绑定 (`binding-outside-zone` & `relation-member-unbound`)**：
   - `reviewPagePlan` 要求：某区域 (`region`) 声明的 `relationRefs`，其所有 `members` 都必须绑定在该区域内部的元素上。如果左右两个面板（如 P2 的左侧主播角色与右侧三场排期）属于不同 `zoneId`，请分别为左栏声明 `p2:role-group`、为右栏声明 `p2:schedule-assignment`，不要把左栏的 DOM 元素 ID 塞进右栏的 `bindings` 中。
4. **开放文字分组 (`openGroup: true`) 的齐边计算**：
   - 开放文字分组没有背景 `frameElementId`，`reviewComposition` 会取该区域所有绑定元素的包络矩形 (`envelopeOf`) 来校验 `alignments`。因此，若声明了 `left: ['invite', 'sop']`，请确保 `invite` 内部最左元素的 `x` 与下部 `sop` 面板的 `x` 完全一致（误差 `≤ 1.5px`），并将开放分组的 `padding` 设为 `0`。

---

## 七、后续可继续推进的方向（待用户指令）

1. **导出与交付扩展**：如用户需要将 [`龙湖天街双11直播方案-五页完整重做稿.html`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/longhu-full-v2/龙湖天街双11直播方案-五页完整重做稿.html) 导出为 PDF 或可编辑 PPTX，可在浏览器中打开该 HTML 点击工作台右上角导出按钮，或按需调用导出工具链。
2. **更多版式模块沉淀**：如后续遇到新的多页方案，可参照 P4 的开放编号分组模式，决定是否将 `openNumberedGroup` 进一步封装入 `capacity-kit.mjs`。
3. **分支合并与技能安装同步**：仅当用户明确验收通过并下达“合并到 `main`”或“更新日常技能安装”指令后，再执行分支合并与技能同步。
