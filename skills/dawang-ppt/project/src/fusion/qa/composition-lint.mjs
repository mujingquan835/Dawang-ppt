import { textWidth } from '../authoring/layout-kit.mjs';

// Composition defects the user has ruled out on report pages. Unlike layout-lint these block new authored decks:
// each one has a kit tool that avoids it by construction.
//  - image-group-gaps: photos placed side by side that do not tile their group's box (each shrunk to its own ratio,
//    leaving gaps and ragged edges). Draw the frames first, then crop photos into them: imageFrames.
//  - tile-spare-no-icon: a rounded tile holding a label and figure with a wide empty strip on the right and nothing
//    in it. metricTiles fills that strip with an icon.
//  - text-manual-list: list items numbered or indented with spaces inside one text box. Use numberedList, pointList
//    or sidePanel so wrapped lines hang under the item text.
const box = (e) => { const [x, y, w, h] = e.bounds; return { x, y, w, h, r: x + w, b: y + h }; };
const near = (a, b, d = 64) => a.x - d < b.r && b.x - d < a.r && a.y - d < b.b && b.y - d < a.b;
const inside = (inner, outer) => inner.x >= outer.x - 2 && inner.y >= outer.y - 2 && inner.r <= outer.r + 2 && inner.b <= outer.b + 2;
const runsWidth = (e) => (e.runs?.length ? e.runs.reduce((w, r) => w + textWidth(r.text ?? '', r.style?.fontSize || e.style?.fontSize || 24), 0)
  : Math.max(...String(e.text ?? '').split('\n').map((line) => textWidth(line, e.style?.fontSize || 24))));

export function lintComposition(elements) {
  const out = [], els = elements.filter((e) => Array.isArray(e.bounds));
  const images = els.filter((e) => e.type === 'image' && e.bounds[2] * e.bounds[3] > 40000), texts = els.filter((e) => e.type === 'text' && String(e.text ?? '').trim());

  // Group photos that sit within 64px of each other; a group of two or more must cover at least 85% of its box.
  const seen = new Set();
  for (const start of images) {
    if (seen.has(start)) continue;
    const group = [start]; seen.add(start);
    for (let k = 0; k < group.length; k++) for (const o of images) if (!seen.has(o) && near(box(group[k]), box(o))) { seen.add(o); group.push(o); }
    if (group.length < 2) continue;
    const bs = group.map(box), u = { x: Math.min(...bs.map((b) => b.x)), y: Math.min(...bs.map((b) => b.y)), r: Math.max(...bs.map((b) => b.r)), b: Math.max(...bs.map((b) => b.b)) };
    // Gutters between frames are part of a tiled group; allow them before judging coverage.
    const covered = bs.reduce((a, b) => a + b.w * b.h, 0), whole = (u.r - u.x) * (u.b - u.y), gutter = 36 * ((u.r - u.x) + (u.b - u.y)) * (group.length - 1) / 2;
    const share = covered / Math.max(1, whole - gutter);
    if (share < 0.85) out.push({ kind: 'image-group-gaps', elementIds: group.map((e) => e.id), coverage: +Math.min(1, share).toFixed(2), hint: '先按左侧内容的上下边界画对称的框，再把图片裁切嵌入（imageFrames）；不要把每张图按原比例各自缩小' });
  }

  // Tiles: rounded filled shapes holding one to three texts, at least one of them a figure.
  for (const s of els.filter((e) => e.type === 'shape' && (e.style?.radius || 0) > 0 && e.style?.fill && e.bounds[2] >= 240 && e.bounds[3] >= 100)) {
    // A text belongs to the tile when its centre does (a box drawn a little taller than its tile still counts).
    const t = box(s), centred = (e) => { const c = box(e), cx = c.x + c.w / 2, cy = c.y + c.h / 2; return cx > t.x && cx < t.r && cy > t.y && cy < t.b; };
    const held = texts.filter(centred);
    // A metric tile carries a big figure (40px or more, short); a text panel with numbers in its prose is not one.
    const big = (e) => Math.max(e.style?.fontSize || 0, ...(e.runs || []).map((r) => r.style?.fontSize || 0)) >= 40 && /\d/.test(String(e.text)) && String(e.text).trim().length <= 14;
    if (!held.length || held.length > 3 || !held.some(big)) continue;
    if (els.some((e) => (e.type === 'vector' || e.type === 'image') && inside(box(e), t))) continue;
    const right = Math.max(...held.map((e) => e.bounds[0] + Math.min(e.bounds[2], runsWidth(e))));
    const spare = t.r - right;
    if (spare >= Math.max(180, t.w * 0.3)) out.push({ kind: 'tile-spare-no-icon', elementId: s.id, spare: Math.round(spare), hint: '色块右侧空余较大：用 metricTiles（会自动补图标）或在空余处加图标' });
  }

  // Lines that start with spaces (manual hanging indent) or "01  " style numbering inside one text box.
  for (const e of texts) {
    const lines = String(e.text).split('\n').filter((l) => l.trim());
    if (lines.length < 2) continue;
    const indented = lines.filter((l) => /^[ 　]{2,}\S/.test(l)).length, numbered = lines.filter((l) => /^\s*(\d{1,2}|[①-⑩])[ 　]{2,}\S/.test(l)).length;
    if (indented || numbered >= 2) out.push({ kind: 'text-manual-list', elementId: e.id, hint: '用 numberedList / pointList / sidePanel 排编号与缩进，不在一个文字框里用空格对齐' });
  }
  return out;
}
