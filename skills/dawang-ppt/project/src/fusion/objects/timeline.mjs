import { text, shape, line, uniqueNodes } from "./primitives.mjs";
function layoutTimeline(o, s) {
  const nodes = o.data.nodes || [];
  uniqueNodes(nodes);
  if (nodes.length < 2) throw new Error("Timeline requires at least two nodes");
  const [x, y, w, h] = o.bounds;
  const direction = o.data.direction || "horizontal";
  const compact = h < 550;
  const n = nodes.length, vertical = direction === "vertical";
  const alternating = direction === "alternating";
  const es = [];
  const times = nodes.map((n2) => Date.parse(n2.date));
  let positions = nodes.map((_, i) => i / (n - 1));
  if (o.data.distribution === "date") {
    if (times.some((t) => !Number.isFinite(t))) throw new Error("Date distribution needs valid dates");
    const min = Math.min(...times), max = Math.max(...times);
    if (min === max) throw new Error("Timeline dates have zero span");
    positions = times.map((t) => (t - min) / (max - min));
  }
  const padding = vertical ? 45 : 110;
  const span = (vertical ? h : w) - padding * 2;
  const anchors = positions.map((p) => vertical ? [x + w * 0.3, y + padding + p * span] : [x + padding + p * span, y + h * 0.48]);
  es.push(line(o, "axis", vertical ? [x + w * 0.3, y + padding] : [x + padding, y + h * 0.48], vertical ? [x + w * 0.3, y + h - padding] : [x + w - padding, y + h * 0.48], s, { style: { stroke: s.palette.line, strokeWidth: 3 } }));
  nodes.forEach((node, i) => {
    const [cx, cy] = anchors[i];
    const emphasize = node.nodeId === o.data.emphasisId;
    es.push(shape(o, `${node.nodeId}/dot`, [cx - 10, cy - 10, 20, 20], s, { shape: "ellipse", style: { fill: emphasize ? s.palette.accent : s.palette.ink, radius: 999 } }));
    const top = alternating && i % 2 === 0;
    const nw = vertical ? w * 0.62 : Math.min(280, span / (n - 1) * 0.86);
    const tx = vertical ? cx + 40 : cx - nw / 2, ty = vertical ? cy - 20 : top ? cy - (compact ? 160 : 240) : cy + (compact ? 60 : 90);
    es.push(text(o, `${node.nodeId}/label`, node.label, [tx, ty, vertical ? w * 0.25 : nw, vertical ? 42 : compact ? 70 : 95], s, { nodeId: node.nodeId, contentRef: node.contentRef, dataPath: ["nodes", i, "label"], style: { color: s.palette.ink, fontSize: n >= 9 ? 28 : 34, fontWeight: emphasize ? 700 : 500 } }));
    if (node.date) es.push(text(o, `${node.nodeId}/date`, node.date, [vertical ? x + 20 : tx, vertical ? cy - 18 : top ? cy - (compact ? 200 : 280) : cy + (compact ? 26 : 48), vertical ? w * 0.24 : nw, 36], s, { nodeId: node.nodeId, dataPath: ["nodes", i, "date"], style: { fontSize: 24, color: s.palette.accent } }));
    if (node.detail) es.push(text(o, `${node.nodeId}/detail`, node.detail, [vertical ? x + w * 0.64 : tx, vertical ? cy - 18 : ty + (compact ? 78 : 110), vertical ? w * 0.34 : nw, vertical ? 46 : compact ? 64 : 90], s, { nodeId: node.nodeId, dataPath: ["nodes", i, "detail"], style: { fontSize: 26, color: s.palette.muted } }));
    if (!vertical) es.push(line(o, `${node.nodeId}/stem`, [cx, cy], [cx, top ? cy - 44 : cy + 30], s));
  });
  for (const [stageIndex, stage] of (o.data.stages || []).entries()) {
    const a = nodes.findIndex((n2) => n2.nodeId === stage.from), b = nodes.findIndex((n2) => n2.nodeId === stage.to);
    if (a < 0 || b < 0) throw new Error("Stage references missing node");
    es.push(line(o, "stage/" + stage.stageId, anchors[a], anchors[b], s, { style: { stroke: s.palette.accent, strokeWidth: 8 } }));
    if (stage.label) {
      const start = anchors[a], end = anchors[b];
      es.push(text(o, "stage/" + stage.stageId + "/label", stage.label, vertical ? [start[0] - w * 0.28, Math.min(start[1], end[1]) + 10, w * 0.26, 60] : [Math.min(start[0], end[0]), start[1] - 58, Math.max(120, Math.abs(end[0] - start[0])), 42], s, { dataPath: ["stages", stageIndex, "label"], style: { fontSize: 24, color: s.palette.accent } }));
    }
  }
  return es;
}
export {
  layoutTimeline
};
