# 独立基线与组合布局

新稿默认启用，声明和基线由 `outline:baseline` 生成。旧工程保持原行为。

## W1：先材料，后页面

1. 完整阅读材料，编写独立 `content-baseline.json`。用 `createContentBaseline`（`authoring/content-baseline.mjs`）创建，参数 id、brief、nodes、relations、gaps、dispositions；不要输入页面元素。
2. 每个节点与关系保留 `sourceRefs`，增加 `sourceLocations:[{sourceId,locator,excerpt}]`。locator 写章节/段落/表格单元位置，excerpt 写对应原文。指标继续区分 target/actual/estimated/planned；关系使用已有 sequence/cycle/assignment/composition 等类型。缺图在 gaps 明确记录，不以普通文字替代状态。
3. 把 snapshot 的五个字段复制到 contentPlan，完整 baseline 放入 contentPlan.baseline。requirements 启用 `contentBaselineContract:'source-baseline-v1'`，并同时启用已有 semanticContract 和 pageDesignContract。
4. 页面生成前后都执行 `node <skill>/scripts/check-content-baseline.mjs authored.json content-baseline.json`。外部文件必须保留；仅内嵌快照不能防止基线与页面一起被重新生成。
5. 排版不能改基线。真实内容修订须先审查来源，生成新的基线版本并保留旧文件，再重新设计页面。该流程检测差异，不自动判断原文理解是否准确，也不证明生成时间或来源真实性。

禁止从最终页面遍历文字反向生成独立基线。对 optional 内容的省略、required 内容的用户决定在排版前记录进 dispositions。

## W2：逐区设计和可验证边界

启用 `compositionContract:'regional-composition-v1'`。每页真实分区，regions 增加：

```js
{zoneId:'roles', hierarchy:'primary', padding:24,
 frameElementId:'people-panel',
 module:{name:'panelGroup',variant:'roles-schedule'},
 typography:{title:30,body:24},
 designReference:{source:'本地案例文件与页码，或明确标注原创',principle:'借鉴的文字层级或图文关系'},
 // 保留 contentRefs、relationRefs、bindings、representation、reason
}
```

每页恰好一个 primary。该字段表达主次决策，最终视觉层级仍须看图复核。frameElementId 指实际面板形状，边界须与 zone 一致；无底框开放文字分组可设置 `openGroup:true`（或 `anchorElementIds`），由实际绑定元素的包络边界参与对齐检查，不强迫所有页面画满矩形。padding 检查绑定内容，不检查背景本身。页面可声明 `typographyRoles`（或来自 `theme.roles` 的八级文字角色：pageTitle/heroMetric/metricUnit/sectionTitle/keyNumber/body/tableBody/caption），自动校验区域绑定文字及 runs 的字号是否符合声明层级。

页面增加 `composition:{alignments:[{edge:'top',zones:['roles','schedule']},{edge:'bottom',zones:['roles','schedule']}],gaps:[{axis:'horizontal',from:'roles',to:'schedule',min:36}]}`。

对齐当前支持外部 top/bottom/left/right，要求关联真实形状边界或开放文字组真实元素包络，不能只填虚拟区域蒙混通过。允许没有外部对齐约束的自由区域；文字基线的光学校正仍人工复核，未自动实现。不要为没有对应关系的两组内容声明逐行对应。

## W3：组合布局与闭环/数字强调

`measureModule(panelGroup,spec,measurer)`，spec 的 bounds/gap/padding/titleSize/summarySize 定义公共区域；panels 至少两个，默认等宽，也可传 `shares:[0.44,0.56]`（或 `panel.share`）按比例分栏。

每个 panel：`{id,title,summary?,share?,builder,spec,distributeRows?}`。`summary` 支持字符串或结构化指标 `{value,unit,size?,unitSize?}`（自动通过 `theme.metricRuns` 生成同基线数值与单位 runs）。builder 接收实际 body bounds、theme、measurements，返回容量模块。标题统一高度；可选 summary 统一摘要带；body 共用起点和底边。

- 主播与排期：builder 分别用 roleGroup、schedule，排期可 `distributeRows:true`。
- 预算与预估：左栏可用 `allocationList`（顶部真实比例色带 + 渠道卡片，重点渠道 `highlight:true` 自动配浅金底色、金色强调边、34px `keyNumber` 金额 runs 与金色占比徽标），右栏用 `capacityTable`（支持三列含测算依据、重点行 `highlight:true` 底色带与 `tone:'secondary'` 次重点数值强调）；双方 summary 提供结构化总预算与关键预估，双方 `distributeRows:true` 共同收口。
- 环形闭环动线：`measureModule(capacityCycle,spec,measurer)`，中心放核心时长/主题，顺时针分布 3—6 个编号节点（起点①与返回弧默认金色 `#B58A42` 强调），圆弧路径带方向箭头，外侧标题与说明通过短引线连接节点并实测防溢出，自动绑定节点 ref 与循环关系 `edgeId`。
- distributeRows 只用于支持 padY 的表格与分配列表模块，按剩余高度平均增加上下内边距，不建立跨栏行对应。
- 面板背景、强调边、标题、摘要和正文共同设计，不追加独立空矩形。
- 表格过高会传播 needs-reflow/cannot-fit，不因外框足够大而宣称 fits。保留全部文字、字号、稳定条目 ID。

当前不提供任意自由拓扑自动布线或自动拆页。W4 证据失效与 W5 完整生产集成仍是后续工作。
