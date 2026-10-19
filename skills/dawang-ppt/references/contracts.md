# 工程与命令（0.2 开发版）

在仓库根目录执行；其他目录用技能入口的绝对路径。输入和输出均可使用绝对路径。

```sh
node skills/dawang-ppt/scripts/dawang.mjs styles
node skills/dawang-ppt/scripts/dawang.mjs render:goal goal.json output/demo/index.html
node skills/dawang-ppt/scripts/dawang.mjs render:brief brief.json output/demo/index.html
node skills/dawang-ppt/scripts/dawang.mjs render:project output/demo/deck-project.json output/demo/index.html
node skills/dawang-ppt/scripts/dawang.mjs preview:start output/demo 8766
node skills/dawang-ppt/scripts/dawang.mjs qa:project output/demo
node skills/dawang-ppt/scripts/dawang.mjs export:pptx output/demo output/demo/review.pptx
node skills/dawang-ppt/scripts/dawang.mjs export:pdf output/demo output/demo/review.pdf
```

`render:goal`沿用原goal校验、composeDeck和模板契约；`--from-html <原index.html>`合并已有文字/字体/槽样式/顺序等状态。输出已有工程时拒绝导入覆盖。局部返工加载ProjectV2，保存后重渲染；不回读初始goal覆盖新状态。

`brief`由制作智能体生成，包含title/audience/purpose/scenario/styleId/contentNodes/contentSlides/requiredMedia/fixedPageCount。contentSlides每页有slideId/title或titleRef/readerTask/relation或kind/data/source/requiredContentRefs；首批模板另有judgments/explanations/pageType等材料。靛蓝判断栏需要2–4项真实判断。缺材料返回冲突，不自动编造。

| kind | data 主要字段 |
|---|---|
| images | images[{mediaId,src,kind,caption,focal}]，arrangement=single/text-photo/primary-secondary/grid/full-bleed |
| timeline | nodes[{nodeId,label,date,detail}]，direction=horizontal/vertical/alternating，distribution=sequence/date，stages[{stageId,from,to,label}] |
| table | columns[{columnId,label,width}]，rows[{rowId,height,cells:{columnId:value}}]，merges[{rowIds,columnIds,text}]；比例须为正 |
| process/hierarchy/cycle/matrix/comparison/causal | nodes[{nodeId,label,detail}]，显式relationships[{relationshipId,from,to}]；矩阵columns/rows/columnLabels/rowLabels |
| bar/line | series[{nodeId,label,value}]，unit、period必须给出；null缺测与0区分 |

各对象均有objectId/bounds/overrides。显式空relationships表示无连接，不自动补线。日期比例模式要求实际日期，顺序时间轴可用阶段名。图片ID、节点、行列和关系ID必须稳定，不能用重排后的下标代替。

唯一源文件为`deck-project.json`：version=2、requirements、sources、media、contentPlan、designChoice、slides、editorState、revision。原模板mode=template；新组合mode=composition。图片复制到assets/user-media；用户上传去重落盘，撤销记录引用媒体。完整交付保留整个输出目录，不只复制HTML。

逻辑画布1920×1080；导出13⅓×7½英寸。逻辑坐标/144为英寸，CSS字号/2为点值。原组件按浏览器实际布局采集；新对象保持文字、形状、图片和线条可编辑。

## S1 语义文字（实验，待两页效果评审）

新多区域页可设 `typographyPolicy=semantic`。文本语义与对象种类分离：identity（主体）、support（辅助标签）、context（现状/背景）、action（行动）、emphasis（局部重点）、empty（空项）。旧工程默认正文下限28px；新多区域工程可在 brief 或单页设置 `typography: {bodyPt: 12}`，以24逻辑px测量、保存、渲染和导出为12pt，换外观仍保留该项目设置。标题、主体名称与重点标签保留独立层级，不通过缩字解决溢出。颜色从palette.body/muted/ink/accent/quiet/line读取，缺少body/quiet时回退ink/line。

表格 columns 可有 semanticRole/headerRole；rows.secondaryCells[columnId] 为 {text,semanticRole,contentRef}，独立文字元素与dataPath进入既有编辑、撤销、保存与导出。段落 prefix={text,semanticRole,contentRef} 用独立可编辑文字与正文共同行内排列，保留局部强调。这里不声称支持任意富文本导入。

process 的 data.presentation=inline-sequence 表示开放文字序列，不生成步骤框；data.semanticRole 指定旧/新流程的语义，leadingLabelNode 可保留首标签而不画标签后的额外箭头。语义lint会阻断该表达上意外出现的描边框。

分栏需求由实际可见文字的DOM自然宽/高与图片比例估算，再实测候选；路径、ID、来源元数据不参与宽度权重。候选仍受内容layout约束，不能据此宣称完整自动构图或所有风格已完成迁移。


## 2026-10-19 多区域表达与候选

- 未显式指定 layout 时，比较顺序阅读、相邻关系组并列等不同布局树；显式 layout 保持锁定。候选不再给更大字号加分。slide.planning 记录 layoutId、formDecisions 和实测结果。
- process 默认 numbered-sequence；comparison 默认 open-comparison；可明确指定 staged-sequence 或 inline-sequence。流程节点保留稳定编辑锚点，inline-sequence 不生成节点框。
- timeline 已接入多区域实测：nodes 描述阶段；可有 lanes=[{laneId,label,contentRef,events:[{nodeId,text,contentRef}]}]。未提供 lanes 时按 date/label/detail 分别显示；不推断日期。laneHeading/laneHeadingRef 可保留业务列表头。普通标签与详细说明保持独立编辑路径。
- 本次按八页真实稿接入所需对象；不把此实现描述为所有旧组件或 Kimi 自动构图能力已迁移。

- 区域 `attachedTo=regionId` 将说明文字绑定到对应主区域，同栏参与自动构图；关系链宽度按全部节点的实际文字测量预算，纵向组合取最大宽度需求。
- 深底表头默认使用 palette.onHeader（缺省白色），浅底表头按语义角色着色。语义规则不得把深底表头统一刷成灰字。
- 新实测时间轴当前使用水平、有序阶段布局；显式垂直方向、日期比例分布和阶段带会明确报冲突，不能被静默替换。原单对象时间轴路径保留相应能力。缩小实测时间轴的组高度至可读下限以下会被拒绝。
