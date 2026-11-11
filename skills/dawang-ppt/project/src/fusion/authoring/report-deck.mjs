import { REPORT_ROLES, REPORT_ROLES_COMFY, REPORT_ROLES_HERO, REPORT_ROLES_LARGE, REPORT_ROLES_ROOMY, actionPanel, createTheme, imageSize, kpiStrip, labelBand, metricTiles, photoGroup, readableInk, textWidth, colorRoles, lighten, pointList, pointsHeight } from './layout-kit.mjs';
import { comparePair, periodBand, periodTimeline } from './report-kit.mjs';
import path from 'node:path';
import { capacityFlow, capacityTable, flowEdgeBindings, measureModule } from './capacity-kit.mjs';
import { reportPalette } from './report-palettes.mjs';
import { figuresIn } from './wording.mjs';

// Whole-deck composer for work reports. The agent decides content and reading order in the outline; this code does the
// geometry, the equal heights, the fit to the page and the region bindings, so a deck comes out the same way whichever
// model wrote it. Pages it cannot express can still be written by hand and added to the deck afterwards.
//
// layouts: { pageId: rows } is optional; each row is 'zone', ['zone', 'zone'] (side by side) or { left: ['zone', …], right: 'photos' }.
// Without one, defaultLayout orders the page by its role.
const L = 96, W = 1728, TOP = 146, BOTTOM = 1010, GAP = 18;
const asList = (v) => (Array.isArray(v) ? v : []);
// The measurer works on one page at a time, so modules in a row are measured one after another.
const inOrder = async (list, fn) => { const out = []; for (const [i, item] of list.entries()) out.push(await fn(item, i)); return out; };
const ROLE_TAG = { summary: '整体结论', results: '成果数据', actions: '关键动作', resources: '资源支持', issues: '问题差距', causes: '原因复盘', cause: '原因复盘', plan: '下一步', asks: '需要支持', duties: '职责定位' };
const VERDICT = /复盘|判断|结论|启示/, CLOSING = /复盘|判断|结论|启示|AI|工具|下一步|建议/;

const TEXT_GROWTH = [1.3, 1.2, 1.1];
// A target as it reads under its figure; the cover shows it too, so one figure reads the same on every page.
const targetText = (d) => `${d.target}${d.unit && !String(d.target).endsWith(d.unit) ? ` ${d.unit}` : ''}`;
const coverItem = ({ label, value, unit, icon, target }) => ({ label, value, unit, ...(icon ? { icon } : {}), ...(target != null ? { note: `目标 ${targetText({ target, unit })}` } : {}) });
// A hugging row of figures is centred only when its tiles are nearly square (width up to 1.5 times the height).
const SQUARE_TILE = 1.5;
// Side by side, a module is drawn as tall as its row only when its own content needs at least this share of the row.
const EQUAL_HEIGHT_SHARE = 0.65;
// The primary column's share of a row of two different modules, tried widest first.
const PRIMARY_SHARES = [0.6, 0.56, 0.53];
// The figure size of the second group of figures on a page, as a share of the first group's.
const SECONDARY_FIGURES = 0.74;
const LANE_MIN_COVERAGE = 0.75, SCALE_UP_BELOW = 0.86, MAX_FILL = 0.98, FILL_TARGET = 0.72, MIN_FILL_GAIN = 0.06, MAX_ALTERNATIVES = 12, LOOSE_BLANK = 0.25;

// Which side of a comparison stands for this period or the way forward (now), and whether one side leads to the other (onward).
// The outline can say so with compare.current: 'left' | 'right'; otherwise the labels do (去年 → 今年, 问题 → 改进, 2025 → 2026).
const EARLIER = /问题|现状|差距|去年|上期|上半年|上月|上季|之前|改进前|调整前|待改进|挑战|风险|H1/i, LATER = /本期|今年|本年|当前|现在|本月|本季|下半年|改进|调整后|之后|对策|解法|措施|目标|计划|下一步|H2/i;
export function compareSides(c) {
  const l = c.leftLabel || '现状', r = c.rightLabel || '改进', year = (t) => +(t.match(/20\d\d/)?.[0] || 0), earlier = (t) => EARLIER.test(t), later = (t) => !earlier(t) && LATER.test(t);
  if (c.current === 'left' || c.current === 'right') return { now: c.current, onward: true };
  if (year(l) && year(r) && year(l) !== year(r)) return { now: year(l) > year(r) ? 'left' : 'right', onward: true };
  if (later(l) && !later(r)) return { now: 'left', onward: true };
  if (earlier(l) || later(r)) return { now: 'right', onward: true };
  return { now: 'left', onward: earlier(r) };
}
// Both sides list the same measures and every value is a figure: [{ label, before, value, unit }] in the order written, or null.
const FIGURE = /^([+\-−≤≥<>约]?\d[\d.,]*)\s*(\D{0,6})$/;
function changeItems(c) {
  const { now, onward } = compareSides(c), from = asList(now === 'left' ? c.right : c.left), to = asList(now === 'left' ? c.left : c.right), items = [];
  if (!onward || c.paired === false || from.length !== to.length || to.length < 2 || to.length > 5) return null;
  for (const [i, after] of to.entries()) {
    const before = from[i], a = FIGURE.exec(String(after.detail || '').trim()), b = FIGURE.exec(String(before.detail || '').trim());
    if (!after.title || after.title !== before.title || !a || !b) return null;
    const unit = a[2].trim(), was = b[2].trim();
    items.push({ label: after.title, before: was && was !== unit ? `${b[1]} ${was}` : b[1], value: a[1], ...(unit ? { unit } : {}) });
  }
  return items;
}

class PageOverflow extends Error {}
const cannotFit = (e) => e instanceof PageOverflow || e instanceof TypeError || /放不下|超出|overflow|too narrow/i.test(e.message);

function pageParts(page, zoneIds) {
  const has = (z) => zoneIds.includes(z), statements = asList(page.statements).map((st, i) => ({ ...st, zone: st.id || `statement-${i + 1}` }));
  const tops = statements.filter((st) => !st.asMetric && !(st.place === 'bottom' || (st.place !== 'top' && CLOSING.test(st.label || '')))).map((st) => st.zone);
  const bottoms = statements.filter((st) => !st.asMetric && !tops.includes(st.zone)).map((st) => st.zone), phrases = statements.filter((st) => st.asMetric).map((st) => st.zone);
  const moduleOrder = page.role === 'summary' ? ['metrics', 'items', 'table'] : ['table', 'items', 'metrics'];
  const tables = zoneIds.filter((z) => /^table-\d+$/.test(z)), core = [...moduleOrder.filter(has), ...tables, ...phrases, ...['compare', 'periods'].filter(has)];
  const flows = zoneIds.filter((z) => /^(flow|chain)-\d+$/.test(z)), order = asList(page.order);
  if (!order.length) return { has, tops, bottoms, core, flows, order };
  // page.order states the reading order: sentences listed before the first module open the page, the others close it.
  const at = (z) => { const i = order.indexOf(z); return i < 0 ? 999 : i; }, byOrder = (a, b) => at(a) - at(b), firstBody = Math.min(...[...core, ...flows].map(at), 999), said = [...tops, ...bottoms];
  const opening = said.filter((z) => (order.includes(z) ? at(z) < firstBody : tops.includes(z))).sort(byOrder), closing = said.filter((z) => !opening.includes(z)).sort(byOrder);
  return { has, tops: opening, bottoms: closing, core: [...core].sort(byOrder), flows: [...flows].sort(byOrder), order };
}

// A lone figure is not given a row of its own: it sits in a tight tile with the sentence next to it following on the same line.
// A row of figures that hugs its content and leaves much of the line free (tightGroup) takes the neighbouring sentence the same way.
function pairSoloFigure(page, rows, tightGroup = false) {
  const data = asList(page.data), solo = data.length === 1 && data[0].target == null && !data[0].note;
  if (!solo && !tightGroup) return rows;
  const sentence = (z) => typeof z === 'string' && asList(page.statements).some((st, i) => (st.id || `statement-${i + 1}`) === z && !st.asMetric);
  // A photo row between them does not break the pair: the sentence belongs with its figure.
  const pairIn = (list) => { const at = list.indexOf('metrics'), step = (d) => (list[at + d] === 'photos' ? at + d * 2 : at + d), other = at < 0 ? undefined : [step(1), step(-1)].find((k) => sentence(list[k])); if (other === undefined) return list; return list.flatMap((z, k) => (k === at ? [['metrics', list[other]]] : k === other ? [] : [z])); };
  return pairIn(rows).map((r) => (r?.left && solo ? { ...r, left: pairIn(r.left) } : r));
}

export function defaultLayout(page, zoneIds) {
  const { has, tops, bottoms, core, flows, order } = pageParts(page, zoneIds), pairs = [];
  if (order.length) {
    // Modules follow the stated order; neighbouring flows share a row, and the non-flow modules sit beside the photos.
    const at = (z) => order.indexOf(z) < 0 ? 999 : order.indexOf(z), seq = [...core, ...flows].sort((a, b) => at(a) - at(b)), isFlow = (z) => flows.includes(z), mid = [];
    for (const z of seq) { const last = mid[mid.length - 1]; if (isFlow(z) && Array.isArray(last) && last.length === 1 && isFlow(last[0])) last.push(z); else mid.push(isFlow(z) ? [z] : z); }
    const flat = mid.map((r) => (Array.isArray(r) && r.length === 1 ? r[0] : r));
    if (has('photos')) { const firstCore = flat.findIndex((r) => core.includes(r)), rows = [...tops, ...flat.slice(0, Math.max(firstCore, 0)).filter(Boolean)], rest = flat.slice(Math.max(firstCore, 0)), beside = rest.filter((r) => core.includes(r)), after = rest.filter((r) => !core.includes(r)); rows.push({ left: beside.length ? beside : after.splice(0, 1).flat(), right: 'photos' }, ...after); if (bottoms.length) rows.push(bottoms.length > 1 ? bottoms : bottoms[0]); return rows; }
    return [...tops, ...flat, ...(bottoms.length ? [bottoms.length > 1 ? bottoms : bottoms[0]] : [])];
  }
  for (let i = 0; i < flows.length; i += 2) pairs.push(flows.length - i > 1 ? [flows[i], flows[i + 1]] : flows[i]);
  const rows = [];
  if (has('photos')) rows.push({ left: [...tops, ...core], right: 'photos' });
  else {
    rows.push(...tops);
    const side = core.includes('items') && core.includes('metrics') && !core.includes('table');
    if (side) rows.push(['items', 'metrics']);
    rows.push(...core.filter((z) => !side || !['items', 'metrics'].includes(z)));
  }
  rows.push(...pairs);
  if (bottoms.length) rows.push(bottoms.length > 1 ? bottoms : bottoms[0]);
  return rows;
}

// Every way to split a list, in order, into rows of one or two.
const splits = (list) => (list.length <= 1 ? [list.length ? [list[0]] : []] : [...splits(list.slice(1)).map((rest) => [list[0], ...rest]), ...splits(list.slice(2)).map((rest) => [[list[0], list[1]], ...rest])]);
const pairCount = (rows) => rows.filter(Array.isArray).length;
const subsets = (list, max) => { let out = [[]]; for (const item of list) out = [...out, ...out.filter((s) => s.length < max).map((s) => [...s, item])]; return out; };

// Other arrangements of the same modules for a page that does not fit its default layout, closest to the default first.
// Reading order is kept; only what sits side by side and what goes beside the photos changes.
export function layoutCandidates(page, zoneIds, limit = 48) {
  const { has, tops, bottoms, core, flows } = pageParts(page, zoneIds), body = [...core, ...flows], closing = bottoms.length ? [bottoms.length > 1 ? bottoms : bottoms[0]] : [], out = [];
  const add = (rows, cost) => out.push({ rows, cost });
  // Opening sentences stay stacked, or the first two or three share a row and any others join the column beside the photos.
  const opening = [{ rows: tops, extra: [], cost: 0 }];
  for (let k = 2; k <= Math.min(3, tops.length); k++) opening.push({ rows: [tops.slice(0, k)], extra: tops.slice(k), cost: 1 });
  for (const top of opening) {
    if (!has('photos')) { for (const rows of splits(body)) add([...top.rows, ...top.extra, ...rows, ...closing], top.cost + pairCount(rows)); continue; }
    for (const beside of subsets(body, 3)) {
      const rest = body.filter((z) => !beside.includes(z)), left = [...top.extra, ...beside];
      for (const rows of splits(rest)) {
        if (left.length) add([...top.rows, { left, right: 'photos' }, ...rows, ...closing], top.cost + pairCount(rows));
        else add([...top.rows, ...rows, 'photos', ...closing], top.cost + pairCount(rows) + 1);
      }
    }
    if (top.cost === 0 && tops.length) for (const beside of subsets(body, 2).filter((s) => s.length)) { const rest = body.filter((z) => !beside.includes(z)); for (const rows of splits(rest)) add([{ left: [...tops, ...beside], right: 'photos' }, ...rows, ...closing], pairCount(rows)); }
  }
  const seen = new Set(), base = JSON.stringify(defaultLayout(page, zoneIds));
  return out.sort((x, y) => x.cost - y.cost).map((c) => c.rows).filter((rows) => { const key = JSON.stringify(rows); if (key === base || seen.has(key)) return false; seen.add(key); return true; }).slice(0, limit);
}

const aspect = (src) => { const s = imageSize(src); return (s.width ?? s.w ?? s[0]) / (s.height ?? s.h ?? s[1]); };

// Portraits take a column each and landscapes stack in one column, so no picture is forced into the wrong shape.
function photoColumns(photos) {
  const cells = photos.map((ph, index) => ({ ...ph, index, r: aspect(ph.src) })), portrait = cells.filter((c) => c.r < 1), land = cells.filter((c) => c.r >= 1);
  return [...portrait.map((c) => [c]), ...(land.length ? [land] : [])];
}
const singleColumns = (photos) => photoColumns(photos).flat().sort((a, b) => a.index - b.index).map((c) => [c]);
const lineElement = ({ id, from: [ax, ay], to: [bx, by], style }) => { const left = Math.min(ax, bx), top = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay); return { type: 'line', id, bounds: [left, top, w || 1, h || 1], x1: ax - left, y1: ay - top, x2: bx - left, y2: by - top, style }; };
const CAP = 34, PHOTO_GAP = 20;
const naturalPhotoWidth = (cols, H) => cols.reduce((w, col) => w + ((H - col.length * CAP - (col.length - 1) * PHOTO_GAP) / col.length) * (col.reduce((a, c) => a + c.r, 0) / col.length), 0) + (cols.length - 1) * 24;

// The height at which a photo group exactly fills the given width.
const naturalPhotoHeight = (cols, width) => { let lo = 80, hi = 834; for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (naturalPhotoWidth(cols, mid) > width) hi = mid; else lo = mid; } return Math.round(lo); };

function pageWriter({ page, zones, theme, measurer }) {
  const pid = page.id, p = theme.palette, readableTheme = { ...theme, palette: { ...p, accent: readableInk(readableInk(p.accent, '#FFFFFF'), p.highlightBg || '#F7F0E3') } }, solidFill = readableInk(colorRoles(p).primary, '#FFFFFF'), solidTheme = { ...theme, palette: { ...p, primary: solidFill } }, roles = theme.roles, body = roles.body.fontSize, label = roles.stepTitle.fontSize, metricSize = body >= 30 ? 88 : body >= 26 ? 64 : body >= 24 ? 56 : body >= 22 ? 46 : 40, typography = (title = label) => ({ title: Math.max(title, body), body });
  const statement = (z) => asList(page.statements).find((st, i) => (st.id || `statement-${i + 1}`) === z);
  const panel = (id, bounds, white) => ({ id, type: 'shape', bounds, style: white ? { fill: '#FFFFFF', stroke: p.line, strokeWidth: 1.5, radius: theme.radius } : { fill: p.pale, radius: theme.radius } });
  const text = (id, t, bounds, style) => ({ id, type: 'text', text: t, bounds, style });
  // A module heading is one line of the section-title size; its box follows that size, so larger type scales do not spill out of it.
  const headBox = Math.max(40, Math.ceil(roles.sectionTitle.fontSize * 1.3) + 2);
  async function measured(builder, spec) {
    const first = builder(spec), texts = first.elements.filter((e) => e.type === 'text' && e.text);
    const results = await measurer.texts(texts);
    return builder({ ...spec, measurements: new Map(results.map((m) => [m.id, m])) });
  }
  // A tile is only emphasised for a reason: the outline marks it, or the title names it.
  const metricFocus = (items) => {
    const marked = items.findIndex((d) => d.highlight); if (marked >= 0) return marked;
    const title = page.keyLine.text.replace(/\s/g, '');
    return items.findIndex((d) => title.includes(`${d.value}${d.unit || ''}`.replace(/\s/g, '')) || (String(d.label || '').length >= 2 && title.includes(d.label)));
  };
  // The title has to stay among the two largest sizes on a page, so figures only grow when one group of tiles is on it.
  const tileGroups = (asList(page.data).length ? 1 : 0) + asList(page.statements).filter((st) => st.asMetric).length + (page.compare && changeItems(page.compare) ? 1 : 0);
  const tiles = (id, x, y, w, items, h, stretch = 0, highlight = 0, { size = metricSize, grow = tileGroups === 1 } = {}) => {
    const cols = items.length <= 5 && w >= 240 * items.length ? items.length : items.length > 6 ? 4 : items.length % 3 === 0 || items.length === 5 ? 3 : 2;
    const columns = Math.min(cols, items.length), common = { id, x: x + 16, width: w - 32, size, columns, gap: 12, highlight, highlightStyle: items.length > 1 ? 'solid' : 'bar', fill: '#FFFFFF', theme: solidTheme, items, growValue: grow, iconCap: 96 };
    const probe = metricTiles({ ...common, y: 0 }), rows = Math.ceil(items.length / columns), natural = probe.height + 32, height = Math.max(natural + stretch, h || 0);
    const real = metricTiles({ ...common, y: y + 16, tileHeight: (height - 32 - (rows - 1) * 12) / rows });
    return { natural, height, elements: real.elements, valueSize: real.valueSize };
  };
  // A row of figures hugs its content. The figure first grows until the fullest tile is filled at an equal split of the
  // line; when even the largest size leaves a wide empty strip, the tiles narrow to their content and the row stops short
  // of the line. Icons are shown only when the outline names one for every figure, so a group never mixes tiles with and without.
  // Two groups of figures on one page (results and a before → after row) are not equals either: the group holding a
  // figure the title states keeps the full figure size; the other steps down clearly, so the reader sees which row
  // answers the title. Without a hint the results row leads.
  const figureGroups = [...(asList(page.data).length > 1 ? ['metrics'] : []), ...(page.compare && changeItems(page.compare) ? ['compare'] : [])];
  const secondaryGroup = (() => {
    if (figureGroups.length < 2) return null;
    const said = new Set(figuresIn(page.keyLine.text).map((f) => f.value)), plain = (v) => figuresIn(String(v ?? ''))[0]?.value;
    const hits = { metrics: asList(page.data).some((d) => said.has(plain(d.value))), compare: changeItems(page.compare).some((it) => said.has(plain(it.value)) || said.has(plain(it.before))) };
    return hits.compare && !hits.metrics ? 'metrics' : 'compare';
  })();
  // The lead group's figure size once measured (it can step down to fit), so the second group stays clearly below it.
  const settled = new Map(), primaryGroup = secondaryGroup && figureGroups.find((g) => g !== secondaryGroup);
  const settleFigures = async (zone, common) => {
    const lead = zone === secondaryGroup && settled.get(metricSize);
    if (lead) common.figureSize = Math.min(common.figureSize, Math.max(24, Math.round(lead * SECONDARY_FIGURES / 2) * 2));
    common.figureSize = await measuredSize(common);
    if (zone === primaryGroup) settled.set(metricSize, common.figureSize);
  };
  const baseSize = (zone) => (zone === secondaryGroup ? Math.max(28, Math.round(metricSize * SECONDARY_FIGURES / 2) * 2) : metricSize);
  const figureRow = (items, w, { grow = tileGroups === 1, base = metricSize } = {}) => {
    const n = items.length, gap = 12, even = Math.floor((w - 32 - gap * (n - 1)) / n), icons = items.every((it) => it.icon), iconW = icons ? 64 + 16 : 0;
    // Labels keep their size; only the figure grows, so a long label cannot make a small figure count as a full tile.
    const ls = Math.max(20, Math.round(metricSize * 0.3)), labels = Math.max(...items.map((it) => Math.max(textWidth(it.label || '', ls), textWidth(it.note || '', ls)))) + iconW;
    const figure = (s) => Math.max(...items.map((it) => (it.before != null ? textWidth(`${it.before} → `, Math.max(20, Math.round(s * 0.6))) : 0) + textWidth(String(it.value), s) + (it.unit ? textWidth(' ' + it.unit, Math.max(20, Math.round(s * 0.32))) : 0))) + iconW, content = (s) => Math.max(labels, figure(s));
    if (n < 2 || n > 5 || even < Math.min(240, content(base) + 72)) return null;
    const room = even - 56, largest = grow ? Math.min(120, Math.round(base * 0.75) * 2) : base;
    const spare = Math.max(160, even * 0.26);
    let size = base; while (size + 2 <= largest && even - 28 - figure(size) >= spare && figure(size + 2) <= room) size += 2;
    if (even - 28 - content(size) < spare) return { size, width: w, icons };
    return { size: base, width: Math.min(w, n * (Math.ceil(content(base)) + 72) + gap * (n - 1) + 32), icons, tight: true };
  };
  // Widths above are estimates. The figure size is settled by measuring the real text: it steps down until no label or figure wraps in its tile.
  const measuredSize = async (common) => {
    for (let size = common.figureSize; ; size -= 2) {
      const texts = metricTiles({ ...common, figureSize: size, y: 0 }).elements.filter((e) => e.type === 'text' && e.text), real = await measurer.texts(texts.map((e) => ({ ...e, bounds: [0, 0, 3000, e.bounds[3]] })));
      if (size <= 24 || texts.every((e, i) => real[i].naturalWidth <= e.bounds[2])) return size;
    }
  };
  const figureItems = () => { const goals = page.data.filter((d) => d.target != null).length; return goals === 1 ? null : page.data.map((d) => tileItem(d, goals > 1)); };
  // The width a row of figures takes when it hugs its content, or null when it fills the line.
  // An anchored strip spans its line, or stands upright beside another module: it is not narrowed to its content, and
  // it is not turned into a hero row.
  const stripped = () => page.figureForm === 'strip' && tileGroups === 1 && !asList(page.data).some((d) => d.target != null);
  const tightFiguresWidth = (limit) => { if (stripped()) return null; const items = asList(page.data).length > 1 && figureItems(), fit = items && figureRow(items, limit, { base: baseSize('metrics') }); return fit?.tight ? fit.width : null; };
  // A comparison of figures as a row of change tiles under one heading, or null when the two sides are not the same measures.
  const changeRow = (limit) => {
    const items = page.compare && changeItems(page.compare); if (!items) return null;
    const c = page.compare, l = c.leftLabel || '现状', r = c.rightLabel || '改进', heading = compareSides(c).now === 'left' ? `${r} → ${l}` : `${l} → ${r}`, first = figureRow(items, limit, { base: baseSize('compare') }); if (!first) return null;
    const width = Math.min(limit, Math.max(first.width, Math.ceil(textWidth(heading, roles.sectionTitle.fontSize)) + 72)), fit = width === first.width ? first : figureRow(items, width, { base: baseSize('compare') }) || first;
    return { items, fit, width, heading };
  };
  // The width a zone takes when it hugs its content, or null when it fills the line.
  const tightWidth = (zone, limit) => { if (zone === 'metrics') return tightFiguresWidth(limit); const change = zone === 'compare' ? changeRow(limit) : null; return change && change.width < limit ? change.width : null; };
  const tileItem = (d, showTarget) => ({ label: d.label, value: d.value, unit: d.unit, ...(d.icon ? { icon: d.icon } : {}), ...(showTarget && d.target != null ? { note: `目标 ${targetText(d)}` } : {}) });
  // Sizes that grow with the room are declared with the region, so the type-scale check knows they are intended.
  const sizesOf = (elements, ids) => [...new Set(elements.filter((e) => ids.includes(e.id)).flatMap((e) => [e.style?.fontSize, ...(e.runs || []).map((run) => run.style?.fontSize)]).filter(Number.isFinite))];
  // A box may only get bigger if what is inside it gets bigger too: try larger type, and if none fits keep the box at its natural height.
  const evenSize = (n) => Math.min(38, Math.round(n / 2) * 2);
  const grownToFill = async (build, natural, room, scales = TEXT_GROWTH) => {
    if (room <= natural.height) return natural;
    for (const scale of scales) { const t = await build(scale); if (t.height <= room) return { ...t, scale }; }
    return natural;
  };
  // Parallel or overlapping periods on a shared time axis: one row per lane, bars placed and sized by their dates, each bar's words under it.
  const periodLanes = async ({ x, y, w, h, heading, pds, timeline }) => {
    const headH = heading ? 20 + headBox : 16, axisH = 40, names = [...new Set(pds.map((pd) => pd.lane || ''))], laneW = names.some(Boolean) ? 176 : 0, axisX = x + 24 + laneW, axisW = w - 48 - laneW, r = colorRoles(p);
    const at = (t) => Math.round(axisX + (t - timeline.start) * axisW / (timeline.end - timeline.start)), barH = 48, wordsW = 300;
    const lay = async (scale) => {
      const titleStyle = theme.roleStyle('stepTitle', { color: p.ink, lineHeight: 1.35, fontSize: evenSize(label * scale) }), pointSize = evenSize(body * scale), lanes = [];
      for (const name of names) {
        const rows = [], items = pds.flatMap((pd, i) => ((pd.lane || '') === name ? [{ i, pd, x: at(timeline.ranges[i][0]), barW: at(timeline.ranges[i][1]) - at(timeline.ranges[i][0]) - 6 }] : [])).sort((a, b) => a.x - b.x || a.i - b.i);
        for (const item of items) { let row = rows.find((c) => c.reach <= item.x); if (!row) { row = { items: [], reach: 0 }; rows.push(row); } row.items.push(item); row.reach = item.x + Math.max(item.barW, wordsW); }
        for (const row of rows) {
          row.items.forEach((item, k) => { item.textW = (row.items[k + 1]?.x ?? axisX + axisW) - item.x - 20; });
          const titles = row.items.flatMap((item) => (item.pd.title ? [item.title = { id: `pd-title-${item.i + 1}`, type: 'text', text: item.pd.title, bounds: [item.x, 0, item.textW, 40], style: titleStyle }] : [])), sizes = titles.length ? await measurer.texts(titles) : [];
          titles.forEach((e, k) => { e.bounds[3] = Math.ceil(sizes[k].height); });
          row.height = barH + 8 + Math.max(...row.items.map((item) => (item.title ? item.title.bounds[3] + 6 : 0) + pointsHeight(asList(item.pd.points), pointSize, item.textW, 1.45)));
        }
        lanes.push({ name, rows, height: rows.reduce((a, c) => a + c.height, 0) + (rows.length - 1) * 14 + 28 });
      }
      return { lanes, pointSize, height: headH + axisH + lanes.reduce((a, c) => a + c.height, 0) + 12 };
    };
    const naturalLay = await lay(1), covered = naturalLay.lanes.flatMap((lane) => lane.rows.flatMap((row) => row.items.map((item) => Math.max(item.barW, Math.min(item.textW, Math.max(item.pd.title ? textWidth(item.pd.title, label) : 0, ...asList(item.pd.points).map((t) => textWidth(t, body)))))))).reduce((a, b) => a + b, 0), rowCount = naturalLay.lanes.reduce((a, lane) => a + lane.rows.length, 0);
    // Separating the lanes must not cost more than it shows: if bars and words leave much of each row empty, the equal-width band reads better.
    if (covered / (rowCount * axisW) < LANE_MIN_COVERAGE) return null;
    const { lanes, pointSize, height: natural } = await grownToFill(lay, naturalLay, h || 0), height = Math.max(natural, h || 0), elements = [panel('periods-panel', [x, y, w, height])];
    if (heading) elements.push(text('periods-head', heading, [x + 24, y + 12, w - 48, headBox], theme.roleStyle('sectionTitle', { color: readableInk(p.accent, p.pale), lineHeight: 1.3 })));
    const axisY = y + headH;
    for (let m = timeline.start / 3, n = 1; m < timeline.end / 3; m++, n++) elements.push({ type: 'shape', id: `pd-axis-${n}`, bounds: [at(m * 3), axisY, at(m * 3 + 3) - at(m * 3) - 2, axisH - 8], style: { fill: r.soft } }, text(`pd-axis-label-${n}`, `${m}月`, [at(m * 3) + 12, axisY + 3, 120, 26], theme.font(20, { fontWeight: 700, color: readableInk(p.muted, r.soft), lineHeight: 1.3 })));
    let laneY = axisY + axisH + 6;
    lanes.forEach((lane, l) => {
      const fill = l % 2 ? lighten(r.secondary, 0.1) : solidFill, ink = l % 2 ? readableInk(p.ink, fill) : p.inverse;
      if (l) elements.push({ type: 'shape', id: `pd-lane-rule-${l}`, bounds: [x + 24, laneY - 8, w - 48, 1], style: { fill: p.line } });
      if (lane.name) elements.push(text(`pd-lane-${l + 1}`, lane.name, [x + 24, laneY + 8, laneW - 20, 80], theme.roleStyle('sectionTitle', { color: readableInk(p.accent, p.pale), lineHeight: 1.3 })));
      let rowY = laneY + 8;
      for (const row of lane.rows) {
        for (const item of row.items) {
          elements.push({ type: 'shape', id: `pd-seg-${item.i + 1}`, ...(item.i === 0 ? { component: 'periodBand' } : {}), bounds: [item.x, rowY, item.barW, barH], style: { fill } }, text(`pd-label-${item.i + 1}`, item.pd.label, [item.x, rowY + 9, item.barW, 30], theme.font(22, { fontWeight: 700, color: ink, textAlign: 'center', lineHeight: 1.3 })));
          let ty = rowY + barH + 8;
          if (item.title) { item.title.bounds[1] = ty; elements.push(item.title); ty += item.title.bounds[3] + 6; }
          elements.push(...pointList({ id: `pd-point-${item.i + 1}`, x: item.x, y: ty, width: item.textW, points: asList(item.pd.points), size: pointSize, color: p.ink, theme, lh: 1.45 }));
        }
        rowY += row.height + 14;
      }
      laneY += lane.height;
    });
    const ids = pds.map((pd, i) => [`pd-label-${i + 1}`, ...(pd.title ? [`pd-title-${i + 1}`] : []), ...asList(pd.points).map((_, k) => `pd-point-${i + 1}-${k + 1}`)]);
    return { height, elements, frame: 'periods-panel', module: 'periodBand', variant: `${pds.length}-periods-lanes`, title: roles.sectionTitle.fontSize, sizes: sizesOf(elements, ids.flat()), reason: '并行或重叠的阶段按真实时间排列', bindings: [...pds.map((_, i) => ({ ref: `${pid}:period-${i + 1}`, elementIds: ids[i] })), ...pds.slice(1).map((_, i) => ({ ref: `${pid}:periods`, edgeId: `e${i + 1}`, elementIds: [`pd-seg-${i + 1}`, `pd-seg-${i + 2}`] }))] };
  };
  // Steps are cards whenever each has the width for one, so a short line of text is never left bare in a wide panel. room is set only in a row of equal heights.
  const flowCards = async ({ fid, x, y, w, steps, room }) => {
    const n = steps.length, gap = 44, cardW = Math.floor((w - gap * (n - 1)) / n), pad = 24, badge = 44, ink = readableInk(p.accent, '#FFFFFF');
    if (cardW < 240) return null;
    for (const scale of room ? [...TEXT_GROWTH, 1] : [1]) {
      const titleStyle = theme.roleStyle('stepTitle', { color: p.ink, lineHeight: 1.3, fontSize: evenSize(label * scale) }), detailStyle = theme.roleStyle('stepDetail', { color: p.body || p.muted, lineHeight: 1.45, fontSize: evenSize(body * scale) });
      const titles = steps.map((s, i) => text(`${fid}-title-${s.id}`, s.title, [0, 0, cardW - pad * 2 - badge - 14, 40], titleStyle)), details = steps.map((s) => (s.detail ? text(`${fid}-detail-${s.id}`, s.detail, [0, 0, cardW - pad * 2, 40], detailStyle) : null)), measuredAll = [...titles, ...details.filter(Boolean)], sizes = await measurer.texts(measuredAll);
      measuredAll.forEach((e, i) => { e.bounds[3] = Math.ceil(sizes[i].height); });
      const head = Math.max(badge, ...titles.map((e) => e.bounds[3])), detailH = Math.max(0, ...details.filter(Boolean).map((e) => e.bounds[3])), need = pad * 2 + head + (detailH ? 12 + detailH : 0);
      if (room && need > room) continue;
      const cardH = room || need, top = y + pad + Math.round((cardH - need) / 2), elements = [];
      steps.forEach((s, i) => {
        const cx = x + i * (cardW + gap), title = titles[i], detail = details[i];
        Object.assign(title, { bounds: [cx + pad + badge + 14, top + Math.round((head - title.bounds[3]) / 2), title.bounds[2], title.bounds[3]] });
        elements.push({ type: 'shape', id: `${fid}-card-${s.id}`, bounds: [cx, y, cardW, cardH], style: { fill: '#FFFFFF', radius: theme.radius ?? 0 } }, { type: 'shape', id: `${fid}-node-${s.id}`, bounds: [cx + pad, top + Math.round((head - badge) / 2), badge, badge], style: { fill: ink, radius: badge / 2 } }, text(`${fid}-num-${s.id}`, String(i + 1).padStart(2, '0'), [cx + pad, top + Math.round((head - badge) / 2) + 8, badge, 28], theme.font(20, { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.4 })), title);
        if (detail) { detail.bounds[0] = cx + pad; detail.bounds[1] = top + head + 12; elements.push(detail); }
        if (i < n - 1) elements.push({ type: 'vector', id: `${fid}-link-${s.id}-${steps[i + 1].id}`, bounds: [cx + cardW + 10, y + Math.round(cardH / 2) - 20, 24, 40], viewBox: [0, 0, 28, 48], path: 'M4,4 L24,24 L4,44', style: { fill: 'none', stroke: ink, strokeWidth: 5 } });
      });
      return { elements, cardH, bindings: steps.map((s, i) => ({ ref: s.ref, elementIds: [titles[i].id, ...(details[i] ? [details[i].id] : [])] })) };
    }
    return null;
  };
  // Every renderer takes a box and returns { height, elements, cap (how much taller it may grow), and its region design }.
  // A row of figures alone on its line that would hug its content as wide tiles and leave much of the line empty: the
  // tiles become one long strip across the line. The figure that matters most (marked, or the one the title names,
  // else the first) gets the widest tile and a larger figure; the others share the rest at their own size
  // (user decisions 2026-11-10 and 2026-11-11: a square block with tiles stacked beside it looked wrong).
  const heroFor = (zone, limit) => {
    if (zone !== 'metrics' || tileGroups !== 1 || asList(page.data).length < 2 || stripped()) return false;
    const items = figureItems(), fit = items && figureRow(items, limit, { base: baseSize('metrics') }); if (!fit?.tight) return false;
    const probe = metricTiles({ id: 'm', x: 0, y: 0, width: fit.width - 32, size: metricSize, figureSize: fit.size, columns: items.length, gap: 12, items, theme: solidTheme, iconCap: 0 }).elements.find((e) => e.id === 'm-tile-1').bounds;
    return probe[2] / probe[3] > SQUARE_TILE;
  };
  // The anchored strip (template data pages 10, 15, 45, 47, 54): the figure that matters most sits in a solid block at the
  // left, the others share a light band divided by thin rules, with no box around each. It is the second form of a
  // figure group, chosen by the deck so that two figure pages in a row do not look alike (user decision 2026-11-11).
  // Every figure takes one size, so the page title keeps its place among the two largest sizes.
  const stripRow = async (fit, x, y, w, h) => {
    const n = page.data.length, focus = metricFocus(page.data), k = focus >= 0 ? focus : 0, others = page.data.map((_, i) => i).filter((i) => i !== k);
    const ls = Math.max(20, Math.round(metricSize * 0.3)), unitOf = (sz) => Math.max(20, Math.round(sz * 0.32)), item = (d) => ({ label: d.label || '', value: String(d.value), unit: d.unit });
    const valueAt = (d, sz) => textWidth(String(d.value), sz) + (d.unit ? textWidth(' ' + d.unit, unitOf(sz)) : 0), labelW = (d) => textWidth(d.label || '', ls);
    // A long label takes a second line instead of pushing the strip back to tiles (template page 15 wraps its labels too).
    const inner = w - 32, layoutAt = (sz) => { const aw = Math.max(Math.round(inner * 0.24), Math.ceil(valueAt(page.data[k], sz)) + 72); return { aw, colW: (inner - aw) / others.length }; };
    const fits = (sz) => { const { aw, colW } = layoutAt(sz); return valueAt(page.data[k], sz) <= aw - 48 && labelW(page.data[k]) <= (aw - 48) * 1.85 && others.every((i) => valueAt(page.data[i], sz) <= colW - 48 && labelW(page.data[i]) <= (colW - 48) * 1.85); };
    // The figures grow until a column is full (a wide band with small figures wastes it, as tiles would), up to about 2.2× the base size (120px at most).
    let size = fit?.size ?? metricSize; while (size > 32 && !fits(size)) size -= 2;
    if (!fits(size)) return null;
    const cap = Math.min(120, Math.round(metricSize * 2.2)); while (size + 2 <= cap && fits(size + 2)) size += 2;
    const { aw, colW } = layoutAt(size), lineH = Math.round(ls * 1.4);
    // How many lines each label really takes, measured: one long label gives every label a two-line slot, and the
    // one-line labels sit at the bottom of it, so every figure starts on the same line right under its label.
    const probes = page.data.map((d, i) => ({ id: `probe-${i}`, type: 'text', text: d.label || ' ', bounds: [0, 0, Math.floor((i === k ? aw : colW) - 24), 80], style: theme.font(ls, { textAlign: 'center' }), lastLine: true }));
    const lines = (await measurer.texts(probes)).map((m) => m.lines || 1);
    if (lines.some((l) => l > 2)) return null;
    const labelLines = Math.max(...lines), valueH = Math.round(size * 1.25), natural = lineH * labelLines + 6 + valueH + 56 + 32, height = Math.max(natural, h || 0);
    const made = kpiStrip({ id: 'm', x: x + 16, y: y + 16, width: inner, height: height - 32, anchor: item(page.data[k]), anchorWidth: aw, items: others.map((i) => item(page.data[i])), size, anchorSize: size, labelSize: ls, labelLines, labelPosition: 'above', theme: solidTheme });
    // Element ids follow the data order, as the tiles' do: m-value-3 is the third figure wherever it sits.
    const rename = (id) => id === 'm-anchor-value' ? `m-value-${k + 1}` : id === 'm-anchor-label' ? `m-label-${k + 1}` : id.replace(/^m-(value|label)-(\d+)$/, (_, kind, j) => `m-${kind}-${others[Number(j) - 1] + 1}`);
    const elements = made.elements.filter((e) => e.id !== 'm-band').map((e) => ({ ...e, id: rename(e.id) })).map((e) => {
      const at = /^m-label-(\d+)$/.exec(e.id); if (!at || labelLines === 1) return e;
      const i = Number(at[1]) - 1, spare = (labelLines - lines[i]) * lineH;
      return spare ? { ...e, bounds: [e.bounds[0], e.bounds[1] + spare, e.bounds[2], e.bounds[3] - spare] } : e;
    });
    const bindings = page.data.map((d, i) => ({ ref: `${pid}:data-${i + 1}`, elementIds: [`m-value-${i + 1}`] }));
    return { height, width: w, elements: [panel('metrics-panel', [x, y, w, height]), ...elements], frame: 'metrics-panel', module: 'kpiStrip', variant: `${n}-strip`, title: size, sizes: sizesOf(elements, bindings.flatMap((b) => b.elementIds)), reason: '重点数字放进左侧实心块，其余在浅色带上并排，和相邻页的色块错开', bindings };
  };
  // The strip turned upright, for a figure group that shares its row with another module (template page 45's side
  // column): the figure that matters most in a solid block on top, the others as rows below with the label at the left
  // and the figure at the right, divided by thin rules. One figure size, as in the strip. A taller row spreads the rows.
  const stripColumn = async (fit, x, y, w, h) => {
    const n = page.data.length, focus = metricFocus(page.data), k = focus >= 0 ? focus : 0, others = page.data.map((_, i) => i).filter((i) => i !== k);
    const ls = Math.max(20, Math.round(metricSize * 0.3)), unitOf = (sz) => Math.max(20, Math.round(sz * 0.32)), lineH = Math.round(ls * 1.4), inner = w - 32, pad = 24;
    const valueAt = (d, sz) => textWidth(String(d.value), sz) + (d.unit ? textWidth(' ' + d.unit, unitOf(sz)) : 0);
    // A row holds its label and figure side by side; the label keeps at least 40% of the row.
    const fits = (sz) => valueAt(page.data[k], sz) <= inner - pad * 2 && others.every((i) => valueAt(page.data[i], sz) <= (inner - pad * 2) * 0.6);
    let size = Math.min(fit?.size ?? metricSize, metricSize); while (size > 32 && !fits(size)) size -= 2;
    if (!fits(size)) return null;
    const valueH = Math.round(size * 1.25), valueRun = (d, color, align) => ({ type: 'text', text: `${d.value}${d.unit ? ' ' + d.unit : ''}`, runs: [{ text: String(d.value), style: { fontSize: size, fontWeight: 700, color } }, ...(d.unit ? [{ text: ' ' + d.unit, style: { fontSize: unitOf(size), fontWeight: 700, color } }] : [])], style: theme.font(size, { fontWeight: 700, color, textAlign: align, lineHeight: 1.15 }) });
    // Figure widths are measured, not estimated: a right-aligned figure box has to hold its figure exactly.
    const real = await measurer.texts(page.data.map((d, i) => ({ ...valueRun(d, p.ink, 'left'), id: `fig-${i}`, bounds: [0, 0, 3000, valueH] }))), figW = (i) => Math.ceil(real[i].naturalWidth) + 8;
    if (others.some((i) => figW(i) > (inner - pad * 2) * 0.6) || figW(k) > inner - pad * 2) return null;
    const labelRoom = (i) => (i === k ? inner - pad * 2 : Math.floor((inner - pad * 2) - figW(i) - 24));
    const probes = page.data.map((d, i) => ({ id: `probe-${i}`, type: 'text', text: d.label || ' ', bounds: [0, 0, labelRoom(i), 80], style: theme.font(ls), lastLine: true }));
    const lines = (await measurer.texts(probes)).map((m) => m.lines || 1);
    if (lines.some((l) => l > 2)) return null;
    const anchorH = pad * 2 + lines[k] * lineH + 6 + valueH, rowNatural = (i) => Math.max(lines[i] * lineH, valueH) + 28;
    const natural = 32 + anchorH + others.reduce((t, i) => t + rowNatural(i), 0), height = Math.max(natural, h || 0), extra = Math.floor((height - natural) / Math.max(1, others.length));
    const r = colorRoles(solidTheme.palette), elements = [], ax = x + 16, ay = y + 16;
    elements.push({ type: 'shape', id: 'm-anchor', bounds: [ax, ay, inner, anchorH], style: { fill: r.primary } });
    elements.push(text(`m-label-${k + 1}`, page.data[k].label || '', [ax + pad, ay + pad, inner - pad * 2, lines[k] * lineH], theme.font(ls, { color: p.inverse })));
    elements.push({ ...valueRun(page.data[k], p.inverse, 'left'), id: `m-value-${k + 1}`, bounds: [ax + pad, ay + pad + lines[k] * lineH + 6, inner - pad * 2, valueH] });
    let ry = ay + anchorH;
    others.forEach((i, j) => {
      const rh = rowNatural(i) + extra, vw = figW(i), lh = lines[i] * lineH;
      if (j > 0) elements.push({ type: 'shape', id: `m-rule-${j}`, bounds: [ax + pad, ry, inner - pad * 2, 2], style: { fill: p.line } });
      elements.push(text(`m-label-${i + 1}`, page.data[i].label || '', [ax + pad, ry + Math.round((rh - lh) / 2), labelRoom(i), lh], theme.font(ls, { color: p.muted })));
      elements.push({ ...valueRun(page.data[i], r.primary, 'right'), id: `m-value-${i + 1}`, bounds: [ax + inner - pad - vw, ry + Math.round((rh - valueH) / 2), vw, valueH] });
      ry += rh;
    });
    const bindings = page.data.map((d, i) => ({ ref: `${pid}:data-${i + 1}`, elementIds: [`m-value-${i + 1}`] }));
    return { height, width: w, elements: [panel('metrics-panel', [x, y, w, height]), ...elements], frame: 'metrics-panel', module: 'kpiStrip', variant: `${n}-strip-column`, title: size, sizes: sizesOf(elements, bindings.flatMap((b) => b.elementIds)), reason: '和其他模块并排时，重点数字在上方实心块，其余逐行列出，和相邻页的色块错开', bindings };
  };
  // Parallel items as equal-width cards (template pages 121, 138, 161): each card has a colour cap, a large number, its
  // title and its detail. The second form of an item list, chosen by the deck so that two item pages in a row do not
  // look alike (user decision 2026-11-11). Cards are peers, so they share one width and one height (HS-02).
  const itemCards = async (items, x, y, w, h) => {
    const n = items.length, gap = 16, pad = 24, inner = w - 32, cardW = Math.floor((inner - gap * (n - 1)) / n), textW = cardW - pad * 2;
    const heading = page.itemsHeading, headStyle = theme.roleStyle('sectionTitle', { color: readableInk(p.accent, '#FFFFFF'), lineHeight: 1.3 });
    const numSize = Math.round(roles.stepTitle.fontSize * 1.6 / 2) * 2, numStyle = theme.font(numSize, { fontWeight: 700, color: readableInk(p.accent, '#FFFFFF'), lineHeight: 1.1 });
    const titleStyle = theme.roleStyle('stepTitle', { color: p.ink, lineHeight: 1.32 }), detailStyle = theme.roleStyle('stepDetail', { color: p.body || p.ink, lineHeight: 1.45 });
    const probes = items.flatMap((it, i) => [text(`t${i}`, it.title, [0, 0, textW, 40], titleStyle), ...(it.detail ? [text(`d${i}`, it.detail, [0, 0, textW, 40], detailStyle)] : [])]);
    const sized = new Map((await measurer.texts(probes)).map((m) => [m.id, Math.ceil(m.height)]));
    // A title over two lines means the cards are too narrow for these items: the list keeps them readable.
    if (items.some((_, i) => sized.get(`t${i}`) > Math.ceil(titleStyle.fontSize * titleStyle.lineHeight * 2) + 2)) return null;
    const numH = Math.ceil(numSize * 1.1), titleH = Math.max(...items.map((_, i) => sized.get(`t${i}`))), body = (i) => (items[i].detail ? sized.get(`d${i}`) : 0);
    const headH = heading ? headBox + 12 : 0, cardNatural = 6 + pad + numH + 10 + titleH + (items.some((it) => it.detail) ? 10 + Math.max(...items.map((_, i) => body(i))) : 0) + pad;
    const natural = 16 + headH + cardNatural + 16, height = Math.max(natural, h || 0), cardH = height - 32 - headH, cardY = y + 16 + headH, r = colorRoles(p), elements = [];
    if (heading) elements.push(text('acts-heading', heading, [x + 24, y + 16, inner - 16, headBox], headStyle));
    items.forEach((it, i) => {
      const cx = x + 16 + i * (cardW + gap), m = i + 1;
      elements.push({ type: 'shape', id: `acts-card-${m}`, bounds: [cx, cardY, cardW, cardH], style: { fill: '#FFFFFF' } });
      elements.push({ type: 'shape', id: `acts-cap-${m}`, bounds: [cx, cardY, cardW, 6], style: { fill: i % 2 ? r.secondary : r.primary } });
      elements.push(text(`acts-num-${m}`, String(m).padStart(2, '0'), [cx + pad, cardY + 6 + pad, textW, numH], numStyle));
      elements.push(text(`acts-title-${m}`, it.title, [cx + pad, cardY + 6 + pad + numH + 10, textW, titleH], titleStyle));
      if (it.detail) elements.push(text(`acts-detail-${m}`, it.detail, [cx + pad, cardY + 6 + pad + numH + 10 + titleH + 10, textW, body(i)], detailStyle));
    });
    const ids = items.flatMap((it, i) => [`acts-title-${i + 1}`, ...(it.detail ? [`acts-detail-${i + 1}`] : [])]);
    return { height, elements: [panel('acts-panel', [x, y, w, height]), ...elements], frame: 'acts-panel', module: 'actionCards', variant: `${n}-cards`, title: roles.sectionTitle.fontSize, sizes: sizesOf(elements, ids), reason: '并列事项排成等宽卡片，和相邻页的列表错开', bindings: items.map((it, i) => ({ ref: `${pid}:item-${i + 1}`, elementIds: [`acts-title-${i + 1}`, ...(it.detail ? [`acts-detail-${i + 1}`] : [])] })) };
  };
  const heroRow = async (items, fit, x, y, w, h) => {
    const n = items.length, gap = 12, inner = w - 32, focus = metricFocus(page.data), k = focus >= 0 ? focus : 0, ls = Math.max(20, Math.round(metricSize * 0.3)), unitOf = (s) => Math.max(20, Math.round(s * 0.32));
    const contentAt = (it, s) => Math.max(textWidth(it.label || '', ls), textWidth(it.note || '', ls), textWidth(String(it.value), s) + (it.unit ? textWidth(' ' + it.unit, unitOf(s)) : 0));
    // Every figure in the strip takes one size (user decision 2026-11-11: a large tile with small figures in it wastes the
    // tile). One size also keeps the page title among the two largest sizes. The leading tile stands out by its fill and width.
    const others = items.map((_, i) => i).filter((i) => i !== k), share = Math.floor((inner - gap * (n - 1)) / (n + 1));
    // The large tile counts as two shares of the line. A small tile has no icon, so it stays within its content plus a
    // little room (no wide empty strip) and never goes below its content; the large tile takes what is left.
    const widths = (s) => { const content = Math.ceil(Math.max(...others.map((i) => contentAt(items[i], s)))), otherW = Math.max(content + 72, Math.min(share, content + 190)); return { otherW, heroW: inner - gap * (n - 1) - otherW * others.length }; };
    const fits = (s) => { const { otherW, heroW } = widths(s); return heroW >= otherW * 1.4 && contentAt(items[k], s) <= heroW - 56; };
    // A long strip stays low: the figures grow to about twice the row's size, as far as every tile allows.
    let big = fit.size; if (!fits(big)) return null;
    const cap = Math.min(120, Math.round(fit.size * 2)); while (big + 2 <= cap && fits(big + 2)) big += 2;
    const { otherW, heroW } = widths(big);
    const one = (it, width, figureSize, on) => ({ id: 'm', x: 0, width, size: metricSize, figureSize, columns: 1, gap: 0, highlight: on ? 0 : -1, highlightStyle: 'solid', fill: '#FFFFFF', theme: solidTheme, items: [it], ...(on ? {} : { iconCap: 0 }) });
    big = Math.min(await measuredSize(one(items[k], heroW, big, true)), await measuredSize({ ...one(items[others[0]], otherW * others.length + gap * (others.length - 1), big, false), columns: others.length, gap, items: others.map((i) => items[i]) }));
    const small = big;
    const sizeOf = (i) => (i === k ? big : small), widthOf = (i) => (i === k ? heroW : otherW), naturalOf = (i) => metricTiles({ ...one(items[i], widthOf(i), sizeOf(i), i === k), y: 0 }).height;
    const height = Math.max(Math.max(...items.map((_, i) => naturalOf(i))) + 32, h || 0), elements = [], inside = height - 32;
    const place = (i, px, py, pw, ph) => elements.push(...metricTiles({ ...one(items[i], pw, sizeOf(i), i === k), x: px, y: py, tileHeight: ph }).elements.map((e) => ({ ...e, id: e.id.replace(/^m-([a-z]+)-1(?=$|-)/, `m-$1-${i + 1}`) })));
    let cx = x + 16;
    items.forEach((_, i) => { place(i, cx, y + 16, widthOf(i), inside); cx += widthOf(i) + gap; });
    const goals = page.data.filter((d) => d.target != null).length, bindings = page.data.map((d, i) => ({ ref: `${pid}:data-${i + 1}`, elementIds: [`m-value-${i + 1}`, ...(goals > 1 && d.target != null ? [`m-note-${i + 1}`] : [])] }));
    return { height, width: w, elements: [panel('metrics-panel', [x, y, w, height]), ...elements], frame: 'metrics-panel', module: 'metricTiles', variant: `${n}-results-hero`, title: big, sizes: sizesOf(elements, bindings.flatMap((b) => b.elementIds)), reason: '数字组排成整行长条，数字统一放大，最重要的数字占最宽的深色色块', bindings };
  };
  async function render(z, { x, y, w, h, stretch = 0, rowNatural, across = false, hero = false }) {
    const st = statement(z);
    if (st?.asMetric) {
      const sid = `st-${z}`, t = tiles(sid, x, y, w, [{ label: st.label, value: st.text }], h, stretch);
      return { height: t.height, elements: [panel(`${sid}-panel`, [x, y, w, t.height]), ...t.elements], frame: `${sid}-panel`, module: 'metricTiles', variant: 'phrase-result', title: t.valueSize, sizes: sizesOf(t.elements, [`${sid}-value-1`]), reason: '短语结果和数字一起成组', bindings: [{ ref: `${pid}:${z}`, elementIds: [`${sid}-value-1`] }] };
    }
    if (st) {
      const sid = `st-${z}`, spec = { id: sid, x, y, width: w, label: st.label, text: st.text, theme, tone: st.tone || (VERDICT.test(st.label || '') ? 'judgment' : 'primary'), height: h }, tight = await measured(labelBand, { ...spec, height: undefined }), grown = await grownToFill((scale) => measured(labelBand, { ...spec, scale }), tight, Math.max(tight.height + stretch, h || 0), [1.2, 1.1]), b = grown === tight && h ? await measured(labelBand, spec) : grown;
      return { height: b.height, elements: b.elements, frame: `${sid}-bar`, module: 'labelBand', variant: z, sizes: sizesOf(b.elements, [`${sid}-text`]), reason: '标签先读，一句话说清', bindings: [{ ref: `${pid}:${z}`, elementIds: [`${sid}-text`] }] };
    }
    if (z === 'items') {
      const items = page.items.map((it) => ({ title: it.title, detail: it.detail })), stacked = w < 900 && items.some((it) => it.detail);
      if (page.itemForm === 'cards' && w >= W - 1) { const made = await itemCards(items, x, y, w, h); if (made) return made; }
      const spec = { id: 'acts', x, y, width: w, heading: page.itemsHeading, items, theme, stacked }, base = await measured(actionPanel, spec), room = Math.max(h || 0, base.height + stretch), grown = await grownToFill((scale) => measured(actionPanel, { ...spec, scale }), base, room), a = await measured(actionPanel, { ...spec, scale: grown.scale || 1, height: h || (grown === base ? base.height : Math.min(room, grown.height + 48)) }), ids = items.flatMap((it, i) => [`acts-title-${i + 1}`, ...(it.detail ? [`acts-detail-${i + 1}`] : [])]);
      return { height: a.height, elements: a.elements, frame: 'acts-panel', module: 'actionPanel', variant: `${items.length}-items`, title: roles.sectionTitle.fontSize, sizes: sizesOf(a.elements, ids), reason: '逐项展开，短标签先读', bindings: items.map((it, i) => ({ ref: `${pid}:item-${i + 1}`, elementIds: [`acts-title-${i + 1}`, ...(it.detail ? [`acts-detail-${i + 1}`] : [])] })) };
    }
    if (z === 'metrics') {
      const goals = page.data.flatMap((d, i) => (d.target != null ? [i] : []));
      // One figure with a target reads as target → actual; the others sit beside it without competing.
      if (goals.length === 1) {
        const gi = goals[0], d = page.data[gi], others = page.data.flatMap((o, i) => (i === gi ? [] : [{ o, i }])), pairW = others.length ? Math.round(w * 0.52) : w, restW = w - pairW;
        const pair = { id: 'm-cp', before: { label: '目标', value: String(d.target).replace(d.unit && String(d.target).endsWith(d.unit) ? d.unit : '', '').trim(), unit: d.unit }, after: { label: d.label, value: d.value, unit: d.unit }, theme: solidTheme, solidAfter: true };
        const items = others.map(({ o }) => tileItem(o, false)), probe = comparePair({ ...pair, x: 0, y: 0, width: pairW - 32 }), restStyle = { size: Math.min(metricSize, probe.elements.find((e) => e.id === 'm-cp-after-value').style.fontSize), grow: false }, natural = Math.max(probe.height + 32, others.length ? tiles('m', 0, 0, restW, items, 0, 0, -1, restStyle).natural : 0), height = Math.max(natural + stretch, h || 0);
        const cp = comparePair({ ...pair, x: x + 16, y: y + 16, width: pairW - 32, height: height - 32 }), t = others.length ? tiles('m', x + pairW, y, restW, items, height, 0, -1, restStyle) : { elements: [] }, parts = [...cp.elements, ...t.elements];
        const bindings = [{ ref: `${pid}:data-${gi + 1}`, elementIds: ['m-cp-after-value', 'm-cp-before-value'] }, ...others.map(({ i }, k) => ({ ref: `${pid}:data-${i + 1}`, elementIds: [`m-value-${k + 1}`] }))];
        const sizes = sizesOf(parts, bindings.flatMap((b) => b.elementIds));
        return { height, elements: [panel('metrics-panel', [x, y, w, height]), ...parts], frame: 'metrics-panel', module: 'comparePair', variant: `target-actual-${page.data.length}`, title: Math.max(...sizes), sizes, reason: '目标与实际成对比较', bindings };
      }
      const solo = page.data.length === 1 && !goals.length;
      // A note written for a lone figure follows it inside the panel, in place of the empty middle of a wide tile.
      if (solo && page.data[0].note && w >= 900) {
        const figureW = soloFigureWidth(w), noteX = x + figureW + 8, noteW = w - figureW - 40, note = text('m-note-inline', page.data[0].note, [noteX, 0, noteW, 40], theme.roleStyle('body', { color: p.ink, lineHeight: 1.45 })), [size] = await measurer.texts([note]);
        note.bounds[3] = Math.ceil(size.height);
        const emphasised = { size: Math.round(metricSize * 1.15), grow: false }, natural = Math.max(tiles('m', 0, 0, figureW, [tileItem(page.data[0], false)], 0, 0, 0, emphasised).natural, note.bounds[3] + 48), height = Math.max(natural, h || 0), t = tiles('m', x, y, figureW, [tileItem(page.data[0], false)], height, 0, 0, emphasised), bindings = [{ ref: `${pid}:data-1`, elementIds: ['m-value-1', 'm-note-inline'] }];
        note.bounds[1] = y + Math.round((height - note.bounds[3]) / 2);
        const parts = [...t.elements, note], sizes = sizesOf(parts, bindings[0].elementIds);
        return { height, elements: [panel('metrics-panel', [x, y, w, height]), ...parts], frame: 'metrics-panel', module: 'metricTiles', variant: 'figure-with-note', title: Math.max(...sizes), sizes, reason: '数字突出，相关说明紧跟其后', bindings };
      }
      // Beside its sentence a lone figure is one solid rectangle: no panel around it, and no taller than the figure needs, so the sentence is not stretched to match.
      if (solo && w < 760) {
        const tile = metricTiles({ id: 'm', x, y, width: w, size: Math.round(metricSize * 1.15), columns: 1, gap: 0, highlight: 0, highlightStyle: 'solid', fill: '#FFFFFF', theme: solidTheme, items: [tileItem(page.data[0], false)], ...(h ? { tileHeight: h } : {}), iconCap: 0 }), bindings = [{ ref: `${pid}:data-1`, elementIds: ['m-value-1'] }], sizes = sizesOf(tile.elements, bindings[0].elementIds);
        return { height: tile.height, elements: tile.elements, frame: 'm-tile-1', module: 'metricTiles', variant: 'figure-beside-sentence', title: tile.valueSize, sizes, reason: '单个数字突出，话术紧跟其后', bindings };
      }
      const items = page.data.map((d) => tileItem(d, goals.length > 1)), fit = figureRow(items, w, { base: baseSize('metrics') });
      if (page.figureForm === 'strip' && !goals.length) { const made = w >= W - 1 ? await stripRow(fit, x, y, w, h) : await stripColumn(fit, x, y, w, h); if (made) return made; }
      if (fit && hero) { const made = await heroRow(items, fit, x, y, w, h); if (made) return made; }
      if (fit) {
        const common = { id: 'm', x: x + 16, width: fit.width - 32, size: metricSize, figureSize: fit.size, columns: items.length, gap: 12, highlight: metricFocus(page.data), highlightStyle: 'solid', fill: '#FFFFFF', theme: solidTheme, items, iconCap: fit.icons ? 64 : 0 };
        await settleFigures('metrics', common);
        const natural = metricTiles({ ...common, y: 0 }).height + 32, height = Math.max(natural, h || 0), real = metricTiles({ ...common, y: y + 16, tileHeight: height - 32 });
        const bindings = page.data.map((d, i) => ({ ref: `${pid}:data-${i + 1}`, elementIds: [`m-value-${i + 1}`, ...(goals.length > 1 && d.target != null ? [`m-note-${i + 1}`] : [])] })), sizes = sizesOf(real.elements, bindings.flatMap((b) => b.elementIds));
        return { height, width: fit.width, elements: [panel('metrics-panel', [x, y, fit.width, height]), ...real.elements], frame: 'metrics-panel', module: 'metricTiles', variant: `${page.data.length}-results${fit.tight ? '-tight' : ''}`, title: real.valueSize, sizes, reason: goals.length > 1 ? '实际值和目标放在同一色块' : fit.tight ? '数字色块按内容收紧' : '结果数字成组', bindings };
      }
      const t = tiles('m', x, y, w, items, h, stretch, metricFocus(page.data)), bindings = page.data.map((d, i) => ({ ref: `${pid}:data-${i + 1}`, elementIds: [`m-value-${i + 1}`, ...(goals.length > 1 && d.target != null ? [`m-note-${i + 1}`] : [])] })), sizes = sizesOf(t.elements, bindings.flatMap((b) => b.elementIds));
      return { height: t.height, elements: [panel('metrics-panel', [x, y, w, t.height]), ...t.elements], frame: 'metrics-panel', module: 'metricTiles', variant: `${page.data.length}-results`, title: t.valueSize, sizes, reason: goals.length > 1 ? '实际值和目标放在同一色块' : '结果数字成组', bindings };
    }
    if (z === 'compare') {
      const c = page.compare, r = colorRoles(p), left = asList(c.left), right = asList(c.right), n = Math.max(left.length, right.length), { now, onward } = compareSides(c), nowLeft = now === 'left', paired = left.length === right.length && c.paired !== false;
      // The same measures on both sides, each a figure: the change is the point, so each pair is one tile reading "before → after" with the later figure large.
      const change = changeRow(w);
      if (change) {
        const { items, fit, width, heading } = change, headH = 20 + headBox, common = { id: 'cmp', x: x + 16, width: fit.width - 32, size: metricSize, figureSize: fit.size, columns: items.length, gap: 12, highlight: metricFocus(items), highlightStyle: 'solid', fill: '#FFFFFF', theme: solidTheme, items, iconCap: 0 };
        await settleFigures('compare', common);
        const natural = metricTiles({ ...common, y: 0 }).height + headH + 16, height = Math.max(natural, h || 0), real = metricTiles({ ...common, y: y + headH, tileHeight: height - headH - 16 }), ids = (k) => [`cmp-label-${k + 1}`, `cmp-value-${k + 1}`];
        const bindings = [...left.map((_, k) => ({ ref: `${pid}:compare-l${k + 1}`, elementIds: ids(k) })), ...right.map((_, k) => ({ ref: `${pid}:compare-r${k + 1}`, elementIds: ids(k) })), ...left.map((_, k) => ({ ref: `${pid}:compare`, rowId: `row-${k + 1}`, elementIds: ids(k) }))];
        const elements = [panel('cmp-frame', [x, y, width, height]), text('cmp-head', heading, [x + 24, y + 12, width - 48, headBox], theme.roleStyle('sectionTitle', { color: readableInk(p.accent, p.pale), lineHeight: 1.3 })), ...real.elements];
        return { height, width, elements, frame: 'cmp-frame', module: 'metricTiles', variant: `${items.length}-changes`, title: real.valueSize, sizes: sizesOf(real.elements, items.flatMap((_, k) => ids(k))), reason: '前后数值成对，变化放大', bindings };
      }
      // Otherwise two sides. Rows that pair up share a height and are tied by an arrow (one leads to the other) or a number (row by row); sides that do not pair each keep their own rows.
      const mid = paired || c.badge ? 64 : 28, sideW = Math.floor((w - mid) / 2), rightX = x + sideW + mid, capH = 56, pad = 24, innerW = sideW - pad * 2;
      const cell = (id, it, cx) => ({ id, type: 'text', text: [it.title, it.detail].filter(Boolean).join('：'), ...(it.title && it.detail ? { runs: [{ text: it.title, style: { fontWeight: 700 } }, { text: '：' + it.detail }] } : {}), bounds: [cx + pad, 0, innerW, 40], style: theme.roleStyle('body', { color: p.ink, lineHeight: 1.45 }) });
      const cellsL = left.map((it, k) => cell(`cmp-l-${k + 1}`, it, x)), cellsR = right.map((it, k) => cell(`cmp-r-${k + 1}`, it, rightX)), all = [...cellsL, ...cellsR], sizes = await measurer.texts(all); all.forEach((e, k) => { e.bounds[3] = Math.ceil(sizes[k].height); });
      const need = (e) => e.bounds[3] + 28, sum = (list) => list.reduce((a, b) => a + b, 0), together = paired ? cellsL.map((e, k) => Math.max(need(e), need(cellsR[k]))) : null, needL = together || cellsL.map(need), needR = together || cellsR.map(need);
      const natural = capH + Math.max(sum(needL), sum(needR)) + 16, height = Math.max(natural + stretch, h || 0), spread = (list) => { const extra = Math.floor((height - capH - 16 - sum(list)) / Math.max(1, list.length)); return list.map((v) => v + extra); }, rowsL = spread(needL), rowsR = spread(needR);
      // The side that stands for this period, or the way forward, takes the primary colour; the other takes the secondary.
      const primary = [solidFill, r.band, p.inverse], secondary = [lighten(r.secondary, 0.45), r.soft, readableInk(r.secondaryInk, lighten(r.secondary, 0.45))], elements = [{ id: 'cmp-frame', type: 'shape', bounds: [x, y, w, height], style: { fill: p.bg } }];
      [[x, nowLeft ? primary : secondary, c.leftLabel || '现状'], [rightX, nowLeft ? secondary : primary, c.rightLabel || '改进']].forEach(([sx, [cap, body, ink], label], k) => elements.push({ type: 'shape', id: `cmp-side-${k + 1}`, ...(k === 0 ? { component: 'contrastPair' } : {}), bounds: [sx, y, sideW, height], style: { fill: body, radius: theme.radius ?? 0 } }, { type: 'shape', id: `cmp-cap-${k + 1}`, bounds: [sx, y, sideW, capH], style: { fill: cap, radius: theme.radius ?? 0 } }, text(`cmp-title-${k + 1}`, label, [sx + pad, y + 10, innerW, 36], theme.font(26, { fontWeight: 700, color: ink, textAlign: 'center', lineHeight: 1.3 }))));
      [[cellsL, rowsL, x], [cellsR, rowsR, rightX]].forEach(([cells, rows, sx], k) => { let ry = y + capH + 8; cells.forEach((e, row) => { e.bounds[1] = ry + Math.round((rows[row] - e.bounds[3]) / 2); elements.push(e); if (row < cells.length - 1) elements.push({ type: 'shape', id: `cmp-rule-${k + 1}-${row + 1}`, bounds: [sx + pad, ry + rows[row], innerW, 1], style: { fill: p.line } }); ry += rows[row]; }); });
      if (paired) { let ry = y + capH + 8; rowsL.forEach((rowH, row) => { const cy = ry + Math.round(rowH / 2); if (onward) elements.push({ type: 'vector', id: `cmp-arrow-${row + 1}`, bounds: [x + sideW + 20, cy - 20, 24, 40], viewBox: [0, 0, 28, 48], path: nowLeft ? 'M24,4 L4,24 L24,44' : 'M4,4 L24,24 L4,44', style: { fill: 'none', stroke: solidFill, strokeWidth: 5 } }); else elements.push({ type: 'shape', id: `cmp-dot-${row + 1}`, bounds: [x + sideW + 12, cy - 20, 40, 40], style: { fill: solidFill, radius: 20 } }, text(`cmp-no-${row + 1}`, String(row + 1).padStart(2, '0'), [x + sideW + 12, cy - 14, 40, 28], theme.font(20, { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.4 }))); ry += rowH; }); }
      // A badge between the caps only when the outline asks for one: 问题 and 改进 answer each other, they are not opponents.
      if (c.badge) elements.push({ type: 'shape', id: 'cmp-vs', bounds: [x + sideW + 2, y, 60, 56], style: { fill: '#26262B', radius: 28 } }, text('cmp-vs-text', c.badge, [x + sideW + 2, y + 12, 60, 32], theme.font(24, { fontWeight: 800, color: '#FFFFFF', textAlign: 'center', lineHeight: 1.3 })));
      const at = (side, k) => `cmp-${side}-${k + 1}`, bindings = [...left.map((_, k) => ({ ref: `${pid}:compare-l${k + 1}`, elementIds: [at('l', k)] })), ...right.map((_, k) => ({ ref: `${pid}:compare-r${k + 1}`, elementIds: [at('r', k)] })), ...Array.from({ length: Math.min(left.length, right.length) }, (_, k) => ({ ref: `${pid}:compare`, rowId: `row-${k + 1}`, elementIds: [at('l', k), at('r', k)] }))];
      return { height, elements, frame: 'cmp-frame', module: 'contrastPair', variant: `${n}-rows${paired ? '' : '-unpaired'}`, title: 26, reason: paired ? (onward ? '两侧逐行对应，箭头指向本期或改进' : '两侧逐行对照') : '两侧各自成列', bindings };
    }
    if (z === 'periods') {
      const timeline = periodTimeline(page.periods);
      const laned = timeline && await periodLanes({ x, y, w, h, heading: page.periodsHeading, pds: page.periods, timeline });
      if (laned) return laned;
      // In the band, the lane a period belongs to is said in its heading.
      const pds = page.periods.map((pd) => (pd.lane && !String(pd.title || '').includes(pd.lane) ? { ...pd, title: pd.title ? `${pd.title}｜${pd.lane}` : pd.lane } : pd)), heading = page.periodsHeading, headH = heading ? 20 + headBox : 16, bandY = y + headH, band = periodBand({ id: 'pd', x: x + 24, y: bandY, width: w - 48, periods: pds.map((pd) => pd.label), theme: solidTheme, height: 60 });
      band.elements.forEach((e) => { const n = /^pd-label-(\d+)$/.exec(e.id); if (!n) return; const fill = band.elements.find((s) => s.id === `pd-seg-${n[1]}`).style.fill; if (fill !== solidFill) e.style.color = readableInk(e.style.color, fill); });
      // Each period keeps its own heading and one line per point.
      const lay = async (scale) => {
        const titleStyle = theme.roleStyle('stepTitle', { color: p.ink, lineHeight: 1.35, fontSize: evenSize(label * scale) }), pointSize = evenSize(body * scale);
        // Each column's heading and points start at its band segment's left edge, level with the panel heading above.
        const heads = band.columns.map(([cx, cw], i) => (pds[i].title ? { id: `pd-title-${i + 1}`, type: 'text', text: pds[i].title, bounds: [cx, bandY + 76, cw - 20, 40], style: titleStyle } : null)), present = heads.filter(Boolean), sizes = present.length ? await measurer.texts(present) : [];
        present.forEach((e, i) => { e.bounds[3] = Math.ceil(sizes[i].height); });
        const columnH = band.columns.map(([, cw], i) => (heads[i] ? heads[i].bounds[3] + 8 : 0) + pointsHeight(asList(pds[i].points), pointSize, cw - 28, 1.45));
        return { heads, present, pointSize, height: headH + 76 + Math.max(...columnH) + 24 };
      };
      // The box grows only as far as its text does; what is left goes back to the page.
      const naturalLay = await lay(1), { heads, present, pointSize, height: natural } = await grownToFill(lay, naturalLay, Math.max(naturalLay.height + stretch, h || 0)), height = h ? Math.max(natural, h) : Math.min(naturalLay.height + stretch, natural + 16), shift = Math.min(16, Math.round((height - natural) / 4));
      const lists = band.columns.flatMap(([cx, cw], i) => { if (heads[i]) heads[i].bounds[1] += shift; return pointList({ id: `pd-point-${i + 1}`, x: cx, y: bandY + 76 + shift + (heads[i] ? heads[i].bounds[3] + 8 : 0), width: cw - 20, points: asList(pds[i].points), size: pointSize, color: p.ink, theme, lh: 1.45 }); });
      const elements = [panel('periods-panel', [x, y, w, height]), ...(heading ? [text('periods-head', heading, [x + 24, y + 12, w - 48, headBox], theme.roleStyle('sectionTitle', { color: readableInk(p.accent, p.pale), lineHeight: 1.3 }))] : []), ...band.elements, ...present, ...lists];
      const ids = pds.map((pd, i) => [`pd-label-${i + 1}`, ...(pd.title ? [`pd-title-${i + 1}`] : []), ...asList(pd.points).map((_, k) => `pd-point-${i + 1}-${k + 1}`)]);
      return { height, elements, frame: 'periods-panel', module: 'periodBand', variant: `${pds.length}-periods`, title: roles.sectionTitle.fontSize, sizes: sizesOf([...present, ...lists], ids.flat()), reason: '色带表达时间推进', bindings: [...pds.map((_, i) => ({ ref: `${pid}:period-${i + 1}`, elementIds: ids[i] })), ...pds.slice(1).map((_, i) => ({ ref: `${pid}:periods`, edgeId: `e${i + 1}`, elementIds: [`pd-seg-${i + 1}`, `pd-seg-${i + 2}`] }))] };
    }
    const nthTable = /^table-(\d+)$/.exec(z);
    if (z === 'table' || nthTable) {
      const tid = nthTable ? `t${nthTable[1]}` : 't', panelId = nthTable ? `${z}-panel` : 'table-panel', source = nthTable ? asList(page.tables)[+nthTable[1] - 1] : page.table;
      const size = body, innerW = w - 48, keys = source.columns.map((_, i) => `c${i}`), need = source.columns.map((head, i) => Math.max(textWidth(head, size), ...source.rows.map((r) => textWidth(r[i], size * 1.1))) + 40);
      // A share column (占比 with percentages) is drawn as bars in place, so the parts can be compared at a glance
      // while every other column stays as written. The total row (100% or 合计) keeps its figure and gets no bar.
      const totalRow = (r) => /^(合计|总计|小计|总盘|合 计)/.test(String(r[0] || '').replace(/[*\s]/g, '')) || /^100(\.0+)?%$/.test(String(r[shareCol] ?? '').trim());
      const shareCol = source.columns.findIndex((head, i) => i > 0 && /占比|比例|份额|比重|占总/.test(head) && source.rows.filter((r) => /^\d+(\.\d+)?\s*%$/.test(String(r[i] ?? '').trim())).length >= Math.max(3, source.rows.length - 1));
      const shareOf = (r) => Number(String(r[shareCol] ?? '').replace(/[^\d.]/g, '')), shares = shareCol > 0 ? source.rows.filter((r) => !totalRow(r)).map(shareOf) : [], barRoom = 200;
      if (shareCol > 0) need[shareCol] += barRoom;
      // Short columns (amounts, shares) never wrap: when space is tight only the long text columns give way.
      const total = need.reduce((a, b) => a + b, 0), wide = need.map((n) => (n > innerW / need.length ? n : 0)), wideSum = wide.reduce((a, b) => a + b, 0);
      const widths = need.map((n, i) => Math.max(64, Math.floor(total > innerW && wideSum > total - innerW ? n - (total - innerW) * wide[i] / wideSum : n * innerW / total)));
      widths[widths.length - 1] += innerW - widths.reduce((a, b) => a + b, 0);
      const keyCol = source.columns.findIndex((head, i) => !(i === 0 && /^序|编号$/.test(head)));
      // A highlighted row's fill needs 12px before the first column's text. The rules and fills hang out by that much, so
      // the first column still starts level with the table heading and the other modules' text.
      const hang = asList(source.highlight).some((i) => i >= 0 && i < source.rows.length) ? 12 : 0;
      const columns = keys.map((key, i) => ({ key, label: source.columns[i], width: widths[i] + (i === 0 ? hang : 0) + (i === keys.length - 1 ? hang : 0), ...(i === keyCol ? { emphasize: true } : {}) }));
      const rows = source.rows.map((r, i) => ({ id: `row-${i + 1}`, ...Object.fromEntries(keys.map((k, j) => [k, r[j]])), ...({ ref: nthTable ? `${pid}:${z}-row-${i + 1}` : `${pid}:row-${i + 1}` }), ...(asList(source.highlight).includes(i) ? { highlight: true } : {}) }));
      const padY = Math.min(36, 13 + Math.floor(stretch / (2 * (rows.length + 1))));
      const headH = source.title ? 10 + headBox : 0, buildTable = (padY) => measureModule(capacityTable, { id: tid, bounds: [x + 24 - hang, y + 18 + headH, innerW + hang * 2, Math.max(60, Math.min(1079 - y - 18 - headH, 900))], theme: readableTheme, size, headSize: roles.tableHeader.fontSize, padY, relationRef: `${pid}:${z}`, columns, rows }, measurer);
      let t = await buildTable(padY);
      // In a row of equal-height modules the table opens up its rows to end level with its neighbour.
      if (h && t.height + 36 + headH < h) t = await buildTable(Math.min(36, padY + Math.floor((h - t.height - 36 - headH) / (2 * (rows.length + 1)))));
      const height = Math.max(t.height + 36 + headH, h || 0);
      const bindings = t.bindings;
      if (shareCol > 0) {
        const most = Math.max(...shares), colX = (i) => x + 24 - hang + columns.slice(0, i).reduce((a, c) => a + c.width, 0) + (i === 0 ? hang : 0), figureW = Math.ceil(textWidth('100.0%', size * 1.1)) + 16;
        source.rows.forEach((r, i) => {
          const cell = t.elements.find((e) => e.id === `${tid}-row-row-${i + 1}-c${shareCol}`); if (!cell || totalRow(r)) return;
          const left = cell.bounds[0], room = Math.max(40, colX(shareCol) + columns[shareCol].width - 24 - (left + figureW)), barW = Math.max(6, Math.round(room * shareOf(r) / most));
          cell.bounds[2] = figureW;
          t.elements.push({ id: `${tid}-share-${i + 1}`, type: 'shape', component: 'shareBar', bounds: [left + figureW, cell.bounds[1] + Math.round(cell.bounds[3] / 2) - 7, barW, 14], style: { fill: asList(source.highlight).includes(i) ? (p.gold || p.accent) : p.accent, radius: 4 } });
        });
      }
      return { height, elements: [panel(panelId, [x, y, w, height], true), ...(source.title ? [text(`${tid}-head`, source.title, [x + 24, y + 14, innerW, headBox], theme.roleStyle('sectionTitle', { color: readableInk(p.accent, '#FFFFFF'), lineHeight: 1.3 }))] : []), ...t.elements], frame: panelId, module: 'capacityTable', variant: `${rows.length}-rows${shareCol > 0 ? '-share-bars' : ''}`, reason: shareCol > 0 ? '逐项对应，占比画成比例条' : '逐项对应', bindings };
    }
    const flowGroup = /^(flow|chain)-(\d+)$/.exec(z);
    if (flowGroup) {
      const group = asList(page[`${flowGroup[1]}s`])[+flowGroup[2] - 1];
      const steps = asList(group.steps).map((s, i) => ({ id: `s${i + 1}`, title: typeof s === 'string' ? s : s.title, detail: typeof s === 'string' ? undefined : s.detail, ref: `${pid}:${z}-${i + 1}` }));
      const heading = group.title, headH = heading ? 32 + headBox : 24, safe = (id) => id.replace(/[^a-z0-9]/gi, '');
      const fid = `f${safe(z)}`, f = await measureModule(capacityFlow, { id: fid, bounds: [x + 24, y + headH, w - 48, Math.min(1079 - y - headH, 420)], theme, titleSize: label, detailSize: body, steps, span: true }, measurer);
      const loop = Number.isInteger(group?.returnTo) && group.returnTo >= 1 && group.returnTo < steps.length ? group.returnTo : 0, natural = f.height + headH + 24 + (loop ? 48 : 0);
      const cards = await flowCards({ fid, x: x + 24, y: y + headH, w: w - 48, steps, room: h ? h - headH - 24 - (loop ? 48 : 0) : 0 }), height = cards ? headH + cards.cardH + 24 + (loop ? 48 : 0) : Math.max(natural, h || 0), shift = cards ? 0 : Math.round((height - Math.max(natural, rowNatural || 0)) / 3), parts = cards ? cards.elements : f.elements;
      if (!cards) f.elements.forEach((e) => { if (Array.isArray(e.bounds)) e.bounds[1] += shift; if (e.from) e.from[1] += shift; if (e.to) e.to[1] += shift; });
      // returnTo: the last step leads back to that step, drawn as a line under the labels with an arrow into it.
      const nodeOf = (n) => parts.find((e) => e.id === `${fid}-node-s${n}`).bounds, centre = (n) => nodeOf(n)[0] + Math.round(nodeOf(n)[2] / 2), textBottom = cards ? y + headH + cards.cardH : Math.max(...parts.filter((e) => e.type === 'text' && Array.isArray(e.bounds)).map((e) => e.bounds[1] + e.bounds[3]));
      const loopLines = loop ? [[`${z}-loop-down`, [centre(steps.length), textBottom + 8], [centre(steps.length), textBottom + 36]], [`${z}-loop-back`, [centre(steps.length), textBottom + 36], [centre(loop), textBottom + 36]], [`${z}-loop-up`, [centre(loop), textBottom + 36], [centre(loop), textBottom + 8], true]].map(([id, from, to, arrow]) => ({ ...lineElement({ id, from, to, style: { stroke: p.accent, strokeWidth: 3 } }), ...(arrow ? { endArrow: true } : {}) })) : [];
      const elements = [panel(`${z}-panel`, [x, y, w, height]), { type: 'shape', id: `${z}-mark`, bounds: [x, y, 6, height], style: { fill: p.accent } }, ...(heading ? [text(`${z}-head`, heading, [x + 24, y + 20, w - 48, headBox], theme.roleStyle('sectionTitle', { color: readableInk(p.accent, p.pale), lineHeight: 1.3 }))] : []), ...parts, ...loopLines], stepBindings = cards ? cards.bindings : f.bindings;
      return { height, elements, frame: `${z}-panel`, module: 'capacityFlow', variant: `${steps.length}-steps${cards ? '-cards' : ''}`, title: roles.sectionTitle.fontSize, ...(cards ? { sizes: sizesOf(parts, stepBindings.flatMap((b) => b.elementIds)) } : {}), reason: '箭头表达先后', bindings: [...stepBindings, ...flowEdgeBindings(fid, `${pid}:${z}`, steps.map((s) => s.id))] };
    }
    if (z === 'photos') {
      const H = h || 420, cols = across ? singleColumns(page.photos) : photoColumns(page.photos), natural = naturalPhotoWidth(cols, H), scale = Math.min(1, (w - (cols.length - 1) * 24) / (natural - (cols.length - 1) * 24)), elements = [], bindings = [];
      let cx = x;
      cols.forEach((col, ci) => {
        const cellH = Math.floor((H - col.length * CAP - (col.length - 1) * PHOTO_GAP) / col.length), share = cellH * (col.reduce((a, c) => a + c.r, 0) / col.length) * scale;
        const cw = ci === cols.length - 1 ? x + w - cx : Math.round(share);
        col.forEach((ph, ri) => {
          const id = `ph${ph.index + 1}`, cy = y + ri * (cellH + CAP + PHOTO_GAP), g = photoGroup({ id, x: cx, y: cy, width: cw, height: cellH, theme, images: [{ src: ph.src, alt: ph.caption || '' }] });
          elements.push(...g.elements); if (ph.caption) elements.push(text(`${id}-cap`, ph.caption, [cx, cy + cellH + 6, cw, 28], theme.roleStyle('caption', { lineHeight: 1.25 })));
          bindings.push({ ref: `${pid}:photo-${ph.index + 1}`, elementIds: g.elements.filter((e) => e.type === 'image').map((e) => e.id) });
        });
        cx += cw + 24;
      });
      return { height: H, elements, frame: null, module: 'photoGroup', variant: `${page.photos.length}-photos`, title: roles.caption.fontSize, reason: '原图作证据', bindings };
    }
    throw new Error(`report-deck: unknown zone ${z} on page ${pid}`);
  }
  // The width a lone figure needs at its emphasised size, tile and panel padding included.
  const soloFigureWidth = (limit) => { const d = page.data[0], size = Math.round(metricSize * 1.15), labelSize = Math.max(20, Math.round(size * 0.3)); return Math.min(Math.round(limit * 0.45), Math.max(260, Math.ceil(Math.max(textWidth(String(d.value), size) + (d.unit ? textWidth(` ${d.unit}`, Math.max(20, Math.round(size * 0.32))) : 0), textWidth(d.label || '', labelSize)) * 1.08) + 44 + 8)); };
  return { render, zones, soloFigureWidth, tightFiguresWidth, tightWidth, heroFor };
}

async function layoutPage({ page, plan, theme, measurer, layout, pageNo, total, footer, header }) {
  const { render, soloFigureWidth, tightFiguresWidth, tightWidth: tightZoneWidth, heroFor } = pageWriter({ page, zones: plan.visualDecision.zones.map((z) => z.id), theme, measurer }), p = theme.palette;
  // Figures that hug their content and leave at least 480px of the line take the sentence next to them; a hand-written layout is kept as written.
  const sentenceRoom = 480, zoneIds = plan.visualDecision.zones.map((z) => z.id);
  // Figures that would take the sentence next to them stay tiles: the pair says more than a strip across the line.
  if (page.figureForm === 'strip' && !layout) {
    page.figureForm = 'tiles';
    const t = tightFiguresWidth(W), base = defaultLayout(page, zoneIds);
    if (JSON.stringify(pairSoloFigure(page, [...base], Boolean(t && W - GAP - t >= sentenceRoom))) === JSON.stringify(base)) page.figureForm = 'strip';
  }
  const tightWidth = layout ? null : tightFiguresWidth(W);
  const rows = pairSoloFigure(page, [...(layout || defaultLayout(page, zoneIds))], Boolean(tightWidth && W - GAP - tightWidth >= sentenceRoom)), placed = new Set(rows.flatMap((r) => (typeof r === 'string' ? [r] : Array.isArray(r) ? r : [...r.left.flat(), r.right])));
  const missing = zoneIds.filter((z) => !placed.has(z));
  if (missing.length) throw new Error(`report-deck: ${page.id} layout leaves out ${missing.join(', ')}`);
  // Widths for a row of independent bands follow their sentences, so short text does not wrap beside a wide empty band.
  // Two different modules side by side are not equals: the one the title speaks about (its figures or its focus) is
  // primary and takes the wider column; with no such hint, the one with more to say does. Peers of one kind (two tables,
  // two flows) stay equal (HS-02). The split narrows only as far as the row stays about as low as an equal split.
  const rankedWidths = async (zones, width) => {
    const half = Math.floor(width / 2), equal = zones.map(() => half), kind = (z) => z.replace(/-\d+$/, '');
    if (kind(zones[0]) === kind(zones[1])) return equal;
    const at = async (ws) => inOrder(zones, (z, i) => render(z, { x: L, y: TOP, w: ws[i] })), base = await at(equal), baseH = Math.max(...base.map((m) => m.height));
    const said = new Set(figuresIn(page.keyLine.text).map((f) => f.value)), focus = String(page.focus || '').replace(/\s/g, '');
    const score = (m) => { const text = m.elements.filter((e) => e.type === 'text').map((e) => String(e.text || '')).join('\n'), flat = text.replace(/\s/g, ''); return figuresIn(text).filter((f) => said.has(f.value)).length + (focus && flat.includes(focus) ? 2 : 0); };
    const scores = base.map(score), lead = scores[0] !== scores[1] ? (scores[0] > scores[1] ? 0 : 1) : base[0].height !== base[1].height ? (base[0].height > base[1].height ? 0 : 1) : -1;
    if (lead < 0) return equal;
    for (const share of PRIMARY_SHARES) {
      const main = Math.floor(width * share), ws = zones.map((_, i) => (i === lead ? main : width - main)), ms = await at(ws);
      // A split that leaves a one-line label wider than its box is no good, however low the row.
      const lines = ms.flatMap((m) => m.elements.filter((e) => e.type === 'text' && /-label-\d+$/.test(e.id) && e.text)), real = lines.length ? await measurer.texts(lines.map((e) => ({ ...e, bounds: [0, 0, 3000, e.bounds[3]] }))) : [];
      if (Math.max(...ms.map((m) => m.height)) <= baseH * 1.08 && lines.every((e, i) => real[i].naturalWidth <= e.bounds[2] + 1)) return ws;
    }
    return equal;
  };
  const bandWidths = async (zones, total = W) => {
    if (zones.includes('metrics') && zones.length === 2 && asList(page.data).length === 1) { const figure = soloFigureWidth(total - GAP); return zones.map((z) => (z === 'metrics' ? figure : total - GAP - figure)); }
    const texts = zones.map((z) => asList(page.statements).find((st, i) => (st.id || `statement-${i + 1}`) === z)), width = total - GAP * (zones.length - 1);
    // Beside a sentence a row of figures keeps the width its content needs, and the sentence takes the rest.
    const figures = zones.includes('metrics') && zones.length === 2 && texts.some((t) => t && !t.asMetric) ? tightFiguresWidth(total) : null;
    if (figures && total - GAP - figures >= sentenceRoom) return zones.map((z) => (z === 'metrics' ? figures : total - GAP - figures));
    if (texts.some((t) => !t)) return zones.length === 2 ? rankedWidths(zones, width) : zones.map(() => Math.floor(width / zones.length));
    const m = await measurer.texts(texts.map((t, i) => ({ id: `n${i}`, type: 'text', text: t.text, bounds: [0, 0, 2000, 40], style: theme.roleStyle('body', { fontWeight: 500 }) }))), need = m.map((r) => Math.ceil(r.naturalWidth) + 64), sum = need.reduce((a, b) => a + b, 0);
    if (sum > width) return need.map((n) => Math.floor(n * width / sum));
    const extra = Math.floor((width - sum) / zones.length); return need.map((n) => n + extra);
  };
  // First pass: natural heights, photo rows excluded because they take what is left.
  const measureRow = async (row) => {
    if (row === 'photos') return { photo: true, across: true };
    if (typeof row === 'string') { const m = await render(row, { x: L, y: TOP, w: W, hero: !layout && heroFor(row, W) }); return { h: m.height }; }
    if (Array.isArray(row)) { const ws = await bandWidths(row), ms = await inOrder(row, (z, i) => render(z, { x: L, y: TOP, w: ws[i] })); return { h: Math.max(...ms.map((m) => m.height)), ws }; }
    return { photo: true };
  };
  // A short text stack beside big landscape photos leaves a tall empty column, so the photos go across the page instead.
  const sideAt = rows.findIndex((r) => r.left);
  if (!layout && sideAt >= 0) {
    let stack = GAP * (rows[sideAt].left.length - 1), rest = 0;
    for (const z of rows[sideAt].left) stack += (await render(z, { x: L, y: TOP, w: Math.round(W * 0.6) })).height;
    for (const [i, r] of rows.entries()) if (i !== sideAt) rest += (await measureRow(r)).h + GAP;
    const room = BOTTOM - TOP - rest;
    if (stack < room * 0.42 && naturalPhotoWidth(singleColumns(page.photos), room - stack - GAP) >= W * 0.85) rows.splice(sideAt, 1, ...rows[sideAt].left, 'photos');
  }
  const avail = BOTTOM - TOP - GAP * (rows.length - 1);
  const measuredRows = []; for (const row of rows) measuredRows.push(await measureRow(row));
  const sumOthers = () => measuredRows.reduce((a, r) => a + (r.photo ? 0 : r.h), 0);
  const splitFor = (H) => { const cols = photoColumns(page.photos), rightW = Math.round(Math.max(W * 0.3, Math.min(W * 0.52, naturalPhotoWidth(cols, H)))); return { leftW: W - rightW - 28, rightW }; };
  // A pair of bands on a text-and-photo page follows the page's column split, so the divider lines up all the way down.
  const sideRow = measuredRows.findIndex((r) => r.photo && !r.across), split = sideRow >= 0 ? splitFor(avail - sumOthers()) : null;
  if (split) for (const [i, row] of rows.entries()) {
    if (!Array.isArray(row) || row.length !== 2 || !row.every((z) => asList(page.statements).some((st, n) => (st.id || `statement-${n + 1}`) === z))) continue;
    const ws = [split.leftW, split.rightW], ms = await inOrder(row, (z, n) => render(z, { x: L, y: TOP, w: ws[n] }));
    measuredRows[i] = { ...measuredRows[i], h: Math.max(...ms.map((m) => m.height)), ws, gap: 28 };
  }
  const others = sumOthers();
  const elements = [], design = {};
  const placeModule = (m, z, box) => { elements.push(...m.elements); design[z] = { m, box }; };
  const photoRowH = avail - others, hasPhoto = measuredRows.some((r) => r.photo);
  // Modules hug their content. Spare height is never shared out to make boxes taller: the page moves up a type size instead.
  if (!hasPhoto && others > avail) throw new PageOverflow(`${page.id} 超出 ${others - avail}px`);
  let naturalUsed = 0;
  const centred = new Set();
  const place = async (startY, gap) => {
    elements.length = 0; for (const k of Object.keys(design)) delete design[k];
    let y = startY; naturalUsed = GAP * (rows.length - 1);
    for (const [ri, row] of rows.entries()) {
      const info = measuredRows[ri];
      if (row === 'photos') {
        if (photoRowH < 200) throw new PageOverflow(`${page.id} 图片区只剩 ${photoRowH}px`);
        const H = Math.min(photoRowH, naturalPhotoHeight(singleColumns(page.photos), W)), m = await render(row, { x: L, y, w: W, h: H, across: true });
        placeModule(m, row, [L, y, W, H]); y += H + gap; naturalUsed += H;
      } else if (typeof row === 'string') {
        // Figures that hug their content with no sentence to follow them: small, nearly square tiles sit in the middle of
        // the line; wide tiles start at the left margin like the rest of the page (user decision 2026-11-10).
        const big = !layout && heroFor(row, W), hug = big ? null : tightZoneWidth(row, W);
        let mx = hug ? L + Math.round((W - hug) / 2) : L, m = await render(row, { x: mx, y, w: hug || W, hero: big });
        // A large figure with its compact neighbours makes one group; when it still stops short of the line it sits in the middle.
        if (big && m.width < W - 1) { mx = L + Math.round((W - m.width) / 2); m = await render(row, { x: mx, y, w: W, hero: big }); centred.add(row); }
        const tile = hug && m.elements.find((e) => /-tile-1$/.test(e.id) && e.type === 'shape')?.bounds;
        if (tile && tile[2] / tile[3] > SQUARE_TILE) { mx = L; m = await render(row, { x: mx, y, w: hug }); }
        if (hug && mx !== L) centred.add(row);
        placeModule(m, row, [mx, y, m.width || hug || W, m.height]); y += m.height + gap; naturalUsed += info.h;
      } else if (Array.isArray(row)) {
        const h = info.h; let x = L, tallest = h;
        for (const [i, z] of row.entries()) {
          // A module with much less to say than its neighbour (a one-sentence label beside a row of figures) keeps its own
          // height and sits in the middle of the row; one with nearly as much is drawn as tall as the row (user decision 2026-11-10).
          const own = await render(z, { x, y, w: info.ws[i] }), short = own.height < h * EQUAL_HEIGHT_SHARE;
          const m = short ? await render(z, { x, y: y + Math.round((h - own.height) / 2), w: info.ws[i] }) : await render(z, { x, y, w: info.ws[i], h, rowNatural: info.h });
          placeModule(m, z, [x, short ? y + Math.round((h - own.height) / 2) : y, info.ws[i], m.height]); x += info.ws[i] + (info.gap || GAP); tallest = Math.max(tallest, short ? h : m.height);
        }
        y += tallest + gap; naturalUsed += info.h;
      } else {
        if (photoRowH < 200) throw new PageOverflow(`${page.id} 图文区只剩 ${photoRowH}px`);
        const cols = photoColumns(page.photos), gaps = GAP * (row.left.length - 1), stackItem = async (z, box) => { if (!Array.isArray(z)) return render(z, box); const ws = await bandWidths(z, box.w), natural = Math.max(...(await inOrder(z, (q, i) => render(q, { ...box, w: ws[i] }))).map((m) => m.height)); let cx = box.x; const parts = await inOrder(z, async (q, i) => { const m = await render(q, { ...box, x: cx, w: ws[i], h: natural }), part = { z: q, m, box: [cx, box.y, ws[i], m.height] }; cx += ws[i] + GAP; return part; }); return { height: natural, module: 'metricTiles', parts }; }, stack = async (width) => { const out = []; for (const z of row.left) out.push(await stackItem(z, { x: L, y, w: width })); return out; }, heightOf = (ms) => ms.reduce((a, m) => a + m.height, 0) + gaps;
        let { leftW, rightW } = split, probe = await stack(leftW), natural = heightOf(probe);
        // Modules keep their own height beside photos. The photos follow the column instead: when they would stand taller, they narrow to its height.
        const narrowed = Math.round(Math.max(W * 0.3, Math.min(W * 0.52, naturalPhotoWidth(cols, natural))));
        if (natural < Math.min(photoRowH, naturalPhotoHeight(cols, rightW)) && narrowed < rightW) { rightW = narrowed; leftW = W - rightW - 28; probe = await stack(leftW); natural = heightOf(probe); }
        if (natural > photoRowH) throw new PageOverflow(`${page.id} 左栏超出 ${natural - photoRowH}px`);
        // A small gap is closed by a last module that can use it; figures in tiles cannot, so the photos stop level with them. A large gap centres the column.
        const photoH = Math.min(photoRowH, Math.max(natural, naturalPhotoHeight(cols, rightW))), slack = photoH - natural, centred = slack > 120, closes = !centred && !['metricTiles', 'comparePair'].includes(probe.at(-1).module), usedH = centred || closes ? photoH : natural;
        let ly = y + (centred ? Math.round(slack / 2) : 0);
        for (const [i, z] of row.left.entries()) { const m = await stackItem(z, { x: L, y: ly, w: leftW, ...(i === row.left.length - 1 && closes ? { h: y + usedH - ly } : {}) }); if (m.parts) m.parts.forEach((part) => placeModule(part.m, part.z, part.box)); else placeModule(m, z, [L, ly, m.width || leftW, m.height]); ly += m.height + GAP; }
        const ph = await render(row.right, { x: L + leftW + 28, y, w: rightW, h: usedH });
        placeModule(ph, row.right, [L + leftW + 28, y, rightW, usedH]); y += usedH + gap; naturalUsed += usedH;
      }
    }
    return y - gap;
  };
  let start = TOP, end = await place(TOP, GAP);
  if (end > BOTTOM) throw new PageOverflow(`${page.id} 超出 ${end - BOTTOM}px`);
  // A page that does not fill the body sits in the middle of it, with the same space above and below.
  const leftover = BOTTOM - end;
  if (leftover >= 16) { start = TOP + Math.round(leftover / 2); end = await place(start, GAP); }

  // Whatever the layout, modules stay inside the body and never overlap.
  const placedBoxes = Object.entries(design).map(([z, { box }]) => ({ z, box }));
  for (const [i, a] of placedBoxes.entries()) {
    if (a.box[1] < TOP - 1 || a.box[1] + a.box[3] > BOTTOM + 1) throw new PageOverflow(`${page.id} 的 ${a.z} 超出正文区`);
    for (const b of placedBoxes.slice(i + 1)) if (a.box[0] < b.box[0] + b.box[2] && b.box[0] < a.box[0] + a.box[2] && a.box[1] < b.box[1] + b.box[3] && b.box[1] < a.box[1] + a.box[3]) throw new PageOverflow(`${page.id} 的 ${a.z} 和 ${b.z} 重叠`);
  }
  const intoFooter = elements.find((e) => Array.isArray(e.bounds) && e.bounds[1] + e.bounds[3] > BOTTOM + 2);
  if (intoFooter) throw new PageOverflow(`${page.id} 的 ${intoFooter.id} 伸进页脚`);

  // Title: a "X：结论" key line puts X in the eyebrow and the conclusion in the title.
  const raw = page.keyLine.text, colon = raw.indexOf('：'), hasPrefix = colon > 0 && colon <= 12 && !page.eyebrow, eyebrow = page.eyebrow || (hasPrefix ? raw.slice(0, colon) : ''), title = hasPrefix ? raw.slice(colon + 1) : raw;
  const firstClause = title.split('，')[0], focus = page.focus && title.includes(page.focus) ? page.focus : firstClause !== title ? firstClause : (title.match(/[\d.]+\s*[%％万元亿单个家张份人次]+/)?.[0] || title.slice(0, Math.min(8, Math.ceil(title.length / 2)))), at = title.indexOf(focus), runs = [title.slice(0, at) && { text: title.slice(0, at), style: { fontWeight: 600, color: p.ink } }, { text: focus, style: { fontWeight: 700, color: readableInk(p.accent, '#FFFFFF') } }, title.slice(at + focus.length) && { text: title.slice(at + focus.length), style: { fontWeight: 600, color: p.ink } }].filter(Boolean);
  const tagLabel = eyebrow || ROLE_TAG[page.role] || '', tagText = header === 'tag' && tagLabel ? `${tagLabel} | ${String(pageNo).padStart(2, '0')}` : '', tagStyle = theme.font(24, { fontWeight: 700, color: p.inverse, textAlign: 'center', lineHeight: 1.3 });
  const [tagSize] = tagText ? await measurer.texts([{ id: 'hdr', type: 'text', text: tagText, bounds: [0, 0, 1200, 40], style: tagStyle }]) : [{ naturalWidth: 0 }], tagW = tagText ? Math.ceil(tagSize.naturalWidth) + 48 : 0, titleX = L + (tagText ? tagW + 24 : 0), titleW = W - (titleX - L);
  const [wide] = await measurer.texts([{ id: 'title', type: 'text', text: title, bounds: [0, 0, 3000, 62], style: theme.roleStyle('pageTitle') }]);
  const fitted = Math.floor(44 * titleW / wide.naturalWidth);
  if (fitted < 38) throw new Error(`report-deck: ${page.id} 标题太长，请压缩到约 ${Math.floor(title.length * fitted / 38)} 字以内`);
  const titleStyle = theme.roleStyle('pageTitle', wide.naturalWidth > titleW ? { fontSize: fitted } : {});
  // Header: a solid tag beside the title (or an eyebrow above it), closed by a rule whose thick stretch shows how far through the deck this page is.
  const ruleY = 124, tone = readableInk(p.accent, '#FFFFFF'), titleY = header === 'tag' || !eyebrow ? 46 : 54;
  const chrome = [
    ...(tagText ? [{ id: 'hdr-tag', type: 'shape', bounds: [L, 50, tagW, 54], style: { fill: tone, radius: 0 } }, { id: 'eyebrow', type: 'text', text: tagText, bounds: [L, 60, tagW, 34], style: tagStyle }] : eyebrow ? [{ id: 'eyebrow', type: 'text', text: eyebrow, bounds: [L, 26, 1200, 30], style: theme.roleStyle('eyebrow', { color: p.muted }) }] : []),
    { id: 'title', type: 'text', text: title, bounds: [titleX, titleY, titleW, 62], style: titleStyle, runs },
    { id: 'hdr-rule', type: 'shape', bounds: [L, ruleY + 2, W, 2], style: { fill: p.line } },
    { id: 'hdr-progress', type: 'shape', bounds: [L, ruleY, Math.round(W * pageNo / total), 6], style: { fill: tone, radius: 3 } },
    { id: 'ftr-rule', type: 'shape', bounds: [L, 1024, W, 1], style: { fill: p.line } },
    ...(footer ? [{ id: 'src', type: 'text', text: `来源：${footer}`, bounds: [L, 1034, 1200, 30], style: theme.roleStyle('caption') }] : []),
    { id: 'no', type: 'text', text: `${String(pageNo).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, bounds: [W + L - 200, 1034, 200, 30], style: theme.roleStyle('caption', { textAlign: 'right', fontWeight: 700 }) }
  ];

  // Region contracts follow from what was placed.
  for (const [z, { m, box }] of Object.entries(design)) {
    plan.visualDecision.zones.find((v) => v.id === z).bounds = box;
    Object.assign(plan.regions.find((r) => r.zoneId === z), { ...(m.frame ? { frameElementId: m.frame } : { frameElementId: undefined, openGroup: true, padding: 0 }), typography: { title: Math.max(m.title || theme.roles.stepTitle.fontSize, theme.roles.body.fontSize), body: theme.roles.body.fontSize, ...(m.sizes ? { allowedSizes: m.sizes } : {}) }, module: { name: m.module, variant: m.variant }, designReference: { source: '原创', principle: m.reason }, representation: m.variant, reason: m.reason, bindings: m.bindings });
  }
  plan.typographyRoles = theme.roles;
  const basis = page.keyLine.from || `第 ${pageNo} 页标题`;
  if (page.keyLine.source === 'quoted') plan.keyLine.from = basis; else plan.keyLine.support = [basis];
  const firstStack = (rows.find((r) => r.left)?.left || rows.filter((r) => typeof r === 'string' && r !== 'photos' && !centred.has(r))).map((z) => (Array.isArray(z) ? z[0] : z));
  Object.assign(plan.visualDecision, { pattern: `free：${rows.map((r) => (typeof r === 'string' ? r : Array.isArray(r) ? r.join('+') : `[${r.left.join('>')}|${r.right}]`)).join(' / ')}`, focus: { elementId: 'title', text: focus }, layout: '模块按阅读顺序排列，同行等高，整体对齐页边' });
  plan.composition = firstStack.length > 1 ? { alignments: [{ edge: 'left', zones: firstStack }], gaps: firstStack.slice(1).map((to, i) => ({ axis: 'vertical', from: firstStack[i], to, min: 12 })) } : { alignments: [], gaps: [] };
  return { focusGuessed: !(page.focus && title.includes(page.focus)) && firstClause === title, fill: naturalUsed / (BOTTOM - TOP), blank: 1 - (end - start) / (BOTTOM - TOP), slide: { slideId: page.id, mode: 'composition', elements: [...chrome, ...elements] }, modules: Object.fromEntries(Object.entries(design).map(([z, { m }]) => [z, m.frame || m.bindings[0]?.elementIds[0]])) };
}

// The cover: a solid colour field with the deck name, the one sentence that says how the period went and up to three
// figures, beside a full-height photo when there is one. It carries no page number.
async function layoutCover({ page, plan, theme, measurer, deckTitle }) {
  const p = theme.palette, roles = colorRoles(p), fill = readableInk(roles.primary, '#FFFFFF'), photo = asList(page.photos)[0], panelW = photo ? 1180 : 1920, x = 96, w = panelW - 192, status = page.keyLine.text;
  const name = page.name || deckTitle || '', [nameSize] = await measurer.texts([{ id: 'n', type: 'text', text: name, bounds: [0, 0, 3000, 110], style: theme.font(84, { fontWeight: 800 }) }]), nameFont = Math.max(56, Math.min(photo ? 84 : 112, Math.floor(84 * w / Math.max(1, nameSize.naturalWidth))));
  const statusStyle = theme.font(photo ? 40 : 52, { fontWeight: 700, color: p.inverse, lineHeight: 1.45 }), [statusSize] = await measurer.texts([{ id: 's', type: 'text', text: status, bounds: [0, 0, w, 60], style: statusStyle }]);
  const focus = page.focus && status.includes(page.focus) ? page.focus : null, at = focus ? status.indexOf(focus) : -1, pop = readableInk(lighten(roles.secondary, 0.2), fill) === fill ? '#FFFFFF' : lighten(roles.secondary, 0.2);
  const runs = focus ? [status.slice(0, at) && { text: status.slice(0, at) }, { text: focus, style: { color: pop } }, status.slice(at + focus.length) && { text: status.slice(at + focus.length) }].filter(Boolean) : undefined;
  const elements = [{ id: 'cover-panel', type: 'shape', bounds: [0, 0, panelW, 1080], style: { fill } }], design = { cover: { m: { frame: null, module: 'coverPanel', variant: 'status', title: photo ? 40 : 52, reason: '封面先说清这一期的整体状态', bindings: [{ ref: `${page.id}:status`, elementIds: ['title'] }] }, box: photo ? [x, 96, w, 560] : [x, 96, w, 888] } };
  // Beside a photo the words hang from the top. Alone on the colour field, words and figures are one group centred on the page.
  // Cover figures hug their content like the figures inside the deck: the figure as large as the status sentence allows, each tile
  // only as wide as its words, the row starting under the status sentence. No filler icons (user decision 2026-11-10).
  const coverTiles = async (y) => {
    const items = asList(page.data).map(coverItem), n = items.length, gap = 16, ls = 20, unitOf = (s) => Math.max(20, Math.round(s * 0.32));
    const content = (s) => Math.max(...items.map((it) => Math.max(textWidth(it.label || '', ls), textWidth(it.note || '', ls), textWidth(String(it.value), s) + (it.unit ? textWidth(' ' + it.unit, unitOf(s)) : 0))));
    const widthAt = (s) => n * (Math.ceil(content(s)) + 72) + gap * (n - 1);
    // The status sentence must stay among the two largest sizes on the cover (key-line-not-prominent), so figures stop at its size.
    let size = statusStyle.fontSize; while (size > 40 && widthAt(size) > w) size -= 4;
    const common = { id: 'm', x, width: Math.min(w, widthAt(size)), size: 40, columns: n, gap, highlight: -1, fill: '#FFFFFF', theme, items };
    for (; size > 40; size -= 2) {
      const texts = metricTiles({ ...common, figureSize: size, y: 0 }).elements.filter((e) => e.type === 'text' && e.text), real = await measurer.texts(texts.map((e) => ({ ...e, bounds: [0, 0, 3000, e.bounds[3]] })));
      if (texts.every((e, i) => real[i].naturalWidth <= e.bounds[2])) break;
    }
    return metricTiles({ ...common, figureSize: size, y });
  };
  const figures = asList(page.data), tileH = figures.length && figures.length <= 3 ? (await coverTiles(0)).height : 0;
  const nameH = Math.ceil(nameFont * 1.3), eyebrowH = page.eyebrow ? 64 : 0, statusH = Math.ceil(statusSize.height), groupH = eyebrowH + nameH + 48 + statusH + (tileH ? 64 + tileH : 0), nameY = photo ? 176 : Math.round((1080 - groupH) / 2) + eyebrowH;
  if (page.eyebrow) elements.push({ id: 'cover-eyebrow', type: 'text', text: page.eyebrow, bounds: [x, photo ? 112 : nameY - 64, w, 40], style: theme.font(28, { fontWeight: 600, color: readableInk(lighten(roles.secondary, 0.3), fill) === fill ? '#FFFFFF' : lighten(roles.secondary, 0.3) }) });
  elements.push({ id: 'cover-name', type: 'text', text: name, bounds: [x, nameY, w, nameH], style: theme.font(nameFont, { fontWeight: 800, color: p.inverse, lineHeight: 1.25 }) });
  const statusY = nameY + nameH + 48;
  elements.push({ id: 'title', type: 'text', text: status, ...(runs ? { runs } : {}), bounds: [x, statusY, w, Math.ceil(statusSize.height)], style: statusStyle });
  const data = asList(page.data);
  if (data.length) {
    if (data.length > 3) throw new Error(`report-deck: ${page.id} 封面最多放 3 个数字`);
    const t = await coverTiles(0), ty = photo ? 1080 - 96 - t.height : statusY + statusH + 64, placed = await coverTiles(ty), tilesW = Math.max(...placed.elements.filter((e) => e.type === 'shape').map((e) => e.bounds[0] + e.bounds[2])) - x;
    if (statusY + statusSize.height > ty - 24) throw new PageOverflow(`${page.id} 封面状态句太长`);
    design.cover.box = photo ? [x, 96, w, ty - 24 - 96] : [x, nameY - eyebrowH, w, ty - 24 - (nameY - eyebrowH)]; elements.push(...placed.elements); design.metrics = { m: { frame: null, module: 'metricTiles', variant: `${data.length}-results`, title: placed.valueSize, sizes: [...new Set(placed.elements.filter((e) => /^m-value-\d+$/.test(e.id)).flatMap((e) => [e.style?.fontSize, ...(e.runs || []).map((r) => r.style?.fontSize)]).filter(Number.isFinite))], reason: '封面只放最关键的数字', bindings: data.map((d, i) => ({ ref: `${page.id}:data-${i + 1}`, elementIds: [`m-value-${i + 1}`, ...(d.target != null ? [`m-note-${i + 1}`] : [])] })) }, box: [x, ty, tilesW, placed.height] };
  }
  if (photo) { const g = photoGroup({ id: 'ph1', x: panelW, y: 0, width: 1920 - panelW, height: 1080, theme: { ...theme, radius: 0 }, images: [{ src: photo.src, alt: photo.caption || '' }] }); elements.push(...g.elements); design.photos = { m: { frame: null, module: 'photoGroup', variant: 'cover', title: theme.roles.caption.fontSize, reason: '封面主视觉', bindings: [{ ref: `${page.id}:photo-1`, elementIds: g.elements.filter((e) => e.type === 'image').map((e) => e.id) }] }, box: [panelW, 0, 1920 - panelW, 1080] }; }
  for (const [z, { m, box }] of Object.entries(design)) { plan.visualDecision.zones.find((v) => v.id === z).bounds = box; Object.assign(plan.regions.find((r) => r.zoneId === z), { ...(m.frame ? { frameElementId: m.frame } : { frameElementId: undefined, openGroup: true, padding: 0 }), typography: { title: Math.max(m.title, theme.roles.body.fontSize), body: theme.roles.body.fontSize }, module: { name: m.module, variant: m.variant }, designReference: { source: '原创', principle: m.reason }, representation: m.variant, reason: m.reason, bindings: m.bindings }); }
  plan.typographyRoles = theme.roles;
  const basis = page.keyLine.from || '封面状态句'; if (page.keyLine.source === 'quoted') plan.keyLine.from = basis; else plan.keyLine.support = [basis];
  Object.assign(plan.visualDecision, { pattern: '封面', focus: { elementId: 'title', ...(focus ? { text: focus } : {}) }, layout: ['整块主色放名称和状态句', data.length && (photo ? '数字压底' : '数字紧跟其后，整组上下居中'), photo && '主视觉照片占右侧'].filter(Boolean).join('，') });
  plan.composition = { alignments: [], gaps: [] };
  return { slide: { slideId: page.id, mode: 'composition', elements }, modules: Object.fromEntries(Object.entries(design).map(([z, { m }]) => [z, m.frame || m.bindings[0]?.elementIds[0]])) };
}

// Fills deck.slides and the contract fields of deck.contentPlan from the outline. palette: a report palette id or a palette object.
// Most pages use the dense scale; a page with little on it moves up to the roomy or hero one, because
// hierarchy ratios stay the same while size flexes with the amount of content.
// Returns { theme, scales, anchors, sparse }: anchors[pageId] gives an element id per zone for ruleChecklist evidence, and
// sparse lists pages still under 45% full, which should be merged or given more content rather than delivered as they are.
// loose lists pages whose placed content still leaves more than a quarter of the body empty above and below.
// focusGuessed lists pages whose title has no comma, so the accent was only a guess: set page.focus on them.
// header: 'tag' (solid tag beside the title, the default) or 'eyebrow' (small label above the title). Words like 定稿 are working labels, so the footer drops them.
// Which form a page's figure group takes (user decision 2026-11-11: pages must not all carry the same row of tiles).
// Three to five figures with no targets can be tiles or an anchored strip. The data picks first: a figure the outline
// marks, or the title names, has an answer to anchor, so the strip suits it; otherwise tiles. Then the deck: a page
// never repeats the form of the figure page before it. Targets keep their own target → actual forms.
export function figureForm(page, previous) {
  const data = asList(page.data);
  // The outline can fix the form (figureStyle: 'tiles' | 'strip'); a strip still needs a group it can carry.
  if (page.figureStyle === 'tiles') return 'tiles';
  if (data.length < 3 || data.length > 5 || data.some((d) => d.target != null)) return 'tiles';
  const title = String(page.keyLine?.text || '').replace(/\s/g, '');
  const anchored = data.some((d) => d.highlight) || data.some((d) => title.includes(`${d.value}${d.unit || ''}`.replace(/\s/g, '')));
  const preferred = anchored ? 'strip' : 'tiles';
  if (page.figureStyle === 'strip') return 'strip';
  return preferred === previous ? (preferred === 'strip' ? 'tiles' : 'strip') : preferred;
}

// Which form a page's item list takes. Three to five items can be a list or equal-width cards. The data picks first:
// items of about the same length are peers and read well side by side as cards; uneven or long items keep the list.
// Then the deck: a page never repeats the form of the item page before it. itemStyle in the outline fixes the form.
export function itemForm(page, previous) {
  const items = asList(page.items);
  // A card holds a number, a title and a sentence; items with no sentence would leave the cards mostly empty.
  if (page.itemStyle === 'list' || items.length < 3 || items.length > 5 || asList(page.photos).length || items.some((it) => !String(it.detail || '').trim())) return 'list';
  if (page.itemStyle === 'cards') return 'cards';
  const lengths = items.map((it) => String(it.title || '').length + String(it.detail || '').length);
  if (Math.max(...lengths) > 70) return 'list';
  const preferred = Math.max(...lengths) <= Math.min(...lengths) * 2.5 ? 'cards' : 'list';
  return preferred === previous ? (preferred === 'cards' ? 'list' : 'cards') : preferred;
}

// Line breaks the user ruled out (2026-11-11): a last line of four characters or fewer ("客户。", "上去。"), and a
// word cut across two lines ("转介/绍率"). The text box is narrowed a character at a time, up to a quarter of its width
// (half for a box up to 600px wide),
// until the break moves to a better place without adding a line; otherwise it stays as it was. Narrowing works the same
// in the HTML and in an exported PPTX, which wraps the text again by its own box width.
const wordCut = (() => {
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
  // The segmenter leaves a metric suffix on its own (转|介绍|率); in a report it belongs to the word before it (转介绍率).
  const SUFFIX = /^[率量额度数费价比值]$/, CJK = /^[\u4e00-\u9fff]+$/;
  const words = (text) => {
    const out = [];
    for (const w of segmenter.segment(text)) {
      const prev = out[out.length - 1];
      if (prev && SUFFIX.test(w.segment) && CJK.test(prev.segment)) prev.segment += w.segment;
      else out.push({ index: w.index, segment: w.segment, word: w.isWordLike });
    }
    return out;
  };
  return (text, breaks) => !!segmenter && asList(breaks).length > 0 && words(text).some((w) => w.word && CJK.test(w.segment) && w.segment.length >= 2 && breaks.some((b) => w.index < b && b < w.index + w.segment.length));
})();
const plainText = (e) => (e.runs?.length ? e.runs.map((r) => r.text ?? '').join('') : String(e.text ?? ''));
const SHORT_LAST_LINE = 4;
const badBreak = (m, text) => m.lines > 1 && (m.lastLineChars <= SHORT_LAST_LINE || wordCut(text, m.breaks));
// A line that ends on a pause (、，；：) reads best; among acceptable widths the first such one wins.
const atPause = (m, text) => asList(m.breaks).every((b) => /[，、；：。,;:]/.test(text.slice(0, b).trimEnd().slice(-1)));
export async function balanceLineBreaks(slides, measurer) {
  const texts = slides.flatMap((s) => asList(s.elements)).filter((e) => e.type === 'text' && Array.isArray(e.bounds) && plainText(e).length >= 8 && !plainText(e).includes('\n'));
  if (!texts.length || !measurer?.texts) return [];
  const first = await measurer.texts(texts.map((e) => ({ ...e, lastLine: true }))), fixed = [];
  for (const [i, e] of texts.entries()) {
    const text = plainText(e);
    if (!badBreak(first[i], text)) continue;
    const step = e.style?.fontSize || e.runs?.[0]?.style?.fontSize || 24, w0 = e.bounds[2], align = e.style?.textAlign;
    let pick = null;
    // A narrow box (a card, a cell) may halve: its right edge is ragged anyway. A wide band narrows by a quarter at most.
    for (let w = w0 - step, floor = w0 * (w0 <= 600 ? 0.5 : 0.75); w >= floor; w -= step) {
      const [m] = await measurer.texts([{ ...e, bounds: [e.bounds[0], e.bounds[1], w, e.bounds[3]], lastLine: true }]);
      if (m.lines !== first[i].lines) break;
      if (badBreak(m, text)) continue;
      if (!pick) pick = w;
      if (atPause(m, text)) { pick = w; break; }
    }
    if (pick == null) continue;
    e.bounds[0] += align === 'center' ? Math.round((w0 - pick) / 2) : align === 'right' ? w0 - pick : 0;
    e.bounds[2] = pick; fixed.push(e.id);
  }
  return fixed;
}

export async function composeReportDeck({ outline, deck, palette = 'blue-gold', measurer, footer: rawFooter, layouts = {}, header = 'tag', baseDir = process.cwd() }) {
  const footer = rawFooter && String(rawFooter).replace(/(定稿|终稿|初稿|修订)版?/g, '').replace(/\s*·\s*[^·]*规范\s*$/, '').replace(/[_\s]+/g, ' ').replace(/^[\s·\-]+|[\s·\-]+$/g, '').trim();
  const resolved = typeof palette === 'string' ? reportPalette(palette) : palette, plans = deck.contentPlan.slides;
  const dense = createTheme({ palette: resolved, roles: REPORT_ROLES }), comfy = createTheme({ palette: resolved, roles: REPORT_ROLES_COMFY }), roomy = createTheme({ palette: resolved, roles: REPORT_ROLES_ROOMY }), large = createTheme({ palette: resolved, roles: REPORT_ROLES_LARGE }), hero = createTheme({ palette: resolved, roles: REPORT_ROLES_HERO }), themes = { dense, comfy, roomy, large, hero };
  const slides = [], anchors = {}, scales = {}, sparse = [], loose = [], focusGuessed = [], rearranged = [];
  let lastForm = null, lastItems = null; const forms = [];
  const absolute = (raw) => (raw.photos ? { ...raw, photos: raw.photos.map((ph) => ({ ...ph, src: path.resolve(baseDir, ph.src) })) } : raw);
  const numbered = outline.pages.filter((p) => p.role !== 'cover').length; let pageNo = 0;
  for (const [i, rawPage] of outline.pages.entries()) {
    const raw = absolute(rawPage), plan = plans.find((s) => s.slideId === (raw.id || `p${i + 1}`)), page = { ...raw, id: plan.slideId };
    if (raw.role !== 'cover') { page.figureForm = figureForm(page, lastForm); page.itemForm = itemForm(page, lastItems); }
    if (page.role === 'cover') { const made = await layoutCover({ page, plan, theme: dense, measurer, deckTitle: outline.title }); slides.push(made.slide); anchors[plan.slideId] = made.modules; scales[plan.slideId] = 'cover'; continue; }
    pageNo++;
    const thisPage = pageNo;
    let chosen = layouts[plan.slideId];
    const attempt = (theme) => layoutPage({ page, plan, theme, measurer, layout: chosen, pageNo: thisPage, total: numbered, footer, header });
    let out;
    try { out = await attempt(dense); } catch (error) {
      if (!cannotFit(error)) throw error;
      const zoneIds = plan.visualDecision.zones.map((z) => z.id), options = chosen ? [] : layoutCandidates(page, zoneIds);
      let last = error;
      for (const option of options) { chosen = option; try { out = await attempt(dense); break; } catch (e) { if (!cannotFit(e)) throw e; last = e; out = undefined; } }
      // A strip or cards can be taller than the tiles or list they replace; when no arrangement fits, the page goes back.
      if (!out && ((page.figureForm === 'strip' && !page.figureStyle) || (page.itemForm === 'cards' && !page.itemStyle))) {
        if (!page.figureStyle) page.figureForm = 'tiles'; if (!page.itemStyle) page.itemForm = 'list'; chosen = layouts[plan.slideId];
        for (const option of [chosen, ...options]) { chosen = option; try { out = await attempt(dense); break; } catch (e) { if (!cannotFit(e)) throw e; last = e; out = undefined; } }
      }
      if (!out) throw new Error(`report-deck: 内容放不下（${last.message}${options.length ? `，已试 ${options.length + 1} 种排法` : '，手写的 layouts 排不下：去掉它让组版器自动排，或换一种排法'}），拆页或减少模块`);
      rearranged.push({ page: plan.slideId, layout: chosen });
    }
    // The page takes the largest type size its content fits, one step at a time; the hero size is only for pages with very little on them.
    const scaleUp = async (first) => {
      let current = first, scale = 'dense';
      for (const [name, below] of [['comfy', SCALE_UP_BELOW], ['roomy', SCALE_UP_BELOW], ['large', SCALE_UP_BELOW], ['hero', 0.62]]) {
        if (current.fill >= below) break;
        let next;
        try { next = await attempt(themes[name]); } catch (error) { if (!cannotFit(error)) throw error; }
        if (!next || next.fill > MAX_FILL) { current = await attempt(themes[scale]); break; }
        current = next; scale = name;
      }
      return { out: current, scale };
    };
    let best = { ...(await scaleUp(out)), layout: chosen };
    // Fitting is not enough: a page that fits with room to spare tries the nearest other arrangements and stops at the
    // first that fills the body. Natural height is compared, so stretched blocks do not count as content.
    if (!layouts[plan.slideId] && best.out.fill < FILL_TARGET) {
      const zoneIds = plan.visualDecision.zones.map((z) => z.id), base = chosen;
      for (const option of layoutCandidates(page, zoneIds, MAX_ALTERNATIVES)) {
        chosen = option;
        try {
          const tried = await scaleUp(await attempt(dense));
          if (tried.out.fill >= best.out.fill + MIN_FILL_GAIN) best = { ...tried, layout: option };
        } catch (error) { if (!cannotFit(error)) throw error; }
        if (best.out.fill >= FILL_TARGET) break;
      }
      chosen = best.layout;
      if (chosen !== base) rearranged.push({ page: plan.slideId, layout: chosen, reason: 'fill' });
      // layoutPage writes its result into the plan, so the winner runs last.
      best.out = await attempt(themes[best.scale]);
    }
    const { out: finished, scale } = best;
    slides.push(finished.slide); anchors[plan.slideId] = finished.modules; scales[plan.slideId] = scale;
    if (finished.focusGuessed) focusGuessed.push(plan.slideId);
    // What this page drew for its figures decides the next figure page's form; a page without a figure group changes nothing.
    const drew = finished.slide.elements.some((e) => e.id === 'm-anchor') ? 'strip' : finished.slide.elements.some((e) => /^m-tile-\d+$/.test(e.id)) ? 'tiles' : null;
    if (drew) { lastForm = drew; if (page.figureForm === 'strip' || drew === 'strip') forms.push({ page: plan.slideId, form: drew }); }
    const listed = finished.slide.elements.some((e) => e.id === 'acts-card-1') ? 'cards' : finished.slide.elements.some((e) => e.id === 'acts-badge-1') ? 'list' : null;
    if (listed) { lastItems = listed; if (page.itemForm === 'cards' || listed === 'cards') forms.push({ page: plan.slideId, items: listed }); }
    if (finished.fill < 0.45) sparse.push({ page: plan.slideId, fill: Math.round(finished.fill * 100) / 100 });
    if (finished.blank > LOOSE_BLANK) loose.push({ page: plan.slideId, blank: Math.round(finished.blank * 100) / 100 });
  }
  deck.slides = slides;
  const rewrapped = await balanceLineBreaks(slides, measurer);
  return { theme: dense, scales, anchors, sparse, loose, focusGuessed, rearranged, rewrapped, forms };
}

// Fills the deck-level statements a report needs, from what was actually placed: the through-line and a management-report
// rule checklist whose evidence points at real elements. It is a first draft: read each how against the finished pages.
export function draftDeckClaims({ deck, outline, palette = 'blue-gold', projectId }) {
  if (projectId) deck.requirements.projectId = projectId;
  const resolved = typeof palette === 'string' ? reportPalette(palette) : palette, named = resolved?.name || palette, colours = resolved?.palette || resolved || {}, slides = deck.slides;
  const find = (re) => { for (const s of slides) { const e = s.elements.find((x) => re.test(x.id || '')); if (e) return { slideId: s.slideId, elementIds: [e.id] }; } return null; };
  const parts = [[/-loop-up$/, '回流线表达循环'], [/-link-/, '箭头流程表达先后'], [/^pd-seg-1$/, '色带表达时间推进'], [/^cmp-side-1$/, '左右对照表达成对关系'], [/^cmp-tile-1$/, '前后数值成对表达变化'], [/^m-cp-after$/, '目标对实际成对比较'], [/-badge-1$/, '编号面板表达条目顺序'], [/-header-rule$/, '表格表达逐项对应']].map(([re, how]) => ({ hit: find(re), how })).filter((x) => x.hit);
  const modules = [[/^st-.*-bar$/, '色条标签模块'], [/-badge-1$/, '编号动作面板'], [/^(?:flow|chain)-\d+-panel$/, '流程面板'], [/^periods-panel$/, '时期色带面板'], [/-tile-1$/, '数字色块'], [/^m-cp-after$/, '目标对实际']].map(([re, how]) => ({ hit: find(re), how })).filter((x) => x.hit);
  // Each sentence below says only what this deck really has: a checklist that describes a comparison or a hero photo the deck lacks is a false claim.
  const has = (re) => Boolean(find(re)), hasSource = has(/^src$/), hasFigures = outline.pages.some((p) => asList(p.data).length || p.table?.rows?.length || asList(p.tables).length), parallel = has(/-tile-2$/) || has(/^pd-seg-2$/) || has(/^cmp-side-1$/);
  const secondaryUses = [has(/^cmp-side-1$/) && '对照的另一侧', has(/^pd-seg-2$/) && '时期色带的交替段', has(/^m-cp-before$/) && '目标一侧'].filter(Boolean), judged = outline.pages.some((p) => asList(p.statements).some((st) => st.tone === 'judgment' || (!st.tone && !st.asMetric && VERDICT.test(st.label || ''))));
  const scaleCount = new Set(deck.contentPlan.slides.map((s) => s.typographyRoles?.sectionTitle?.fontSize).filter(Boolean)).size;
  const first = slides[0], last = slides[slides.length - 1], titles = [{ slideId: first.slideId, elementIds: ['title'] }, ...(last === first ? [] : [{ slideId: last.slideId, elementIds: ['title'] }])], key = outline.pages[0].keyLine, basis = key.from || '第 1 页标题';
  deck.contentPlan.throughLine = { placements: [{ slideId: first.slideId, elementId: 'title' }], source: key.source, ...(key.source === 'quoted' ? { from: basis } : { support: [basis] }) };
  const ok = (how, evidence) => ({ status: 'applied', how, evidence });
  deck.contentPlan.ruleChecklist = { scenario: 'management-report', items: {
    'general#Requirements': ok('每页写明读者任务；只用用户材料，未补造事实' + (hasSource ? '；页脚标明来源' : ''), [{ slideId: first.slideId, elementIds: ['title', ...(first.elements.some((e) => e.id === 'src') ? ['src'] : [])] }]),
    'scenario#Clear and direct content; no empty talk': ok('每页标题陈述状态或结论' + (hasFigures ? '，数字沿用材料原值' : ''), titles),
    'scenario#Visualize information with structural diagrams': ok(parts.map((x) => x.how).join('，') || '按内容关系分区排列', parts.map((x) => x.hit).concat(parts.length ? [] : [titles[0]])),
    'scenario#Key Requirements': ok((modules.map((x) => x.how).join('、') || '模块') + '按 HS-01；' + (parallel ? '并列项等宽按 HS-02；' : '') + '其余层级靠字号、字重和细线', modules.map((x) => x.hit).concat(modules.length ? [] : [titles[0]])),
    'scenario#Visual References': ok((scaleCount > 1 ? '字阶随内容量取档且比例不变' : '全稿同一字阶') + '；结论固定在标题位' + (hasSource ? '，来源放页脚' : '') + '；圆角统一按 HS-03；' + (has(/^hdr-tag$/) ? '页头标签与进度线' : '页头进度线') + '作全稿母题', [{ slideId: first.slideId, elementIds: ['title'] }, find(/^hdr-progress$/)].filter(Boolean)),
    'scenario#Color Palette Reference': ok('用九组汇报配色的' + named + '：主色 ' + colours.primary + ' 承担页头、结构和重点，辅色 ' + colours.secondary + (secondaryUses.length ? ' 用于' + secondaryUses.join('、') : ' 本稿只作点缀') + (judged ? '，跳色 ' + colours.pop + ' 只给判断类结论' : '，跳色本稿未用') + '，按 HS-04', [find(/^hdr-progress$/) || { slideId: first.slideId, elementIds: ['title'] }])
  } };
  return deck.contentPlan.ruleChecklist;
}
