import { text, shape, line, uniqueNodes, applyOverrides } from "./primitives.mjs";
function layoutDiagram(o, s) {
  const nodes = o.data.nodes || [];
  uniqueNodes(nodes);
  if (!nodes.length) throw new Error("Diagram nodes required");
  let [x, y, w, h] = o.bounds;
  const kind = o.kind, n = nodes.length;
  let boxes = [];
  const relationships = o.relationships || [];
  for (const r of relationships) if (!nodes.some((n2) => n2.nodeId === r.from) || !nodes.some((n2) => n2.nodeId === r.to)) throw new Error("dangling relationship " + r.relationshipId);
  const headers = [];
  if (kind === "matrix" && (o.data.columnLabels?.length || o.data.rowLabels?.length)) {
    const cols = o.data.columns ?? 2, rows = o.data.rows ?? Math.ceil(n / cols), ox = x, oy = y, ow = w, oh = h;
    const left = o.data.rowLabels?.length ? 120 : 0, top = o.data.columnLabels?.length ? 60 : 0;
    x += left;
    y += top;
    w -= left;
    h -= top;
    (o.data.columnLabels || []).forEach((label, i) => headers.push(text(o, "column-label/" + i, label, [x + i * w / cols, oy, w / cols, 50], s, { dataPath: ["columnLabels", i], style: { fontSize: 28, color: s.palette.muted, textAlign: "center" } })));
    (o.data.rowLabels || []).forEach((label, i) => headers.push(text(o, "row-label/" + i, label, [ox, y + i * h / rows + 20, left - 10, h / rows - 40], s, { dataPath: ["rowLabels", i], style: { fontSize: 28, color: s.palette.muted } })));
  }
  if (kind === "cycle") {
    const bw = Math.min(300, w * 0.24), bh = 130;
    boxes = nodes.map((_, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / n;
      return [x + w / 2 + Math.cos(a) * (w - bw) * 0.39 - bw / 2, y + h / 2 + Math.sin(a) * (h - bh) * 0.39 - bh / 2, bw, bh];
    });
  } else if (kind === "hierarchy") {
    const levels = new Map(nodes.map((n2) => [n2.nodeId, 0]));
    for (let k = 0; k < n; k++) {
      let changed = false;
      for (const r of relationships) {
        const value = levels.get(r.from) + 1;
        if (value > levels.get(r.to)) {
          levels.set(r.to, value);
          changed = true;
        }
      }
      if (!changed) break;
      if (k === n - 1) throw new Error("Hierarchy has a cycle");
    }
    const max = Math.max(...levels.values());
    boxes = nodes.map((node) => {
      const group = nodes.filter((n2) => levels.get(n2.nodeId) === levels.get(node.nodeId));
      const i = group.indexOf(node), bw = Math.min(400, w / group.length - 30), bh = Math.min(150, h / (max + 1) - 40);
      return [x + (i + 0.5) * w / group.length - bw / 2, y + levels.get(node.nodeId) * h / (max + 1), bw, bh];
    });
  } else if (kind === "matrix") {
    const cols = o.data.columns ?? 2, rows = o.data.rows ?? Math.ceil(n / cols);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || n > cols * rows) throw new Error("Matrix rows/columns cannot contain the required nodes");
    for (const node of nodes) if ((node.column ?? 0) >= cols || (node.row ?? 0) >= rows) throw new Error("Matrix node outside row/column range");
    boxes = nodes.map((node, i) => [x + (node.column ?? i % cols) * w / cols + 16, y + (node.row ?? Math.floor(i / cols)) * h / rows + 16, w / cols - 32, h / rows - 32]);
  } else if (kind === "comparison") {
    boxes = nodes.map((_, i) => o.data.direction === "vertical" ? [x + 24, y + i * h / n + 20, w - 48, h / n - 40] : [x + i * w / n + 24, y + 90, w / n - 48, h - 180]);
  } else {
    const vertical = o.data.direction === "vertical";
    boxes = nodes.map((_, i) => vertical ? [x + w * 0.2, y + i * h / n, w * 0.6, h / n - 26] : [x + i * w / n + 16, y + h * 0.35, w / n - 32, h * 0.28]);
  }
  function nodeTexts(node, i, b) {
    const compact = b[3] < 150, hasDetail = !!node.detail;
    const labelBounds = [b[0] + 22, b[1] + (compact ? 12 : 20), b[2] - 44, hasDetail ? compact ? 38 : 50 : b[3] - 40];
    return [text(o, `node/${node.nodeId}/label`, node.label, labelBounds, s, { nodeId: node.nodeId, contentRef: node.contentRef, dataPath: ["nodes", i, "label"], style: { fontSize: n >= 9 ? 26 : compact ? 30 : 34, lineHeight: 1.12, color: s.palette.ink } }), ...hasDetail ? [text(o, `node/${node.nodeId}/detail`, node.detail, [b[0] + 22, b[1] + (compact ? 54 : 78), b[2] - 44, b[3] - (compact ? 64 : 94)], s, { nodeId: node.nodeId, dataPath: ["nodes", i, "detail"], style: { fontSize: n >= 9 ? 22 : compact ? 24 : 28, lineHeight: 1.1, color: s.palette.muted } })] : []];
  }
  let es = nodes.flatMap((node, i) => {
    const b = boxes[i];
    return [shape(o, `node/${node.nodeId}/shape`, b, s, { nodeId: node.nodeId, style: { fill: s.diagram.nodeColors?.[node.level ?? i % s.diagram.nodeColors.length] || s.palette.surface, stroke: s.diagram.nodeColors ? "#202124" : s.palette.line, strokeWidth: s.diagram.lineWidth, radius: s.diagram.radius } }), ...nodeTexts(node, i, b)];
  });
  es = applyOverrides(es, o);
  nodes.forEach((node, i) => {
    const override = o.overrides?.[`${o.objectId}/node/${node.nodeId}/shape`]?.bounds;
    if (override) {
      for (const t of nodeTexts(node, i, override)) if (!o.overrides?.[t.id]?.bounds) es.find((e) => e.id === t.id).bounds = t.bounds;
    }
  });
  const boxOf = (id) => es.find((e) => e.id === `${o.objectId}/node/${id}/shape`).bounds;
  const edges = o.relationshipPolicy !== "sequence" && Object.hasOwn(o, "relationships") ? relationships : kind === "process" || kind === "causal" ? nodes.slice(1).map((node, i) => ({ relationshipId: nodes[i].nodeId + "-" + node.nodeId, from: nodes[i].nodeId, to: node.nodeId })) : kind === "cycle" ? nodes.map((node, i) => ({ relationshipId: node.nodeId + "-next", from: node.nodeId, to: nodes[(i + 1) % n].nodeId })) : [];
  const links = edges.flatMap((r) => {
    const a = boxOf(r.from), b = boxOf(r.to);
    const ac = [a[0] + a[2] / 2, a[1] + a[3] / 2], bc = [b[0] + b[2] / 2, b[1] + b[3] / 2];
    const dx = bc[0] - ac[0], dy = bc[1] - ac[1];
    const t1 = 1 / Math.max(Math.abs(dx) / (a[2] / 2), Math.abs(dy) / (a[3] / 2), 1), t2 = 1 / Math.max(Math.abs(dx) / (b[2] / 2), Math.abs(dy) / (b[3] / 2), 1);
    const start = [ac[0] + dx * t1, ac[1] + dy * t1], end = [bc[0] - dx * t2, bc[1] - dy * t2];
    const intersects = nodes.filter((n2) => n2.nodeId !== r.from && n2.nodeId !== r.to).some((n2) => {
      const c = boxOf(n2.nodeId);
      for (let k = 1; k < 100; k++) {
        const px = start[0] + (end[0] - start[0]) * k / 100, py = start[1] + (end[1] - start[1]) * k / 100;
        if (px > c[0] && px < c[0] + c[2] && py > c[1] && py < c[1] + c[3]) return true;
      }
      return false;
    });
    const meta = { relationshipId: r.relationshipId, fromNodeId: r.from, toNodeId: r.to };
    if (!intersects) return [line(o, "link/" + r.relationshipId, start, end, s, { ...meta, endArrow: "triangle" })];
    const lane = Math.max(y + 30, Math.min(...nodes.map((n2) => boxOf(n2.nodeId)[1])) - 55);
    const pts = [[ac[0], a[1]], [ac[0], lane], [bc[0], lane], [bc[0], b[1]]];
    return pts.slice(1).map((pt, i) => line(o, "link/" + r.relationshipId + "/" + i, pts[i], pt, s, { ...meta, endArrow: i === 2 ? "triangle" : void 0 }));
    ;
  });
  return [...headers, ...links, ...es];
}
export {
  layoutDiagram
};
