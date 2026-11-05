# 新制作流程与内部数据契约

关联：[总体方案](../2026-11-04-authoring-system-v2.md)。以下是待实现的设计，不代表已有 API。字段由 AI 整理，用户不用填写 JSON。

## 1. 分层与唯一状态

沿用 ProjectV2：内容模型放入 `contentPlan`，页面设计放入 `contentPlan.slides`，最终可编辑对象仍放在 `slides[].elements`。独立的 outline/page-plan 文件只是制作期间的输入和检查视图；导入工程后，以当前 ProjectV2 为准，不能出现两份相互覆盖的事实状态。

| 层 | 内容 | 不能代替什么 |
|---|---|---|
| 材料与内容模型 | 来源、事实、实体、关系、限定、缺口、取舍 | 不直接决定坐标与组件 |
| 页面设计 | 阅读任务、重点、区域、表达方式、密度、图片用途 | 不能改写事实；不能靠声明证明效果 |
| 主题 | 配色、字体层级、形状和图片处理语言 | 不固定每页结构或替换信息关系 |
| 页面元素 | 真实文字、图片、线条、图形、几何及绑定 | 最终可编辑画面，不是整页图片 |

新增契约标识建议为 `requirements.semanticContract:"content-relations-v1"` 与 `requirements.pageDesignContract:"page-design-v1"`。现有 contentContract/visualContract/ruleContract 在过渡期间继续工作，冲突检查由新版本显式接管，不能双重强制两套不一致规则。

## 2. 最小内容模型

复用 `contentPlan.nodes`、`sources.entries`、媒体台账与 requiredContentRefs。新增字段只记录后续设计与验证真正要用的内容。

| 字段 | 内容 | 校验要求 |
|---|---|---|
| `brief` | purpose、audience、scenario、pageConstraint、scope | 场景可为 proposal/report/review/training/other；不替代现有规则场景 ID |
| `nodes[id]` | type、text、facts、sourceRefs、importance、status | ID 稳定；必需事实能定位来源；提炼句不伪装原文 |
| `relations[]` | id、kind、members、edges/rows、sourceRefs、importance | 引用真实节点；顺序、分支、循环不能仅存在描述句中 |
| `gaps[]` | id、affectedRefs、missing、impact、resolution、decisionRef | 缺材料与制作遗漏区分；用户选择按现有材料后仍保留缺口事实 |
| `dispositions[]` | ref、action、reason、decisionRef | action 为 included/merged/deferred/excluded；必需项排除需要明确授权 |

节点建议类型：statement / metric / person / stage / action / category / media。类型只帮助解释，不强迫一种页面。`status` 区分 confirmed / user-provided-unverified / estimated / planned / missing；预测值和目标值分别记录用途，不能因都是数字而混合。

数值 facts 至少保留原始显示、单位、比较符、范围上下界（如存在）、时期和口径；无法可靠解析时保留原文，不猜算。来源用 sourceId 与材料内段落/表格行/图片定位，不把本机私有路径硬编码进公共夹具。

关系类型保持少量通用集合：sequence（顺序）、assignment（分工）、classification（分类规则）、comparison（比较）、composition（组成/占比）、conversion（转化）、cycle（循环）、branch（条件分支）、support（论据支持）。其他关系允许用带说明的 custom，不能静默丢弃。

### 合成关系示例

```json
{
  "nodes": {
    "n-submit": {"type":"action","text":"提交资料","sourceRefs":["s-flow"],"importance":"required","status":"planned"},
    "n-check": {"type":"action","text":"核对资料","sourceRefs":["s-flow"],"importance":"required","status":"planned"},
    "n-receive": {"type":"action","text":"确认接收","sourceRefs":["s-flow"],"importance":"required","status":"planned"},
    "n-execute": {"type":"action","text":"开始执行","sourceRefs":["s-flow"],"importance":"required","status":"planned"},
    "n-supply": {"type":"action","text":"补充资料","sourceRefs":["s-flow"],"importance":"required","status":"planned"}
  },
  "relations": [{
    "id":"r-handoff","kind":"branch","importance":"required","sourceRefs":["s-flow"],
    "members":["n-submit","n-check","n-receive","n-execute","n-supply"],
    "edges":[
      {"from":"n-submit","to":"n-check"},
      {"from":"n-check","to":"n-receive","condition":"资料完整"},
      {"from":"n-receive","to":"n-execute"},
      {"from":"n-check","to":"n-supply","condition":"资料不完整"},
      {"from":"n-supply","to":"n-check"}
    ]
  }]
}
```

以上是投影示例，不是完整可运行工程；完整来源条目、主题和页面元素在工程里另有定义。

## 3. 页面设计契约

保留 keyLine、visualDecision.focus/layout/zones。增加与内容模型的关联，而不是重新存一份业务文本。

| 字段 | 作用 |
|---|---|
| `readerTask` | 看完这一页读者需要理解、相信、决定或执行什么，必须具体 |
| `requiredRefs` | 本页必须呈现的事实和关系 ID |
| `regions[]` | zoneId、contentRefs、relationRefs、representation、reason、bindings |
| `regions[].representation` | 表格、人物组、条件流程、对比条、图文说明、纯文字等；允许自由表达 |
| `regions[].bindings` | 节点/关系→元素 ID，必要时精确到表格行、连接线、标签或文字片段 |
| `densityDecision` | 有容量风险时记录重分区、文案精炼、分页等选择；简单页面不强制长篇解释 |
| `mediaPurpose` | evidence/reference/decorative/placeholder，防止参考照片被误当证据 |

表达方案只需记录所选方式及原因；复杂或受约束页面才记录备选方案。不得把每个标题、页脚都变成一个需要单独审批的区域。正文主要信息区域按独立阅读任务划分，避免“一整页一个 body 区域”掩盖问题。

### 区域示例

```json
{
  "readerTask":"看懂资料不完整时回到哪里，以及何时才允许开始执行",
  "requiredRefs":["r-handoff"],
  "regions":[{
    "zoneId":"process",
    "contentRefs":["n-submit","n-check","n-receive","n-execute","n-supply"],
    "relationRefs":["r-handoff"],
    "representation":"conditional-flow",
    "reason":"需要同时看见通过路径与返回补充路径",
    "bindings":[{"ref":"r-handoff","elementIds":["node-check","edge-complete","edge-incomplete","edge-return","label-condition"]}]
  }]
}
```

绑定存在只能证明可以追踪，不能证明表达正确。程序检查引用与覆盖；独立复核检查条件、方向、对应关系在截图上是否确实成立。用文本解释关系也可合格，但必须可读且完成阅读任务；禁止仅按是否包含箭头字符判定通过或失败。

## 4. 不同任务的流程分流

- 新稿：材料→内容模型→页面分配→配色/缺口必要确认→逐页设计→生成与看图→三类验收。
- 局部改字：更新对应内容/元素，保留手工位置；重测受影响模块和页面，不重做全稿。
- 修改事实或关系：先更新内容模型与来源，再修改所有使用该内容的页面；复核相关链路。
- 换配色：更新主题，重测对比度与视觉；不默认改变业务内容或重排全部元素。
- 换完整模板/视觉重构：保留内容模型，重新设计构图；确认主题不等于确认每页版式。
- 缺素材：先区分事实缺失与形象缺失。已有“待补”授权可直接设计明确占位，不能伪造照片；关键事实缺失按已有提问流程处理。
- 固定页数且内容过载：先重分区、合理编辑文案；仍放不下时提供拆页或删减的具体选项，不能暗中丢内容。

## 5. 组件与容量结果

工具仍负责几何执行，AI 负责选择与设计。优先完善已有 table/flow/photoGroup/numberedList，再补 roleGroup、schedule 等组合模块。每个模块应返回：

```json
{
  "elements": [],
  "occupiedBounds": [100,240,900,500],
  "bindings": [],
  "capacity": {
    "status":"fits",
    "method":"estimated",
    "constraints":{},
    "violations":[],
    "alternatives":[]
  }
}
```

`status`：fits / needs-reflow / cannot-fit；`method`：estimated / measured。估算 fits 不能替代浏览器实测。容量结果的 occupiedBounds 必须包含图片、标题、说明与注释，而不是只计算图片框。

组件不能静默删字、删节点、缩到不可读字号或更改数值。出现容量问题时依次考虑区域重分配、换表达方式、保留事实的文案精炼，最后再处理页数/内容取舍。不能把该顺序写成所有页面的僵硬算法；最终选择由 AI 根据场景判断并记录。

角色组的照片缺失、姓名变长和职责变长是正常输入状态。无照片时仍保持角色层级与职责位置，使用明确的占位符，不要求与有照片角色强行使用完全相同的大空框。

## 6. 三类验收与发布状态

| 验收 | 程序能证明 | 独立复核要判断 |
|---|---|---|
| 内容 | 必需 ID、事实绑定、关系成员、来源、单位与页数是否齐全 | 提炼是否歪曲、关系是否被误画、缺口说明是否诚实 |
| 渲染 | 最终 HTML 字体就绪、几何、实际文本区域、裁切/重叠及可见性 | 自动检测盲区、关键内容可读性 |
| 设计 | 设计记录与元素的对应、测量证据是否有效 | 阅读任务、主次、信息对应、视觉节奏与留白是否成立 |

独立复核包包含必需事实摘要、关系图、来源摘录、页面任务、最终截图与元素绑定。源码声明只能作定位线索，不能作已满足要求的证据。避免把整份私有原材料无差别加入复核包。

每个 finding 记录 id、category、severity、pageIds、regionIds、refs、evidence、reason、suggestedAction、status。severity 为 blocker 或 advisory：

- blocker：事实错误/遗漏、核心关系误导、不可读或裁切、明确需求未满足。三轮耗尽仍是 blocker。
- advisory：不妨碍任务完成的装饰、视觉偏好和可选精致度建议。不能要求机械增加装饰。
- 不确定：证据不足时先标 needs-verification，不能自动 PASS；补截图或复现后分类。

状态建议：draft → validating → ready；阻断尚存为 needs-revision，缺业务决定为 needs-user-input。轮数限制只让自动返工暂停，不把状态改为 ready。允许显式输出 review-draft 供用户查看，默认不覆盖既有已验收文件。用户明确接受某项问题时沿用 userDecisions，范围精确到具体 finding；如实显示“用户决定接受”，不改写成客观通过。新策略在候选版本验证与确认后才替换现有发布行为。

## 7. 复核失效与返工

每个判断绑定页面内容、元素、媒体、主题、规则版本与相关关系的指纹。未受影响的判断可复用；依赖变化必须复核。实现初期先按整页保守失效，不急着做精细元素级缓存。

| 变化 | 最小失效范围 |
|---|---|
| 文字/大小/换行/角色占位改变 | 所在页内容、渲染和设计相关检查 |
| 节点或关系改变 | 使用该节点/关系的全部页；跨页叙事检查 |
| 图片替换或裁切 | 所在页媒体与设计检查，重新测量 |
| 字体/主题改变 | 全稿渲染与视觉检查 |
| 页序/页数/全局规则改变 | 全稿结构、覆盖和相关规则复核 |
| 最终序列化 | 发布产物检查；不能只信临时预览 |

返工路由：事实/关系错误返回内容模型；表达不成立返回页面设计；溢出返回模块容量与版面；仅装饰问题局部调整。每轮记录 finding→行动→证据→再判定；不要求“构图改动必须超过某面积”，避免又制造代理指标。仅改颜色不能关闭“分工关系不清楚”的问题。

## 8. 人工编辑与渐进迁移

人工编辑优先。编辑器改变绑定文本时，先记录 dirtyRefs，不强迫编辑器自动猜测业务含义；后续制作时核对并更新内容模型。手工修改后的页面仍可保存，语义未核对不等于禁止保存；再次宣称“内容验收通过”前必须重新确认。

新建工程启用新契约，旧工程原样读取。升级旧工程时从实际可见元素和材料重建映射，先给差异，不把旧的 pass 自动转换为新验收。保持 projectId、稳定元素 ID、人工几何与裁切；未知字段在旧运行时的保留能力需实际测试，未验证前不允许降级覆写。
