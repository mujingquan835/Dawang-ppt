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
- 元素 `bounds` 为逻辑 CSS px `[x,y,width,height]`；画布 1920×1080，CSS64px 在PPTX中为32pt。字号、间距使用逻辑 px，lineHeight 为倍数；不自动缩字。
- `text:measure <specs.json>` 批量接受文字元素字段，返回真实字体高度/宽度/自然宽度/字体可用性；缺字体报 `font-unavailable`，关闭临时浏览器。样例可任意更改构图，直接 elements 与自定义样式始终可用。
- patch 为 `{expectedRevision,commands:[{type:'text',slideId,elementId,text}]}`；commands 与编辑器一致，富文本清空必须显式 `resetRuns:true`。整批失败不写盘，冲突保留双方。
- `check <工程目录> [--slides id1,id2] [--screenshots <目录>]`。最终发布全稿检查，内容判断与实际看图检查仍需执行；仅显式 screenshots 才长期保留截图。检查按文字下方实际铺色（先前绘制的纯色形状，再到页面背景）计算对比度：低于 3:1 为 `low-contrast` 错误（新制作阻断）；常规字号低于 4.5:1 列入 `warnings`。压在图片、渐变或 vector 上的文字不计算，需看图确认。
