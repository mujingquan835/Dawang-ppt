// Mechanical checks for the parts of Kimi's general rules that code can see on a composed slide.
// It cannot judge taste; it only flags: card-built hierarchy, default equal splits (3/4 columns, 2x2),
// the "AI palette" (red+purple+yellow+green on one page), body below 14pt, missing title/source.
const hue = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.18 || max < 0.2) return null; // greys / near-black carry no hue
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const family = (h) => h == null ? null : h < 20 || h >= 335 ? "red" : h < 70 ? "yellow" : h < 170 ? "green" : h < 255 ? "blue" : "purple";
const contains = (o, i) => i[0] >= o[0] - 2 && i[1] >= o[1] - 2 && i[0] + i[2] <= o[0] + o[2] + 2 && i[1] + i[3] <= o[1] + o[3] + 2;
function lintSlide(slide, { minBodyPx = 28 } = {}) {
  const els = slide.elements || [], texts = els.filter((e) => e.type === "text"), issues = [];
  const id = slide.slideId;
  // 1. Cards: filled or stroked rounded/rect panels that wrap text blocks, repeated >= 2 times.
  const panels = els.filter((e) => e.type === "shape" && (e.style?.fill || e.style?.stroke) && e.bounds[2] < 1700 && e.bounds[3] > 80 && e.bounds[3] < 900);
  const cards = panels.filter((p) => texts.some((t) => contains(p.bounds, t.bounds)));
  if (cards.length >= 2) issues.push({ slideId: id, rule: "no-cards", severity: "error", ids: cards.map((c) => c.id), message: "用卡片（底色/描边面板包文字）建层级；Kimi 要求用线、留白和字号对比" });
  // 2. Default equal splits: >=3 same-width blocks on one row, or a 2x2 of same-size blocks.
  const blocks = [...cards, ...texts.filter((t) => t.role === "body" || t.role === "heading")];
  const rows = new Map();
  for (const b of blocks) { const k = Math.round(b.bounds[1] / 20); if (!rows.has(k)) rows.set(k, []); rows.get(k).push(b); }
  for (const row of rows.values()) {
    const widths = [...new Set(row.map((b) => Math.round(b.bounds[2] / 10)))], xs = new Set(row.map((b) => Math.round(b.bounds[0])));
    if (xs.size >= 3 && widths.length === 1) issues.push({ slideId: id, rule: "no-default-equal-split", severity: "error", ids: row.map((b) => b.id), message: `${xs.size} 等分并列；除非别无选择，不默认三/四等分` });
  }
  const sized = blocks.filter((b) => b.role !== "heading");
  const grid = new Map(); for (const b of sized) { const k = Math.round(b.bounds[2] / 10) + "x" + Math.round(b.bounds[3] / 10); grid.set(k, [...(grid.get(k) || []), b]); }
  for (const g of grid.values()) if (g.length === 4 && new Set(g.map((b) => Math.round(b.bounds[0]))).size === 2 && new Set(g.map((b) => Math.round(b.bounds[1]))).size === 2) issues.push({ slideId: id, rule: "no-2x2", severity: "error", ids: g.map((b) => b.id), message: "2×2 均分矩阵" });
  // 3. AI palette.
  const colors = els.flatMap((e) => [e.style?.fill, e.style?.color, e.style?.stroke]).filter(Boolean);
  const fams = new Set(colors.map(hue).map(family).filter(Boolean));
  if (["red", "purple", "yellow", "green"].every((f) => fams.has(f))) issues.push({ slideId: id, rule: "no-ai-palette", severity: "error", message: "同页同时出现红、紫、黄、绿" });
  // 4. Readability + required parts.
  for (const t of texts) if (t.role === "body" && (t.style?.fontSize ?? minBodyPx) < minBodyPx) issues.push({ slideId: id, rule: "body-min-14pt", severity: "error", ids: [t.id] });
  if (!texts.some((t) => t.role === "title")) issues.push({ slideId: id, rule: "title-required", severity: "error" });
  if (slide.hasExternalData && !texts.some((t) => t.role === "source")) issues.push({ slideId: id, rule: "source-required", severity: "error" });
  return issues;
}
function lintDeck(project, opts) { return (project.slides || []).filter((s) => s.mode === "composition").flatMap((s) => lintSlide(s, opts)); }
export { lintSlide, lintDeck };
