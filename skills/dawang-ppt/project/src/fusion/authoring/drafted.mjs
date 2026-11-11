// What the agent wrote on the user's say-so (用户授权补写) or expanded while laying out (制作者展开). The page itself never
// says so (user decision 2026-11-09: no 补写/建议/待验证 on a page). The user sees it in three places that never reach
// the screen in a presentation (user decision 2026-11-11): the editor's side panel when such an element is selected,
// the speaker notes of the exported PPTX, and the delivery reply. Pure functions: the editor loads this in the browser.

export const DRAFT_LOCATOR = '用户授权补写', EXPAND_LOCATOR = '制作者展开';
const asList = (value) => (Array.isArray(value) ? value : []);

// One entry per drafted fact, with the page it is on and the elements that show it.
export function draftedContent(project) {
  const plan = project?.contentPlan || {}, slides = asList(plan.slides);
  const pageOf = (ref) => slides.find((s) => asList(s.requiredRefs).includes(ref))?.slideId || null;
  const shownBy = (ref) => [...new Set(slides.flatMap((s) => asList(s.regions).flatMap((r) => asList(r.bindings)).filter((b) => b?.ref === ref).flatMap((b) => asList(b.elementIds))))];
  return Object.entries(plan.nodes && !Array.isArray(plan.nodes) ? plan.nodes : {})
    .map(([ref, n]) => [ref, n, asList(n?.sourceLocations).find((l) => [DRAFT_LOCATOR, EXPAND_LOCATOR].includes(l?.locator))])
    .filter(([, n, source]) => n?.status === 'estimated' && source)
    .map(([ref, n, source]) => ({ page: pageOf(ref), ref, text: n.text, kind: source.locator === EXPAND_LOCATOR ? 'expanded' : 'drafted', placeholder: /XX/.test(n.text || ''), elementIds: shownBy(ref) }));
}

export const draftedOn = (project, slideId) => draftedContent(project).filter((d) => d.page === slideId);
export const draftedShownBy = (project, slideId, elementId) => draftedOn(project, slideId).filter((d) => d.elementIds.includes(elementId));

// The speaker notes for one page: what the author wrote there, then what to check before presenting.
export function slideNotes(project, slideId) {
  const own = asList(project?.slides).find((s) => s.slideId === slideId)?.notes, items = draftedOn(project, slideId);
  const list = (kind, head) => { const xs = items.filter((d) => d.kind === kind); return xs.length ? [head, ...xs.map((d) => `· ${d.text}${d.placeholder ? '（XX 处填实际数字）' : ''}`)] : []; };
  const check = [...list('drafted', '【模型补写，请核对】'), ...list('expanded', '【制作时展开，请核对】')];
  return [typeof own === 'string' ? own.trim() : '', check.join('\n')].filter(Boolean).join('\n\n');
}
