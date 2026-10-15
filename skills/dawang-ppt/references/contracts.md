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
