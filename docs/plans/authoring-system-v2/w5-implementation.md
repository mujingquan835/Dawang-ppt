# W5 实施记录：条件分支模块（capacityBranch）、样稿 B 四页验证与技能文档同步

## 1. 背景与目标

依据 [roadmap.md](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/docs/plans/authoring-system-v2/roadmap.md) 与 [validation.md](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/docs/plans/authoring-system-v2/validation.md) 的 `W5` 要求：

1. **条件分支与返回回路模块（`capacityBranch`）**：支持主干顺序步骤、条件分支（如 `资料完整` vs `资料不完整`）、异常分支卡片、L 形返回回路箭头（如 `补齐后重新提交核对`）及可选通过路径摘要卡片（`passSummary`），并将所有节点与有向边（含返回边 `edgeId`）完整绑定到 `contentPlan` 关系上。
2. **样稿 B（`examples/showcase/material.md` 公开合成示例）完整四页验证**：
   - 先从 `examples/showcase/material.md` 建立独立 `content-baseline.json`（含 `sourceLocations`）；
   - B1（状态结论与组成）：清晰呈现 `34 = 27 + 7` 组成关系、待确认非失败定性与无历史基线边界；
   - B2（记录解释）：采用无外框开放双栏（`openGroup: true`）区分 27 项已完成与 7 项待确认判定口径，不与 B1 机械同构，不编造部门分组或转化率；
   - B3（拟定处理流程）：调用 `capacityBranch` 同时呈现正常路径（`01 提交交接 → 02 核对资料 → 03 确认接收 → 04 开始执行`）与缺资料返回补充路径（`02 核对资料 → 返回补充资料 → 重新提交核对`），突出“接收人未确认前不能把状态当作已开始执行”；
   - B4（下一步试点）：呈现一周三阶段拟定计划（第1—2天、第3—5天、第6—7天）与三项观察内容（资料是否完整、是否有人确认接收、卡在哪一步），保持拟定状态且不预设效率提升；
   - 保留全稿“公开合成示例”限定，逐页渲染 PNG 并通过真实看图复核。
3. **跨主题重测验证（`V08`）与技能文档同步**：验证同一套内容与关系计划在衬线标题主题与黑体无衬线主题下重测均保持 `fits` 与齐边关系，并同步更新 `SKILL.md`、`references/authoring-api.md` 与 `references/capacity-modules.md`。

---

## 2. 核心代码与样稿变更

### 2.1 `capacityBranch(spec)` 与 `panelGroup` 优化
- **文件**：[capacity-kit.mjs](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/capacity-kit.mjs)
- **能力**：
  - `capacityBranch(spec)`：
    - 测量并排布主干步骤 `steps`（圆形编号节点、标题、说明）与正向连接边（支持在分支点自动挂载 `passCondition` 条件徽标）；
    - 从指定步骤 `branch.from` 向下引出异常分支箭头與 `failCondition` 条件徽标，生成带左强调条的异常分支卡片；
    - 从异常分支卡片左侧生成 L 形折线返回箭头（`return-path` + `return-head` + `return-label`）指回 `branch.returnTo` 步骤底部；
    - 支持可选 `branch.passSummary` 在主干后半段下方生成对齐的通过路径说明卡，消除区域右下角大块留白；
    - 自动输出所有节点引用与 5 条有向边（`e1`、`e-pass`、`e3`、`e-fail`、`e-return`）的 `edgeId` 绑定，删掉返回边会被 `reviewPagePlan` 检出 `relation-edge-unbound`。
  - `panelGroup(spec)`：
    - 当并列面板中仅部分面板设置 `summary`（且未显式指定 `alignBodyTop: true`）时，无 `summary` 的面板内容区紧贴面板标题下方开始排布并分配行距，避免无摘要面板顶部出现空白断层。

### 2.2 样稿 B 四页完整生成与真实看图复核
- **目录**：`output/showcase-pilot-v2/`
  - 生成脚本：[build-showcase.jsx](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/build-showcase.jsx)
  - 独立原稿基线：[content-baseline.json](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/content-baseline.json)
  - 工程 JSON：[deck-project.json](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/deck-project.json)
  - 离线可编辑 HTML：[跨团队交接试点-四页合成样稿.html](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/%E8%B7%A8%E5%9B%A2%E9%98%9F%E4%BA%A4%E6%8E%A5%E8%AF%95%E7%82%B9-%E5%9B%9B%E9%A1%B5%E5%90%88%E6%88%90%E6%A0%B7%E7%A8%BF.html)
  - 逐页复核截图：[01.png](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/01.png)、[02.png](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/02.png)、[03.png](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/03.png)、[04.png](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/output/showcase-pilot-v2/screens/04.png)
- **检查结果**：
  - `validateContentBaseline`：0 issues
  - `reviewPagePlan`：0 issues
  - `reviewVisualDecisions`：0 issues, 0 warnings
  - 浏览器 `measureProject`：4 页全部 `issues: []`, `warnings: []`

### 2.3 技能文档同步
- 更新 [SKILL.md](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/SKILL.md)、[authoring-api.md](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/references/authoring-api.md)、[capacity-modules.md](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/references/capacity-modules.md)，完整记录 `W1—W5` 契约、模块与分级复核说明。

---

## 3. 测试验证

在 [composition-contracts.test.mjs](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/tests/fusion/composition-contracts.test.mjs) 中新增：
- `V06: capacityBranch binds forward, fail and return edges and catches missing return edge`
- `V08: cross-theme re-measurement preserves regional alignment and capacity across serif and sans-serif themes`

全量回归测试（10 个测试文件共 85 项测试）全部通过（85 pass / 0 fail）。
