// Orientation-aware image packing. Every box keeps the image's own aspect ratio (no crop, no stretch).
// Tries all contiguous row partitions and keeps the one covering most of the box; result is centered (fill rule).
function* compositions(n, rows) {
  if (rows === 1) { yield [n]; return; }
  for (let first = 1; first <= n - rows + 1; first++) for (const rest of compositions(n - first, rows - 1)) yield [first, ...rest];
}
function justifyImages(ratios, [x, y, w, h], gap = 38, { captionH = 0, maxRows = 3, minImageH = 0.2 } = {}) {
  const n = ratios.length;
  if (!n) return { boxes: [], rows: 0, coverage: 0, arrangement: "none" };
  if (ratios.some((r) => !(r > 0))) throw new Error("Image aspect ratio required for layout");
  let best = null;
  for (let r = 1; r <= Math.min(n, maxRows); r++) for (const parts of compositions(n, r)) {
    let i = 0;
    const rows = parts.map((k) => { const rs = ratios.slice(i, i + k); i += k; const sum = rs.reduce((a, b) => a + b, 0); return { rs, sum, k, h: (w - gap * (k - 1)) / sum }; });
    const avail = h - captionH * r - gap * (r - 1);
    if (avail <= 0) continue;
    const total = rows.reduce((a, row) => a + row.h, 0), s = Math.min(1, avail / total);
    rows.forEach((row) => { row.h *= s; row.w = row.h * row.sum + gap * (row.k - 1); });
    const area = rows.reduce((a, row) => a + row.h * row.h * row.sum, 0);
    const hs = rows.map((row) => row.h), balance = Math.min(...hs) / Math.max(...hs);
    let score = area / (w * h) - (balance < 0.5 ? 0.12 : 0) - (Math.min(...hs) < minImageH * h ? 0.2 : 0);
    if (!best || score > best.score + 1e-9) best = { rows, score, coverage: area / (w * h) };
  }
  if (!best) throw new Error("Image area too small for captions and gaps");
  const usedH = best.rows.reduce((a, row) => a + row.h, 0) + captionH * best.rows.length + gap * (best.rows.length - 1);
  let cy = y + (h - usedH) / 2;
  const boxes = [];
  for (const row of best.rows) {
    let cx = x + (w - row.w) / 2;
    for (const ratio of row.rs) { const bw = row.h * ratio; boxes.push([Math.round(cx), Math.round(cy), Math.round(bw), Math.round(row.h)]); cx += bw + gap; }
    cy += row.h + captionH + gap;
  }
  const r = best.rows.length;
  return { boxes, rows: r, perRow: best.rows.map((row) => row.k), coverage: best.coverage, score: best.score, arrangement: r === 1 ? (n === 1 ? "single" : "row") : r === n ? "stack" : "rows" };
}
export { justifyImages };
