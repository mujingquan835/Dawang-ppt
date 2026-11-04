import { textElement, lineElement } from './elements.mjs';
import { textHeight, textBlock, panel, metricRow, metricTiles, photoPanel, darken, flow, numberedList, imageRow, imageGrid, imageFill, imageSize, table, shiftX, fitImage } from './layout-kit.mjs';

// Page patterns built on the layout kit. Each returns elements on the 12-column grid plus a visualDecision that
// can go straight into contentPlan. A pattern is a starting point: change its parameters, add or drop elements,
// or design the page from scratch. Content area runs from the header's `bottom` to FOOTER_TOP.
export const FOOTER_TOP = 1010;
// metricStyle 'tile' (default) puts each number in a rounded rectangle with its label; 'plain' keeps bare numbers.
const metrics = (style, { highlight = 0, ...args }) => (style === 'plain' ? metricRow(args) : metricTiles({ ...args, highlight }));

export function pageHeader({ theme, grid, eyebrow, title, focus, subtitle, page, total, source, titleSize = 60 }) {
  const p = theme.palette, x = grid.left, w = grid.width, elements = [];
  if (eyebrow) elements.push(textElement({ id: 'eyebrow', text: eyebrow, bounds: [x, 56, w * 0.7, 32], style: theme.font(22, { color: p.muted, lineHeight: 1.4 }) }));
  // Title focus: the named part keeps the accent colour in its own run, the rest stays ink.
  const at = focus ? title.indexOf(focus) : -1;
  if (focus && at < 0) throw new Error('focus must be part of the title: ' + focus);
  const runs = at < 0 ? undefined : [title.slice(0, at), focus, title.slice(at + focus.length)].filter(Boolean)
    .map((text) => ({ text, style: { fontSize: titleSize, fontWeight: 700, color: text === focus ? p.accent : p.ink } }));
  const th = textHeight(title, titleSize, w - 24, 1.2) + 8;
  elements.push({ type: 'shape', id: 'title-mark', bounds: [x, 104, 10, Math.round(titleSize * 1.05)], style: { fill: p.accent } });
  elements.push(textElement({ id: 'title', text: title, bounds: [x + 32, 98, w - 32, th], style: theme.font(titleSize, { fontWeight: 700, lineHeight: 1.2, fontFamily: theme.headingFamily }), ...(runs ? { runs } : {}) }));
  let bottom = 98 + th;
  if (subtitle) { const s = textBlock({ id: 'subtitle', x: x + 32, y: bottom + 8, width: w - 32, text: subtitle, size: 26, theme, style: { color: p.muted } }); elements.push(...s.elements); bottom += 8 + s.height; }
  if (source) elements.push(textElement({ id: 'source', text: source, bounds: [x, 1028, w - 200, 28], style: theme.font(17, { color: p.muted }) }));
  if (page) elements.push(textElement({ id: 'page-number', text: `${String(page).padStart(2, '0')}${total ? ' / ' + String(total).padStart(2, '0') : ''}`, bounds: [grid.right - 160, 1028, 160, 28], style: theme.font(17, { color: p.muted, textAlign: 'right' }) }));
  return { elements, bottom: Math.round(bottom), focus: { elementId: 'title', ...(at < 0 ? {} : { text: focus }) } };
}

// zones: [id, role, [x, y, w, h]] for the page's regions; the visual check keeps elements inside them.
const decision = (header, layout, zones) => ({ focus: header.focus, layout, zones: zones.map(([id, role, b]) => ({ id, role, bounds: b.map(Math.round) })) });

// Work-split table on top, one or two flows on a full-width colour band below.
export function tableWithFlows({ theme, grid, header, table: t, flows, note }) {
  const p = theme.palette, top = header.bottom + 44, elements = [];
  const tb = table({ id: 'table', x: grid.left, y: top, theme, ...t });
  elements.push(...tb.elements);
  const bandY = top + tb.height + 48, laneW = (grid.width - grid.gutter * 2 * (flows.length - 1)) / flows.length;
  elements.push(panel({ id: 'flow-band', bounds: [0, bandY, 1920, FOOTER_TOP - bandY - 20], theme }));
  flows.forEach((f, i) => {
    const lx = Math.round(grid.left + i * (laneW + grid.gutter * 2));
    elements.push(textElement({ id: `flow-${i + 1}-heading`, text: f.title, bounds: [lx, bandY + 40, laneW, 44], style: theme.font(30, { fontWeight: 700 }) }));
    elements.push(...flow({ id: `flow-${i + 1}`, x: lx, y: bandY + 108, width: laneW, steps: f.steps, theme }).elements);
  });
  if (note) elements.push(textElement({ id: 'flow-note', text: note, bounds: [grid.left, FOOTER_TOP - 76, grid.width, 36], style: theme.font(24, { fontWeight: 700, color: p.ink }) }));
  return { elements: [...header.elements, ...elements], visualDecision: decision(header, '上方分工表按支持层级排列，下方色带承载共用流程，节点与说明对齐', [['table', 'data', [grid.left, top, grid.width, tb.height + 24]], ['flows', 'flow', [grid.left, bandY + 20, grid.width, FOOTER_TOP - bandY - 40]]]) };
}

// One or two hero numbers, a secondary metric row (same 40px gap, so its columns land on the hero columns), a mechanism flow and notes on the left; evidence image right.
export function metricsWithEvidence({ theme, grid, header, hero, secondary = [], flow: f, notes = [], image, metricStyle = 'tile' }) {
  const p = theme.palette, top = header.bottom + 40, [lx, lw] = grid.span(0, 7), [rx, rw] = grid.span(7, 5), elements = [];
  let y = top;
  const h = metrics(metricStyle, { id: 'hero', x: lx, y, width: lw, items: hero, size: metricStyle === 'plain' ? 128 : 96, theme }); elements.push(...h.elements); y += h.height + (metricStyle === 'plain' ? 20 : 16);
  if (secondary.length) {
    if (metricStyle === 'plain') { elements.push(lineElement({ id: 'hero-rule', from: [lx, y], to: [lx + lw, y], style: { stroke: p.line, strokeWidth: 2 } })); y += 24; }
    const s = metrics(metricStyle, { id: 'secondary', x: lx, y, width: lw, items: secondary, size: metricStyle === 'plain' ? 54 : 40, gap: metricStyle === 'plain' ? 40 : 24, theme, color: p.ink, highlight: -1 }); elements.push(...s.elements); y += s.height + 28;
  }
  if (f) {
    elements.push(textElement({ id: 'flow-heading', text: f.title, bounds: [lx, y, lw, 40], style: theme.font(26, { fontWeight: 700 }) })); y += 56;
    const fl = flow({ id: 'flow', x: lx, y, width: lw, steps: f.steps, theme, node: 48, titleSize: 26, detailSize: 20 }); elements.push(...fl.elements); y += fl.height + 24;
  }
  notes.forEach((n, i) => {
    const strong = i === 0, b = textBlock({ id: `note-${i + 1}`, x: lx + (strong ? 20 : 0), y, width: lw - (strong ? 20 : 0), text: n, size: strong ? 24 : 21, theme, style: { fontWeight: strong ? 700 : 400, color: strong ? p.ink : p.muted } });
    if (strong) elements.push({ type: 'shape', id: 'note-mark', bounds: [lx, y + 4, 6, b.height - 8], style: { fill: p.accent } });
    elements.push(...b.elements); y += b.height + 14;
  });
  if (y > FOOTER_TOP) throw new Error(`metricsWithEvidence overflows by ${Math.round(y - FOOTER_TOP)}px: shorten notes or drop the flow`);
  const ph = FOOTER_TOP - top - 50;
  elements.push(panel({ id: 'evidence-panel', bounds: [rx, top, rw, ph], radius: theme.radius, theme }));
  elements.push({ type: 'image', id: 'evidence', src: image.src, bounds: [rx + 24, top + 24, rw - 48, ph - 48], fit: 'contain', style: { radius: theme.radius }, ...(image.alt ? { alt: image.alt } : {}) });
  if (image.caption) elements.push(textElement({ id: 'evidence-caption', text: image.caption, bounds: [rx, top + ph + 12, rw, 30], style: theme.font(19, { color: p.muted }) }));
  return { elements: [...header.elements, ...elements], visualDecision: decision(header, '左侧主指标放大承担主视觉，次级指标同基线成行，下接机制流程；右侧色面完整展示证据图', [['metrics', 'focus', [lx, top, lw, y - top]], ['evidence', 'evidence', [rx, top, rw, ph + 50]]]) };
}

// Numbered resources, result metrics and a review note on the left; the photos get the whole right zone and fill it
// (cropped a little where needed), so the evidence reads large without an empty side.
export function listWithPhotos({ theme, grid, header, items, metrics: results = [], photos, note, perRow = 'auto', metricStyle = 'tile' }) {
  const p = theme.palette, top = header.bottom + 44, [lx, lw] = grid.span(0, 5), [rx, rw] = grid.span(5, 7), elements = [];
  const list = numberedList({ id: 'items', x: lx, y: top, width: lw, items, theme, gap: 28, titleSize: 32, detailSize: 22 }); elements.push(...list.elements);
  let y = top + list.height;
  if (results.length) { y += 28; const m = metrics(metricStyle, { id: 'result', x: lx, y, width: lw, items: results, size: metricStyle === 'plain' ? 64 : 52, gap: metricStyle === 'plain' ? 40 : 20, theme }); elements.push(...m.elements); y += m.height; }
  if (note) {
    const ny = y + 24, b = textBlock({ id: 'note', x: lx + 28, y: ny + 58, width: lw - 56, text: note.text, size: 23, theme });
    elements.push(panel({ id: 'note-panel', bounds: [lx, ny, lw, b.height + 78], radius: theme.radius, theme }));
    elements.push(textElement({ id: 'note-label', text: note.label || '复盘判断', bounds: [lx + 28, ny + 16, lw - 56, 40], style: theme.font(28, { fontWeight: 700, color: p.accent }) }));
    elements.push(...b.elements);
    y = ny + b.height + 78;
  }
  if (y > FOOTER_TOP) throw new Error(`listWithPhotos left column overflows by ${Math.round(y - FOOTER_TOP)}px: shorten details or the note`);
  const photoH = FOOTER_TOP - top - 50;
  // If filling would crop too much, fall back to the uncropped grid centred in the zone.
  const fill = perRow === 'auto' ? imageFill({ id: 'photos', x: rx, y: top, width: rw, height: photoH, images: photos, theme }) : null;
  const g = fill || imageGrid({ id: 'photos', x: rx, y: top, width: rw, images: photos, perRow, theme, maxHeight: photoH });
  elements.push(...(fill ? fill.elements : shiftX(g.elements, (rw - g.width) / 2)));
  return { elements: [...header.elements, ...elements], visualDecision: decision(header, '左侧编号资源、结果指标与复盘判断，右侧照片铺满整栏作为证据', [['items', 'support', [lx, top, lw, y - top + 8]], ['photos', 'evidence', [rx, top, rw, (fill ? photoH : g.height) + 8]]]) };
}

// One column per item: numbered heading and detail on top, that item's own photo directly below, so each photo
// visibly belongs to its item. Result metrics and a review line run across the bottom. highlight marks one column.
export function itemsWithPhotos({ theme, grid, header, items, metrics: results = [], note, highlight = 0, gap = 32, maxCrop = 1.45, metricStyle = 'tile' }) {
  const p = theme.palette, top = header.bottom + 40, n = items.length, colW = Math.floor((grid.width - gap * (n - 1)) / n), elements = [];
  if (n < 2 || n > 4) throw new Error('itemsWithPhotos takes 2–4 items');
  const pad = 28, textW = colW - pad * 2;
  const heads = items.map((it) => 44 + textHeight(it.title, 32, textW - 60, 1.3) + (it.detail ? 12 + textHeight(it.detail, 23, textW) : 0));
  const headH = Math.max(...heads) + pad * 2;
  // The bottom block is measured first so the photos get every pixel the metrics and note do not need.
  const resultArgs = { width: grid.width, items: results, size: metricStyle === 'plain' ? 60 : 44, gap, theme };
  const metricsH = results.length ? metrics(metricStyle, { id: 'probe', x: 0, y: 0, ...resultArgs }).height + 16 : 0;
  const reserve = metricsH + (note ? 44 : 0) + 20, capH = items.some((it) => it.photo?.caption) ? 40 : 0;
  const boxY = top + headH + 16, boxH = FOOTER_TOP - 10 - reserve - capH - boxY;
  if (boxH < 200) throw new Error(`itemsWithPhotos leaves only ${Math.round(boxH)}px for photos: shorten details, drop metrics or the note`);
  items.forEach((it, i) => {
    const x = grid.left + i * (colW + gap), on = i === highlight, ink = on ? p.inverse : p.ink;
    elements.push(panel({ id: `item-${i + 1}-panel`, bounds: [x, top, colW, headH], fill: on ? p.ink : p.pale, radius: theme.radius, theme }));
    elements.push(textElement({ id: `item-${i + 1}-num`, text: String(i + 1).padStart(2, '0'), bounds: [x + pad, top + pad, 56, 42], style: theme.font(28, { fontWeight: 700, color: on ? p.pale : p.accent }) }));
    elements.push(textElement({ id: `item-${i + 1}-title`, text: it.title, bounds: [x + pad + 60, top + pad, textW - 60, textHeight(it.title, 32, textW - 60, 1.3)], style: theme.font(32, { fontWeight: 700, lineHeight: 1.3, color: ink }) }));
    if (it.detail) elements.push(textElement({ id: `item-${i + 1}-detail`, text: it.detail, bounds: [x + pad, top + pad + 56, textW, textHeight(it.detail, 23, textW)], style: theme.font(23, { color: ink }) }));
    if (it.photo) {
      // The photo fills its column box (cropped around its focal point) when that changes its shape by at most
      // maxCrop; a photo of very different shape (a portrait in a wide box) is shown whole on a panel instead of
      // losing heads or key text.
      const size = it.photo.size || imageSize(it.photo.src), r = size.width / size.height, box = colW / boxH;
      if (Math.max(r / box, box / r) <= maxCrop) elements.push({ type: 'image', id: `item-${i + 1}-photo`, src: it.photo.src, bounds: [x, boxY, colW, boxH], fit: 'cover', focal: it.photo.focal || '50% 40%', naturalSize: [size.width, size.height], style: { radius: theme.radius }, ...(it.photo.alt ? { alt: it.photo.alt } : {}) });
      else { elements.push(panel({ id: `item-${i + 1}-photo-panel`, bounds: [x, boxY, colW, boxH], theme })); elements.push(fitImage({ id: `item-${i + 1}-photo`, src: it.photo.src, size, box: [x + 12, boxY + 12, colW - 24, boxH - 24], alt: it.photo.alt, radius: theme.radius })); }
      if (it.photo.caption) elements.push(textElement({ id: `item-${i + 1}-caption`, text: it.photo.caption, bounds: [x, boxY + boxH + 8, colW, 30], style: theme.font(19, { color: p.muted, textAlign: 'center' }) }));
    }
  });
  let y = boxY + boxH + capH + 20;
  if (results.length) { const m = metrics(metricStyle, { id: 'result', x: grid.left, y, ...resultArgs }); elements.push(...m.elements); y += m.height + 16; }
  if (note) {
    elements.push({ type: 'shape', id: 'note-mark', bounds: [grid.left, y + 4, 6, 30], style: { fill: p.accent } });
    // In tile mode the note text starts where the tile text does (28px in).
    const nx = grid.left + (metricStyle === 'plain' ? 20 : 28);
    elements.push(textElement({ id: 'note', text: note, bounds: [nx, y, grid.right - nx, 40], style: theme.font(24, { fontWeight: 700 }) }));
  }
  return { elements: [...header.elements, ...elements], visualDecision: decision(header, '每项资源一栏，标题与说明在上、对应照片正下方，底部结果指标与复盘', [['items', 'support', [grid.left, top, grid.width, headH]], ['photos', 'evidence', [grid.left, boxY, grid.width, boxH + capH]], ['results', 'data', [grid.left, boxY + boxH + capH + 10, grid.width, FOOTER_TOP - (boxY + boxH + capH + 10)]]]) };
}

// Photo panels: 2–4 colour blocks, each a short title, accent bar and one to three lines fading into its own photo.
// Only for little text with photos that each illustrate one point; long text or text-only content does not fit.
// 2 panels sit side by side (text above photo), 3 put the first tall on the left and two stacked right, 4 make a grid.
export function photoPanels({ theme, grid, header, panels, colors, allowData = false }) {
  const p = theme.palette, top = header.bottom + 40, H = FOOTER_TOP - top - 20, W = grid.width, g = 20, n = panels.length, elements = [];
  if (n < 2 || n > 4) throw new Error('photoPanels takes 2–4 panels');
  // Data comes before pictures: a page carrying several figures needs metric tiles, not numbers buried in panel text.
  const figures = panels.flatMap((pn) => (pn.lines || []).join(' ').match(/\d+(?:[.,]\d+)?/g) || []).length;
  if (figures > 3 && !allowData) throw new Error(`photoPanels: the panels carry ${figures} figures; data-heavy pages use metric tiles with photos (listWithPhotos / metricsWithEvidence), photo panels are for little text and no data`);
  const palette = colors || [p.ink, darken(p.accent, 0.3)];
  let boxes;
  if (n === 2) boxes = [[0, 0, (W - g) / 2, H, 'top'], [(W + g) / 2, 0, (W - g) / 2, H, 'top']];
  else if (n === 3) { const lw = Math.round(W * 0.34); boxes = [[0, 0, lw, H, 'top'], [lw + g, 0, W - lw - g, (H - g) / 2, 'left'], [lw + g, (H + g) / 2, W - lw - g, (H - g) / 2, 'left']]; }
  else boxes = [0, 1, 2, 3].map((i) => [(i % 2) * ((W + g) / 2), Math.floor(i / 2) * ((H + g) / 2), (W - g) / 2, (H - g) / 2, 'left']);
  const zones = [];
  panels.forEach((pn, i) => {
    const [bx, by, bw, bh, side] = boxes[i], b = [grid.left + bx, top + by, bw, bh].map(Math.round);
    elements.push(...photoPanel({ id: `panel-${i + 1}`, bounds: b, photo: pn.photo, title: pn.title, lines: pn.lines || [], color: pn.color || palette[i % palette.length], theme, textSide: pn.textSide || side, textShare: side === 'top' ? 0.42 : 0.5 }).elements);
    zones.push([`panel-${i + 1}`, 'media', b]);
  });
  return { elements: [...header.elements, ...elements], visualDecision: decision(header, '色块与照片融合：深色一侧写标题和要点，向照片渐隐过渡，每张照片对应一项', zones) };
}

// Detail table on the left; a dark side panel carries chains or key points.
export function tableWithPanel({ theme, grid, header, table: t, panel: side }) {
  const p = theme.palette, top = header.bottom + 44, [lx] = grid.span(0, 8), [rx, rw] = grid.span(8, 4), elements = [];
  const tb = table({ id: 'table', x: lx, y: top, theme, ...t }); elements.push(...tb.elements);
  const ph = FOOTER_TOP - top - 20;
  elements.push(panel({ id: 'side-panel', bounds: [rx, top, rw, ph], fill: p.ink, radius: theme.radius, theme }));
  elements.push(textElement({ id: 'side-title', text: side.title, bounds: [rx + 40, top + 36, rw - 80, 44], style: theme.font(30, { fontWeight: 700, color: p.inverse }) }));
  let y = top + 108;
  side.chains.forEach((c, k) => {
    if (c.label) { elements.push(textElement({ id: `chain-${k + 1}-label`, text: c.label, bounds: [rx + 40, y, rw - 80, 32], style: theme.font(22, { fontWeight: 700, color: p.pale }) })); y += 44; }
    c.steps.forEach((s, i) => {
      elements.push({ type: 'shape', id: `chain-${k + 1}-dot-${i + 1}`, bounds: [rx + 40, y + 8, 20, 20], style: { fill: p.accent, radius: 10 } });
      if (i < c.steps.length - 1) elements.push(lineElement({ id: `chain-${k + 1}-link-${i + 1}`, from: [rx + 50, y + 32], to: [rx + 50, y + 72], style: { stroke: p.accent, strokeWidth: 2 } }));
      elements.push(textElement({ id: `chain-${k + 1}-step-${i + 1}`, text: s, bounds: [rx + 80, y, rw - 120, 40], style: theme.font(26, { color: p.inverse, fontWeight: i === c.steps.length - 1 ? 700 : 400 }) }));
      y += 76;
    });
    y += 28;
  });
  return { elements: [...header.elements, ...elements], visualDecision: decision(header, '左侧逐行明细表，右侧深色侧栏用节点链说明应用路径', [['table', 'data', [lx, top, rx - lx - grid.gutter, tb.height + 8]], ['panel', 'flow', [rx, top, rw, ph]]]) };
}

// Two parallel flows, each with its title in the left columns, and a conclusion line.
export function twoLaneFlow({ theme, grid, header, lanes, conclusion }) {
  const p = theme.palette, top = header.bottom + 60, [tx, tw] = grid.span(0, 3), [fx, fw] = grid.span(3, 9), elements = [];
  let y = top;
  lanes.forEach((lane, i) => {
    elements.push(textElement({ id: `lane-${i + 1}-title`, text: lane.title, bounds: [tx, y, tw, textHeight(lane.title, 32, tw, 1.3)], style: theme.font(32, { fontWeight: 700, lineHeight: 1.3 }) }));
    const f = flow({ id: `lane-${i + 1}`, x: fx, y, width: fw, steps: lane.steps, theme });
    elements.push(...f.elements); y += f.height + 56;
    if (i < lanes.length - 1) elements.push(lineElement({ id: `lane-rule-${i + 1}`, from: [grid.left, y - 28], to: [grid.right, y - 28], style: { stroke: p.line, strokeWidth: 1 } }));
  });
  if (conclusion) elements.push(textElement({ id: 'conclusion', text: conclusion, bounds: [fx, y + 8, fw, 40], style: theme.font(26, { fontWeight: 700, color: p.accent }) }));
  return { elements: [...header.elements, ...elements], visualDecision: decision(header, '两条流程上下并列，标题在左，节点与说明逐一对齐', [['lanes', 'flow', [grid.left, top, grid.width, Math.min(FOOTER_TOP - 20, y + 60) - top]]]) };
}
