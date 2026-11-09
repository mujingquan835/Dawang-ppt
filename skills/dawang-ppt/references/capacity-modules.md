# 模块与容量处理

入口：`project/src/fusion/authoring/capacity-kit.mjs`。在原 layout-kit 的表格、图片组、流程工具上组合，旧工具默认行为不变。候选模块不会自动决定内容、删字、缩小字号或分页。

## 使用

```js
import { createTheme } from '../project/src/fusion/authoring/layout-kit.mjs';
import { schedule, measureModule } from '../project/src/fusion/authoring/capacity-kit.mjs';
import { createLayoutMeasurer } from '../project/src/fusion/planning/measure-layout.mjs';
const spec = {
  id: 'schedule', bounds: [920, 250, 900, 650], theme: createTheme(),
  relationRef: 'schedule-relation',
  rows: [{ id: 'morning', time: '10:00—12:00', content: '项目介绍与答疑', people: 'A + C' }]
};
const measurer = await createLayoutMeasurer();
try {
  const result = await measureModule(schedule, spec, measurer);
  // fits 才能进入当前区域；否则依据 violations 调整 spec 或重新设计。
  // bindings 合并进 W2 的 region，节点/关系本身仍由内容模型提供。
} finally { await measurer.close(); }
```

返回：`elements`、`height`、`width`、`occupiedBounds`、`bindings`、`capacity`；人物/表格另有 `rows`（各行位置）。

- `capacity.status`：fits、needs-reflow、cannot-fit。
- `capacity.method`：estimated 或 measured。直接调用工具是估算；measureModule 使用浏览器实际字体测量后重排。
- `constraints.bounds`：分配区域；`violations`：所需与可用尺寸；`alternatives`：重新分区或换布局/拆页的建议。
- needs-reflow：当前区域不足，但结果尚未超出逻辑画布；不保证随意扩区不会撞到其他内容，需页面设计决定。
- cannot-fit：内容已超出画布或实测文本横向仍超出；保留完整内容和几何供诊断，不输出“成功裁切”。
- 参数不合法、无条目、列宽不足以构成有效单元格、图片不可读取、字体/测量失败会显式抛错，不回退为假成功。

`occupiedBounds` 包含文字、图片、占位和分隔线，不仅是图片框。表格和流程的元素 ID 使用调用者提供的行/节点 ID，重排不会让另一个内容继承原 ID。

## 模块

| API | 内容与行为 |
|---|---|
| roleGroup | items：id/name/role/detail，选填 ref/photo/placeholder。人物按行布局，左图或明确占位，右姓名/角色/职责。行高随全部内容增长。mediaWidth/mediaHeight 可配置，photo 支持现有 photoGroup 的 size/focal 等输入 |
| capacityTable | rows：稳定 id 和列数据（支持 `highlight:true` 重点底色带、`tone:'secondary'` 次重点强调、`runs` 单元格富文本）；columns：key/label/width/align/emphasize，宽度总和等于区域宽度。全部表头/单元格参与测量；长行推动后续行 |
| schedule | capacityTable 的时间、内容、参与人员三列默认配置；可传 columns 替换。不是拼接空格的文本框 |
| capacityFlow | 顺序流程。steps：id/title/detail/ref。实测标题后移动说明 |
| capacityCycle | 环形闭环动线。center：{value,label,ref}；nodes（3—6 个）：id/title/detail/ref；自动生成顺时针圆弧、方向箭头、短引线与外侧标签（起点①与返回边默认金色强调），绑定节点 ref 与 `relationRef` 的 `edgeId` |
| capacityBranch | 条件分支与返回回路图。steps：主干正向节点（id/title/detail/ref）；branch：{from,returnTo,id,title,detail,ref,passCondition,failCondition,returnEdge,passSummary}；自动生成正向推进边、条件徽标、向下异常分支卡片及 L 形返回回路箭头，并完整绑定 `relationRef` 的全部 `edgeId` |
| allocationList | 比例分配列表。顶部按 `share` 真实比例绘制分段色带，下部按行排列渠道/用途、34px `keyNumber` 金额 runs 与占比徽标；支持 `highlight:true` 主投入浅金底色与左强调条，支持 `distributeRows` |
| panelGroup | 多栏面板组合（支持等宽或 `shares:[0.44,0.56]` 比例分栏，支持字符串或 `{value,unit}` 结构化同基线摘要，无摘要面板自动紧贴标题排布，支持 `distributeRows` 共同收口） |
| measureModule | 复用同一 createLayoutMeasurer，测量文本后重新生成几何；保留字号、字体、文字、图片参数与列宽 |
| rolesWithSchedule | patterns.mjs 的组合入口；接收 roleSpec、scheduleSpec、可选 measurer。合并元素/绑定和容量状态，并拒绝区域重叠与重复元素 ID |

表格 row.ref 绑定整行；relationRef 加 row.id 生成 W2 的 rowId 证据；row.refs[columnKey] 可为单个或多个内容引用。人物 item.ref 绑定姓名/角色/职责。流程 step.ref 绑定标题/说明。关系连接的语义绑定仍需设计者依照 W2 显式补全，不能把所有线条自动称为某条业务关系。

## 与生成检查的连接

元素携带 `capacityModule:{id,status,method}`。新 authored 工程的视觉检查遇到未解决容量状态会报 `module-capacity-unresolved`；estimated fits 会提示先实测。调用方不能通过丢弃标记或删除文字来过关。最终浏览器 QA 仍负责实际页面的溢出/重叠检查。

容量证据只对应本次生成。后续人工修改需要重新测量，不宣称 marker 可自动覆盖所有修改后的状态；跨修订证据失效是 W4。纯几何 fits 不代表构图好看，也不证明原材料完整。模块选择、区域面积和阅读任务仍由 AI 设计并看图。

W3 没有修改日常 SKILL 的默认流程，没有代替 W4 的复核与发布分级，也未宣称所有旧组件都自动获得容量自适应。
