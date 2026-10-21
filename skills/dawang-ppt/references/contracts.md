# 工程与命令（0.2 开发版）

在仓库根目录执行；其他目录用技能入口的绝对路径。输入和输出均可使用绝对路径。

```sh
node skills/dawang-ppt/scripts/dawang.mjs styles
node skills/dawang-ppt/scripts/dawang.mjs styles:grid management-report output/appearance.html
node skills/dawang-ppt/scripts/dawang.mjs build authored.json output/demo/index.html
node skills/dawang-ppt/scripts/dawang.mjs render:brief brief.json output/demo/index.html
node skills/dawang-ppt/scripts/dawang.mjs render:project output/demo/deck-project.json output/demo/index.html
node skills/dawang-ppt/scripts/dawang.mjs preview:start output/demo 8766
node skills/dawang-ppt/scripts/dawang.mjs qa:project output/demo
node skills/dawang-ppt/scripts/dawang.mjs export:pptx output/demo output/demo/review.pptx
node skills/dawang-ppt/scripts/dawang.mjs export:pdf output/demo output/demo/review.pdf
```

## 默认直接制作契约（W5）

`build` 默认等价 `render:authored`，由智能体整理authored输入，不要求用户写JSON。旧brief/goal输入会明确提示使用render:brief/render:goal；已保存ProjectV2必须render:project，不静默回落或覆盖编辑。

输入包含requirements、sources.entries、media.entries、contentPlan.nodes/slides、designChoice与slides。每页包含稳定slideId、styleId、elements；程序写入mode:composition与authoring.engine:kimi-authored-v1。直接元素指定id、type、bounds及style，可用contentRef/mediaRef关联事实和媒体。文字可有runs:[{text,style}]；vector使用正尺寸bounds、四数值viewBox、受控path/style，不接收任意HTML/SVG脚本。

自主外观使用styleId:authored/custom及appearance.palette、元素字体/字号；这是中性绘制默认值，不选择旧模板或限制六种外观。仅明确的authored页可使用该默认值，不能据此宣称原17主题全部已适配组合页。沿用已支持绘制风格仍可显式指定legacy/theme09等；新稿构图由直接元素决定，不经旧规划器。完整字段校验见project/schema.mjs、authoring/create-project.mjs；缺材料不编造。

新稿先实际读取原规则，单稿保存rules-manifest来源指纹与逐页决定；CLI不会替智能体读取、理解规则或自动完成设计。authored输入由智能体编写，程序只渲染、保存、测量与导出。

## 历史规划与模板兼容

`render:brief` 保留contentSlides计划与旧已适配外观限制。`styles:grid <scenario> <output.html>`是旧路径外观板及同名JSON（6个已适配选项），不是直接制作前置步骤或全部风格目录。下述brief/semantic objects条款仅适用于显式旧规划入口；不约束新直接元素构图。

用户明确指定原样模板时，运行 `templates` 查看17个原主题，再用 `render:goal <goal.json> <output/index.html>`。`render:goal`沿用原goal校验、composeDeck和模板契约；`--from-html <原index.html>`合并已有文字/字体/槽样式/顺序等状态。输出已有工程时拒绝导入覆盖。局部返工加载ProjectV2，保存后重渲染；不回读初始goal覆盖新状态。

`brief`由制作智能体生成，包含title/audience/purpose/scenario/styleId/contentNodes/contentSlides/requiredMedia/fixedPageCount。contentSlides每页有slideId/title或titleRef/readerTask/relation或kind/data/source/requiredContentRefs；新稿不使用历史家族 pageType；已保存工程使用 render:project 恢复。缺材料返回冲突，不自动编造。

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

## 语义文字（S1 八页已获用户验收）

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

### 逐页内容复核与证据留白
新稿明确设置 `contentReview:"required"`：含数量的正文若未记录 `dataDecision`、或 metrics 缺 nature/valueRef/labelRef，规划返回 conflict，不继续导出该新稿。旧项目未设置时保留兼容性，planning.contentReview 记录待人工处理的警告。数字扫描只覆盖常用单位，不能代替完整业务理解。
`spacingPolicy:"balanced-evidence"` 只增加有预算的表格行高及模块间距，不缩放文字/图片；短文不强求满页。`table.data.verticalAlign:"middle"` 使用实测文字块（包括次级说明）居中；`row.minHeight` 保存已分配的行高，后续实测仍可因文字变长而增长。`layout.widths` 为 row 各子栏的正数权重，支持局部返工锁定照片栏；`metrics.data.compact:true` 采用20pt重点值和项目正文大小的标签。
