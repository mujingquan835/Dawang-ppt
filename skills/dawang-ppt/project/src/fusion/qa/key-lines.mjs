import { materializeElements } from '../scene/model.mjs';
import { resolveSlideStyle } from '../styles/registry.mjs';

// Key lines record the content decision the agent made: one positioning line for the deck (throughLine), one
// key line per page (keyLine), and material lines meant only for the author (authorNotes). Both lines point at a
// real text element, so later wording edits cannot drift from the record. Wording quality is never scored here.
export const CONTENT_CONTRACT = 'key-lines-v1';
const SOURCES = new Set(['quoted', 'distilled', 'created']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const norm = (text) => String(text ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const bigrams = (text) => { const s = [...norm(text)], out = []; for (let i = 0; i < s.length - 1; i++) out.push(s[i] + s[i + 1]); return out; };

// Share of the note's character pairs found in the text: catches rewordings like 是示意 → 为示意.
export function noteShare(note, text) {
  const wanted = bigrams(note);
  if (!wanted.length) return 0;
  const pool = new Map();
  for (const pair of bigrams(text)) pool.set(pair, (pool.get(pair) || 0) + 1);
  let hit = 0;
  for (const pair of wanted) { const n = pool.get(pair); if (n) { hit++; pool.set(pair, n - 1); } }
  return hit / wanted.length;
}

const sizeOf = (element, style) => Math.max(element.style?.fontSize || style.typography.sizes.body, ...(element.runs || []).map((run) => run.style?.fontSize || 0));

export function reviewKeyLines(project) {
  const strict = project.requirements?.contentContract === CONTENT_CONTRACT, issues = [], warnings = [];
  // New authored decks are blocked; older projects only see warnings, so existing work keeps publishing.
  const report = (record) => (strict ? issues : warnings).push(record);
  const plan = project.contentPlan || {}, state = project.editorState || {};
  const hidden = new Set([...(state.deletedSlides || []), ...(state.skippedSlides || [])]);
  const slides = (state.slideOrder || project.slides.map((s) => s.slideId)).map((id) => project.slides.find((s) => s.slideId === id))
    .filter((s) => s && !hidden.has(s.slideId) && s.mode === 'composition' && s.authoring);
  const review = { throughLine: null, keyLines: [], created: [], authorNotes: (plan.authorNotes || []).length };
  if (!slides.length) return { issues, warnings, review, strict };
  const textsOf = new Map(slides.map((slide) => [slide.slideId, materializeElements(slide, project).filter((e) => e.type === 'text' && String(e.text ?? '').trim())]));
  const basis = (line, where) => {
    if (!SOURCES.has(line.source)) report({ kind: 'key-line-source-invalid', ...where, source: line.source });
    else if (line.source === 'quoted' && !nonempty(line.from)) report({ kind: 'key-line-basis-missing', ...where, need: 'from' });
    else if (line.source !== 'quoted' && !(Array.isArray(line.support) && line.support.some(nonempty))) report({ kind: 'key-line-basis-missing', ...where, need: 'support' });
  };

  for (const slide of slides) {
    const where = { slideId: slide.slideId }, line = plan.slides?.find((s) => s.slideId === slide.slideId)?.keyLine;
    if (!line) { report({ kind: 'key-line-missing', ...where }); continue; }
    if (nonempty(line.waived)) { review.keyLines.push({ ...where, waived: line.waived }); continue; }
    const texts = textsOf.get(slide.slideId), element = texts.find((e) => e.id === line.elementId);
    if (!element) { report({ kind: 'key-line-element-missing', ...where, elementId: line.elementId }); continue; }
    basis(line, { ...where, elementId: element.id });
    const style = resolveSlideStyle(slide, project), size = sizeOf(element, style);
    const levels = [...new Set(texts.map((e) => sizeOf(e, style)))].sort((a, b) => b - a);
    if (levels.indexOf(size) > 1) report({ kind: 'key-line-not-prominent', ...where, elementId: element.id, fontSize: size, topLevels: levels.slice(0, 2) });
    const text = String(element.text).trim();
    if ([...norm(text)].length > 40) warnings.push({ kind: 'key-line-long', ...where, elementId: element.id, length: [...norm(text)].length });
    review.keyLines.push({ ...where, elementId: element.id, text, source: line.source });
    if (line.source === 'created') review.created.push({ ...where, text, support: line.support });
  }

  const through = plan.throughLine;
  if (!through) report({ kind: 'through-line-missing' });
  else {
    const ends = new Set([slides[0].slideId, slides.at(-1).slideId]);
    const placed = (Array.isArray(through.placements) ? through.placements : [])
      .map((p) => ({ ...p, element: textsOf.get(p?.slideId)?.find((e) => e.id === p.elementId) })).filter((p) => p.element);
    basis(through, { line: 'throughLine' });
    if (!placed.some((p) => ends.has(p.slideId))) report({ kind: 'through-line-not-at-ends', placements: through.placements || [], expected: [...ends] });
    if (placed.length) {
      review.throughLine = { text: String(placed[0].element.text).trim(), source: through.source, placements: placed.map(({ slideId, elementId }) => ({ slideId, elementId })) };
      if (through.source === 'created') review.created.unshift({ line: 'throughLine', text: review.throughLine.text, support: through.support });
    }
  }

  for (const note of plan.authorNotes || []) {
    const text = typeof note === 'string' ? note : note?.text;
    if ([...norm(text)].length < 6) continue;
    for (const slide of slides) for (const element of textsOf.get(slide.slideId)) {
      const share = noteShare(text, element.text);
      if (share >= 0.6) report({ kind: 'author-note-on-slide', slideId: slide.slideId, elementId: element.id, note: text, share: Math.round(share * 100) / 100 });
    }
  }
  return { issues, warnings, review, strict };
}
