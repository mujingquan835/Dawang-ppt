# W1—W3 第二轮开发记录（2026-11-05）

用户授权顺序：独立内容基线 → 区域与构图约束 → 组合布局。仅隔离候选分支，不切换日常安装。

## 已实现

- W1：source-baseline-v1，排版前独立 snapshot，逐节点/关系具体来源位置与摘录；工程内自动比对、外部 baseline CLI 比对。内容删除、关系修改、基线替换分别报差异。保留原有 required/optional、事实角色和用户决定校验。
- W2：regional-composition-v1，真实区域的层级、模块/变体、文字层级、设计依据、内边距；公共边界和最小区域间隔检查。外边对齐必须关联真实形状，边界与区域不一致会报错。声明加入独立复核数据包。
- W3：panelGroup，等宽多栏面板、统一标题带、可选摘要带、共同正文起点与底边；表格可平均增加 padding 填充剩余高度。内容不足时整体面板组织留白，内容超量时传递容量失败，不缩字、不删字。支持主播/排期、预算/预估组合。
- 数值边界使用 1e-6 像素容差，消除分数 padding 的浮点误报；不是放宽可见溢出。
- 候选 SKILL 写入生产顺序与外部基线检查；旧工程仍显式 opt-in，旧 API 行为保持。

## 验证

- 新增六项契约/浏览器文字实测测试；覆盖来源不足、内容漂移、外部基线替换、虚拟边界、区域错位、三行对六行共同收口、容量不足及生产验证入口。
- 扩展现有容量浏览器回归，新增摘要明细及主播排期组合页面；检查四页渲染、离线 HTML 保存与重开。合成素材，不包含用户业务文件。
- 原内容契约、模块容量、布局工具、汇报页型、视觉决策、语义 HTML 保存与生成发布回归。
- 视觉截图仅验证合成案例的边界/层级，不等于龙湖重做稿或用户美感验收。

本轮相关测试共 67 项通过（32 项内容/容量/组合与浏览器测试，35 项布局、页型、视觉决策、语义保存和 HTML 生产回归）；后续局部修改的相关测试已重跑通过。新增组合截图已查看，四页浏览器 QA 与离线重开通过。

## 明确边界

- 独立基线不是来源真实性证明。必须先读完整材料；若把错误内容写进基线，仍需人工内容审核。外部文件须版本保留，不能与成稿同时重新生成。
- W2 只自动检查已表达的几何约束；标题实际视觉基线、文字美感、参考案例质量由看图与独立复核判断。
- 当前组合等宽，循环自动布线、不等宽和自动拆页未实现。不应宣称完整 W3 视觉能力已验收。
- 尚未重做龙湖业务稿，不改旧测试 HTML；未合主分支、未发布、未修改日常安装。

---

## 2026-11-08 P0 视觉与构图能力补齐及龙湖五页重做验证

按“理解原稿 → 确定重点与关系 → 逐页设计 → 技能实现 → 视觉复核”顺序，补齐此前未实现的循环构图、非等宽组合、数值主次强调与 8 级字号真校验：

1. **8 级字号角色与同基线数值+单位 (`layout-kit.mjs` & `composition-contract.mjs`)**：
   - `createTheme` 新增 `roles`（`pageTitle` 52px、`heroMetric` 80px、`metricUnit` 26px、`sectionTitle` 30px、`keyNumber` 34px、`body` 26px、`tableBody` 24px、`caption` 20px）、`roleStyle(role, extra)` 与 `metricRuns(value, unit, opts)`，标题字号自动带入 `headingFamily`。
   - `reviewComposition` 对声明 `typographyRoles` 或 `typography.strict = true` 的区域遍历绑定文本元素与 `runs`，实测校验字号是否匹配声明集合（违规报 `region-typography-mismatch`）。
   - `reviewComposition` 新增 `openGroup: true` / `anchorElementIds` 支持，对无背景大框的开放文字分组基于绑定元素包络 (`envelopeOf`) 校验跨区齐边。
2. **真环形闭环、比例分配与非等宽面板 (`capacity-kit.mjs`)**：
   - 新增 `capacityCycle(spec)`：中心时长/主指标、顺时针圆周节点（默认起点①与④→①返场弧金色 `#B58A42`）、圆周 SVG `vector` 弧线与切向箭头、短引线、外侧实测标签及闭合关系边绑定 (`edgeId`)。
   - 新增 `allocationList(spec)`：顶部按 `shares` 切分比例色带（如 `60:25:15`），下方渠道卡片支持主投入行浅金底 `#F7F0E3` + 金色竖条 + `28px` 粗体占比徽标，金额与单位同基线。
   - 增强 `panelGroup(spec)`：支持非等宽 `shares`（如 `[0.44, 0.56]`）与结构化 `summary: { value, unit }`（80px 数值 + 26px 单位同基线）。
   - 增强 `capacityTable(spec)`、`capacityFlow(spec)`、`roleGroup(spec)`：支持表格重点行 (`highlight: true` / `tone: 'primary'`) 与次重点行 (`tone: 'secondary'`) 及首列统一内缩对齐；支持流程单步节点配色高亮；支持角色缺失照片时的 `placeholderBadge`（如 `'C'` + 双行 `'形象\n待补'`）同尺寸设计占位。
3. **验证与本机样稿**：
   - 新增契约与浏览器实测单测全部通过（`composition-contracts.test.mjs`、`capacity-kit.test.mjs`、`content-page-contracts.test.mjs`、`capacity-browser.test.mjs`、`semantic-portable.test.mjs` 共 36 项通过）。
   - 先完成 P3/P5 专项样张（本机 `output/longhu-p3-p5-samples/`）获用户确认，随后基于排版前独立提取的 5 页 `content-baseline.json` 完成龙湖双11五页完整重做稿（本机 `output/longhu-full-v2/`），契约、视觉 lint 与浏览器 `measureProject` 均为 0 错误、0 警告，并完成 5 张渲染截图肉眼复核。
