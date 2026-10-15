import { clone, revision } from "./schema.mjs";
const baseState = (slides) => ({ slideOrder: slides.map((s) => s.slideId), text: {}, props: {}, media: {}, skippedSlides: [], deletedSlides: [], duplicatedSlides: [] });
function importGoal(goal, embeddedState = null) {
  if (!Array.isArray(goal?.slides) || !goal.slides.length) throw new Error("Explicit composed slides required; use existing composeDeck for draft goals");
  const slides = goal.slides.map((s, i) => ({ ...clone(s), slideId: s.slideId || s.id || `${s.layout}-${i + 1}`, id: void 0, mode: s.mode || "template", props: clone(s.props || {}), contentBindings: clone(s.contentBindings || {}), mediaBindings: clone(s.mediaBindings || {}) }));
  const topState = Object.fromEntries(["text", "props", "media", "typography", "slideOrder", "skippedSlides", "deletedSlides", "duplicatedSlides"].filter((k) => goal[k] !== void 0).map((k) => [k, clone(goal[k])]));
  const state = { ...baseState(slides), ...topState, ...clone(goal.state || {}), ...clone(embeddedState || {}) };
  const project = { version: 2, requirements: { projectId: revision(), title: goal.title || "Dawang-PPT", audience: goal.audience || "", purpose: goal.goal || "", requiredMedia: [] }, sources: { entries: [{ sourceId: "goal", kind: "input", source: "goal.json" }], userEdits: [] }, media: { entries: [] }, contentPlan: { audience: goal.audience || "", purpose: goal.goal || "", scenario: goal.scenario || "management", nodes: {}, slides: slides.map((s) => ({ slideId: s.slideId, readerTask: s.readerTask || "", relation: s.relation || "", requiredContentRefs: [] })) }, designChoice: { styleId: goal.styleId || `legacy/${goal.themePack || "theme13"}`, originalTemplate: true }, slides, editorState: { legacy: state, slideOrder: state.slideOrder, skippedSlides: state.skippedSlides, deletedSlides: state.deletedSlides, overrides: {}, history: [], redo: [] }, revision: revision() };
  return mergeEditorState(project, state, { bump: false });
}
function mergeEditorState(project, state, { bump = true } = {}) {
  const p = clone(project);
  p.editorState.legacy = clone(state);
  for (const k of ["slideOrder", "skippedSlides", "deletedSlides"]) p.editorState[k] = clone(state[k] || []);
  for (const record of state.duplicatedSlides || []) {
    const id = record.copyId || record.id || record.slideId;
    if (!id) throw new Error("Duplicated slide missing id");
    if (!p.slides.some((s) => s.slideId === id)) {
      const source = p.slides.find((s) => s.slideId === record.sourceId);
      if (!source) throw new Error("Duplicated slide source missing");
      p.slides.push({ ...clone(source), slideId: id, key: record.copyKey || record.key || record.slideKey || id });
    }
  }
  for (const s of p.slides) if (s.mode === "template" && state.props?.[s.slideId]) s.props = mergeSparse(s.props, state.props[s.slideId]);
  if (bump) p.revision = revision();
  return p;
}
function mergeSparse(a, b) {
  if (Array.isArray(b)) return b.map((v, i) => typeof v === "object" && v !== null ? mergeSparse(a?.[i], v) : v);
  if (b && typeof b === "object") return Object.fromEntries(Object.entries({ ...a, ...b }).map(([k, v]) => [k, k in b ? mergeSparse(a?.[k], b[k]) : v]));
  return b;
}
export {
  importGoal,
  mergeEditorState
};
