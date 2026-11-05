# 内容关系与页面绑定（W1/W2 候选 API）

本功能在候选开发分支中，日常安装未启用。它验证来源、结构与实际元素绑定；不保证 AI 已完整理解原材料，也不代替最终看图和事实复核。W3 容量模块、W4 复核失效/分级发布、W5 全流程默认启用另行实施。

## 启用与兼容

创建 authored 工程时显式设置：

```json
{"requirements":{"semanticContract":"content-relations-v1","pageDesignContract":"page-design-v1"}}
```

旧工程不设置这些字段，继续原行为。未知版本拒绝读取，避免静默降级。新工程保存结构无效的模型会报错；缺页面绑定可保存为草稿，但覆盖检查不通过。单独检查内容模型可只提供 semanticContract；创建完整 ProjectV2 时必须同时启用两个标识。

## 内容模型

在 contentPlan 保留 nodes，并增加 brief、relations、gaps、dispositions。

- brief：purpose、audience、scenario（proposal/report/review/training/other）、scope（part/full）。
- nodes：每项包含 type（statement/metric/person/stage/action/category/media）、text、sourceRefs、importance（required/optional）、status（confirmed/user-provided-unverified/estimated/planned/missing）。sourceRefs 指向 sources.entries[].sourceId；段落/行定位等来源信息可保存在来源条目中。
- metric.facts：display（上屏需原样保留的数值和单位串）、unit、role（target/actual/estimated/planned）。其他口径、范围与时期字段会保留，当前不执行跨指标推算，也不会自动判断所有口径语义。
- relations：id、kind、members、sourceRefs、importance，以及 edges 或 rows。kind 为 sequence/assignment/classification/comparison/composition/conversion/cycle/branch/support/custom；custom 需要 description。
- edges：每边有唯一 id、from、to；branch 分叉边有 condition；cycle 须形成覆盖所有成员的返回路径；sequence/conversion 按 members 顺序有对应连接。
- rows：每行有唯一 id、members。用于排期、分工、分类等对应关系，详细字段可额外保留。
- gaps：id、affectedRefs、missing、impact、resolution（pending/placeholder/user-accepted/resolved）。仅记录 placeholder 不等于声称已获业务授权；是否需询问仍遵守已有技能要求。
- dispositions：ref、action（included/merged/deferred/excluded）、reason。required 项 deferred/excluded 还需 decisionRef，指向用户原话决定；对应决定的 covers 必须包括 `content#<ref>`。user-accepted gap 的决定覆盖 `content#<gapId>`。

合成输入参考：`tests/fusion/helpers/semantic-fixture.mjs`。此夹具用于结构与浏览器回归，不是最终设计模板。

## 页面绑定

contentPlan.slides[] 增加 readerTask、requiredRefs、regions，沿用 visualDecision.zones。

每个 region 有 zoneId、contentRefs、relationRefs、representation、reason、bindings。每个 binding 有 ref 和 elementIds；关系的每条边还需 edgeId，每行需 rowId。一个关系的成员、边/行在该区域内均须有绑定，区域关系证据必须完整。跨页拆解须显式建子关系，当前不支持把同一关系的碎片跨区域合并后自动视作完整。

程序检查元素存在、基础可见性、画布与区域范围；节点必须绑定可见文本（媒体节点也可绑图片），不能只绑装饰色块。指标 display 必须出现在绑定文字中。边可以由图形或清晰的文字表达，不强制画箭头。

启用后，不再受“自由页必须至少一个汇报组件”的旧条件约束；其他原有视觉检查照常执行。独立复核包增加 `page-design#<slideId>/<zoneId>` 区域声明，携带阅读任务、事实、关系与绑定，请复核者判断真实表达，不能把程序通过当作设计通过。

## 入口与结果

- `validateContentModel(input)`：返回结构诊断数组，不改输入。
- `reviewPagePlan(project)`：返回 `{issues,evidence}`，由 `checkCoverage` 接入现有 make/check/publish 链路。
- `pageDesignClaims(project)`：返回供独立复核使用的区域任务，不返回 pass/fail。
- `outline:check`：可接收带 requirements/sources/contentPlan 的输入；结构缺陷列为 contentIssues，让制作者修复，不把它当业务缺口要求用户补料。proposal/training/other 不强制工作汇报章节。

当前结构校验不能发现“材料中有但制作者从未录入模型”的遗漏，也不能判断所有同义改写是否真实；需要完整材料阅读与独立语义复核。

## 人工编辑

绑定文字改变后，页面的 semanticDirtyRefs 记录受影响引用；保存和导出快照不丢失它，重新内容验收会阻断。普通编辑命令的撤销/重做会恢复相应状态；浏览器原生文字撤销可能保守地保留待核对标记，不以字符串回到原文自动推定语义已核对。

W1/W2 暂不增加界面上的“确认内容已核对”按钮。维护者需对照材料更新模型/绑定后，使用 ProjectV2 的 saveProject 与 expectedRevision 保存修订，明确清除已核对页的 dirty refs；未解决的引用不能直接清空。后续 W5 再提供完整工作流入口。

## 验收边界

可验证：引用、版本、关系结构、区域证据、精确指标串、保存往返、修改后待核对状态。

不能据此宣称：自动抽取完整、语义真实性已证明、所有遮挡/透明色均已检测、视觉质量达标。实际 DOM 测量仍由现有 measureProject 执行，最终文件漏检改进属于 W3/W4；三轮机制和跨修订复核缓存本次未改。
