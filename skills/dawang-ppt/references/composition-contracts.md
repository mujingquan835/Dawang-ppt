# W1—W3 第二轮候选：独立基线与组合布局

仅候选分支使用。旧工程保持原行为；不意味着已替换日常安装。

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

每页恰好一个 primary。该字段表达主次决策，最终视觉层级仍须看图复核。frameElementId 指实际面板形状，边界须与 zone 一致；padding 检查绑定内容，不检查背景本身。

页面增加 `composition:{alignments:[{edge:'top',zones:['roles','schedule']},{edge:'bottom',zones:['roles','schedule']}],gaps:[{axis:'horizontal',from:'roles',to:'schedule',min:36}]}`。

对齐当前支持外部 top/bottom/left/right，要求关联真实形状边界，不能只填虚拟区域蒙混通过。允许没有外部对齐约束的自由区域；文字基线的光学校正仍人工复核，未自动实现。不要为没有对应关系的两组内容声明逐行对应。

## W3：组合布局

`measureModule(panelGroup,spec,measurer)`，spec 的 bounds/gap/padding/titleSize/summarySize 定义公共区域；panels 至少两个，等宽。

每个 panel：`{id,title,summary?,builder,spec,distributeRows?}`。builder 接收实际 body bounds、theme、measurements，返回容量模块。标题统一高度；可选 summary 统一摘要带；body 共用起点和底边。

- 主播与排期：builder 分别用 roleGroup、schedule，排期可 `distributeRows:true`。
- 预算与预估：两个 capacityTable，通过 builder 根据传入 bounds[2] 分配列宽；双方 summary 提供总预算和关键预估；双方 distributeRows。
- distributeRows 只用于支持 padY 的表格模块，按剩余高度平均增加上下内边距，不建立跨栏行对应。
- 面板背景、强调边、标题、摘要和正文共同设计，不追加独立空矩形。
- 表格过高会传播 needs-reflow/cannot-fit，不因外框足够大而宣称 fits。保留全部文字、字号、稳定条目 ID。

当前不提供循环自动布线、不等宽面板或自动拆页。循环图需依据案例自行构图并复核，不得用文字箭头静默替代。W4 证据失效与 W5 完整生产集成仍是后续工作。
