# 数据与命令

技能脚本命令：`node <skill>/scripts/dawang.mjs build|serve|qa|export <项目绝对路径> [输出PPTX或端口]`。

最小可复现项目见仓库 `examples/matrix.mjs`；`npm run examples` 生成六组公开合成输入。

| 文件 | 内容 |
|---|---|
| requirements.md | 明确要求、缺失事实、假设与最终验收 |
| sources.json | entries 来源；nodes 以稳定 id/sourceId 关联，text/table/series 类型 |
| media.json | items 的 id/src/source/intent/alt/allowCrop/fit；src 是项目内相对路径 |
| content-plan.json | scenario/audience/purpose/use/pageCount/cover/slides |
| design-brief.json | styleId 与 tokens；不改变事实 |
| edit-state.json | overrides 按元素稳定 ID 保存 x/y/w/h/fontSize |
| render-plan.json | 自动编译的元素与内容引用，禁止作为第二份内容真相手改 |
| build-manifest.json | 输入 revision、构建版本与时间 |
| qa/report.json | 检测及待复核状态；重新构建使其失效 |

逐页字段：slideId、readerTask、relation、composition、titleRef、bodyRefs、requiredContentRefs、mediaRefs、requiredMediaRefs、constraints。构图为 evidence/case/comparison/process/table/action。

process 使用 beforeRefs/afterRefs；table 使用 dataRef，节点包含 headers/rows；comparison 使用 dataRef，节点包含 values[{label,value}]、unit、period、basis。null 单独标记。nativeChart 与 smartArt 约束会明确拒绝。

默认 960×540 对应 PPTX 13⅓×7½ 英寸；坐标 /72 为英寸，文字 px 数值对应点值。中文字体默认 PingFang SC；靛蓝标题用 Songti SC。没有分发字体；其他平台需指定可用字体并重新测量。

三种风格：indigo-due-diligence（月白之外的密集证据与判断区）、moon-white-imagery（大标题及图像主次）、blue-line-courseware（蓝线与教学流程）。custom 直接指定颜色角色、字体、字号、evidenceRatio 等受控参数。蓝线为 A4 源视觉的横版适配。
