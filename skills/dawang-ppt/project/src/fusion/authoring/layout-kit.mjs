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

// =========================================================================
// Modern Web UI Batch 2: Quadrant Matrix, Diagnosis Trio, Period Tracker, Feature Matrix
// =========================================================================

// 2x2 Quadrant Matrix with 3 visual styles:
//   - 'grid'  (default): modern cross-axis coordinate frame + 4 micro-bordered quadrant cards
//   - 'cards' (2x2 Bento): borderless axis-free 2x2 Bento cards with top accent trim
//   - 'split' (hero + 3 stack): primary highlighted quadrant enlarged on left, remaining 3 stacked on right
export function quadrantMatrix({ id, x, y, width, height, title = '', xLabel = '', yLabel = '', quadrants = [], theme, variant = 'grid' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(quadrants) ? quadrants : []).slice(0, 4);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#10B981';
  const okBg = p.dark ? '#11302B' : '#ECFDF5';
  const popBg = p.dark ? '#331E12' : '#FFF7ED';
  const pad = isCompact ? 18 : 24;
  const headH = title ? (isCompact ? 38 : 44) : 0;

  const toneStyle = (q, idx) => {
    const tone = q.tone || (q.highlight ? 'primary' : idx === 0 ? 'primary' : idx === 1 ? 'pop' : idx === 2 ? 'ok' : 'muted');
    if (tone === 'primary') return { bar: r.primary, badgeBg: p.pale || '#EEF2FF', badgeFg: readableInk(r.primary, p.pale || '#EEF2FF'), border: r.primary, fill: surf, numBg: r.primary, numFg: p.inverse || '#FFFFFF' };
    if (tone === 'pop') return { bar: r.pop, badgeBg: popBg, badgeFg: r.pop, border: p.line || '#E2E6EE', fill: surf, numBg: r.pop, numFg: '#FFFFFF' };
    if (tone === 'ok') return { bar: okCol, badgeBg: okBg, badgeFg: okCol, border: p.line || '#E2E6EE', fill: surf, numBg: okCol, numFg: '#FFFFFF' };
    return { bar: muted, badgeBg: subBg, badgeFg: muted, border: p.line || '#E2E6EE', fill: subBg, numBg: muted, numFg: '#FFFFFF' };
  };

  const renderQuadContent = (elements, q, idx, cx, cy, cw, ch, darkCard = false) => {
    const ts = toneStyle(q, idx);
    const cPad = isCompact ? 16 : 20;
    const tagTxt = q.tag || `Q${idx + 1}`;
    const tagW = Math.min(Math.round(cw * 0.36), Math.max(66, Math.ceil(textWidth(tagTxt, 13) * 1.18) + 22));
    const numSz = 28;
    const tx = cx + cPad;
    const ty = cy + (darkCard ? 22 : 18);
    // Number badge
    elements.push({ type: 'shape', id: `${id}-qnum-${idx + 1}`, bounds: [tx, ty + 1, numSz, numSz], style: { fill: darkCard ? r.pop : ts.numBg, radius: 8 } });
    elements.push(textElement({ id: `${id}-qntx-${idx + 1}`, text: `0${idx + 1}`, bounds: [tx, ty + 4, numSz, 22], style: theme.font(14, { fontWeight: 900, color: darkCard ? '#FFFFFF' : ts.numFg, textAlign: 'center', lineHeight: 1.2 }) }));
    // Right tag pill
    elements.push({ type: 'shape', id: `${id}-qtag-bg-${idx + 1}`, bounds: [cx + cw - cPad - tagW, ty + 2, tagW, 26], style: { fill: darkCard ? mixHexLocal(r.primary, '#FFFFFF', 0.16) : ts.badgeBg, radius: 13 } });
    elements.push(textElement({ id: `${id}-qtag-tx-${idx + 1}`, text: tagTxt, bounds: [cx + cw - cPad - tagW + 6, ty + 5, tagW - 12, 20], style: theme.font(13, { fontWeight: 700, color: darkCard ? '#FFFFFF' : ts.badgeFg, textAlign: 'center', lineHeight: 1.2 }) }));
    // Quadrant title
    const titleW = Math.max(80, cw - cPad * 2 - numSz - tagW - 18);
    elements.push(textElement({ id: `${id}-qt-${idx + 1}`, text: q.title || '', bounds: [tx + numSz + 10, ty + 1, titleW, 30], style: theme.font(isCompact ? 19 : 21, { fontWeight: 700, color: darkCard ? (p.inverse || '#FFFFFF') : p.ink, lineHeight: 1.25 }) }));

    const bodyTop = ty + 38;
    const bodyH = Math.max(40, cy + ch - bodyTop - 14);
    const bodyColor = darkCard ? (p.inverse || '#FFFFFF') : muted;
    const pts = Array.isArray(q.items) && q.items.length ? q.items : (q.detail ? [q.detail] : []);
    if (pts.length) {
      const fs = pts.length >= 4 || bodyH < 100 ? 17 : (isCompact ? 18 : 20);
      const lineGap = pts.length >= 4 ? 6 : 10;
      const availPer = Math.max(24, Math.floor((bodyH - lineGap * (pts.length - 1)) / pts.length));
      let curY = bodyTop;
      pts.slice(0, 4).forEach((pt, pi) => {
        const ptStr = typeof pt === 'string' ? pt : `${pt.title || ''}${pt.detail ? `：${pt.detail}` : ''}`;
        if (curY + 20 > cy + ch - 8) return;
        elements.push({ type: 'shape', id: `${id}-qdot-${idx + 1}-${pi + 1}`, bounds: [tx + 2, curY + Math.round(fs * 0.45), 7, 7], style: { fill: darkCard ? r.pop : ts.bar, radius: 4 }, shape: 'ellipse' });
        const bh = Math.min(availPer, cy + ch - 10 - curY);
        elements.push(textElement({ id: `${id}-qp-${idx + 1}-${pi + 1}`, text: ptStr, bounds: [tx + 18, curY, cw - cPad * 2 - 18, bh], style: theme.font(fs, { fontWeight: 300, color: bodyColor, lineHeight: 1.35 }) }));
        curY += bh + lineGap;
      });
    }
  };

  const natural = isCompact ? 420 : 500;
  const h = Math.max(natural, height || 0);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'quadrantMatrix', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, width - pad * 2, 32], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    curY += headH;
  }

  if (variant === 'split') {
    const focusIdx = Math.max(0, list.findIndex((q) => q.highlight));
    const focusQ = list[focusIdx];
    const others = list.map((q, i) => ({ q, i })).filter((o) => o.i !== focusIdx);
    const bodyH = h - (curY - y) - pad;
    const gap = 18;
    const leftW = Math.round((width - pad * 2 - gap) * 0.44);
    const rightX = x + pad + leftW + gap;
    const rightW = width - pad * 2 - leftW - gap;
    elements.push({ type: 'shape', id: `${id}-qcard-${focusIdx + 1}`, bounds: [x + pad, curY, leftW, bodyH], style: { fill: r.primary, radius: rad } });
    elements.push({ type: 'shape', id: `${id}-qtrim-${focusIdx + 1}`, bounds: [x + pad + 22, curY, leftW - 44, 5], style: { fill: r.pop, radius: 3 } });
    renderQuadContent(elements, focusQ, focusIdx, x + pad, curY, leftW, bodyH, true);
    const rowGap = 14;
    const rowH = Math.floor((bodyH - rowGap * Math.max(0, others.length - 1)) / Math.max(1, others.length));
    others.forEach(({ q, i }, oi) => {
      const ry = curY + oi * (rowH + rowGap);
      const ts = toneStyle(q, i);
      elements.push({ type: 'shape', id: `${id}-qcard-${i + 1}`, bounds: [rightX, ry, rightW, rowH], style: { fill: ts.fill, stroke: ts.border, strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-qtrim-${i + 1}`, bounds: [rightX, ry + 14, 5, Math.max(24, rowH - 28)], style: { fill: ts.bar, radius: 3 } });
      renderQuadContent(elements, q, i, rightX + 6, ry, rightW - 6, rowH, false);
    });
    return { elements, height: h };
  }

  const showAxes = variant !== 'cards';
  const yAxisW = showAxes && yLabel ? 44 : 0;
  const xAxisH = showAxes && xLabel ? 36 : 0;
  const gridX = x + pad + yAxisW;
  const gridY = curY;
  const gridW = width - pad * 2 - yAxisW;
  const gridH = h - (curY - y) - pad - xAxisH;
  const gap = showAxes ? 24 : 16;
  const cw = Math.floor((gridW - gap) / 2);
  const ch = Math.floor((gridH - gap) / 2);

  if (showAxes) {
    const midX = gridX + cw + Math.round(gap / 2);
    const midY = gridY + ch + Math.round(gap / 2);
    elements.push({ ...lineElement({ id: `${id}-axis-x`, from: [gridX, midY], to: [gridX + gridW, midY], style: { stroke: p.line || '#CBD5E1', strokeWidth: 2 } }), endArrow: true });
    elements.push({ ...lineElement({ id: `${id}-axis-y`, from: [midX, gridY + gridH], to: [midX, gridY], style: { stroke: p.line || '#CBD5E1', strokeWidth: 2 } }), endArrow: true });
    if (yLabel) {
      const yChars = String(yLabel).slice(0, 8).split('').join('\n');
      elements.push(textElement({ id: `${id}-ylabel`, text: yChars, bounds: [x + pad - 2, gridY + Math.round(gridH * 0.12), 36, Math.round(gridH * 0.76)], style: theme.font(15, { fontWeight: 700, color: muted, textAlign: 'center', lineHeight: 1.25 }) }));
    }
    if (xLabel) {
      const xlW = Math.min(gridW, Math.max(160, Math.ceil(textWidth(xLabel, 15) * 1.15) + 32));
      const xlX = gridX + Math.round((gridW - xlW) / 2);
      elements.push({ type: 'shape', id: `${id}-xlabel-bg`, bounds: [xlX, gridY + gridH + 8, xlW, 26], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 13 } });
      elements.push(textElement({ id: `${id}-xlabel`, text: xLabel, bounds: [xlX + 8, gridY + gridH + 11, xlW - 16, 20], style: theme.font(14, { fontWeight: 700, color: muted, textAlign: 'center', lineHeight: 1.2 }) }));
    }
  }

  list.forEach((q, idx) => {
    const col = idx % 2, row = Math.floor(idx / 2);
    const cx = gridX + col * (cw + gap);
    const cy = gridY + row * (ch + gap);
    const ts = toneStyle(q, idx);
    const isFocus = q.highlight || (idx === 0 && !list.some((it) => it.highlight));
    elements.push({ type: 'shape', id: `${id}-qcard-${idx + 1}`, bounds: [cx, cy, cw, ch], style: { fill: ts.fill, stroke: isFocus ? ts.bar : ts.border, strokeWidth: isFocus ? 2 : 1.5, radius: rad } });
    elements.push({ type: 'shape', id: `${id}-qtrim-${idx + 1}`, bounds: [cx + 20, cy, cw - 40, 4], style: { fill: ts.bar, radius: 2 } });
    renderQuadContent(elements, q, idx, cx, cy, cw, ch, false);
  });

  return { elements, height: h };
}

// Diagnosis Trio (Issue -> Root Cause -> Solution) with 3 visual styles:
//   - 'trio'      (default): horizontal 3-card diagnostic flow with semantic top bars & arrow connectors
//   - 'spotlight' (focus last): first N-1 light micro-border cards + final high-contrast solid primary card
//   - 'stacked'   (horizontal rows): stacked wide strips for dense diagnostic narratives
export function diagnosisTrio({ id, x, y, width, height, title = '', items = [], theme, variant = 'trio' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 4);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const errCol = p.dark ? '#FB7185' : '#DC2626';
  const errBg = p.dark ? '#321820' : '#FEF2F2';
  const warnCol = r.pop;
  const warnBg = p.dark ? '#331E12' : '#FFF7ED';
  const okCol = p.dark ? '#34D399' : '#059669';
  const okBg = p.dark ? '#11302B' : '#ECFDF5';
  const defaultTags = ['01 现状问题', '02 根因定位', '03 优化解法', '04 预期成效'];

  const resolveTone = (it, idx) => {
    const tone = it.tone || (idx === 0 ? 'err' : idx === 1 ? 'warn' : idx === list.length - 1 ? 'primary' : 'ok');
    if (tone === 'err') return { bar: errCol, bg: errBg, fg: errCol };
    if (tone === 'warn' || tone === 'pop') return { bar: warnCol, bg: warnBg, fg: warnCol };
    if (tone === 'ok') return { bar: okCol, bg: okBg, fg: okCol };
    return { bar: r.primary, bg: p.pale || '#EEF2FF', fg: readableInk(r.primary, p.pale || '#EEF2FF') };
  };

  const pad = isCompact ? 16 : 22;
  const headH = title ? (isCompact ? 38 : 44) : 0;

  if (variant === 'stacked') {
    const rowGap = isCompact ? 18 : 22;
    const minRowH = isCompact ? 86 : 104;
    const natural = pad * 2 + headH + list.length * minRowH + (list.length - 1) * rowGap;
    const h = Math.max(natural, height || 0);
    const bodyH = h - pad * 2 - headH;
    const rowH = Math.floor((bodyH - rowGap * (list.length - 1)) / list.length);
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'diagnosisTrio', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, width - pad * 2, 32], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      curY += headH;
    }
    const iw = width - pad * 2;
    const leftW = Math.min(360, Math.round(iw * 0.28));
    list.forEach((it, idx) => {
      const ry = curY + idx * (rowH + rowGap);
      const ts = resolveTone(it, idx);
      const isLast = idx === list.length - 1;
      elements.push({ type: 'shape', id: `${id}-card-${idx + 1}`, bounds: [x + pad, ry, iw, rowH], style: { fill: isLast ? (p.pale || '#EEF2FF') : subBg, stroke: isLast ? r.primary : (p.line || '#E2E6EE'), strokeWidth: isLast ? 2 : 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-bar-${idx + 1}`, bounds: [x + pad, ry + 14, 6, Math.max(24, rowH - 28)], style: { fill: ts.bar, radius: 3 } });
      const tag = it.tag || defaultTags[idx] || `0${idx + 1}`;
      const tagW = Math.min(leftW - 24, Math.max(96, Math.ceil(textWidth(tag, 14) * 1.18) + 24));
      elements.push({ type: 'shape', id: `${id}-tag-bg-${idx + 1}`, bounds: [x + pad + 22, ry + 14, tagW, 26], style: { fill: ts.bg, radius: 13 } });
      elements.push(textElement({ id: `${id}-tag-tx-${idx + 1}`, text: tag, bounds: [x + pad + 28, ry + 17, tagW - 12, 20], style: theme.font(14, { fontWeight: 700, color: ts.fg, textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-t-${idx + 1}`, text: it.title || '', bounds: [x + pad + 22, ry + 48, leftW - 28, Math.max(28, rowH - 56)], style: theme.font(isCompact ? 19 : 21, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      const detText = it.detail || (Array.isArray(it.points) ? it.points.join('；') : '');
      const metW = it.metric ? 180 : 0;
      elements.push(textElement({ id: `${id}-d-${idx + 1}`, text: detText, bounds: [x + pad + leftW + 14, ry + Math.max(14, Math.round((rowH - 56) / 2)), iw - leftW - metW - 36, Math.max(40, rowH - 26)], style: theme.font(isCompact ? 18 : 20, { fontWeight: 300, color: muted, lineHeight: 1.4 }) }));
      if (it.metric) {
        elements.push({ type: 'shape', id: `${id}-met-bg-${idx + 1}`, bounds: [x + pad + iw - metW - 14, ry + Math.round((rowH - 34) / 2), metW, 34], style: { fill: surf, stroke: ts.bar, strokeWidth: 1.5, radius: 17 } });
        elements.push(textElement({ id: `${id}-met-tx-${idx + 1}`, text: String(it.metric), bounds: [x + pad + iw - metW - 8, ry + Math.round((rowH - 22) / 2), metW - 12, 22], style: theme.font(15, { fontWeight: 700, color: ts.fg, textAlign: 'center', lineHeight: 1.2 }) }));
      }
      if (idx < list.length - 1) {
        const ax = x + Math.round(width / 2);
        elements.push({ ...lineElement({ id: `${id}-arr-${idx + 1}`, from: [ax, ry + rowH + 2], to: [ax, ry + rowH + rowGap - 2], style: { stroke: p.line || '#CBD5E1', strokeWidth: 2.5 } }), endArrow: true });
      }
    });
    return { elements, height: h };
  }

  const arrowGap = 36;
  const natural = isCompact ? 330 : 430;
  const h = Math.max(natural, height || 0);
  const bodyTop = y + headH;
  const cardH = h - headH;
  const cw = Math.floor((width - arrowGap * (list.length - 1)) / list.length);
  const elements = [];
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x, y + 4, width, 32], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, p.bg || surf), lineHeight: 1.25 }) }));
  }
  list.forEach((it, idx) => {
    const cx = x + idx * (cw + arrowGap);
    const ts = resolveTone(it, idx);
    const isSpot = variant === 'spotlight' && idx === list.length - 1;
    const isLast = idx === list.length - 1;
    elements.push({
      type: 'shape', id: `${id}-card-${idx + 1}`, ...(idx === 0 ? { component: 'diagnosisTrio' } : {}),
      bounds: [cx, bodyTop, cw, cardH],
      style: isSpot
        ? { fill: r.primary, radius: rad }
        : { fill: surf, stroke: isLast ? r.primary : (p.line || '#E2E6EE'), strokeWidth: isLast ? 2 : 1.5, radius: rad },
    });
    elements.push({ type: 'shape', id: `${id}-trim-${idx + 1}`, bounds: [cx + 22, bodyTop, cw - 44, 5], style: { fill: isSpot ? r.pop : ts.bar, radius: 3 } });

    const cPad = isCompact ? 20 : 24;
    const tag = it.tag || defaultTags[idx] || `0${idx + 1}`;
    const tagW = Math.min(cw - cPad * 2, Math.max(108, Math.ceil(textWidth(tag, 15) * 1.18) + 26));
    elements.push({ type: 'shape', id: `${id}-tag-bg-${idx + 1}`, bounds: [cx + cPad, bodyTop + 22, tagW, 30], style: { fill: isSpot ? r.pop : ts.bg, radius: 15 } });
    elements.push(textElement({ id: `${id}-tag-tx-${idx + 1}`, text: tag, bounds: [cx + cPad + 8, bodyTop + 26, tagW - 16, 22], style: theme.font(15, { fontWeight: 700, color: isSpot ? '#FFFFFF' : ts.fg, textAlign: 'center', lineHeight: 1.2 }) }));

    const titleY = bodyTop + 68;
    const titleH = 62;
    elements.push(textElement({ id: `${id}-t-${idx + 1}`, text: it.title || '', bounds: [cx + cPad, titleY, cw - cPad * 2, titleH], style: theme.font(isCompact ? 22 : 25, { fontWeight: 700, color: isSpot ? (p.inverse || '#FFFFFF') : p.ink, lineHeight: 1.25 }) }));

    const metH = it.metric ? 44 : 0;
    const detY = titleY + titleH + 6;
    const detH = Math.max(50, bodyTop + cardH - detY - metH - 20);
    const detText = it.detail || (Array.isArray(it.points) ? it.points.map((pt) => `• ${pt}`).join('\n') : '');
    elements.push(textElement({ id: `${id}-d-${idx + 1}`, text: detText, bounds: [cx + cPad, detY, cw - cPad * 2, detH], style: theme.font(isCompact ? 18 : 21, { fontWeight: 300, color: isSpot ? (p.inverse || '#FFFFFF') : muted, lineHeight: 1.45 }) }));

    if (it.metric) {
      const mY = bodyTop + cardH - 52;
      elements.push({ type: 'shape', id: `${id}-met-bg-${idx + 1}`, bounds: [cx + cPad, mY, cw - cPad * 2, 34], style: { fill: isSpot ? mixHexLocal(r.primary, '#FFFFFF', 0.16) : subBg, stroke: isSpot ? null : (p.line || '#E2E6EE'), strokeWidth: isSpot ? 0 : 1, radius: 10 } });
      elements.push(textElement({ id: `${id}-met-tx-${idx + 1}`, text: String(it.metric), bounds: [cx + cPad + 12, mY + 6, cw - cPad * 2 - 24, 22], style: theme.font(15, { fontWeight: 700, color: isSpot ? '#FFFFFF' : ts.fg, lineHeight: 1.2 }) }));
    }

    if (idx < list.length - 1) {
      const midY = bodyTop + Math.round(cardH / 2);
      elements.push({ ...lineElement({ id: `${id}-arr-${idx + 1}`, from: [cx + cw + 4, midY], to: [cx + cw + arrowGap - 4, midY], style: { stroke: idx === list.length - 2 ? r.pop : r.primary, strokeWidth: 2.5 } }), endArrow: true });
    }
  });

  return { elements, height: h };
}

// Tremor Multi-Period Tracker (12-month / multi-cycle SLA & target tracking) with 3 visual styles:
//   - 'blocks'  (default): classic Tremor rounded status blocks row + summary pill + legend + anomaly notes
//   - 'bars'    (metric bars): proportional vertical bars with baseline reference rule
//   - 'compact' (grid tiles): 2-row micro-card grid showing each period's status & value
export function periodTracker({ id, x, y, width, height, title = '', summary = '', badge = '', legend = {}, items = [], theme, variant = 'blocks' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 18);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#10B981';
  const okBg = p.dark ? '#11302B' : '#ECFDF5';
  const warnCol = r.pop;
  const missCol = p.dark ? '#FB7185' : '#EF4444';
  const pendCol = p.dark ? '#334155' : '#CBD5E1';

  const statusMeta = (st) => {
    const s = String(st || 'ok').toLowerCase();
    if (s === 'miss' || s === 'err' || s === 'fail' || s === '未达标') return { col: missCol, mark: '✕', key: 'miss' };
    if (s === 'warn' || s === 'risk' || s === '预警' || s === '接近') return { col: warnCol, mark: '!', key: 'warn' };
    if (s === 'pending' || s === 'todo' || s === '待开始') return { col: pendCol, mark: '·', key: 'pending' };
    return { col: okCol, mark: '✓', key: 'ok' };
  };

  const counts = { ok: 0, warn: 0, miss: 0, pending: 0 };
  list.forEach((it) => { counts[statusMeta(it.status).key]++; });
  const activeTotal = Math.max(1, list.length - counts.pending);
  const autoBadge = badge || `达标 ${counts.ok}/${activeTotal}`;
  const pad = isCompact ? 18 : 26;
  const iw = width - pad * 2;

  if (variant === 'compact') {
    const cols = list.length <= 6 ? list.length : Math.ceil(list.length / 2);
    const rowsN = Math.ceil(list.length / cols);
    const headH = 44, cGap = 12, rGap = 12, tileH = isCompact ? 76 : 88;
    const natural = pad * 2 + headH + rowsN * tileH + (rowsN - 1) * rGap + 8;
    const h = Math.max(natural, height || 0);
    const topOff = Math.round((h - natural) / 2);
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'periodTracker', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad + topOff;
    elements.push(textElement({ id: `${id}-title`, text: title || '周期达标追踪', bounds: [x + pad, curY + 4, iw - 240, 30], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    const bdgW = Math.min(220, Math.max(108, Math.ceil(textWidth(autoBadge, 14) * 1.2) + 26));
    elements.push({ type: 'shape', id: `${id}-bdg-bg`, bounds: [x + width - pad - bdgW, curY + 4, bdgW, 28], style: { fill: okBg, radius: 14 } });
    elements.push(textElement({ id: `${id}-bdg-tx`, text: autoBadge, bounds: [x + width - pad - bdgW + 8, curY + 8, bdgW - 16, 20], style: theme.font(14, { fontWeight: 700, color: okCol, textAlign: 'center', lineHeight: 1.2 }) }));
    curY += headH + 8;

    const cw = Math.floor((iw - cGap * (cols - 1)) / cols);
    list.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = x + pad + col * (cw + cGap);
      const cy = curY + row * (tileH + rGap);
      const sm = statusMeta(it.status);
      elements.push({ type: 'shape', id: `${id}-tile-${i + 1}`, bounds: [cx, cy, cw, tileH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 12 } });
      elements.push({ type: 'shape', id: `${id}-bar-${i + 1}`, bounds: [cx, cy + 12, 5, tileH - 24], style: { fill: sm.col, radius: 3 } });
      elements.push({ type: 'shape', id: `${id}-dot-${i + 1}`, bounds: [cx + cw - 22, cy + 14, 10, 10], style: { fill: sm.col, radius: 5 }, shape: 'ellipse' });
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [cx + 14, cy + 10, cw - 40, 24], style: theme.font(16, { fontWeight: 600, color: p.ink, lineHeight: 1.2 }) }));
      const valTxt = it.value != null ? String(it.value) : (sm.key === 'ok' ? '达标' : sm.key === 'warn' ? '预警' : sm.key === 'miss' ? '未达标' : '待启动');
      elements.push(textElement({ id: `${id}-val-${i + 1}`, text: valTxt, bounds: [cx + 14, cy + 38, cw - 24, 30], style: theme.font(cw < 140 ? 18 : 22, { fontWeight: 900, color: sm.key === 'pending' ? muted : sm.col, lineHeight: 1.2 }) }));
    });
    return { elements, height: h };
  }

  const notes = list.filter((it) => it.note).slice(0, 3);
  const headH = summary ? 58 : 42;
  const noteH = notes.length ? 46 : 0;
  const chartH = variant === 'bars' ? (isCompact ? 132 : 164) : (isCompact ? 96 : 114);
  const natural = pad * 2 + headH + 16 + chartH + (noteH ? 16 + noteH : 0);
  const h = Math.max(natural, height || 0);
  const topOff = Math.round((h - natural) / 2);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'periodTracker', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];

  let curY = y + pad + topOff;
  elements.push(textElement({ id: `${id}-title`, text: title || '周期达标追踪', bounds: [x + pad, curY, iw - 420, 30], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
  if (summary) {
    elements.push(textElement({ id: `${id}-sum`, text: summary, bounds: [x + pad, curY + 32, iw - 420, 24], style: theme.font(17, { fontWeight: 300, color: muted, lineHeight: 1.25 }) }));
  }

  // Right status pill + inline legend
  const bdgW = Math.min(200, Math.max(108, Math.ceil(textWidth(autoBadge, 14) * 1.2) + 24));
  elements.push({ type: 'shape', id: `${id}-bdg-bg`, bounds: [x + width - pad - bdgW, curY + 2, bdgW, 28], style: { fill: okBg, radius: 14 } });
  elements.push(textElement({ id: `${id}-bdg-tx`, text: autoBadge, bounds: [x + width - pad - bdgW + 6, curY + 6, bdgW - 12, 20], style: theme.font(14, { fontWeight: 700, color: okCol, textAlign: 'center', lineHeight: 1.2 }) }));

  const legItems = [
    { col: okCol, label: legend.ok || '达标' },
    { col: warnCol, label: legend.warn || '预警' },
    { col: missCol, label: legend.miss || '未达标' },
  ];
  let lx = x + width - pad - bdgW - 18;
  for (let li = legItems.length - 1; li >= 0; li--) {
    const lw = Math.ceil(textWidth(legItems[li].label, 14) * 1.15) + 18;
    lx -= lw;
    elements.push({ type: 'shape', id: `${id}-lgd-${li + 1}`, bounds: [lx, curY + 11, 10, 10], style: { fill: legItems[li].col, radius: 3 } });
    elements.push(textElement({ id: `${id}-lgt-${li + 1}`, text: legItems[li].label, bounds: [lx + 14, curY + 6, lw - 14, 20], style: theme.font(14, { fontWeight: 400, color: muted, lineHeight: 1.2 }) }));
    lx -= 12;
  }

  curY += headH + 16;
  const gap = list.length >= 12 ? 10 : 14;
  const bw = Math.floor((iw - gap * (list.length - 1)) / list.length);
  const startX = x + pad + Math.round((iw - (bw * list.length + gap * (list.length - 1))) / 2);

  if (variant === 'bars') {
    const nums = list.map((it) => {
      const m = String(it.value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
      return m ? Number(m[0]) : (statusMeta(it.status).key === 'ok' ? 100 : statusMeta(it.status).key === 'warn' ? 78 : statusMeta(it.status).key === 'miss' ? 52 : 30);
    });
    const maxV = Math.max(...nums, 100);
    const barAreaH = chartH - 54;
    const baseY = curY + 24 + barAreaH;
    elements.push(lineElement({ id: `${id}-baseline`, from: [x + pad, baseY], to: [x + width - pad, baseY], style: { stroke: p.line || '#CBD5E1', strokeWidth: 1.5, strokeDash: 'dash' } }));
    list.forEach((it, i) => {
      const bx = startX + i * (bw + gap);
      const sm = statusMeta(it.status);
      const bh = Math.max(18, Math.round((nums[i] / maxV) * barAreaH));
      const by = baseY - bh;
      elements.push({ type: 'shape', id: `${id}-seg-${i + 1}`, bounds: [bx, by, bw, bh], style: { fill: sm.col, radius: Math.min(10, Math.floor(bw / 3)) } });
      if (it.value != null) {
        elements.push(textElement({ id: `${id}-val-${i + 1}`, text: String(it.value), bounds: [bx - 4, by - 22, bw + 8, 20], style: theme.font(bw < 72 ? 13 : 15, { fontWeight: 700, color: sm.key === 'pending' ? muted : p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
      }
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [bx - 4, baseY + 8, bw + 8, 22], style: theme.font(bw < 72 ? 14 : 16, { fontWeight: 500, color: muted, textAlign: 'center', lineHeight: 1.2 }) }));
    });
  } else {
    const blockH = isCompact ? 54 : 64;
    list.forEach((it, i) => {
      const bx = startX + i * (bw + gap);
      const sm = statusMeta(it.status);
      elements.push({ type: 'shape', id: `${id}-seg-${i + 1}`, bounds: [bx, curY, bw, blockH], style: { fill: sm.col, radius: Math.min(12, Math.floor(bw / 3)) } });
      if (bw >= 34) {
        elements.push(textElement({ id: `${id}-mk-${i + 1}`, text: sm.mark, bounds: [bx, curY + Math.round((blockH - 22) / 2), bw, 22], style: theme.font(17, { fontWeight: 900, color: sm.key === 'pending' ? muted : '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      }
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [bx - 4, curY + blockH + 8, bw + 8, 22], style: theme.font(bw < 72 ? 14 : 16, { fontWeight: 600, color: p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
      if (it.value != null) {
        elements.push(textElement({ id: `${id}-val-${i + 1}`, text: String(it.value), bounds: [bx - 4, curY + blockH + 29, bw + 8, 20], style: theme.font(bw < 72 ? 12 : 14, { fontWeight: 300, color: muted, textAlign: 'center', lineHeight: 1.2 }) }));
      }
    });
  }

  if (notes.length) {
    const ny = curY + chartH + 14;
    elements.push({ type: 'shape', id: `${id}-notes-bg`, bounds: [x + pad, ny, iw, noteH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 10 } });
    const noteText = notes.map((n) => `${n.label}：${n.note}`).join('   |   ');
    elements.push(textElement({ id: `${id}-notes-tx`, text: `波动摘录  ·  ${noteText}`, bounds: [x + pad + 16, ny + 12, iw - 32, 24], style: theme.font(16, { fontWeight: 300, color: muted, lineHeight: 1.25 }) }));
  }

  return { elements, height: h };
}

// SaaS Feature Comparison Matrix with 3 visual styles:
//   - 'matrix'  (default): clean SaaS comparison grid with highlighted recommended column & semantic check badges
//   - 'cards'   (plan cards): each column rendered as a standalone vertical plan card side-by-side
//   - 'compact' (dense matrix): tight row height for 7-10 feature rows
export function featureMatrixCard({ id, x, y, width, height, title = '', columns = [], rows = [], theme, variant = 'matrix' }) {
  const p = theme.palette, r = colorRoles(p);
  const cols = (Array.isArray(columns) ? columns : []).slice(0, 5).map((c) => (typeof c === 'string' ? { name: c } : (c || {})));
  const rList = (Array.isArray(rows) ? rows : []).slice(0, 10).map((row) => (Array.isArray(row) ? { feature: row[0], values: row.slice(1) } : (row || {})));
  if (!cols.length || !rList.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact) || variant === 'compact';
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#059669';
  const okBg = p.dark ? '#11302B' : '#ECFDF5';
  const warnCol = r.pop;
  const warnBg = p.dark ? '#331E12' : '#FFF7ED';
  const hiBg = p.dark ? mixHexLocal(surf, r.primary, 0.22) : (p.pale || '#EEF2FF');

  const classifyCell = (val) => {
    if (val === true || val === '✓' || val === '是' || val === '支持') return { kind: 'yes', text: '✓' };
    if (val === false || val === '✕' || val === '否' || val === '不支持' || val === '无' || val === '-' || val === '—') return { kind: 'no', text: '—' };
    if (val === 'partial' || val === '部分' || val === '◐') return { kind: 'partial', text: '◐' };
    return { kind: 'text', text: String(val ?? '') };
  };

  if (variant === 'cards') {
    const headH = title ? 40 : 0;
    const gap = 18;
    const cw = Math.floor((width - gap * (cols.length - 1)) / cols.length);
    const rowH = Math.max(36, Math.min(54, Math.floor(((height || 440) - headH - 96) / Math.max(1, rList.length))));
    const cardH = Math.max(88 + rList.length * rowH + 16, (height || 0) - headH);
    const h = headH + cardH;
    const elements = [];
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x, y + 4, width, 30], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, p.bg || surf), lineHeight: 1.25 }) }));
    }
    cols.forEach((col, ci) => {
      const cx = x + ci * (cw + gap);
      const cy = y + headH;
      const hi = Boolean(col.highlight);
      elements.push({ type: 'shape', id: `${id}-col-${ci + 1}`, ...(ci === 0 ? { component: 'featureMatrix' } : {}), bounds: [cx, cy, cw, cardH], style: { fill: hi ? hiBg : surf, stroke: hi ? r.primary : (p.line || '#E2E6EE'), strokeWidth: hi ? 2.5 : 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-ctrim-${ci + 1}`, bounds: [cx + 18, cy, cw - 36, 5], style: { fill: hi ? r.pop : (p.line || '#CBD5E1'), radius: 3 } });
      elements.push(textElement({ id: `${id}-ch-${ci + 1}`, text: col.name || '', bounds: [cx + 20, cy + 20, cw - 40, 30], style: theme.font(21, { fontWeight: 700, color: hi ? readableInk(r.primary, hiBg) : p.ink, lineHeight: 1.25 }) }));
      if (col.badge) {
        const bdgW = Math.min(cw - 40, Math.max(76, Math.ceil(textWidth(col.badge, 13) * 1.2) + 22));
        elements.push({ type: 'shape', id: `${id}-cbg-${ci + 1}`, bounds: [cx + cw - 20 - bdgW, cy + 21, bdgW, 24], style: { fill: hi ? r.pop : subBg, radius: 12 } });
        elements.push(textElement({ id: `${id}-ctx-${ci + 1}`, text: col.badge, bounds: [cx + cw - 20 - bdgW + 6, cy + 24, bdgW - 12, 18], style: theme.font(13, { fontWeight: 700, color: hi ? '#FFFFFF' : muted, textAlign: 'center', lineHeight: 1.2 }) }));
      }
      elements.push(lineElement({ id: `${id}-cdiv-${ci + 1}`, from: [cx + 20, cy + 64], to: [cx + cw - 20, cy + 64], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1 } }));
      rList.forEach((row, ri) => {
        const ry = cy + 74 + ri * rowH;
        const cell = classifyCell((row.values || [])[ci]);
        const iconSz = 22;
        const iy = ry + Math.round((rowH - iconSz) / 2);
        if (cell.kind === 'yes' || cell.kind === 'partial') {
          elements.push({ type: 'shape', id: `${id}-ic-${ci + 1}-${ri + 1}`, bounds: [cx + 20, iy, iconSz, iconSz], style: { fill: cell.kind === 'yes' ? okBg : warnBg, radius: 11 }, shape: 'ellipse' });
          elements.push(textElement({ id: `${id}-it-${ci + 1}-${ri + 1}`, text: cell.text, bounds: [cx + 20, iy + 2, iconSz, 18], style: theme.font(13, { fontWeight: 900, color: cell.kind === 'yes' ? okCol : warnCol, textAlign: 'center', lineHeight: 1.2 }) }));
        } else if (cell.kind === 'no') {
          elements.push(textElement({ id: `${id}-it-${ci + 1}-${ri + 1}`, text: '—', bounds: [cx + 20, iy + 1, iconSz, 20], style: theme.font(16, { fontWeight: 400, color: muted, textAlign: 'center', lineHeight: 1.2 }) }));
        } else {
          elements.push({ type: 'shape', id: `${id}-ic-${ci + 1}-${ri + 1}`, bounds: [cx + 27, iy + 7, 8, 8], style: { fill: hi ? r.primary : muted, radius: 4 }, shape: 'ellipse' });
        }
        const labelTxt = cell.kind === 'text' ? `${row.feature}：${cell.text}` : String(row.feature || '');
        elements.push(textElement({ id: `${id}-rf-${ci + 1}-${ri + 1}`, text: labelTxt, bounds: [cx + 50, ry + Math.round((rowH - 24) / 2), cw - 68, 26], style: theme.font(17, { fontWeight: cell.kind === 'no' ? 300 : (hi ? 500 : 400), color: cell.kind === 'no' ? muted : p.ink, lineHeight: 1.25 }) }));
      });
    });
    return { elements, height: h };
  }

  const pad = isCompact ? 16 : 24;
  const titleH = title ? (isCompact ? 36 : 44) : 0;
  const headH = isCompact ? 60 : 76;
  const rowH = isCompact ? 44 : 58;
  const natural = pad * 2 + titleH + headH + rList.length * rowH + 8;
  const h = Math.max(natural, height || 0);
  const actualRowH = Math.floor((h - pad * 2 - titleH - headH - 6) / rList.length);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'featureMatrix', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];

  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, width - pad * 2, 30], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    curY += titleH;
  }

  const iw = width - pad * 2;
  const featW = Math.round(iw * (cols.length >= 4 ? 0.28 : 0.34));
  const colW = Math.floor((iw - featW) / cols.length);
  const tableTop = curY;
  const tableH = headH + rList.length * actualRowH;

  // Highlighted column backdrop & frame (drawn first so rows sit cleanly on top)
  cols.forEach((col, ci) => {
    if (!col.highlight) return;
    const cx = x + pad + featW + ci * colW;
    elements.push({ type: 'shape', id: `${id}-hi-bg-${ci + 1}`, bounds: [cx + 2, tableTop, colW - 4, tableH], style: { fill: hiBg, stroke: r.primary, strokeWidth: 2, radius: 12 } });
    elements.push({ type: 'shape', id: `${id}-hi-trim-${ci + 1}`, bounds: [cx + 16, tableTop, colW - 32, 5], style: { fill: r.pop, radius: 3 } });
  });

  // Header labels
  elements.push(textElement({ id: `${id}-fh`, text: '能力维度', bounds: [x + pad + 14, tableTop + Math.round((headH - 24) / 2), featW - 24, 24], style: theme.font(17, { fontWeight: 700, color: muted, lineHeight: 1.2 }) }));
  cols.forEach((col, ci) => {
    const cx = x + pad + featW + ci * colW;
    const hi = Boolean(col.highlight);
    const hasBadge = Boolean(col.badge);
    if (hasBadge) {
      const bdgW = Math.min(colW - 24, Math.max(78, Math.ceil(textWidth(col.badge, 12) * 1.2) + 22));
      elements.push({ type: 'shape', id: `${id}-cbg-${ci + 1}`, bounds: [cx + Math.round((colW - bdgW) / 2), tableTop + 14, bdgW, 22], style: { fill: hi ? r.pop : subBg, radius: 11 } });
      elements.push(textElement({ id: `${id}-ctx-${ci + 1}`, text: col.badge, bounds: [cx + Math.round((colW - bdgW) / 2) + 4, tableTop + 17, bdgW - 8, 16], style: theme.font(12, { fontWeight: 700, color: hi ? '#FFFFFF' : muted, textAlign: 'center', lineHeight: 1.2 }) }));
    }
    elements.push(textElement({ id: `${id}-ch-${ci + 1}`, text: col.name || '', bounds: [cx + 8, tableTop + (hasBadge ? 42 : Math.round((headH - 26) / 2)), colW - 16, 26], style: theme.font(isCompact ? 18 : 20, { fontWeight: 700, color: hi ? readableInk(r.primary, hiBg) : p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
  });
  elements.push(lineElement({ id: `${id}-hdiv`, from: [x + pad, tableTop + headH], to: [x + pad + iw, tableTop + headH], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1.5 } }));

  // Feature rows
  rList.forEach((row, ri) => {
    const ry = tableTop + headH + ri * actualRowH;
    if (ri % 2 === 1) {
      elements.push({ type: 'shape', id: `${id}-rbg-${ri + 1}`, bounds: [x + pad, ry + 1, featW, actualRowH - 2], style: { fill: subBg, radius: 6 } });
    }
    if (ri > 0) {
      elements.push(lineElement({ id: `${id}-rdiv-${ri + 1}`, from: [x + pad, ry], to: [x + pad + iw, ry], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1 } }));
    }
    elements.push(textElement({ id: `${id}-rf-${ri + 1}`, text: String(row.feature || ''), bounds: [x + pad + 14, ry + Math.round((actualRowH - 24) / 2), featW - 24, 26], style: theme.font(isCompact ? 17 : 19, { fontWeight: 600, color: p.ink, lineHeight: 1.25 }) }));
    cols.forEach((col, ci) => {
      const cx = x + pad + featW + ci * colW;
      const hi = Boolean(col.highlight);
      const cell = classifyCell((row.values || [])[ci]);
      const midX = cx + Math.round(colW / 2);
      const midY = ry + Math.round(actualRowH / 2);
      if (cell.kind === 'yes') {
        const sz = 26;
        elements.push({ type: 'shape', id: `${id}-c-${ri + 1}-${ci + 1}`, bounds: [midX - 13, midY - 13, sz, sz], style: { fill: hi ? r.primary : okBg, radius: 13 }, shape: 'ellipse' });
        elements.push(textElement({ id: `${id}-ct-${ri + 1}-${ci + 1}`, text: '✓', bounds: [midX - 13, midY - 10, sz, 20], style: theme.font(15, { fontWeight: 900, color: hi ? '#FFFFFF' : okCol, textAlign: 'center', lineHeight: 1.2 }) }));
      } else if (cell.kind === 'partial') {
        const sz = 26;
        elements.push({ type: 'shape', id: `${id}-c-${ri + 1}-${ci + 1}`, bounds: [midX - 13, midY - 13, sz, sz], style: { fill: warnBg, radius: 13 }, shape: 'ellipse' });
        elements.push(textElement({ id: `${id}-ct-${ri + 1}-${ci + 1}`, text: '◐', bounds: [midX - 13, midY - 10, sz, 20], style: theme.font(15, { fontWeight: 900, color: warnCol, textAlign: 'center', lineHeight: 1.2 }) }));
      } else if (cell.kind === 'no') {
        elements.push(textElement({ id: `${id}-ct-${ri + 1}-${ci + 1}`, text: '—', bounds: [cx + 8, midY - 11, colW - 16, 22], style: theme.font(18, { fontWeight: 300, color: muted, textAlign: 'center', lineHeight: 1.2 }) }));
      } else {
        elements.push(textElement({ id: `${id}-ct-${ri + 1}-${ci + 1}`, text: cell.text, bounds: [cx + 10, midY - 12, colW - 20, 24], style: theme.font(isCompact ? 16 : 18, { fontWeight: hi ? 700 : 300, color: hi ? readableInk(r.primary, hiBg) : muted, textAlign: 'center', lineHeight: 1.25 }) }));
      }
    });
  });

  return { elements, height: h };
}

function mixHexLocal(a, b, t) {
  const parse = (hex) => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const ra = parse(a), rb = parse(b);
  if (!ra || !rb) return a || '#EEF2FF';
  return '#' + [0, 1, 2].map((i) => Math.max(0, Math.min(255, Math.round(ra[i] + (rb[i] - ra[i]) * t))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// =========================================================================
// Card Density & Proportion Engine (Anti-Empty-Box Core Utilities)
// =========================================================================
function fitCardHeight(contentH, availH, { maxStretch = 1.35, minH = 92, stretchToFill = false } = {}) {
  const base = Math.max(minH, Math.ceil(contentH));
  if (!availH || availH <= 0) return base;
  if (stretchToFill) return Math.max(base, Math.round(availH));
  return Math.min(Math.round(availH), Math.max(base, Math.round(base * maxStretch)));
}

function extractCardMetric(text, explicitMetric = '') {
  if (explicitMetric) return String(explicitMetric).trim();
  const s = String(text || '');
  const m = s.match(/[+\-]?\d+(?:\.\d+)?\s*(?:%|pp|倍|×|万|亿|套|天|个月|项|城|家|小时|分钟)/);
  return m ? m[0].replace(/\s+/g, '') : '';
}

function adaptiveBodyFont(text, isCompact = false, base = 20) {
  if (isCompact) return Math.max(16, base - 3);
  const len = String(text || '').length;
  if (len <= 34) return Math.min(22, base + 1);
  if (len <= 68) return base;
  return Math.max(17, base - 2);
}

// =========================================================================
// Modern Web UI Batch 3 (Final Backlog Clear):
//   - radialGauges (Donut / Radial Ring)
//   - pyramidStack (Layered Pyramid / Stack)
//   - modernGantt  (Multi-Lane Gantt / Kanban Columns)
//   - quoteCards   (Quote / Testimonial / Owner Pills)
// =========================================================================

// Radial / Donut Progress Gauges (100% Native PPTX ellipses & arc chord lines) with 3 styles:
//   - 'ring'   (default): smooth segmented circular progress ring + big 900% readout + bottom value/target
//   - 'radial' (tick gauge): 24-tick Apple Watch style radial dial around center readout
//   - 'row'    (horizontal cards): left compact ring + right title, value & target pill
export function radialGauges({ id, x, y, width, height, title = '', items = [], theme, variant = 'ring' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 4);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const trackCol = p.dark ? '#233554' : '#E2E8F0';
  const okCol = p.dark ? '#34D399' : '#10B981';

  const pickColor = (it, idx) => {
    if (it.tone === 'pop') return r.pop;
    if (it.tone === 'ok') return okCol;
    if (it.tone === 'secondary') return r.secondary;
    if (it.highlight || idx === 0) return r.primary;
    return [r.primary, r.pop, okCol, r.secondary][idx % 4];
  };

  const drawRingArc = (elements, prefix, cx, cy, radius, pctVal, col, mode = 'ring') => {
    const clamped = Math.max(0, Math.min(100, Number(pctVal) || 0));
    if (mode === 'radial') {
      const ticks = 28;
      const lit = Math.round((clamped / 100) * ticks);
      for (let t = 0; t < ticks; t++) {
        const ang = (-90 + (t * 360) / ticks) * (Math.PI / 180);
        const rIn = radius - 14, rOut = radius;
        const x1 = Math.round(cx + rIn * Math.cos(ang)), y1 = Math.round(cy + rIn * Math.sin(ang));
        const x2 = Math.round(cx + rOut * Math.cos(ang)), y2 = Math.round(cy + rOut * Math.sin(ang));
        elements.push(lineElement({ id: `${prefix}-tk-${t + 1}`, from: [x1, y1], to: [x2, y2], style: { stroke: t < lit ? col : trackCol, strokeWidth: 4.5 } }));
      }
      return;
    }
    const sw = Math.max(10, Math.min(16, Math.round(radius * 0.17)));
    const padS = Math.ceil(sw / 2) + 4;
    const boxSz = (radius + padS) * 2;
    const c = radius + padS;
    const bx = Math.round(cx - c), by = Math.round(cy - c);
    // Smooth full circular track via SVG vector path (zero jagged segments, crisp on all zoom levels)
    const fullCirclePath = `M ${c} ${c - radius} A ${radius} ${radius} 0 1 1 ${c} ${c + radius} A ${radius} ${radius} 0 1 1 ${c} ${c - radius}`;
    elements.push({
      type: 'vector', id: `${prefix}-trk`, shape: 'ellipse',
      bounds: [bx, by, boxSz, boxSz],
      viewBox: [0, 0, boxSz, boxSz],
      path: fullCirclePath,
      style: { fill: 'none', stroke: trackCol, strokeWidth: sw, strokeLinecap: 'round' },
    });
    if (clamped <= 0) return;
    let arcPath;
    if (clamped >= 99.5) {
      arcPath = fullCirclePath;
    } else {
      const deg = (clamped / 100) * 360;
      const radEnd = (-90 + deg) * (Math.PI / 180);
      const ex = (c + radius * Math.cos(radEnd)).toFixed(2);
      const ey = (c + radius * Math.sin(radEnd)).toFixed(2);
      const largeArc = deg > 180 ? 1 : 0;
      arcPath = `M ${c} ${c - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`;
    }
    elements.push({
      type: 'vector', id: `${prefix}-arc`, shape: 'ellipse',
      bounds: [bx, by, boxSz, boxSz],
      viewBox: [0, 0, boxSz, boxSz],
      path: arcPath,
      style: { fill: 'none', stroke: col, strokeWidth: sw, strokeLinecap: 'round' },
    });
  };

  const headH = title ? (isCompact ? 38 : 44) : 0;
  const elements = [];
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x, y + 4, width, 32], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, p.bg || surf), lineHeight: 1.25 }) }));
  }

  if (variant === 'row') {
    const rowGap = 16;
    const minRowH = isCompact ? 116 : 138;
    const natural = headH + list.length * minRowH + (list.length - 1) * rowGap;
    const h = Math.max(natural, height || 0);
    const rowH = Math.floor((h - headH - rowGap * (list.length - 1)) / list.length);
    list.forEach((it, idx) => {
      const ry = y + headH + idx * (rowH + rowGap);
      const col = pickColor(it, idx);
      const hi = Boolean(it.highlight);
      elements.push({ type: 'shape', id: `${id}-card-${idx + 1}`, ...(idx === 0 ? { component: 'radialGauges' } : {}), bounds: [x, ry, width, rowH], style: { fill: surf, stroke: hi ? col : (p.line || '#E2E6EE'), strokeWidth: hi ? 2 : 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-bar-${idx + 1}`, bounds: [x, ry + 16, 5, Math.max(24, rowH - 32)], style: { fill: col, radius: 3 } });
      const rRing = Math.min(48, Math.max(34, Math.floor((rowH - 26) / 2)));
      const rcx = x + 36 + rRing, rcy = ry + Math.round(rowH / 2);
      drawRingArc(elements, `${id}-g${idx + 1}`, rcx, rcy, rRing, it.pct, col, 'ring');
      const pctTxt = `${Math.round(Number(it.pct) || 0)}%`;
      elements.push(textElement({ id: `${id}-pct-${idx + 1}`, text: pctTxt, bounds: [rcx - rRing + 6, rcy - 14, rRing * 2 - 12, 28], style: theme.font(rRing >= 44 ? 22 : 18, { fontWeight: 900, color: p.ink, textAlign: 'center', lineHeight: 1.15 }) }));
      const tx = rcx + rRing + 34;
      const rightW = Math.max(220, width - (tx - x) - 280);
      elements.push(textElement({ id: `${id}-lbl-${idx + 1}`, text: it.label || '', bounds: [tx, ry + Math.round(rowH * 0.22), rightW, 30], style: theme.font(22, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (it.target || it.detail) {
        elements.push(textElement({ id: `${id}-sub-${idx + 1}`, text: it.detail || it.target || '', bounds: [tx, ry + Math.round(rowH * 0.56), rightW, 28], style: theme.font(18, { fontWeight: 300, color: muted, lineHeight: 1.3 }) }));
      }
      if (it.value) {
        elements.push(textElement({ id: `${id}-val-${idx + 1}`, text: String(it.value), bounds: [x + width - 264, ry + Math.round((rowH - 42) / 2), 236, 42], style: theme.font(34, { fontWeight: 900, color: readableInk(col, surf, 3.0), textAlign: 'right', lineHeight: 1.15 }) }));
      }
    });
    return { elements, height: h };
  }

  const gap = 20;
  const natural = isCompact ? 340 : 420;
  const h = Math.max(natural, height || 0);
  const cardH = h - headH;
  const cw = Math.floor((width - gap * (list.length - 1)) / list.length);
  list.forEach((it, idx) => {
    const cx = x + idx * (cw + gap);
    const cy = y + headH;
    const col = pickColor(it, idx);
    const hi = Boolean(it.highlight);
    elements.push({ type: 'shape', id: `${id}-card-${idx + 1}`, ...(idx === 0 ? { component: 'radialGauges' } : {}), bounds: [cx, cy, cw, cardH], style: { fill: surf, stroke: hi ? col : (p.line || '#E2E6EE'), strokeWidth: hi ? 2 : 1.5, radius: rad } });
    elements.push({ type: 'shape', id: `${id}-trim-${idx + 1}`, bounds: [cx + 22, cy, cw - 44, 5], style: { fill: col, radius: 3 } });

    const rRing = Math.min(82, Math.max(54, Math.floor(Math.min(cw - 76, cardH * 0.44) / 2)));
    const rcx = cx + Math.round(cw / 2);
    const rcy = cy + 32 + rRing;
    drawRingArc(elements, `${id}-g${idx + 1}`, rcx, rcy, rRing, it.pct, col, variant === 'radial' ? 'radial' : 'ring');

    const pctTxt = `${Math.round(Number(it.pct) || 0)}%`;
    elements.push(textElement({ id: `${id}-pct-${idx + 1}`, text: pctTxt, bounds: [rcx - rRing + 10, rcy - 20, rRing * 2 - 20, 40], style: theme.font(rRing >= 70 ? 34 : 28, { fontWeight: 900, color: p.ink, textAlign: 'center', lineHeight: 1.15 }) }));

    const lblY = rcy + rRing + 24;
    elements.push(textElement({ id: `${id}-lbl-${idx + 1}`, text: it.label || '', bounds: [cx + 18, lblY, cw - 36, 30], style: theme.font(isCompact ? 19 : 21, { fontWeight: 700, color: p.ink, textAlign: 'center', lineHeight: 1.25 }) }));
    if (it.value) {
      elements.push(textElement({ id: `${id}-val-${idx + 1}`, text: String(it.value), bounds: [cx + 18, lblY + 34, cw - 36, 34], style: theme.font(isCompact ? 24 : 28, { fontWeight: 900, color: readableInk(col, surf, 3.0), textAlign: 'center', lineHeight: 1.2 }) }));
    }
    if (it.target) {
      const tW = Math.min(cw - 44, Math.max(108, Math.ceil(textWidth(it.target, 14) * 1.18) + 24));
      const tY = Math.min(cy + cardH - 42, lblY + (it.value ? 76 : 42));
      elements.push({ type: 'shape', id: `${id}-tbg-${idx + 1}`, bounds: [cx + Math.round((cw - tW) / 2), tY, tW, 28], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 14 } });
      elements.push(textElement({ id: `${id}-ttx-${idx + 1}`, text: String(it.target), bounds: [cx + Math.round((cw - tW) / 2) + 8, tY + 4, tW - 16, 20], style: theme.font(14, { fontWeight: 300, color: muted, textAlign: 'center', lineHeight: 1.2 }) }));
    }
  });

  return { elements, height: h };
}

// Layered Pyramid / Strategic Stack with 3 visual styles:
//   - 'pyramid' (default): tapered horizontal pyramid tiers on left + aligned detail cards on right
//   - 'stack'   (layered stack): full-width architectural stack bands with left level badges
//   - 'cards'   (stepped columns): left-to-right ascending tier cards with arrow connectors
export function pyramidStack({ id, x, y, width, height, title = '', layers = [], theme, variant = 'pyramid' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(layers) ? layers : []).slice(0, 5);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const tierColors = [r.pop, r.primary, mixHexLocal(r.primary, '#FFFFFF', p.dark ? 0.2 : 0.25), r.secondary, muted];

  const pad = isCompact ? 18 : 24;
  const headH = title ? (isCompact ? 38 : 44) : 0;
  const natural = isCompact ? 380 : 460;
  const h = Math.max(natural, height || 0);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'pyramidStack', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, width - pad * 2, 32], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    curY += headH;
  }
  const iw = width - pad * 2;
  const bodyH = h - (curY - y) - pad;

  if (variant === 'cards') {
    const gap = 24;
    const cw = Math.floor((iw - gap * (list.length - 1)) / list.length);
    list.forEach((ly, i) => {
      const cx = x + pad + i * (cw + gap);
      const col = tierColors[i % tierColors.length];
      const topShift = Math.round(((list.length - 1 - i) / Math.max(1, list.length - 1)) * 42);
      const ch = bodyH - topShift;
      const cy = curY + topShift;
      elements.push({ type: 'shape', id: `${id}-c-${i + 1}`, bounds: [cx, cy, cw, ch], style: { fill: i === 0 ? r.primary : subBg, stroke: i === 0 ? r.primary : (p.line || '#E2E6EE'), strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-ctrim-${i + 1}`, bounds: [cx + 18, cy, cw - 36, 5], style: { fill: i === 0 ? r.pop : col, radius: 3 } });
      const lv = ly.level || `L${i + 1}`;
      const lvW = Math.min(cw - 32, Math.max(72, Math.ceil(textWidth(lv, 14) * 1.18) + 22));
      elements.push({ type: 'shape', id: `${id}-lvbg-${i + 1}`, bounds: [cx + 18, cy + 20, lvW, 26], style: { fill: i === 0 ? r.pop : col, radius: 13 } });
      elements.push(textElement({ id: `${id}-lvtx-${i + 1}`, text: lv, bounds: [cx + 22, cy + 23, lvW - 8, 20], style: theme.font(13, { fontWeight: 700, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-t-${i + 1}`, text: ly.title || '', bounds: [cx + 18, cy + 58, cw - 36, 54], style: theme.font(21, { fontWeight: 700, color: i === 0 ? (p.inverse || '#FFFFFF') : p.ink, lineHeight: 1.25 }) }));
      if (ly.detail) {
        elements.push(textElement({ id: `${id}-d-${i + 1}`, text: ly.detail, bounds: [cx + 18, cy + 116, cw - 36, Math.max(48, ch - 132)], style: theme.font(18, { fontWeight: 300, color: i === 0 ? (p.inverse || '#FFFFFF') : muted, lineHeight: 1.45 }) }));
      }
      if (i < list.length - 1) {
        const my = curY + Math.round(bodyH * 0.55);
        elements.push({ ...lineElement({ id: `${id}-arr-${i + 1}`, from: [cx + cw + 3, my], to: [cx + cw + gap - 3, my], style: { stroke: p.line || '#CBD5E1', strokeWidth: 2 } }), endArrow: true });
      }
    });
    return { elements, height: h };
  }

  const rowGap = isCompact ? 12 : 16;
  const rowH = Math.floor((bodyH - rowGap * (list.length - 1)) / list.length);

  if (variant === 'stack') {
    const lvW = Math.min(220, Math.round(iw * 0.16));
    list.forEach((ly, i) => {
      const ry = curY + i * (rowH + rowGap);
      const col = tierColors[i % tierColors.length];
      elements.push({ type: 'shape', id: `${id}-row-${i + 1}`, bounds: [x + pad, ry, iw, rowH], style: { fill: i === 0 ? (p.pale || '#EEF2FF') : subBg, stroke: i === 0 ? r.primary : (p.line || '#E2E6EE'), strokeWidth: i === 0 ? 2 : 1.5, radius: 12 } });
      elements.push({ type: 'shape', id: `${id}-lvbg-${i + 1}`, bounds: [x + pad, ry, lvW, rowH], style: { fill: col, radius: 12 } });
      elements.push(textElement({ id: `${id}-lvtx-${i + 1}`, text: ly.level || `L${i + 1}`, bounds: [x + pad + 10, ry + Math.round((rowH - 26) / 2), lvW - 20, 26], style: theme.font(18, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.25 }) }));
      const titleW = Math.round((iw - lvW) * 0.34);
      elements.push(textElement({ id: `${id}-t-${i + 1}`, text: ly.title || '', bounds: [x + pad + lvW + 22, ry + Math.round((rowH - 30) / 2), titleW, 30], style: theme.font(21, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (ly.detail) {
        const bdgReserve = ly.badge ? 140 : 0;
        elements.push(textElement({ id: `${id}-d-${i + 1}`, text: ly.detail, bounds: [x + pad + lvW + titleW + 32, ry + Math.max(12, Math.round((rowH - 48) / 2)), iw - lvW - titleW - bdgReserve - 50, Math.max(30, rowH - 22)], style: theme.font(18, { fontWeight: 300, color: muted, lineHeight: 1.38 }) }));
      }
      if (ly.badge) {
        const bW = Math.min(126, Math.max(80, Math.ceil(textWidth(ly.badge, 13) * 1.2) + 20));
        elements.push({ type: 'shape', id: `${id}-bg-${i + 1}`, bounds: [x + pad + iw - bW - 14, ry + Math.round((rowH - 26) / 2), bW, 26], style: { fill: i === 0 ? r.pop : surf, stroke: i === 0 ? null : (p.line || '#E2E6EE'), strokeWidth: i === 0 ? 0 : 1, radius: 13 } });
        elements.push(textElement({ id: `${id}-bt-${i + 1}`, text: ly.badge, bounds: [x + pad + iw - bW - 8, ry + Math.round((rowH - 18) / 2), bW - 12, 18], style: theme.font(13, { fontWeight: 700, color: i === 0 ? '#FFFFFF' : muted, textAlign: 'center', lineHeight: 1.2 }) }));
      }
    });
    return { elements, height: h };
  }

  // Default 'pyramid': tapered centered pyramid on left (44%) + connector + detail card on right (52%)
  const pyrZoneW = Math.round(iw * 0.44);
  const connW = 36;
  const detX = x + pad + pyrZoneW + connW;
  const detW = iw - pyrZoneW - connW;
  const minW = Math.round(pyrZoneW * 0.46);
  const maxW = pyrZoneW;
  list.forEach((ly, i) => {
    const ry = curY + i * (rowH + rowGap);
    const col = tierColors[i % tierColors.length];
    const ratio = list.length === 1 ? 1 : i / (list.length - 1);
    const tw = Math.round(minW + (maxW - minW) * ratio);
    const tx = x + pad + Math.round((pyrZoneW - tw) / 2);
    elements.push({ type: 'shape', id: `${id}-tier-${i + 1}`, bounds: [tx, ry, tw, rowH], style: { fill: col, radius: 12 } });
    const lv = ly.level || `L${i + 1}`;
    elements.push(textElement({ id: `${id}-lvtx-${i + 1}`, text: lv, bounds: [tx + 12, ry + Math.round((rowH - (ly.title ? 46 : 24)) / 2), tw - 24, 22], style: theme.font(14, { fontWeight: 700, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-pt-${i + 1}`, text: ly.title || '', bounds: [tx + 12, ry + Math.round((rowH - 46) / 2) + 22, tw - 24, 26], style: theme.font(tw < 280 ? 17 : 20, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));

    const midY = ry + Math.round(rowH / 2);
    elements.push(lineElement({ id: `${id}-ln-${i + 1}`, from: [tx + tw + 4, midY], to: [detX - 4, midY], style: { stroke: p.line || '#CBD5E1', strokeWidth: 1.5, strokeDash: 'dash' } }));

    elements.push({ type: 'shape', id: `${id}-det-${i + 1}`, bounds: [detX, ry, detW, rowH], style: { fill: i === 0 ? (p.pale || '#EEF2FF') : subBg, stroke: i === 0 ? r.primary : (p.line || '#E2E6EE'), strokeWidth: i === 0 ? 1.5 : 1, radius: 12 } });
    elements.push({ type: 'shape', id: `${id}-dbar-${i + 1}`, bounds: [detX, ry + 12, 5, Math.max(20, rowH - 24)], style: { fill: col, radius: 3 } });
    const bdgW = ly.badge ? Math.min(126, Math.max(76, Math.ceil(textWidth(ly.badge, 13) * 1.18) + 20)) : 0;
    elements.push(textElement({ id: `${id}-t-${i + 1}`, text: ly.title || '', bounds: [detX + 18, ry + 12, detW - bdgW - 36, 26], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
    if (ly.badge) {
      elements.push({ type: 'shape', id: `${id}-bg-${i + 1}`, bounds: [detX + detW - bdgW - 14, ry + 12, bdgW, 24], style: { fill: i === 0 ? r.pop : surf, stroke: i === 0 ? null : (p.line || '#E2E6EE'), strokeWidth: i === 0 ? 0 : 1, radius: 12 } });
      elements.push(textElement({ id: `${id}-bt-${i + 1}`, text: ly.badge, bounds: [detX + detW - bdgW - 8, ry + 15, bdgW - 12, 18], style: theme.font(12, { fontWeight: 700, color: i === 0 ? '#FFFFFF' : muted, textAlign: 'center', lineHeight: 1.2 }) }));
    }
    if (ly.detail) {
      elements.push(textElement({ id: `${id}-d-${i + 1}`, text: ly.detail, bounds: [detX + 18, ry + 42, detW - 32, Math.max(26, rowH - 48)], style: theme.font(17, { fontWeight: 300, color: muted, lineHeight: 1.35 }) }));
    }
  });

  return { elements, height: h };
}

// Multi-Lane Modern Gantt & Kanban Board (Kibo UI inspired) with 3 styles:
//   - 'gantt'   (default): multi-lane timeline grid with color-coded capsule schedule bars
//   - 'kanban'  (3-column board): auto-grouped into 已完成 / 进行中 / 规划中 modern Kanban columns
//   - 'compact' (dense schedule list): compact high-density schedule table
export function modernGantt({ id, x, y, width, height, title = '', columns = [], lanes = [], theme, variant = 'gantt' }) {
  const p = theme.palette, r = colorRoles(p);
  const cols = (Array.isArray(columns) && columns.length ? columns : ['1月', '2月', '3月', '4月', '5月', '6月']).slice(0, 12);
  const list = (Array.isArray(lanes) ? lanes : []).slice(0, 8);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact) || variant === 'compact';
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#059669';
  const okBg = p.dark ? '#11302B' : '#ECFDF5';
  const warnCol = r.pop;
  const warnBg = p.dark ? '#331E12' : '#FFF7ED';

  const statusInfo = (st) => {
    const s = String(st || 'active').toLowerCase();
    if (s === 'done' || s === 'completed' || s === '已完成') return { key: 'done', label: '已完成', col: okCol, bg: okBg, fg: '#FFFFFF' };
    if (s === 'risk' || s === 'warn' || s === '延期' || s === '重点') return { key: 'active', label: '重点攻坚', col: warnCol, bg: warnBg, fg: '#FFFFFF' };
    if (s === 'todo' || s === 'planned' || s === '规划中' || s === '待启动') return { key: 'todo', label: '规划中', col: muted, bg: subBg, fg: '#FFFFFF' };
    return { key: 'active', label: '进行中', col: r.primary, bg: p.pale || '#EEF2FF', fg: p.inverse || '#FFFFFF' };
  };

  if (variant === 'kanban') {
    const headH = title ? 40 : 0;
    const natural = isCompact ? 380 : 450;
    const h = Math.max(natural, height || 0);
    const colH = h - headH;
    const elements = [];
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x, y + 4, width, 30], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, p.bg || surf), lineHeight: 1.25 }) }));
    }
    const groups = [
      { key: 'done', title: '已完成', col: okCol, bg: okBg, items: [] },
      { key: 'active', title: '进行中', col: r.primary, bg: p.pale || '#EEF2FF', items: [] },
      { key: 'todo', title: '规划中', col: muted, bg: subBg, items: [] },
    ];
    list.forEach((ln) => {
      const si = statusInfo(ln.status);
      const g = groups.find((x) => x.key === si.key) || groups[1];
      g.items.push({ ...ln, _si: si });
    });
    const gap = 18;
    const cw = Math.floor((width - gap * 2) / 3);
    groups.forEach((g, gi) => {
      const gx = x + gi * (cw + gap);
      const gy = y + headH;
      elements.push({ type: 'shape', id: `${id}-kcol-${gi + 1}`, ...(gi === 0 ? { component: 'modernGantt' } : {}), bounds: [gx, gy, cw, colH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-kdot-${gi + 1}`, bounds: [gx + 18, gy + 22, 10, 10], style: { fill: g.col, radius: 5 }, shape: 'ellipse' });
      elements.push(textElement({ id: `${id}-kt-${gi + 1}`, text: g.title, bounds: [gx + 36, gy + 15, cw - 100, 26], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
      elements.push({ type: 'shape', id: `${id}-kcnt-bg-${gi + 1}`, bounds: [gx + cw - 52, gy + 15, 34, 24], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 12 } });
      elements.push(textElement({ id: `${id}-kcnt-${gi + 1}`, text: String(g.items.length), bounds: [gx + cw - 52, gy + 18, 34, 18], style: theme.font(13, { fontWeight: 700, color: g.col, textAlign: 'center', lineHeight: 1.2 }) }));

      const cGap = 12;
      const availH = colH - 64;
      const cardH = Math.min(116, Math.max(76, Math.floor((availH - cGap * Math.max(0, g.items.length - 1)) / Math.max(1, g.items.length))));
      g.items.slice(0, 4).forEach((ln, ii) => {
        const cy = gy + 52 + ii * (cardH + cGap);
        if (cy + cardH > gy + colH - 8) return;
        elements.push({ type: 'shape', id: `${id}-kc-${gi + 1}-${ii + 1}`, bounds: [gx + 14, cy, cw - 28, cardH], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 12 } });
        elements.push({ type: 'shape', id: `${id}-kbar-${gi + 1}-${ii + 1}`, bounds: [gx + 14, cy + 12, 4, cardH - 24], style: { fill: ln._si.col, radius: 2 } });
        const sLbl = cols[Math.max(0, (Number(ln.start) || 1) - 1)] || '';
        const eLbl = cols[Math.min(cols.length - 1, (Number(ln.end) || cols.length) - 1)] || '';
        const spanTxt = sLbl && eLbl ? (sLbl === eLbl ? sLbl : `${sLbl}–${eLbl}`) : '';
        elements.push(textElement({ id: `${id}-kln-${gi + 1}-${ii + 1}`, text: `${ln.name || ''}${ln.owner ? ` · ${ln.owner}` : ''}`, bounds: [gx + 28, cy + 12, cw - 120, 22], style: theme.font(14, { fontWeight: 600, color: muted, lineHeight: 1.2 }) }));
        if (spanTxt) {
          elements.push(textElement({ id: `${id}-ksp-${gi + 1}-${ii + 1}`, text: spanTxt, bounds: [gx + cw - 108, cy + 12, 82, 20], style: theme.font(13, { fontWeight: 700, color: ln._si.col, textAlign: 'right', lineHeight: 1.2 }) }));
        }
        elements.push(textElement({ id: `${id}-ktsk-${gi + 1}-${ii + 1}`, text: ln.task || '', bounds: [gx + 28, cy + 38, cw - 52, Math.max(26, cardH - 46)], style: theme.font(18, { fontWeight: 700, color: p.ink, lineHeight: 1.3 }) }));
      });
    });
    return { elements, height: h };
  }

  const pad = isCompact ? 16 : 24;
  const titleH = title ? (isCompact ? 34 : 42) : 0;
  const colHeadH = 38;
  const rowH = isCompact ? 46 : 58;
  const natural = pad * 2 + titleH + colHeadH + list.length * rowH + 14;
  const h = Math.max(natural, height || 0);
  const actualRowH = Math.floor((h - pad * 2 - titleH - colHeadH - 14) / list.length);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'modernGantt', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];

  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY, width - pad * 2 - 280, 32], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    const leg = [{ col: okCol, lbl: '已完成' }, { col: r.primary, lbl: '进行中' }, { col: muted, lbl: '规划中' }];
    let lx = x + width - pad;
    for (let li = leg.length - 1; li >= 0; li--) {
      const lw = 76;
      lx -= lw;
      elements.push({ type: 'shape', id: `${id}-lgd-${li + 1}`, bounds: [lx, curY + 10, 10, 10], style: { fill: leg[li].col, radius: 3 } });
      elements.push(textElement({ id: `${id}-lgt-${li + 1}`, text: leg[li].lbl, bounds: [lx + 14, curY + 5, 60, 20], style: theme.font(14, { fontWeight: 400, color: muted, lineHeight: 1.2 }) }));
    }
    curY += titleH;
  }

  const iw = width - pad * 2;
  const laneW = Math.min(260, Math.round(iw * 0.2));
  const gridX = x + pad + laneW;
  const gridW = iw - laneW;
  const colW = gridW / cols.length;
  const gridTop = curY;
  const gridH = colHeadH + list.length * actualRowH;

  // Column headers & vertical dashed grid lines
  elements.push({ type: 'shape', id: `${id}-chbg`, bounds: [x + pad, gridTop, iw, colHeadH], style: { fill: subBg, radius: 8 } });
  elements.push(textElement({ id: `${id}-lh`, text: '负责团队 / 泳道', bounds: [x + pad + 14, gridTop + 9, laneW - 24, 22], style: theme.font(15, { fontWeight: 700, color: muted, lineHeight: 1.2 }) }));
  cols.forEach((c, ci) => {
    const cx = Math.round(gridX + ci * colW);
    elements.push(textElement({ id: `${id}-ch-${ci + 1}`, text: String(c), bounds: [cx, gridTop + 9, Math.round(colW), 22], style: theme.font(15, { fontWeight: 700, color: p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(lineElement({ id: `${id}-vline-${ci + 1}`, from: [cx, gridTop + colHeadH], to: [cx, gridTop + gridH], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1, strokeDash: 'dash' } }));
  });

  list.forEach((ln, ri) => {
    const ry = gridTop + colHeadH + ri * actualRowH;
    if (ri > 0) {
      elements.push(lineElement({ id: `${id}-hline-${ri + 1}`, from: [x + pad, ry], to: [x + pad + iw, ry], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1 } }));
    }
    const si = statusInfo(ln.status);
    elements.push(textElement({ id: `${id}-ln-${ri + 1}`, text: ln.name || '', bounds: [x + pad + 14, ry + Math.round((actualRowH - (ln.owner ? 38 : 22)) / 2), laneW - 24, 22], style: theme.font(17, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
    if (ln.owner) {
      elements.push(textElement({ id: `${id}-ow-${ri + 1}`, text: ln.owner, bounds: [x + pad + 14, ry + Math.round((actualRowH - 38) / 2) + 21, laneW - 24, 18], style: theme.font(13, { fontWeight: 300, color: muted, lineHeight: 1.2 }) }));
    }
    const sIdx = Math.max(0, Math.min(cols.length - 1, (Number(ln.start) || 1) - 1));
    const eIdx = Math.max(sIdx, Math.min(cols.length - 1, (Number(ln.end) || (sIdx + 1)) - 1));
    const bx = Math.round(gridX + sIdx * colW) + 6;
    const bw = Math.max(Math.round(colW) - 12, Math.round((eIdx - sIdx + 1) * colW) - 12);
    const barH = Math.min(38, actualRowH - 14);
    const by = ry + Math.round((actualRowH - barH) / 2);
    elements.push({ type: 'shape', id: `${id}-bar-${ri + 1}`, bounds: [bx, by, bw, barH], style: { fill: si.col, radius: Math.round(barH / 2) } });
    elements.push(textElement({ id: `${id}-tsk-${ri + 1}`, text: ln.task || '', bounds: [bx + 14, by + Math.round((barH - 22) / 2), Math.max(40, bw - 28), 22], style: theme.font(isCompact ? 14 : 16, { fontWeight: 700, color: si.fg, lineHeight: 1.2 }) }));
  });

  return { elements, height: h };
}

// Quote / Testimonial & Owner Cards with 3 visual styles:
//   - 'cards'     (default): modern testimonial card grid with watermark quotation mark & Owner avatar pill
//   - 'spotlight' (featured hero): highlighted quote elevated as solid primary spotlight card
//   - 'rows'      (horizontal strips): left owner profile column + right quote & value badge
export function quoteCards({ id, x, y, width, height, title = '', items = [], theme, variant = 'cards' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 4);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const avatarCols = [r.primary, r.pop, p.dark ? '#34D399' : '#059669', r.secondary];

  const headH = title ? (isCompact ? 38 : 44) : 0;
  const elements = [];
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x, y + 4, width, 32], style: theme.font(22, { fontWeight: 700, color: readableInk(p.accent, p.bg || surf), lineHeight: 1.25 }) }));
  }

  if (variant === 'rows') {
    const rowGap = 16;
    const minRowH = isCompact ? 114 : 132;
    const natural = headH + list.length * minRowH + (list.length - 1) * rowGap;
    const h = Math.max(natural, height || 0);
    const rowH = Math.floor((h - headH - rowGap * (list.length - 1)) / list.length);
    const leftW = Math.min(300, Math.round(width * 0.23));
    list.forEach((it, idx) => {
      const ry = y + headH + idx * (rowH + rowGap);
      const aCol = avatarCols[idx % avatarCols.length];
      const hi = Boolean(it.highlight);
      elements.push({ type: 'shape', id: `${id}-card-${idx + 1}`, ...(idx === 0 ? { component: 'quoteCards' } : {}), bounds: [x, ry, width, rowH], style: { fill: surf, stroke: hi ? r.primary : (p.line || '#E2E6EE'), strokeWidth: hi ? 2 : 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-bar-${idx + 1}`, bounds: [x, ry + 16, 5, Math.max(24, rowH - 32)], style: { fill: aCol, radius: 3 } });
      // Owner Avatar Pill
      const avSz = 44;
      const avY = ry + Math.round((rowH - avSz) / 2);
      elements.push({ type: 'shape', id: `${id}-av-${idx + 1}`, shape: 'ellipse', bounds: [x + 24, avY, avSz, avSz], style: { fill: aCol, radius: 22 } });
      elements.push(textElement({ id: `${id}-avt-${idx + 1}`, text: String(it.author || 'A').slice(0, 1), bounds: [x + 24, avY + 10, avSz, 24], style: theme.font(20, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-au-${idx + 1}`, text: it.author || '', bounds: [x + 80, avY + 1, leftW - 90, 24], style: theme.font(18, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
      if (it.role) {
        elements.push(textElement({ id: `${id}-rl-${idx + 1}`, text: it.role, bounds: [x + 80, avY + 25, leftW - 90, 20], style: theme.font(14, { fontWeight: 300, color: muted, lineHeight: 1.2 }) }));
      }
      elements.push(lineElement({ id: `${id}-div-${idx + 1}`, from: [x + leftW, ry + 18], to: [x + leftW, ry + rowH - 18], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1 } }));
      const tagW = it.tag ? Math.min(180, Math.max(96, Math.ceil(textWidth(it.tag, 13) * 1.2) + 24)) : 0;
      elements.push(textElement({ id: `${id}-qt-${idx + 1}`, text: `“${it.quote || ''}”`, bounds: [x + leftW + 24, ry + Math.max(14, Math.round((rowH - 58) / 2)), width - leftW - tagW - 60, Math.max(44, rowH - 28)], style: theme.font(isCompact ? 18 : 20, { fontWeight: 300, color: p.ink, lineHeight: 1.45 }) }));
      if (it.tag) {
        elements.push({ type: 'shape', id: `${id}-tbg-${idx + 1}`, bounds: [x + width - tagW - 20, ry + Math.round((rowH - 28) / 2), tagW, 28], style: { fill: hi ? r.pop : subBg, stroke: hi ? null : (p.line || '#E2E6EE'), strokeWidth: hi ? 0 : 1, radius: 14 } });
        elements.push(textElement({ id: `${id}-ttx-${idx + 1}`, text: it.tag, bounds: [x + width - tagW - 14, ry + Math.round((rowH - 18) / 2), tagW - 12, 18], style: theme.font(13, { fontWeight: 700, color: hi ? '#FFFFFF' : muted, textAlign: 'center', lineHeight: 1.2 }) }));
      }
    });
    return { elements, height: h };
  }

  const gap = 20;
  const cw = Math.floor((width - gap * (list.length - 1)) / list.length);
  const cPad = isCompact ? 20 : 26;
  const footerH = 74;
  const bodyFs = list.length === 1 ? 28 : adaptiveBodyFont(list.map((x) => x.quote || '').sort((a, b) => b.length - a.length)[0], isCompact, 21);
  const maxBodyLines = Math.max(2, ...list.map((it) => estimateLines(String(it.quote || ''), bodyFs, cw - cPad * 2)));
  const naturalBodyH = Math.ceil(maxBodyLines * bodyFs * 1.52);
  const contentCardH = 66 + naturalBodyH + 28 + footerH;
  const availCardH = height ? Math.max(contentCardH, height - headH) : contentCardH;
  const cardH = fitCardHeight(contentCardH, availCardH, { maxStretch: 1.28, minH: 230 });
  const h = headH + cardH;
  const spotIdx = variant === 'spotlight' ? Math.max(0, list.findIndex((it) => it.highlight)) : -1;

  list.forEach((it, idx) => {
    const cx = x + idx * (cw + gap);
    const cy = y + headH;
    const isSpot = idx === spotIdx;
    const aCol = avatarCols[idx % avatarCols.length];
    elements.push({
      type: 'shape', id: `${id}-card-${idx + 1}`, ...(idx === 0 ? { component: 'quoteCards' } : {}),
      bounds: [cx, cy, cw, cardH],
      style: isSpot
        ? { fill: r.primary, radius: rad }
        : { fill: surf, stroke: it.highlight ? r.primary : (p.line || '#E2E6EE'), strokeWidth: it.highlight ? 2 : 1.5, radius: rad },
    });
    elements.push({ type: 'shape', id: `${id}-trim-${idx + 1}`, bounds: [cx + 22, cy, cw - 44, 5], style: { fill: isSpot ? r.pop : aCol, radius: 3 } });

    // Top row: decorative quote glyph + right value tag pill
    elements.push(textElement({ id: `${id}-qm-${idx + 1}`, text: '“', bounds: [cx + cPad - 4, cy + 14, 48, 46], style: theme.font(52, { fontWeight: 900, color: isSpot ? r.pop : mixHexLocal(aCol, surf, 0.55), lineHeight: 1 }) }));
    if (it.tag) {
      const tW = Math.min(cw - cPad * 2 - 52, Math.max(92, Math.ceil(textWidth(it.tag, 13) * 1.2) + 22));
      elements.push({ type: 'shape', id: `${id}-tbg-${idx + 1}`, bounds: [cx + cw - cPad - tW, cy + 22, tW, 26], style: { fill: isSpot ? r.pop : subBg, stroke: isSpot ? null : (p.line || '#E2E6EE'), strokeWidth: isSpot ? 0 : 1, radius: 13 } });
      elements.push(textElement({ id: `${id}-ttx-${idx + 1}`, text: it.tag, bounds: [cx + cw - cPad - tW + 6, cy + 25, tW - 12, 20], style: theme.font(13, { fontWeight: 700, color: isSpot ? '#FFFFFF' : readableInk(aCol, subBg, 3.0), textAlign: 'center', lineHeight: 1.2 }) }));
    }

    // Quote body vertically centered between quote header and footer
    const midTop = cy + 62;
    const midAvailH = Math.max(60, cardH - 62 - footerH - 14);
    const thisLines = estimateLines(String(it.quote || ''), bodyFs, cw - cPad * 2);
    const thisTextH = Math.min(midAvailH, Math.ceil(thisLines * bodyFs * 1.52) + 6);
    const bodyY = midTop + Math.max(0, Math.round((midAvailH - thisTextH) / 2));
    elements.push(textElement({ id: `${id}-qt-${idx + 1}`, text: String(it.quote || ''), bounds: [cx + cPad, bodyY, cw - cPad * 2, thisTextH], style: theme.font(bodyFs, { fontWeight: 300, color: isSpot ? (p.inverse || '#FFFFFF') : p.ink, lineHeight: 1.5 }) }));

    // Bottom divider + Owner avatar pill
    const fY = cy + cardH - footerH;
    elements.push(lineElement({ id: `${id}-div-${idx + 1}`, from: [cx + cPad, fY], to: [cx + cw - cPad, fY], style: { stroke: isSpot ? mixHexLocal(r.primary, '#FFFFFF', 0.24) : (p.line || '#E2E6EE'), strokeWidth: 1 } }));
    const avSz = 42;
    const avY = fY + Math.round((footerH - avSz) / 2);
    elements.push({ type: 'shape', id: `${id}-av-${idx + 1}`, shape: 'ellipse', bounds: [cx + cPad, avY, avSz, avSz], style: { fill: isSpot ? r.pop : aCol, radius: 21 } });
    elements.push(textElement({ id: `${id}-avt-${idx + 1}`, text: String(it.author || 'A').slice(0, 1), bounds: [cx + cPad, avY + 9, avSz, 24], style: theme.font(19, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-au-${idx + 1}`, text: it.author || '', bounds: [cx + cPad + avSz + 14, avY + 1, cw - cPad * 2 - avSz - 16, 22], style: theme.font(18, { fontWeight: 700, color: isSpot ? (p.inverse || '#FFFFFF') : p.ink, lineHeight: 1.2 }) }));
    if (it.role) {
      elements.push(textElement({ id: `${id}-rl-${idx + 1}`, text: it.role, bounds: [cx + cPad + avSz + 14, avY + 24, cw - cPad * 2 - avSz - 16, 20], style: theme.font(14, { fontWeight: 300, color: isSpot ? mixHexLocal(r.primary, '#FFFFFF', 0.78) : muted, lineHeight: 1.2 }) }));
    }
  });

  return { elements, height: h };
}

// =========================================================================
// Modern Web UI v2 Batch 1:
//   - groupedBarChart (V2-DATA-01: Grouped / Stacked / Horizontal Bar Chart)
//   - multiLineChart  (V2-DATA-02: Smooth SVG Multi-Line / Area / Combo Chart)
//   - rankedBarList   (V2-CARD-03: Ranked BarList / Podium / Dual-Col Tiles)
//   - executiveBrief  (V2-CARD-01: Executive One-Pager Bento Brief)
// =========================================================================

function parseChartNum(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export function groupedBarChart({ id, x, y, width, height, title = '', unit = '', badge = '', categories = [], series = [], theme, variant = 'grouped' }) {
  const p = theme.palette, r = colorRoles(p);
  const cats = (Array.isArray(categories) ? categories : []).slice(0, 10);
  const sers = (Array.isArray(series) ? series : []).slice(0, 3).map((s, si) => ({
    name: s?.name || `序列${si + 1}`,
    values: (Array.isArray(s?.values) ? s.values : []).map(parseChartNum),
    tone: s?.tone || (si === 0 && (series.length > 1) ? 'muted' : 'primary'),
  }));
  if (!cats.length || !sers.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const serCol = (s, si) => {
    if (s.tone === 'pop') return r.pop;
    if (s.tone === 'muted') return p.dark ? '#334155' : '#CBD5E1';
    if (s.tone === 'secondary') return r.secondary;
    return si === 0 && sers.length > 1 ? (p.dark ? '#334155' : '#CBD5E1') : r.primary;
  };

  const pad = isCompact ? 18 : 26;
  const headH = 44;
  const natural = isCompact ? 360 : 440;
  const h = Math.max(natural, height || 0);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'groupedBarChart', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  const iw = width - pad * 2;
  const headY = y + pad;
  const titleTxt = title ? (unit ? `${title}（${unit}）` : title) : '分组柱状对比';
  elements.push(textElement({ id: `${id}-title`, text: titleTxt, bounds: [x + pad, headY + 2, iw - 420, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));

  // Right badge + series legend
  let rx = x + width - pad;
  if (badge) {
    const bW = Math.min(200, Math.max(96, Math.ceil(textWidth(badge, 13) * 1.2) + 24));
    rx -= bW;
    elements.push({ type: 'shape', id: `${id}-bdg-bg`, bounds: [rx, headY + 4, bW, 26], style: { fill: p.dark ? '#11302B' : '#ECFDF5', radius: 13 } });
    elements.push(textElement({ id: `${id}-bdg-tx`, text: badge, bounds: [rx + 6, headY + 7, bW - 12, 20], style: theme.font(13, { fontWeight: 700, color: p.dark ? '#34D399' : '#059669', textAlign: 'center', lineHeight: 1.2 }) }));
    rx -= 16;
  }
  for (let si = sers.length - 1; si >= 0; si--) {
    const lw = Math.ceil(textWidth(sers[si].name, 14) * 1.15) + 18;
    rx -= lw;
    elements.push({ type: 'shape', id: `${id}-lgd-${si + 1}`, bounds: [rx, headY + 12, 10, 10], style: { fill: serCol(sers[si], si), radius: 3 } });
    elements.push(textElement({ id: `${id}-lgt-${si + 1}`, text: sers[si].name, bounds: [rx + 14, headY + 7, lw - 14, 20], style: theme.font(14, { fontWeight: 400, color: muted, lineHeight: 1.2 }) }));
    rx -= 14;
  }

  const plotTop = headY + headH + 10;
  const plotH = h - (plotTop - y) - pad;

  if (variant === 'horizontal') {
    const rowGap = 12;
    const rowH = Math.floor((plotH - rowGap * (cats.length - 1)) / cats.length);
    const lblW = Math.min(180, Math.round(iw * 0.16));
    const maxV = Math.max(1, ...sers.flatMap((s) => s.values));
    const trackW = iw - lblW - 86;
    cats.forEach((cat, ci) => {
      const ry = plotTop + ci * (rowH + rowGap);
      elements.push({ type: 'shape', id: `${id}-hrow-${ci + 1}`, bounds: [x + pad, ry, iw, rowH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 10 } });
      elements.push(textElement({ id: `${id}-cat-${ci + 1}`, text: String(cat), bounds: [x + pad + 14, ry + Math.round((rowH - 22) / 2), lblW - 20, 22], style: theme.font(17, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
      const subBarH = Math.max(10, Math.min(20, Math.floor((rowH - 16 - (sers.length - 1) * 4) / sers.length)));
      const barsTotalH = sers.length * subBarH + (sers.length - 1) * 4;
      const startY = ry + Math.round((rowH - barsTotalH) / 2);
      sers.forEach((s, si) => {
        const v = s.values[ci] ?? 0;
        const bw = Math.max(18, Math.round((v / maxV) * trackW));
        const by = startY + si * (subBarH + 4);
        const col = (si === sers.length - 1 && v === maxV) ? r.pop : serCol(s, si);
        elements.push({ type: 'shape', id: `${id}-hb-${ci + 1}-${si + 1}`, bounds: [x + pad + lblW, by, bw, subBarH], style: { fill: col, radius: Math.round(subBarH / 2) } });
        elements.push(textElement({ id: `${id}-hv-${ci + 1}-${si + 1}`, text: String(v), bounds: [x + pad + lblW + bw + 8, by - 2, 68, subBarH + 4], style: theme.font(13, { fontWeight: si === sers.length - 1 ? 700 : 400, color: si === sers.length - 1 ? p.ink : muted, lineHeight: 1.2 }) }));
      });
    });
    return { elements, height: h };
  }

  const labelH = 32;
  const valPad = 26;
  const barAreaH = plotH - labelH - valPad;
  const baseY = plotTop + valPad + barAreaH;

  // 3 horizontal dashed guide lines
  for (let g = 0; g < 3; g++) {
    const gy = Math.round(plotTop + valPad + (barAreaH * g) / 2);
    elements.push(lineElement({ id: `${id}-grid-${g + 1}`, from: [x + pad, gy], to: [x + width - pad, gy], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1, strokeDash: g < 2 ? 'dash' : undefined } }));
  }

  const groupW = iw / cats.length;
  if (variant === 'stacked') {
    const sums = cats.map((_, ci) => sers.reduce((acc, s) => acc + (s.values[ci] ?? 0), 0));
    const maxSum = Math.max(1, ...sums);
    const barW = Math.min(72, Math.max(26, Math.round(groupW * 0.44)));
    cats.forEach((cat, ci) => {
      const gx = x + pad + ci * groupW + Math.round((groupW - barW) / 2);
      let curBottom = baseY;
      sers.forEach((s, si) => {
        const v = s.values[ci] ?? 0;
        const bh = Math.max(6, Math.round((v / maxSum) * barAreaH));
        const by = curBottom - bh;
        const col = si === sers.length - 1 && sums[ci] === maxSum ? r.pop : serCol(s, si);
        elements.push({ type: 'shape', id: `${id}-sb-${ci + 1}-${si + 1}`, bounds: [gx, by, barW, bh], style: { fill: col, radius: si === sers.length - 1 ? 8 : 2 } });
        curBottom = by - 2;
      });
      elements.push(textElement({ id: `${id}-sv-${ci + 1}`, text: String(sums[ci]), bounds: [gx - 12, curBottom - 22, barW + 24, 20], style: theme.font(15, { fontWeight: 700, color: sums[ci] === maxSum ? r.pop : p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-cat-${ci + 1}`, text: String(cat), bounds: [Math.round(x + pad + ci * groupW), baseY + 8, Math.round(groupW), 22], style: theme.font(16, { fontWeight: 600, color: muted, textAlign: 'center', lineHeight: 1.2 }) }));
    });
    return { elements, height: h };
  }

  // Default 'grouped'
  const allVals = sers.flatMap((s) => s.values);
  const maxV = Math.max(1, ...allVals);
  const lastSer = sers[sers.length - 1];
  const peakIdx = lastSer.values.indexOf(Math.max(...lastSer.values));
  const innerGap = 8;
  const maxPairW = Math.min(groupW * 0.68, 128);
  const barW = Math.max(18, Math.min(48, Math.floor((maxPairW - innerGap * (sers.length - 1)) / sers.length)));
  const pairW = barW * sers.length + innerGap * (sers.length - 1);

  cats.forEach((cat, ci) => {
    const startX = Math.round(x + pad + ci * groupW + (groupW - pairW) / 2);
    sers.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const bh = Math.max(14, Math.round((v / maxV) * barAreaH));
      const bx = startX + si * (barW + innerGap);
      const by = baseY - bh;
      const isPeak = si === sers.length - 1 && ci === peakIdx;
      const col = isPeak ? r.pop : serCol(s, si);
      elements.push({ type: 'shape', id: `${id}-b-${ci + 1}-${si + 1}`, bounds: [bx, by, barW, bh], style: { fill: col, radius: Math.min(8, Math.floor(barW / 3)) } });
      elements.push(textElement({ id: `${id}-v-${ci + 1}-${si + 1}`, text: String(v), bounds: [bx - 10, by - 22, barW + 20, 20], style: theme.font(14, { fontWeight: si === sers.length - 1 ? 700 : 400, color: isPeak ? r.pop : (si === sers.length - 1 ? p.ink : muted), textAlign: 'center', lineHeight: 1.2 }) }));
    });
    elements.push(textElement({ id: `${id}-cat-${ci + 1}`, text: String(cat), bounds: [Math.round(x + pad + ci * groupW), baseY + 8, Math.round(groupW), 22], style: theme.font(16, { fontWeight: 600, color: ci === peakIdx ? p.ink : muted, textAlign: 'center', lineHeight: 1.2 }) }));
  });
  return { elements, height: h };
}

export function multiLineChart({ id, x, y, width, height, title = '', unit = '', badge = '', categories = [], series = [], theme, variant = 'line' }) {
  const p = theme.palette, r = colorRoles(p);
  const cats = (Array.isArray(categories) ? categories : []).slice(0, 12);
  const sers = (Array.isArray(series) ? series : []).slice(0, 3).map((s, si) => ({
    name: s?.name || `趋势${si + 1}`,
    values: (Array.isArray(s?.values) ? s.values : []).map(parseChartNum),
    dashed: Boolean(s?.dashed),
    tone: s?.tone || (si === 0 ? 'primary' : si === 1 ? 'muted' : 'pop'),
  }));
  if (cats.length < 2 || !sers.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const serCol = (s, si) => (s.tone === 'pop' ? r.pop : s.tone === 'muted' ? muted : s.tone === 'secondary' ? r.secondary : si === 0 ? r.primary : r.pop);

  const pad = isCompact ? 18 : 26;
  const headH = 44;
  const natural = isCompact ? 360 : 440;
  const h = Math.max(natural, height || 0);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'multiLineChart', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  const iw = width - pad * 2;
  const headY = y + pad;
  const titleTxt = title ? (unit ? `${title}（${unit}）` : title) : '趋势走势分析';
  elements.push(textElement({ id: `${id}-title`, text: titleTxt, bounds: [x + pad, headY + 2, iw - 420, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));

  let rx = x + width - pad;
  if (badge) {
    const bW = Math.min(200, Math.max(96, Math.ceil(textWidth(badge, 13) * 1.2) + 24));
    rx -= bW;
    elements.push({ type: 'shape', id: `${id}-bdg-bg`, bounds: [rx, headY + 4, bW, 26], style: { fill: p.dark ? '#331E12' : '#FFF7ED', radius: 13 } });
    elements.push(textElement({ id: `${id}-bdg-tx`, text: badge, bounds: [rx + 6, headY + 7, bW - 12, 20], style: theme.font(13, { fontWeight: 700, color: r.pop, textAlign: 'center', lineHeight: 1.2 }) }));
    rx -= 16;
  }
  for (let si = sers.length - 1; si >= 0; si--) {
    const lw = Math.ceil(textWidth(sers[si].name, 14) * 1.15) + 22;
    rx -= lw;
    elements.push(lineElement({ id: `${id}-lgd-${si + 1}`, from: [rx, headY + 17], to: [rx + 14, headY + 17], style: { stroke: serCol(sers[si], si), strokeWidth: 3, ...(sers[si].dashed ? { strokeDash: 'dash' } : {}) } }));
    elements.push(textElement({ id: `${id}-lgt-${si + 1}`, text: sers[si].name, bounds: [rx + 18, headY + 7, lw - 18, 20], style: theme.font(14, { fontWeight: 400, color: muted, lineHeight: 1.2 }) }));
    rx -= 14;
  }

  const plotTop = headY + headH + 20;
  const labelH = 34;
  const plotH = h - (plotTop - y) - pad - labelH;
  const baseY = plotTop + plotH;
  const allVals = sers.flatMap((s) => s.values);
  const maxV = Math.max(...allVals);
  const minV = Math.min(0, ...allVals);
  const span = Math.max(1, maxV - minV);

  // Grid lines
  for (let g = 0; g < 4; g++) {
    const gy = Math.round(plotTop + (plotH * g) / 3);
    elements.push(lineElement({ id: `${id}-grid-${g + 1}`, from: [x + pad, gy], to: [x + width - pad, gy], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1, strokeDash: g < 3 ? 'dash' : undefined } }));
  }

  const padX = 38;
  const stepX = (iw - padX * 2) / (cats.length - 1);
  const ptX = (ci) => Math.round(x + pad + padX + ci * stepX);
  const ptY = (val) => Math.round(baseY - ((val - minV) / span) * (plotH - 14));

  // Optional 'bars' combo mode: draw primary series as soft bars + secondary as pop line
  if (variant === 'bars') {
    const main = sers[0];
    const barW = Math.min(54, Math.max(20, Math.round(stepX * 0.44)));
    cats.forEach((cat, ci) => {
      const v = main.values[ci] ?? 0;
      const cx = ptX(ci), cy = ptY(v);
      const bh = Math.max(12, baseY - cy);
      const isLast = ci === cats.length - 1;
      elements.push({ type: 'shape', id: `${id}-cb-${ci + 1}`, bounds: [cx - Math.round(barW / 2), cy, barW, bh], style: { fill: isLast ? r.pop : mixHexLocal(r.primary, surf, p.dark ? 0.25 : 0.35), radius: 8 } });
      elements.push(textElement({ id: `${id}-cv-${ci + 1}`, text: String(v), bounds: [cx - 32, cy - 24, 64, 20], style: theme.font(14, { fontWeight: 700, color: isLast ? r.pop : p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
    });
  }

  // Optional 'area' soft fill under primary curve
  if (variant === 'area') {
    const main = sers[0];
    const pts = cats.map((_, ci) => [ptX(ci) - (x + pad), ptY(main.values[ci] ?? 0) - plotTop]);
    const areaD = `M ${pts[0][0]} ${plotH} ` + pts.map(([px, py]) => `L ${px} ${py}`).join(' ') + ` L ${pts[pts.length - 1][0]} ${plotH} Z`;
    elements.push({
      type: 'vector', id: `${id}-area`,
      bounds: [x + pad, plotTop, iw, plotH],
      viewBox: [0, 0, iw, plotH],
      path: areaD,
      style: { fill: mixHexLocal(r.primary, surf, p.dark ? 0.72 : 0.86), stroke: 'none', strokeWidth: 0 },
    });
  }

  // Draw series lines via crisp SVG vector paths (or dashed segments)
  sers.forEach((s, si) => {
    if (variant === 'bars' && si === 0) return;
    const col = serCol(s, si);
    const pts = cats.map((_, ci) => [ptX(ci), ptY(s.values[ci] ?? 0)]);
    if (s.dashed) {
      for (let ci = 0; ci < pts.length - 1; ci++) {
        elements.push(lineElement({ id: `${id}-dl-${si + 1}-${ci + 1}`, from: pts[ci], to: pts[ci + 1], style: { stroke: col, strokeWidth: 2.5, strokeDash: 'dash' } }));
      }
    } else {
      const relD = pts.map(([px, py], idx) => `${idx === 0 ? 'M' : 'L'} ${px - (x + pad)} ${py - plotTop}`).join(' ');
      elements.push({
        type: 'vector', id: `${id}-ln-${si + 1}`,
        bounds: [x + pad, plotTop, iw, plotH],
        viewBox: [0, 0, iw, plotH],
        path: relD,
        style: { fill: 'none', stroke: col, strokeWidth: si === 0 ? 4 : 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
      });
    }
    if (si === 0 || variant === 'bars') {
      pts.forEach(([px, py], ci) => {
        const isLast = ci === pts.length - 1;
        const dotSz = isLast ? 14 : 10;
        elements.push({ type: 'shape', id: `${id}-dot-${si + 1}-${ci + 1}`, shape: 'ellipse', bounds: [px - dotSz / 2, py - dotSz / 2, dotSz, dotSz], style: { fill: isLast ? r.pop : surf, stroke: isLast ? r.pop : col, strokeWidth: 3, radius: dotSz / 2 } });
        elements.push(textElement({ id: `${id}-vl-${si + 1}-${ci + 1}`, text: String(s.values[ci] ?? ''), bounds: [px - 36, py - 28, 72, 20], style: theme.font(isLast ? 16 : 14, { fontWeight: isLast ? 900 : 700, color: isLast ? r.pop : p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
      });
    }
  });

  // X-axis category labels
  cats.forEach((cat, ci) => {
    const cx = ptX(ci);
    elements.push(textElement({ id: `${id}-cat-${ci + 1}`, text: String(cat), bounds: [cx - 44, baseY + 10, 88, 22], style: theme.font(15, { fontWeight: ci === cats.length - 1 ? 700 : 500, color: ci === cats.length - 1 ? p.ink : muted, textAlign: 'center', lineHeight: 1.2 }) }));
  });
  return { elements, height: h };
}

export function rankedBarList({ id, x, y, width, height, title = '', unit = '', badge = '', items = [], theme, variant = 'bars' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 8).map((it) => ({
    ...it,
    _num: it.num != null ? Number(it.num) : parseChartNum(it.value),
  }));
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const maxN = Math.max(1, ...list.map((it) => it._num));
  const pad = isCompact ? 18 : 26;
  const headH = title ? 44 : 0;
  const iw = width - pad * 2;

  if (variant === 'podium' && list.length >= 3) {
    const top3 = list.slice(0, 3), rest = list.slice(3);
    const natural = isCompact ? 370 : 440;
    const h = Math.max(natural, height || 0);
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'rankedBarList', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw - 200, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      if (unit) elements.push(textElement({ id: `${id}-unit`, text: `单位：${unit}`, bounds: [x + width - pad - 180, curY + 6, 180, 22], style: theme.font(14, { fontWeight: 400, color: muted, textAlign: 'right', lineHeight: 1.2 }) }));
      curY += headH;
    }
    const bodyH = h - (curY - y) - pad;
    const topH = rest.length ? Math.round(bodyH * 0.56) : bodyH;
    const gap = 16;
    const cw = Math.floor((iw - gap * 2) / 3);
    top3.forEach((it, idx) => {
      const cx = x + pad + idx * (cw + gap);
      const isFirst = idx === 0;
      elements.push({ type: 'shape', id: `${id}-pod-${idx + 1}`, bounds: [cx, curY, cw, topH], style: isFirst ? { fill: r.primary, radius: rad } : { fill: subBg, stroke: idx === 1 ? r.primary : (p.line || '#E2E6EE'), strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-ptrim-${idx + 1}`, bounds: [cx + 20, curY, cw - 40, 5], style: { fill: isFirst ? r.pop : (idx === 1 ? r.primary : r.secondary), radius: 3 } });
      elements.push({ type: 'shape', id: `${id}-pnum-${idx + 1}`, bounds: [cx + 20, curY + 20, 56, 26], style: { fill: isFirst ? r.pop : (idx === 1 ? r.primary : muted), radius: 13 } });
      elements.push(textElement({ id: `${id}-pnumt-${idx + 1}`, text: `TOP ${idx + 1}`, bounds: [cx + 20, curY + 23, 56, 20], style: theme.font(13, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-lbl-${idx + 1}`, text: it.label || '', bounds: [cx + 20, curY + 56, cw - 40, 28], style: theme.font(21, { fontWeight: 700, color: isFirst ? (p.inverse || '#FFFFFF') : p.ink, lineHeight: 1.25 }) }));
      elements.push(textElement({ id: `${id}-val-${idx + 1}`, text: String(it.value ?? it._num), bounds: [cx + 20, curY + Math.max(90, topH - 68), cw - 40, 44], style: theme.font(34, { fontWeight: 900, color: isFirst ? (p.inverse || '#FFFFFF') : (idx === 1 ? r.primary : p.ink), lineHeight: 1.15 }) }));
    });
    if (rest.length) {
      const ry0 = curY + topH + 14;
      const rGap = 10;
      const rowH = Math.floor((bodyH - topH - 14 - rGap * (rest.length - 1)) / rest.length);
      rest.forEach((it, ri) => {
        const ry = ry0 + ri * (rowH + rGap);
        const rank = ri + 4;
        elements.push({ type: 'shape', id: `${id}-rrow-${rank}`, bounds: [x + pad, ry, iw, rowH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 10 } });
        elements.push(textElement({ id: `${id}-rn-${rank}`, text: `0${rank}`, bounds: [x + pad + 14, ry + Math.round((rowH - 22) / 2), 34, 22], style: theme.font(15, { fontWeight: 800, color: muted, lineHeight: 1.2 }) }));
        elements.push(textElement({ id: `${id}-lbl-${rank}`, text: it.label || '', bounds: [x + pad + 54, ry + Math.round((rowH - 24) / 2), 200, 24], style: theme.font(18, { fontWeight: 600, color: p.ink, lineHeight: 1.2 }) }));
        const tx = x + pad + 266, tw = iw - 420;
        elements.push({ type: 'shape', id: `${id}-trk-${rank}`, bounds: [tx, ry + Math.round((rowH - 12) / 2), tw, 12], style: { fill: p.dark ? '#1E2C47' : '#E2E8F0', radius: 6 } });
        elements.push({ type: 'shape', id: `${id}-fil-${rank}`, bounds: [tx, ry + Math.round((rowH - 12) / 2), Math.max(20, Math.round((it._num / maxN) * tw)), 12], style: { fill: mixHexLocal(r.primary, surf, 0.3), radius: 6 } });
        elements.push(textElement({ id: `${id}-val-${rank}`, text: String(it.value ?? it._num), bounds: [x + width - pad - 144, ry + Math.round((rowH - 24) / 2), 130, 24], style: theme.font(19, { fontWeight: 800, color: p.ink, textAlign: 'right', lineHeight: 1.2 }) }));
      });
    }
    return { elements, height: h };
  }

  if (variant === 'tiles') {
    const cols = 2, rowsN = Math.ceil(list.length / 2);
    const rGap = 14, cGap = 16;
    const minTileH = 82;
    const natural = pad * 2 + headH + rowsN * minTileH + (rowsN - 1) * rGap;
    const h = Math.max(natural, height || 0);
    const tileH = Math.floor((h - pad * 2 - headH - rGap * (rowsN - 1)) / rowsN);
    const cw = Math.floor((iw - cGap) / cols);
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'rankedBarList', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      curY += headH;
    }
    list.forEach((it, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cx = x + pad + col * (cw + cGap), cy = curY + row * (tileH + rGap);
      const isTop = i === 0;
      const barCol = isTop ? r.pop : (i < 3 ? r.primary : mixHexLocal(r.primary, surf, 0.38));
      elements.push({ type: 'shape', id: `${id}-t-${i + 1}`, bounds: [cx, cy, cw, tileH], style: { fill: subBg, stroke: isTop ? r.pop : (p.line || '#E2E6EE'), strokeWidth: isTop ? 1.5 : 1, radius: 12 } });
      elements.push({ type: 'shape', id: `${id}-nb-${i + 1}`, bounds: [cx + 16, cy + 16, 28, 28], style: { fill: barCol, radius: 8 } });
      elements.push(textElement({ id: `${id}-nt-${i + 1}`, text: String(i + 1), bounds: [cx + 16, cy + 19, 28, 22], style: theme.font(15, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [cx + 54, cy + 18, cw - 200, 26], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-val-${i + 1}`, text: String(it.value ?? it._num), bounds: [cx + cw - 144, cy + 16, 128, 28], style: theme.font(22, { fontWeight: 900, color: isTop ? r.pop : p.ink, textAlign: 'right', lineHeight: 1.2 }) }));
      const tw = cw - 32;
      elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [cx + 16, cy + tileH - 22, tw, 10], style: { fill: p.dark ? '#1E2C47' : '#E2E8F0', radius: 5 } });
      elements.push({ type: 'shape', id: `${id}-fil-${i + 1}`, bounds: [cx + 16, cy + tileH - 22, Math.max(20, Math.round((it._num / maxN) * tw)), 10], style: { fill: barCol, radius: 5 } });
    });
    return { elements, height: h };
  }

  // Default 'bars' (Tremor Ranked BarList)
  const rowGap = isCompact ? 10 : 14;
  const minRowH = isCompact ? 46 : 56;
  const natural = pad * 2 + headH + list.length * minRowH + (list.length - 1) * rowGap;
  const h = Math.max(natural, height || 0);
  const rowH = Math.floor((h - pad * 2 - headH - rowGap * (list.length - 1)) / list.length);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'rankedBarList', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw - 220, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    const rHint = badge || (unit ? `单位：${unit}` : '');
    if (rHint) elements.push(textElement({ id: `${id}-unit`, text: rHint, bounds: [x + width - pad - 200, curY + 6, 200, 22], style: theme.font(14, { fontWeight: 500, color: muted, textAlign: 'right', lineHeight: 1.2 }) }));
    curY += headH;
  }
  const lblW = Math.min(260, Math.round(iw * 0.2));
  const valW = 190;
  const trackW = iw - 56 - lblW - valW - 28;
  list.forEach((it, i) => {
    const ry = curY + i * (rowH + rowGap);
    const isTop = i === 0;
    const col = isTop ? r.pop : (i < 3 ? r.primary : mixHexLocal(r.primary, surf, p.dark ? 0.35 : 0.45));
    elements.push({ type: 'shape', id: `${id}-row-${i + 1}`, bounds: [x + pad, ry, iw, rowH], style: { fill: isTop ? (p.dark ? '#2B1B14' : '#FFF7ED') : subBg, stroke: isTop ? r.pop : (p.line || '#E2E6EE'), strokeWidth: isTop ? 1.5 : 1, radius: 12 } });
    const nSz = 30;
    elements.push({ type: 'shape', id: `${id}-nb-${i + 1}`, bounds: [x + pad + 14, ry + Math.round((rowH - nSz) / 2), nSz, nSz], style: { fill: col, radius: 8 } });
    elements.push(textElement({ id: `${id}-nt-${i + 1}`, text: String(i + 1), bounds: [x + pad + 14, ry + Math.round((rowH - 22) / 2), nSz, 22], style: theme.font(15, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [x + pad + 56, ry + Math.round((rowH - 24) / 2), lblW - 10, 26], style: theme.font(19, { fontWeight: i < 3 ? 700 : 500, color: p.ink, lineHeight: 1.25 }) }));
    const tx = x + pad + 56 + lblW + 8;
    const barH = 14;
    elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [tx, ry + Math.round((rowH - barH) / 2), trackW, barH], style: { fill: p.dark ? '#1E2C47' : '#E2E8F0', radius: 7 } });
    elements.push({ type: 'shape', id: `${id}-fil-${i + 1}`, bounds: [tx, ry + Math.round((rowH - barH) / 2), Math.max(24, Math.round((it._num / maxN) * trackW)), barH], style: { fill: col, radius: 7 } });
    const vDisp = `${it.value ?? it._num}${it.delta ? `  ${it.delta}` : ''}`;
    elements.push(textElement({ id: `${id}-val-${i + 1}`, text: vDisp, bounds: [x + width - pad - valW - 14, ry + Math.round((rowH - 26) / 2), valW, 26], style: theme.font(20, { fontWeight: 900, color: isTop ? r.pop : p.ink, textAlign: 'right', lineHeight: 1.2 }) }));
  });
  return { elements, height: h };
}

export function executiveBriefCard({ id, x, y, width, height, badge = '', headline = '', value = '', unit = '', summary = '', metrics = [], theme, variant = 'bento' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(metrics) ? metrics : []).slice(0, 4);
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 16;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#059669';
  const natural = isCompact ? 370 : 450;
  const h = Math.max(natural, height || 0);
  const elements = [];

  const metricTone = (m) => (m.tone === 'ok' ? okCol : m.tone === 'pop' ? r.pop : m.tone === 'primary' ? r.primary : p.ink);

  if (variant === 'topHero') {
    const gap = 18;
    const heroH = Math.round(h * 0.52);
    const botH = h - heroH - gap;
    elements.push({ type: 'shape', id: `${id}-hero`, component: 'executiveBrief', bounds: [x, y, width, heroH], style: { fill: r.primary, radius: rad } });
    elements.push({ type: 'shape', id: `${id}-htrim`, bounds: [x + 28, y, width - 56, 6], style: { fill: r.pop, radius: 3 } });
    const leftW = value ? Math.round(width * 0.38) : 0;
    if (badge) {
      const bW = Math.min(260, Math.max(110, Math.ceil(textWidth(badge, 13) * 1.2) + 26));
      elements.push({ type: 'shape', id: `${id}-hbg`, bounds: [x + 32, y + 26, bW, 28], style: { fill: r.pop, radius: 14 } });
      elements.push(textElement({ id: `${id}-hbtx`, text: badge, bounds: [x + 38, y + 30, bW - 12, 20], style: theme.font(13, { fontWeight: 800, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    }
    if (value) {
      elements.push(textElement({ id: `${id}-hval`, text: `${value}${unit}`, bounds: [x + 32, y + Math.round(heroH * 0.38), leftW - 44, 88], style: theme.font(68, { fontWeight: 900, color: p.inverse || '#FFFFFF', lineHeight: 1.05 }) }));
    }
    const rx = x + (leftW ? leftW + 16 : 32);
    const rw = width - (rx - x) - 36;
    if (headline) {
      elements.push(textElement({ id: `${id}-ht`, text: headline, bounds: [rx, y + 48, rw, 44], style: theme.font(28, { fontWeight: 700, color: p.inverse || '#FFFFFF', lineHeight: 1.25 }) }));
    }
    if (summary) {
      elements.push(textElement({ id: `${id}-hs`, text: summary, bounds: [rx, y + 102, rw, Math.max(54, heroH - 120)], style: theme.font(20, { fontWeight: 300, color: mixHexLocal(r.primary, '#FFFFFF', 0.85), lineHeight: 1.5 }) }));
    }
    if (list.length) {
      const cw = Math.floor((width - gap * (list.length - 1)) / list.length);
      list.forEach((m, i) => {
        const cx = x + i * (cw + gap), cy = y + heroH + gap;
        elements.push({ type: 'shape', id: `${id}-m-${i + 1}`, bounds: [cx, cy, cw, botH], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } });
        elements.push({ type: 'shape', id: `${id}-mt-${i + 1}`, bounds: [cx + 20, cy, cw - 40, 4], style: { fill: i === 0 ? r.pop : r.primary, radius: 2 } });
        elements.push(textElement({ id: `${id}-ml-${i + 1}`, text: m.label || '', bounds: [cx + 22, cy + 22, cw - 44, 24], style: theme.font(17, { fontWeight: 500, color: muted, lineHeight: 1.25 }) }));
        elements.push(textElement({ id: `${id}-mv-${i + 1}`, text: `${m.value ?? ''}${m.unit || ''}`, bounds: [cx + 22, cy + Math.round(botH * 0.36), cw - 44, 52], style: theme.font(38, { fontWeight: 900, color: metricTone(m), lineHeight: 1.15 }) }));
        if (m.delta) {
          elements.push(textElement({ id: `${id}-md-${i + 1}`, text: String(m.delta), bounds: [cx + 22, cy + botH - 36, cw - 44, 22], style: theme.font(15, { fontWeight: 700, color: m.tone === 'pop' ? r.pop : okCol, lineHeight: 1.2 }) }));
        }
      });
    }
    return { elements, height: h };
  }

  // Default 'bento' & 'light' (Left 46% Hero Card + Right 54% 2x2 Sub-Cards)
  const isLight = variant === 'light';
  const gap = 20;
  const heroW = list.length ? Math.round((width - gap) * 0.46) : width;
  elements.push({
    type: 'shape', id: `${id}-hero`, component: 'executiveBrief',
    bounds: [x, y, heroW, h],
    style: isLight
      ? { fill: surf, stroke: r.primary, strokeWidth: 2, radius: rad }
      : { fill: r.primary, radius: rad },
  });
  elements.push({ type: 'shape', id: `${id}-htrim`, bounds: [x + 26, y, heroW - 52, 6], style: { fill: r.pop, radius: 3 } });
  const hPad = 32;
  let hy = y + 32;
  if (badge) {
    const bW = Math.min(heroW - hPad * 2, Math.max(110, Math.ceil(textWidth(badge, 13) * 1.2) + 26));
    elements.push({ type: 'shape', id: `${id}-hbg`, bounds: [x + hPad, hy, bW, 28], style: { fill: isLight ? (p.pale || '#EEF2FF') : r.pop, radius: 14 } });
    elements.push(textElement({ id: `${id}-hbtx`, text: badge, bounds: [x + hPad + 6, hy + 4, bW - 12, 20], style: theme.font(13, { fontWeight: 800, color: isLight ? r.primary : '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    hy += 46;
  }
  if (value) {
    elements.push(textElement({ id: `${id}-hval`, text: `${value}${unit}`, bounds: [x + hPad, hy, heroW - hPad * 2, 86], style: theme.font(72, { fontWeight: 900, color: isLight ? r.primary : (p.inverse || '#FFFFFF'), lineHeight: 1.05 }) }));
    hy += 98;
  }
  if (headline) {
    elements.push(textElement({ id: `${id}-ht`, text: headline, bounds: [x + hPad, hy, heroW - hPad * 2, 66], style: theme.font(26, { fontWeight: 700, color: isLight ? p.ink : (p.inverse || '#FFFFFF'), lineHeight: 1.28 }) }));
    hy += 72;
  }
  if (summary) {
    elements.push(textElement({ id: `${id}-hs`, text: summary, bounds: [x + hPad, hy, heroW - hPad * 2, Math.max(54, y + h - hy - 26)], style: theme.font(20, { fontWeight: 300, color: isLight ? muted : mixHexLocal(r.primary, '#FFFFFF', 0.85), lineHeight: 1.5 }) }));
  }

  if (list.length) {
    const rx = x + heroW + gap, rw = width - heroW - gap;
    const cols = list.length <= 2 ? 1 : 2;
    const rowsN = Math.ceil(list.length / cols);
    const cGap = 16, rGap = 16;
    const cw = Math.floor((rw - cGap * (cols - 1)) / cols);
    const ch = Math.floor((h - rGap * (rowsN - 1)) / rowsN);
    const iconGlyphs = ['★', '✓', '⚡', '♥'];
    list.forEach((m, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = rx + col * (cw + cGap), cy = y + row * (ch + rGap);
      const accentC = m.tone === 'pop' ? r.pop : (m.tone === 'ok' ? okCol : r.primary);
      const softBg = m.tone === 'pop' ? (p.dark ? '#331E12' : '#FFF7ED') : (m.tone === 'ok' ? (p.dark ? '#11302B' : '#ECFDF5') : (p.pale || '#EEF2FF'));
      elements.push({ type: 'shape', id: `${id}-m-${i + 1}`, bounds: [cx, cy, cw, ch], style: { fill: isLight ? subBg : surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-mt-${i + 1}`, bounds: [cx + 20, cy, cw - 40, 4], style: { fill: accentC, radius: 2 } });

      const valFull = `${m.value ?? ''}${m.unit || ''}`;
      const isWide = cw / Math.max(1, ch) >= 1.55 && cw >= 320;
      if (isWide) {
        // Aspect-aware horizontal split: Left (icon + title + delta pill) | Right (giant 900 readout)
        const leftBoxW = Math.round(cw * 0.48);
        const rightBoxX = cx + leftBoxW + 8;
        const rightBoxW = cw - leftBoxW - 30;
        const icSz = 36;
        const blockH = icSz + 10 + 26 + (m.delta ? 34 : 0);
        const ly0 = cy + Math.max(16, Math.round((ch - blockH) / 2));
        elements.push({ type: 'shape', id: `${id}-mic-${i + 1}`, bounds: [cx + 22, ly0, icSz, icSz], style: { fill: softBg, radius: 10 } });
        elements.push(textElement({ id: `${id}-mict-${i + 1}`, text: m.icon || iconGlyphs[i % iconGlyphs.length], bounds: [cx + 22, ly0 + 7, icSz, 22], style: theme.font(18, { fontWeight: 900, color: accentC, textAlign: 'center', lineHeight: 1.2 }) }));
        elements.push(textElement({ id: `${id}-ml-${i + 1}`, text: m.label || '', bounds: [cx + 22, ly0 + icSz + 10, leftBoxW - 22, 26], style: theme.font(18, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
        if (m.delta) {
          const dW = Math.min(leftBoxW - 22, Math.max(96, Math.ceil(textWidth(String(m.delta), 13) * 1.18) + 22));
          elements.push({ type: 'shape', id: `${id}-mdb-${i + 1}`, bounds: [cx + 22, ly0 + icSz + 42, dW, 24], style: { fill: softBg, radius: 12 } });
          elements.push(textElement({ id: `${id}-md-${i + 1}`, text: String(m.delta), bounds: [cx + 28, ly0 + icSz + 45, dW - 12, 18], style: theme.font(13, { fontWeight: 700, color: accentC, textAlign: 'center', lineHeight: 1.2 }) }));
        }
        const vFs = Math.max(36, Math.min(58, Math.floor((rightBoxW * 0.96) / Math.max(1, textWidth(valFull, 1)))));
        elements.push(textElement({ id: `${id}-mv-${i + 1}`, text: valFull, bounds: [rightBoxX, cy + Math.round((ch - Math.ceil(vFs * 1.15)) / 2), rightBoxW, Math.ceil(vFs * 1.15)], style: theme.font(vFs, { fontWeight: 900, color: metricTone(m), textAlign: 'right', lineHeight: 1.1 }) }));
      } else {
        elements.push(textElement({ id: `${id}-ml-${i + 1}`, text: m.label || '', bounds: [cx + 24, cy + 24, cw - 48, 26], style: theme.font(18, { fontWeight: 500, color: muted, lineHeight: 1.25 }) }));
        elements.push(textElement({ id: `${id}-mv-${i + 1}`, text: valFull, bounds: [cx + 24, cy + Math.round(ch * 0.38), cw - 48, 56], style: theme.font(cw < 360 ? 38 : 46, { fontWeight: 900, color: metricTone(m), lineHeight: 1.15 }) }));
        if (m.delta) {
          elements.push(textElement({ id: `${id}-md-${i + 1}`, text: String(m.delta), bounds: [cx + 24, cy + ch - 40, cw - 48, 24], style: theme.font(16, { fontWeight: 700, color: m.tone === 'pop' ? r.pop : okCol, lineHeight: 1.2 }) }));
        }
      }
    });
  }
  return { elements, height: h };
}

// =========================================================================
// Modern Web UI v2 Batch 2 (Strategic Infographics):
//   - orbitFlywheel (V2-INFO-01: Orbit Growth Flywheel / Cycle / Grid)
//   - icebergModel  (V2-INFO-02: Surface vs Deep Root-Cause Iceberg)
//   - radarScoreCard(V2-INFO-03: Smooth SVG Polygon Radar + Score Breakdown)
// =========================================================================

export function orbitFlywheel({ id, x, y, width, height, title = '', center = {}, nodes = [], theme, variant = 'orbit' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(nodes) ? nodes : []).slice(0, 6);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#059669';
  const nodeCols = [r.primary, r.pop, r.secondary, okCol, mixHexLocal(r.primary, '#FFFFFF', 0.25), muted];
  const pad = isCompact ? 18 : 24;
  const headH = title ? (isCompact ? 36 : 42) : 0;
  const natural = isCompact ? 390 : 460;
  const h = Math.max(natural, height || 0);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'orbitFlywheel', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  const iw = width - pad * 2;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    curY += headH;
  }
  const bodyH = h - (curY - y) - pad;

  if (variant === 'cycle') {
    const retH = 44;
    const cardH = Math.max(180, bodyH - retH);
    const arrowGap = 28;
    const cw = Math.floor((iw - arrowGap * (list.length - 1)) / list.length);
    list.forEach((nd, i) => {
      const cx = x + pad + i * (cw + arrowGap);
      const col = nodeCols[i % nodeCols.length];
      elements.push({ type: 'shape', id: `${id}-nc-${i + 1}`, bounds: [cx, curY, cw, cardH], style: { fill: subBg, stroke: i === 0 ? r.primary : (p.line || '#E2E6EE'), strokeWidth: i === 0 ? 2 : 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-ntrim-${i + 1}`, bounds: [cx + 18, curY, cw - 36, 5], style: { fill: col, radius: 3 } });
      elements.push({ type: 'shape', id: `${id}-nb-${i + 1}`, bounds: [cx + 18, curY + 20, 32, 32], style: { fill: col, radius: 10 } });
      elements.push(textElement({ id: `${id}-nbt-${i + 1}`, text: `0${i + 1}`, bounds: [cx + 18, curY + 24, 32, 24], style: theme.font(15, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-nt-${i + 1}`, text: nd.title || '', bounds: [cx + 18, curY + 64, cw - 36, 54], style: theme.font(20, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (nd.detail) {
        elements.push(textElement({ id: `${id}-nd-${i + 1}`, text: nd.detail, bounds: [cx + 18, curY + 124, cw - 36, Math.max(48, cardH - 140)], style: theme.font(17, { fontWeight: 300, color: muted, lineHeight: 1.42 }) }));
      }
      if (i < list.length - 1) {
        const my = curY + Math.round(cardH / 2);
        elements.push({ ...lineElement({ id: `${id}-arr-${i + 1}`, from: [cx + cw + 3, my], to: [cx + cw + arrowGap - 3, my], style: { stroke: col, strokeWidth: 2.5 } }), endArrow: true });
      }
    });
    // Return feedback loop line
    const ly = curY + cardH + 26;
    const xStart = x + pad + iw - Math.round(cw / 2);
    const xEnd = x + pad + Math.round(cw / 2);
    elements.push(lineElement({ id: `${id}-ret-r`, from: [xStart, curY + cardH + 4], to: [xStart, ly], style: { stroke: r.pop, strokeWidth: 2, strokeDash: 'dash' } }));
    elements.push(lineElement({ id: `${id}-ret-b`, from: [xStart, ly], to: [xEnd, ly], style: { stroke: r.pop, strokeWidth: 2, strokeDash: 'dash' } }));
    elements.push({ ...lineElement({ id: `${id}-ret-l`, from: [xEnd, ly], to: [xEnd, curY + cardH + 4], style: { stroke: r.pop, strokeWidth: 2, strokeDash: 'dash' } }), endArrow: true });
    const retLbl = center.title ? `${center.title} · 持续正循环` : '持续正循环飞轮';
    const rlW = Math.min(320, Math.max(160, Math.ceil(textWidth(retLbl, 14) * 1.2) + 28));
    elements.push({ type: 'shape', id: `${id}-ret-bg`, bounds: [x + Math.round((width - rlW) / 2), ly - 13, rlW, 26], style: { fill: surf, stroke: r.pop, strokeWidth: 1.2, radius: 13 } });
    elements.push(textElement({ id: `${id}-ret-tx`, text: retLbl, bounds: [x + Math.round((width - rlW) / 2) + 8, ly - 9, rlW - 16, 18], style: theme.font(13, { fontWeight: 700, color: r.pop, textAlign: 'center', lineHeight: 1.2 }) }));
    return { elements, height: h };
  }

  if (variant === 'grid') {
    const hubH = 74, gap = 16;
    elements.push({ type: 'shape', id: `${id}-hub`, bounds: [x + pad, curY, iw, hubH], style: { fill: r.primary, radius: rad } });
    elements.push({ type: 'shape', id: `${id}-htrim`, bounds: [x + pad + 24, curY, iw - 48, 5], style: { fill: r.pop, radius: 3 } });
    const cBadge = center.badge || 'CORE';
    const cbW = Math.max(76, Math.ceil(textWidth(cBadge, 13) * 1.2) + 24);
    elements.push({ type: 'shape', id: `${id}-hbg`, bounds: [x + pad + 22, curY + 23, cbW, 28], style: { fill: r.pop, radius: 14 } });
    elements.push(textElement({ id: `${id}-hbtx`, text: cBadge, bounds: [x + pad + 26, curY + 27, cbW - 8, 20], style: theme.font(13, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-ht`, text: center.title || '核心飞轮', bounds: [x + pad + cbW + 38, curY + 21, 360, 32], style: theme.font(24, { fontWeight: 900, color: p.inverse || '#FFFFFF', lineHeight: 1.25 }) }));
    if (center.sub) {
      elements.push(textElement({ id: `${id}-hsub`, text: center.sub, bounds: [x + pad + cbW + 408, curY + 25, Math.max(180, iw - cbW - 432), 26], style: theme.font(17, { fontWeight: 300, color: mixHexLocal(r.primary, '#FFFFFF', 0.82), textAlign: 'right', lineHeight: 1.25 }) }));
    }
    const cols = 2, rowsN = Math.ceil(list.length / 2);
    const gridTop = curY + hubH + gap, gridH = bodyH - hubH - gap;
    const cw = Math.floor((iw - gap) / 2), ch = Math.floor((gridH - gap * (rowsN - 1)) / rowsN);
    list.forEach((nd, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cx = x + pad + col * (cw + gap), cy = gridTop + row * (ch + gap);
      const colr = nodeCols[i % nodeCols.length];
      elements.push({ type: 'shape', id: `${id}-nc-${i + 1}`, bounds: [cx, cy, cw, ch], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-nbar-${i + 1}`, bounds: [cx, cy + 14, 5, Math.max(24, ch - 28)], style: { fill: colr, radius: 3 } });
      elements.push(textElement({ id: `${id}-nt-${i + 1}`, text: `0${i + 1}  ${nd.title || ''}`, bounds: [cx + 22, cy + 18, cw - 40, 28], style: theme.font(20, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (nd.detail) {
        elements.push(textElement({ id: `${id}-nd-${i + 1}`, text: nd.detail, bounds: [cx + 22, cy + 52, cw - 40, Math.max(36, ch - 64)], style: theme.font(18, { fontWeight: 300, color: muted, lineHeight: 1.4 }) }));
      }
    });
    return { elements, height: h };
  }

  // Default 'orbit': left nodes + center circular hub with outer dashed orbit ring + right nodes
  const midX = x + Math.round(width / 2);
  const midY = curY + Math.round(bodyH / 2);
  const hubR = Math.min(92, Math.max(72, Math.floor(bodyH * 0.24)));
  const orbitR = hubR + 34;

  // Outer dashed orbit ring via SVG vector
  const orbBox = (orbitR + 8) * 2;
  const oc = orbitR + 8;
  const orbPath = `M ${oc} ${oc - orbitR} A ${orbitR} ${orbitR} 0 1 1 ${oc} ${oc + orbitR} A ${orbitR} ${orbitR} 0 1 1 ${oc} ${oc - orbitR}`;
  elements.push({
    type: 'vector', id: `${id}-orb-ring`, shape: 'ellipse',
    bounds: [midX - oc, midY - oc, orbBox, orbBox],
    viewBox: [0, 0, orbBox, orbBox],
    path: orbPath,
    style: { fill: 'none', stroke: p.line || '#CBD5E1', strokeWidth: 2 },
  });

  const leftCount = Math.ceil(list.length / 2);
  const leftNodes = list.slice(0, leftCount);
  const rightNodes = list.slice(leftCount);
  const colW = Math.floor((iw - orbitR * 2 - 56) / 2);
  const leftX = x + pad;
  const rightX = x + width - pad - colW;

  const drawSide = (sideList, sx, isRight, idxOffset) => {
    const nGap = 22;
    const detFs = adaptiveBodyFont(sideList.map((n) => n.detail || '').sort((a, b) => b.length - a.length)[0], isCompact, 19);
    const maxDetLines = Math.max(1, ...sideList.map((nd) => (nd.detail ? estimateLines(nd.detail, detFs, colW - 44) : 0)));
    const contentH = 56 + Math.ceil(maxDetLines * detFs * 1.42) + 20;
    const maxSlotH = Math.floor((bodyH - nGap * Math.max(0, sideList.length - 1)) / Math.max(1, sideList.length));
    const cardH = fitCardHeight(contentH, maxSlotH, { maxStretch: 1.28, minH: 108 });
    const totalSideH = sideList.length * cardH + (sideList.length - 1) * nGap;
    const sy0 = curY + Math.round((bodyH - totalSideH) / 2);
    sideList.forEach((nd, i) => {
      const globalIdx = isRight ? idxOffset + i : i;
      const cy = sy0 + i * (cardH + nGap);
      const colr = nodeCols[globalIdx % nodeCols.length];
      const autoMetric = extractCardMetric(nd.detail, nd.metric);
      elements.push({ type: 'shape', id: `${id}-nc-${globalIdx + 1}`, bounds: [sx, cy, colW, cardH], style: { fill: subBg, stroke: globalIdx === 0 ? r.primary : (p.line || '#E2E6EE'), strokeWidth: globalIdx === 0 ? 1.8 : 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-ntrim-${globalIdx + 1}`, bounds: [sx, cy + 14, 5, Math.max(24, cardH - 28)], style: { fill: colr, radius: 3 } });
      // Subtle corner watermark
      elements.push(textElement({ id: `${id}-nwm-${globalIdx + 1}`, text: `0${globalIdx + 1}`, bounds: [sx + colW - 76, cy + cardH - 52, 64, 48], style: theme.font(44, { fontWeight: 900, color: mixHexLocal(colr, subBg, 0.88), textAlign: 'right', lineHeight: 1 }) }));
      elements.push({ type: 'shape', id: `${id}-nb-${globalIdx + 1}`, bounds: [sx + 20, cy + 16, 28, 28], style: { fill: colr, radius: 8 } });
      elements.push(textElement({ id: `${id}-nbt-${globalIdx + 1}`, text: `0${globalIdx + 1}`, bounds: [sx + 20, cy + 19, 28, 22], style: theme.font(14, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
      const metW = autoMetric ? Math.min(120, Math.max(66, Math.ceil(textWidth(autoMetric, 15) * 1.18) + 20)) : 0;
      elements.push(textElement({ id: `${id}-nt-${globalIdx + 1}`, text: nd.title || '', bounds: [sx + 58, cy + 16, colW - 76 - metW, 28], style: theme.font(21, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (autoMetric) {
        elements.push({ type: 'shape', id: `${id}-nmb-${globalIdx + 1}`, bounds: [sx + colW - metW - 16, cy + 16, metW, 28], style: { fill: p.pale || '#EEF2FF', radius: 8 } });
        elements.push(textElement({ id: `${id}-nmt-${globalIdx + 1}`, text: autoMetric, bounds: [sx + colW - metW - 12, cy + 20, metW - 8, 20], style: theme.font(15, { fontWeight: 900, color: colr, textAlign: 'center', lineHeight: 1.2 }) }));
      }
      if (nd.detail) {
        elements.push(textElement({ id: `${id}-nd-${globalIdx + 1}`, text: nd.detail, bounds: [sx + 20, cy + 52, colW - 44, Math.max(32, cardH - 64)], style: theme.font(detFs, { fontWeight: 300, color: muted, lineHeight: 1.42 }) }));
      }
      // Connector arrow toward/from center orbit
      const cardMidY = cy + Math.round(cardH / 2);
      const fromPt = isRight ? [midX + orbitR + 4, cardMidY] : [sx + colW + 4, cardMidY];
      const toPt = isRight ? [sx - 4, cardMidY] : [midX - orbitR - 4, cardMidY];
      elements.push({ ...lineElement({ id: `${id}-ln-${globalIdx + 1}`, from: fromPt, to: toPt, style: { stroke: colr, strokeWidth: 2 } }), endArrow: true });
    });
  };

  drawSide(leftNodes, leftX, false, 0);
  drawSide(rightNodes, rightX, true, leftCount);

  // Center circular hub
  elements.push({ type: 'shape', id: `${id}-hub-halo`, shape: 'ellipse', bounds: [midX - hubR - 12, midY - hubR - 12, (hubR + 12) * 2, (hubR + 12) * 2], style: { fill: p.pale || '#EEF2FF', radius: hubR + 12 } });
  elements.push({ type: 'shape', id: `${id}-hub`, shape: 'ellipse', bounds: [midX - hubR, midY - hubR, hubR * 2, hubR * 2], style: { fill: r.primary, radius: hubR } });
  const cBadge = center.badge || 'CORE';
  const cbW = Math.min(hubR * 1.4, Math.max(66, Math.ceil(textWidth(cBadge, 12) * 1.2) + 20));
  elements.push({ type: 'shape', id: `${id}-hbg`, bounds: [midX - Math.round(cbW / 2), midY - 46, cbW, 22], style: { fill: r.pop, radius: 11 } });
  elements.push(textElement({ id: `${id}-hbtx`, text: cBadge, bounds: [midX - Math.round(cbW / 2) + 4, midY - 43, cbW - 8, 16], style: theme.font(12, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
  elements.push(textElement({ id: `${id}-ht`, text: center.title || '增长飞轮', bounds: [midX - hubR + 14, midY - 14, (hubR - 14) * 2, 32], style: theme.font(22, { fontWeight: 900, color: p.inverse || '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
  if (center.sub) {
    elements.push(textElement({ id: `${id}-hsub`, text: center.sub, bounds: [midX - hubR + 16, midY + 22, (hubR - 16) * 2, 36], style: theme.font(14, { fontWeight: 300, color: mixHexLocal(r.primary, '#FFFFFF', 0.85), textAlign: 'center', lineHeight: 1.3 }) }));
  }

  return { elements, height: h };
}

export function icebergModel({ id, x, y, width, height, title = '', waterlineLabel = '海平面 · 透过现象看本质', surface = {}, deep = {}, theme, variant = 'iceberg' }) {
  const p = theme.palette, r = colorRoles(p);
  const deepItems = (Array.isArray(deep) ? deep : (Array.isArray(deep?.items) ? deep.items : [])).slice(0, 4);
  if (!surface?.title && !deepItems.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const pad = isCompact ? 18 : 24;
  const headH = title ? (isCompact ? 36 : 42) : 0;
  const natural = isCompact ? 380 : 460;
  const h = Math.max(natural, height || 0);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'icebergModel', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  const iw = width - pad * 2;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    curY += headH;
  }
  const bodyH = h - (curY - y) - pad;

  if (variant === 'split') {
    const gap = 42;
    const leftW = Math.round((iw - gap) * 0.36);
    const rightX = x + pad + leftW + gap;
    const rightW = iw - leftW - gap;
    elements.push({ type: 'shape', id: `${id}-surf`, bounds: [x + pad, curY, leftW, bodyH], style: { fill: p.pale || '#EEF2FF', stroke: r.primary, strokeWidth: 2, radius: rad } });
    const sBadge = surface.badge || '水面表象 · 20%';
    const sbW = Math.min(leftW - 40, Math.max(110, Math.ceil(textWidth(sBadge, 13) * 1.2) + 24));
    elements.push({ type: 'shape', id: `${id}-sbg`, bounds: [x + pad + 22, curY + 24, sbW, 28], style: { fill: r.pop, radius: 14 } });
    elements.push(textElement({ id: `${id}-sbtx`, text: sBadge, bounds: [x + pad + 28, curY + 28, sbW - 12, 20], style: theme.font(13, { fontWeight: 800, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-st`, text: surface.title || '可见现象', bounds: [x + pad + 22, curY + 68, leftW - 44, 54], style: theme.font(24, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
    const sBody = surface.summary || (Array.isArray(surface.items) ? surface.items.map((s) => `• ${s}`).join('\n') : '');
    if (sBody) {
      elements.push(textElement({ id: `${id}-sd`, text: sBody, bounds: [x + pad + 22, curY + 132, leftW - 44, Math.max(60, bodyH - 152)], style: theme.font(19, { fontWeight: 300, color: muted, lineHeight: 1.48 }) }));
    }
    elements.push({ ...lineElement({ id: `${id}-arr`, from: [x + pad + leftW + 6, curY + Math.round(bodyH / 2)], to: [rightX - 6, curY + Math.round(bodyH / 2)], style: { stroke: r.pop, strokeWidth: 3 } }), endArrow: true });

    const rGap = 14;
    const rowH = Math.floor((bodyH - rGap * Math.max(0, deepItems.length - 1)) / Math.max(1, deepItems.length));
    deepItems.forEach((di, i) => {
      const ry = curY + i * (rowH + rGap);
      elements.push({ type: 'shape', id: `${id}-dc-${i + 1}`, bounds: [rightX, ry, rightW, rowH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } });
      elements.push({ type: 'shape', id: `${id}-dbar-${i + 1}`, bounds: [rightX, ry + 14, 5, Math.max(24, rowH - 28)], style: { fill: i === 0 ? r.pop : r.primary, radius: 3 } });
      elements.push(textElement({ id: `${id}-dt-${i + 1}`, text: `深层根因 0${i + 1} · ${di.title || ''}`, bounds: [rightX + 22, ry + 14, rightW - 40, 26], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (di.detail) {
        elements.push(textElement({ id: `${id}-dd-${i + 1}`, text: di.detail, bounds: [rightX + 22, ry + 46, rightW - 40, Math.max(30, rowH - 54)], style: theme.font(18, { fontWeight: 300, color: muted, lineHeight: 1.4 }) }));
      }
    });
    return { elements, height: h };
  }

  // Default 'iceberg' & 'darkDeep'
  const isDarkDeep = variant === 'darkDeep';
  const topH = Math.round(bodyH * 0.30);
  const lineH = 44;
  const botH = bodyH - topH - lineH;

  // Surface card (centered slightly narrower like iceberg tip)
  const tipW = Math.round(iw * 0.78);
  const tipX = x + pad + Math.round((iw - tipW) / 2);
  elements.push({ type: 'shape', id: `${id}-surf`, bounds: [tipX, curY, tipW, topH], style: { fill: p.pale || '#EEF2FF', stroke: r.primary, strokeWidth: 2, radius: rad } });
  const sBadge = surface.badge || '可见表象 · 20%';
  const sbW = Math.min(200, Math.max(112, Math.ceil(textWidth(sBadge, 13) * 1.2) + 24));
  elements.push({ type: 'shape', id: `${id}-sbg`, bounds: [tipX + tipW - sbW - 22, curY + 20, sbW, 26], style: { fill: r.pop, radius: 13 } });
  elements.push(textElement({ id: `${id}-sbtx`, text: sBadge, bounds: [tipX + tipW - sbW - 16, curY + 23, sbW - 12, 20], style: theme.font(13, { fontWeight: 800, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
  elements.push(textElement({ id: `${id}-st`, text: surface.title || '水面之上 · 外显症状', bounds: [tipX + 24, curY + 18, tipW - sbW - 60, 28], style: theme.font(21, { fontWeight: 700, color: readableInk(r.primary, p.pale || '#EEF2FF'), lineHeight: 1.25 }) }));
  const sBody = surface.summary || (Array.isArray(surface.items) ? surface.items.join('  ·  ') : '');
  if (sBody) {
    elements.push(textElement({ id: `${id}-sd`, text: sBody, bounds: [tipX + 24, curY + 52, tipW - 48, Math.max(36, topH - 62)], style: theme.font(18, { fontWeight: 300, color: p.ink, lineHeight: 1.4 }) }));
  }

  // Waterline dashed rule + pill
  const wy = curY + topH + Math.round(lineH / 2);
  elements.push(lineElement({ id: `${id}-water`, from: [x + pad, wy], to: [x + width - pad, wy], style: { stroke: r.pop, strokeWidth: 2, strokeDash: 'dash' } }));
  const wlW = Math.min(360, Math.max(180, Math.ceil(textWidth(waterlineLabel, 13) * 1.2) + 32));
  elements.push({ type: 'shape', id: `${id}-wbg`, bounds: [x + Math.round((width - wlW) / 2), wy - 13, wlW, 26], style: { fill: surf, stroke: r.pop, strokeWidth: 1.5, radius: 13 } });
  elements.push(textElement({ id: `${id}-wtx`, text: waterlineLabel, bounds: [x + Math.round((width - wlW) / 2) + 8, wy - 9, wlW - 16, 18], style: theme.font(13, { fontWeight: 800, color: r.pop, textAlign: 'center', lineHeight: 1.2 }) }));

  // Deep underwater container & cards (content-driven height + auto metric corner badge)
  const botY = curY + topH + lineH;
  const dPad = isDarkDeep ? 18 : 0;
  const dGap = 16;
  const dw = Math.floor((iw - dPad * 2 - dGap * (deepItems.length - 1)) / Math.max(1, deepItems.length));
  const detFs = adaptiveBodyFont(deepItems.map((x) => x.detail || '').sort((a, b) => b.length - a.length)[0], isCompact, 20);
  const maxLines = Math.max(2, ...deepItems.map((di) => (di.detail ? estimateLines(di.detail, detFs, dw - 40) : 1)));
  const contentDeepH = 92 + Math.ceil(maxLines * detFs * 1.45) + 22;
  const dh = fitCardHeight(contentDeepH, botH - dPad * 2, { maxStretch: 1.28, minH: 148 });
  const actualBotH = dh + dPad * 2;
  const actualPanelH = (botY - y) + actualBotH + pad;
  elements[0].bounds[3] = actualPanelH;
  if (isDarkDeep) {
    elements.push({ type: 'shape', id: `${id}-deep-bg`, bounds: [x + pad, botY, iw, actualBotH], style: { fill: r.primary, radius: rad } });
  }
  deepItems.forEach((di, i) => {
    const cx = x + pad + dPad + i * (dw + dGap);
    const cy = botY + dPad;
    const autoMetric = extractCardMetric(di.detail, di.metric);
    const accentC = i === 0 ? r.pop : r.primary;
    elements.push({
      type: 'shape', id: `${id}-dc-${i + 1}`,
      bounds: [cx, cy, dw, dh],
      style: isDarkDeep
        ? { fill: mixHexLocal(r.primary, '#FFFFFF', 0.12), stroke: mixHexLocal(r.primary, '#FFFFFF', 0.25), strokeWidth: 1, radius: 12 }
        : { fill: i === 0 ? (p.dark ? '#2A1B14' : '#FFFBF7') : subBg, stroke: i === 0 ? r.pop : (p.line || '#E2E6EE'), strokeWidth: i === 0 ? 1.5 : 1.5, radius: rad },
    });
    elements.push({ type: 'shape', id: `${id}-dtrim-${i + 1}`, bounds: [cx + 20, cy, dw - 40, 4], style: { fill: isDarkDeep ? r.pop : accentC, radius: 2 } });
    // Subtle corner watermark
    elements.push(textElement({ id: `${id}-dwm-${i + 1}`, text: `0${i + 1}`, bounds: [cx + dw - 76, cy + dh - 56, 64, 52], style: theme.font(48, { fontWeight: 900, color: isDarkDeep ? mixHexLocal(r.primary, '#FFFFFF', 0.20) : mixHexLocal(accentC, subBg, 0.88), textAlign: 'right', lineHeight: 1 }) }));
    const dTag = di.tag || `根因 0${i + 1}`;
    const dtW = Math.min(dw - 36, Math.max(76, Math.ceil(textWidth(dTag, 13) * 1.2) + 20));
    elements.push({ type: 'shape', id: `${id}-dtbg-${i + 1}`, bounds: [cx + 20, cy + 18, dtW, 24], style: { fill: isDarkDeep ? r.pop : (i === 0 ? (p.dark ? '#331E12' : '#FFF7ED') : (p.pale || '#EEF2FF')), radius: 12 } });
    elements.push(textElement({ id: `${id}-dttx-${i + 1}`, text: dTag, bounds: [cx + 24, cy + 21, dtW - 8, 18], style: theme.font(13, { fontWeight: 700, color: isDarkDeep ? '#FFFFFF' : accentC, textAlign: 'center', lineHeight: 1.2 }) }));
    if (autoMetric) {
      const mW = Math.min(126, Math.max(72, Math.ceil(textWidth(autoMetric, 18) * 1.15) + 20));
      elements.push({ type: 'shape', id: `${id}-dmb-${i + 1}`, bounds: [cx + dw - mW - 18, cy + 14, mW, 32], style: { fill: isDarkDeep ? mixHexLocal(r.primary, '#FFFFFF', 0.18) : (i === 0 ? (p.dark ? '#331E12' : '#FFF7ED') : (p.pale || '#EEF2FF')), radius: 9 } });
      elements.push(textElement({ id: `${id}-dmt-${i + 1}`, text: autoMetric, bounds: [cx + dw - mW - 14, cy + 19, mW - 8, 22], style: theme.font(18, { fontWeight: 900, color: isDarkDeep ? '#FFFFFF' : accentC, textAlign: 'center', lineHeight: 1.15 }) }));
    }
    elements.push(textElement({ id: `${id}-dt-${i + 1}`, text: di.title || '', bounds: [cx + 20, cy + 56, dw - 40, 30], style: theme.font(21, { fontWeight: 700, color: isDarkDeep ? (p.inverse || '#FFFFFF') : p.ink, lineHeight: 1.25 }) }));
    if (di.detail) {
      elements.push(textElement({ id: `${id}-dd-${i + 1}`, text: di.detail, bounds: [cx + 20, cy + 92, dw - 40, Math.max(44, dh - 104)], style: theme.font(detFs, { fontWeight: 300, color: isDarkDeep ? mixHexLocal(r.primary, '#FFFFFF', 0.85) : muted, lineHeight: 1.45 }) }));
    }
  });

  return { elements, height: actualPanelH };
}

export function radarScoreCard({ id, x, y, width, height, title = '', max = 10, badge = '', items = [], theme, variant = 'radar' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 8).map((it) => ({
    ...it,
    _val: parseChartNum(it.value),
  }));
  if (list.length < 3) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const maxVal = Math.max(Number(max) || 10, ...list.map((it) => it._val));
  const avgVal = (list.reduce((s, it) => s + it._val, 0) / list.length).toFixed(1);
  const peakIdx = list.reduce((best, it, i) => (it._val > list[best]._val ? i : best), 0);
  const pad = isCompact ? 18 : 24;
  const headH = title ? (isCompact ? 38 : 44) : 0;
  const natural = isCompact ? 380 : 450;
  const h = Math.max(natural, height || 0);
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'radarScoreCard', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  const iw = width - pad * 2;
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw - 240, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    const bTxt = badge || `综合均分 ${avgVal} / ${maxVal}`;
    const bW = Math.min(220, Math.max(118, Math.ceil(textWidth(bTxt, 13) * 1.2) + 24));
    elements.push({ type: 'shape', id: `${id}-bdg-bg`, bounds: [x + width - pad - bW, curY + 3, bW, 26], style: { fill: p.pale || '#EEF2FF', radius: 13 } });
    elements.push(textElement({ id: `${id}-bdg-tx`, text: bTxt, bounds: [x + width - pad - bW + 6, curY + 6, bW - 12, 20], style: theme.font(13, { fontWeight: 700, color: r.primary, textAlign: 'center', lineHeight: 1.2 }) }));
    curY += headH;
  }
  const bodyH = h - (curY - y) - pad;

  if (variant === 'cards') {
    const cols = list.length <= 4 ? list.length : 3;
    const rowsN = Math.ceil(list.length / cols);
    const gap = 14;
    const cw = Math.floor((iw - gap * (cols - 1)) / cols);
    const ch = Math.floor((bodyH - gap * (rowsN - 1)) / rowsN);
    list.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = x + pad + col * (cw + gap), cy = curY + row * (ch + gap);
      const isPeak = i === peakIdx;
      elements.push({ type: 'shape', id: `${id}-rc-${i + 1}`, bounds: [cx, cy, cw, ch], style: { fill: subBg, stroke: isPeak ? r.pop : (p.line || '#E2E6EE'), strokeWidth: isPeak ? 2 : 1, radius: 12 } });
      elements.push({ type: 'shape', id: `${id}-rtrim-${i + 1}`, bounds: [cx + 18, cy, cw - 36, 4], style: { fill: isPeak ? r.pop : r.primary, radius: 2 } });
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [cx + 18, cy + 16, cw - 36, 26], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-val-${i + 1}`, text: `${it._val} / ${maxVal}`, bounds: [cx + 18, cy + Math.round(ch * 0.34), cw - 36, 40], style: theme.font(30, { fontWeight: 900, color: isPeak ? r.pop : r.primary, lineHeight: 1.15 }) }));
      if (it.detail) {
        elements.push(textElement({ id: `${id}-det-${i + 1}`, text: it.detail, bounds: [cx + 18, cy + ch - 46, cw - 36, 34], style: theme.font(15, { fontWeight: 300, color: muted, lineHeight: 1.3 }) }));
      }
    });
    return { elements, height: h };
  }

  if (variant === 'bars') {
    const rGap = 12;
    const rowH = Math.floor((bodyH - rGap * (list.length - 1)) / list.length);
    const lblW = Math.min(220, Math.round(iw * 0.18));
    const valW = 110;
    const trackW = iw - lblW - valW - 36;
    list.forEach((it, i) => {
      const ry = curY + i * (rowH + rGap);
      const isPeak = i === peakIdx;
      elements.push({ type: 'shape', id: `${id}-br-${i + 1}`, bounds: [x + pad, ry, iw, rowH], style: { fill: subBg, stroke: isPeak ? r.pop : (p.line || '#E2E6EE'), strokeWidth: isPeak ? 1.5 : 1, radius: 10 } });
      elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [x + pad + 18, ry + Math.round((rowH - 24) / 2), lblW - 24, 24], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
      const tx = x + pad + lblW + 6;
      elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [tx, ry + Math.round((rowH - 14) / 2), trackW, 14], style: { fill: p.dark ? '#1E2C47' : '#E2E8F0', radius: 7 } });
      elements.push({ type: 'shape', id: `${id}-fil-${i + 1}`, bounds: [tx, ry + Math.round((rowH - 14) / 2), Math.max(20, Math.round((it._val / maxVal) * trackW)), 14], style: { fill: isPeak ? r.pop : r.primary, radius: 7 } });
      elements.push(textElement({ id: `${id}-val-${i + 1}`, text: String(it._val), bounds: [x + width - pad - valW - 14, ry + Math.round((rowH - 26) / 2), valW, 26], style: theme.font(22, { fontWeight: 900, color: isPeak ? r.pop : p.ink, textAlign: 'right', lineHeight: 1.2 }) }));
    });
    return { elements, height: h };
  }

  // Default 'radar': Left 44% SVG Radar Polygon + Right 54% Score Breakdown
  const radarW = Math.round(iw * 0.44);
  const rcx = x + pad + Math.round(radarW / 2);
  const rcy = curY + Math.round(bodyH / 2);
  const R = Math.min(132, Math.max(88, Math.floor(Math.min(radarW - 130, bodyH - 86) / 2)));
  const n = list.length;
  const ptAt = (idx, ratio) => {
    const ang = (-90 + (idx * 360) / n) * (Math.PI / 180);
    return [rcx + R * ratio * Math.cos(ang), rcy + R * ratio * Math.sin(ang)];
  };

  const boxSz = (R + 12) * 2;
  const bc = R + 12;
  const bx = rcx - bc, by = rcy - bc;
  const polyPath = (ratioFn) => list.map((_, i) => {
    const [px, py] = ptAt(i, ratioFn(i));
    return `${i === 0 ? 'M' : 'L'} ${(px - bx).toFixed(1)} ${(py - by).toFixed(1)}`;
  }).join(' ') + ' Z';

  // 3 concentric web polygons
  [1, 0.66, 0.33].forEach((lv, li) => {
    elements.push({
      type: 'vector', id: `${id}-web-${li + 1}`,
      bounds: [bx, by, boxSz, boxSz], viewBox: [0, 0, boxSz, boxSz],
      path: polyPath(() => lv),
      style: { fill: 'none', stroke: p.line || '#CBD5E1', strokeWidth: li === 0 ? 1.5 : 1 },
    });
  });
  // Spokes + outer labels
  list.forEach((it, i) => {
    const [ex, ey] = ptAt(i, 1);
    elements.push(lineElement({ id: `${id}-spk-${i + 1}`, from: [rcx, rcy], to: [Math.round(ex), Math.round(ey)], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1 } }));
    const [lx, ly] = ptAt(i, 1.24);
    elements.push(textElement({ id: `${id}-rlbl-${i + 1}`, text: it.label || '', bounds: [Math.round(lx - 48), Math.round(ly - 12), 96, 24], style: theme.font(15, { fontWeight: i === peakIdx ? 700 : 600, color: i === peakIdx ? r.pop : p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
  });

  // Value polygon fill + stroke
  elements.push({
    type: 'vector', id: `${id}-poly`,
    bounds: [bx, by, boxSz, boxSz], viewBox: [0, 0, boxSz, boxSz],
    path: polyPath((i) => Math.max(0.12, list[i]._val / maxVal)),
    style: { fill: mixHexLocal(r.primary, surf, p.dark ? 0.68 : 0.80), stroke: r.primary, strokeWidth: 3, strokeLinejoin: 'round' },
  });
  // Peak vertex dot
  const [pkx, pky] = ptAt(peakIdx, list[peakIdx]._val / maxVal);
  elements.push({ type: 'shape', id: `${id}-pkdot`, shape: 'ellipse', bounds: [Math.round(pkx - 6), Math.round(pky - 6), 12, 12], style: { fill: r.pop, radius: 6 } });

  // Right score list
  const rx = x + pad + radarW + 24;
  const rw = iw - radarW - 24;
  const rGap = 12;
  const rowH = Math.floor((bodyH - rGap * (list.length - 1)) / list.length);
  list.forEach((it, i) => {
    const ry = curY + i * (rowH + rGap);
    const isPeak = i === peakIdx;
    elements.push({ type: 'shape', id: `${id}-sr-${i + 1}`, bounds: [rx, ry, rw, rowH], style: { fill: subBg, stroke: isPeak ? r.pop : (p.line || '#E2E6EE'), strokeWidth: isPeak ? 1.5 : 1, radius: 10 } });
    const lW = Math.min(150, Math.round(rw * 0.25));
    elements.push(textElement({ id: `${id}-lbl-${i + 1}`, text: it.label || '', bounds: [rx + 16, ry + Math.round((rowH - 22) / 2), lW, 22], style: theme.font(17, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
    const tx = rx + 16 + lW + 8, valW = 84, tw = Math.max(80, rw - lW - valW - 44);
    elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [tx, ry + Math.round((rowH - 12) / 2), tw, 12], style: { fill: p.dark ? '#1E2C47' : '#E2E8F0', radius: 6 } });
    elements.push({ type: 'shape', id: `${id}-fil-${i + 1}`, bounds: [tx, ry + Math.round((rowH - 12) / 2), Math.max(18, Math.round((it._val / maxVal) * tw)), 12], style: { fill: isPeak ? r.pop : r.primary, radius: 6 } });
    elements.push(textElement({ id: `${id}-val-${i + 1}`, text: `${it._val}`, bounds: [rx + rw - valW - 14, ry + Math.round((rowH - 24) / 2), valW, 24], style: theme.font(20, { fontWeight: 900, color: isPeak ? r.pop : p.ink, textAlign: 'right', lineHeight: 1.2 }) }));
  });

  return { elements, height: h };
}

// =========================================================================
// Modern Web UI v2 Batch 3 (Final 4 Modules — Native Anti-Empty-Box Built-in):
//   - specProfileCard    (V2-CARD-02: Project Spec / Description Key-Value Card)
//   - okrGoalTree        (V2-FLOW-01: Objective -> Key Results Tree)
//   - riskMitigationStrip(V2-FLOW-02: Risk Level & Mitigation Plan Strip)
//   - dualTrackRoadmap   (V2-FLOW-03: Business x Tech Dual-Track Roadmap)
// =========================================================================

export function specProfileCard({ id, x, y, width, height, title = '', badge = '', items = [], theme, variant = 'grid' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 8);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact);
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#059669';
  const pad = isCompact ? 18 : 24;
  const headH = title ? 42 : 0;
  const iw = width - pad * 2;
  const valTone = (it) => (it.tone === 'pop' ? r.pop : it.tone === 'ok' ? okCol : it.tone === 'primary' ? r.primary : p.ink);

  if (variant === 'rows') {
    const cols = 2, rowsN = Math.ceil(list.length / 2);
    const rGap = 10, cGap = 16;
    const rowH = fitCardHeight(56, height ? Math.floor((height - pad * 2 - headH - rGap * (rowsN - 1)) / rowsN) : 64, { maxStretch: 1.25, minH: 54 });
    const h = pad * 2 + headH + rowsN * rowH + (rowsN - 1) * rGap;
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'specProfileCard', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw - 180, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      if (badge) {
        const bW = Math.min(170, Math.max(88, Math.ceil(textWidth(badge, 13) * 1.2) + 22));
        elements.push({ type: 'shape', id: `${id}-bg`, bounds: [x + width - pad - bW, curY + 4, bW, 26], style: { fill: p.dark ? '#11302B' : '#ECFDF5', radius: 13 } });
        elements.push(textElement({ id: `${id}-bt`, text: badge, bounds: [x + width - pad - bW + 6, curY + 7, bW - 12, 20], style: theme.font(13, { fontWeight: 700, color: okCol, textAlign: 'center', lineHeight: 1.2 }) }));
      }
      curY += headH;
    }
    const cw = Math.floor((iw - cGap) / 2);
    list.forEach((it, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cx = x + pad + col * (cw + cGap), cy = curY + row * (rowH + rGap);
      elements.push({ type: 'shape', id: `${id}-r-${i + 1}`, bounds: [cx, cy, cw, rowH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1, radius: 10 } });
      elements.push(textElement({ id: `${id}-k-${i + 1}`, text: it.label || '', bounds: [cx + 16, cy + Math.round((rowH - 22) / 2), Math.round(cw * 0.36), 22], style: theme.font(16, { fontWeight: 400, color: muted, lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-v-${i + 1}`, text: String(it.value ?? ''), bounds: [cx + Math.round(cw * 0.38), cy + Math.round((rowH - 24) / 2), Math.round(cw * 0.62) - 18, 24], style: theme.font(19, { fontWeight: 700, color: valTone(it), textAlign: 'right', lineHeight: 1.2 }) }));
    });
    return { elements, height: h };
  }

  const cols = list.length <= 4 ? 2 : 3;
  const rowsN = Math.ceil(list.length / cols);
  const cGap = 14, rGap = 14;
  const cw = Math.floor((iw - cGap * (cols - 1)) / cols);
  const cellH = fitCardHeight(88, height ? Math.floor((height - pad * 2 - headH - rGap * (rowsN - 1)) / rowsN) : 108, { maxStretch: 1.28, minH: 88 });
  const h = pad * 2 + headH + rowsN * cellH + (rowsN - 1) * rGap;
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'specProfileCard', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw - 200, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    if (badge) {
      const bW = Math.min(180, Math.max(88, Math.ceil(textWidth(badge, 13) * 1.2) + 22));
      elements.push({ type: 'shape', id: `${id}-bg`, bounds: [x + width - pad - bW, curY + 4, bW, 26], style: { fill: p.dark ? '#11302B' : '#ECFDF5', radius: 13 } });
      elements.push(textElement({ id: `${id}-bt`, text: badge, bounds: [x + width - pad - bW + 6, curY + 7, bW - 12, 20], style: theme.font(13, { fontWeight: 700, color: okCol, textAlign: 'center', lineHeight: 1.2 }) }));
    }
    curY += headH;
  }
  const hiIdx = variant === 'highlight' ? Math.max(0, list.findIndex((x) => x.highlight || x.tone === 'pop' || x.tone === 'primary')) : -1;
  list.forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x + pad + col * (cw + cGap), cy = curY + row * (cellH + rGap);
    const isHi = i === hiIdx;
    elements.push({ type: 'shape', id: `${id}-c-${i + 1}`, bounds: [cx, cy, cw, cellH], style: isHi ? { fill: r.primary, radius: 12 } : { fill: subBg, stroke: it.highlight ? r.primary : (p.line || '#E2E6EE'), strokeWidth: it.highlight ? 1.5 : 1, radius: 12 } });
    elements.push({ type: 'shape', id: `${id}-bar-${i + 1}`, bounds: [cx, cy + 14, 4, Math.max(20, cellH - 28)], style: { fill: isHi ? r.pop : (it.tone === 'pop' ? r.pop : it.tone === 'ok' ? okCol : r.primary), radius: 2 } });
    elements.push(textElement({ id: `${id}-k-${i + 1}`, text: it.label || '', bounds: [cx + 18, cy + 16, cw - 32, 22], style: theme.font(15, { fontWeight: 400, color: isHi ? mixHexLocal(r.primary, '#FFFFFF', 0.8) : muted, lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-v-${i + 1}`, text: String(it.value ?? ''), bounds: [cx + 18, cy + 44, cw - 32, 34], style: theme.font(22, { fontWeight: 800, color: isHi ? (p.inverse || '#FFFFFF') : valTone(it), lineHeight: 1.2 }) }));
  });
  return { elements, height: h };
}

export function okrGoalTree({ id, x, y, width, height, title = '', objective = {}, keyResults = [], theme, variant = 'tree' }) {
  const p = theme.palette, r = colorRoles(p);
  const krs = (Array.isArray(keyResults) ? keyResults : []).slice(0, 5);
  if (!krs.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact) || variant === 'compact';
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const okCol = p.dark ? '#34D399' : '#059669';
  const okBg = p.dark ? '#11302B' : '#ECFDF5';
  const pad = isCompact ? 16 : 24;
  const headH = title ? 40 : 0;
  const iw = width - pad * 2;
  const pctColor = (pct) => (pct >= 95 ? okCol : pct >= 70 ? r.primary : r.pop);

  if (variant === 'top') {
    const objH = 104, gap = 18;
    const cw = Math.floor((iw - 14 * (krs.length - 1)) / krs.length);
    const krH = fitCardHeight(168, height ? height - pad * 2 - headH - objH - gap : 210, { maxStretch: 1.28, minH: 156 });
    const h = pad * 2 + headH + objH + gap + krH;
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'okrGoalTree', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      curY += headH;
    }
    elements.push({ type: 'shape', id: `${id}-obj`, bounds: [x + pad, curY, iw, objH], style: { fill: r.primary, radius: rad } });
    elements.push({ type: 'shape', id: `${id}-otrim`, bounds: [x + pad + 24, curY, iw - 48, 5], style: { fill: r.pop, radius: 3 } });
    const obTag = objective.code || 'OBJECTIVE';
    elements.push({ type: 'shape', id: `${id}-obg`, bounds: [x + pad + 24, curY + 18, 118, 24], style: { fill: r.pop, radius: 12 } });
    elements.push(textElement({ id: `${id}-obt`, text: obTag, bounds: [x + pad + 28, curY + 21, 110, 18], style: theme.font(12, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-ot`, text: objective.title || '', bounds: [x + pad + 24, curY + 50, iw - 220, 36], style: theme.font(25, { fontWeight: 800, color: p.inverse || '#FFFFFF', lineHeight: 1.25 }) }));
    if (objective.progress != null) {
      elements.push(textElement({ id: `${id}-op`, text: `${objective.progress}%`, bounds: [x + width - pad - 180, curY + 26, 156, 52], style: theme.font(44, { fontWeight: 900, color: p.inverse || '#FFFFFF', textAlign: 'right', lineHeight: 1.1 }) }));
    }
    const ky = curY + objH + gap;
    krs.forEach((kr, i) => {
      const cx = x + pad + i * (cw + 14);
      const pct = parseChartNum(kr.progress);
      const col = pctColor(pct);
      elements.push({ type: 'shape', id: `${id}-kr-${i + 1}`, bounds: [cx, ky, cw, krH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: 12 } });
      elements.push({ type: 'shape', id: `${id}-krt-${i + 1}`, bounds: [cx + 16, ky, cw - 32, 4], style: { fill: col, radius: 2 } });
      elements.push(textElement({ id: `${id}-krc-${i + 1}`, text: kr.code || `KR${i + 1}`, bounds: [cx + 18, ky + 16, 70, 22], style: theme.font(14, { fontWeight: 800, color: col, lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-krp-${i + 1}`, text: `${pct}%`, bounds: [cx + cw - 92, ky + 14, 74, 24], style: theme.font(18, { fontWeight: 900, color: col, textAlign: 'right', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-krl-${i + 1}`, text: kr.title || '', bounds: [cx + 18, ky + 46, cw - 36, 48], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.3 }) }));
      if (kr.detail) {
        elements.push(textElement({ id: `${id}-krd-${i + 1}`, text: kr.detail, bounds: [cx + 18, ky + 98, cw - 36, Math.max(24, krH - 126)], style: theme.font(16, { fontWeight: 300, color: muted, lineHeight: 1.35 }) }));
      }
      elements.push({ type: 'shape', id: `${id}-trk-${i + 1}`, bounds: [cx + 18, ky + krH - 20, cw - 36, 8], style: { fill: p.dark ? '#1E2C47' : '#E2E8F0', radius: 4 } });
      elements.push({ type: 'shape', id: `${id}-fil-${i + 1}`, bounds: [cx + 18, ky + krH - 20, Math.max(16, Math.round((Math.min(100, pct) / 100) * (cw - 36))), 8], style: { fill: col, radius: 4 } });
    });
    return { elements, height: h };
  }

  // Default 'tree' & 'compact': Left Objective Card + Connectors + Right KR Rows
  const rGap = isCompact ? 10 : 14;
  const krRowH = fitCardHeight(isCompact ? 68 : 88, height ? Math.floor((height - pad * 2 - headH - rGap * (krs.length - 1)) / krs.length) : 108, { maxStretch: 1.25, minH: 68 });
  const bodyH = krs.length * krRowH + (krs.length - 1) * rGap;
  const h = pad * 2 + headH + bodyH;
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'okrGoalTree', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    curY += headH;
  }
  const objW = Math.round(iw * 0.30);
  const connW = 34;
  const krX = x + pad + objW + connW;
  const krW = iw - objW - connW;

  // Left Objective Card
  elements.push({ type: 'shape', id: `${id}-obj`, bounds: [x + pad, curY, objW, bodyH], style: { fill: r.primary, radius: rad } });
  elements.push({ type: 'shape', id: `${id}-otrim`, bounds: [x + pad + 22, curY, objW - 44, 5], style: { fill: r.pop, radius: 3 } });
  const obTag = objective.code || 'OBJECTIVE 01';
  const obW = Math.min(objW - 40, Math.max(108, Math.ceil(textWidth(obTag, 12) * 1.2) + 24));
  elements.push({ type: 'shape', id: `${id}-obg`, bounds: [x + pad + 24, curY + 26, obW, 24], style: { fill: r.pop, radius: 12 } });
  elements.push(textElement({ id: `${id}-obt`, text: obTag, bounds: [x + pad + 28, curY + 29, obW - 8, 18], style: theme.font(12, { fontWeight: 900, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.2 }) }));
  elements.push(textElement({ id: `${id}-ot`, text: objective.title || '', bounds: [x + pad + 24, curY + 64, objW - 48, Math.max(60, bodyH - 150)], style: theme.font(24, { fontWeight: 800, color: p.inverse || '#FFFFFF', lineHeight: 1.32 }) }));
  if (objective.progress != null) {
    elements.push(textElement({ id: `${id}-opl`, text: '综合达成率', bounds: [x + pad + 24, curY + bodyH - 78, objW - 48, 20], style: theme.font(14, { fontWeight: 400, color: mixHexLocal(r.primary, '#FFFFFF', 0.78), lineHeight: 1.2 }) }));
    elements.push(textElement({ id: `${id}-op`, text: `${objective.progress}%`, bounds: [x + pad + 24, curY + bodyH - 56, objW - 48, 44], style: theme.font(38, { fontWeight: 900, color: p.inverse || '#FFFFFF', lineHeight: 1.1 }) }));
  }

  const objMidY = curY + Math.round(bodyH / 2);
  krs.forEach((kr, i) => {
    const ry = curY + i * (krRowH + rGap);
    const midY = ry + Math.round(krRowH / 2);
    const pct = parseChartNum(kr.progress);
    const col = pctColor(pct);
    elements.push({ ...lineElement({ id: `${id}-ln-${i + 1}`, from: [x + pad + objW + 3, objMidY], to: [krX - 4, midY], style: { stroke: col, strokeWidth: 2 } }), endArrow: true });
    elements.push({ type: 'shape', id: `${id}-kr-${i + 1}`, bounds: [krX, ry, krW, krRowH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: 12 } });
    elements.push({ type: 'shape', id: `${id}-krb-${i + 1}`, bounds: [krX, ry + 12, 5, Math.max(20, krRowH - 24)], style: { fill: col, radius: 3 } });
    const pillW = 86;
    elements.push({ type: 'shape', id: `${id}-krpb-${i + 1}`, bounds: [krX + krW - pillW - 16, ry + Math.round((krRowH - 30) / 2), pillW, 30], style: { fill: pct >= 95 ? okBg : (pct >= 70 ? (p.pale || '#EEF2FF') : (p.dark ? '#331E12' : '#FFF7ED')), radius: 15 } });
    elements.push(textElement({ id: `${id}-krp-${i + 1}`, text: `${pct}%`, bounds: [krX + krW - pillW - 12, ry + Math.round((krRowH - 22) / 2), pillW - 8, 22], style: theme.font(16, { fontWeight: 900, color: col, textAlign: 'center', lineHeight: 1.2 }) }));
    const codeTxt = kr.code || `KR${i + 1}`;
    elements.push(textElement({ id: `${id}-krl-${i + 1}`, text: `${codeTxt} · ${kr.title || ''}`, bounds: [krX + 20, ry + (kr.detail ? 14 : Math.round((krRowH - 24) / 2)), krW - pillW - 48, 26], style: theme.font(isCompact ? 18 : 20, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
    if (kr.detail) {
      elements.push(textElement({ id: `${id}-krd-${i + 1}`, text: kr.detail, bounds: [krX + 20, ry + 44, krW - pillW - 48, Math.max(22, krRowH - 52)], style: theme.font(isCompact ? 16 : 18, { fontWeight: 300, color: muted, lineHeight: 1.35 }) }));
    }
  });
  return { elements, height: h };
}

export function riskMitigationStrip({ id, x, y, width, height, title = '', badge = '', items = [], theme, variant = 'rows' }) {
  const p = theme.palette, r = colorRoles(p);
  const list = (Array.isArray(items) ? items : []).slice(0, 5);
  if (!list.length) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact) || variant === 'compact';
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const errCol = p.dark ? '#FB7185' : '#DC2626', errBg = p.dark ? '#321820' : '#FEF2F2';
  const warnCol = r.pop, warnBg = p.dark ? '#331E12' : '#FFF7ED';
  const okCol = p.dark ? '#34D399' : '#059669', okBg = p.dark ? '#11302B' : '#ECFDF5';
  const pad = isCompact ? 16 : 24;
  const headH = title ? 42 : 0;
  const iw = width - pad * 2;

  const levelMeta = (lv) => {
    const s = String(lv || 'medium').toLowerCase();
    if (s === 'high' || s === '高' || s === '高风险') return { label: '高风险', col: errCol, bg: errBg };
    if (s === 'low' || s === '低' || s === '低风险') return { label: '低风险', col: okCol, bg: okBg };
    return { label: '中风险', col: warnCol, bg: warnBg };
  };

  if (variant === 'cards') {
    const gap = 16;
    const cw = Math.floor((iw - gap * (list.length - 1)) / list.length);
    const cardH = fitCardHeight(210, height ? height - pad * 2 - headH : 260, { maxStretch: 1.28, minH: 196 });
    const h = pad * 2 + headH + cardH;
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'riskMitigationStrip', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      curY += headH;
    }
    list.forEach((it, i) => {
      const cx = x + pad + i * (cw + gap);
      const lm = levelMeta(it.level);
      elements.push({ type: 'shape', id: `${id}-rc-${i + 1}`, bounds: [cx, curY, cw, cardH], style: { fill: subBg, stroke: lm.label === '高风险' ? lm.col : (p.line || '#E2E6EE'), strokeWidth: lm.label === '高风险' ? 1.8 : 1.2, radius: 12 } });
      elements.push({ type: 'shape', id: `${id}-rtrim-${i + 1}`, bounds: [cx + 18, curY, cw - 36, 4], style: { fill: lm.col, radius: 2 } });
      elements.push({ type: 'shape', id: `${id}-lbg-${i + 1}`, bounds: [cx + 18, curY + 18, 82, 24], style: { fill: lm.bg, radius: 12 } });
      elements.push(textElement({ id: `${id}-ltx-${i + 1}`, text: lm.label, bounds: [cx + 22, curY + 21, 74, 18], style: theme.font(13, { fontWeight: 800, color: lm.col, textAlign: 'center', lineHeight: 1.2 }) }));
      elements.push(textElement({ id: `${id}-rt-${i + 1}`, text: it.risk || '', bounds: [cx + 18, curY + 52, cw - 36, 48], style: theme.font(19, { fontWeight: 700, color: p.ink, lineHeight: 1.28 }) }));
      elements.push(lineElement({ id: `${id}-rdiv-${i + 1}`, from: [cx + 18, curY + 108], to: [cx + cw - 18, curY + 108], style: { stroke: p.line || '#E2E6EE', strokeWidth: 1, strokeDash: 'dash' } }));
      elements.push(textElement({ id: `${id}-rm-${i + 1}`, text: `预案：${it.mitigation || ''}`, bounds: [cx + 18, curY + 118, cw - 36, Math.max(44, cardH - 130)], style: theme.font(17, { fontWeight: 300, color: muted, lineHeight: 1.4 }) }));
    });
    return { elements, height: h };
  }

  // Default 'rows' & 'compact'
  const rGap = isCompact ? 10 : 14;
  const rowH = fitCardHeight(isCompact ? 68 : 88, height ? Math.floor((height - pad * 2 - headH - rGap * (list.length - 1)) / list.length) : 104, { maxStretch: 1.25, minH: 68 });
  const h = pad * 2 + headH + list.length * rowH + (list.length - 1) * rGap;
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'riskMitigationStrip', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw - 220, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    if (badge) {
      const bW = Math.min(200, Math.max(100, Math.ceil(textWidth(badge, 13) * 1.2) + 22));
      elements.push({ type: 'shape', id: `${id}-bg`, bounds: [x + width - pad - bW, curY + 4, bW, 26], style: { fill: warnBg, radius: 13 } });
      elements.push(textElement({ id: `${id}-bt`, text: badge, bounds: [x + width - pad - bW + 6, curY + 7, bW - 12, 20], style: theme.font(13, { fontWeight: 700, color: warnCol, textAlign: 'center', lineHeight: 1.2 }) }));
    }
    curY += headH;
  }
  const lvW = 104, riskW = Math.round((iw - lvW - 44) * 0.44);
  list.forEach((it, i) => {
    const ry = curY + i * (rowH + rGap);
    const lm = levelMeta(it.level);
    elements.push({ type: 'shape', id: `${id}-row-${i + 1}`, bounds: [x + pad, ry, iw, rowH], style: { fill: subBg, stroke: lm.label === '高风险' ? lm.col : (p.line || '#E2E6EE'), strokeWidth: lm.label === '高风险' ? 1.5 : 1, radius: 12 } });
    elements.push({ type: 'shape', id: `${id}-lbg-${i + 1}`, bounds: [x + pad + 16, ry + Math.round((rowH - 28) / 2), 84, 28], style: { fill: lm.bg, radius: 14 } });
    elements.push(textElement({ id: `${id}-ltx-${i + 1}`, text: lm.label, bounds: [x + pad + 20, ry + Math.round((rowH - 20) / 2), 76, 20], style: theme.font(14, { fontWeight: 800, color: lm.col, textAlign: 'center', lineHeight: 1.2 }) }));
    const rx1 = x + pad + lvW + 12;
    elements.push(textElement({ id: `${id}-rt-${i + 1}`, text: it.risk || '', bounds: [rx1, ry + (it.impact ? 14 : Math.round((rowH - 24) / 2)), riskW, 26], style: theme.font(isCompact ? 18 : 20, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
    if (it.impact) {
      elements.push(textElement({ id: `${id}-ri-${i + 1}`, text: it.impact, bounds: [rx1, ry + 44, riskW, Math.max(22, rowH - 50)], style: theme.font(16, { fontWeight: 300, color: muted, lineHeight: 1.3 }) }));
    }
    const divX = rx1 + riskW + 12;
    elements.push(lineElement({ id: `${id}-div-${i + 1}`, from: [divX, ry + 14], to: [divX, ry + rowH - 14], style: { stroke: p.line || '#CBD5E1', strokeWidth: 1.2 } }));
    elements.push(textElement({ id: `${id}-rm-${i + 1}`, text: `应对预案：${it.mitigation || ''}`, bounds: [divX + 18, ry + Math.max(14, Math.round((rowH - 44) / 2)), iw - (divX - (x + pad)) - 32, Math.max(36, rowH - 24)], style: theme.font(isCompact ? 17 : 19, { fontWeight: 400, color: p.ink, lineHeight: 1.4 }) }));
  });
  return { elements, height: h };
}

export function dualTrackRoadmap({ id, x, y, width, height, title = '', tracks = [], theme, variant = 'tracks' }) {
  const p = theme.palette, r = colorRoles(p);
  const trList = (Array.isArray(tracks) ? tracks : []).slice(0, 2);
  if (trList.length < 2) return { elements: [], height: 0 };
  const isCompact = Boolean(theme?.compact) || variant === 'compact';
  const surf = p.surface || '#FFFFFF';
  const subBg = p.dark ? (p.band || '#142138') : '#F8FAFC';
  const rad = theme.radius ?? 14;
  const muted = p.muted || (p.dark ? '#94A3B8' : '#64748B');
  const pad = isCompact ? 16 : 24;
  const headH = title ? 40 : 0;
  const iw = width - pad * 2;
  const cols = Math.max(trList[0]?.steps?.length || 0, trList[1]?.steps?.length || 0, 1);

  if (variant === 'paired') {
    const gap = 16;
    const cw = Math.floor((iw - gap * (cols - 1)) / cols);
    const slotH = fitCardHeight(112, height ? Math.floor((height - pad * 2 - headH - 46) / 2) : 136, { maxStretch: 1.25, minH: 102 });
    const h = pad * 2 + headH + 36 + slotH * 2 + 16;
    const elements = [{ type: 'shape', id: `${id}-panel`, component: 'dualTrackRoadmap', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
    let curY = y + pad;
    if (title) {
      elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
      curY += headH;
    }
    for (let ci = 0; ci < cols; ci++) {
      const cx = x + pad + ci * (cw + gap);
      const s0 = (trList[0].steps || [])[ci] || {}, s1 = (trList[1].steps || [])[ci] || {};
      const stageLbl = s0.stage || s1.stage || `阶段 ${ci + 1}`;
      elements.push({ type: 'shape', id: `${id}-sh-${ci + 1}`, bounds: [cx, curY, cw, 28], style: { fill: ci === 0 ? r.primary : subBg, stroke: ci === 0 ? null : (p.line || '#E2E6EE'), strokeWidth: ci === 0 ? 0 : 1, radius: 14 } });
      elements.push(textElement({ id: `${id}-sht-${ci + 1}`, text: stageLbl, bounds: [cx + 8, curY + 4, cw - 16, 20], style: theme.font(14, { fontWeight: 800, color: ci === 0 ? '#FFFFFF' : p.ink, textAlign: 'center', lineHeight: 1.2 }) }));
      [s0, s1].forEach((st, ti) => {
        const sy = curY + 38 + ti * (slotH + 14);
        const col = ti === 0 ? r.primary : r.pop;
        elements.push({ type: 'shape', id: `${id}-pc-${ti + 1}-${ci + 1}`, bounds: [cx, sy, cw, slotH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1.2, radius: 12 } });
        elements.push({ type: 'shape', id: `${id}-pb-${ti + 1}-${ci + 1}`, bounds: [cx, sy + 12, 4, slotH - 24], style: { fill: col, radius: 2 } });
        elements.push(textElement({ id: `${id}-ptg-${ti + 1}-${ci + 1}`, text: trList[ti].name || '', bounds: [cx + 16, sy + 12, cw - 28, 18], style: theme.font(13, { fontWeight: 700, color: col, lineHeight: 1.2 }) }));
        elements.push(textElement({ id: `${id}-pt-${ti + 1}-${ci + 1}`, text: st.title || '', bounds: [cx + 16, sy + 34, cw - 28, 24], style: theme.font(18, { fontWeight: 700, color: p.ink, lineHeight: 1.2 }) }));
        if (st.detail) {
          elements.push(textElement({ id: `${id}-pd-${ti + 1}-${ci + 1}`, text: st.detail, bounds: [cx + 16, sy + 62, cw - 28, Math.max(26, slotH - 70)], style: theme.font(16, { fontWeight: 300, color: muted, lineHeight: 1.35 }) }));
        }
      });
    }
    return { elements, height: h };
  }

  // Default 'tracks' & 'compact': 2 horizontal track bands stacked
  const bandGap = isCompact ? 14 : 20;
  const bandH = fitCardHeight(isCompact ? 132 : 162, height ? Math.floor((height - pad * 2 - headH - bandGap) / 2) : 186, { maxStretch: 1.25, minH: 128 });
  const h = pad * 2 + headH + bandH * 2 + bandGap;
  const elements = [{ type: 'shape', id: `${id}-panel`, component: 'dualTrackRoadmap', bounds: [x, y, width, h], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.5, radius: rad } }];
  let curY = y + pad;
  if (title) {
    elements.push(textElement({ id: `${id}-title`, text: title, bounds: [x + pad, curY + 2, iw, 30], style: theme.font(21, { fontWeight: 700, color: readableInk(p.accent, surf), lineHeight: 1.25 }) }));
    curY += headH;
  }
  trList.forEach((tr, ti) => {
    const by = curY + ti * (bandH + bandGap);
    const col = ti === 0 ? r.primary : r.pop;
    const steps = (Array.isArray(tr.steps) ? tr.steps : []).slice(0, 5);
    elements.push({ type: 'shape', id: `${id}-tb-${ti + 1}`, bounds: [x + pad, by, iw, bandH], style: { fill: subBg, stroke: p.line || '#E2E6EE', strokeWidth: 1.2, radius: 14 } });
    elements.push({ type: 'shape', id: `${id}-tbar-${ti + 1}`, bounds: [x + pad, by + 14, 5, bandH - 28], style: { fill: col, radius: 3 } });
    elements.push(textElement({ id: `${id}-tn-${ti + 1}`, text: tr.name || `轨道 ${ti + 1}`, bounds: [x + pad + 20, by + 14, iw - 240, 24], style: theme.font(18, { fontWeight: 800, color: col, lineHeight: 1.2 }) }));
    if (tr.badge) {
      elements.push(textElement({ id: `${id}-tbg-${ti + 1}`, text: tr.badge, bounds: [x + width - pad - 200, by + 15, 184, 22], style: theme.font(14, { fontWeight: 600, color: muted, textAlign: 'right', lineHeight: 1.2 }) }));
    }
    const nGap = 18;
    const nw = Math.floor((iw - 40 - nGap * Math.max(0, steps.length - 1)) / Math.max(1, steps.length));
    const ny = by + 48, nh = bandH - 62;
    steps.forEach((st, si) => {
      const nx = x + pad + 20 + si * (nw + nGap);
      elements.push({ type: 'shape', id: `${id}-st-${ti + 1}-${si + 1}`, bounds: [nx, ny, nw, nh], style: { fill: surf, stroke: p.line || '#E2E6EE', strokeWidth: 1.2, radius: 10 } });
      elements.push({ type: 'shape', id: `${id}-sl-${ti + 1}-${si + 1}`, bounds: [nx, ny + 10, 4, Math.max(16, nh - 20)], style: { fill: col, radius: 2 } });
      const headLine = st.stage ? `${st.stage} · ${st.title || ''}` : (st.title || '');
      elements.push(textElement({ id: `${id}-stt-${ti + 1}-${si + 1}`, text: headLine, bounds: [nx + 16, ny + 12, nw - 26, 24], style: theme.font(18, { fontWeight: 700, color: p.ink, lineHeight: 1.25 }) }));
      if (st.detail) {
        elements.push(textElement({ id: `${id}-std-${ti + 1}-${si + 1}`, text: st.detail, bounds: [nx + 16, ny + 40, nw - 26, Math.max(24, nh - 48)], style: theme.font(16, { fontWeight: 300, color: muted, lineHeight: 1.35 }) }));
      }
      if (si < steps.length - 1) {
        const my = ny + Math.round(nh / 2);
        elements.push({ ...lineElement({ id: `${id}-arr-${ti + 1}-${si + 1}`, from: [nx + nw + 2, my], to: [nx + nw + nGap - 2, my], style: { stroke: col, strokeWidth: 2 } }), endArrow: true });
      }
    });
  });
  return { elements, height: h };
}
