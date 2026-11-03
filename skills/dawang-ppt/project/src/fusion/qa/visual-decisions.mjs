import { materializeElements } from '../scene/model.mjs';
import { resolveSlideStyle } from '../styles/registry.mjs';

// Visual decisions record the design the agent committed to before laying out a page: which words carry the
// page (focus), and how the main visual and evidence share the space (layout). The check only proves the record
// reached the slide — the focus is visibly set apart from its lead-in — and never scores taste. Reading the
// visual rules is not evidence they were applied; this is the hook that makes a skipped decision visible.
export const VISUAL_CONTRACT = 'visual-decisions-v1';
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
const PLAIN = new Set(['text', 'line']);

export function reviewVisualDecisions(project) {
  const strict = project.requirements?.visualContract === VISUAL_CONTRACT, issues = [], warnings = [];
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
    review.slides.push({ ...where, focus: focusText, layout: decision.layout });
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
