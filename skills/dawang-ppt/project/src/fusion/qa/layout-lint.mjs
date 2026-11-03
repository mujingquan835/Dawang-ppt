// Objective geometry defects that read as careless on the page. Warnings only: each has legitimate exceptions,
// and none says whether the design is good. The layout kit avoids all of them by construction.
const NUMERIC = /^[\d.,，%+\-~～]+$/;
const box = (e) => { const [x, y, w, h] = e.bounds; return { x, y, w, h, r: x + w, b: y + h }; };
const size = (e) => Math.max(e.style?.fontSize || 0, ...(e.runs || []).map((r) => r.style?.fontSize || 0));

export function lintLayout(elements) {
  const warnings = [], els = elements.filter((e) => Array.isArray(e.bounds));
  const images = els.filter((e) => e.type === 'image'), texts = els.filter((e) => e.type === 'text' && String(e.text ?? '').trim());

  // Images sharing a top edge and sitting side by side should share a height.
  for (let i = 0; i < images.length; i++) for (let j = i + 1; j < images.length; j++) {
    const a = box(images[i]), b = box(images[j]);
    const sideBySide = Math.abs(a.y - b.y) <= 12 && (b.x >= a.r - 4 || a.x >= b.r - 4) && Math.min(Math.abs(b.x - a.r), Math.abs(a.x - b.r)) <= 120;
    if (!sideBySide || Math.abs(a.h - b.h) <= 12) continue;
    // A mosaic is fine: the shorter image heads a stacked column that ends level with the taller one.
    const [tall, short] = a.h > b.h ? [a, b] : [b, a];
    const column = images.map(box).filter((c) => Math.abs(c.x - short.x) <= 4 && c.y >= short.b);
    if (column.some((c) => Math.abs(c.b - tall.b) <= 40)) continue;
    warnings.push({ kind: 'image-row-uneven', elementIds: [images[i].id, images[j].id], heights: [a.h, b.h] });
  }

  // A pixel size recorded by the layout kit lets us flag images shown at more than twice their resolution.
  for (const e of images) if (Array.isArray(e.naturalSize)) {
    const scale = Math.max(e.bounds[2] / e.naturalSize[0], e.bounds[3] / e.naturalSize[1]);
    if (scale > 2) warnings.push({ kind: 'image-upscaled', elementId: e.id, scale: +scale.toFixed(1) });
  }

  // A big bare number with its unit in a separate, distant element.
  for (const n of texts) {
    const t = String(n.text).trim(), s = size(n);
    if (!NUMERIC.test(t) || s < 48) continue;
    const a = box(n);
    for (const u of texts) {
      const ut = String(u.text).trim();
      if (u === n || ut.length > 3 || NUMERIC.test(ut)) continue;
      const c = box(u), gap = c.x - (a.x + Math.min(a.w, t.length * s * 0.6));
      if (c.y < a.b && c.b > a.y && gap > s * 0.8 && gap < s * 6) warnings.push({ kind: 'metric-unit-detached', elementIds: [n.id, u.id], gap: Math.round(gap) });
    }
  }

  // Left edges 2–10px apart on vertically neighbouring texts: meant to align, but do not.
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = box(texts[i]), b = box(texts[j]), dx = Math.abs(a.x - b.x);
    const stacked = Math.min(Math.abs(b.y - a.b), Math.abs(a.y - b.b)) <= 60 && !(a.y < b.b && b.y < a.b);
    if (stacked && dx >= 2 && dx <= 10) warnings.push({ kind: 'near-misaligned', elementIds: [texts[i].id, texts[j].id], dx: Math.round(dx) });
  }
  return warnings;
}
