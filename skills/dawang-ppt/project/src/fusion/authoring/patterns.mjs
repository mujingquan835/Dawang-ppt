import { textElement, lineElement } from './elements.mjs';
import { textHeight, textWidth, textBlock, panel, metricRow, metricTiles, photoPanel, darken, flow, numberedList, imageRow, imageGrid, imageFill, imageSize, table, shiftX, fitImage, colorRoles, kpiStrip, lighten, imageFrames, pointList, pointsHeight, photoGroup } from './layout-kit.mjs';

// Page patterns built on the layout kit. Each returns elements on the 12-column grid plus a visualDecision that
// can go straight into contentPlan. A pattern is a starting point: change its parameters, add or drop elements,
// or design the page from scratch. Content area runs from the header's `bottom` to FOOTER_TOP.
export const FOOTER_TOP = 1010;
// metricStyle 'tile' (default) puts each number in a rounded rectangle with its label; 'plain' keeps bare numbers.
const metrics = (style, { highlight = 0, ...args }) => (style === 'plain' ? metricRow(args) : metricTiles({ ...args, highlight }));

export function pageHeader({ theme, grid, eyebrow, tag, title, focus, subtitle, page, total, source, titleSize = tag ? 52 : 60 }) {
  const p = theme.palette, x = grid.left, w = grid.width, elements = [];
  if (eyebrow) elements.push(textElement({ id: 'eyebrow', text: eyebrow, bounds: [x, 56, w * 0.7, 32], style: theme.font(22, { color: p.muted, lineHeight: 1.4 }) }));
  // Title focus: the named part keeps the accent colour in its own run, the rest stays ink.
  const at = focus ? title.indexOf(focus) : -1;
  if (focus && at < 0) throw new Error('focus must be part of the title: ' + focus);
  const runs = at < 0 ? undefined : [title.slice(0, at), focus, title.slice(at + focus.length)].filter(Boolean)
    .map((text) => ({ text, style: { fontSize: titleSize, fontWeight: 700, color: text === focus ? p.accent : p.ink } }));
  let bottom, tx = x + 32;
  if (tag) {
    // Report-template header: a filled chip names the section (成果数据 | 02), the title follows on the same line and a
    // hairline closes the header across the content width. The chip uses the primary colour; eyebrow is not shown.
    const chipH = Math.round(titleSize * 1.2), chipW = Math.round(textWidth(tag, 26) + 56), primary = p.primary || p.accent;
    elements.splice(0, elements.length);
    elements.push({ type: 'shape', id: 'title-tag', bounds: [x, 56, chipW, chipH], style: { fill: primary } });
    elements.push(textElement({ id: 'title-tag-text', text: tag, bounds: [x, 56 + Math.round((chipH - 36) / 2), chipW, 36], style: theme.font(26, { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.35 }) }));
    tx = x + chipW + 28;
    const th = textHeight(title, titleSize, grid.right - tx, 1.2) + 8;
    elements.push(textElement({ id: 'title', text: title, bounds: [tx, 56, grid.right - tx, th], style: theme.font(titleSize, { fontWeight: 700, lineHeight: 1.2, fontFamily: theme.headingFamily }), ...(runs ? { runs } : {}) }));
    bottom = 56 + Math.max(chipH, th) + 20;
    elements.push(lineElement({ id: 'title-rule', from: [x, bottom], to: [grid.right, bottom], style: { stroke: p.ink, strokeWidth: 1 } }));
    tx = x;
  } else {
    const th = textHeight(title, titleSize, w - 24, 1.2) + 8;
    elements.push({ type: 'shape', id: 'title-mark', bounds: [x, 104, 10, Math.round(titleSize * 1.05)], style: { fill: p.accent } });
    elements.push(textElement({ id: 'title', text: title, bounds: [x + 32, 98, w - 32, th], style: theme.font(titleSize, { fontWeight: 700, lineHeight: 1.2, fontFamily: theme.headingFamily }), ...(runs ? { runs } : {}) }));
    bottom = 98 + th;
  }
  if (subtitle) { const s = textBlock({ id: 'subtitle', x: tx, y: bottom + (tag ? 16 : 8), width: grid.right - tx, text: subtitle, size: 26, theme, style: { color: p.muted } }); elements.push(...s.elements); bottom += (tag ? 16 : 8) + s.height; }
  if (source) elements.push(textElement({ id: 'source', text: source, bounds: [x, 1028, w - 200, 28], style: theme.font(17, { color: p.muted }) }));
  if (page) elements.push(textElement({ id: 'page-number', text: `${String(page).padStart(2, '0')}${total ? ' / ' + String(total).padStart(2, '0') : ''}`, bounds: [grid.right - 160, 1028, 160, 28], style: theme.font(17, { color: p.muted, textAlign: 'right' }) }));
  return { elements, bottom: Math.round(bottom), focus: { elementId: 'title', ...(at < 0 ? {} : { text: focus }) } };
}

// zones: [id, role, [x, y, w, h]] for the page's regions; the visual check keeps elements inside them.
const decision = (pattern, header, layout, zones) => ({ pattern, focus: header.focus, layout, zones: zones.map(([id, role, b]) => ({ id, role, bounds: b.map(Math.round) })) });

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
  return { elements: [...header.elements, ...elements], visualDecision: decision('tableWithFlows', header, '上方分工表按支持层级排列，下方色带承载共用流程，节点与说明对齐', [['table', 'data', [grid.left, top, grid.width, tb.height + 24]], ['flows', 'flow', [grid.left, bandY + 20, grid.width, FOOTER_TOP - bandY - 40]]]) };
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
  // Shared photo policy: the evidence keeps its own shape (a landscape lies wide, a portrait stands tall), as large as
  // the column allows, centred in it; no panel behind it.
  const ph = FOOTER_TOP - top - 20, g = photoGroup({ id: 'evidence', x: rx, y: top, width: rw, maxHeight: ph, images: [image], theme });
  // The single evidence image keeps the id 'evidence', so existing scripts and patches still find it.
  let named = false;
  elements.push(...shiftX(g.elements, Math.round((rw - (g.width || rw)) / 2)).map((e) => (e.type === 'image' && !named ? (named = true, { ...e, id: 'evidence' }) : e)));
  return { elements: [...header.elements, ...elements], visualDecision: decision('metricsWithEvidence', header, '左侧主指标放大承担主视觉，次级指标同基线成行，下接机制流程；右侧色面完整展示证据图', [['metrics', 'focus', [lx, top, lw, y - top]], ['evidence', 'evidence', [rx, top, rw, g.height]]]) };
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
  // Frames first: the photo column always fills its box (top and bottom level with the left column's span);
  // photos are cropped into the frames rather than shrunk with gaps around them.
  const fill = perRow === 'auto' ? photoGroup({ id: 'photos', x: rx, y: top, width: rw, height: photoH, images: photos, theme }) : null;
  const g = fill || imageGrid({ id: 'photos', x: rx, y: top, width: rw, images: photos, perRow, theme, maxHeight: photoH });
  elements.push(...(fill ? fill.elements : shiftX(g.elements, (rw - g.width) / 2)));
  return { elements: [...header.elements, ...elements], visualDecision: decision('listWithPhotos', header, '左侧编号资源、结果指标与复盘判断，右侧照片铺满整栏作为证据', [['items', 'support', [lx, top, lw, y - top + 8]], ['photos', 'evidence', [rx, top, rw, (fill ? photoH : g.height) + 8]]]) };
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
      // Frames first: every photo fills its column box, cropped around its focal point, so the photo row stays one
      // even band under the columns. A portrait in a wide box loses more; set focal to keep faces and key text.
      const size = it.photo.size || imageSize(it.photo.src);
      elements.push({ type: 'image', id: `item-${i + 1}-photo`, src: it.photo.src, bounds: [x, boxY, colW, boxH], frame: [x, boxY, colW, boxH], fit: 'cover', focal: it.photo.focal || '50% 40%', naturalSize: [size.width, size.height], style: { radius: theme.radius }, ...(it.photo.alt ? { alt: it.photo.alt } : {}) });
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
  return { elements: [...header.elements, ...elements], visualDecision: decision('itemsWithPhotos', header, '每项资源一栏，标题与说明在上、对应照片正下方，底部结果指标与复盘', [['items', 'support', [grid.left, top, grid.width, headH]], ['photos', 'evidence', [grid.left, boxY, grid.width, boxH + capH]], ['results', 'data', [grid.left, boxY + boxH + capH + 10, grid.width, FOOTER_TOP - (boxY + boxH + capH + 10)]]]) };
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
  return { elements: [...header.elements, ...elements], visualDecision: decision('photoPanels', header, '色块与照片融合：深色一侧写标题和要点，向照片渐隐过渡，每张照片对应一项', zones) };
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
  return { elements: [...header.elements, ...elements], visualDecision: decision('tableWithPanel', header, '左侧逐行明细表，右侧深色侧栏用节点链说明应用路径', [['table', 'data', [lx, top, rx - lx - grid.gutter, tb.height + 8]], ['panel', 'flow', [rx, top, rw, ph]]]) };
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
  return { elements: [...header.elements, ...elements], visualDecision: decision('twoLaneFlow', header, '两条流程上下并列，标题在左，节点与说明逐一对齐', [['lanes', 'flow', [grid.left, top, grid.width, Math.min(FOOTER_TOP - 20, y + 60) - top]]]) };
}

// ---- Report page types distilled from a 245-page work-report template (see references/fusion/report-layout-logic.md).
// Shared logic: one solid primary block anchors the page's answer; the comparison side is a soft secondary tint;
// columns that belong together share one x-range from the figure down to its explanation.

// Spread spare height over n gaps (at most `cap` each) so short content does not leave one empty block at the bottom.
const spread = (spare, n, cap = 56) => (n > 0 ? Math.max(0, Math.min(cap, Math.floor(spare / n))) : 0);

// Target vs actual: a plan row of targets, below it the actual results on a band led by one dark anchor block with the
// overall figure (整体完成度), then per-metric completion bars and explanations in the same columns.
// items: [{ label, target: { value, unit }, actual: { value, unit }, note?, rate?, detail? }]; rate is a percent number.
export function targetVsActual({ theme, grid, header, period = '', overall, items, analysis, metricSize = 56 }) {
  const p = theme.palette, r = colorRoles(p), x = grid.left, w = grid.width, n = items.length, elements = [];
  if (n < 1 || n > 5) throw new Error('targetVsActual takes 1–5 metrics');
  const aw = Math.round(w * 0.17), colW = (w - aw) / n, cols = items.map((_, i) => [Math.round(x + aw + i * colW), Math.round(colW)]);
  const detailH = Math.max(0, ...items.map((it) => (it.detail ? textHeight(it.detail, 22, Math.round(colW) - 48, 1.5) : 0)));
  const analysisH = analysis ? textHeight(analysis, 24, w - 220, 1.5) : 0, hasRate = items.some((it) => Number.isFinite(it.rate));
  const planH = 136, stripH = 160, rateH = hasRate ? 64 : 0;
  const used = planH + stripH + rateH + (detailH ? detailH + 8 : 0) + (analysisH ? analysisH + 40 : 0);
  const top = header.bottom + 36, gap = 24 + spread(FOOTER_TOP - 20 - top - used - 24 * 3, 3, 72);
  // Plan row: period label in the anchor column, targets with label above and value below, thin rules between.
  elements.push(textElement({ id: 'plan-period', text: `${period}${period ? '\n' : ''}计划目标`, bounds: [x, top + 18, aw - 24, planH - 36], style: theme.font(32, { fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }) }));
  items.forEach((it, i) => {
    const [cx, cw] = cols[i];
    elements.push(textElement({ id: `plan-label-${i + 1}`, text: it.label, bounds: [cx + 12, top + 20, cw - 24, 32], style: theme.font(22, { fontWeight: 700, color: p.muted, textAlign: 'center' }) }));
    const unitSize = Math.max(20, Math.round(metricSize * 0.36));
    elements.push(textElement({ id: `plan-value-${i + 1}`, text: `${it.target.value}${it.target.unit ? ' ' + it.target.unit : ''}`, runs: [{ text: String(it.target.value), style: { fontSize: Math.round(metricSize * 0.8), fontWeight: 700, color: p.ink } }, ...(it.target.unit ? [{ text: ' ' + it.target.unit, style: { fontSize: unitSize, fontWeight: 700, color: p.ink } }] : [])], bounds: [cx + 12, top + 62, cw - 24, Math.round(metricSize * 1.05)], style: theme.font(Math.round(metricSize * 0.8), { fontWeight: 700, textAlign: 'center', lineHeight: 1.15 }) }));
    elements.push(lineElement({ id: `plan-rule-${i + 1}`, from: [cx, top + 24], to: [cx, top + planH - 24], style: { stroke: p.line, strokeWidth: 2 } }));
  });
  let y = top + planH + gap;
  const strip = kpiStrip({ id: 'actual', x, y, width: w, anchor: overall, items: items.map((it) => ({ ...it.actual, note: it.note })), theme, height: stripH, anchorWidth: aw, size: metricSize });
  elements.push(...strip.elements);
  y += stripH + gap;
  const dataBottom = y;
  if (hasRate) {
    elements.push(textElement({ id: 'rate-heading', text: '各项完成率', bounds: [x, y, aw - 24, 34], style: theme.font(24, { fontWeight: 700, color: r.primary, textAlign: 'center' }) }));
    items.forEach((it, i) => {
      if (!Number.isFinite(it.rate)) return;
      const [cx, cw] = cols[i], bx = cx + 24, bw = cw - 48, done = it.rate >= 100;
      elements.push(textElement({ id: `rate-label-${i + 1}`, text: `完成 ${it.rate}%`, bounds: [bx, y, bw, 30], style: theme.font(22, { fontWeight: 700, color: done ? r.primary : r.secondaryInk }) }));
      elements.push({ type: 'shape', id: `rate-track-${i + 1}`, bounds: [bx, y + 40, bw, 12], style: { fill: r.band, radius: 6 } });
      elements.push({ type: 'shape', id: `rate-fill-${i + 1}`, bounds: [bx, y + 40, Math.max(12, Math.round(bw * Math.min(100, it.rate) / 100)), 12], style: { fill: done ? r.primary : r.secondary, radius: 6 } });
    });
    y += rateH;
  }
  if (detailH) {
    y += 8;
    items.forEach((it, i) => { if (it.detail) { const [cx, cw] = cols[i]; elements.push(textElement({ id: `detail-${i + 1}`, text: it.detail, bounds: [cx + 24, y, cw - 48, textHeight(it.detail, 22, cw - 48, 1.5)], style: theme.font(22, { color: p.muted, lineHeight: 1.5 }) })); } });
    y += detailH;
  }
  const zones = [['targets', 'data', [x, top, w, dataBottom - top - gap]]];
  if (rateH || detailH) zones.push(['explain', 'support', [x, dataBottom - 4, w, y - dataBottom + 8]]);
  if (analysisH) {
    y += gap;
    elements.push(lineElement({ id: 'analysis-rule', from: [x, y], to: [grid.right, y], style: { stroke: p.line, strokeWidth: 1 } }));
    elements.push(textElement({ id: 'analysis-label', text: '分析', bounds: [x, y + 24, 160, 34], style: theme.font(24, { fontWeight: 700, color: r.primary }) }));
    elements.push(textElement({ id: 'analysis', text: analysis, bounds: [x + 200, y + 24, w - 200, analysisH], style: theme.font(24, { lineHeight: 1.5 }) }));
    zones.push(['analysis', 'note', [x, y, w, analysisH + 40]]);
  }
  return { elements: [...header.elements, ...elements], visualDecision: decision('targetVsActual', header, '上行计划目标、下行实际结果同列对照，左端深色块给出整体完成度作为第一眼重点，完成率与说明落在各自指标列下', zones) };
}

// Two sides compared row by row (亮点 vs 待改进, 问题 vs 改进, 去年 vs 今年): the left side in primary, the right in a
// soft secondary tint, numbered rows in the middle tie each pair together and a VS disc sits on the seam.
// left/right: { title, items: [{ value?, unit?, title, points: [] }] } with the same number of items (rows must pair).
export function contrastColumns({ theme, grid, header, left: l, right: rt, badge = 'VS' }) {
  // Sides may differ in length: the shorter side's missing rows stay empty, so rows that do pair still line up.
  const n = Math.max(l.items.length, rt.items.length), pad0 = (side) => ({ ...side, items: [...side.items, ...Array.from({ length: n - side.items.length }, () => ({ title: '', points: [] }))] });
  const left = pad0(l), right = pad0(rt), p = theme.palette, r = colorRoles(p), elements = [];
  if (n < 1 || n > 4) throw new Error('contrastColumns takes 1–4 rows');
  const mid = 120, sideW = Math.round((grid.width - mid) / 2), lx = grid.left, rx = grid.left + sideW + mid, top = header.bottom + 36, capH = 76;
  const sides = [[left, lx, r.primary, r.band, p.inverse, r.primary], [right, rx, lighten(r.secondary, 0.45), r.soft, r.secondaryInk, r.secondaryInk]];
  // Measure every cell: a metric cell (value over title) on the left third, points on the rest; or title above points.
  const cell = (it, cw) => {
    const metric = it.value != null, pw = metric ? cw - 300 : cw, pts = (it.points || []).length > 0;
    const ph = pts ? pointsHeight(it.points, 22, pw, 1.55) : 0, head = metric || !it.title ? 0 : textHeight(it.title, 28, cw, 1.3) + 10;
    return { metric, pw, pts, ph, head, h: Math.max(metric ? 132 : 0, head + ph) };
  };
  const cw = sideW - 64, cells = [left, right].map((s) => s.items.map((it) => cell(it, cw)));
  const base = cells[0].map((c, i) => Math.max(c.h, cells[1][i].h));
  const bodyTop = top + capH, pad = 28 + spread(FOOTER_TOP - 20 - bodyTop - base.reduce((a, b) => a + b, 0) - 56 * n, 2 * n, 36);
  const rowsH = base.map((h) => h + pad * 2), bodyH = rowsH.reduce((a, b) => a + b, 0) + 16;
  sides.forEach(([side, sx, capFill, bodyFill, capInk, ink], k) => {
    // The body panel runs under the title cap (the cap sits inside it), so the two read as one column.
    elements.push({ type: 'shape', id: `side-${k + 1}-body`, ...(k === 0 ? { component: 'contrastPair' } : {}), bounds: [sx, top, sideW, capH + bodyH], style: { fill: bodyFill, radius: theme.radius } });
    elements.push({ type: 'shape', id: `side-${k + 1}-cap`, bounds: [sx, top, sideW, capH], style: { fill: capFill, radius: theme.radius } });
    elements.push(textElement({ id: `side-${k + 1}-title`, text: side.title, bounds: [sx + 32, top + 16, sideW - 64, 44], style: theme.font(32, { fontWeight: 700, color: capInk, textAlign: 'center' }) }));
    let y = bodyTop + 8;
    side.items.forEach((it, i) => {
      const c = cells[k][i], cy = y + pad + (c.metric ? 0 : Math.round((base[i] - c.h) / 2)), cx = sx + 32;
      if (c.metric) {
        const vs = 60, us = 26, vy = cy + Math.round((base[i] - 132) / 2);
        elements.push(textElement({ id: `side-${k + 1}-value-${i + 1}`, text: `${it.value}${it.unit ? ' ' + it.unit : ''}`, runs: [{ text: String(it.value), style: { fontSize: vs, fontWeight: 700, color: ink } }, ...(it.unit ? [{ text: ' ' + it.unit, style: { fontSize: us, fontWeight: 700, color: ink } }] : [])], bounds: [cx, vy, 260, 76], style: theme.font(vs, { fontWeight: 700, color: ink, textAlign: 'center', lineHeight: 1.15 }) }));
        elements.push(textElement({ id: `side-${k + 1}-label-${i + 1}`, text: it.title, bounds: [cx, vy + 84, 260, 34], style: theme.font(22, { fontWeight: 700, color: ink, textAlign: 'center' }) }));
        if (c.pts) elements.push(...pointList({ id: `side-${k + 1}-points-${i + 1}`, x: cx + 300, y: cy + Math.round((base[i] - c.ph) / 2), width: c.pw, points: it.points, size: 22, color: p.ink, theme, lh: 1.55 }));
      } else {
        if (it.title) elements.push(textElement({ id: `side-${k + 1}-label-${i + 1}`, text: it.title, bounds: [cx, cy, cw, c.head - 10], style: theme.font(28, { fontWeight: 700, color: ink, lineHeight: 1.3 }) }));
        if (c.pts) elements.push(...pointList({ id: `side-${k + 1}-points-${i + 1}`, x: cx, y: cy + c.head, width: cw, points: it.points, size: 22, color: p.ink, theme, lh: 1.55 }));
      }
      y += rowsH[i];
      if (i < n - 1) elements.push(lineElement({ id: `side-${k + 1}-rule-${i + 1}`, from: [cx, y], to: [sx + sideW - 32, y], style: { stroke: k === 0 ? lighten(r.primary, 0.75) : lighten(r.secondary, 0.4), strokeWidth: 1 } }));
    });
  });
  // Row numbers in the middle column tie each pair; the VS disc sits on the seam between the two titles.
  let y = bodyTop + 8;
  rowsH.forEach((h, i) => { elements.push(textElement({ id: `row-num-${i + 1}`, text: String(i + 1).padStart(2, '0'), bounds: [lx + sideW, y + Math.round(h / 2) - 24, mid, 48], style: theme.font(34, { fontWeight: 700, color: p.ink, textAlign: 'center', lineHeight: 1.3 }) })); y += h; });
  if (badge) {
    const d = 104, bx = lx + sideW + Math.round((mid - d) / 2), by = top + Math.round(capH / 2 - d / 2);
    elements.push({ type: 'shape', id: 'vs-disc', bounds: [bx, by, d, d], style: { fill: '#26262B', radius: d / 2 } });
    elements.push(textElement({ id: 'vs-text', text: badge, bounds: [bx, by + Math.round(d / 2 - 26), d, 52], style: theme.font(40, { fontWeight: 800, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.3 }) }));
  }
  const zh = capH + bodyH;
  return { elements: [...header.elements, ...elements], visualDecision: decision('contrastColumns', header, '左右两侧逐行对照：左侧主色承载已达成或现状，右侧浅辅色承载差距或改进，中间编号把每一对连起来，VS 标在分界处', [['left', 'focus', [lx, top, sideW, zh]], ['pairs', 'support', [lx + sideW, top, mid, zh]], ['right', 'evidence', [rx, top, sideW, zh]]]) };
}

// Period columns: an arrow band of periods (months, quarters, phases) heads the page and each period owns the column
// beneath it — title, optional rate badge, points — with an optional KPI strip summarising the whole span at the bottom.
// periods: [{ label, title, rate?: { value, unit?, label? }, points: [], tone?: 'primary'|'secondary' }] (3–6).
export function periodColumns({ theme, grid, header, periods, summary }) {
  const p = theme.palette, r = colorRoles(p), n = periods.length, elements = [];
  if (n < 2 || n > 6) throw new Error('periodColumns takes 2–6 periods');
  const top = header.bottom + 36, bandH = 64, x = grid.left, w = grid.width, colW = w / n;
  const tone = (pd, i) => (pd.tone || (i % 2 ? 'secondary' : 'primary')) === 'primary';
  // Band: full bleed from the left edge, one segment per column, arrow head past the last column.
  elements.push({ type: 'shape', id: 'band-lead', bounds: [0, top, x, bandH], style: { fill: tone(periods[0], 0) ? r.primary : r.secondary } });
  periods.forEach((pd, i) => {
    const cx = Math.round(x + i * colW), cw = Math.round(colW);
    elements.push({ type: 'shape', id: `band-${i + 1}`, ...(i === 0 ? { component: 'periodBand' } : {}), bounds: [cx, top, cw, bandH], style: { fill: tone(pd, i) ? r.primary : r.secondary } });
    elements.push(textElement({ id: `band-label-${i + 1}`, text: pd.label, bounds: [cx + 8, top + 14, cw - 16, 36], style: theme.font(26, { fontWeight: 700, color: tone(pd, i) ? p.inverse : r.onSecondary, textAlign: 'center' }) }));
  });
  const last = periods[n - 1];
  elements.push({ type: 'vector', id: 'band-arrow', bounds: [grid.right, top - 14, 44, bandH + 28], viewBox: [0, 0, 44, 92], path: 'M0,0 L44,46 L0,92 Z', style: { fill: tone(last, n - 1) ? r.primary : r.secondary, stroke: 'none' } });
  const stripH = summary ? 150 : 0, colTop = top + bandH + 12;
  const cw = Math.round(colW) - 56, colBottomMax = FOOTER_TOP - 20 - (summary ? stripH + 28 : 0), room = colBottomMax - colTop - 64;
  // Larger text when the columns have room: the biggest point size whose tallest column fills at most 80% of it.
  const measure = (pd, ps) => {
    const ts = ps + 6, titleW = pd.rate ? cw - 168 : cw, th = textHeight(pd.title, ts, titleW, 1.3), pts = (pd.points || []).length > 0;
    return { ps, ts, titleW, th, pts, ph: pts ? pointsHeight(pd.points, ps, cw, 1.5) : 0, head: Math.max(th, pd.rate ? 88 : 0) };
  };
  const fit = (ps) => periods.map((pd) => measure(pd, ps)), tallest = (ms) => Math.max(...ms.map((m) => m.head + 24 + m.ph));
  const ms = [28, 26, 24, 22].map(fit).find((m) => tallest(m) <= room * 0.8) || fit(22), content = tallest(ms);
  if (content > room) throw new Error('periodColumns: column text does not fit; shorten points or use fewer periods');
  const colH = Math.min(colBottomMax - colTop, content + 64 + spread(room - content, 1, 72));
  periods.forEach((pd, i) => {
    const cx = Math.round(x + i * colW), ccw = Math.round(colW), m = ms[i], on = tone(pd, i), tx = cx + 28, ty = colTop + 8 + 28;
    elements.push({ type: 'shape', id: `col-${i + 1}-cap`, bounds: [cx + 4, colTop, ccw - 8, 8], style: { fill: on ? r.primary : r.secondary } });
    if (i > 0) elements.push(lineElement({ id: `col-rule-${i}`, from: [cx, colTop + 28], to: [cx, colTop + colH - 16], style: { stroke: p.line, strokeWidth: 1 } }));
    elements.push(textElement({ id: `col-${i + 1}-title`, text: pd.title, bounds: [tx, ty, m.titleW, m.th], style: theme.font(m.ts, { fontWeight: 700, lineHeight: 1.3 }) }));
    if (pd.rate) {
      const bx = cx + ccw - 28 - 148;
      elements.push({ type: 'shape', id: `col-${i + 1}-rate-box`, bounds: [bx, ty, 148, 88], style: { fill: on ? r.band : r.soft, radius: theme.radius } });
      elements.push(textElement({ id: `col-${i + 1}-rate`, text: `${pd.rate.value}${pd.rate.unit ?? '%'}`, runs: [{ text: String(pd.rate.value), style: { fontSize: 40, fontWeight: 700, color: on ? r.primary : r.secondaryInk } }, { text: pd.rate.unit ?? '%', style: { fontSize: 22, fontWeight: 700, color: on ? r.primary : r.secondaryInk } }], bounds: [bx, ty + 4, 148, 54], style: theme.font(40, { fontWeight: 700, textAlign: 'center', lineHeight: 1.25 }) }));
      elements.push(textElement({ id: `col-${i + 1}-rate-label`, text: pd.rate.label || '达成率', bounds: [bx, ty + 58, 148, 26], style: theme.font(18, { color: p.muted, textAlign: 'center' }) }));
    }
    if (m.pts) elements.push(...pointList({ id: `col-${i + 1}-points`, x: tx, y: ty + m.head + 24, width: cw, points: pd.points, size: m.ps, color: p.muted, theme, lh: 1.5 }));
  });
  const zones = [['periods', 'flow', [0, top, grid.right + 44, colTop + colH - top]]];
  if (summary) {
    const sy = colTop + colH + 28 + spread(colBottomMax - colTop - colH, 1, 48);
    elements.push(...kpiStrip({ id: 'summary', x, y: sy, width: w, anchor: summary.overall, items: summary.items, theme, height: stripH, size: 48 }).elements);
    zones.push(['summary', 'data', [x, sy, w, stripH]]);
  }
  return { elements: [...header.elements, ...elements], visualDecision: decision('periodColumns', header, '顶部箭头色带按时期分段，每段下方一栏写该期重点、达成率与要点，主辅色交替区分阶段；底部深色块给出全期汇总', zones) };
}

// Item rows: the item list stays plain text (number, title, detail — no boxes), and the figures that would sit in a
// separate row of tiles are stacked into one column, each tile beside the item it belongs to. Photos keep their own
// shape: they are laid out at their native ratios (a portrait stands tall, landscapes lie wide — a tall-left mosaic or
// rows, whichever shows them largest), at the column width that fits the page best; the item rows then share the
// photo block's top and bottom. The photos form one group and do not imply which belongs to which item; photos that do
// belong one to each item go under them with itemsWithPhotos instead.
// items: [{ title, detail?, metric?: { value, unit?, label } }]; photos: [{ src, size?, focal? }].
export function itemRows({ theme, grid, header, items, photos = [], highlight = -1, gap = 24 }) {
  const n = items.length, top = header.bottom + 40, maxH = FOOTER_TOP - 20 - top, elements = [];
  if (n < 2 || n > 5) throw new Error('itemRows takes 2–5 items');
  const list = (Array.isArray(photos) ? photos : photos?.images || []).map(({ caption, ...img }) => ({ ...img, size: img.size || imageSize(img.src) }));
  const ratio = (im) => im.size.width / im.size.height, hasMetric = items.some((it) => it.metric);
  const images = list;
  const minRows = n * 120 + gap * (n - 1), area = (g) => g.elements.filter((e) => e.type === 'image').reduce((a, e) => a + e.bounds[2] * e.bounds[3], 0);
  let photo = null;
  // Wider photo columns show the photos larger; the item column keeps at least 640px for text and tiles.
  for (const cols of [3, 4, 5, 6, 7, 8]) {
    if (!images.length) break;
    const [, pw] = grid.span(12 - cols, cols);
    if (grid.width - pw - grid.gutter < 640) continue;
    // Shared photo policy: native ratios, largest layout within the page height, edges squared with a mild crop.
    const g = photoGroup({ id: 'photos', x: 0, y: top, width: pw, maxHeight: maxH, images, theme });
    if (g.height > maxH) continue;
    const cand = { g, w: g.width || pw, h: g.height, a: area(g) }, fits = cand.h >= minRows;
    if (!photo || (fits && !photo.fits) || (fits === photo.fits && cand.a > photo.a)) photo = { ...cand, fits };
  }
  const H = photo ? Math.max(photo.h, minRows) : maxH, px = photo ? grid.right - photo.w : grid.right + grid.gutter;
  if (photo) elements.push(...shiftX(photo.g.elements, px).map((e) => ({ ...e, bounds: [e.bounds[0], e.bounds[1] + Math.round((H - photo.h) / 2), e.bounds[2], e.bounds[3]] })));
  const leftW = px - grid.gutter - grid.left, tileW = hasMetric ? Math.min(340, Math.round(leftW * 0.34)) : 0, textW = leftW - (hasMetric ? tileW + 40 : 0);
  const rowH = Math.floor((H - gap * (n - 1)) / n), metricSize = Math.max(40, Math.min(64, Math.floor((rowH - 24 - 34 - 26) / 1.32)));
  items.forEach((it, i) => {
    const y = top + i * (rowH + gap), id = `row-${i + 1}`;
    const l = numberedList({ id, x: grid.left, y: 0, width: textW, items: [{ title: it.title, detail: it.detail }], theme, badge: 56, titleSize: 32, detailSize: 24, gap: 0, start: i + 1 });
    if (l.height > rowH) throw new Error(`itemRows: item ${i + 1} needs ${l.height}px but a row has ${rowH}px: shorten details or use fewer items`);
    // Plain text centred on its row, so it lines up with the tile beside it.
    const dy = y + Math.round((rowH - l.height) / 2);
    elements.push(...l.elements.map((e) => ({ ...e, bounds: [e.bounds[0], e.bounds[1] + dy, e.bounds[2], e.bounds[3]] })));
    if (it.metric) {
      const t = metricTiles({ id: `${id}-metric`, x: grid.left + leftW - tileW, y: 0, width: tileW, items: [it.metric], theme, size: metricSize, highlight: i === highlight ? 0 : -1, highlightStyle: 'solid' });
      const ty = y + Math.round((rowH - t.height) / 2);
      elements.push(...t.elements.map((e) => ({ ...e, bounds: [e.bounds[0], e.bounds[1] + ty, e.bounds[2], e.bounds[3]] })));
    }
  });
  const zones = [['rows', 'support', [grid.left, top, leftW, H]], ...(photo ? [['photos', 'media', [px, top, photo.w, H]]] : [])];
  return { elements: [...header.elements, ...elements], visualDecision: decision('itemRows', header, '编号事项保持文字，各项数据色块竖排在对应行；照片按原图比例成组（竖图竖放、横图横放），上下与事项区对齐', zones) };
}

// Explicit composition helper: caller owns regions; no automatic fact selection or font reduction.
export async function rolesWithSchedule({roleSpec,scheduleSpec,measurer}) {
  const {roleGroup,schedule,measureModule}=await import('./capacity-kit.mjs');
  const roles=measurer?await measureModule(roleGroup,roleSpec,measurer):roleGroup(roleSpec);
  const times=measurer?await measureModule(schedule,scheduleSpec,measurer):schedule(scheduleSpec);
  const [a,b]=[roleSpec.bounds,scheduleSpec.bounds];
  if(Math.min(a[0]+a[2],b[0]+b[2])>Math.max(a[0],b[0])&&Math.min(a[1]+a[3],b[1]+b[3])>Math.max(a[1],b[1]))throw new Error('role and schedule regions overlap');
  const elements=[...roles.elements,...times.elements];
  if(new Set(elements.map(e=>e.id)).size!==elements.length)throw new Error('module IDs must be distinct');
  return {elements,bindings:[...roles.bindings,...times.bindings],modules:{roles,times},capacity:{status:[roles,times].some(m=>m.capacity.status==='cannot-fit')?'cannot-fit':[roles,times].some(m=>m.capacity.status==='needs-reflow')?'needs-reflow':'fits',method:measurer?'measured':'estimated'}};
}
