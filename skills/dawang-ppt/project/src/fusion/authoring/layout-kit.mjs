import fs from 'node:fs';
import { textElement, imageElement, lineElement } from './elements.mjs';

// Layout tools for authored pages on the 1920×1080 canvas. Each tool takes content and a position and returns
// elements plus the height it used, so a page can stack blocks without hand-computed coordinates. Grouping and
// alignment (number with unit, node with label, images in one row) are guaranteed here instead of by eye.
// Tools never choose content or page structure.

export const CANVAS = { width: 1920, height: 1080 };

export function createTheme({ palette = {}, fontFamily = 'PingFang SC', headingFamily } = {}) {
  const p = { bg: '#FFFFFF', ink: '#14213D', accent: '#E8590C', muted: '#5C6B7A', line: '#D9DEE5', pale: '#F2F4F7', inverse: '#FFFFFF', ...palette };
  const font = (size, extra = {}) => ({ fontFamily, fontSize: size, color: p.ink, fontWeight: 400, lineHeight: 1.4, ...extra });
  return { palette: p, fontFamily, headingFamily: headingFamily || fontFamily, font };
}

export function createGrid({ margin = 96, columns = 12, gutter = 32, width = CANVAS.width } = {}) {
  const col = (width - margin * 2 - gutter * (columns - 1)) / columns;
  const span = (start, count) => [Math.round(margin + start * (col + gutter)), Math.round(count * col + (count - 1) * gutter)];
  return { margin, columns, gutter, col, span, left: margin, right: width - margin, width: width - margin * 2 };
}

// CJK-font punctuation (quotes, dashes) renders full width too. Lines fill to 95% to leave room for font metrics.
const charWidth = (ch, size) => (/[‐-⁯⺀-￯]/.test(ch) ? size : /\s/.test(ch) ? size * 0.3 : size * 0.56);
export function estimateLines(text, fontSize, boxWidth) {
  const width = boxWidth * 0.95;
  return String(text ?? '').split('\n').reduce((total, para) => {
    let lines = 1, used = 0;
    for (const ch of para) { const w = charWidth(ch, fontSize); if (used + w > width && used > 0) { lines++; used = w; } else used += w; }
    return total + lines;
  }, 0);
}
export const textWidth = (text, fontSize) => [...String(text ?? '')].reduce((w, ch) => w + charWidth(ch, fontSize), 0);
export const textHeight = (text, fontSize, width, lineHeight = 1.4) => Math.ceil(estimateLines(text, fontSize, width) * fontSize * lineHeight);

// A text block sized to its estimated content; extra keeps room for font metrics.
export function textBlock({ id, x, y, width, text, size, theme, style = {}, runs }) {
  const st = theme.font(size, style), h = textHeight(text, size, width, st.lineHeight) + Math.round(size * 0.2);
  return { elements: [textElement({ id, text, bounds: [x, y, width, h], style: st, ...(runs ? { runs } : {}) })], height: h };
}

export function panel({ id, bounds, fill, radius = 0, theme }) {
  return { type: 'shape', id, bounds, style: { fill: fill || theme.palette.pale, ...(radius ? { radius } : {}) } };
}

// Value and unit share one text element (runs), so they cannot drift apart; the label sits directly below.
export function metricGroup({ id, x, y, width, value, unit = '', label = '', size = 96, theme, color, labelSize }) {
  const p = theme.palette, unitSize = Math.max(20, Math.round(size * 0.3)), ls = labelSize || Math.max(18, Math.round(size * 0.22));
  const valueStyle = theme.font(size, { fontWeight: 700, color: color || p.accent, lineHeight: 1.2 });
  const runs = [{ text: String(value), style: { fontSize: size, fontWeight: 700, color: color || p.accent } }, ...(unit ? [{ text: ' ' + unit, style: { fontSize: unitSize, fontWeight: 700, color: p.ink } }] : [])];
  const vh = Math.round(size * 1.3), elements = [textElement({ id: id + '-value', text: String(value) + (unit ? ' ' + unit : ''), runs, bounds: [x, y, width, vh], style: valueStyle })];
  let h = vh;
  if (label) { const lh = textHeight(label, ls, width, 1.35); elements.push(textElement({ id: id + '-label', text: label, bounds: [x, y + vh + 6, width, lh], style: theme.font(ls, { color: p.muted, lineHeight: 1.35 }) })); h += 6 + lh; }
  return { elements, height: h };
}

export function metricRow({ id, x, y, width, items, size = 64, gap = 40, theme, color }) {
  const w = (width - gap * (items.length - 1)) / items.length;
  const groups = items.map((it, i) => metricGroup({ id: `${id}-${i + 1}`, x: Math.round(x + i * (w + gap)), y, width: Math.round(w), size, theme, color, ...it }));
  return { elements: groups.flatMap((g) => g.elements), height: Math.max(...groups.map((g) => g.height)) };
}

// Numbered nodes joined by arrows; each title and detail starts at its node's left edge, so labels line up with nodes.
export function flow({ id, x, y, width, steps, theme, node: requested = 52, titleSize = 30, detailSize = 22, numbered = true, color }) {
  // Numbers stay at 28px bold (large text for the contrast check), so a numbered node is never smaller than 48px.
  const node = numbered ? Math.max(48, requested) : requested;
  const p = theme.palette, fill = color || p.accent, n = steps.length, slot = width / n, elements = [];
  const labelW = Math.round(slot - 24);
  let h = node;
  steps.forEach((step, i) => {
    const nx = Math.round(x + i * slot);
    elements.push({ type: 'shape', id: `${id}-node-${i + 1}`, bounds: [nx, y, node, node], style: { fill, radius: node / 2 } });
    if (numbered) elements.push(textElement({ id: `${id}-num-${i + 1}`, text: String(i + 1).padStart(2, '0'), bounds: [nx, y + Math.round((node - Math.max(28, node * 0.54) * 1.3) / 2), node, Math.round(Math.max(28, node * 0.54) * 1.3)], style: theme.font(Math.max(28, Math.round(node * 0.54)), { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.3 }) }));
    if (i < n - 1) elements.push({ ...lineElement({ id: `${id}-link-${i + 1}`, from: [nx + node + 12, y + node / 2], to: [Math.round(x + (i + 1) * slot) - 12, y + node / 2], style: { stroke: fill, strokeWidth: 3 } }), endArrow: true });
    let ty = y + node + 20;
    const th = textHeight(step.title, titleSize, labelW, 1.3);
    elements.push(textElement({ id: `${id}-title-${i + 1}`, text: step.title, bounds: [nx, ty, labelW, th], style: theme.font(titleSize, { fontWeight: 700, lineHeight: 1.3 }) }));
    ty += th + 6;
    if (step.detail) { const dh = textHeight(step.detail, detailSize, labelW, 1.4); elements.push(textElement({ id: `${id}-detail-${i + 1}`, text: step.detail, bounds: [nx, ty, labelW, dh], style: theme.font(detailSize, { color: p.muted }) })); ty += dh; }
    h = Math.max(h, ty - y);
  });
  return { elements, height: h };
}

export function numberedList({ id, x, y, width, items, theme, badge = 56, titleSize = 34, detailSize = 24, gap = 40, color }) {
  const p = theme.palette, textX = x + badge + 28, textW = width - badge - 28, elements = [];
  let cy = y;
  items.forEach((it, i) => {
    elements.push({ type: 'shape', id: `${id}-badge-${i + 1}`, bounds: [x, cy, badge, badge], style: { fill: color || p.accent, radius: 6 } });
    elements.push(textElement({ id: `${id}-num-${i + 1}`, text: String(i + 1).padStart(2, '0'), bounds: [x, cy + Math.round((badge - Math.max(28, badge * 0.5) * 1.3) / 2), badge, Math.round(Math.max(28, badge * 0.5) * 1.3)], style: theme.font(Math.max(28, Math.round(badge * 0.5)), { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.3 }) }));
    const th = textHeight(it.title, titleSize, textW, 1.3);
    elements.push(textElement({ id: `${id}-title-${i + 1}`, text: it.title, bounds: [textX, cy + Math.max(0, Math.round((badge - titleSize * 1.3) / 2)), textW, th], style: theme.font(titleSize, { fontWeight: 700, lineHeight: 1.3 }) }));
    let used = Math.max(badge, th);
    if (it.detail) { const dh = textHeight(it.detail, detailSize, textW); elements.push(textElement({ id: `${id}-detail-${i + 1}`, text: it.detail, bounds: [textX, cy + used + 8, textW, dh], style: theme.font(detailSize) })); used += 8 + dh; }
    cy += used + gap;
  });
  return { elements, height: cy - y - gap };
}

// PNG/JPEG pixel size from the file header, used for aspect ratio and the upscale limit.
export function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  throw new Error('Unsupported image or unreadable size: ' + file);
}

// One justified row: equal heights, widths follow each image's aspect ratio. The row shrinks (staying left-aligned)
// when that would enlarge an image beyond maxUpscale × its pixel size. Captions start at each image's left edge.
export function imageRow({ id, x, y, width, images, theme, gap = 24, maxHeight = 600, maxUpscale = 2, captionSize = 20, fit = 'cover' }) {
  const sized = images.map((img) => ({ ...img, size: img.size || imageSize(img.file || img.src) }));
  const ratios = sized.map((img) => img.size.width / img.size.height);
  let h = Math.min(maxHeight, (width - gap * (images.length - 1)) / ratios.reduce((a, r) => a + r, 0));
  h = Math.min(h, ...sized.map((img) => img.size.height * maxUpscale));
  h = Math.floor(h);
  const elements = [];
  let cx = x, captionH = 0;
  sized.forEach((img, i) => {
    const w = Math.round(h * ratios[i]);
    elements.push(imageElement({ id: `${id}-img-${i + 1}`, src: img.src, bounds: [cx, y, w, h], fit, naturalSize: [img.size.width, img.size.height], ...(img.alt ? { alt: img.alt } : {}) }));
    if (img.caption) { const ch = textHeight(img.caption, captionSize, w, 1.35); captionH = Math.max(captionH, ch); elements.push(textElement({ id: `${id}-caption-${i + 1}`, text: img.caption, bounds: [cx, y + h + 10, w, ch], style: theme.font(captionSize, { color: theme.palette.muted, lineHeight: 1.35 }) })); }
    cx += w + gap;
  });
  return { elements, height: h + (captionH ? 10 + captionH : 0), width: cx - gap - x };
}

// One tall image on the left, the others stacked on the right at a shared width; both columns end at the same
// height. Suits one portrait with several landscape photos.
export function imageMosaic({ id, x, y, width, images, theme, gap = 24, maxHeight = 600, maxUpscale = 2, captionSize = 20, fit = 'cover' }) {
  const sized = images.map((img) => ({ ...img, size: img.size || imageSize(img.file || img.src) }));
  const ratios = sized.map((img) => img.size.width / img.size.height), rest = ratios.slice(1);
  const cap = sized.some((img) => img.caption) ? Math.ceil(captionSize * 1.35) + 10 : 0, vgap = gap + cap;
  const inv = rest.reduce((a, r) => a + 1 / r, 0), stackGaps = vgap * (rest.length - 1) + cap;
  // Left height H = r0·W0; right width W2 with Σ W2/ri + stackGaps = H − cap(left); W0 + gap + W2 = width.
  let H = (width - gap + (stackGaps - cap) / inv) / (ratios[0] + 1 / inv);
  H = Math.min(H, maxHeight - cap, sized[0].size.height * maxUpscale);
  let W2 = Math.max(1, (H + cap - stackGaps) / inv);
  W2 = Math.min(W2, ...sized.slice(1).map((img, i) => img.size.width * maxUpscale), width - gap - H * ratios[0]);
  const W0 = Math.round(H * ratios[0]), elements = [], caption = (i, bx, by, bw, text) => text && elements.push(textElement({ id: `${id}-caption-${i}`, text, bounds: [bx, by, bw, cap - 10], style: theme.font(captionSize, { color: theme.palette.muted, lineHeight: 1.35 }) }));
  const place = (i, bx, by, bw, bh) => elements.push(imageElement({ id: `${id}-img-${i}`, src: sized[i - 1].src, bounds: [Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)], fit, naturalSize: [sized[i - 1].size.width, sized[i - 1].size.height] }));
  place(1, x, y, W0, H); caption(1, x, Math.round(y + H + 10), W0, sized[0].caption);
  let cy = y;
  rest.forEach((r, i) => { const h = W2 / r, rx = x + W0 + gap; place(i + 2, rx, cy, W2, h); caption(i + 2, Math.round(rx), Math.round(cy + h + 10), Math.round(W2), sized[i + 1].caption); cy += h + vgap; });
  return { elements, height: Math.round(Math.max(H + cap, cy - vgap + cap - y)), width: Math.round(W0 + gap + W2) };
}

// Several rows stacked; images are split into rows of `perRow`. perRow 'auto' tries every split (and the mosaic
// when there are 3+ images) and keeps the arrangement that shows the most image area within maxHeight.
export function imageGrid({ id, x, y, width, images, perRow = 'auto', rowGap = 28, maxHeight = 600, ...rest }) {
  if (perRow === 'auto') {
    const options = images.map((_, i) => imageGrid({ id, x, y, width, images, perRow: i + 1, rowGap, maxHeight, ...rest }));
    if (images.length >= 3) options.push(imageMosaic({ id, x, y, width, images, maxHeight, ...rest }));
    const area = (g) => g.elements.filter((e) => e.type === 'image').reduce((a, e) => a + e.bounds[2] * e.bounds[3], 0);
    const fitting = options.filter((g) => g.height <= maxHeight);
    return (fitting.length ? fitting : options).sort((a, b) => area(b) - area(a))[0];
  }
  const rows = Math.ceil(images.length / perRow), rowMax = (maxHeight - rowGap * (rows - 1)) / rows - 40;
  const elements = [];
  let cy = y, used = 0, usedW = 0;
  for (let r = 0; r * perRow < images.length; r++) {
    const row = imageRow({ id: `${id}-r${r + 1}`, x, y: cy, width, images: images.slice(r * perRow, r * perRow + perRow), maxHeight: rowMax, ...rest });
    elements.push(...row.elements); cy += row.height + rowGap; used = cy - rowGap - y; usedW = Math.max(usedW, row.width);
  }
  return { elements, height: used, width: usedW };
}

// Fill a whole box with photos by cropping each one a little (fit 'cover' around its focal point) instead of shrinking
// the group and leaving a gap. Tries one justified row and a mosaic (most portrait photo tall on the left, the rest
// stacked on the right, the left width searched), and keeps the arrangement whose worst crop is smallest. Returns
// null when every arrangement would crop more than maxCrop (box shape vs photo shape), or enlarge a photo beyond
// maxUpscale, so the caller can fall back to the uncropped grid.
export function imageFill({ id, x, y, width, height, images, theme, gap = 24, captionSize = 20, maxCrop = 1.45, maxUpscale = 2.2 }) {
  const sized = images.map((img) => ({ ...img, size: img.size || imageSize(img.file || img.src) }));
  const ratio = (img) => img.size.width / img.size.height, cap = sized.some((i) => i.caption) ? Math.ceil(captionSize * 1.35) + 10 : 0;
  const cost = (boxes) => Math.max(...boxes.map(({ img, w, h }) => Math.max((w / h) / ratio(img), ratio(img) / (w / h))));
  const tooBig = (boxes) => boxes.some(({ img, w, h }) => w > img.size.width * maxUpscale || h > img.size.height * maxUpscale);
  const options = [];
  // One row: shared height, widths in proportion to the photos, stretched to the full width.
  { const h = height - cap, k = (width - gap * (sized.length - 1)) / sized.reduce((a, i) => a + ratio(i), 0);
    let cx = x; options.push(sized.map((img) => { const w = k * ratio(img); const b = { img, x: cx, y, w, h }; cx += w + gap; return b; })); }
  // Mosaic: tall photo left, the others stacked right with equal heights.
  if (sized.length >= 3) {
    const order = [...sized].sort((a, b) => ratio(a) - ratio(b)), [tall, ...rest] = order, n = rest.length;
    const rh = (height - cap * n - gap * (n - 1)) / n;
    for (let f = 0.25; f <= 0.6; f += 0.01) {
      const w0 = (width - gap) * f, w2 = width - gap - w0;
      options.push([{ img: tall, x, y, w: w0, h: height - cap }, ...rest.map((img, i) => ({ img, x: x + w0 + gap, y: y + i * (rh + cap + gap), w: w2, h: rh }))]);
    }
  }
  const viable = options.filter((o) => !tooBig(o) && cost(o) <= maxCrop).sort((a, b) => cost(a) - cost(b));
  if (!viable.length) return null;
  const elements = [];
  viable[0].forEach(({ img, x: bx, y: by, w, h }, i) => {
    elements.push(imageElement({ id: `${id}-img-${i + 1}`, src: img.src, bounds: [Math.round(bx), Math.round(by), Math.round(w), Math.round(h)], fit: 'cover', focal: img.focal || '50% 40%', naturalSize: [img.size.width, img.size.height], ...(img.alt ? { alt: img.alt } : {}) }));
    if (img.caption) elements.push(textElement({ id: `${id}-caption-${i + 1}`, text: img.caption, bounds: [Math.round(bx), Math.round(by + h + 10), Math.round(w), cap - 10], style: theme.font(captionSize, { color: theme.palette.muted, lineHeight: 1.35 }) }));
  });
  return { elements, height, width, crop: +cost(viable[0]).toFixed(2) };
}

// Move a block sideways, e.g. to centre a photo grid that is narrower than its zone.
export const shiftX = (elements, dx) => (dx ? elements.map((e) => ({ ...e, bounds: [e.bounds[0] + Math.round(dx), ...e.bounds.slice(1)] })) : elements);

// An image sized to fit a box at its own aspect ratio (never above maxUpscale × its pixels), centred in the box.
export function fitImage({ id, src, size, box: [bx, by, bw, bh], maxUpscale = 2, alt }) {
  const s = size || imageSize(src), r = s.width / s.height;
  let w = Math.min(bw, bh * r, s.width * maxUpscale), h = w / r;
  if (h > bh) { h = bh; w = h * r; }
  return imageElement({ id, src, bounds: [Math.round(bx + (bw - w) / 2), Math.round(by + (bh - h) / 2), Math.round(w), Math.round(h)], fit: 'contain', naturalSize: [s.width, s.height], ...(alt ? { alt } : {}) });
}

// columns: [{key, label, width, size?, weight?, color?}]; row height follows the tallest estimated cell.
export function table({ id, x, y, columns, rows, theme, headSize = 20, size = 24, padY = 18, rule = true }) {
  const p = theme.palette, width = columns.reduce((a, c) => a + c.width, 0), elements = [];
  let cx = x;
  columns.forEach((c) => { elements.push(textElement({ id: `${id}-head-${c.key}`, text: c.label, bounds: [cx, y, c.width - 24, Math.round(headSize * 1.5)], style: theme.font(headSize, { color: p.muted }) })); cx += c.width; });
  let cy = y + Math.round(headSize * 1.5) + 10;
  elements.push(lineElement({ id: `${id}-head-rule`, from: [x, cy], to: [x + width, cy], style: { stroke: p.ink, strokeWidth: 2 } }));
  rows.forEach((row, r) => {
    const heights = columns.map((c) => textHeight(row[c.key], c.size || size, c.width - 24, 1.35));
    const rh = Math.max(...heights) + padY * 2;
    cx = x;
    columns.forEach((c, i) => {
      elements.push(textElement({ id: `${id}-r${r + 1}-${c.key}`, text: String(row[c.key] ?? ''), bounds: [cx, cy + padY, c.width - 24, heights[i]], style: theme.font(c.size || size, { lineHeight: 1.35, fontWeight: c.weight || 400, color: c.color || p.ink }) }));
      cx += c.width;
    });
    cy += rh;
    if (rule) elements.push(lineElement({ id: `${id}-rule-${r + 1}`, from: [x, cy], to: [x + width, cy], style: { stroke: p.line, strokeWidth: 1 } }));
  });
  return { elements, height: cy - y, width };
}
