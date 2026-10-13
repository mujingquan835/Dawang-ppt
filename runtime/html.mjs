const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const json = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
export function html(plan, project, revision) {
  const s = plan.style;
  const draw = (e) => {
    const box = `left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;`;
    const attrs = `data-element-id="${esc(e.id)}" ${e.contentRef ? `data-content-ref="${esc(e.contentRef)}"` : ""} ${e.mediaRef ? `data-media-ref="${esc(e.mediaRef)}"` : ""}`;
    if (e.type === "text")
      return `<div ${attrs} class="element text" style="${box}font-size:${e.fontSize}px;font-family:'${esc(e.fontFace)}',sans-serif;color:${e.color};font-weight:${e.bold ? 700 : 400}">${esc(e.text)}</div>`;
    if (e.type === "shape")
      return `<div ${attrs} class="element shape" style="${box}background:${e.fill}"></div>`;
    if (e.type === "line")
      return `<div ${attrs} class="element connector" style="${box}border-${e.w ? "top" : "left"}:1px solid ${e.color}">${e.arrow ? `<span style="position:absolute;right:-2px;top:-10px;color:${e.color};font-size:20px">›</span>` : ""}</div>`;
    if (e.type === "image")
      return `<img ${attrs} class="element image" alt="${esc(e.alt)}" src="${esc(e.src)}" style="${box}object-fit:${e.fit}">`;
    if (e.type === "table")
      return `<table ${attrs} class="element table" style="${box}font:${e.fontSize}px '${esc(e.fontFace)}';color:${e.color}"><thead><tr>${e.headers.map((c) => `<th style="background:${e.headerFill};color:#fff">${esc(c)}</th>`).join("")}</tr></thead><tbody>${e.rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c === null ? "缺失" : c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Dawang-PPT</title><style>
 *{box-sizing:border-box}body{margin:0;background:#e9ecf0;font-family:system-ui}#toolbar{position:sticky;top:0;z-index:100;background:#182331;color:#fff;padding:12px 24px;display:flex;gap:18px;align-items:center}button,a{cursor:pointer}#deck{display:grid;gap:24px;padding:28px;justify-content:center}.slide{position:relative;width:960px;height:540px;background:${s.background};box-shadow:0 2px 15px #0002}.element{position:absolute}.text{white-space:pre-wrap;overflow-wrap:break-word;line-height:1.25}.table{border-collapse:collapse;table-layout:fixed}.table th,.table td{padding:7px 10px;border-bottom:1px solid #ccd2d8;text-align:left;overflow-wrap:break-word}.table tr{height:38px}.element.selected{outline:2px dashed #e7a500}#editor{position:fixed;right:20px;top:75px;z-index:90;width:280px;background:white;box-shadow:0 3px 20px #0004;padding:18px;display:none}textarea{width:100%;height:140px}label{display:block;margin:10px 0}input[type=number]{width:75px}#status{font-size:13px}@media print{#toolbar,#editor{display:none}#deck{padding:0;gap:0}.slide{break-after:page;box-shadow:none}}
 </style><div id="toolbar"><b>Dawang-PPT</b><span>点击文字或图片编辑</span><button id="save">保存修改</button><a href="/api/export" style="color:white">导出 PPTX</a><span id="status">已载入</span></div><aside id="editor"><b id="label"></b><textarea id="text"></textarea><label>替换图片<input id="image" type="file" accept="image/png,image/jpeg"></label><label>字号<input id="fontSize" type="number" min="14" max="64"></label><label>X<input id="x" type="number"> Y<input id="y" type="number"></label><button id="apply">应用到草稿</button></aside><main id="deck">${plan.slides.map((slide) => `<section class="slide" data-slide-id="${esc(slide.slideId)}">${slide.elements.map(draw).join("")}</section>`).join("")}</main>
 <script id="render-plan" type="application/json">${json(plan)}</script><script>
 const state=${json({ revision, nodes: project.sources.nodes, media: project.media.items })};let selected=null,patch={texts:{},overrides:{},media:{}};
 const status=document.getElementById('status'),editor=document.getElementById('editor');
 document.querySelectorAll('.text,.image').forEach(el=>el.addEventListener('click',()=>{document.querySelector('.selected')?.classList.remove('selected');selected=el;el.classList.add('selected');editor.style.display='block';document.getElementById('label').textContent=el.dataset.elementId;
 const isText=el.classList.contains('text');document.getElementById('text').style.display=isText?'block':'none';document.getElementById('image').parentElement.style.display=isText?'none':'block';document.getElementById('text').value=el.textContent;for(const key of ['fontSize','x','y'])document.getElementById(key).value=parseFloat(key==='x'?el.style.left:key==='y'?el.style.top:el.style.fontSize)||'';
 }));
 document.getElementById('apply').onclick=()=>{if(!selected)return;const id=selected.dataset.elementId,over={x:Number(document.getElementById('x').value),y:Number(document.getElementById('y').value)};if(selected.classList.contains('text')){const n=state.nodes.find(n=>n.id===selected.dataset.contentRef);if(!n||n.kind!=='text'){status.textContent='数据文字请在源数据中编辑';return;}const value=document.getElementById('text').value;patch.texts[n.id]=value;document.querySelectorAll('[data-content-ref]').forEach(el=>{if(el.dataset.contentRef===n.id)el.textContent=value;});over.fontSize=Number(document.getElementById('fontSize').value);selected.style.fontSize=over.fontSize+'px';}patch.overrides[id]=over;selected.style.left=over.x+'px';selected.style.top=over.y+'px';status.textContent='草稿尚未保存';};
 document.getElementById('image').onchange=async event=>{if(!selected)return;const file=event.target.files[0];if(!file)return;const ref=selected.dataset.mediaRef;try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const response=await fetch('/api/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data})});const result=await response.json();if(!response.ok)throw Error(result.error);patch.media[ref]=result.src;selected.src=result.src;status.textContent='图片草稿尚未保存';}catch(e){status.textContent=e.message;}};
 document.getElementById('save').onclick=async()=>{try{const r=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,patch})});const result=await r.json();if(!r.ok)throw Error(result.error);status.textContent='已保存';location.reload();}catch(e){status.textContent=e.message+'；草稿已保留';}};
 </script></html>`;
}
