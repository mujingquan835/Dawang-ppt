import fs from 'node:fs';
import { textElement, imageElement, lineElement } from './elements.mjs';
import { pickIcon, iconElements } from './icons.mjs';

// Layout tools for authored pages on the 1920×1080 canvas. Each tool takes content and a position and returns
// elements plus the height it used, so a page can stack blocks without hand-computed coordinates. Grouping and
// alignment (number with unit, node with label, images in one row) are guaranteed here instead of by eye.
// Tools never choose content or page structure.

export const CANVAS = { width: 1920, height: 1080 };

// radius: one corner radius shared by tiles, panels and photos, so rounded components read as one family.
export function createTheme({ palette = {}, fontFamily = 'PingFang SC', headingFamily, radius = 14 } = {}) {
  const p = { bg: '#FFFFFF', ink: '#14213D', accent: '#E8590C', muted: '#5C6B7A', line: '#D9DEE5', pale: '#F2F4F7', inverse: '#FFFFFF', ...palette };
  const font = (size, extra = {}) => ({ fontFamily, fontSize: size, color: p.ink, fontWeight: 400, lineHeight: 1.4, ...extra });
  return { palette: p, fontFamily, headingFamily: headingFamily || fontFamily, font, radius };
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
    elements.push(imageElement({ id: `${id}-img-${i + 1}`, src: img.src, bounds: [cx, y, w, h], fit, naturalSize: [img.size.width, img.size.height], style: { radius: theme.radius ?? 0 }, ...(img.alt ? { alt: img.alt } : {}) }));
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
  const place = (i, bx, by, bw, bh) => elements.push(imageElement({ id: `${id}-img-${i}`, src: sized[i - 1].src, bounds: [Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)], fit, naturalSize: [sized[i - 1].size.width, sized[i - 1].size.height], style: { radius: theme.radius ?? 0 } }));
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
    elements.push(imageElement({ id: `${id}-img-${i + 1}`, src: img.src, bounds: [Math.round(bx), Math.round(by), Math.round(w), Math.round(h)], fit: 'cover', focal: img.focal || '50% 40%', naturalSize: [img.size.width, img.size.height], style: { radius: theme.radius ?? 0 }, ...(img.alt ? { alt: img.alt } : {}) }));
    if (img.caption) elements.push(textElement({ id: `${id}-caption-${i + 1}`, text: img.caption, bounds: [Math.round(bx), Math.round(by + h + 10), Math.round(w), cap - 10], style: theme.font(captionSize, { color: theme.palette.muted, lineHeight: 1.35 }) }));
  });
  return { elements, height, width, crop: +cost(viable[0]).toFixed(2) };
}

// Colour helpers for tiles and gradient blends.
export const rgba = (hex, alpha) => { const h = hex.replace('#', ''); const n = (i) => parseInt(h.slice(i, i + 2), 16); return `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${alpha})`; };
export const darken = (hex, k = 0.35) => '#' + [0, 2, 4].map((i) => Math.round(parseInt(hex.replace('#', '').slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('').toUpperCase();
// Mix toward white: lighten(c, 0.9) is a 10% tint of c.
export const lighten = (hex, k = 0.85) => '#' + [0, 2, 4].map((i) => Math.round(255 - (255 - parseInt(hex.replace('#', '').slice(i, i + 2), 16)) * (1 - k)).toString(16).padStart(2, '0')).join('').toUpperCase();

// Colour roles for report pages: primary carries "this period / achieved / the answer" and most of the colour on a
// page; secondary is the soft comparison side (last period, gaps, plans); pop marks the single strongest item. In the
// reference report template these take roughly 60% / 10% / 3% of all colour uses; the rest stays white and neutral.
// Palettes without these keys fall back to ink (primary), an accent tint (secondary) and accent (pop).
export function colorRoles(p) {
  const primary = p.primary || p.ink, secondary = p.secondary || lighten(p.accent, 0.55);
  return { primary, secondary, pop: p.pop || p.accent, band: p.band || lighten(primary, 0.94), soft: lighten(secondary, 0.8), secondaryInk: darken(secondary, 0.45), onSecondary: darken(secondary, 0.62) };
}

// Value with a smaller unit in one text element, centred in its column.
const centredValue = ({ id, x, y, width, value, unit, size, color, theme }) => {
  const unitSize = Math.max(20, Math.round(size * 0.42));
  const runs = [{ text: String(value), style: { fontSize: size, fontWeight: 700, color } }, ...(unit ? [{ text: ' ' + unit, style: { fontSize: unitSize, fontWeight: 700, color } }] : [])];
  return textElement({ id, text: String(value) + (unit ? ' ' + unit : ''), runs, bounds: [x, y, width, Math.round(size * 1.25)], style: theme.font(size, { fontWeight: 700, color, textAlign: 'center', lineHeight: 1.15 }) });
};

// KPI strip: one solid anchor block holds the summary figure (整体完成度, 年度合计), its peers follow on a tinted band
// split by thin rules, each with its label or note below. The anchor is the one place the eye lands first.
// Returns the column positions so content below can line up with each figure.
export function kpiStrip({ id, x, y, width, anchor, items, theme, height = 150, anchorWidth, size = 56, color, labelPosition = 'below' }) {
  const p = theme.palette, r = colorRoles(p), aw = anchor ? anchorWidth || Math.round(width * 0.17) : 0, elements = [];
  const n = items.length, colW = (width - aw) / n, labelSize = 22, valueH = Math.round(size * 1.25), labelH = Math.round(labelSize * 1.4);
  elements.push({ type: 'shape', id: `${id}-band`, bounds: [x + aw, y, width - aw, height], style: { fill: r.band } });
  if (anchor) {
    elements.push({ type: 'shape', id: `${id}-anchor`, bounds: [x, y, aw, height], style: { fill: r.primary } });
    const block = labelH + 6 + valueH, ay = y + Math.round((height - block) / 2);
    elements.push(textElement({ id: `${id}-anchor-label`, text: anchor.label, bounds: [x + 12, ay, aw - 24, labelH], style: theme.font(labelSize, { color: p.inverse, textAlign: 'center' }) }));
    elements.push(centredValue({ id: `${id}-anchor-value`, x: x + 12, y: ay + labelH + 6, width: aw - 24, value: anchor.value, unit: anchor.unit, size: Math.round(size * 1.05), color: p.inverse, theme }));
  }
  const columns = [];
  items.forEach((it, i) => {
    const cx = Math.round(x + aw + i * colW), cw = Math.round(colW), text = it.note ?? it.label ?? '';
    const block = valueH + (text ? 6 + labelH : 0), top = y + Math.round((height - block) / 2);
    const vy = labelPosition === 'above' && text ? top + labelH + 6 : top;
    if (text) elements.push(textElement({ id: `${id}-label-${i + 1}`, text, bounds: [cx + 12, labelPosition === 'above' ? top : top + valueH + 6, cw - 24, labelH], style: theme.font(labelSize, { color: p.muted, textAlign: 'center' }) }));
    elements.push(centredValue({ id: `${id}-value-${i + 1}`, x: cx + 12, y: vy, width: cw - 24, value: it.value, unit: it.unit, size, color: it.color || color || r.primary, theme }));
    if (i > 0) elements.push(lineElement({ id: `${id}-rule-${i}`, from: [cx, y + Math.round(height * 0.28)], to: [cx, y + Math.round(height * 0.72)], style: { stroke: p.line, strokeWidth: 2 } }));
    columns.push([cx, cw]);
  });
  return { elements, height, columns };
}

// Metric tiles: each number sits in its own rounded rectangle with the label above it; the highlighted tile carries
// an accent bar and accent number. When a tile's content leaves a wide empty strip on the right, a line icon chosen
// from the label fills it (icons: false turns this off, item.icon names one or false); a tile that is already full
// gets none.
export function metricTiles({ id, x, y, width, items, theme, size = 72, columns, gap = 24, highlight = 0, fill, icons = 'auto' }) {
  const p = theme.palette, cols = columns || items.length, tileW = Math.floor((width - gap * (cols - 1)) / cols);
  const tileFill = fill || p.tile || (String(p.bg).toUpperCase() === '#FFFFFF' ? p.pale : '#FFFFFF');
  const labelSize = Math.max(20, Math.round(size * 0.3)), tileH = 24 + Math.round(labelSize * 1.4) + 8 + Math.round(size * 1.25) + 18, elements = [];
  items.forEach((it, i) => {
    const tx = x + (i % cols) * (tileW + gap), ty = y + Math.floor(i / cols) * (tileH + gap), on = i === highlight;
    elements.push({ type: 'shape', id: `${id}-tile-${i + 1}`, bounds: [tx, ty, tileW, tileH], style: { fill: tileFill, radius: theme.radius ?? 14 } });
    if (on) elements.push({ type: 'shape', id: `${id}-bar-${i + 1}`, bounds: [tx, ty + 14, 8, tileH - 28], style: { fill: p.accent, radius: 4 } });
    elements.push(textElement({ id: `${id}-label-${i + 1}`, text: it.label || '', bounds: [tx + 28, ty + 22, tileW - 44, Math.round(labelSize * 1.4)], style: theme.font(labelSize, { fontWeight: 700, color: p.muted }) }));
    const unitSize = Math.max(20, Math.round(size * 0.32));
    const runs = [{ text: String(it.value), style: { fontSize: size, fontWeight: 700, color: on ? p.accent : p.ink } }, ...(it.unit ? [{ text: ' ' + it.unit, style: { fontSize: unitSize, fontWeight: 700, color: p.muted } }] : [])];
    const contentW = Math.max(textWidth(it.label || '', labelSize), textWidth(String(it.value), size) + (it.unit ? textWidth(' ' + it.unit, unitSize) : 0));
    // The icon grows with the spare room (up to 96px, never taller than the tile allows); under 36px it is left out.
    const spare = tileW - 28 - 16 - contentW, iconS = Math.round(Math.min(96, tileH - 36, spare - 24));
    const name = it.icon === false || icons === false ? null : it.icon || pickIcon(`${it.label || ''}${it.unit || ''}`);
    const withIcon = name && iconS >= 36;
    const textW = withIcon ? tileW - 44 - iconS - 16 : tileW - 44;
    elements.push(textElement({ id: `${id}-value-${i + 1}`, text: String(it.value) + (it.unit ? ' ' + it.unit : ''), runs, bounds: [tx + 28, ty + 24 + Math.round(labelSize * 1.4) + 4, textW, Math.round(size * 1.25)], style: theme.font(size, { fontWeight: 700, lineHeight: 1.15, color: on ? p.accent : p.ink }) }));
    if (withIcon) elements.push(...iconElements({ id: `${id}-tile-${i + 1}`, name, bounds: [tx + tileW - iconS - 20, ty + Math.round((tileH - iconS) / 2), iconS], color: on ? p.accent : p.muted, disc: rgba(on ? p.accent : p.ink, on ? 0.12 : 0.06) }));
  });
  const rows = Math.ceil(items.length / cols);
  return { elements, height: rows * tileH + (rows - 1) * gap };
}

// Photo panel: a solid colour block whose text half fades into a photo (gradient from the panel colour to clear over
// the photo's inner edge). For pages with little text and photos that each illustrate one point. textSide 'left'
// puts text left and the photo right; 'top' puts text above a photo that fills the lower part.
export function photoPanel({ id, bounds: [x, y, w, h], photo, title, lines = [], color, theme, textSide = 'left', textShare = 0.5 }) {
  const p = theme.palette, c = color || p.ink, size = photo.size || imageSize(photo.src), elements = [];
  elements.push({ type: 'shape', id: `${id}-base`, bounds: [x, y, w, h], style: { fill: c } });
  const pad = 40;
  let img, fade, text;
  if (textSide === 'top') {
    const iy = y + Math.round(h * (textShare - 0.12)); img = [x, iy, w, y + h - iy];
    fade = [x, iy, w, Math.round(img[3] * 0.32)]; text = [x + pad, y + pad, w - pad * 2, Math.round(h * textShare) - pad];
  } else {
    const ix = x + Math.round(w * (textShare - 0.15)); img = [ix, y, x + w - ix, h];
    fade = [ix, y, Math.round(img[2] * 0.55), h]; text = [x + pad, y + pad, Math.round(w * textShare) - pad - 20, h - pad * 2];
  }
  // A photo below the text keeps its upper part (faces, screens) clear of the fade.
  elements.push(imageElement({ id: `${id}-photo`, src: photo.src, bounds: img, fit: 'cover', focal: photo.focal || (textSide === 'top' ? '50% 25%' : '50% 40%'), naturalSize: [size.width, size.height] }));
  const dir = textSide === 'top' ? '180deg' : '90deg';
  elements.push({ type: 'shape', id: `${id}-fade`, bounds: fade, style: { fill: `linear-gradient(${dir}, ${rgba(c, 1)} 0%, ${rgba(c, 0.85)} 35%, ${rgba(c, 0)} 100%)` } });
  const titleSize = Math.min(56, Math.max(36, Math.floor(text[2] / Math.max(4, Math.min(9, String(title).length)))));
  const th = textHeight(title, titleSize, text[2], 1.2) + Math.round(titleSize * 0.25);
  elements.push(textElement({ id: `${id}-title`, text: title, bounds: [text[0], text[1], text[2], th], style: theme.font(titleSize, { fontWeight: 800, color: p.inverse, lineHeight: 1.2 }) }));
  const barW = Math.min(text[2], Math.round(textWidth(String(title).split('\n').pop(), titleSize)));
  elements.push({ type: 'shape', id: `${id}-bar`, bounds: [text[0], text[1] + th + 10, barW, 6], style: { fill: p.accent } });
  let ly = text[1] + th + 36;
  lines.forEach((line, i) => { const lh = textHeight(line, 26, text[2], 1.35); elements.push(textElement({ id: `${id}-line-${i + 1}`, text: line, bounds: [text[0], ly, text[2], lh], style: theme.font(26, { color: p.inverse, lineHeight: 1.35 }) })); ly += lh + 6; });
  return { elements };
}

// Move a block sideways, e.g. to centre a photo grid that is narrower than its zone.
export const shiftX = (elements, dx) => (dx ? elements.map((e) => ({ ...e, bounds: [e.bounds[0] + Math.round(dx), ...e.bounds.slice(1)] })) : elements);

// An image sized to fit a box at its own aspect ratio (never above maxUpscale × its pixels), centred in the box.
export function fitImage({ id, src, size, box: [bx, by, bw, bh], maxUpscale = 2, alt, radius = 0 }) {
  const s = size || imageSize(src), r = s.width / s.height;
  let w = Math.min(bw, bh * r, s.width * maxUpscale), h = w / r;
  if (h > bh) { h = bh; w = h * r; }
  return imageElement({ id, src, bounds: [Math.round(bx + (bw - w) / 2), Math.round(by + (bh - h) / 2), Math.round(w), Math.round(h)], fit: 'contain', naturalSize: [s.width, s.height], ...(radius ? { style: { radius } } : {}), ...(alt ? { alt } : {}) });
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
