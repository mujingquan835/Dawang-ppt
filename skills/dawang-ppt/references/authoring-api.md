# 工程编写速查

自然语言任务由制作智能体完成材料理解、原文规则读取、内容策划和自主设计；不要求用户填写 JSON。

调用 `node <skill>/scripts/dawang.mjs rules:read management-report [--design <本机文档>] [--format <本机文档> ...]` 获取本版完整制作规则、场景说明、来源SHA与章节正文。规则随包提供；`rules:lock`仅用于维护者审核规则后更新本版指纹。缓存不能代替本会话阅读。

完整合成工程：`node <skill>/examples/authored-minimal.mjs /tmp/authored.json`。
推荐交付：`node <skill>/scripts/dawang.mjs make /tmp/authored.json /目标/报告.html`。
已存工程用 `patch:project <工程目录> <patch.json>`，之后 `publish:html <工程目录> <报告.html>`；旧工程低层入口 `render:project <deck-project.json> <index.html>` 保留。

- `textElement({id,text?,runs?,bounds,style?,contentRef?})`，runs 的每项为 `{text,style?}`。
- `imageElement({id,src?,mediaRef?,bounds,fit?,crop?,focal?})`，原图保留，crop 为归一化 `[x,y,w,h]`。
- `lineElement({id,from:[x,y],to:[x,y],style?})`，自动计算正 bounds 与相对端点。
- 外观配色写在 `designChoice.appearance.palette`（全稿默认，键为 bg/ink/muted/accent/line）；某页不同时在该页写 `slides[i].appearance.palette`，只覆盖写出的键。页面背景只来自 palette.bg，未写时为白底；深色设计必须写 bg，不能只把文字设成浅色。
- 重点句写在 `contentPlan`：`throughLine:{placements:[{slideId,elementId}],source,from?|support?}` 为全稿定位句，至少放在首页或末页；`slides[i].keyLine:{elementId,source,from?|support?}` 为该页重点句，确无重点时写 `{waived:'理由'}`。`source` 取 `quoted`（原材料原句，`from` 写出处）、`distilled`（由事实提炼）或 `created`（AI 新写），后两者 `support` 列出所依据的事实，不得新增事实或最高级说法。`authorNotes:[{text,reason}]` 列出只给作者看、不上屏的材料。完整样例见 examples/authored-minimal.mjs。
- 元素 `bounds` 为逻辑 CSS px `[x,y,width,height]`；画布 1920×1080，CSS64px 在PPTX中为32pt。字号、间距使用逻辑 px，lineHeight 为倍数；不自动缩字。
- `text:measure <specs.json>` 批量接受文字元素字段，返回真实字体高度/宽度/自然宽度/字体可用性；缺字体报 `font-unavailable`，关闭临时浏览器。样例可任意更改构图，直接 elements 与自定义样式始终可用。
- patch 为 `{expectedRevision,commands:[{type:'text',slideId,elementId,text}]}`；commands 与编辑器一致，富文本清空必须显式 `resetRuns:true`。整批失败不写盘，冲突保留双方。
- `check <工程目录> [--slides id1,id2] [--screenshots <目录>]`。最终发布全稿检查，内容判断与实际看图检查仍需执行；仅显式 screenshots 才长期保留截图。检查按文字下方实际铺色（先前绘制的纯色形状，再到页面背景）计算对比度：低于 3:1 为 `low-contrast` 错误（新制作阻断）；常规字号低于 4.5:1 列入 `warnings`。压在图片、渐变或 vector 上的文字不计算，需看图确认。重点句检查（新制作为错误，旧工程仅警告）：缺 keyLine/throughLine、依据缺失、keyLine 字号不在本页前两级、定位句不在首末页、authorNotes 内容出现在页面（按字符相似度，改写措辞同样命中）；重点句过长仅警告。结果的 `contentReview` 列出定位句、每页重点句及 created 句。

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

运行记录的浏览器就绪、渲染、QA等是程序计时，不包含完整模型制作成本。`runs.jsonl`保留多轮程序记录，不自动测量模型/平台等待。
