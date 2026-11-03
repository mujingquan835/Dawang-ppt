# 排版系统改进方案（2026-11-03）

## 背景

同一份 4 页材料（一人多线市场汇报）分别用三种方式制作并对比：

| 方式 | 构图来源 | 结果 |
|---|---|---|
| dashi 模板 | 锁定模板填内容 | 统一稳定；4 页拆成 7 页，留白多，一张图放不下 |
| Dawang（Codex） | 完全自由坐标，模型脚本批量生成 | 每页同一结构；说明与节点错位、照片大小不一、数字与单位分离 |
| PPT Master | 自由坐标，但逐页先定网格与分区 | 第 2、3 页明显最好 |

结论：问题集中在“怎么排版”。Dawang 给了最大自由，却没有网格、页型和对齐工具；模型只能手算坐标，退回最省事的结构。现有检查证明“规则有记录”，不衡量“排得好不好”，复核意见抽象，修改停留在措辞与间距。

## 目标

1. 模型不手算对齐：数字与单位、流程节点与说明、同行图片由工具保证成组与对齐。
2. 有可选的成熟页型可以起步，又不锁死成模板。
3. 程序能指出客观的几何缺陷，而不只是规则记录。
4. 流程负担与耗时下降，模型的注意力回到构图。
5. 每次改动都能用固定样本对比，防止越改越差。

## 方案总览

| 层 | 内容 | 阶段 |
|---|---|---|
| ① 排版工具 `layout-kit` | 网格、指标组、流程、编号列表、图片网格、表格、面板、文字高度估算、图片原始尺寸读取 | 第一阶段 |
| ② 页型 `patterns` | 页头 + 5 种页型：表格加流程带、主指标加证据图、编号资源加照片网格、表格加侧栏应用链、双泳道流程 | 第一阶段 |
| ③ 线框先行 | `visualDecision.layout` 升级为分区列表，先渲染线框再填元素，程序检查元素落区、分区重叠与网格对齐 | 第二阶段 |
| ④ 几何检查 `layout-lint` | 同行图片不等高、数字与单位分离、左边缘差 2–10px 的近似对齐、小图被放大 | 第一阶段 |
| ⑤ 流程瘦身 | 规则清单压缩到每场景 6–8 条关键要点；复核只做最后一次，用更快模型，判断标准改为对齐、层级、图片尺寸等可执行的视觉标准 | 第二阶段 |
| ⑥ 固定样本回归 | 每次改动用同一份样本重做，与参考版逐页对比截图 | 第一阶段起执行 |

## 第一阶段设计

### ① 排版工具（`project/src/fusion/authoring/layout-kit.mjs`）

全部是纯函数，输入内容与位置，输出 authored 元素数组和占用高度；不选内容、不改样式体系。

- `createTheme({palette, fontFamily})`：统一 ink / accent / muted / line / pale / bg 与字体，供其余工具使用。
- `createGrid({margin, columns, gutter})`：1920×1080 上的 12 栏网格，`span(start, count)` 返回 `[x, width]`。
- `estimateLines(text, fontSize, width)` / `textHeight(...)`：中文按 1 字宽、西文按 0.55 字宽估算，供堆叠排版计算下一个元素的位置。
- `metricGroup` / `metricRow`：数值与单位在同一文字元素的 runs 内，名称紧贴其下；并列指标等宽、同基线。
- `flow`：编号节点（圆形）、带箭头的连接线、标题和说明与节点左对齐，宽度均分。
- `numberedList`：编号方块 + 标题 + 说明，按估算高度依次排列。
- `imageGrid`：同行等高，宽度按原始比例分配；超过放大上限时缩小整行；图注与图片左对齐。
- `table`：列宽表头、行线、单元格，按行估算高度。
- `panel`：色面分区（不是描边小卡片）。
- `imageSize(file)`：读取 PNG / JPEG 原始尺寸，供 `imageGrid` 计算比例与放大倍数。

### ② 页型（`project/src/fusion/authoring/patterns.mjs`）

每个页型接收内容与主题，返回 `{elements, visualDecision}`：元素按网格排好，同时给出可直接写入 contentPlan 的视觉决定（重点元素与构图说明）。页型只是起点：模型可以调整参数、增删元素，或完全自行设计。

| 页型 | 适用 |
|---|---|
| `pageHeader` | 所有页：眉题、标题（可用 runs 标出重点）、副标题、页码、来源 |
| `tableWithFlows` | 分工表 + 下方一到两条流程 |
| `metricsWithEvidence` | 一到两个主指标 + 次级指标行 + 机制流程 + 右侧证据图 |
| `listWithPhotos` | 编号资源 + 结果指标 + 照片网格 |
| `tableWithPanel` | 明细表 + 深色侧栏（应用链、要点） |
| `twoLaneFlow` | 两条并列流程 + 结论 |

### ④ 几何检查（`project/src/fusion/qa/layout-lint.mjs`）

接入 `reviewVisualDecisions` 的 warnings 与 visualReview，不阻断发布：

- `image-row-uneven`：顶边对齐、水平相邻的图片高度相差超过 12px。
- `metric-unit-detached`：大号纯数字与紧随的短单位分成两个元素且间距过大。
- `near-misaligned`：上下相邻的文字左边缘相差 2–10px（看起来想对齐但没对齐）。
- `image-upscaled`：元素记录了原始尺寸（`naturalSize`）且显示尺寸超过原始尺寸 2 倍。

### ⑥ 固定样本

公开仓库只放合成示例（`examples/layout-patterns.mjs`），用测试保证每个页型无溢出、无重叠且通过新检查。真实业务样本留在本机，每次改动后用同一份重做并与参考版对比截图。

## 第二阶段设计（已实现）

### ③ 线框先行

- `visualDecision.zones:[{id, role, bounds}]`，role 取 focus / evidence / support / flow / data / note / media。新工程标记 `visual-decisions-v2` 时必填；v1 工程沿用原检查。
- 检查（新工程为错误）：缺 zones、区域无效（越出画布或 role 未知）、区域重叠超过较小区域的 1%、页头页脚以外的文字或图片（按中心点）不在任何区域内。
- 页型自动给出 zones。
- `wireframe <authored.json|工程目录> <输出目录>`：每页输出线框 SVG 与 PNG，区域为色块、文字为灰条、图片为叉框，用来在生成前判断分区与留白。

### ⑤ 流程瘦身

- 规则清单 v2（`rules-checklist-v2`）：每个规则章节一条记录，不再逐条。管理汇报从 25 条降到 6 条；章节可整体记为 applied，`how` 需覆盖章内要点。`rules:checklist` 按章节输出原文要点。v1 工程沿用逐条清单（`--items`）。
- 复核加入三条视觉标准：对齐、主次、图片。fail 必须写出页码与具体问题，模型可以照着改。
- 后续复核只重判上一轮 fail 的条目，通过项沿用（标记 `carried`）；清单变化或 `--full` 时全部重判。

### 兼容

- 契约标记决定检查版本：v1 工程（`visual-decisions-v1`、`rules-checklist-v1`、旧名 `kimi-checklist-v1`）照旧发布，不要求 zones，清单仍按条。
- 未在 Codex 实测：模型是否会主动画线框、按章节写清单，需要用固定样本验证。

## 验收

- 新增工具与页型有单元测试；全量测试通过；发布包检查通过。
- 用页型重做样本的第 2、3 页，与 PPT Master 版对比不低于其效果。
