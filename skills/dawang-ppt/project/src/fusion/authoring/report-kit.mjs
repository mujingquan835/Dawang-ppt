import { textElement } from './elements.mjs';
import { colorRoles, lighten, textWidth, textHeight, pointList, pointsHeight } from './layout-kit.mjs';
import { pickIcon, iconElements } from './icons.mjs';

// Report components: the layout logic distilled from a work-report template (references/fusion/report-layout-logic.md),
// cut into pieces that fit any region of any page. They follow the template's relationships, never its numbers:
// a value can be a figure, a short phrase or absent. Each returns { elements, height } and stamps its main shape with
// `component`, so the page check can see that a report component carries the page.
//   answerBlock  — one solid primary block holding the page's answer (整体完成度, 超额完成, 结论).
//   comparePair  — before → after, or target → actual: soft secondary side, primary side, an arrow between.
//   contrastPair — two sides compared (现状/改进, 问题/原因, 亮点/待改进): primary and soft sides with a VS disc.
//   periodBand   — an arrow band split into periods; returns each segment's column for whatever goes beneath.

const fitSize = (text, width, max, min = 28) => {
  const em = Math.max(1, textWidth(String(text), 1));
  return Math.max(min, Math.min(max, Math.floor((width * 0.92) / em)));
};
const valueRuns = (value, unit, size, color) => [{ text: String(value), style: { fontSize: size, fontWeight: 800, color } }, ...(unit ? [{ text: ' ' + unit, style: { fontSize: Math.max(20, Math.round(size * 0.4)), fontWeight: 700, color } }] : [])];

export function answerBlock({ id, x, y, width, height, label, value, unit, note, theme, fill }) {
  const p = theme.palette, r = colorRoles(p), pad = 36, iw = width - pad * 2;
  const size = fitSize(`${value}${unit ? ' ' + unit : ''}`, iw, 120), valueH = Math.round(size * 1.3);
  const noteH = note ? textHeight(note, 26, iw, 1.4) : 0, need = pad * 2 + (label ? 44 : 0) + valueH + (note ? 12 + noteH : 0);
  const h = Math.max(need, height || 0), top = y + Math.round((h - need) / 2) + pad, elements = [];
  elements.push({ type: 'shape', id: `${id}-block`, component: 'answerBlock', bounds: [x, y, width, h], style: { fill: fill || r.primary, radius: theme.radius ?? 0 } });
  let cy = top;
  if (label) { elements.push(textElement({ id: `${id}-label`, text: label, bounds: [x + pad, cy, iw, 36], style: theme.font(26, { fontWeight: 700, color: 'rgba(255, 255, 255, 0.82)' }) })); cy += 44; }
  elements.push(textElement({ id: `${id}-value`, text: `${value}${unit ? ' ' + unit : ''}`, runs: valueRuns(value, unit, size, p.inverse), bounds: [x + pad, cy, iw, valueH], style: theme.font(size, { fontWeight: 800, color: p.inverse, lineHeight: 1.15 }) }));
  cy += valueH;
  if (note) elements.push(textElement({ id: `${id}-note`, text: note, bounds: [x + pad, cy + 12, iw, noteH], style: theme.font(26, { color: p.inverse, lineHeight: 1.4 }) }));
  // Like a metric tile, a wide empty strip on the right gets an icon (same rule, same 56px minimum).
  const content = Math.max(label ? textWidth(label, 26) : 0, textWidth(String(value), size) + (unit ? textWidth(' ' + unit, Math.round(size * 0.4)) : 0), note ? Math.min(iw, textWidth(note, 26)) : 0);
  const iconS = Math.round(Math.min(180, h - 48, iw - content - 32));
  if (iconS >= 56) elements.push(...iconElements({ id: `${id}-block`, name: pickIcon(`${label || ''}${unit || ''}${note || ''}`), bounds: [x + width - pad - iconS, y + Math.round((h - iconS) / 2), iconS], color: p.inverse, disc: 'rgba(255, 255, 255, 0.14)' }));
  return { elements, height: h };
}

// before / after: { label, value, unit? }; note: one line under both (达成 128.6%, 同比 +56%).
export function comparePair({ id, x, y, width, height, before, after, note, theme, solidAfter = false }) {
  const p = theme.palette, r = colorRoles(p), arrow = 64, sideW = Math.round((width - arrow) / 2), pad = 28;
  const size = Math.min(fitSize(`${before.value}${before.unit ? ' ' + before.unit : ''}`, sideW - pad * 2, 72), fitSize(`${after.value}${after.unit ? ' ' + after.unit : ''}`, sideW - pad * 2, 72));
  const valueH = Math.round(size * 1.3), noteH = note ? 40 : 0, need = pad * 2 + 36 + 8 + valueH;
  const sideH = Math.max(need, (height || 0) - noteH), elements = [];
  const side = (k, s, sx, fillColor, ink) => {
    elements.push({ type: 'shape', id: `${id}-${k}`, ...(k === 'after' ? { component: 'comparePair' } : {}), bounds: [sx, y, sideW, sideH], style: { fill: fillColor, radius: theme.radius ?? 0 } });
    const top = y + Math.round((sideH - (36 + 8 + valueH)) / 2);
    elements.push(textElement({ id: `${id}-${k}-label`, text: s.label, bounds: [sx + pad, top, sideW - pad * 2, 36], style: theme.font(24, { fontWeight: 700, color: ink }) }));
    elements.push(textElement({ id: `${id}-${k}-value`, text: `${s.value}${s.unit ? ' ' + s.unit : ''}`, runs: valueRuns(s.value, s.unit, size, ink), bounds: [sx + pad, top + 44, sideW - pad * 2, valueH], style: theme.font(size, { fontWeight: 800, color: ink, lineHeight: 1.15 }) }));
  };
  side('before', before, x, r.soft, r.secondaryInk);
  side('after', after, x + sideW + arrow, solidAfter ? r.primary : r.band, solidAfter ? p.inverse : r.primary);
  const ay = y + Math.round(sideH / 2);
  // A chevron between the sides reads as “becomes”; a line arrow this short renders as a blob.
  elements.push({ type: 'vector', id: `${id}-arrow`, bounds: [x + sideW + Math.round((arrow - 28) / 2), ay - 24, 28, 48], viewBox: [0, 0, 28, 48], path: 'M4,4 L24,24 L4,44', style: { fill: 'none', stroke: r.primary, strokeWidth: 5 } });
  if (note) elements.push(textElement({ id: `${id}-note`, text: note, bounds: [x + sideW + arrow, y + sideH + 8, sideW, 32], style: theme.font(22, { fontWeight: 700, color: r.primary }) }));
  return { elements, height: sideH + noteH };
}

// left / right: { title, points: [] }. Sides may hold different numbers of points; both panels share one height.
export function contrastPair({ id, x, y, width, height, left, right, badge = 'VS', theme }) {
  const p = theme.palette, r = colorRoles(p), gap = 72, sideW = Math.round((width - gap) / 2), pad = 32, capH = 68, iw = sideW - pad * 2;
  const ph = (s) => pointsHeight(s.points || [], 24, iw, 1.5);
  const need = capH + pad * 2 + Math.max(ph(left), ph(right)), h = Math.max(need, height || 0), elements = [];
  [[left, x, r.primary, r.band, p.inverse, p.ink], [right, x + sideW + gap, lighten(r.secondary, 0.45), r.soft, r.secondaryInk, p.ink]].forEach(([s, sx, cap, body, capInk, ink], k) => {
    elements.push({ type: 'shape', id: `${id}-side-${k + 1}`, ...(k === 0 ? { component: 'contrastPair' } : {}), bounds: [sx, y, sideW, h], style: { fill: body, radius: theme.radius ?? 0 } });
    elements.push({ type: 'shape', id: `${id}-cap-${k + 1}`, bounds: [sx, y, sideW, capH], style: { fill: cap, radius: theme.radius ?? 0 } });
    elements.push(textElement({ id: `${id}-title-${k + 1}`, text: s.title, bounds: [sx + pad, y + 14, iw, 40], style: theme.font(30, { fontWeight: 700, color: capInk, textAlign: 'center' }) }));
    if ((s.points || []).length) elements.push(...pointList({ id: `${id}-points-${k + 1}`, x: sx + pad, y: y + capH + pad, width: iw, points: s.points, size: 24, color: ink, theme, lh: 1.5 }));
  });
  if (badge) {
    const d = Math.min(96, gap + 32), bx = x + sideW + Math.round((gap - d) / 2), by = y + Math.round(capH / 2 - d / 2);
    elements.push({ type: 'shape', id: `${id}-vs`, bounds: [bx, by, d, d], style: { fill: '#26262B', radius: d / 2 } });
    elements.push(textElement({ id: `${id}-vs-text`, text: badge, bounds: [bx, by + Math.round(d / 2 - 24), d, 48], style: theme.font(36, { fontWeight: 800, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.3 }) }));
  }
  return { elements, height: h };
}

// periods: ['第一季度', …] or [{ label, tone: 'primary'|'secondary' }]; tones alternate by default. bleed: run the
// band from the page's left edge. Returns columns [[x, width], …] under each segment.
export function periodBand({ id, x, y, width, periods, theme, height = 64, bleed = false, arrow = true }) {
  const p = theme.palette, r = colorRoles(p), n = periods.length, aw = arrow ? 44 : 0, colW = (width - aw) / n, elements = [], columns = [];
  const items = periods.map((pd) => (typeof pd === 'string' ? { label: pd } : pd));
  const on = (pd, i) => (pd.tone || (i % 2 ? 'secondary' : 'primary')) === 'primary';
  if (bleed && x > 0) elements.push({ type: 'shape', id: `${id}-lead`, bounds: [0, y, x, height], style: { fill: on(items[0], 0) ? r.primary : r.secondary } });
  items.forEach((pd, i) => {
    const cx = Math.round(x + i * colW), cw = Math.round(colW);
    elements.push({ type: 'shape', id: `${id}-seg-${i + 1}`, ...(i === 0 ? { component: 'periodBand' } : {}), bounds: [cx, y, cw, height], style: { fill: on(pd, i) ? r.primary : r.secondary } });
    elements.push(textElement({ id: `${id}-label-${i + 1}`, text: pd.label, bounds: [cx, y + Math.round((height - 36) / 2), cw, 36], style: theme.font(26, { fontWeight: 700, color: on(pd, i) ? p.inverse : r.onSecondary, textAlign: 'center' }) }));
    columns.push([cx, cw]);
  });
  if (arrow) elements.push({ type: 'vector', id: `${id}-arrow`, bounds: [Math.round(x + width - aw), y - 14, aw, height + 28], viewBox: [0, 0, 44, 92], path: 'M0,0 L44,46 L0,92 Z', style: { fill: on(items[n - 1], n - 1) ? r.primary : r.secondary, stroke: 'none' } });
  return { elements, height, columns };
}

// Period labels as a position on a time axis, in thirds of a month: 8月上旬, 8月中下旬, 9月, 9月全月, 7—9月, 8月上旬—9月中旬, Q3, 三季度.
// Returns [start, end) or null when the label is not a date this can place, so nothing is guessed.
const TEN_DAY = { 上: 0, 中: 1, 下: 2 }, SEPARATOR = '\\s*[—–\\-~～至到]\\s*', QUARTER = { 一: 1, 二: 2, 三: 3, 四: 4 };
export function periodRange(text) {
  const t = String(text ?? '').trim(); let m;
  if ((m = /^(\d{1,2})月([上中下])([中下])?旬$/.exec(t))) return [+m[1] * 3 + TEN_DAY[m[2]], +m[1] * 3 + TEN_DAY[m[3] || m[2]] + 1];
  if ((m = /^(\d{1,2})月(?:全月|份)?$/.exec(t))) return [+m[1] * 3, +m[1] * 3 + 3];
  if ((m = new RegExp(`^(\\d{1,2})月?${SEPARATOR}(\\d{1,2})月(?:份)?$`).exec(t))) return +m[2] >= +m[1] ? [+m[1] * 3, +m[2] * 3 + 3] : null;
  if ((m = new RegExp(`^(\\d{1,2})月([上中下])旬${SEPARATOR}(\\d{1,2})月([上中下])旬$`).exec(t))) { const from = +m[1] * 3 + TEN_DAY[m[2]], to = +m[3] * 3 + TEN_DAY[m[4]] + 1; return to > from ? [from, to] : null; }
  if ((m = /^(?:Q([1-4])|第?([一二三四])季度)$/i.exec(t))) { const q = +m[1] || QUARTER[m[2]]; return [(q * 3 - 2) * 3, (q * 3 + 1) * 3]; }
  return null;
}

// Periods go on a time axis only when the outline names parallel lanes and every label is a date. Null means the equal-width band.
export function periodTimeline(periods = []) {
  if (!periods.some((p) => p.lane)) return null;
  const ranges = periods.map((p) => periodRange(p.span || p.label));
  if (ranges.some((r) => !r)) return null;
  return { ranges, start: Math.floor(Math.min(...ranges.map((r) => r[0])) / 3) * 3, end: Math.ceil(Math.max(...ranges.map((r) => r[1])) / 3) * 3 };
}
