# Dawang-PPT 深度复核与旧版完整流程（按需参考）

> 日常出稿默认走主文档 `SKILL.md` 中的三步极速链路（`ingest` → `fast:build --preview` → 单图校验）。
> 仅当用户明确要求**完整合规清单（`ruleChecklist`）、独立复核（`review:rules`）或基于旧 `authored.json` / `deck-project.json` 局部修订（`patch:project` / `publish:html`）**时，再按本文件执行。

## 1. 环境诊断与规则读取

- 环境检查：`node <skill>/scripts/dawang.mjs doctor`（确认 `ready: true` 与 `rules.status: "pinned"`）。
- 场景列表：`node <skill>/scripts/dawang.mjs rules:list`
- 规则读取：`node <skill>/scripts/dawang.mjs rules:read management-report`
- 规则清单骨架：`node <skill>/scripts/dawang.mjs rules:checklist management-report`

## 2. 事实基线与完整 `make` 流程

1. `node <skill>/scripts/dawang.mjs prepare <材料> <新目录> --scenario management-report`
2. `node <skill>/scripts/dawang.mjs outline:check <outline.json>`（检查关系缺口 `relationGaps` 与页型建议）
3. `node <skill>/scripts/dawang.mjs outline:baseline <outline.json> <新目录>`（生成 `content-baseline.json` 与 `authored-scaffold.json`）
4. `node <skill>/scripts/dawang.mjs make <authored.json> <输出.html> --screenshots <临时目录> --summary`
5. `node <skill>/scripts/dawang.mjs review:rules <workspaceDir>`（独立复核，最多 2 轮，局部修改用 `patch:project`）
6. `node <skill>/scripts/dawang.mjs publish:html <workspaceDir> <交付.html>`

## 3. 已有工程与局部修订

- 局部修补：`node <skill>/scripts/dawang.mjs patch:project <workspaceDir> <patch.json>`
- 网页工作台预览：`node <skill>/scripts/dawang.mjs preview:start <workspaceDir>`
- 独立导出 PPTX：`node <skill>/scripts/dawang.mjs export:pptx <workspaceDir> <输出.pptx>`
- ProjectV2 重渲染：`node <skill>/scripts/dawang.mjs render:project <deck-project.json> <index.html>`
- 历史 brief：`node <skill>/scripts/dawang.mjs render:brief <brief.json> <index.html>`

更多底层 API 与视觉细则见 `references/authoring-api.md`、`references/fusion/visual-authoring.md`、`references/fusion/report-layout-logic.md` 和 `references/legacy-and-revision.md`。
