import { textWidth, estimateLines } from '../authoring/layout-kit.mjs';

// Composition defects the user has ruled out on report pages. Unlike layout-lint these block new authored decks:
// each one has a kit tool that avoids it by construction.
//  - image-group-gaps: photos placed side by side that do not tile their group's box (each shrunk to its own ratio,
//    leaving gaps and ragged edges). Draw the frames first, then crop photos into them: imageFrames.
//  - tile-spare-no-icon: a rounded tile holding a label and figure with a wide empty strip on the right and nothing
//    in it. metricTiles fills that strip with an icon.
//  - text-manual-list: list items numbered or indented with spaces inside one text box. Use numberedList, pointList
//    or sidePanel so wrapped lines hang under the item text.
//  - image-frame-broken: a photo placed in a frame (imageFrames, itemsWithPhotos) later set to show whole or shrunk
//    inside its frame. A crop complaint is fixed by moving focal or choosing another photo, never by leaving the frame
//    part empty.
//  - image-letterbox: any photo shown whole in a box of a different shape, leaving visible empty bands.
//  - text-orphan: a large standalone sentence with nothing under it, not on any band or tile: it reads as leftover.
//    Put it in a noteBar, attach it to the block it concludes, or move it into the header subtitle.
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
  // Blocks laid over each other: two filled panels or tiles that partly overlap (neither holds the other), or a
  // photo cutting into one. Usually a block placed by hand without the height the kit returned.
  const blocks = [...els.filter((x) => x.type === 'shape' && x.style?.fill && x.bounds[2] * x.bounds[3] > 20000), ...images];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = box(blocks[i]), c = box(blocks[j]), ow = Math.min(a.r, c.r) - Math.max(a.x, c.x), oh = Math.min(a.b, c.b) - Math.max(a.y, c.y);
    if (ow <= 2 || oh <= 2 || inside(a, c) || inside(c, a)) continue;
    out.push({ kind: 'blocks-overlap', elementIds: [blocks[i].id, blocks[j].id], overlap: [Math.round(ow), Math.round(oh)], hint: '两个色块/图片互相压住：按工具返回的高度往下排，不要手估坐标' });
  }
  // Content running into the footer band (source and page number sit at y ≥ 1010).
  const footer = texts.filter((t) => t.bounds[1] >= 1010);
  if (footer.length) for (const e of [...els.filter((x) => x.type === 'shape' && x.style?.fill && x.bounds[2] * x.bounds[3] > 20000), ...images]) {
    if (e.bounds[1] < 1010 && e.bounds[1] + e.bounds[3] > 1014) out.push({ kind: 'block-into-footer', elementId: e.id, bottom: Math.round(e.bounds[1] + e.bounds[3]), hint: '内容伸进页脚（来源、页码）：精简或缩短上方区块，内容区到 y=1010 为止' });
  }
  // Framed photos must still fill their frame, cropped.
  for (const e of els.filter((x) => x.type === 'image' && Array.isArray(x.frame))) {
    const f = { x: e.frame[0], y: e.frame[1], w: e.frame[2], h: e.frame[3] }, b = box(e);
    const shrunk = inside(b, { ...f, r: f.x + f.w, b: f.y + f.h }) && b.w * b.h < 0.85 * f.w * f.h;
    if ((e.fit && e.fit !== 'cover') || shrunk) out.push({ kind: 'image-frame-broken', elementId: e.id, fit: e.fit, hint: '照片要填满自己的框：裁切不满意就调整 focal（保留哪一块）或换图，不要改成完整显示或缩小' });
  }
  // Whole photos in a box of another shape leave empty bands.
  for (const e of els.filter((x) => x.type === 'image' && x.fit === 'contain' && Array.isArray(x.naturalSize) && !Array.isArray(x.frame))) {
    const r = e.bounds[2] / e.bounds[3], n = e.naturalSize[0] / e.naturalSize[1];
    if (Math.max(r / n, n / r) > 1.04) out.push({ kind: 'image-letterbox', elementId: e.id, hint: '图片在框里没填满：用 imageFrames 裁切填满，或把框改成图片的比例（fitImage）' });
  }
  // Standalone sentences: 28px or larger, at most two lines, outside every tile or band, with nothing below them
  // (header and footer excluded).
  const shapes = els.filter((x) => x.type === 'shape' && x.style?.fill && x.bounds[2] * x.bounds[3] > 20000);
  for (const e of texts) {
    const s = Math.max(e.style?.fontSize || 0, ...(e.runs || []).map((r) => r.style?.fontSize || 0)), b = box(e);
    if (s < 28 || b.y < 170 || b.y >= 1000 || e.id === 'title') continue;
    const lines = estimateLines(String(e.text), s, b.w);
    if (lines > 2) continue;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (shapes.some((sh) => { const t = box(sh); return cx > t.x && cx < t.r && cy > t.y && cy < t.b; })) continue;
    if (String(e.text).replace(/\s/g, '').length < 8) continue;
    // Part of a text group (a list, a table column, a heading with its line): another text shares its left edge
    // within 60px above or below.
    const grouped = texts.some((o) => o !== e && Math.abs(o.bounds[0] - b.x) <= 12 && (Math.abs(o.bounds[1] - b.b) <= 60 || Math.abs(b.y - (o.bounds[1] + o.bounds[3])) <= 60));
    if (grouped) continue;
    const below = els.some((o) => o !== e && o.type !== 'line' && o.bounds[1] >= b.b - 4 && o.bounds[1] < 1000 && o.bounds[0] < b.r && o.bounds[0] + o.bounds[2] > b.x);
    if (!below) out.push({ kind: 'text-orphan', elementId: e.id, hint: '单独一句结论悬在空白里：放进结论条（noteBar），贴着它总结的数据，或并入页头副标题' });
  }
  return out;
}
