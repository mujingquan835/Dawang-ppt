import { materializeElements } from "../scene/model.mjs";
function checkCoverage(project) {
  const issues = [], hidden = /* @__PURE__ */ new Set([...project.editorState.deletedSlides || [], ...project.editorState.skippedSlides || []]), visible = project.slides.filter((s) => !hidden.has(s.slideId)), fixed = project.requirements.fixedPageCount;
  if (fixed && visible.length !== fixed) issues.push({ kind: "page-count", expected: fixed, actual: visible.length });
  const allImages = [];
  for (const slide of visible) {
    if (slide.mode !== "composition") continue;
    const elements = materializeElements(slide, project), texts = elements.filter((e) => e.type === "text").map((e) => e.text).join("\n");
    for (const ref of slide.requiredContentRefs || []) {
      const node = project.contentPlan.nodes[ref];
      if (!node) issues.push({ kind: "missing-content-ref", slideId: slide.slideId, ref });
      else if (node.text !== void 0 && !texts.includes(String(node.text))) issues.push({ kind: "unrendered-required-content", slideId: slide.slideId, ref });
    }
    for (const e of elements) if (e.type === "image") {
      allImages.push(e);
      if (!e.src) issues.push({ kind: "missing-media-reference", slideId: slide.slideId, id: e.id, mediaRef: e.mediaRef });
    }
  }
  for (const required of project.requirements.requiredMedia || []) {
    const id = typeof required === "string" ? required : required.mediaId;
    if (!allImages.some((e) => e.mediaRef === id || e.mediaId === id || e.id.endsWith("/" + id) || e.src === id) && !visible.some((s) => JSON.stringify(s.mediaBindings || {}).includes(id))) issues.push({ kind: "required-media-not-rendered", mediaId: id });
  }
  return issues;
}
export {
  checkCoverage
};
