import { runsText, runsToHtml } from '../authoring/text-runs.mjs';
import { deriveSlideElements } from "../objects/index.mjs";
import { resolveStyle, resolveSlideStyle } from "../styles/registry.mjs";
function materializeElements(slide, project) {
  return deriveSlideElements(slide, resolveSlideStyle(slide, project)).map((e) => ({ ...e, text: e.runs ? runsText(e.runs) : e.contentRef ? project?.contentPlan.nodes[e.contentRef]?.text ?? e.text : e.text, src: e.mediaRef ? project?.media.entries.find((m) => m.mediaId === e.mediaRef)?.src ?? e.src : e.src }));
}
function syncCompositionTextState(project) {
  const state = project.editorState.legacy;
  state.text = state.text || {};
  const escape = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>");
  for (const s of project.slides) {
    if (s.mode !== "composition") continue;
    const key = s.key || s.slideId;
    for (const e of materializeElements(s, project)) if (e.type === "text") state.text[`text:${key}:fusion-${e.id}`] = e.runs ? runsToHtml(e.runs) : escape(e.text);
  }
  return project;
}
export {
  materializeElements,
  syncCompositionTextState
};
