# W4 三类验收、依赖失效范围与分级发布：实现记录

日期：2026-11-08。工作分支：`codex/content-page-contracts`；承接 `aecce87`。

## 已实现

| 模块 / 文件 | 行为变化 | 对应验收项 |
| :--- | :--- | :--- |
| [`qa/rules-review.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/qa/rules-review.mjs) | 1. 新增 `hasTieredReview(project)`（对启用 `page-design-v1` / `content-relations-v1` / `tiered-review-v1` 的工程生效，旧工程保持原逻辑）。<br>2. 新增 `classifyFinding(item, claim, project)`，将复核发现按 `content`（事实/口径/关系/返回边）、`render`（裁切/溢出/遮挡/变形）、`design`（阅读任务/结构/审美）三分类，并区分 `blocker`、`advisory`、`needs-verification` 三种严重度与返工路由 `suggestedAction`（`return-to-content-model` / `return-to-capacity-layout` / `return-to-page-design` / `local-polish-or-user-decision`）。<br>3. 满 3 轮（`MAX_REVIEW_ROUNDS`）后，未解决的 `blocker` 绝不自动转为放行警告，保持 `rules-review-blocker-unresolved` 与 `releaseStatus: 'needs-revision'`；仅 `advisory` 作为 `rules-review-advisory` 警告允许发布为 `ready`。 | V10, V11 |
| [`qa/rules-review.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/qa/rules-review.mjs) & [`authoring/independent-review.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/independent-review.mjs) | 1. 新增 `globalDependencyHash(project)` 与 `pageDependencyHash(project, slideId)`，写入 `rules-review.json`。<br>2. 新增 `inspectReviewScope(project, record)` 与增量 `previousRound(workspaceDir, project)`：单页修改（如换图、改角色名）仅使关联该页的声明 (`staleClaimIds`) 失效，未受影响页面的通过结论 (`reusableClaimIds`) 自动复用；全局字体/主题修改 (`globalChanged: true`) 触发全稿复核。 | V10 |
| [`project/patch.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/project/patch.mjs) | 1. 单页图片替换/裁切与单页样式修改收敛为 `checkScope: 'slides'`，返回精确的 `changedSlideIds` 与 `reusableSlideIds`。<br>2. 新增 `type: 'theme'` 全局主题/字体修改指令支持，触发 `checkScope: 'all'`。 | V10 |
| [`authoring/pipeline.mjs`](file:///Users/meimaodawang/Documents/Dawang-ppt-w1-w2/skills/dawang-ppt/project/src/fusion/authoring/pipeline.mjs) | 1. `publishHtml` / `makeHtml` 返回显式 `releaseStatus`（`ready` / `validating` / `needs-revision` / `review-draft`）。<br>2. 存在未解决阻断时绝不覆盖正式 `outFile`；支持传入 `reviewDraftFile` 单独输出 `review-draft` HTML 供用户审阅。 | V11 |

## 验证结果

- `tests/fusion/rules-review.test.mjs`、`tests/fusion/project-patch.test.mjs`、`tests/fusion/html-first-pipeline.test.mjs` 全部通过（含新增 `W4 V10` 局部换图/改名 vs 全局换字体失效范围测试、`W4 V11` 三分类与三轮阻断不放行测试、以及浏览器 `review-draft` 导出且保留原正式文件测试）。

## 可复现命令

```sh
node --test tests/fusion/rules-review.test.mjs tests/fusion/project-patch.test.mjs tests/fusion/html-first-pipeline.test.mjs
```
