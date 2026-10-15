import { text, shape, line } from "./primitives.mjs";
function layoutChart(o, s) {
  const values = o.data.series || [];
  if (!o.data.unit || !o.data.period) throw new Error("Chart unit and period required");
  const nums = values.map((n) => n.value).filter((v) => v !== null && v !== void 0);
  if (nums.some((v) => typeof v !== "number" || !Number.isFinite(v))) throw new Error("Chart values must be numbers or null");
  if (!values.length) throw new Error("Chart series empty");
  const [x, y, w, h] = o.bounds;
  const es = [text(o, "scope", o.data.unit + " · " + o.data.period, [x, y, w, o.data.micro ? 26 : 36], s, { style: { fontSize: o.data.micro ? 16 : 24, color: s.palette.muted } })];
  const min = Math.min(0, ...nums), max = Math.max(0, ...nums), span = max - min || 1;
  const left = x + (o.data.micro ? 40 : 180), right = x + w - (o.data.micro ? 40 : 90), top = y + (o.data.micro ? 66 : 80), bottom = y + h - (o.data.micro ? 30 : 70);
  if (o.kind === "bar") {
    const rowH = (bottom - top) / values.length, zero = left + (0 - min) / span * (right - left);
    es.push(line(o, "zero-axis", [zero, top], [zero, bottom], s, { style: { stroke: s.palette.line, strokeWidth: 2 } }));
    values.forEach((v, i) => {
      const cy = top + i * rowH;
      es.push(text(o, `${v.nodeId}/category`, v.label, [x, cy + rowH * 0.25, 160, rowH * 0.6], s, { style: { fontSize: 28, color: s.palette.ink }, dataPath: ["series", i, "label"] }));
      if (v.value !== null && v.value !== void 0 && v.value !== 0) {
        const end = left + (v.value - min) / span * (right - left);
        es.push(shape(o, `${v.nodeId}/bar`, [Math.min(zero, end), cy + rowH * 0.25, Math.max(2, Math.abs(end - zero)), rowH * 0.5], s, { style: { fill: v.value < 0 ? s.palette.negative || "#b42318" : s.palette.accent, radius: 0 } }));
      }
      es.push(text(o, `${v.nodeId}/value`, v.value === null || v.value === void 0 ? "—" : v.value, [right + 14, cy + rowH * 0.25, 76, rowH * 0.6], s, { style: { fontSize: 28, color: s.palette.ink } }));
    });
  } else {
    const points = values.map((v, i) => [left + (right - left) * i / Math.max(1, values.length - 1), bottom - (Number(v.value) - min) / span * (bottom - top)]);
    es.push(line(o, "zero-axis", [left, bottom - -min / span * (bottom - top)], [right, bottom - -min / span * (bottom - top)], s, { style: { stroke: s.palette.line, strokeWidth: 2 } }));
    values.forEach((v, i) => {
      const [px, py] = points[i], valid = v.value !== null && v.value !== void 0;
      if (valid) {
        es.push(shape(o, `${v.nodeId}/point`, [px - 7, py - 7, 14, 14], s, { shape: "ellipse", style: { fill: s.palette.accent, radius: 999 } }));
        if (i && values[i - 1].value !== null && values[i - 1].value !== void 0) es.push(line(o, `${values[i - 1].nodeId}-${v.nodeId}/segment`, points[i - 1], points[i], s));
      }
      es.push(text(o, `${v.nodeId}/value`, valid ? v.value : "—", [px - 50, valid ? py - (o.data.micro ? 22 : 42) : bottom - (o.data.micro ? 22 : 42), 100, o.data.micro ? 24 : 40], s, { style: { fontSize: o.data.micro ? 18 : 26, color: s.palette.ink, textAlign: "center" } }));
      es.push(text(o, `${v.nodeId}/category`, v.label, [px - 80, bottom + (o.data.micro ? 6 : 22), 160, o.data.micro ? 24 : 44], s, { style: { fontSize: o.data.micro ? 18 : 26, color: s.palette.muted, textAlign: "center" }, dataPath: ["series", i, "label"] }));
    });
  }
  return es;
}
export {
  layoutChart
};
