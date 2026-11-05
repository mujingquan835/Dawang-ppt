import { materializeElements } from '../scene/model.mjs';
import { resolveSlideStyle } from '../styles/registry.mjs';
import { lintLayout } from './layout-lint.mjs';
import { lintComposition } from './composition-lint.mjs';

// Visual decisions record the design the agent committed to before laying out a page: which words carry the
// page (focus), and how the main visual and evidence share the space (layout). The check only proves the record
// reached the slide — the focus is visibly set apart from its lead-in — and never scores taste. Reading the
// visual rules is not evidence they were applied; this is the hook that makes a skipped decision visible.
export const VISUAL_CONTRACT = 'visual-decisions-v2';
// v2 adds zones: the page is divided before elements are placed. v1 decks keep the v1 checks.
const STRICT_CONTRACTS = new Set(['visual-decisions-v1', VISUAL_CONTRACT]);
const ZONE_ROLES = new Set(['focus', 'evidence', 'support', 'flow', 'data', 'note', 'media']);
const area = ([, , w, h]) => w * h;
const overlap = (a, b) => Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
const validBounds = (b) => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[2] > 0 && b[3] > 0 && b[0] >= 0 && b[1] >= 0 && b[0] + b[2] <= 1920 && b[1] + b[3] <= 1080;

// Zones must be valid, must not overlap, and every text or image between the first zone's top and the last zone's
// bottom must sit (by its centre) in some zone. Header and footer above or below all zones are page chrome.
function checkZones(zones, elements, where, report, warn) {
  if (!Array.isArray(zones) || !zones.length) { report({ kind: 'visual-zones-missing', ...where, need: 'visualDecision.zones:[{id,role,bounds}]' }); return; }
  const bad = zones.filter((z) => !z?.id || !ZONE_ROLES.has(z.role) || !validBounds(z.bounds));
  if (bad.length) { report({ kind: 'visual-zone-invalid', ...where, zones: bad.map((z) => z?.id ?? null), roles: [...ZONE_ROLES] }); return; }
  for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
    const o = overlap(zones[i].bounds, zones[j].bounds);
    if (o > 0.01 * Math.min(area(zones[i].bounds), area(zones[j].bounds))) report({ kind: 'visual-zones-overlap', ...where, zones: [zones[i].id, zones[j].id] });
  }
  const top = Math.min(...zones.map((z) => z.bounds[1])), bottom = Math.max(...zones.map((z) => z.bounds[1] + z.bounds[3]));
  const outside = elements.filter((e) => (e.type === 'text' || e.type === 'image') && Array.isArray(e.bounds)).filter((e) => {
    const [x, y, w, h] = e.bounds;
    if (y + h <= top + 4 || y >= bottom - 4) return false;
    const cx = x + w / 2, cy = y + h / 2;
    return !zones.some(({ bounds: [zx, zy, zw, zh] }) => cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh);
  });
  if (outside.length) report({ kind: 'visual-element-outside-zones', ...where, elementIds: outside.slice(0, 12).map((e) => e.id), count: outside.length });
  // A large empty block inside a zone reads as a hole in the page (a wireframe shows it; this says it). The zone is
  // cut into a 16×10 grid; cells touched by text or images (with a 24px margin) are filled; background panels do
  // not count; zones under 300px tall are skipped. If the biggest all-empty rectangle of cells covers over 15% of the zone, warn.
  for (const z of zones) {
    const [zx, zy, zw, zh] = z.bounds, C = 16, R = 10, cw = zw / C, ch = zh / R;
    // Thin bands (headings, metric rows) are uneven by nature; only a hole in a large area reads as missing content.
    if (zh < 300) continue;
    const content = elements.filter((e) => (e.type === 'text' || e.type === 'image') && Array.isArray(e.bounds));
    const filled = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => content.some(({ bounds: [x, y, w, h] }) =>
      x - 24 < zx + (c + 1) * cw && x + w + 24 > zx + c * cw && y - 24 < zy + (r + 1) * ch && y + h + 24 > zy + r * ch)));
    let best = 0;
    for (let r0 = 0; r0 < R; r0++) for (let c0 = 0; c0 < C; c0++) for (let r1 = r0; r1 < R; r1++) for (let c1 = c0; c1 < C; c1++) {
      if ((r1 - r0 + 1) * (c1 - c0 + 1) <= best) continue;
      let empty = true;
      for (let r = r0; r <= r1 && empty; r++) for (let c = c0; c <= c1 && empty; c++) if (filled[r][c]) empty = false;
      if (empty) best = (r1 - r0 + 1) * (c1 - c0 + 1);
    }
    if (best / (C * R) > 0.15) warn({ kind: 'visual-zone-sparse', ...where, zone: z.id, emptyShare: +(best / (C * R)).toFixed(2), hint: '区域内有大块空白：放大主体、收窄区域或重新分配版面' });
  }
}
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const STYLE_KEYS = ['fontSize', 'fontWeight', 'color', 'fontFamily'];
const look = (style, base) => STYLE_KEYS.map((key) => String(style?.[key] ?? base?.[key] ?? '').toLowerCase()).join('|');
const sizeOf = (element, style) => Math.max(element.style?.fontSize || style.typography.sizes.body, ...(element.runs || []).map((run) => run.style?.fontSize || 0));

// Runs that overlap the focus span must look different from the runs outside it.
function focusRunsDistinct(element, focusText) {
  const runs = element.runs || [], text = runs.map((run) => run.text ?? '').join('');
  const at = text.indexOf(focusText);
  if (at < 0) return false;
  const inside = new Set(), outside = new Set();
  let pos = 0;
  for (const run of runs) {
    const start = pos, end = pos + String(run.text ?? '').length; pos = end;
    if (start === end) continue;
    (start < at + focusText.length && end > at ? inside : outside).add(look(run.style, element.style));
  }
  return outside.size > 0 && [...inside].every((key) => !outside.has(key));
}

// Composition fingerprint: where the focus sits and which elements own the canvas. Coarse on purpose.
function signature(slide, project, focusId) {
  const elements = materializeElements(slide, project), grid = (n) => Math.round((n || 0) / 160);
  const focus = elements.find((e) => e.id === focusId) || elements.find((e) => e.type === 'text');
  const large = elements.filter((e) => Array.isArray(e.bounds) && e.bounds[2] * e.bounds[3] >= 1920 * 1080 * 0.12).map((e) => e.type).sort();
  return JSON.stringify([focus?.bounds?.slice(0, 3).map(grid), large]);
}

// The page title: the topmost of the large texts. A whole-title focus on every page means no page chose its own focus.
function titleOf(texts, style) {
  const top = Math.max(...texts.map((e) => sizeOf(e, style)));
  return texts.filter((e) => sizeOf(e, style) >= top * 0.6).sort((a, b) => (a.bounds?.[1] ?? 0) - (b.bounds?.[1] ?? 0))[0];
}
// Photos embedded as data URIs bypass the media ledger and are copied into every revision; small inline icons are fine.
const INLINE_LIMIT = 64 * 1024;
const REPORT_COMPONENTS = new Set(['answerBlock', 'comparePair', 'contrastPair', 'periodBand', 'kpiStrip', 'metricTiles', 'highlightTile', 'sidePanel']);
const PLAIN = new Set(['text', 'line']);

export function reviewVisualDecisions(project) {
  const contract = project.requirements?.visualContract, strict = STRICT_CONTRACTS.has(contract), zonesRequired = contract === VISUAL_CONTRACT, issues = [], warnings = [];
  // New authored decks are blocked; older projects only see warnings, so existing work keeps publishing.
  const report = (record) => (strict ? issues : warnings).push(record);
  const plan = project.contentPlan || {}, state = project.editorState || {};
  const hidden = new Set([...(state.deletedSlides || []), ...(state.skippedSlides || [])]);
  const slides = (state.slideOrder || project.slides.map((s) => s.slideId)).map((id) => project.slides.find((s) => s.slideId === id))
    .filter((s) => s && !hidden.has(s.slideId) && s.mode === 'composition' && s.authoring);
  const review = { slides: [] }, signatures = [], titleFocus = [];

  for (const slide of slides) {
    const where = { slideId: slide.slideId }, decision = plan.slides?.find((s) => s.slideId === slide.slideId)?.visualDecision;
    const all = materializeElements(slide, project);
    for (const w of lintLayout(all)) warnings.push({ ...w, ...where });
    // User-ruled composition defects: blocked on new decks, warned on older ones.
    for (const w of lintComposition(all)) report({ ...w, ...where });
    for (const e of all) {
      if (e.type === 'image' && typeof e.src === 'string' && e.src.startsWith('data:') && e.src.length > INLINE_LIMIT) {
        report({ kind: 'image-inline-src', ...where, elementId: e.id, kb: Math.round(e.src.length / 1024), need: 'media.entries 登记 {mediaId,src}，元素写 mediaRef' });
      }
    }
    // Only text and hairlines: hierarchy has nothing but type size to work with. Warned, not blocked; some pages are text by nature.
    if (all.length && all.every((e) => PLAIN.has(e.type)) && !decision?.waived) warnings.push({ kind: 'visual-text-only', ...where, hint: '只有文字和细线：考虑尺度对比、结构图、证据画面、视觉母题或色面分区（见 Dawang补充做法）' });
    if (!decision) { report({ kind: 'visual-decision-missing', ...where }); continue; }
    if (typeof decision === 'string') { report({ kind: 'visual-decision-unstructured', ...where, need: 'focus.elementId, layout' }); continue; }
    if (nonempty(decision.waived)) { review.slides.push({ ...where, waived: decision.waived }); continue; }
    if (!nonempty(decision.layout)) report({ kind: 'visual-decision-layout-missing', ...where });
    const texts = materializeElements(slide, project).filter((e) => e.type === 'text' && String(e.text ?? '').trim());
    const element = texts.find((e) => e.id === decision.focus?.elementId);
    if (!element) { report({ kind: 'visual-focus-element-missing', ...where, elementId: decision.focus?.elementId }); continue; }
    const whole = String(element.text).trim(), focusText = nonempty(decision.focus.text) ? decision.focus.text.trim() : whole;
    // Wording edited after the decision (patch or editor) only warns; the record is stale, the page is not wrong.
    if (!whole.includes(focusText)) { warnings.push({ kind: 'visual-focus-text-stale', ...where, elementId: element.id, focus: focusText, text: whole }); continue; }
    if (focusText !== whole) {
      // Focus is part of a sentence: it needs its own run style, not one uniform title box.
      if (!focusRunsDistinct(element, focusText)) report({ kind: 'visual-focus-not-distinct', ...where, elementId: element.id, focus: focusText, text: whole });
    } else {
      // Focus is its own element: it should be the first thing read on the page.
      const style = resolveSlideStyle(slide, project), top = Math.max(...texts.map((e) => sizeOf(e, style)));
      if (sizeOf(element, style) < top) report({ kind: 'visual-focus-not-leading', ...where, elementId: element.id, fontSize: sizeOf(element, style), topSize: top });
      if (titleOf(texts, style)?.id === element.id) titleFocus.push(slide.slideId);
    }
    if (zonesRequired) checkZones(decision.zones, all, where, report, (w) => warnings.push(w));
    // A photo much smaller than its zone in both directions was shrunk instead of framed (user rule: frame, then crop).
    // Judged per zone on the photos together, so a mosaic that fills its zone passes.
    if (zonesRequired && Array.isArray(decision.zones)) for (const z of decision.zones) {
      const [zx, zy, zw, zh] = z.bounds, photos = all.filter((x) => x.type === 'image' && x.bounds[2] * x.bounds[3] > 40000 && (() => { const cx = x.bounds[0] + x.bounds[2] / 2, cy = x.bounds[1] + x.bounds[3] / 2; return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh; })());
      if (!photos.length) continue;
      const w = Math.max(...photos.map((x) => x.bounds[0] + x.bounds[2])) - Math.min(...photos.map((x) => x.bounds[0])), h = Math.max(...photos.map((x) => x.bounds[1] + x.bounds[3])) - Math.min(...photos.map((x) => x.bounds[1]));
      if (w < 0.7 * zw && h < 0.7 * zh) report({ kind: 'image-small-in-zone', ...where, elementIds: photos.map((x) => x.id), zone: z.id, hint: '图片明显小于所在分区：按分区画框，用 imageFrames 裁切填满' });
    }
    // The page type the page started from, or free with the reason: the report page types are meant to be used.
    // In a report deck a freely composed page is still carried by at least one report component (answer block,
    // compare pair, contrast pair, period band, KPI strip, metric tiles, side panel). Cover, contents and divider
    // pages use waived; anything else the user decides is recorded in requirements.userDecisions.
    if (zonesRequired && project.requirements?.scope && nonempty(decision.pattern) && /^free/i.test(decision.pattern.trim()) && !all.some((e) => REPORT_COMPONENTS.has(e.component))) report({ kind: 'report-component-missing', ...where, need: '汇报稿的自由页用 answerBlock / comparePair / contrastPair / periodBand / kpiStrip / metricTiles / sidePanel 之一承载；封面、目录、章节页写 waived；用户决定不用的写进 requirements.userDecisions' });
    if (zonesRequired && !nonempty(decision.pattern)) report({ kind: 'visual-pattern-missing', ...where, need: 'visualDecision.pattern：所用页型名（targetVsActual、contrastColumns、listWithPhotos…），或“free：为什么不用 outline:check 建议的页型”' });
    review.slides.push({ ...where, focus: focusText, layout: decision.layout, ...(decision.pattern ? { pattern: decision.pattern } : {}), ...(decision.zones ? { zones: decision.zones.map((z) => `${z.id}:${z.role}`) } : {}) });
    signatures.push({ slideId: slide.slideId, sig: signature(slide, project, element.id) });
  }

  const decided = review.slides.filter((s) => !s.waived).length;
  if (decided >= 2 && titleFocus.length === decided) {
    report({ kind: 'visual-focus-all-titles', slideIds: titleFocus, need: '至少一页选标题以外的重点（大数字、关键词、结构图节点），或用 focus.text 指定标题中用 runs 区分的一段' });
  }
  const waived = review.slides.filter((s) => s.waived).length;
  if (slides.length >= 3 && waived * 2 > slides.length) warnings.push({ kind: 'visual-decisions-mostly-waived', waived, total: slides.length });
  if (signatures.length >= 3 && new Set(signatures.map((s) => s.sig)).size === 1) {
    warnings.push({ kind: 'visual-layout-repeated', slideIds: signatures.map((s) => s.slideId), hint: '各页焦点位置与主体区域相同；确认是内容决定，而不是回到惯常顶栏构图' });
  }
  return { issues, warnings, review, strict };
}
