import { materializeElements } from "../scene/model.mjs";
const inspectorSections = new Map();
const FOCUSABLE = "input,select,button,summary";
// A rebuild replaces every control; remember which one had focus (or where Tab was heading) by position.
let pendingFocus = null;
const focusables = root => [...root.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null);
function mountInspector(panel, selection, api) {
  const previous = panel.querySelector("#fusion-inspector");
  const sameTarget = previous?.dataset.selection === selection.slideId + "/" + selection.elementId;
  const active = previous?.contains(document.activeElement) ? focusables(previous).indexOf(document.activeElement) : -1;
  const restoreFocus = sameTarget ? (pendingFocus ?? (active >= 0 ? active : null)) : null;
  pendingFocus = null;
  const expanded = new Map([...panel.querySelectorAll('#fusion-inspector details')].map(el => [el.id,el.open]));
  for(const [id,open] of expanded)inspectorSections.set(id,open);
  panel.querySelector("#fusion-inspector")?.remove();
  const box = document.createElement("div");
  box.id = "fusion-inspector";
  box.dataset.selection = selection.slideId + "/" + selection.elementId;
  if (restoreFocus !== null) queueMicrotask(() => { if (box.isConnected) focusables(box)[restoreFocus]?.focus(); });
  box.style.cssText = "display:grid;gap:16px;padding-top:12px;font:500 13px/1.4 var(--sans-zh);color:var(--pp-fg)";
  panel.append(box);
  let container = box;
  const section = (id, title, open = false) => {
    const details = document.createElement('details');
    details.id = id; details.open = expanded.get(id) ?? inspectorSections.get(id) ?? open;
    details.addEventListener('toggle',()=>inspectorSections.set(id,details.open));
    const summary = document.createElement('summary'); summary.textContent = title;
    details.append(summary); box.append(details);
    const content = document.createElement('div'); content.style.cssText='display:grid;gap:12px;padding-top:12px';details.append(content);
    return content;
  };
  const project = api.getProject();
  const slide = project.slides.find((s) => s.slideId === selection.slideId);
  if (!slide) return;
  const elements = materializeElements(slide, project);
  const e = elements.find((e2) => e2.id === selection.elementId);
  const o = slide.objects?.find((o2) => o2.objectId === e?.parentId);
  if (!e) return;
  const button = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "preview-prop-choice fusion-action";
    b.textContent = label;
    b.onclick = fn;
    container.append(b);
    return b;
  };
  const field = (label, value, fn, type = "text") => {
    const row = document.createElement("label");
    row.className = "preview-prop-row";
    const caption = document.createElement("span");
    caption.textContent = label;
    row.append(caption);
    const input = document.createElement("input");
    input.type = type;
    input.setAttribute('aria-label',label);
    input.value = value ?? "";
    input.className = "fusion-input";
    input.style.cssText = "width:100%;min-width:0";
    const commit = () => {
      if (type === 'number' && (input.value === '' || !input.validity.valid)) return;
      fn(type === 'number' ? Number(input.value) : input.value);
    };
    input.onchange = commit;
    input.onkeydown = event => {
      if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
      if (event.key === 'Tab' && type !== 'file') {
        // Commit first; the rebuild that follows lands focus on the next control.
        const list = focusables(box), next = list.indexOf(input) + (event.shiftKey ? -1 : 1);
        if (next < 0 || next >= list.length) { event.stopPropagation(); return; }
        event.preventDefault();
        pendingFocus = next;
        input.blur();
        if (box.isConnected) { const target = focusables(box)[pendingFocus]; pendingFocus = null; target?.focus(); }
      }
      event.stopPropagation();
    };
    row.append(input);
    container.append(row);
    return input;
  };
  const select = (label, value, options, fn) => {
    const row = document.createElement("label");
    row.className = "preview-prop-row";
    const caption = document.createElement("span");
    caption.textContent = label;
    row.append(caption);
    const input = document.createElement("select");
    input.setAttribute('aria-label',label);
    for (const option of options) {
      const v = Array.isArray(option) ? option[0] : option, t = Array.isArray(option) ? option[1] : option;
      input.add(new Option(t, v));
    }
    input.value = value;
    input.onchange = () => fn(input.value);
    row.append(input);
    container.append(row);
    return input;
  };
  const apply = (cmd) => api.apply({ ...selection, ...cmd });
  const latestElement = () => {
    const project = api.getProject();
    return materializeElements(project.slides.find(s => s.slideId === selection.slideId),project).find(x => x.id === selection.elementId);
  };
  const current = () => api.getProject().slides.find((s) => s.slideId === selection.slideId).objects.find((x) => x.objectId === o.objectId);
  const semantic = (data, relationships) => apply({ type: "semantic", objectId: o.objectId, data, relationships });
  const head = document.createElement("strong");
  head.textContent = o ? "组合对象 · " + o.kind : "页面元素 · " + e.type;
  box.append(head);
  if (!document.getElementById("fusion-inspector-css")) {
    const css = document.createElement("style");
    css.id = "fusion-inspector-css";
    css.textContent = "#fusion-inspector summary{cursor:pointer;font-weight:650;color:var(--pp-fg)}#fusion-inspector details{border-top:1px solid var(--pp-border);padding-top:12px}#fusion-inspector .fusion-action{width:100%;justify-content:center;min-height:36px;padding:8px 12px;font:500 12px/1.3 var(--sans-zh);border:1px solid var(--pp-border);border-radius:8px;background:var(--pp-chip);color:var(--pp-fg);cursor:pointer}#fusion-inspector .fusion-action:hover{background:var(--pp-blue-soft)}#fusion-inspector .fusion-input{height:38px;border:1px solid var(--pp-border);border-radius:8px;background:var(--pp-bg);color:var(--pp-fg);padding:0 10px;font:500 13px/1.3 var(--sans-zh)}#fusion-inspector select{height:38px;font:500 12px/1.3 var(--sans-zh);padding:0 28px 0 10px}#fusion-inspector .fusion-input:focus{outline:2px solid var(--pp-blue-soft);border-color:var(--pp-blue)}";
    document.head.append(css);
  }
  const group = select("选择范围", api.selectionMode(), [["group", "整组"], ["element", "子对象"]], (value) => {
    api.selectionMode(value);
    api.refreshSelection();
  });
  if (!o) group.disabled = true;
  if (e.type === "text") {
    container = section('fusion-text-properties','文字属性',true);
    const textStyle = style => apply({type:'style',style,textScope:'all-runs'});
    const families = ['OPPO Sans 4.0','Arial','Microsoft YaHei','SimSun','SimHei','DengXian','Source Han Sans SC','PingFang SC','KaiTi','Times New Roman'];
    const currentFont = e.manualStyle?.fontFamily || e.style?.fontFamily || '';
    const fonts = [...new Set([currentFont,...families].filter(Boolean))];
    select('字体',currentFont, [['','跟随全稿字体'],...fonts.map(font => [font,font])], fontFamily => textStyle({fontFamily}));
    field('自定义本机字体',currentFont,fontFamily => textStyle({fontFamily:fontFamily.trim().replace(/[;{}<>]/g,'')}));
    const mixed = key => e.runs && new Set(e.runs.map(run => run.style?.[key] ?? e.style?.[key])).size > 1;
    const effectiveSize = e.runs?.[0]?.style?.fontSize ?? e.style?.fontSize ?? 34;
    const size = field('字号（pt）',effectiveSize/2,fontSize => { if(fontSize>0) textStyle({fontSize:fontSize*2}); },'number');
    size.min='0.5';size.step='0.5';
    if(mixed('fontSize'))size.title='当前包含多个字号，修改后统一应用';
    const colorValue = e.runs?.[0]?.style?.color || e.style?.color || '#111111';
    const color = field('文字颜色',/^#[0-9a-f]{6}$/i.test(colorValue)?colorValue:'#111111',color => textStyle({color}),'color');
    if(mixed('color')){
      const note=document.createElement('small');note.textContent='当前为多种颜色；修改文字颜色将统一整段。';container.append(note);
    }
    select('对齐',e.style.textAlign || 'left', [['left','左对齐'],['center','居中'],['right','右对齐']], textAlign => textStyle({textAlign}));
    if(e.runs){
      container = section('fusion-text-runs','分段文字与样式');
      e.runs.forEach((run,index)=>{
        const update=patch=>{const runs=structuredClone(latestElement().runs);runs[index]={...runs[index],...patch};apply({type:'text-runs',runs});};
        const input=field(`文字段 ${index+1}`,run.text,text=>update({text}));input.dataset.runIndex=String(index);
        const color=field(`段 ${index+1} 颜色`,run.style?.color||e.style?.color||'#111111',color=>update({style:{...latestElement().runs[index].style,color}}),'color');color.dataset.runColor=String(index);
        select(`段 ${index+1} 字重`,String(run.style?.fontWeight||400),[['400','常规'],['600','中粗'],['700','粗体']],value=>update({style:{...latestElement().runs[index].style,fontWeight:Number(value)}}));
      });
      button('转为纯文本（清除句内样式）',()=>apply({type:'text',text:latestElement().text,resetRuns:true}));
    }else field('文字',e.text,text=>apply({type:'text',text}));
    container = box;
  }
  if (e.type === "shape") {
    field("填充颜色", e.style.fill || "#ffffff", (fill) => apply({ type: "style", style: { fill } }), "color");
    field("边框颜色", e.style.stroke || "#111111", (stroke) => apply({ type: "style", style: { stroke } }), "color");
    field("边框宽度", e.style.strokeWidth || 1, (strokeWidth) => apply({ type: "style", style: { strokeWidth } }), "number");
  }
  if (e.type === "line" || e.type === "vector") {
    field("线条颜色", e.style.stroke || "#111111", (stroke) => apply({ type: "style", style: { stroke } }), "color");
    field("线条宽度", e.style.strokeWidth || 3, (strokeWidth) => apply({ type: "style", style: { strokeWidth } }), "number");
  }
  if (e.type === "image") {
    const file = field("替换图片", "", () => {
    }, "file");
    file.id = "fusion-image-input";
    file.accept = "image/*";
    file.onchange = async () => {
      const image = file.files[0];
      if (!image) return;
      const src = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.readAsDataURL(image);
      });
      apply({ type: "image", src });
    };
    select('图片展示',e.crop?'crop':e.fit||'contain',[['contain','完整展示'],['cover','填满'],['crop','裁切…']],fit=>{
      if(fit==='crop')api.beginCrop(selection);
      else apply({type:'image',src:latestElement().src,fit,crop:null});
    });
    button('裁切图片',()=>api.beginCrop(selection));
  }
  container = section('fusion-layers','图层');
  button("置于前层", () => apply({ type: "layer", direction: "front", objectId: o?.objectId }));
  button("置于后层", () => apply({ type: "layer", direction: "back", objectId: o?.objectId }));
  container = box;
  if (!o) return;
  const editItem = (key, id, idField, fieldName, value) => {
    const data = structuredClone(current().data), item = data[key].find((n) => n[idField] === id);
    item[fieldName] = value;
    if (fieldName === "label") delete item.contentRef;
    semantic(data);
  };
  if (o.kind === "matrix") {
    field("矩阵列数", o.data.columns || 2, (columns) => semantic({ ...current().data, columns }), "number");
    field("矩阵行数", o.data.rows || Math.ceil(o.data.nodes.length / (o.data.columns || 2)), (rows) => semantic({ ...current().data, rows }), "number");
    for (let i = 0; i < (o.data.columns || 2); i++) field("列标 " + (i + 1), o.data.columnLabels?.[i] || "", (value) => {
      const data = structuredClone(current().data);
      data.columnLabels = data.columnLabels || [];
      data.columnLabels[i] = value;
      semantic(data);
    });
    for (let i = 0; i < (o.data.rows || 2); i++) field("行标 " + (i + 1), o.data.rowLabels?.[i] || "", (value) => {
      const data = structuredClone(current().data);
      data.rowLabels = data.rowLabels || [];
      data.rowLabels[i] = value;
      semantic(data);
    });
  }
  if (o.data.nodes) {
    if (o.kind === "timeline") {
      select("方向", o.data.direction || "horizontal", [["horizontal", "横向"], ["vertical", "纵向"], ["alternating", "上下交替"]], (direction) => semantic({ ...current().data, direction }));
      select("分布", o.data.distribution || "sequence", [["sequence", "顺序均布"], ["date", "按日期比例"]], (distribution) => semantic({ ...current().data, distribution }));
    }
    o.data.nodes.forEach((node, i) => {
      field(`节点 ${i + 1}`, node.label, (v) => editItem("nodes", node.nodeId, "nodeId", "label", v));
      field(`节点 ${i + 1} 说明`, node.detail, (v) => editItem("nodes", node.nodeId, "nodeId", "detail", v));
      if (o.kind === "timeline") {
        field(`节点 ${i + 1} 日期`, node.date, (v) => editItem("nodes", node.nodeId, "nodeId", "date", v));
      }
      button("上移节点 " + (i + 1), () => {
        const data = structuredClone(current().data), index = data.nodes.findIndex((n) => n.nodeId === node.nodeId);
        if (index > 0) [data.nodes[index], data.nodes[index - 1]] = [data.nodes[index - 1], data.nodes[index]];
        semantic(data);
      });
      button("删除节点 " + (i + 1), () => {
        const object = current(), data = structuredClone(object.data);
        data.nodes = data.nodes.filter((n) => n.nodeId !== node.nodeId);
        semantic(data, (object.relationships || []).filter((r) => r.from !== node.nodeId && r.to !== node.nodeId));
      });
    });
    button("添加节点", () => {
      const data = structuredClone(current().data);
      data.nodes.push({ nodeId: crypto.randomUUID(), label: "新节点", date: "", detail: "" });
      semantic(data);
    });
    if (!["timeline", "matrix", "comparison"].includes(o.kind)) {
      const opts = o.data.nodes.map((n, i) => [n.nodeId, `${i + 1}. ${n.label || "未命名节点"}`]);
      const nodeName = (id) => opts.find(([v]) => v === id)?.[1] || "已删除节点";
      const from = select("连接起点", opts[0][0], opts, () => {
      }), to = select("连接终点", opts.at(-1)[0], opts, () => {
      });
      button("添加连接", () => {
        const object = current();
        semantic(object.data, [...object.relationships || [], { relationshipId: crypto.randomUUID(), from: from.value, to: to.value }]);
      });
      for (const r of o.relationships || []) button("删除连接：" + nodeName(r.from) + " → " + nodeName(r.to), () => {
        const object = current();
        semantic(object.data, object.relationships.filter((x) => x.relationshipId !== r.relationshipId));
      });
    }
  }
  if (o.kind === "table") {
    const cols = o.data.columns;
    const rowName = (index) => `第 ${index + 1} 行`;
    cols.forEach((col, colIndex) => {
      field(`第 ${colIndex + 1} 列 · 列名`, col.label, (v) => editItem("columns", col.columnId, "columnId", "label", v));
      field(`第 ${colIndex + 1} 列 · 列宽比例`, col.width || 1, (v) => editItem("columns", col.columnId, "columnId", "width", v), "number");
      button(`删除第 ${colIndex + 1} 列`, () => {
        const data = structuredClone(current().data);
        data.columns = data.columns.filter((c) => c.columnId !== col.columnId);
        semantic(data);
      });
    });
    o.data.rows.forEach((row, rowIndex) => {
      for (const col of cols) field(rowName(rowIndex) + " · " + (col.label || "未命名列"), row.cells[col.columnId], (value) => {
        const data = structuredClone(current().data);
        data.rows.find((r) => r.rowId === row.rowId).cells[col.columnId] = value;
        semantic(data);
      });
      field(rowName(rowIndex) + " · 行高比例", row.height || 1, (v) => editItem("rows", row.rowId, "rowId", "height", v), "number");
      button(`删除${rowName(rowIndex)}`, () => {
        const data = structuredClone(current().data);
        data.rows = data.rows.filter((r) => r.rowId !== row.rowId);
        semantic(data);
      });
    });
    button("添加行", () => {
      const data = structuredClone(current().data);
      data.rows.push({ rowId: crypto.randomUUID(), cells: Object.fromEntries(data.columns.map((c) => [c.columnId, ""])) });
      semantic(data);
    });
    button("添加列", () => {
      const data = structuredClone(current().data);
      data.columns.push({ columnId: crypto.randomUUID(), label: "新列", width: 1 });
      semantic(data);
    });
    if (o.data.rows.length && cols.length > 1) {
      const row = select("起始行", o.data.rows[0].rowId, o.data.rows.map((r, i) => [r.rowId, rowName(i)]), () => {
      }), rowEnd = select("结束行", o.data.rows[0].rowId, o.data.rows.map((r, i) => [r.rowId, rowName(i)]), () => {
      }), col1 = select("起始列", cols[0].columnId, cols.map((c, i) => [c.columnId, `第 ${i + 1} 列 ${c.label || ""}`.trim()]), () => {
      }), col2 = select("结束列", cols.at(-1).columnId, cols.map((c, i) => [c.columnId, `第 ${i + 1} 列 ${c.label || ""}`.trim()]), () => {
      });
      button("合并所选单元格", () => {
        const data = structuredClone(current().data), a = data.columns.findIndex((c) => c.columnId === col1.value), b = data.columns.findIndex((c) => c.columnId === col2.value);
        data.merges = [...data.merges || [], { rowIds: data.rows.slice(Math.min(data.rows.findIndex((r) => r.rowId === row.value), data.rows.findIndex((r) => r.rowId === rowEnd.value)), Math.max(data.rows.findIndex((r) => r.rowId === row.value), data.rows.findIndex((r) => r.rowId === rowEnd.value)) + 1).map((r) => r.rowId), columnIds: data.columns.slice(Math.min(a, b), Math.max(a, b) + 1).map((c) => c.columnId) }];
        semantic(data);
      });
      button("拆分全部合并单元格", () => semantic({ ...current().data, merges: [] }));
    }
  }
  if (["bar", "line"].includes(o.kind)) {
    field("单位", o.data.unit, (value) => semantic({ ...current().data, unit: value }));
    field("时期", o.data.period, (value) => semantic({ ...current().data, period: value }));
    for (const point of o.data.series) {
      field(point.label, point.value, (value) => editItem("series", point.nodeId, "nodeId", "value", value), "number");
    }
    button("添加数据项", () => {
      const data = structuredClone(current().data);
      data.series.push({ nodeId: crypto.randomUUID(), label: "新数据项", value: null });
      semantic(data);
    });
  }
  if (o.kind === "images") {
    select("图片组合", o.data.arrangement || "single", [["single", "单图"], ["text-photo", "图文并排"], ["primary-secondary", "主图＋副图"], ["grid", "网格"], ["full-bleed", "满版出血"]], (arrangement) => semantic({ ...current().data, arrangement }));
    o.data.images.forEach((image, imageIndex) => {
      if (imageIndex === 0) return;
      button(`设图片 ${imageIndex + 1} 为主图`, () => {
        const data = structuredClone(current().data), index = data.images.findIndex((i) => i.mediaId === image.mediaId);
        data.images.unshift(...data.images.splice(index, 1));
        semantic(data);
      });
    });
  }
}
export {
  mountInspector
};
