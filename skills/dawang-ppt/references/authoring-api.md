# 工程编写速查

自然语言任务由制作智能体完成材料理解、原文规则读取、内容策划和自主设计；不要求用户填写 JSON。

调用 `node <skill>/scripts/dawang.mjs rules:read management-report [--design <相对原规则路径>] [--format <路径> ...]` 获取按章节切分的原文、来源路径、SHA 与 apply/adapt/replaced 标注（`--full` 含 replaced 原文；`--allow-drift` 仅在用户同意时使用）。`rules:lock [--root <目录>] [--label <名称>]` 重新锁定规则版本并列出与旧锁的差异，属于维护操作。缓存不能代替本会话阅读。

完整合成工程：`node <skill>/examples/authored-minimal.mjs /tmp/authored.json`。
推荐交付：`node <skill>/scripts/dawang.mjs make /tmp/authored.json /目标/报告.html`。
已存工程用 `patch:project <工程目录> <patch.json>`，之后 `publish:html <工程目录> <报告.html>`；旧工程低层入口 `render:project <deck-project.json> <index.html>` 保留。

- `textElement({id,text?,runs?,bounds,style?,contentRef?})`，runs 的每项为 `{text,style?}`。
- `imageElement({id,src?,mediaRef?,bounds,fit?,crop?,focal?})`，原图保留，crop 为归一化 `[x,y,w,h]`。
- `lineElement({id,from:[x,y],to:[x,y],style?})`，自动计算正 bounds 与相对端点。
- 外观配色写在 `designChoice.appearance.palette`（全稿默认，键为 bg/ink/muted/accent/line）；某页不同时在该页写 `slides[i].appearance.palette`，只覆盖写出的键。页面背景只来自 palette.bg，未写时为白底；深色设计必须写 bg，不能只把文字设成浅色。
- 重点句写在 `contentPlan`：`throughLine:{placements:[{slideId,elementId}],source,from?|support?}` 为全稿定位句，至少放在首页或末页；`slides[i].keyLine:{elementId,source,from?|support?}` 为该页重点句，确无重点时写 `{waived:'理由'}`。`source` 取 `quoted`（原材料原句，`from` 写出处）、`distilled`（由事实提炼）或 `created`（AI 新写），后两者 `support` 列出所依据的事实，不得新增事实或最高级说法。`authorNotes:[{text,reason}]` 列出只给作者看、不上屏的材料。完整样例见 examples/authored-minimal.mjs。
- 规则清单写在 `contentPlan.ruleChecklist:{scenario,items:{<章节id>:{status:'applied',how,evidence:[{slideId,elementIds}]}|{status:'not-applicable'|'user-override',reason}}}`，每章一条。章节 id 与原文要点由 `rules:checklist <场景>` 输出；旧工程（`rules-checklist-v1`）沿用逐条 id，可用 `--items` 输出。
- 视觉决定 `contentPlan.slides[i].visualDecision:{focus:{elementId,text?},layout,zones:[{id,role,bounds}]}`；role 取 focus / evidence / support / flow / data / note / media。`wireframe <authored.json|工程目录> <输出目录>` 输出每页分区线框 PNG/SVG（区域色块、文字灰条、图片叉框）。
- 视觉决定写在 `contentPlan.slides[i].visualDecision:{focus:{elementId,text?},layout}`（新制作必填，旧工程仅警告）。`focus.elementId` 指重点词所在文字元素；重点只是句中一段时写 `text`，该段必须用独立 runs 在字号/字重/颜色/字体至少一项上区别于引导语（整句同一样式会报 `visual-focus-not-distinct`）；重点自成元素时省略 `text`，其字号须为本页最大（否则 `visual-focus-not-leading`）。`layout` 一句写主视觉、证据与重点的空间关系。只写一段文字说明（字符串）会报 `visual-decision-unstructured`。确无语义重点的页（目录、过渡、结束页）写 `{waived:'理由'}`。
- 元素 `bounds` 为逻辑 CSS px `[x,y,width,height]`；画布 1920×1080，CSS64px 在PPTX中为32pt。字号、间距使用逻辑 px，lineHeight 为倍数；不自动缩字。
- `text:measure <specs.json>` 批量接受文字元素字段，返回真实字体高度/宽度/自然宽度/字体可用性；缺字体报 `font-unavailable`，关闭临时浏览器。样例可任意更改构图，直接 elements 与自定义样式始终可用。
- patch 为 `{expectedRevision,commands:[{type:'text',slideId,elementId,text}]}`；commands 与编辑器一致，富文本清空必须显式 `resetRuns:true`。整批失败不写盘，冲突保留双方。
- `check <工程目录> [--slides id1,id2] [--screenshots <目录>]`。最终发布全稿检查，内容判断与实际看图检查仍需执行；仅显式 screenshots 才长期保留截图。检查按文字下方实际铺色（先前绘制的纯色形状，再到页面背景）计算对比度：低于 3:1 为 `low-contrast` 错误（新制作阻断）；常规字号低于 4.5:1 列入 `warnings`。压在图片、渐变或 vector 上的文字不计算，需看图确认。重点句检查（新制作为错误，旧工程仅警告）：缺 keyLine/throughLine、依据缺失、keyLine 字号不在本页前两级、定位句不在首末页、authorNotes 内容出现在页面（按字符相似度，改写措辞同样命中）；重点句过长仅警告。结果的 `contentReview` 列出定位句、每页重点句及 created 句。视觉决定检查（新制作为错误）：缺失、未结构化、缺 layout、缺 zones `visual-zones-missing`、区域无效 `visual-zone-invalid`、区域重叠 `visual-zones-overlap`、页头页脚以外的文字或图片不在任何区域内 `visual-element-outside-zones`、区域内有超过 15% 的连续空白（300px 以上高的区域）警告 `visual-zone-sparse`、重点元素不存在、重点未与引导语区分或不是本页第一阅读层级；重点词在后续改字后找不到仅警告 `visual-focus-text-stale`；两页以上且每页重点都是整块标题为错误 `visual-focus-all-titles`；超过 64KB 的 data URI 图片为错误 `image-inline-src`（改用文件路径作 src，或登记到 media.entries 后用 mediaRef）；几何检查警告：同行图片不等高 `image-row-uneven`、数字与单位分成两个元素且距离过远 `metric-unit-detached`、相邻文字左缘差 2–10px `near-misaligned`、图片显示超过原始像素 2 倍 `image-upscaled`；页面只有文字与细线警告 `visual-text-only`；三页以上焦点位置与主体区域完全相同警告 `visual-layout-repeated`，过半页 waived 警告 `visual-decisions-mostly-waived`。结果的 `visualReview` 列出每页重点与构图说明。程序只证明决定落到了元素上，不评价美观。规则清单检查（新制作为错误）：缺 `ruleChecklist`、场景无效或原规则不可用/与锁定不一致、有章节未记录（`rules-unrecorded` 列出 id）、applied 缺 how 或 evidence、evidence 指向不存在的元素、整章记为 applied、未采用缺 reason；过半未采用警告。结果的 `ruleReview` 给出条目数、各状态计数与 notApplied。独立复核：`review:rules <工程目录> [--keep-packet <目录>]` 截图后调用复核者（默认 Codex CLI `exec --ephemeral -s read-only`，附截图与 `--output-schema`；`DAWANG_REVIEWER_MODEL` / `DAWANG_REVIEWER_EFFORT`（minimal/low/medium/high）指定 Codex 复核的模型与推理强度；`DAWANG_REVIEWER_CMD` 命令在 `$PACKET_DIR` 读取 prompt.txt/schema.json/claims.json/images 并写出 verdict.json），结果写入 `rules-review.json`（绑定 revision 与清单哈希）。新工程另加三条视觉标准声明 `visual#alignment` / `visual#hierarchy` / `visual#images`。再次复核只重判上一轮 fail 的条目，通过项标 `carried` 沿用；清单变化或 `--full` 时全部重判。发布检查：缺复核 `rules-review-missing`、修订或清单已变 `rules-review-stale`、有 fail `rules-review-failed`（列出 id 与理由）；结果的 `independentReview` 给出复核者与通过/失败数。

## 交付与保存

- 默认交付目录只有一个用户命名HTML，内含可移交ProjectV2快照与资源。离线HTML顶部常驻“保存”和状态，⌘S/Ctrl+S与侧栏保存执行同一逻辑：首次用打开文件选择框关联已经存在的原HTML，检查文件名及projectId，获得写入权限后直接覆盖，后续复用关联。关联句柄按当前页面URL保存在IndexedDB，重开后尝试恢复；浏览器可能要求重新授权，草稿/句柄存储不可用时明确提示重开需重新关联。
- 保存绝不静默下载副本；浏览器不支持文件写入时提示换用Chrome/Edge。下载HTML副本仅由显式导出触发，导出副本不清除源文件未保存状态。取消、无权限、校验错误和写入失败都保留修改，不显示已保存；写入并关闭成功后才提示已保存，保存期间的新修改仍提示未保存。
- `preview:start <workspaceDir> [端口]` 后在网页工作台的目录、画布和侧栏中编辑：保留手工位置、裁切、字号及runs。编辑器的撤销重做、保存重开属于版本验收，由测试覆盖，单份稿件不在浏览器里重复测试。跨run整段替换需明确保留格式或重置，不静默摊平；冲突保留两份，不清空编辑状态。
- 用户自行导出PPTX/PDF/当前页图片；PDF截图型、PPTX字体未嵌入与目标电脑字体边界在导出帮助中说明。工程字段与历史契约细节见 [工程契约](contracts.md)。

## 减少工程往返

- `rules:list` 列出合法场景，不需要查源码猜ID。
- `prepare <材料.html|json|md|txt> <全新目录> [--scenario business-plan]` 返回 material.json、完整规则文件和原图路径。HTML只接受经过验证的portable快照；不承诺任意网页或PPTX导入。读取正文并查看原图，JSON中的相对媒体路径以原输入目录解析。准备目录已存在则拒绝覆盖。
- `make <authored.json> <交付.html> --screenshots <临时目录> --summary`、`publish:html <工程目录> <交付.html> --screenshots <临时目录> --summary` 在同一次检查中取得全稿原尺寸截图。截图供逐页实际复核，默认不加入交付。`--summary`输出诊断摘要与完整run.json位置。
- `preview:start <workspaceDir> [端口]` 从make结果取内部工程目录；省略端口自动分配，指定端口冲突仍报告错误。
- 元素帮助器同模块导出 `createTextAuthor({baseStyle,roles})`，返回函数接收`{role,id,text,runs,bounds,style,contentRef}`；样式按基础→角色→元素顺序合并。角色和数值由模型按稿件定义，不强制标题/正文大小。
- `distributeBounds({origin:[x,y],sizes:[[width,height],...],gap,direction:'horizontal'|'vertical'})` 返回bounds数组，可分配不同宽高。它只做坐标计算，不选构图；直接bounds始终可用。

```js
const text = createTextAuthor({baseStyle:{fontFamily:'PingFang SC'},roles:{title:{fontSize:72},body:{fontSize:36}}});
const title = text({role:'title',id:'claim',text:'材料支持的主张',bounds:[120,140,1500,120]});
```

## 内容大纲

新建稿件先把用户材料整理成 `outline.json`，运行 `outline:check <outline.json>` 后再与用户确认、再排版。合成示例见 `examples/outline-work-report.json`。

```json
{ "kind": "report", "scope": "part", "title": "…", "audience": "业务管理层", "period": "2026年Q3", "owner": "…",
  "pages": [ { "id": "p1", "role": "summary", "keyLine": { "text": "…", "source": "distilled" },
    "data": [ { "label": "辅助新签", "value": "20", "unit": "单" } ],
    "items": [ { "title": "…", "detail": "…" } ], "flows": [ { "title": "…", "steps": ["…"] } ], "chains": [ { "title": "…", "steps": ["…"] } ],
    "table": { "columns": ["…"], "rows": [["…"]] }, "photos": [ { "src": "附件图/x.jpg", "caption": "…" } ] } ] }
```

- `kind`：`report`（工作汇报、复盘、阶段总结）或 `review`（述职）。
- `scope`：`part`（默认，用户只要一部分页面或某一块）只检查所做页面；`full`（用户明确要完整汇报/述职）才检查整体结论、问题差距、下一步等整稿结构。authored 工程的 `requirements.scope` 同步填写，复核据此判断。没有缺口时不向用户提问。
- `role`：summary 整体结论 / results 成果数据 / actions 关键动作 / resources 资源支持 / issues 问题差距 / causes 原因复盘 / plan 下一步 / asks 需支持或决策 / duties 职责定位（述职）/ other。
- `flows` 是流程步骤（建议表格加流程色带），`chains` 是应用路径（建议表格加深色侧栏）。
- 照片各对应一项时，事项写进 `items`（与 `photos` 同序同数量）：有说明或数字时建议 `itemsWithPhotos`（每项一栏、照片在正下方），文字很少、几乎无数据时建议 `photoPanels`。`outline:check` 会提醒：标签或重点句提到目标却没写 `target`、提到去年/同比却没有对照结构、有多张照片却没写事项。
- `data[].target` 写目标值（两项以上时建议 `targetVsActual`）；`compare:{left:[…],right:[…]}` 写逐项成对的两侧（建议 `contrastColumns`）；`periods:[{label,title,points}]` 写按时期展开的工作（3 个以上时建议 `periodColumns`）。
- 照片路径相对大纲文件所在目录。
- 输出：`gaps`（缺口：缺什么 `ask`、缺了会怎样 `impact`）、`warnings`（单位缺失、重点句只是动作罗列、照片不存在、可选内容缺失）、`suggestions`（每页建议页型及理由：数据多用色块，数据少照片多才用照片拼板）、`decision`（下一步该问用户什么）。工作汇报要求整体结论、成果数据、问题差距、下一步，需支持事项为可选；述职要求职责定位、个人业绩、不足反思、下一阶段计划。

## 排版工具与页型

排版用 `project/src/fusion/authoring/layout-kit.mjs` 与 `patterns.mjs`，不手算对齐坐标。每个工具返回 `{elements,height}`，按返回高度往下堆叠。完整用法见 `examples/layout-patterns.mjs` 与 `examples/report-patterns.mjs`（合成示例，每个页型一页）。

- `createTheme({palette:{bg,ink,accent,muted,line,pale,inverse},fontFamily})`、`createGrid({margin:96,columns:12,gutter:32})`：`grid.span(起始栏,栏数)` 返回 `[x,width]`。
- `metricGroup` / `metricRow({items:[{value,unit,label}],size})`：数值与单位在同一文字元素的 runs 内，名称紧贴其下；并列指标等宽同基线。
- `flow({steps:[{title,detail}]})`：编号圆点、箭头连线，标题与说明从节点左缘起排；编号固定 28px 粗体，节点不小于 48px。
- `metricTiles({items:[{value,unit,label}],size,columns,highlight})`：每个数字一个圆角色块，标签在上、数字在下，高亮项带强调色竖条与强调色数字；色块右侧空余较大时自动加一个线性图标（按标签选：喜报→文档、新签→笔、续费→循环、金额→硬币、门票、门店、大屏、场地等；大小随空余缩放，最大 180px，不足 36px 不加），空间刚好时不加；图标不能关闭，`item.icon` 只用来指定换哪个图标。图标集见 `authoring/icons.mjs`。页型默认用色块（`metricStyle:'plain'` 退回无底色数字）。
- `photoPanel({bounds,photo,title,lines,color,textSide})`：深色色块写标题、强调色短线与一到三行要点，从色块向照片渐隐过渡（`textSide:'left'` 文左图右，`'top'` 文上图下）。
- `numberedList({items:[{title,detail}],start})`（一组事项分到多栏时用 `start` 接着编号 01、02、03）、`table({columns:[{key,label,width,size,weight,color}],rows})`、`panel({bounds,fill,radius})`、`textBlock`。
- `imageRow` / `imageGrid({images:[{src,file?,size?,caption}],perRow:'auto'})`：同行等高、按原始比例分宽，不把图片放大到原始像素 2 倍以上；`auto` 会在分行与“左侧高图、右侧堆叠”拼贴中取图片面积最大且放得下的一种。真实图片用文件路径作 `src`，`imageSize(file)` 读取原始尺寸（make 会登记到图片台账）。
- `imageFill({x,y,width,height,images})`：用一行、两行或“左高右叠”拼贴铺满整个方框，每张图围绕 `focal`（默认 `50% 40%`）轻度裁切，形状改变不超过 1.45 倍；做不到时返回 null。
- `imageFrames({x,y,width,height,images,tall})`：先画框再嵌图。方框由版面决定（与左侧内容的上下边界对齐），框一定铺满，每张图裁切嵌入，自动选裁切最少的排法（一行、左高右叠或 `tall:'right'` 镜像、一列、2×2）；用 `focal` 保住人脸和关键文字。多张照片一律用它。
- `noteBar({id,x,y,width,text,label,height})`：一句收尾结论放在浅主色条上，左侧强调色竖条和短标签（默认“复盘判断”）；宽度不够一行时标签移到句子上方，`height` 让它与相邻区块底边对齐；单独悬在空白里的结论句会被 `text-orphan` 拦下。
- `sidePanel({id,bounds,figure:{label,value,unit,note},list:{title,items:[{title,detail}]}})`：深色侧栏，标题、关键数字和编号事项按面板高度铺开，编号圆标加悬挂缩进；放不下时报错。
- `fitImage({id,src,size,box})`：按原始比例放进方框并居中，不超过原始像素 2 倍；只用于单张必须完整显示的图（截图、证书），不用于照片组；`shiftX(elements,dx)` 整体平移一组元素。
- `estimateLines` / `textHeight`：中文按 1 字宽、西文按 0.55 字宽估算行数与高度。
- 汇报组件（`authoring/report-kit.mjs`，放进任何区域，值可以是数字或短语）：`answerBlock({id,x,y,width,height,label,value,unit,note})` 实心主色答案块；`comparePair({before:{label,value,unit},after:{…},note})` 目标/之前 → 实际/之后；`contrastPair({left:{title,points},right:{title,points},badge})` 两侧对照，条数可不同；`periodBand({periods,bleed})` 时期箭头色带，返回 `columns` 供下方内容对齐。`metricTiles` 的 `highlightStyle:'solid'` 把高亮项整块反白。用法与默认场景见 [汇报版式逻辑](fusion/report-layout-logic.md#7-使用方式拆成组件默认使用)。
- `kpiStrip({anchor:{label,value,unit},items:[{value,unit,label|note}],height,size})`：左端实心主色锚定块装整体数字，其余指标在浅主色带上等分、细竖线分隔，返回 `columns` 供下方内容对齐到各列。
- `colorRoles(palette)`：汇报配色职责 primary / secondary / pop / band / soft；九组汇报配色在 `authoring/report-palettes.mjs`（`reportPalette('blue-gold')`），说明见 [汇报版式逻辑](fusion/report-layout-logic.md)。

页型返回 `{elements,visualDecision}`，可把 `visualDecision` 直接写入 `contentPlan.slides[i]`；其中 `pattern` 已写好页型名。自行组合的页面写 `pattern:'free：为什么不用建议页型'`：

| 页型 | 适用 |
|---|---|
| `pageHeader({eyebrow,tag,title,focus,subtitle,page,total,source})` | 所有页的页头页脚；`focus` 是标题中要强调的一段，以 runs 着强调色；给 `tag`（如“成果数据 \| 02”）时改为左侧实心主色标签＋同行标题＋贯穿细线 |
| `targetVsActual({header,period,overall,items:[{label,target,actual,note,rate,detail}],analysis})` | 1–5 项；计划目标行与实际结果带同列对照，左端深色块给整体完成度，下方各列完成率进度条与说明（未达标用辅色） |
| `contrastColumns({header,left:{title,items},right:{title,items},badge})` | 亮点/待改进、问题/改进、今年/去年逐行对照；两侧行数不同时空出的行留白 |
| `periodColumns({header,periods:[{label,title,rate,points}],summary:{overall,items}})` | 2–6 个时期的箭头色带，每期一栏写重点与要点，底部汇总指标带 |
| `tableWithFlows({header,table,flows,note})` | 分工表加下方色带中的一到两条流程 |
| `metricsWithEvidence({header,hero,secondary,flow,notes,image})` | 主指标、次级指标行、机制流程，右侧证据图 |
| `listWithPhotos({header,items,metrics,photos,note})` | 默认的图文资源页：左侧编号资源、结果指标与复盘，右侧照片铺满整栏（先画框再裁切嵌入，任何比例都不留空隙） |
| `itemsWithPhotos({header,items:[{title,detail,photo:{src,caption,focal}}],metrics,note,highlight})` | 每项资源一栏、照片在正下方，照片一律裁切填满各自的栏框；竖图裁切较多，用 `focal` 保住主体 |
| `itemRows({header,items:[{title,detail,metric:{value,unit,label}}],photos,highlight})` | 2–5 项。事项保持纯文字编号列表；各项数据色块竖排在对应行（`highlight` 整块反白突出一项）；照片按原图比例成组（竖图竖框、横图横框），自动选图片最大的栏宽与排法，轻度裁切让边缘对齐，上下与事项区对齐。内容不足以逐项对应时用它 |
| `photoPanels({header,panels:[{title,lines,photo,color}],colors})` | 2–4 个“色块＋照片渐隐”拼板；只用于文字少、几乎无数据、每张照片对应一项的内容。拼板文字合计超过 3 个数字会报错（数据优先：改用指标色块＋照片的页型） |
| `tableWithPanel({header,table,panel:{title,chains}})` | 明细表加深色侧栏应用链 |
| `twoLaneFlow({header,lanes,conclusion})` | 两条并列流程 |

页型是起点，不是模板：可改参数、增删元素，或不用页型自行设计；内容放不下时页型会报错，按提示精简或换页型，不要缩小字号硬塞。

运行记录的浏览器就绪、渲染、QA等是程序计时，不包含完整模型制作成本。`runs.jsonl`保留多轮程序记录，不自动测量模型/平台等待。

## 候选内容关系与页面绑定（W1—W2）

显式启用 `source-baseline-v1`、`content-relations-v1`、`page-design-v1` 与 `regional-composition-v1` 后，独立原稿基线、材料节点、关系、页面区域层级与真实对齐边界进入覆盖检查；旧稿保持兼容。字段、诊断和当前限制见 [内容关系与页面绑定](content-page-contracts.md) 与 [独立基线与组合布局](composition-contracts.md)。候选功能不自动切换日常制作流程。

## 候选容量模块与三类复核（W3—W5）

- `capacity-kit.mjs` 提供 `roleGroup`、`capacityTable`、`schedule`、`capacityFlow`、`capacityCycle`（环形闭环动线）、`capacityBranch`（条件分支与返回回路图）、`allocationList`（比例分配条与主次高亮行）、`panelGroup`（等宽/非等宽比例面板、结构化数字摘要与行距自适应分配），均支持 `measureModule` 浏览器实测重排；放不下返回明确状态而不删字缩字。接口与限制见 [模块与容量处理](capacity-modules.md)。
- `createTheme` 提供统一 8 级字号体系 `theme.roles`（`heroMetric` 80、`pageTitle` 52、`keyNumber` 34、`sectionTitle` 30、`badge` 28、`metricUnit` 26、`body` 26、`tableBody` 24、`caption` 20）、`theme.roleStyle(roleName, overrides)` 与 `theme.metricRuns(value, unit, opts)`。
- 启用候选组合契约的工程支持三类复核分类（`content` / `render` / `design`）与发布状态 `releaseStatus`（`ready` / `validating` / `needs-revision` / `review-draft`），`make` / `publish:html` 支持 `--review-draft <path>` 在阻断时单独输出审阅草稿而不覆盖正式 `outFile`。
