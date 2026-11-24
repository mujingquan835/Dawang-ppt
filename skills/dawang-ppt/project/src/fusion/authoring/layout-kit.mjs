import fs from 'node:fs';
import { textElement, imageElement, lineElement } from './elements.mjs';
import { pickIcon, iconElements } from './icons.mjs';
import { readImageBytesSize } from '../export/ir-collect.mjs';

// Layout tools for authored pages on the 1920×1080 canvas. Each tool takes content and a position and returns
// elements plus the height it used, so a page can stack blocks without hand-computed coordinates. Grouping and
// alignment (number with unit, node with label, images in one row) are guaranteed here instead of by eye.
// Tools never choose content or page structure.

export const CANVAS = { width: 1920, height: 1080 };

// radius: one corner radius shared by tiles, panels and photos, so rounded components read as one family.
// roles: dual-font typography scale:
//   - Body & structured hierarchy: Source Han Sans SC (400 Regular / 500 Medium / 700 Bold / 900 Heavy)
//   - Display / artistic titles:   YouSheBiaoTiHei (cover titles, page main titles, hero highlights)
export function createTheme({ palette = {}, fontFamily = 'Source Han Sans SC', headingFamily, displayFamily = 'YouSheBiaoTiHei', radius = 14, roles = {} } = {}) {
  const p = { bg: '#FFFFFF', ink: '#14213D', accent: '#E8590C', gold: '#B58A42', body: '#4B5563', muted: '#5C6B7A', line: '#D9DEE5', pale: '#F2F4F7', highlightBg: '#F7F0E3', inverse: '#FFFFFF', ...palette };
  const hFamily = headingFamily || fontFamily;
  const dFamily = displayFamily || hFamily;
  const defaultRoles = {
    eyebrow: { fontFamily, fontSize: 20, fontWeight: 400, color: p.accent, lineHeight: 1.3, letterSpacing: 0.6 },
    coverTitle: { fontFamily: dFamily, fontSize: 84, fontWeight: 400, color: p.inverse, lineHeight: 1.22, letterSpacing: 0.5, wordSpacing: '-0.18em' },
    pageTitle: { fontFamily: hFamily, fontSize: 52, fontWeight: 700, color: p.ink, lineHeight: 1.25, letterSpacing: -0.6 },
    pageTitleFocus: { fontFamily: hFamily, fontSize: 52, fontWeight: 900, color: p.accent, lineHeight: 1.25, letterSpacing: -0.6 },
    heroMetric: { fontFamily: hFamily, fontSize: 80, fontWeight: 900, color: p.accent, lineHeight: 1.2, letterSpacing: -1.5 },
    subHeroMetric: { fontFamily: hFamily, fontSize: 54, fontWeight: 900, color: p.accent, lineHeight: 1.25, letterSpacing: -0.8 },
    metricUnit: { fontFamily, fontSize: 26, fontWeight: 300, color: p.accent, lineHeight: 1.3 },
    sectionTitle: { fontFamily: hFamily, fontSize: 30, fontWeight: 700, color: p.accent, lineHeight: 1.32, letterSpacing: -0.2 },
    keyNumber: { fontFamily: hFamily, fontSize: 34, fontWeight: 900, color: p.accent, lineHeight: 1.25, letterSpacing: -0.4 },
    itemTitle: { fontFamily: hFamily, fontSize: 28, fontWeight: 700, color: p.ink, lineHeight: 1.32 },
    stepTitle: { fontFamily: hFamily, fontSize: 26, fontWeight: 700, color: p.ink, lineHeight: 1.32 },
    roleSubtitle: { fontFamily, fontSize: 22, fontWeight: 400, color: p.accent, lineHeight: 1.32 },
    badge: { fontFamily, fontSize: 28, fontWeight: 700, color: p.inverse, lineHeight: 1.15 },
    tagBadge: { fontFamily, fontSize: 20, fontWeight: 700, color: p.inverse, lineHeight: 1.2, letterSpacing: 0.4 },
    body: { fontFamily, fontSize: 24, fontWeight: 300, color: p.body || p.ink, lineHeight: 1.45 },
    tableHeader: { fontFamily, fontSize: 20, fontWeight: 400, color: p.muted, lineHeight: 1.3, letterSpacing: 0.4 },
    tableKey: { fontFamily, fontSize: 24, fontWeight: 400, color: p.ink, lineHeight: 1.36 },
    tableBody: { fontFamily, fontSize: 22, fontWeight: 300, color: p.body || p.ink, lineHeight: 1.4 },
    stepDetail: { fontFamily, fontSize: 22, fontWeight: 300, color: p.body || p.ink, lineHeight: 1.42 },
    tableEmphasis: { fontFamily, fontSize: 24, fontWeight: 700, color: p.accent, lineHeight: 1.36 },
    caption: { fontFamily, fontSize: 20, fontWeight: 300, color: p.muted, lineHeight: 1.35 },
    lightNote: { fontFamily, fontSize: 20, fontWeight: 300, color: p.muted, lineHeight: 1.36 }
  };
  const resolvedRoles = Object.fromEntries(Object.keys({ ...defaultRoles, ...roles }).map((k) => [k, { ...(defaultRoles[k] || { fontFamily, color: p.ink, fontWeight: 400, lineHeight: 1.4 }), ...(roles[k] || {}) }]));
  const font = (size, extra = {}) => {
    const isHeading = extra.fontWeight >= 600 && size >= 28;
    return { fontFamily: isHeading ? hFamily : fontFamily, fontSize: size, color: p.ink, fontWeight: 400, lineHeight: 1.4, ...extra };
  };
  const roleStyle = (role, extra = {}) => {
    if (!Object.hasOwn(resolvedRoles, role)) throw new Error('Unknown typography role: ' + role);
    return { ...resolvedRoles[role], ...extra };
  };
  const metricRuns = (value, unit = '', { valueRole = 'heroMetric', unitRole = 'metricUnit', color, unitColor, size, unitSize, gap = ' ' } = {}) => {
    const vs = roleStyle(valueRole, { ...(size ? { fontSize: size } : {}), ...(color ? { color } : {}) });
    const us = roleStyle(unitRole, { ...(unitSize ? { fontSize: unitSize } : {}), color: unitColor || color || vs.color });
    const runs = [{ text: String(value), style: { fontFamily: vs.fontFamily, fontSize: vs.fontSize, fontWeight: vs.fontWeight, color: vs.color } }, ...(unit ? [{ text: gap + unit, style: { fontFamily: us.fontFamily, fontSize: us.fontSize, fontWeight: us.fontWeight, color: us.color } }] : [])];
    return { text: String(value) + (unit ? gap + unit : ''), runs, style: vs };
  };
  return { palette: p, fontFamily, headingFamily: hFamily, displayFamily: dFamily, font, roles: resolvedRoles, roleStyle, metricRuns, radius };
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
// span: the last slot shrinks to its own text, so the nodes reach across the whole width instead of leaving the right side empty.
export function flow({ id, x, y, width, steps, theme, node: requested = 52, titleSize = 30, detailSize = 22, numbered = true, color, span = false }) {
  // Numbers stay at 28px bold (large text for the contrast check), so a numbered node is never smaller than 48px.
  const node = numbered ? Math.max(48, requested) : requested;
  const p = theme.palette, fill = color || p.accent, n = steps.length, last = steps[n - 1], lastW = span && n > 1 ? Math.min(width / n, Math.max(node, textWidth(last.title, titleSize), textWidth(last.detail || '', detailSize)) + 24) : width / n, slot = n > 1 ? (width - lastW) / (n - 1) : width, elements = [];
  const labelW = Math.round(slot - 24), finalW = Math.round(lastW - 24);
  let h = node;
  steps.forEach((step, i) => {
    const nx = Math.round(x + i * slot);
    elements.push({ type: 'shape', id: `${id}-node-${i + 1}`, bounds: [nx, y, node, node], style: { fill, radius: node / 2 } });
    if (numbered) elements.push(textElement({ id: `${id}-num-${i + 1}`, text: String(i + 1).padStart(2, '0'), bounds: [nx, y + Math.round((node - Math.max(28, node * 0.54) * 1.3) / 2), node, Math.round(Math.max(28, node * 0.54) * 1.3)], style: theme.font(Math.max(28, Math.round(node * 0.54)), { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.3 }) }));
    if (i < n - 1) elements.push({ ...lineElement({ id: `${id}-link-${i + 1}`, from: [nx + node + 12, y + node / 2], to: [Math.round(x + (i + 1) * slot) - 12, y + node / 2], style: { stroke: fill, strokeWidth: 3 } }), endArrow: true });
    let ty = y + node + 20;
    const w = i === n - 1 ? finalW : labelW, th = textHeight(step.title, titleSize, w, 1.3);
    elements.push(textElement({ id: `${id}-title-${i + 1}`, text: step.title, bounds: [nx, ty, w, th], style: theme.font(titleSize, { fontWeight: 700, lineHeight: 1.3 }) }));
    ty += th + 6;
    if (step.detail) { const dh = textHeight(step.detail, detailSize, w, 1.4); elements.push(textElement({ id: `${id}-detail-${i + 1}`, text: step.detail, bounds: [nx, ty, w, dh], style: theme.font(detailSize, { color: p.muted }) })); ty += dh; }
    h = Math.max(h, ty - y);
  });
  return { elements, height: h };
}

// start: the first number, so one list split across columns keeps counting (01, 02, 03 instead of 01, 01, 01).
export function numberedList({ id, x, y, width, items, theme, badge = 56, titleSize = 34, detailSize = 24, gap = 40, color, start = 1 }) {
  const p = theme.palette, textX = x + badge + 28, textW = width - badge - 28, elements = [];
  let cy = y;
  items.forEach((it, i) => {
    elements.push({ type: 'shape', id: `${id}-badge-${i + 1}`, bounds: [x, cy, badge, badge], style: { fill: color || p.accent, radius: 6 } });
    elements.push(textElement({ id: `${id}-num-${i + 1}`, text: String(start + i).padStart(2, '0'), bounds: [x, cy + Math.round((badge - Math.max(28, badge * 0.5) * 1.3) / 2), badge, Math.round(Math.max(28, badge * 0.5) * 1.3)], style: theme.font(Math.max(28, Math.round(badge * 0.5)), { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.3 }) }));
    const th = textHeight(it.title, titleSize, textW, 1.3);
    elements.push(textElement({ id: `${id}-title-${i + 1}`, text: it.title, bounds: [textX, cy + Math.max(0, Math.round((badge - titleSize * 1.3) / 2)), textW, th], style: theme.font(titleSize, { fontWeight: 700, lineHeight: 1.3 }) }));
    let used = Math.max(badge, th);
    if (it.detail) { const dh = textHeight(it.detail, detailSize, textW); elements.push(textElement({ id: `${id}-detail-${i + 1}`, text: it.detail, bounds: [textX, cy + used + 8, textW, dh], style: theme.font(detailSize) })); used += 8 + dh; }
    cy += used + gap;
  });
  return { elements, height: cy - y - gap };
}

// PNG/JPEG(EXIF-aware)/WebP/GIF pixel size from the file header, used for aspect ratio and the upscale limit.
export function imageSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(65536);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    const sz = readImageBytesSize(head.subarray(0, n));
    if (sz && sz.width > 0 && sz.height > 0) return sz;
    const full = fs.readFileSync(file);
    const sz2 = readImageBytesSize(full);
    if (sz2 && sz2.width > 0 && sz2.height > 0) return sz2;
  } finally {
    fs.closeSync(fd);
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
// always: true never declines — the frames are fixed first (to mirror the neighbouring column) and every photo is
// cropped into its frame, choosing the arrangement that crops least. See imageFrames.
export function imageFill({ id, x, y, width, height, images, theme, gap = 24, captionSize = 20, maxCrop = 1.45, maxUpscale = 2.2, always = false, tall = 'left' }) {
  const sized = images.map((img) => ({ ...img, size: img.size || imageSize(img.file || img.src) }));
  const ratio = (img) => img.size.width / img.size.height, cap = sized.some((i) => i.caption) ? Math.ceil(captionSize * 1.35) + 10 : 0;
  const cost = (boxes) => Math.max(...boxes.map(({ img, w, h }) => Math.max((w / h) / ratio(img), ratio(img) / (w / h))));
  const tooBig = (boxes) => boxes.some(({ img, w, h }) => w > img.size.width * maxUpscale || h > img.size.height * maxUpscale);
  const options = [];
  // One row: shared height, widths in proportion to the photos, stretched to the full width.
  { const h = height - cap, k = (width - gap * (sized.length - 1)) / sized.reduce((a, i) => a + ratio(i), 0);
    let cx = x; options.push(sized.map((img) => { const w = k * ratio(img); const b = { img, x: cx, y, w, h }; cx += w + gap; return b; })); }
  // Mosaic: tall photo on one side (left by default), the others stacked on the other side with equal heights.
  if (sized.length >= 3) {
    const order = [...sized].sort((a, b) => ratio(a) - ratio(b)), [tallImg, ...rest] = order, n = rest.length;
    const rh = (height - cap * n - gap * (n - 1)) / n;
    for (let f = 0.25; f <= 0.6; f += 0.01) {
      const w0 = (width - gap) * f, w2 = width - gap - w0, tx = tall === 'right' ? x + w2 + gap : x, sx = tall === 'right' ? x : x + w0 + gap;
      options.push([{ img: tallImg, x: tx, y, w: w0, h: height - cap }, ...rest.map((img, i) => ({ img, x: sx, y: y + i * (rh + cap + gap), w: w2, h: rh }))]);
    }
  }
  // Two rows, each spanning the full width at its own shared height; row heights follow the photos' ratios, so a
  // short last row no longer ends early. Every split point is tried.
  if (sized.length >= 3) for (let k = 1; k < sized.length; k++) {
    const rows = [sized.slice(0, k), sized.slice(k)], nat = rows.map((r) => (width - gap * (r.length - 1)) / r.reduce((a, i) => a + ratio(i), 0));
    const scale = (height - cap * 2 - gap) / (nat[0] + nat[1]);
    let cy = y; const boxes = [];
    rows.forEach((r, ri) => { const h = nat[ri] * scale, sum = r.reduce((a, i) => a + ratio(i), 0); let cx = x; r.forEach((img) => { const w = (width - gap * (r.length - 1)) * ratio(img) / sum; boxes.push({ img, x: cx, y: cy, w, h }); cx += w + gap; }); cy += h + cap + gap; });
    options.push(boxes);
  }
  // Frames that always fill: one column (a narrow tall box) and, for four photos, a 2 × 2 grid.
  if (always && sized.length >= 2) {
    const n = sized.length, rh = (height - cap * n - gap * (n - 1)) / n;
    options.push(sized.map((img, i) => ({ img, x, y: y + i * (rh + cap + gap), w: width, h: rh })));
    if (n === 4) { const cw = (width - gap) / 2, ch = (height - cap * 2 - gap) / 2; options.push(sized.map((img, i) => ({ img, x: x + (i % 2) * (cw + gap), y: y + Math.floor(i / 2) * (ch + cap + gap), w: cw, h: ch }))); }
  }
  if (always && sized.length === 1) options.push([{ img: sized[0], x, y, w: width, h: height - cap }]);
  const byCost = (a, b) => cost(a) - cost(b);
  let viable = options.filter((o) => !tooBig(o) && cost(o) <= maxCrop).sort(byCost);
  if (!viable.length && always) viable = [...options].sort(byCost);
  if (!viable.length) return null;
  const elements = [];
  viable[0].forEach(({ img, x: bx, y: by, w, h }, i) => {
    // Round the edges, not the sizes, so tiled frames meet exactly and end on the box edge.
    const b = [Math.round(bx), Math.round(by), Math.round(bx + w) - Math.round(bx), Math.round(by + h) - Math.round(by)];
    // A framed photo remembers its frame: later edits may move the crop (focal), not shrink it or show it whole.
    elements.push(imageElement({ id: `${id}-img-${i + 1}`, src: img.src, bounds: b, fit: 'cover', focal: img.focal || '50% 40%', naturalSize: [img.size.width, img.size.height], style: { radius: theme.radius ?? 0 }, ...(always ? { frame: b } : {}), ...(img.alt ? { alt: img.alt } : {}) }));
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
  if (p.dark) {
    return {
      primary,
      secondary,
      pop: p.pop || p.accent,
      band: p.band || '#152238',
      soft: p.pale || '#1B2A44',
      secondaryInk: secondary,
      onSecondary: '#0D1526',
    };
  }
  return { primary, secondary, pop: p.pop || p.accent, band: p.band || lighten(primary, 0.94), soft: lighten(secondary, 0.84), secondaryInk: darken(secondary, 0.35), onSecondary: darken(secondary, 0.55) };
}

// Value with a smaller unit in one text element, centred in its column.
// Heavy (900) figure paired with Regular (400) unit creates crisp typographic hierarchy.
const centredValue = ({ id, x, y, width, value, unit, size, color, theme }) => {
  const unitSize = Math.max(16, Math.round(size * 0.38));
  const runs = [{ text: String(value), style: { fontSize: size, fontWeight: 900, color } }, ...(unit ? [{ text: ' ' + unit, style: { fontSize: unitSize, fontWeight: 400, color } }] : [])];
  return textElement({ id, text: String(value) + (unit ? ' ' + unit : ''), runs, bounds: [x, y, width, Math.round(size * 1.25)], style: theme.font(size, { fontWeight: 900, color, textAlign: 'center', lineHeight: 1.15 }) });
};

// KPI strip: one solid anchor block holds the summary figure (整体完成度, 年度合计), its peers follow on a tinted band
// split by thin rules, each with its label or note below. The anchor is the one place the eye lands first.
// Returns the column positions so content below can line up with each figure.
export function kpiStrip({ id, x, y, width, anchor, items, theme, height = 150, anchorWidth, size = 56, anchorSize, labelSize = 18, labelLines = 1, color, labelPosition = 'below' }) {
  const p = theme.palette, r = colorRoles(p), aw = anchor ? anchorWidth || Math.round(width * 0.17) : 0, elements = [];
  const n = items.length, colW = (width - aw) / n, valueH = Math.round(size * 1.25), labelH = Math.round(labelSize * 1.4 * labelLines);
  elements.push({ type: 'shape', id: `${id}-band`, component: 'kpiStrip', bounds: [x + aw, y, width - aw, height], style: { fill: r.band } });
  if (anchor) {
    elements.push({ type: 'shape', id: `${id}-anchor`, bounds: [x, y, aw, height], style: { fill: r.primary, radius: theme.radius ? Math.min(theme.radius, 12) : 0 } });
    // Subtle secondary-gold accent bar along the anchor's top edge (echoing blue-gold dual-tone craftsmanship)
    elements.push({ type: 'shape', id: `${id}-anchor-trim`, bounds: [x, y, aw, 5], style: { fill: r.secondary } });
    const block = labelH + 6 + valueH, ay = y + Math.round((height - block) / 2);
    elements.push(textElement({ id: `${id}-anchor-label`, text: anchor.label, bounds: [x + 12, ay, aw - 24, labelH], style: theme.font(labelSize, { fontWeight: 500, color: p.inverse, textAlign: 'center' }) }));
    elements.push(centredValue({ id: `${id}-anchor-value`, x: x + 12, y: ay + labelH + 6, width: aw - 24, value: anchor.value, unit: anchor.unit, size: anchorSize ?? Math.round(size * 1.05), color: p.inverse, theme }));
  }
  const columns = [];
  const popInk = p.dark ? r.pop : readableInk(r.pop, r.band, 3.1);
  const secInk = p.dark ? r.secondary : readableInk(r.secondaryInk || r.secondary, r.band, 3.2);
  items.forEach((it, i) => {
    const cx = Math.round(x + aw + i * colW), cw = Math.round(colW), text = it.note ?? it.label ?? '';
    const block = valueH + (text ? 6 + labelH : 0), top = y + Math.round((height - block) / 2);
    const vy = labelPosition === 'above' && text ? top + labelH + 6 : top;
    // Three-tone rhythm across peer figures: first peer spotlights pop accent, alternating primary & warm secondary
    const figColor = it.color || color || (i === 0 ? popInk : i % 2 === 1 ? r.primary : secInk);
    if (text) elements.push(textElement({ id: `${id}-label-${i + 1}`, text, bounds: [cx + 12, labelPosition === 'above' ? top : top + valueH + 6, cw - 24, labelH], style: theme.font(labelSize, { fontWeight: 400, color: p.body || p.muted, textAlign: 'center' }) }));
    elements.push(centredValue({ id: `${id}-value-${i + 1}`, x: cx + 12, y: vy, width: cw - 24, value: it.value, unit: it.unit, size, color: figColor, theme }));
    if (i > 0) elements.push(lineElement({ id: `${id}-rule-${i}`, from: [cx, y + Math.round(height * 0.28)], to: [cx, y + Math.round(height * 0.72)], style: { stroke: p.dark ? p.line : r.secondary, strokeWidth: 2 } }));
    columns.push([cx, cw]);
  });
  return { elements, height, columns };
}

// Metric tiles: each number sits in its own rounded rectangle with the label above it; the highlighted tile carries
// an accent bar and accent number. When a tile's content leaves a wide empty strip on the right, a line icon chosen
// from the label fills it (item.icon names a different one); a tile that is already full gets none. There is no
// switch to leave a wide empty strip bare.
// highlightStyle 'solid' turns the highlighted tile into a solid primary block with white text (the one inverted
// column among peers); 'bar' (default) keeps the accent bar and accent number.
// tileHeight makes tiles taller than their content (the content stays centred), so a thin page can give its numbers more presence.
export function metricTiles({ id, x, y, width, items, theme, size = 72, columns, gap = 24, highlight = 0, fill, icons = 'auto', highlightStyle = 'bar', tileHeight, growValue = false, iconCap = 180, figureSize }) {
  const p = theme.palette, cols = columns || items.length, tileW = Math.floor((width - gap * (cols - 1)) / cols);
  const tileFill = fill || p.tile || (String(p.bg).toUpperCase() === '#FFFFFF' ? p.pale : '#FFFFFF');
  const labelSize = Math.max(17, Math.min(20, Math.round(size * 0.34))), labelH = Math.round(labelSize * 1.4), noteH = items.some((it) => it.note) ? labelH + 2 : 0, naturalOf = (s) => 24 + labelH + 8 + Math.round(s * 1.32) + noteH + 18, tileH = Math.max(naturalOf(figureSize || size), Math.round(tileHeight || 0)), elements = [];
  const unitOf = (s) => Math.max(16, Math.round(s * 0.32)), iconMax = iconCap, beforeOf = (s) => Math.max(18, Math.round(s * 0.56));
  // item.before is the earlier value: it reads "before → value" on one line, smaller than the figure it leads to.
  const figureWidth = (it, s) => (it.before != null ? textWidth(`${it.before} → `, beforeOf(s)) : 0) + textWidth(String(it.value), s) + (it.unit ? textWidth(' ' + it.unit, unitOf(s)) : 0), widest = (s) => Math.max(...items.map((it) => figureWidth(it, s)));
  // A tile stretched taller than it needs shows that in the figure, not in a bigger icon. Tiles in one group share one size.
  // figureSize sets the figure on its own, leaving the label at the size it has for `size`.
  let valueSize = figureSize || size;
  if (growValue && tileH > naturalOf(size)) for (let s = Math.min(Math.round(size * 1.75), Math.floor((tileH - 50 - labelH - noteH) / 1.32)); s > size; s -= 2) if (widest(s) <= (tileW - 44 - iconMax - 16) * 0.88) { valueSize = s; break; }
  // Hard width guard: shrink valueSize if the widest figure would wrap or overflow the tile's inner width.
  while (valueSize > 26 && widest(valueSize) > (tileW - 52) * 0.92) valueSize -= 2;
  const unitSize = unitOf(valueSize), naturalTile = naturalOf(valueSize), inset = Math.round((tileH - naturalTile) / 2);
  // Icons grow with the spare room (up to 180px, never taller than the tile allows) and cannot be switched off: a tile
  // with a wide empty strip always gets one (user rule); item.icon picks which. Tiles in one group share one icon
  // size, and a group has icons on every tile or on none: when one tile has no room for 56px, the whole group goes without.
  const contentOf = (it) => Math.max(textWidth(it.label || '', labelSize), textWidth(it.note || '', labelSize), figureWidth(it, valueSize));
  const fits = items.map((it) => Math.round(Math.min(iconMax, tileH - 36, tileW - 28 - 16 - contentOf(it) - 24)));
  const iconS = Math.min(...fits.filter((v) => v >= 56), iconMax), everyIcon = fits.every((v) => v >= 56);
  items.forEach((it, i) => {
    const tx = x + (i % cols) * (tileW + gap), ty = y + Math.floor(i / cols) * (tileH + gap), on = i === highlight, solid = on && highlightStyle === 'solid';
    const roles = colorRoles(p);
    const isPartner = !on && items.length >= 2 && (highlight >= 0 ? i === (highlight + 1) % items.length : i % 2 === 1);
    const name = (typeof it.icon === 'string' && it.icon) || pickIcon(`${it.label || ''}${it.unit || ''}`);
    const withIcon = name && everyIcon;
    const built = renderMetricCard({
      id, num: i + 1, cx: tx, cy: ty, cw: tileW, ch: tileH, it,
      solid, isPartner, theme, p, r: roles,
      forcedValSize: (tileW / Math.max(1, tileH) >= 1.65 && tileW >= 360 && !withIcon) ? null : valueSize,
      forcedLabelSize: labelSize,
      iconInfo: withIcon ? { name, size: iconS } : null,
      accentBar: on && highlightStyle === 'bar',
    });
    elements.push(...built.elements);
  });
  const rows = Math.ceil(items.length / cols);
  return { elements, height: rows * tileH + (rows - 1) * gap, valueSize };
}

// Universal Aspect-Ratio-Aware Metric Card renderer shared by both metricBento and metricTiles.
// Adapts purely from the card's own (cw, ch) geometry — never hardcoded to a specific slide:
//   - Wide horizontal card (cw / ch >= 1.65 & cw >= 360): Left Meta (Label + Target Pill) | Right Giant Figure
//   - Square / compact card: Vertically stacked with figure scaled proportionally to fill the box cleanly
function renderMetricCard({ id, num, cx, cy, cw, ch, it, solid, isPartner, theme, p, r, forcedValSize = null, forcedLabelSize = null, iconInfo = null, maxValCap = null, accentBar = false }) {
  const pad = Math.min(28, Math.max(18, Math.round(cw * 0.055)));
  const iw = cw - pad * 2;
  const fill = solid ? r.primary : (p.dark ? (p.surface || '#152238') : '#FFFFFF');
  const stroke = solid ? null : (isPartner ? (p.dark ? p.line : lighten(r.secondary, 0.35)) : (p.line || '#E2E6EE'));
  const mainColor = p.primary ? r.primary : (p.accent || r.primary);
  const topAccent = solid ? r.pop : isPartner ? r.secondary : mainColor;
  const valColor = solid ? p.inverse : isPartner ? (p.dark ? r.secondary : readableInk(r.secondaryInk || r.secondary, fill, 3.2)) : mainColor;
  const labelColor = solid ? (p.dark ? p.inverse : '#E2E8F0') : (p.body || p.muted);
  const rad = theme.radius ?? 14;
  const elements = [];

  elements.push({ type: 'shape', id: `${id}-tile-${num}`, component: solid ? 'highlightTile' : 'metricTiles', bounds: [cx, cy, cw, ch], style: { fill, ...(stroke ? { stroke, strokeWidth: 1.5 } : {}), radius: rad } });
  elements.push({ type: 'shape', id: accentBar ? `${id}-bar-${num}` : `${id}-trim-${num}`, bounds: [cx + 20, cy, Math.max(24, cw - 40), 5], style: { fill: topAccent, radius: 3 } });

  const parseRatio = (val, note) => {
    const n = (s) => { const m = String(s ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
    const v = n(val), t = note && /目标/.test(note) ? n(note) : null;
    return v != null && t != null && t > 0 ? v / t : null;
  };
  const ratio = parseRatio(it.value, it.note);
  const hasTrend = Array.isArray(it.trend) && it.trend.length >= 2 && it.trend.every(Number.isFinite);
  const barReserve = ratio != null ? 24 : 12;
  const innerH = ch - 12 - barReserve;

  const drawSparkline = (sx, sy, sw, sh, pts, strokeCol, dotCol) => {
    const mn = Math.min(...pts), mx = Math.max(...pts), span = Math.max(1e-6, mx - mn);
    const coords = pts.map((v, idx) => [
      Math.round(sx + (idx / (pts.length - 1)) * sw),
      Math.round(sy + sh - ((v - mn) / span) * (sh - 8) - 4),
    ]);
    // Subtle horizontal baseline
    elements.push(lineElement({ id: `${id}-spk-base-${num}`, from: [sx, sy + sh], to: [sx + sw, sy + sh], style: { stroke: solid ? lighten(r.primary, 0.25) : (p.line || '#E2E6EE'), strokeWidth: 1.5, strokeDash: 'dash' } }));
    for (let k = 0; k < coords.length - 1; k++) {
      elements.push(lineElement({ id: `${id}-spk-${num}-${k + 1}`, from: coords[k], to: coords[k + 1], style: { stroke: strokeCol, strokeWidth: 3 } }));
    }
    const last = coords[coords.length - 1];
    elements.push({ type: 'shape', id: `${id}-spk-dot-${num}`, bounds: [last[0] - 5, last[1] - 5, 10, 10], style: { fill: dotCol, radius: 5 }, shape: 'ellipse' });
  };

  // Optional semantic delta pill (e.g., "+28%" / "-15%") anchored cleanly at top-right of stacked cards or under label in split cards
  const renderDeltaBadge = (dx, dy, maxW) => {
    if (!it.delta) return 0;
    const raw = String(it.delta).trim();
    const isGood = /\+|↑|↗/.test(raw);
    const isDrop = /-|↓|↘/.test(raw);
    const fs = 15;
    const bw = Math.min(maxW, Math.ceil(textWidth(raw, fs) * 1.15) + 22);
    const bh = 26;
    const bg = solid ? (p.dark ? '#1E293B' : lighten(r.primary, 0.16)) : isGood ? (p.dark ? '#11302B' : '#ECFDF5') : isDrop ? (p.dark ? '#2B1F16' : lighten(r.pop, 0.9)) : r.band;
    const fg = solid ? (isGood ? '#6EE7B7' : p.inverse) : isGood ? (p.dark ? '#34D399' : '#047857') : isDrop ? r.pop : r.primary;
    elements.push({ type: 'shape', id: `${id}-delta-bg-${num}`, bounds: [dx, dy, bw, bh], style: { fill: bg, radius: 13 } });
    elements.push(textElement({ id: `${id}-delta-${num}`, text: raw, bounds: [dx + 6, dy + 4, bw - 12, 20], style: theme.font(fs, { fontWeight: 700, color: fg, textAlign: 'center', lineHeight: 1.2 }) }));
    return bw;
  };

  const lead = it.before != null ? `${it.before} → ` : '';
  const beforeOf = (s) => Math.max(18, Math.round(s * 0.56));
  const unitOf = (s) => Math.max(16, Math.round(s * 0.34));
  const figWidth = (s) => (lead ? textWidth(lead, beforeOf(s)) : 0) + textWidth(String(it.value), s) + (it.unit ? textWidth(' ' + it.unit, unitOf(s)) : 0);

  // Check if Horizontal Split (Left Meta | Right Giant Figure) fits cleanly without collisions
  const aspect = cw / Math.max(1, ch);
  const canSplit = !iconInfo && aspect >= 1.62 && cw >= 350 && ch >= 150 && !lead;
  let useSplit = false;
  let splitLeftW = 0, splitRightW = 0, splitValSz = 0, splitLabelSz = 0;
  if (canSplit) {
    splitLabelSz = forcedLabelSize || (solid ? Math.min(20, Math.max(17, Math.round(ch * 0.1))) : Math.min(19, Math.max(16, Math.round(ch * 0.09))));
    const natLabelW = Math.ceil(textWidth(it.label || '', splitLabelSz) * 1.08);
    const natNoteW = it.note ? Math.ceil(textWidth(it.note, solid ? 15 : 14) * 1.15) + 28 : 0;
    splitLeftW = Math.min(Math.round(iw * 0.46), Math.max(Math.round(iw * 0.34), Math.min(Math.max(natLabelW, natNoteW) + 8, Math.round(iw * 0.46))));
    splitRightW = iw - splitLeftW - 18;
    const hardCap = maxValCap || (solid ? 76 : 64);
    const maxByH = Math.min(hardCap, Math.round(innerH * (hasTrend ? 0.4 : (solid ? 0.52 : 0.44))));
    splitValSz = forcedValSize ? Math.min(forcedValSize, maxByH) : maxByH;
    while (splitValSz > 32 && figWidth(splitValSz) > splitRightW * 0.94) splitValSz -= 2;
    const labelLines = estimateLines(it.label || '', splitLabelSz, splitLeftW);
    if (splitValSz >= 34 && labelLines <= 2 && splitRightW >= 150) useSplit = true;
  }

  let finalValSize = splitValSz;
  if (useSplit) {
    const labelSz = splitLabelSz;
    const labelH = Math.max(Math.ceil(labelSz * 1.35), textHeight(it.label || '', labelSz, splitLeftW, 1.3));
    let noteSz = solid ? 15 : 14;
    if (it.note) while (noteSz > 12 && Math.ceil(textWidth(it.note, noteSz) * 1.16) + 26 > splitLeftW) noteSz -= 1;
    const pillW = it.note ? Math.min(splitLeftW, Math.ceil(textWidth(it.note, noteSz) * 1.16) + 26) : 0;
    const pillH = it.note ? Math.max(26, Math.round(noteSz * 1.65)) : 0;
    const deltaH = it.delta && !it.note ? 26 : 0;
    const leftGap = (it.note || deltaH) ? Math.min(22, Math.max(10, Math.round((innerH - labelH - (pillH || deltaH)) * 0.3))) : 0;
    const leftBlockH = labelH + ((it.note || deltaH) ? leftGap + (pillH || deltaH) : 0);
    const leftTop = cy + 10 + Math.round((innerH - leftBlockH) / 2);

    elements.push(textElement({ id: `${id}-label-${num}`, text: it.label || '', bounds: [cx + pad, leftTop, splitLeftW, labelH], style: theme.font(labelSz, { fontWeight: solid ? 700 : 600, color: labelColor, lineHeight: 1.3 }) }));

    if (it.note) {
      const noteY = leftTop + labelH + leftGap;
      const pillFill = solid ? (p.dark ? '#1E293B' : lighten(r.primary, 0.16)) : isPartner ? r.soft : r.band;
      const pillInk = solid ? p.inverse : isPartner ? (p.dark ? r.secondary : readableInk(r.secondaryInk || r.secondary, pillFill, 3.2)) : r.primary;
      elements.push({ type: 'shape', id: `${id}-notepill-${num}`, bounds: [cx + pad, noteY, pillW, pillH], style: { fill: pillFill, radius: Math.round(pillH / 2) } });
      elements.push(textElement({ id: `${id}-note-${num}`, text: it.note, bounds: [cx + pad + 8, noteY + Math.round((pillH - noteSz * 1.25) / 2), pillW - 16, Math.ceil(noteSz * 1.35)], style: theme.font(noteSz, { fontWeight: 600, lineHeight: 1.2, textAlign: 'center', color: pillInk }) }));
    } else if (it.delta) {
      renderDeltaBadge(cx + pad, leftTop + labelH + leftGap, splitLeftW);
    }

    const valSz = splitValSz, unitSz = unitOf(valSz), valH = Math.round(valSz * 1.22);
    const rx = cx + pad + splitLeftW + 18;
    const spkH = hasTrend ? Math.min(44, Math.max(28, Math.round(innerH * 0.28))) : 0;
    const rightGroupH = valH + (hasTrend ? 8 + spkH : 0);
    const valY = cy + 10 + Math.round((innerH - rightGroupH) / 2);
    if (it.delta && it.note) {
      const dbw = Math.min(splitRightW, Math.ceil(textWidth(String(it.delta), 15) * 1.15) + 22);
      renderDeltaBadge(rx + splitRightW - dbw, cy + 16, splitRightW);
    }
    const runs = [
      { text: String(it.value), style: { fontSize: valSz, fontWeight: 900, color: valColor } },
      ...(it.unit ? [{ text: ' ' + it.unit, style: { fontSize: unitSz, fontWeight: 400, color: solid ? labelColor : p.muted } }] : []),
    ];
    elements.push(textElement({ id: `${id}-value-${num}`, text: String(it.value) + (it.unit ? ' ' + it.unit : ''), runs, bounds: [rx, valY, splitRightW, valH], style: theme.font(valSz, { fontWeight: 900, lineHeight: 1.12, textAlign: 'right', color: valColor }) }));
    if (hasTrend) {
      const spkW = Math.min(splitRightW, 180);
      drawSparkline(rx + splitRightW - spkW, valY + valH + 6, spkW, spkH, it.trend, solid ? '#FFFFFF' : topAccent, solid ? r.pop : r.pop);
    }
  } else {
    // Stacked proportional mode (for square/tall/narrow cards or cards with icons)
    const textW = iconInfo ? iw - iconInfo.size - 16 : iw;
    const labelSz = forcedLabelSize || Math.max(16, Math.min(19, Math.round(ch * 0.085)));
    const labelH = Math.round(labelSz * 1.4);
    const spkH = hasTrend ? Math.min(44, Math.max(26, Math.round(innerH * 0.22))) : 0;
    const hardCap = maxValCap || (solid ? 72 : 60);
    const maxByH = Math.min(hardCap, Math.round((innerH - labelH - (it.note ? 44 : 12) - (hasTrend ? spkH + 8 : 0)) * 0.72));
    let valSz = forcedValSize ? Math.min(forcedValSize, maxValCap || forcedValSize) : maxByH;
    while (valSz > 26 && figWidth(valSz) > textW * 0.92) valSz -= 2;
    finalValSize = valSz;
    const unitSz = unitOf(valSz), valH = Math.round(valSz * 1.24);
    let noteSz = solid ? 15 : 14;
    if (it.note) while (noteSz > 12 && Math.ceil(textWidth(it.note, noteSz) * 1.16) + 24 > textW) noteSz -= 1;
    const pillH = it.note ? Math.max(26, Math.round(noteSz * 1.55)) : 0;
    const pillW = it.note ? Math.min(textW, Math.ceil(textWidth(it.note, noteSz) * 1.16) + 24) : 0;
    const blockH = labelH + 10 + valH + (hasTrend ? 8 + spkH : 0) + (it.note ? 10 + pillH : 0);
    const topY = cy + 10 + Math.max(8, Math.round((innerH - blockH) / 2));

    const deltaReserve = it.delta ? Math.min(Math.round(textW * 0.45), Math.ceil(textWidth(String(it.delta), 15) * 1.15) + 26) : 0;
    elements.push(textElement({ id: `${id}-label-${num}`, text: it.label || '', bounds: [cx + pad, topY, Math.max(80, textW - deltaReserve), labelH], style: theme.font(labelSz, { fontWeight: 600, color: labelColor }) }));
    if (it.delta) {
      const dbw = Math.min(Math.round(textW * 0.45), Math.ceil(textWidth(String(it.delta), 15) * 1.15) + 22);
      renderDeltaBadge(cx + pad + textW - dbw, topY + 1, dbw);
    }
    const runs = [
      ...(lead ? [{ text: lead, style: { fontSize: beforeOf(valSz), fontWeight: 400, color: labelColor } }] : []),
      { text: String(it.value), style: { fontSize: valSz, fontWeight: 900, color: valColor } },
      ...(it.unit ? [{ text: ' ' + it.unit, style: { fontSize: unitSz, fontWeight: 400, color: solid ? labelColor : p.muted } }] : []),
    ];
    elements.push(textElement({ id: `${id}-value-${num}`, text: lead + String(it.value) + (it.unit ? ' ' + it.unit : ''), runs, bounds: [cx + pad, topY + labelH + 10, textW, valH], style: theme.font(valSz, { fontWeight: 900, lineHeight: 1.15, color: valColor }) }));

    let curY = topY + labelH + 10 + valH;
    if (hasTrend) {
      drawSparkline(cx + pad, curY + 6, textW, spkH, it.trend, solid ? '#FFFFFF' : topAccent, r.pop);
      curY += 6 + spkH;
    }

    if (it.note) {
      const noteY = Math.min(cy + ch - pillH - barReserve + 2, curY + 10);
      const pillFill = solid ? (p.dark ? '#1E293B' : lighten(r.primary, 0.16)) : isPartner ? r.soft : r.band;
      const pillInk = solid ? p.inverse : isPartner ? (p.dark ? r.secondary : readableInk(r.secondaryInk || r.secondary, pillFill, 3.2)) : r.primary;
      elements.push({ type: 'shape', id: `${id}-notepill-${num}`, bounds: [cx + pad, noteY, pillW, pillH], style: { fill: pillFill, radius: Math.round(pillH / 2) } });
      elements.push(textElement({ id: `${id}-note-${num}`, text: it.note, bounds: [cx + pad + 8, noteY + Math.round((pillH - noteSz * 1.25) / 2), pillW - 16, Math.ceil(noteSz * 1.35)], style: theme.font(noteSz, { fontWeight: 600, lineHeight: 1.2, textAlign: 'center', color: pillInk }) }));
    }
    if (iconInfo) {
      elements.push(...iconElements({ id: `${id}-tile-${num}`, name: iconInfo.name, bounds: [cx + cw - iconInfo.size - 20, cy + Math.round((ch - iconInfo.size) / 2), iconInfo.size], color: solid ? p.inverse : (isPartner ? r.secondary : p.muted), disc: solid ? 'rgba(255, 255, 255, 0.16)' : rgba(p.ink, 0.06) }));
    }
  }

  // Subtle mini target progress bar along the bottom edge when a numeric target is present
  if (ratio != null) {
    const barY = cy + ch - 14, barW = iw;
    const fillPct = Math.max(0.14, Math.min(0.96, ratio > 1 ? 0.92 : ratio * 0.82));
    const pinPct = ratio > 1 ? Math.max(0.55, Math.min(0.84, 0.92 / ratio)) : 0.82;
    elements.push({ type: 'shape', id: `${id}-prog-bg-${num}`, bounds: [cx + pad, barY, barW, 5], style: { fill: solid ? lighten(r.primary, 0.22) : (p.line || '#E2E6EE'), radius: 3 } });
    elements.push({ type: 'shape', id: `${id}-prog-fg-${num}`, bounds: [cx + pad, barY, Math.round(barW * fillPct), 5], style: { fill: solid ? r.pop : topAccent, radius: 3 } });
    elements.push({ type: 'shape', id: `${id}-prog-pin-${num}`, bounds: [cx + pad + Math.round(barW * pinPct), barY - 3, 3, 11], style: { fill: solid ? p.inverse : p.ink, radius: 1 } });
  }

  return { elements, valueSize: finalValSize };
}

// Adaptive Asymmetric Bento Metric Grid for 3-5 metrics placed in a tall rectangular region (e.g., beside a tall action panel).
// Highlights the #1 key figure in a larger solid-primary hero cell and pairs secondary figures cleanly underneath so there is zero awkward vertical dead space.
export function metricBento({ id, x, y, width, height, items, theme, highlight = 0 }) {
  const p = theme.palette, r = colorRoles(p), n = items.length, gap = 16;
  const k = highlight >= 0 && highlight < n ? highlight : 0;
  const ordered = [items[k], ...items.filter((_, i) => i !== k)];
  const origIdx = [k, ...items.map((_, i) => i).filter((i) => i !== k)];
  const topH = Math.round((height - gap) * 0.52), botH = height - gap - topH;

  const cells = [];
  if (n === 3) {
    const bw = Math.floor((width - gap) / 2);
    cells.push({ rect: [x, y, width, topH], solid: true, partner: false });
    cells.push({ rect: [x, y + topH + gap, bw, botH], solid: false, partner: true });
    cells.push({ rect: [x + bw + gap, y + topH + gap, width - bw - gap, botH], solid: false, partner: false });
  } else if (n === 4) {
    const topLeftW = Math.round((width - gap) * 0.57), topRightW = width - gap - topLeftW;
    const botW = Math.floor((width - gap) / 2);
    cells.push({ rect: [x, y, topLeftW, topH], solid: true, partner: false });
    cells.push({ rect: [x + topLeftW + gap, y, topRightW, topH], solid: false, partner: true });
    cells.push({ rect: [x, y + topH + gap, botW, botH], solid: false, partner: false });
    cells.push({ rect: [x + botW + gap, y + topH + gap, width - botW - gap, botH], solid: false, partner: false });
  } else {
    const topLeftW = Math.round((width - gap) * 0.57), topRightW = width - gap - topLeftW;
    const botCount = Math.max(1, n - 2), botW = Math.floor((width - gap * (botCount - 1)) / botCount);
    cells.push({ rect: [x, y, topLeftW, topH], solid: true, partner: false });
    cells.push({ rect: [x + topLeftW + gap, y, topRightW, topH], solid: false, partner: true });
    for (let j = 0; j < botCount; j++) {
      const bx = x + j * (botW + gap);
      const bw = j === botCount - 1 ? (x + width - bx) : botW;
      cells.push({ rect: [bx, y + topH + gap, bw, botH], solid: false, partner: false });
    }
  }

  const elements = [];
  let maxValSize = 48;
  cells.forEach((cell, idx) => {
    const it = ordered[idx];
    if (!it) return;
    const [cx, cy, cw, ch] = cell.rect;
    const built = renderMetricCard({ id, num: origIdx[idx] + 1, cx, cy, cw, ch, it, solid: cell.solid, isPartner: cell.partner, theme, p, r, maxValCap: cell.solid ? 68 : 38 });
    elements.push(...built.elements);
    if (built.valueSize > maxValSize) maxValSize = built.valueSize;
  });
  return { elements, height, valueSize: maxValSize };
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

// Frame-first photo group: the box is decided by the page (mirror the neighbouring column's top and bottom), the
// frames tile it completely, and each photo is cropped into its frame around its focal point. Unlike imageFill it
// never shrinks photos to leave gaps; pick focal points so faces and key text stay in frame.
export const imageFrames = (args) => imageFill({ ...args, always: true });

// One photo policy for every photo group: photos stay close to their own shape and each frame follows its photo's
// orientation (a portrait stands tall, a landscape lies wide); they are never stretched.
//  - height given (the group must end level with neighbouring content): fill the box with at most a mild crop; if no
//    arrangement manages that, use the least-cropping frames (imageFrames), which may crop more but never leave gaps.
//  - maxHeight only (the group may take the height its photos need): take the native layout that shows the photos
//    largest, then square its edges with a mild crop so rows end level.
export function photoGroup({ id, x, y, width, height, maxHeight = 600, images, theme, gap = 24, mildCrop = 1.2 }) {
  const sized = images.map((img) => ({ ...img, size: img.size || imageSize(img.file || img.src) }));
  if (height) {
    const mild = imageFill({ id, x, y, width, height, images: sized, theme, gap, maxCrop: mildCrop });
    const g = mild || imageFrames({ id, x, y, width, height, images: sized, theme, gap });
    return { ...g, width, height };
  }
  // The most upright photo leads, so a mosaic stands it tall on the left.
  const ordered = [...sized].sort((a, b) => a.size.width / a.size.height - b.size.width / b.size.height);
  const native = imageGrid({ id, x, y, width, images: ordered, perRow: 'auto', maxHeight, theme, gap });
  const squared = imageFill({ id, x, y, width, height: native.height, images: ordered, theme, gap, maxCrop: mildCrop });
  return squared ? { ...squared, width, height: native.height } : { ...native, crop: 1 };
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
  columns.forEach((c) => { elements.push(textElement({ id: `${id}-head-${c.key}`, text: c.label, bounds: [cx, y, c.width - 24, Math.round(headSize * 1.5)], style: theme.font(headSize, { fontWeight: 600, color: p.muted, letterSpacing: 0.4 }) })); cx += c.width; });
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

// Decision side panel (需要审批的支持 / 下一步): a heading, one key figure with its label, then numbered items, on a
// solid primary panel. The blocks spread over the whole panel height, so it never ends in an empty dark strip;
// numbers sit in round badges and wrapped lines hang under the item text instead of being lined up with spaces.
// figure: { label, value, unit, note? }; list: { title?, items: [{ title, detail? }] }. Throws when it cannot fit.
export function sidePanel({ id, bounds: [x, y, w, h], theme, figure, list, fill }) {
  const p = theme.palette, r = colorRoles(p), pad = 44, iw = w - pad * 2, badge = 48, textX = x + pad + badge + 20, textW = iw - badge - 20;
  const soft = 'rgba(255, 255, 255, 0.78)', blocks = [];
  if (figure) {
    const size = Math.min(104, Math.floor(iw / Math.max(3, textWidth(String(figure.value), 1) + (figure.unit ? textWidth(' ' + figure.unit, 0.42) : 0)) * 0.9));
    blocks.push({ h: 40, draw: (cy) => [textElement({ id: `${id}-figure-label`, text: figure.label, bounds: [x + pad, cy, iw, 40], style: theme.font(28, { fontWeight: 700, color: soft }) })] });
    blocks.push({ h: Math.round(size * 1.35), tight: true, draw: (cy) => [textElement({ id: `${id}-figure-value`, text: `${figure.value}${figure.unit ? ' ' + figure.unit : ''}`, runs: [{ text: String(figure.value), style: { fontSize: size, fontWeight: 800, color: p.inverse } }, ...(figure.unit ? [{ text: ' ' + figure.unit, style: { fontSize: Math.round(size * 0.42), fontWeight: 700, color: p.inverse } }] : [])], bounds: [x + pad, cy, iw, Math.round(size * 1.35)], style: theme.font(size, { fontWeight: 800, color: p.inverse, lineHeight: 1.15 }) })] });
    if (figure.note) { const nh = textHeight(figure.note, 28, iw, 1.4); blocks.push({ h: nh, tight: true, draw: (cy) => [textElement({ id: `${id}-figure-note`, text: figure.note, bounds: [x + pad, cy, iw, nh], style: theme.font(28, { color: p.inverse }) })] }); }
  }
  if (figure && list) blocks.push({ h: 2, draw: (cy) => [lineElement({ id: `${id}-rule`, from: [x + pad, cy], to: [x + w - pad, cy], style: { stroke: 'rgba(255, 255, 255, 0.28)', strokeWidth: 2 } })] });
  if (list?.title) blocks.push({ h: 44, draw: (cy) => [textElement({ id: `${id}-list-title`, text: list.title, bounds: [x + pad, cy, iw, 44], style: theme.font(30, { fontWeight: 700, color: p.inverse }) })] });
  (list?.items || []).forEach((it, i) => {
    const th = textHeight(it.title, 28, textW, 1.35), dh = it.detail ? textHeight(it.detail, 24, textW, 1.45) : 0, ih = Math.max(badge, th + (dh ? 6 + dh : 0));
    blocks.push({ h: ih, item: true, draw: (cy) => [
      { type: 'shape', id: `${id}-badge-${i + 1}`, bounds: [x + pad, cy, badge, badge], style: { fill: 'rgba(255, 255, 255, 0.16)', radius: badge / 2 } },
      textElement({ id: `${id}-num-${i + 1}`, text: String(i + 1).padStart(2, '0'), bounds: [x + pad, cy + Math.round((badge - 36) / 2), badge, 36], style: theme.font(26, { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.35 }) }),
      textElement({ id: `${id}-item-${i + 1}`, text: it.title, bounds: [textX, cy + Math.max(0, Math.round((badge - 38) / 2)), textW, th], style: theme.font(28, { fontWeight: 700, color: p.inverse, lineHeight: 1.35 }) }),
      ...(it.detail ? [textElement({ id: `${id}-item-${i + 1}-detail`, text: it.detail, bounds: [textX, cy + Math.max(0, Math.round((badge - 38) / 2)) + th + 6, textW, dh], style: theme.font(24, { color: soft, lineHeight: 1.45 }) })] : [])
    ] });
  });
  // Spare height goes into the gaps between blocks (a tight block hugs the one above it), so content reaches the bottom.
  const used = blocks.reduce((a, b) => a + b.h, 0), gaps = blocks.slice(1).map((b) => (b.tight ? 0.25 : 1)), weight = gaps.reduce((a, b) => a + b, 0);
  const spare = h - pad * 2 - used, unit = weight ? Math.min(96, spare / weight) : 0;
  if (unit < 16) throw new Error(`sidePanel content does not fit by ${Math.round(16 * weight - spare)}px: shorten items or widen the panel`);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'sidePanel', bounds: [x, y, w, h], style: { fill: fill || r.primary, radius: theme.radius ?? 0 } }];
  let cy = y + pad + Math.max(0, Math.round((spare - unit * weight) / 2));
  blocks.forEach((b, i) => { if (i) cy += Math.round(unit * gaps[i - 1]); elements.push(...b.draw(Math.round(cy))); cy += b.h; });
  return { elements, height: h };
}

// Conclusion bar: the page's takeaway sentence on a tinted band with an accent mark and a short label (复盘判断,
// 结论, 下一步). A lone sentence floating in empty space reads as leftover; give it this bar, attach it to the data it
// concludes, or move it into the header subtitle. Height follows the text.
export function noteBar({ id, x, y, width, text, label = '复盘判断', theme, size = 30, fill, height }) {
  // height: stretch the bar to end level with a neighbouring block. A bar too narrow to keep the sentence on one line
  // beside its label puts the label above the sentence instead, so the sentence does not break into a stray word.
  const p = theme.palette, r = colorRoles(p), lw = label ? Math.round(textWidth(label, 24) + 40) : 0;
  const stacked = !!label && textWidth(text, size) > (width - 56 - lw) * 0.95, tw = stacked ? width - 56 : width - 56 - lw;
  const th = textHeight(text, size, tw, 1.4), need = (stacked ? 34 + 10 : 0) + th + 44, h = Math.max(88, need, height || 0), elements = [];
  elements.push({ type: 'shape', id: `${id}-bar`, component: 'noteBar', bounds: [x, y, width, h], style: { fill: fill || r.band, radius: theme.radius ?? 0 } });
  elements.push({ type: 'shape', id: `${id}-mark`, bounds: [x, y + 16, 8, h - 32], style: { fill: p.accent, radius: 4 } });
  const top = y + Math.round((h - (need - 44)) / 2);
  if (label) elements.push(textElement({ id: `${id}-label`, text: label, bounds: stacked ? [x + 32, top, width - 56, 34] : [x + 32, y + Math.round((h - 34) / 2), lw - 16, 34], style: theme.font(24, { fontWeight: 700, color: p.accent }) }));
  elements.push(textElement({ id: `${id}-text`, text, bounds: stacked ? [x + 32, top + 44, tw, th] : [x + 32 + lw, y + Math.round((h - th) / 2), tw, th], style: theme.font(size, { fontWeight: 700, lineHeight: 1.4 }) }));
  return { elements, height: h };
}

// Type scale for report pages: pass as createTheme({ roles: REPORT_ROLES }).
// Restrained 4-tier hierarchy: Page Title (40–44px) > Section/Item Title (20–25px) > Body (18–21px Regular) > Caption (15–16px).
export const REPORT_ROLES = {
  eyebrow: { fontSize: 15, fontWeight: 700 }, pageTitle: { fontSize: 40 }, pageTitleFocus: { fontSize: 40 },
  sectionTitle: { fontSize: 22 }, itemTitle: { fontSize: 20 }, stepTitle: { fontSize: 20 }, roleSubtitle: { fontSize: 18 },
  body: { fontSize: 18, fontWeight: 400 }, stepDetail: { fontSize: 18, fontWeight: 400 }, tableHeader: { fontSize: 16, fontWeight: 600 }, tableKey: { fontSize: 19 },
  tableBody: { fontSize: 18, fontWeight: 400 }, tableEmphasis: { fontSize: 19 }, caption: { fontSize: 15, fontWeight: 400 }, lightNote: { fontSize: 15, fontWeight: 400 }
};

export const REPORT_ROLES_COMPACT = {
  eyebrow: { fontSize: 14, fontWeight: 700 }, pageTitle: { fontSize: 36 }, pageTitleFocus: { fontSize: 36 },
  sectionTitle: { fontSize: 20 }, itemTitle: { fontSize: 18 }, stepTitle: { fontSize: 18 }, roleSubtitle: { fontSize: 17 },
  body: { fontSize: 17, fontWeight: 400 }, stepDetail: { fontSize: 17, fontWeight: 400 }, tableHeader: { fontSize: 15, fontWeight: 600 }, tableKey: { fontSize: 17 },
  tableBody: { fontSize: 17, fontWeight: 400 }, tableEmphasis: { fontSize: 17 }, caption: { fontSize: 14, fontWeight: 400 }, lightNote: { fontSize: 14, fontWeight: 400 }
};

// Preserve vivid saturated primary/accent hues while ensuring crisp legibility on both light and dark surfaces.
const luminance = (hex) => { const h = String(hex || '#FFFFFF').replace('#', ''); const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const readableInk = (hex, bg = '#F3F5FA', minRatio = 3.1) => {
  let c = hex, k = 0;
  const bgL = luminance(bg);
  if (bgL < 0.18) {
    const ratio = (a) => (luminance(a) + 0.05) / (bgL + 0.05);
    while (ratio(c) < Math.max(minRatio, 4.5) && k < 12) { k += 1; c = lighten(hex, k * 0.08); }
    return c;
  }
  const ratio = (a) => (bgL + 0.05) / (luminance(a) + 0.05);
  while (ratio(c) < minRatio && k < 10) { k += 1; c = darken(hex, k * 0.06); }
  return c;
};

// Restrained roomier scales: body moves gently within 18-21px so flipping slides never jumps into giant Word-like text.
export const REPORT_ROLES_HERO = {
  eyebrow: { fontSize: 16, fontWeight: 700 }, pageTitle: { fontSize: 44 }, pageTitleFocus: { fontSize: 44 },
  sectionTitle: { fontSize: 25 }, itemTitle: { fontSize: 23 }, stepTitle: { fontSize: 22 }, roleSubtitle: { fontSize: 20 },
  body: { fontSize: 21, fontWeight: 400 }, stepDetail: { fontSize: 21, fontWeight: 400 }, tableHeader: { fontSize: 17, fontWeight: 600 }, tableKey: { fontSize: 21 },
  tableBody: { fontSize: 21, fontWeight: 400 }, tableEmphasis: { fontSize: 21 }, caption: { fontSize: 16, fontWeight: 400 }, lightNote: { fontSize: 16, fontWeight: 400 }
};

export const REPORT_ROLES_COMFY = {
  eyebrow: { fontSize: 15, fontWeight: 700 }, pageTitle: { fontSize: 40 }, pageTitleFocus: { fontSize: 40 },
  sectionTitle: { fontSize: 23 }, itemTitle: { fontSize: 21 }, stepTitle: { fontSize: 20 }, roleSubtitle: { fontSize: 19 },
  body: { fontSize: 19, fontWeight: 400 }, stepDetail: { fontSize: 19, fontWeight: 400 }, tableHeader: { fontSize: 16, fontWeight: 600 }, tableKey: { fontSize: 20 },
  tableBody: { fontSize: 19, fontWeight: 400 }, tableEmphasis: { fontSize: 20 }, caption: { fontSize: 15, fontWeight: 400 }, lightNote: { fontSize: 15, fontWeight: 400 }
};

export const REPORT_ROLES_LARGE = {
  eyebrow: { fontSize: 16, fontWeight: 700 }, pageTitle: { fontSize: 42 }, pageTitleFocus: { fontSize: 42 },
  sectionTitle: { fontSize: 24 }, itemTitle: { fontSize: 22 }, stepTitle: { fontSize: 21 }, roleSubtitle: { fontSize: 20 },
  body: { fontSize: 20, fontWeight: 400 }, stepDetail: { fontSize: 20, fontWeight: 400 }, tableHeader: { fontSize: 17, fontWeight: 600 }, tableKey: { fontSize: 20 },
  tableBody: { fontSize: 20, fontWeight: 400 }, tableEmphasis: { fontSize: 20 }, caption: { fontSize: 16, fontWeight: 400 }, lightNote: { fontSize: 16, fontWeight: 400 }
};

export const REPORT_ROLES_ROOMY = {
  eyebrow: { fontSize: 16, fontWeight: 700 }, pageTitle: { fontSize: 42 }, pageTitleFocus: { fontSize: 42 },
  sectionTitle: { fontSize: 24 }, itemTitle: { fontSize: 22 }, stepTitle: { fontSize: 21 }, roleSubtitle: { fontSize: 20 },
  body: { fontSize: 20, fontWeight: 400 }, stepDetail: { fontSize: 20, fontWeight: 400 }, tableHeader: { fontSize: 17, fontWeight: 600 }, tableKey: { fontSize: 20 },
  tableBody: { fontSize: 20, fontWeight: 400 }, tableEmphasis: { fontSize: 20 }, caption: { fontSize: 16, fontWeight: 400 }, lightNote: { fontSize: 16, fontWeight: 400 }
};

// A labelled statement: tinted band, colour bar, short label, then one sentence. It lets a reader get the page's logic
// from the labels alone. tone 'judgment' (warm) is for the review verdict only, so it stays the one warm band on a page.
export function labelBand({ id, x, y, width, label, text, theme, tone = 'primary', height, measurements, scale = 1 }) {
  const p = theme.palette, r = colorRoles(p), judgment = tone === 'judgment', warm = p.pop || p.gold;
  const isCompact = Boolean(theme?.compact);
  const bandFill = p.dark ? (p.surface || '#152238') : (judgment ? lighten(warm, 0.91) : r.band);
  const accentBar = judgment ? warm : r.primary;
  const borderCol = p.dark ? (judgment ? warm : p.line) : (judgment ? lighten(warm, 0.68) : (p.line || '#E2E6EE'));
  const badgeSz = 15;
  const labelStyle = theme.font(badgeSz, { fontWeight: 700, color: judgment ? '#FFFFFF' : p.inverse, textAlign: 'center', lineHeight: 1.2 });
  const bodySize = Math.min(20, Math.max(isCompact ? 17 : 18, Math.round(theme.roles.body.fontSize * Math.min(scale, 1.05))));
  const textStyle = theme.roleStyle('body', { fontWeight: judgment ? 500 : 400, color: judgment ? p.ink : (p.body || '#334155'), fontSize: bodySize, lineHeight: 1.42 });
  const badgeW = label ? Math.max(82, Math.min(200, Math.ceil(textWidth(label, badgeSz) * 1.15) + 28)) : 0;
  const badgeH = isCompact ? 26 : 28;
  const vPad = isCompact ? 16 : 24;
  const inlineRoom = label ? width - 24 - badgeW - 16 - 24 : width - 48;
  // Compact single-row inline layout when the band is wide and text fits in <= 2 lines beside the pill badge (sleek modern Callout).
  const canInline = Boolean(label) && width >= 880 && textHeight(text, bodySize, inlineRoom, 1.4) <= Math.ceil(bodySize * 1.4 * 2.1);
  const rad = Math.max(14, theme.radius ?? 14);
  if (canInline) {
    const th = Math.ceil(measurements?.get(`${id}-text`)?.height ?? textHeight(text, bodySize, inlineRoom, 1.4));
    const need = Math.max(badgeH, th);
    const h = Math.max(need + vPad, height || 0);
    return {
      height: h,
      elements: [
        { type: 'shape', id: `${id}-bar`, component: 'labelBand', bounds: [x, y, width, h], style: { fill: bandFill, stroke: borderCol, strokeWidth: 1.5, radius: rad } },
        { type: 'shape', id: `${id}-mark`, bounds: [x, y + 10, 6, Math.max(20, h - 20)], style: { fill: accentBar, radius: 3 } },
        { type: 'shape', id: `${id}-badge`, bounds: [x + 24, y + Math.round((h - badgeH) / 2), badgeW, badgeH], style: { fill: accentBar, radius: Math.round(badgeH / 2) } },
        textElement({ id: `${id}-label`, text: label, bounds: [x + 24, y + Math.round((h - badgeSz * 1.25) / 2), badgeW, Math.ceil(badgeSz * 1.3)], style: labelStyle }),
        textElement({ id: `${id}-text`, text, bounds: [x + 24 + badgeW + 16, y + Math.round((h - th) / 2), inlineRoom, th], style: textStyle }),
      ],
    };
  }
  const tw = width - 52, th = Math.ceil(measurements?.get(`${id}-text`)?.height ?? textHeight(text, textStyle.fontSize, tw, textStyle.lineHeight));
  const need = (label ? badgeH + 10 : 0) + th, h = Math.max(need + vPad, height || 0), top = y + Math.round((h - need) / 2);
  return { height: h, elements: [
    { type: 'shape', id: `${id}-bar`, component: 'labelBand', bounds: [x, y, width, h], style: { fill: bandFill, stroke: borderCol, strokeWidth: 1.5, radius: rad } },
    { type: 'shape', id: `${id}-mark`, bounds: [x, y + 10, 6, Math.max(20, h - 20)], style: { fill: accentBar, radius: 3 } },
    ...(label ? [
      { type: 'shape', id: `${id}-badge`, bounds: [x + 24, top, badgeW, badgeH], style: { fill: accentBar, radius: Math.round(badgeH / 2) } },
      textElement({ id: `${id}-label`, text: label, bounds: [x + 24, top + Math.round((badgeH - badgeSz * 1.2) / 2), badgeW, Math.ceil(badgeSz * 1.3)], style: labelStyle }),
    ] : []),
    textElement({ id: `${id}-text`, text, bounds: [x + 24, top + (label ? badgeH + 10 : 0), tw, th], style: textStyle })
  ] };
}

// Numbered actions in one panel: an optional heading that sums up the sequence, then number, short handle and the full
// sentence on each row. items: [{ title, detail }]. stacked puts the sentence under its handle; height spreads the rows.
// Element ids: `${id}-panel`, `${id}-title-n`, `${id}-detail-n`.
export function actionPanel({ id, x, y, width, heading, items, theme, height, stacked = false, measurements, scale = 1 }) {
  const p = theme.palette, isCompact = Boolean(theme?.compact), pad = isCompact ? 18 : 24, elements = [], cardBg = p.surface || '#FFFFFF';
  const accentInk = readableInk(p.accent, cardBg);
  const grown = (role) => Math.min(24, Math.round(theme.roles[role].fontSize * Math.min(scale, 1.06) / 2) * 2);
  const titleFontSize = Math.min(22, grown('stepTitle'));
  const detailFontSize = Math.min(20, Math.max(isCompact ? 17 : 18, theme.roles.stepDetail.fontSize));
  const titleStyle = theme.roleStyle('stepTitle', { color: accentInk, fontWeight: 700, fontSize: titleFontSize });
  const detailStyle = theme.roleStyle('stepDetail', { color: p.body || '#334155', fontWeight: 400, fontSize: detailFontSize, lineHeight: 1.45 });
  const badge = 26, numSize = 14;
  const titleX = x + pad + badge + 12, titleH = Math.ceil(titleStyle.fontSize * titleStyle.lineHeight), badgeDy = Math.round((titleH - badge) / 2);
  const titleW = stacked ? width - pad * 2 - badge - 12 : Math.max(...items.map((it) => textWidth(it.title, titleStyle.fontSize))) + 16;
  const detailX = stacked ? titleX : titleX + titleW + 12, detailW = x + width - pad - detailX;
  const detailH = (it, i) => (it.detail ? Math.ceil(measurements?.get(`${id}-detail-${i + 1}`)?.height ?? textHeight(it.detail, detailStyle.fontSize, detailW, detailStyle.lineHeight)) : 0);
  const rows = items.map((it, i) => (stacked && it.detail ? titleH + 4 + detailH(it, i) : Math.max(titleH, detailH(it, i))));
  const headingStyle = theme.roleStyle('sectionTitle', { color: accentInk, lineHeight: 1.3 }), headingBox = heading ? Math.ceil(measurements?.get(`${id}-heading`)?.height ?? textHeight(heading, headingStyle.fontSize, width - pad * 2, headingStyle.lineHeight)) : 0;
  const headH = heading ? headingBox + 10 : 0, rowGap = isCompact ? 12 : 18, need = (pad - 6) * 2 + headH + rows.reduce((a, b) => a + b, 0) + (items.length - 1) * rowGap, h = Math.max(need, height || 0);
  const spare = Math.floor((h - need) / (items.length + 1));
  elements.push({ type: 'shape', id: `${id}-panel`, component: 'actionPanel', bounds: [x, y, width, h], style: { fill: cardBg, stroke: p.line, strokeWidth: 1.5, radius: theme.radius ?? 0 } });
  let cy = y + pad - 6;
  if (heading) { elements.push(textElement({ id: `${id}-heading`, text: heading, bounds: [x + pad, cy, width - pad * 2, headingBox], style: headingStyle })); cy += headH; }
  cy += spare;
  const roles = colorRoles(p);
  const secBadgeFill = p.dark ? roles.secondary : roles.secondary;
  const secBadgeInk = p.dark ? roles.onSecondary : readableInk(roles.onSecondary || roles.secondaryInk, roles.secondary, 3.2);
  const secTitleInk = p.dark ? roles.secondary : readableInk(roles.secondaryInk || roles.secondary, cardBg, 3.2);
  items.forEach((it, i) => {
    const n = i + 1;
    const isAlt = i % 2 === 1;
    elements.push({ type: 'shape', id: `${id}-badge-${n}`, bounds: [x + pad, cy + badgeDy, badge, badge], style: { fill: isAlt ? secBadgeFill : accentInk, radius: badge / 2 } });
    elements.push(textElement({ id: `${id}-num-${n}`, text: String(n), bounds: [x + pad, cy + badgeDy, badge, badge], style: theme.roleStyle('caption', { fontSize: numSize, color: isAlt ? secBadgeInk : p.inverse, fontWeight: 700, textAlign: 'center', lineHeight: badge / numSize }) }));
    elements.push(textElement({ id: `${id}-title-${n}`, text: it.title, bounds: [titleX, cy, titleW, titleH], style: { ...titleStyle, color: isAlt ? secTitleInk : accentInk } }));
    if (it.detail) elements.push(textElement({ id: `${id}-detail-${n}`, text: it.detail, bounds: [detailX, stacked ? cy + titleH + 4 : cy + 1, detailW, rows[i] - (stacked ? titleH + 4 : 0)], style: detailStyle }));
    if (n < items.length) elements.push({ type: 'shape', id: `${id}-rule-${n}`, bounds: [x + pad, cy + rows[i] + Math.round((rowGap + spare) / 2), width - pad * 2, 1], style: { fill: p.line } });
    cy += rows[i] + rowGap + spare;
  });
  return { elements, height: h };
}

// Bullet points with a hanging indent: each point is its own text box after a small dot, so wrapped lines start
// under the text, not under the dot. Step down 1-2px if a narrow card leaves a 1-2 char orphan tail on line 2+.
export const indentOf = (size) => Math.round(size * 0.9), pointGap = (size) => Math.round(size * 0.3);
function hasOrphanPointTail(points, sz, width) {
  const limit = (width - indentOf(sz)) * 0.95;
  for (const s of points) {
    let lines = 1, used = 0, lastCount = 0;
    for (const ch of String(s ?? '')) {
      const cw = /[‐-⁯⺀-￯]/.test(ch) ? sz : /\s/.test(ch) ? sz * 0.3 : sz * 0.56;
      if (used + cw > limit && used > 0) { lines++; used = cw; lastCount = /\s/.test(ch) ? 0 : 1; }
      else { used += cw; if (!/\s/.test(ch)) lastCount++; }
    }
    if (lines > 1 && lastCount > 0 && lastCount <= 2) return true;
  }
  return false;
}
export function fitPointFontSize(points = [], size = 18, width = 300) {
  const floor = Math.max(15, size - 2);
  for (let sz = size; sz >= floor; sz -= 1) {
    if (!hasOrphanPointTail(points, sz, width)) return sz;
  }
  return size;
}
export const pointsHeight = (points = [], size, width, lh) => {
  const sz = fitPointFontSize(points, size, width);
  return points.reduce((h, s, i) => h + textHeight(s, sz, width - indentOf(sz), lh) + (i ? pointGap(sz) : 0), 0);
};
export function pointList({ id, x, y, width, points = [], size, color, theme, lh }) {
  const sz = fitPointFontSize(points, size, width);
  const elements = [], d = Math.max(5, Math.round(sz * 0.25));
  points.forEach((s, i) => {
    const h = textHeight(s, sz, width - indentOf(sz), lh);
    elements.push({ type: 'shape', id: `${id}-dot-${i + 1}`, bounds: [x, y + Math.round((sz * lh - d) / 2), d, d], style: { fill: color, radius: d / 2 } });
    elements.push(textElement({ id: `${id}-${i + 1}`, text: s, bounds: [x + indentOf(sz), y, width - indentOf(sz), h], style: theme.font(sz, { fontWeight: 400, color, lineHeight: lh }) }));
    y += h + pointGap(sz);
  });
  return elements;
}

// =========================================================================
// Modern Web UI Data-Viz & Architecture Components (100% Native PPTX Shapes & Lines)
// =========================================================================

// Tremor CategoryBar Card with 3 visual styles:
//   - 'bar'   (default): segmented horizontal CategoryBar + bottom sub-cards
//   - 'bars'  (ranked horizontal progress bars): clean stacked proportion bars + right percentage pills
//   - 'tiles' (hero + breakdown grid): left solid primary Total Hero card + right breakdown cards
export function categoryBreakdownCard({ id, x, y, width, height, title = '', total = '', badge = '', items = [], theme, variant = 'bar' }) {
  const p = theme.palette, r = colorRoles(p), list = items.slice(0, 6);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const pad = isCompact ? 20 : 28, iw = width - pad * 2, surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const segColors = [r.primary, r.secondary, r.pop, p.dark ? '#38BDF8' : lighten(r.primary, 0.38), p.muted || '#64748B', '#94A3B8'];
  const totalPct = list.reduce((s, it) => s + (Number(it.pct) || 0), 0) || 100;

  if (variant === 'bars') {
    const headH = title || total ? (isCompact ? 44 : 50) : 0, rowH = isCompact ? 42 : 50, rowGap = isCompact ? 8 : 12;
    const natural = pad * 2 + headH + list.length * rowH + (list.length - 1) * rowGap;
    const h = Math.max(natural, height || 0);
    const topOff = Math.round((h - natural) / 2);
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'categoryBreakdown', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad + topOff;
    if (headH) {
      elements.push(textElement({ id: `${id}-title`, text: title || '结构构成', bounds: [x + pad, curY + 4, iw - 360, 30], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      if (total) elements.push(textElement({ id: `${id}-total`, text: `合计 ${total}`, bounds: [x + width - pad - 340, curY + 2, 340, 34], style: theme.font(26, { fontWeight: 900, color: p.ink, textAlign: 'right', lineHeight: 1.2 }) }));
      curY += headH;
    }
    const labelW = Math.min(340, Math.round(iw * 0.24)), valW = 240, trackW = iw - labelW - valW - 36;
    list.forEach((it, i) => {
      const ry = curY + i * (rowH + rowGap);
      const col = segColors[i % segColors.length];
      const pct = Number(it.pct) || Math.round(100 / list.length);
      elements.push({ type: 'shape', id: `${id}-row-${i + 1}`, bounds: [x + pad, ry, iw, rowH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 12 } });
      elements.push({ type: 'shape', id: `${id}-dot-${i + 1}`, bounds: [x + pad + 18, ry + 19, 12, 12], style: { fill: col, radius: 4 } });
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [x + pad + 40, ry + 12, labelW - 44, 26], style: theme.font(19, { fontWeight: 600, color: p.ink, lineHeight: 1.25 }) }));
      const tx = x + pad + labelW + 14;
      elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [tx, ry + 17, trackW, 16], style: { fill: p.dark ? '#1E2C47' : '#E2E8F0', radius: 8 } });
      elements.push({ type: 'shape', id: `${id}-seg-${i + 1}`, bounds: [tx, ry + 17, Math.max(24, Math.round((trackW * pct) / Math.max(totalPct, 100))), 16], style: { fill: col, radius: 8 } });
      const vTxt = `${it.value ?? ''}  ${pct}%`.trim();
      elements.push(textElement({ id: `${id}-val-${i + 1}`, text: vTxt, bounds: [x + width - pad - valW - 14, ry + 11, valW, 28], style: theme.font(20, { fontWeight: 900, color: i === 2 ? r.pop : readableInk(col, subBg, 3.0), textAlign: 'right', lineHeight: 1.25 }) }));
    });
    return { elements, height: h };
  }

  if (variant === 'tiles') {
    const gap = 16, heroW = total ? Math.round(width * 0.28) : 0, restX = x + (heroW ? heroW + gap : 0), restW = width - (heroW ? heroW + gap : 0);
    const natural = 216, h = Math.max(natural, height || 0);
    const elements = [];
    if (heroW) {
      elements.push({ type: 'shape', id: `${id}-panel`, component: 'categoryBreakdown', bounds: [x, y, heroW, h], style: { fill: r.primary, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-htrim`, bounds: [x + 22, y, heroW - 44, 5], style: { fill: r.pop, radius: 3 } });
      if (title) elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + 24, y + 24, heroW - 48, 28], style: theme.font(18, { fontWeight: 600, color: p.inverse, lineHeight: 1.3 }) }));
      elements.push(textElement({ id: `${id}-total`, text: String(total), bounds: [x + 24, y + Math.round(h * 0.36), heroW - 48, 52], style: theme.font(44, { fontWeight: 900, color: p.inverse, lineHeight: 1.1 }) }));
      if (badge) {
        const bdgW = Math.min(heroW - 48, Math.ceil(textWidth(badge, 14) * 1.16) + 24);
        elements.push({ type: 'shape', id: `${id}-bdg-bg`, bounds: [x + 24, y + h - 46, bdgW, 26], style: { fill: r.pop, radius: 13 } });
        elements.push(textElement({ id: `${id}-bdg-tx`, text: badge, bounds: [x + 30, y + h - 43, bdgW - 12, 20], style: theme.font(13, { fontWeight: 700, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      }
    }
    const cw = Math.floor((restW - gap * (list.length - 1)) / list.length);
    list.forEach((it, i) => {
      const cx = restX + i * (cw + gap);
      const col = segColors[i % segColors.length];
      const pct = Number(it.pct) || Math.round(100 / list.length);
      elements.push({ type: 'shape', id: `${id}-sub-${i + 1}`, ...(i === 0 && !heroW ? { component: 'categoryBreakdown' } : {}), bounds: [cx, y, cw, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-trim-${i + 1}`, bounds: [cx + 20, y, cw - 40, 5], style: { fill: col, radius: 3 } });
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [cx + 20, y + 22, cw - 40, 26], style: theme.font(17, { fontWeight: 500, color: p.body || '#475569', lineHeight: 1.25 }) }));
      elements.push(textElement({ id: `${id}-val-${i + 1}`, text: String(it.value ?? `${pct}%`), bounds: [cx + 20, y + Math.round(h * 0.35), cw - 40, 40], style: theme.font(32, { fontWeight: 900, color: p.ink, lineHeight: 1.15 }) }));
      elements.push(textElement({ id: `${id}-pct-${i + 1}`, text: `占比 ${pct}%`, bounds: [cx + 20, y + h - 54, cw - 40, 22], style: theme.font(15, { fontWeight: 700, color: i === 2 ? r.pop : readableInk(col, surf, 3.0), lineHeight: 1.2 }) }));
      elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [cx + 20, y + h - 22, cw - 40, 7], style: { fill: p.line || '#E2E6EE', radius: 4 } });
      elements.push({ type: 'shape', id: `${id}-seg-${i + 1}`, bounds: [cx + 20, y + h - 22, Math.max(18, Math.round(((cw - 40) * pct) / Math.max(totalPct, 100))), 7], style: { fill: col, radius: 4 } });
    });
    return { elements, height: h };
  }

  const headerH = total ? (isCompact ? 50 : 60) : (isCompact ? 28 : 34);
  const barH = isCompact ? 14 : 16;
  const headerGap = isCompact ? 12 : 16;
  const barGap = isCompact ? 14 : 20;
  const singleCw = Math.floor((iw - 14 * (list.length - 1)) / list.length);
  const useGrid = singleCw < 175 && list.length >= 4;
  const cols = useGrid ? (list.length === 4 ? 2 : 3) : list.length;
  const rowsCount = useGrid ? Math.ceil(list.length / cols) : 1;
  const cGap = useGrid ? 12 : 14;
  const rGap = 10;
  const subCardH = useGrid ? (isCompact ? 70 : 76) : (isCompact ? 80 : 96);
  const cardsTotalH = rowsCount * subCardH + (rowsCount - 1) * rGap;
  const natural = pad + headerH + headerGap + barH + barGap + cardsTotalH + pad;
  const h = Math.max(natural, height || 0);
  const cyShift = Math.round((h - natural) / 2);
  const elements = [
    { type: 'shape', id: `${id}-panel`, component: 'categoryBreakdown', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } },
  ];

  // Header row: title + giant total + optional semantic badge pill
  let curY = y + pad + cyShift;
  if (total) {
    if (title) elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, iw - 220, 24], style: theme.font(18, { fontWeight: 600, color: p.body || '#475569', lineHeight: 1.25 }) }));
    elements.push(textElement({ id: `${id}-total`, text: String(total), bounds: [x + pad, curY + (isCompact ? 20 : 24), iw - 240, 38], style: theme.font(isCompact ? 30 : 34, { fontWeight: 900, color: p.ink, lineHeight: 1.12 }) }));
  } else if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw - 220, 28], style: theme.font(isCompact ? 20 : 22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
  }
  if (badge) {
    const bw = Math.min(240, Math.ceil(textWidth(badge, 15) * 1.16) + 28), bh = 28;
    const okBg = p.dark ? '#11302B' : '#ECFDF5', okFg = p.dark ? '#34D399' : '#047857';
    elements.push({ type: 'shape', id: `${id}-bdg-bg`, bounds: [x + width - pad - bw, curY + Math.round((headerH - bh) / 2), bw, bh], style: { fill: okBg, radius: 14 } });
    elements.push(textElement({ id: `${id}-bdg-tx`, text: badge, bounds: [x + width - pad - bw + 8, curY + Math.round((headerH - 20) / 2), bw - 16, 20], style: theme.font(15, { fontWeight: 700, color: okFg, textAlign: 'center', lineHeight: 1.2 }) }));
  }

  // Segmented horizontal bar
  curY += headerH + headerGap;
  const segGap = 6, usableW = iw - segGap * (list.length - 1);
  let sx = x + pad;
  list.forEach((it, i) => {
    const pct = Number(it.pct) || Math.round(100 / list.length);
    const sw = i === list.length - 1 ? Math.max(24, x + pad + iw - sx) : Math.max(24, Math.round((usableW * pct) / totalPct));
    elements.push({ type: 'shape', id: `${id}-seg-${i + 1}`, bounds: [sx, curY, sw, barH], style: { fill: segColors[i % segColors.length], radius: 8 } });
    sx += sw + segGap;
  });

  // Bottom breakdown sub-cards (auto multi-row grid when column width is tight)
  curY += barH + barGap;
  const cw = Math.floor((iw - cGap * (cols - 1)) / cols);
  list.forEach((it, i) => {
    const colIdx = i % cols, rowIdx = Math.floor(i / cols);
    const cx = x + pad + colIdx * (cw + cGap);
    const ry = curY + rowIdx * (subCardH + rGap);
    const col = segColors[i % segColors.length];
    elements.push({ type: 'shape', id: `${id}-sub-${i + 1}`, bounds: [cx, ry, cw, subCardH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 12 } });
    elements.push({ type: 'shape', id: `${id}-dot-${i + 1}`, bounds: [cx + 14, ry + (subCardH < 84 ? 14 : 19), 10, 10], style: { fill: col, radius: 3 } });
    elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [cx + 32, ry + (subCardH < 84 ? 8 : 12), cw - 44, 24], style: theme.font(isCompact ? 15 : 16, { fontWeight: 500, color: p.body || '#475569', lineHeight: 1.25 }) }));
    const valText = String(it.value ?? `${it.pct}%`);
    const pctText = it.pct != null ? `${it.pct}%` : '';
    let vSz = subCardH < 84 ? 22 : 26;
    while (vSz > 16 && textWidth(valText + (pctText && !valText.includes('%') ? '  ' + pctText : ''), vSz) > cw - 28) vSz -= 2;
    const runs = [
      { text: valText, style: { fontSize: vSz, fontWeight: 900, color: p.ink } },
      ...(pctText && !valText.includes('%') ? [{ text: '  ' + pctText, style: { fontSize: 14, fontWeight: 700, color: i === 2 ? r.pop : readableInk(col, subBg, 3.0) } }] : []),
    ];
    elements.push(textElement({ id: `${id}-val-${i + 1}`, text: valText + (pctText ? ' ' + pctText : ''), runs, bounds: [cx + 14, ry + (subCardH < 84 ? 36 : 46), cw - 28, 32], style: theme.font(vSz, { fontWeight: 900, color: p.ink, lineHeight: 1.2 }) }));
  });
  return { elements, height: h };
}

// Modern SaaS Conversion Funnel with 3 visual styles:
//   - 'centered' (default): centered progressively narrowing rounded funnel bars + conversion pills
//   - 'cards'    (horizontal funnel cards): side-by-side step cards linked by conversion-rate arrows
//   - 'bars'     (left-aligned ranked progress bars): crisp horizontal bar cards with bold left-aligned fill
export function conversionFunnel({ id, x, y, width, height, title = '', steps = [], theme, variant = 'centered' }) {
  const p = theme.palette, r = colorRoles(p), list = steps.slice(0, 6);
  if (!list.length) return { elements: [], height: 0 };
  const pad = 28, iw = width - pad * 2, surf = p.surface || '#FFFFFF';
  const rad = theme.radius ?? 14;
  const parseNum = (st) => {
    const raw = `${st.value ?? ''}${st.unit || ''}`.replace(/,/g, '');
    const m = raw.match(/\d+(?:\.\d+)?/);
    if (!m) return null;
    let v = Number(m[0]);
    if (/亿/.test(raw)) v *= 1e8;
    else if (/万/.test(raw)) v *= 1e4;
    else if (/[kK千]/.test(raw)) v *= 1e3;
    else if (/[mM百万]/.test(raw)) v *= 1e6;
    return v;
  };
  const nums = list.map((s) => parseNum(s));
  const maxNum = Math.max(...nums.filter((v) => v != null), 1);
  // Smooth log-blended monotonic funnel shares so wide top-of-funnel to small bottom-of-funnel stays readable & strictly tapering
  const shares = list.map((_, i) => {
    const linear = nums[i] != null ? Math.max(0.01, nums[i] / maxNum) : Math.max(0.25, 1 - i * (0.68 / Math.max(1, list.length - 1)));
    const blended = nums[i] != null ? (0.45 * linear + 0.55 * Math.pow(linear, 0.35)) : linear;
    return Math.max(0.30, Math.min(1, 0.28 + 0.72 * blended));
  });
  for (let i = 1; i < shares.length; i++) {
    if (nums[i] != null && nums[i - 1] != null && nums[i] < nums[i - 1] && shares[i] >= shares[i - 1] - 0.06) {
      shares[i] = Math.max(0.28, shares[i - 1] - 0.10);
    }
  }

  if (variant === 'cards') {
    const headH = title ? 48 : 0, arrowW = 46;
    const natural = 350, h = Math.max(natural, height || 0);
    const cardH = h - pad * 2 - headH;
    const cw = Math.floor((iw - arrowW * (list.length - 1)) / list.length);
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'conversionFunnel', bounds: [x, y, width, h], style: { fill: p.dark ? (p.band || '#142138') : '#F8FAFC', stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    const cardY = y + pad + headH;
    if (title) elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, y + pad, iw, 34], style: theme.font(24, { fontWeight: 700, color: readableInk(p.accent, p.dark ? '#142138' : '#F8FAFC'), lineHeight: 1.3 }) }));
    list.forEach((st, i) => {
      const cx = x + pad + i * (cw + arrowW);
      const isLast = i === list.length - 1;
      const share = shares[i];
      const barCol = isLast ? r.pop : i === 0 ? (p.dark ? '#38BDF8' : lighten(r.primary, 0.35)) : r.primary;
      elements.push({ type: 'shape', id: `${id}-card-${i + 1}`, bounds: [cx, cardY, cw, cardH], style: { fill: isLast ? r.primary : surf, stroke: isLast ? r.primary : (p.line || '#E2E6EE'), strokeWidth: 1.5, radius: 16 } });
      elements.push({ type: 'shape', id: `${id}-trim-${i + 1}`, bounds: [cx + 18, cardY, cw - 36, 5], style: { fill: barCol, radius: 3 } });
      const badgeTxt = `STEP 0${i + 1}`;
      elements.push({ type: 'shape', id: `${id}-numbg-${i + 1}`, bounds: [cx + 22, cardY + 22, 86, 26], style: { fill: isLast ? r.pop : r.band, radius: 13 } });
      elements.push(textElement({ id: `${id}-num-${i + 1}`, text: badgeTxt, bounds: [cx + 22, cardY + 25, 86, 20], style: theme.font(14, { fontWeight: 800, color: isLast ? '#FFFFFF' : readableInk(r.primary, r.band), textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: st.label || '', bounds: [cx + 22, cardY + 58, cw - 44, 30], style: theme.font(20, { fontWeight: 700, color: isLast ? p.inverse : p.ink, lineHeight: 1.25 }) }));
      if (st.detail) elements.push(textElement({ id: `${id}-sub-${i + 1}`, text: st.detail, bounds: [cx + 22, cardY + 92, cw - 44, 54], style: theme.font(17, { fontWeight: 400, color: isLast ? p.inverse : (p.body || '#475569'), lineHeight: 1.38 }) }));
      const valStr = `${st.value ?? ''}${st.unit ? ' ' + st.unit : ''}`;
      let vSz = 38;
      while (vSz > 24 && textWidth(valStr, vSz) > cw - 44) vSz -= 2;
      elements.push(textElement({ id: `${id}-val-${i + 1}`, text: valStr, bounds: [cx + 22, cardY + cardH - 96, cw - 44, 48], style: theme.font(vSz, { fontWeight: 900, color: isLast ? p.inverse : r.primary, lineHeight: 1.15 }) }));
      elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [cx + 22, cardY + cardH - 36, cw - 44, 10], style: { fill: isLast ? lighten(r.primary, 0.22) : (p.line || '#E2E6EE'), radius: 5 } });
      elements.push({ type: 'shape', id: `${id}-bar-${i + 1}`, bounds: [cx + 22, cardY + cardH - 36, Math.max(20, Math.round((cw - 44) * share)), 10], style: { fill: barCol, radius: 5 } });
      if (i < list.length - 1) {
        const ax = cx + cw + 4, ay = cardY + Math.round(cardH / 2);
        elements.push(textElement({ id: `${id}-ar-${i + 1}`, text: '→', bounds: [ax, ay - 24, arrowW - 8, 32], style: theme.font(26, { fontWeight: 900, color: r.pop, textAlign: 'center', lineHeight: 1.2 }) }));
        if (list[i + 1].drop || list[i + 1].rate) {
          elements.push(textElement({ id: `${id}-rt-${i + 1}`, text: String(list[i + 1].drop || list[i + 1].rate).replace(/[^\d.%]/g, '') || '', bounds: [ax - 6, ay + 8, arrowW + 4, 22], style: theme.font(14, { fontWeight: 700, color: p.muted || '#64748B', textAlign: 'center', lineHeight: 1.2 }) }));
        }
      }
    });
    return { elements, height: h };
  }

  const headH = title ? 48 : 0;
  const rowGap = 16;
  const baseRowH = 82;
  const natural = pad * 2 + headH + list.length * baseRowH + (list.length - 1) * rowGap;
  const h = Math.max(natural, height || 0);
  const rowH = Math.min(88, Math.floor((h - pad * 2 - headH - (list.length - 1) * rowGap) / list.length));
  const usedH = pad * 2 + headH + list.length * rowH + (list.length - 1) * rowGap;
  const topOff = Math.round((h - usedH) / 2);

  const elements = [
    { type: 'shape', id: `${id}-panel`, component: 'conversionFunnel', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } },
  ];
  let curY = y + pad + topOff;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, iw, 34], style: theme.font(24, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.3 }) }));
    curY += headH;
  }

  const leftW = Math.min(340, Math.round(iw * 0.24));
  const rightW = Math.min(230, Math.round(iw * 0.17));
  const centerX = x + pad + leftW + 20;
  const centerW = iw - leftW - rightW - 40;

  list.forEach((st, i) => {
    const ry = curY + i * (rowH + rowGap);
    const isLast = i === list.length - 1;
    const share = shares[i];
    const barW = Math.round(centerW * share);
    const bx = variant === 'bars' ? centerX : centerX + Math.round((centerW - barW) / 2);

    // Subtle full-width guide track
    elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [centerX, ry + 4, centerW, rowH - 8], style: { fill: p.dark ? (p.band || '#142138') : '#F8FAFC', radius: 12 } });

    // Left: step pill + label
    const badgeD = 34;
    elements.push({ type: 'shape', id: `${id}-numbg-${i + 1}`, bounds: [x + pad, ry + Math.round((rowH - badgeD) / 2), badgeD, badgeD], style: { fill: isLast ? r.pop : r.band, radius: 17 }, shape: 'ellipse' });
    elements.push(textElement({ id: `${id}-num-${i + 1}`, text: String(i + 1).padStart(2, '0'), bounds: [x + pad, ry + Math.round((rowH - 22) / 2), badgeD, 22], style: theme.font(16, { fontWeight: 900, color: isLast ? '#FFFFFF' : readableInk(r.primary, r.band), textAlign: 'center', lineHeight: 1.2 }) }));
    const hasSub = Boolean(st.detail);
    elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: st.label || '', bounds: [x + pad + badgeD + 14, ry + Math.round((rowH - (hasSub ? 48 : 26)) / 2), leftW - badgeD - 18, 26], style: theme.font(20, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
    if (hasSub) {
      elements.push(textElement({ id: `${id}-sub-${i + 1}`, text: st.detail, bounds: [x + pad + badgeD + 14, ry + Math.round((rowH - 48) / 2) + 26, leftW - badgeD - 18, 24], style: theme.font(17, { fontWeight: 400, color: p.body || '#475569', lineHeight: 1.25 }) }));
    }

    // Center: centered rounded funnel bar with bold figure inside
    const barFill = isLast ? r.pop : i === 0 ? (p.dark ? '#1E3A5F' : lighten(r.primary, 0.72)) : i === 1 ? (p.dark ? '#254E7A' : lighten(r.primary, 0.36)) : r.primary;
    const barInk = isLast || i >= 2 || p.dark ? '#FFFFFF' : readableInk(r.primary, barFill, 3.8);
    elements.push({ type: 'shape', id: `${id}-bar-${i + 1}`, bounds: [bx, ry + 4, barW, rowH - 8], style: { fill: barFill, radius: 12 } });
    const valStr = `${st.value ?? ''}${st.unit ? ' ' + st.unit : ''}`;
    const rateInBar = st.rate ? `  ·  ${st.rate}` : '';
    const runs = [
      { text: valStr, style: { fontSize: 24, fontWeight: 900, color: barInk } },
      ...(rateInBar && textWidth(valStr + rateInBar, 24) < barW - 28 ? [{ text: rateInBar, style: { fontSize: 18, fontWeight: 400, color: barInk } }] : []),
    ];
    elements.push(textElement({ id: `${id}-val-${i + 1}`, text: valStr + (runs.length > 1 ? rateInBar : ''), runs, bounds: [bx + 12, ry + Math.round((rowH - 32) / 2), barW - 24, 32], style: theme.font(24, { fontWeight: 900, color: barInk, textAlign: 'center', lineHeight: 1.25 }) }));

    // Right: conversion / rate badge pill
    const rightTxt = st.drop || st.rate || '';
    if (rightTxt) {
      const pw = Math.min(rightW, Math.ceil(textWidth(rightTxt, 17) * 1.16) + 28), ph = 32;
      const rx = x + width - pad - pw;
      const pillBg = isLast ? (p.dark ? '#331E18' : lighten(r.pop, 0.9)) : r.band;
      const pillFg = isLast ? r.pop : readableInk(r.primary, pillBg, 3.2);
      elements.push({ type: 'shape', id: `${id}-rtbg-${i + 1}`, bounds: [rx, ry + Math.round((rowH - ph) / 2), pw, ph], style: { fill: pillBg, radius: 16 } });
      elements.push(textElement({ id: `${id}-rt-${i + 1}`, text: rightTxt, bounds: [rx + 8, ry + Math.round((rowH - 22) / 2), pw - 16, 22], style: theme.font(16, { fontWeight: 700, color: pillFg, textAlign: 'center', lineHeight: 1.2 }) }));
    }
  });
  return { elements, height: h };
}

// Magic-UI-inspired Hub & Spoke Architecture with 2 visual styles:
//   - 'horizontal' (default): Left Inputs -> Elevated Central Hub -> Right Outputs
//   - 'layered'    (top-to-bottom pipeline): Top Input Cards -> Wide Solid Central Engine Bar -> Bottom Output Cards
export function hubArchitecture({ id, x, y, width, height, title = '', center = {}, inputs = [], outputs = [], theme, variant = 'horizontal' }) {
  const p = theme.palette, r = colorRoles(p);
  const inList = inputs.slice(0, 4), outList = outputs.slice(0, 4);
  const isCompact = Boolean(theme?.compact);
  const activeVariant = variant === 'horizontal' && width < 1120 ? 'layered' : variant;
  const pad = isCompact ? 22 : 28, iw = width - pad * 2, surf = p.surface || '#FFFFFF';
  const rad = theme.radius ?? 14;
  const headH = title ? (isCompact ? 44 : 52) : 0;

  if (activeVariant === 'layered') {
    const rowH = isCompact ? 104 : 114, hubH = isCompact ? 96 : 110, arrowGap = isCompact ? 34 : 42;
    const natural = pad * 2 + headH + rowH + arrowGap + hubH + arrowGap + rowH;
    const h = Math.max(natural, height || 0);
    const topOff = Math.round((h - natural) / 2);
    const elements = [
      { type: 'shape', id: `${id}-panel`, component: 'hubArchitecture', bounds: [x, y, width, h], style: { fill: p.dark ? (p.band || '#142138') : '#F8FAFC', stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } },
    ];
    let curY = y + pad + topOff;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, iw, 34], style: theme.font(isCompact ? 21 : 24, { fontWeight: 700, color: readableInk(p.accent, p.dark ? '#142138' : '#F8FAFC'), lineHeight: 1.3 }) }));
      curY += headH;
    }
    const hubY = curY + rowH + arrowGap;
    const outY = hubY + hubH + arrowGap;
    const drawRow = (list, ry, isOut) => {
      const gap = 16, cw = Math.floor((iw - gap * (list.length - 1)) / Math.max(1, list.length));
      const narrowCard = cw < 280;
      list.forEach((item, i) => {
        const cx = x + pad + i * (cw + gap), midX = cx + Math.round(cw / 2);
        elements.push({ ...lineElement({ id: `${id}-${isOut ? 'out' : 'in'}-ln-${i + 1}`, from: isOut ? [midX, hubY + hubH + 4] : [midX, ry + rowH + 4], to: isOut ? [midX, ry - 6] : [midX, hubY - 6], style: { stroke: isOut ? r.pop : r.primary, strokeWidth: 2.5 } }), endArrow: true });
        elements.push({ type: 'shape', id: `${id}-${isOut ? 'out' : 'in'}-card-${i + 1}`, bounds: [cx, ry, cw, rowH], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: 14 } });
        elements.push({ type: 'shape', id: `${id}-${isOut ? 'out' : 'in'}-dot-${i + 1}`, bounds: [cx + 16, ry + 22, 12, 12], style: { fill: isOut ? (p.dark ? '#34D399' : '#10B981') : (i === 0 ? r.pop : r.primary), radius: 6 }, shape: 'ellipse' });
        elements.push(textElement({ id: `${id}-${isOut ? 'out' : 'in'}-t-${i + 1}`, text: item.title || '', bounds: [cx + 36, ry + 16, cw - 50, 26], style: theme.font(narrowCard ? 18 : 20, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
        if (item.detail) elements.push(textElement({ id: `${id}-${isOut ? 'out' : 'in'}-d-${i + 1}`, text: item.detail, bounds: [cx + 16, ry + 48, cw - 32, rowH - 54], style: theme.font(narrowCard ? 15 : 17, { fontWeight: 400, color: p.body || '#475569', lineHeight: 1.35 }) }));
      });
    };
    drawRow(inList, curY, false);
    drawRow(outList, outY, true);
    const badgeTxt = center.badge || 'CORE';
    const lPillW = Math.min(200, Math.max(88, Math.ceil(textWidth(badgeTxt, 14) * 1.2) + 28));
    const hubTitleX = x + pad + 28 + lPillW + 18;
    const hubTitleW = Math.min(360, Math.max(180, Math.round(iw * 0.36)));
    const hubSubX = hubTitleX + hubTitleW + 16;
    const hubSubW = Math.max(140, x + pad + iw - 24 - hubSubX);
    elements.push({ type: 'shape', id: `${id}-hub-card`, bounds: [x + pad, hubY, iw, hubH], style: { fill: r.primary, radius: 18 } });
    elements.push({ type: 'shape', id: `${id}-hub-trim`, bounds: [x + pad + 28, hubY, iw - 56, 5], style: { fill: r.pop, radius: 3 } });
    elements.push({ type: 'shape', id: `${id}-hub-pill`, bounds: [x + pad + 28, hubY + Math.round((hubH - 28) / 2), lPillW, 28], style: { fill: r.pop, radius: 14 } });
    elements.push(textElement({ id: `${id}-hub-ptx`, text: badgeTxt, bounds: [x + pad + 28, hubY + Math.round((hubH - 28) / 2) + 4, lPillW, 20], style: theme.font(14, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-hub-t`, text: center.title || '核心中台', bounds: [hubTitleX, hubY + Math.round((hubH - 38) / 2), hubTitleW, 38], style: theme.font(iw < 980 ? 22 : 28, { fontWeight: 900, color: p.inverse, lineHeight: 1.25 }) }));
    if (center.sub) elements.push(textElement({ id: `${id}-hub-sub`, text: String(center.sub).replace(/\n/g, '  ·  '), bounds: [hubSubX, hubY + Math.round((hubH - 32) / 2), hubSubW, 32], style: theme.font(iw < 980 ? 16 : 19, { fontWeight: 400, color: p.inverse, textAlign: 'right', lineHeight: 1.3 }) }));
    return { elements, height: h };
  }

  const rowsMax = Math.max(inList.length, outList.length, 1);
  const nodeGap = isCompact ? 14 : 20, baseNodeH = isCompact ? 98 : 108;
  const natural = pad * 2 + headH + rowsMax * baseNodeH + (rowsMax - 1) * nodeGap;
  const h = Math.max(natural, height || 0);
  const bodyH = h - pad * 2 - headH;
  const nodeH = Math.min(112, Math.floor((bodyH - (rowsMax - 1) * nodeGap) / rowsMax));
  const bodyTop = y + pad + headH;

  const elements = [
    { type: 'shape', id: `${id}-panel`, component: 'hubArchitecture', bounds: [x, y, width, h], style: { fill: p.dark ? (p.band || '#142138') : '#F8FAFC', stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } },
  ];
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, y + pad, iw, 34], style: theme.font(isCompact ? 21 : 24, { fontWeight: 700, color: readableInk(p.accent, p.dark ? '#142138' : '#F8FAFC'), lineHeight: 1.3 }) }));
  }

  const colW = Math.floor(iw * 0.31);
  const narrowCol = colW < 280;
  const hubW = Math.floor(iw * 0.22);
  const connW = Math.floor((iw - colW * 2 - hubW) / 2);
  const leftX = x + pad;
  const hubX = leftX + colW + connW;
  const rightX = hubX + hubW + connW;

  const hubH = Math.min(bodyH, Math.max(180, Math.round(bodyH * 0.68)));
  const hubY = bodyTop + Math.round((bodyH - hubH) / 2);
  const hubMidY = hubY + Math.round(hubH / 2);

  // Draw connector lines FIRST (underneath cards)
  const drawColumn = (list, cx, isOutput) => {
    const colTotalH = list.length * nodeH + (list.length - 1) * nodeGap;
    const startY = bodyTop + Math.round((bodyH - colTotalH) / 2);
    list.forEach((item, i) => {
      const ny = startY + i * (nodeH + nodeGap);
      const midY = ny + Math.round(nodeH / 2);
      const fromPt = isOutput ? [hubX + hubW + 4, hubMidY] : [cx + colW + 4, midY];
      const toPt = isOutput ? [cx - 6, midY] : [hubX - 6, hubMidY];
      elements.push({ ...lineElement({ id: `${id}-${isOutput ? 'out' : 'in'}-ln-${i + 1}`, from: fromPt, to: toPt, style: { stroke: isOutput ? r.pop : r.primary, strokeWidth: 2.5 } }), endArrow: true });

      elements.push({ type: 'shape', id: `${id}-${isOutput ? 'out' : 'in'}-card-${i + 1}`, bounds: [cx, ny, colW, nodeH], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: 14 } });
      const dotColor = isOutput ? (p.dark ? '#34D399' : '#10B981') : (i === 0 ? r.pop : r.primary);
      elements.push({ type: 'shape', id: `${id}-${isOutput ? 'out' : 'in'}-dot-${i + 1}`, bounds: [cx + 16, ny + Math.round((nodeH - 12) / 2), 12, 12], style: { fill: dotColor, radius: 6 }, shape: 'ellipse' });

      const hasDet = Boolean(item.detail);
      const detH = narrowCol ? 40 : 28;
      const textStartY = ny + Math.max(10, Math.round((nodeH - (hasDet ? 26 + detH : 28)) / 2));
      elements.push(textElement({ id: `${id}-${isOutput ? 'out' : 'in'}-t-${i + 1}`, text: item.title || '', bounds: [cx + 38, textStartY, colW - 52, 26], style: theme.font(narrowCol ? 18 : 20, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (hasDet) {
        elements.push(textElement({ id: `${id}-${isOutput ? 'out' : 'in'}-d-${i + 1}`, text: item.detail, bounds: [cx + 38, textStartY + 26, colW - 52, detH], style: theme.font(narrowCol ? 15 : 17, { fontWeight: 400, color: p.body || '#475569', lineHeight: 1.3 }) }));
      }
    });
  };

  drawColumn(inList, leftX, false);
  drawColumn(outList, rightX, true);

  // Center Elevated Primary Hub Card
  elements.push({ type: 'shape', id: `${id}-hub-card`, bounds: [hubX, hubY, hubW, hubH], style: { fill: r.primary, radius: 22 } });
  elements.push({ type: 'shape', id: `${id}-hub-trim`, bounds: [hubX + 26, hubY, hubW - 52, 6], style: { fill: r.pop, radius: 3 } });
  const hBadgeTxt = center.badge || 'CORE';
  const corePillW = Math.min(hubW - 32, Math.max(84, Math.ceil(textWidth(hBadgeTxt, 14) * 1.2) + 28));
  elements.push({ type: 'shape', id: `${id}-hub-pill`, bounds: [hubX + Math.round((hubW - corePillW) / 2), hubY + Math.round(hubH * 0.22), corePillW, 28], style: { fill: r.pop, radius: 14 } });
  elements.push(textElement({ id: `${id}-hub-ptx`, text: hBadgeTxt, bounds: [hubX + Math.round((hubW - corePillW) / 2), hubY + Math.round(hubH * 0.22) + 4, corePillW, 20], style: theme.font(14, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
  const hubTitle = center.title || '核心中台';
  elements.push(textElement({ id: `${id}-hub-t`, text: hubTitle, bounds: [hubX + 18, hubY + Math.round(hubH * 0.44), hubW - 36, 40], style: theme.font(narrowCol ? 22 : 26, { fontWeight: 900, color: p.inverse, textAlign: 'center', lineHeight: 1.25 }) }));
  if (center.sub) {
    elements.push(textElement({ id: `${id}-hub-sub`, text: center.sub, bounds: [hubX + 18, hubY + Math.round(hubH * 0.66), hubW - 36, 48], style: theme.font(narrowCol ? 16 : 18, { fontWeight: 400, color: p.inverse, textAlign: 'center', lineHeight: 1.35 }) }));
  }

  return { elements, height: h };
}
