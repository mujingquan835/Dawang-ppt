import {bodyPx} from '../styles/registry.mjs';
import {semanticTextStyle,cellSemanticRole} from '../styles/text-semantics.mjs';
import { text, shape, line } from "./primitives.mjs";
function layoutTable(o, s) {
  const columns = o.data.columns || [], rows = o.data.rows || [];
  if (!columns.length) throw new Error("Table columns required");
  const [x, y, w, h] = o.bounds;
  const cols = columns.map((c) => c.columnId), rids = rows.map((r) => r.rowId);
  if (new Set(cols).size !== cols.length || new Set(rids).size !== rids.length || [...cols, ...rids].some((id) => !id)) throw new Error("Stable table IDs required");
  if (columns.some((c) => c.width !== void 0 && (!Number.isFinite(c.width) || c.width <= 0)) || rows.some((r) => r.height !== void 0 && (!Number.isFinite(r.height) || r.height <= 0))) throw new Error("Table widths/heights must be positive");
  const cw = columns.map((c) => c.width ?? 1), sum = cw.reduce((a, b) => a + b, 0), xs = [x];
  cw.forEach((v) => xs.push(xs.at(-1) + w * v / sum));
  const heights = [o.data.headerWeight ?? 1, ...rows.map((r) => r.height ?? 1)];
  const hs = heights.reduce((a, b) => a + b, 0), ys = [y];
  heights.forEach((v) => ys.push(ys.at(-1) + h * v / hs));
  const numbers = rows.flatMap((r) => columns.map((c) => r.cells[c.columnId])).filter((v) => typeof v === "number" && Number.isFinite(v));
  const heatMin = o.data.heatScale?.min ?? Math.min(...numbers), heatMax = o.data.heatScale?.max ?? Math.max(...numbers);
  if (o.data.heat && !numbers.length) throw new Error("热表缺少数值或明示色阶，不能编造热度");
  const heatColor = (v) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const t = heatMax === heatMin ? 0.5 : Math.max(0, Math.min(1, (v - heatMin) / (heatMax - heatMin)));
    return "#" + [0, 1, 2].map((i) => Math.round([240, 245, 255][i] * (1 - t) + [75, 130, 230][i] * t).toString(16).padStart(2, "0")).join("");
  };
  const es = [];
  const presentation = o.data.presentation, open = ["bands", "swimlanes"].includes(presentation);
  const header = s.palette.header || s.palette.accent;
  const font = o.layoutVersion === 2 ? Math.max(bodyPx(s), o.data.fontSize || 32) : rows.length >= 12 ? 28 : 32;
  columns.forEach((col, c) => {
    const b = [xs[c], y, xs[c + 1] - xs[c], ys[1] - y];
    es.push(shape(o, "header/" + col.columnId, b, s, { style: { fill: open ? "transparent" : header, radius: 0 } }));
    es.push(text(o, "header/" + col.columnId + "/text", col.label, [b[0] + 14, b[1] + 9, b[2] - 28, b[3] - 18], s, { contentRef: col.contentRef, style: { fontSize: font, lineHeight: 1.08, fontWeight: 700, color: open ? s.palette.accent : s.palette.onHeader || "#ffffff" } }));
  });
  const merged = /* @__PURE__ */ new Map(), covered = /* @__PURE__ */ new Set(), occupied = /* @__PURE__ */ new Set();
  for (const merge of o.data.merges || []) {
    const rs = merge.rowIds.map((id2) => rids.indexOf(id2)), cs = merge.columnIds.map((id2) => cols.indexOf(id2));
    if (!rs.length || !cs.length || [...rs, ...cs].some((i) => i < 0) || rs.some((v, i) => i && v !== rs[i - 1] + 1) || cs.some((v, i) => i && v !== cs[i - 1] + 1)) throw new Error("Merge must reference adjacent existing row/column IDs");
    const id = rids[rs[0]] + "/" + cols[cs[0]];
    merged.set(id, { r0: rs[0], r1: rs.at(-1), c0: cs[0], c1: cs.at(-1) });
    for (const r of rs) for (const c of cs) {
      const key = rids[r] + "/" + cols[c];
      if (occupied.has(key)) throw new Error("Merged table cells overlap");
      occupied.add(key);
      if (key !== id) covered.add(key);
    }
  }
  rows.forEach((row, r) => columns.forEach((col, c) => {
    const id = row.rowId + "/" + col.columnId;
    if (covered.has(id)) return;
    const merge = merged.get(id);
    const r1 = merge?.r1 ?? r, c1 = merge?.c1 ?? c;
    let cellValue = row.cells[col.columnId];
    let dataPath = ["rows", r, "cells", col.columnId];
    if (merge) {
      const mergeIndex = o.data.merges.findIndex((m) => m.rowIds[0] === row.rowId && m.columnIds[0] === col.columnId);
      const descriptor = o.data.merges[mergeIndex];
      cellValue = descriptor.text ?? descriptor.rowIds.flatMap((rid) => descriptor.columnIds.map((cid) => rows.find((r2) => r2.rowId === rid).cells[cid])).filter((v) => v !== "" && v !== void 0 && v !== null).join("\n");
      dataPath = ["merges", mergeIndex, "text"];
    }
    const b = [xs[c], ys[r + 1], xs[c1 + 1] - xs[c], ys[r1 + 2] - ys[r + 1]];
    const heat = o.data.heat ? heatColor(cellValue) : null;
    if (heat || row.emphasis || r % 2 === 0) es.push(shape(o, "cell/" + id, b, s, { style: { fill: heat || (row.emphasis ? s.palette.surface : s.palette.bg), radius: 0 } }));
    es.push(text(o, "cell/" + id + "/text", cellValue, [b[0] + 14, b[1] + 10, b[2] - 28, b[3] - 18], s, { rowId: row.rowId, columnId: col.columnId, contentRef: !merge ? row.contentRefs?.[col.columnId] : undefined, dataPath, style: { fontSize: font, lineHeight: 1.08, color: s.palette.ink, textAlign: col.numeric ? "right" : "left" } }));
    if(o.data.typographyPolicy==='semantic'){
      const primary=es.at(-1),sr=cellSemanticRole(o,row,col,cellValue),secondary=row.secondaryCells?.[col.columnId];primary.semanticRole=sr;primary.bounds[1]=b[1]+6;primary.bounds[3]=b[3]-12;primary.style={...primary.style,...semanticTextStyle(sr,s,font)};
      if(secondary){const cm=o.data.cellMetrics?.[id]||{primaryHeight:44,secondaryHeight:36};primary.bounds[3]=cm.primaryHeight;
        es.push(text(o,'cell/'+id+'/secondary',secondary.text,[b[0]+14,b[1]+6+cm.primaryHeight+4,b[2]-28,cm.secondaryHeight],s,{rowId:row.rowId,columnId:col.columnId,semanticRole:secondary.semanticRole||'support',contentRef:secondary.contentRef,dataPath:['rows',r,'secondaryCells',col.columnId,'text'],style:semanticTextStyle(secondary.semanticRole||'support',s,bodyPx(s))}));
      }
    }
    es.push(line(o, "cell/" + id + "/bottom", [b[0], b[1] + b[3]], [b[0] + b[2], b[1] + b[3]], s, { style: { stroke: s.palette.line, strokeWidth: 1 } }));
    if (!open && !s.table?.noVerticalRules) es.push(line(o, "cell/" + id + "/right", [b[0] + b[2], b[1]], [b[0] + b[2], b[1] + b[3]], s, { style: { stroke: s.palette.line, strokeWidth: 1 } }));
  }));
  if (presentation === "swimlanes") {
    es.push(line(o, "time-axis", [xs[1], ys[1]-3], [x+w, ys[1]-3], s, {endArrow:"triangle",style:{stroke:s.palette.accent,strokeWidth:2}}));
    for(let c=1;c<columns.length;c++)es.push(shape(o,"time-node/"+cols[c],[xs[c]+14,ys[1]-8,10,10],s,{shape:"ellipse",style:{fill:s.palette.accent,radius:999}}));
  }
  if(open) for(const e of es) {
    if(e.type==='text'&&e.columnId===cols[0]&&o.data.typographyPolicy!=='semantic')e.style.fontWeight=700;
    if(e.type==='line')e.style.stroke=o.data.typographyPolicy==='semantic'?s.palette.line:presentation==='swimlanes'?s.palette.line:s.palette.accent;
    if(e.type==='shape'&&e.id.includes('/cell/'))e.style.stroke=undefined;
  }
  if(o.data.typographyPolicy==='semantic')for(const e of es){if(e.id.includes('/header/')&&e.type==='text'){const col=columns.find(c=>e.id.endsWith('/'+c.columnId+'/text'));e.style={...e.style,...semanticTextStyle(col?.headerRole||'context',s,bodyPx(s)),fontWeight:600,...!open?{color:s.palette.onHeader||'#ffffff'}:{}};e.bounds[1]=y+6;e.bounds[3]=ys[1]-y-12;}}
  return es;
}
export {
  layoutTable
};
