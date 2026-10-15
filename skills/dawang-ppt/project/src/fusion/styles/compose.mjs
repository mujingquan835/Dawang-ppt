import { planSlide } from "../planning/plan-slide.mjs";
import { assignElementRoles } from "../project/roles.mjs";
import { composeFrame } from "./frame-presets.mjs";
import { applyPageType } from "./page-presets.mjs";
import { bindElementAppearance, geometryTokens } from "./appearance.mjs";
function composeContentSlide(content, style) {
  const id = content.slideId || crypto.randomUUID(), kind = content.kind || planSlide(content, style).objectKind;
  if (!kind) throw new Error("Content relationship required");
  const { elements, bounds, sourceAdaptation } = composeFrame(content, style, kind);
  const data = structuredClone(content.data || {});
  if (kind === "images") {
    data.arrangement = data.arrangement || "single";
    if (style.media.photoShape === "ellipse") data.images = data.images.map((image) => ({ ...image, clipShape: image.kind === "screenshot" ? void 0 : "ellipse" }));
  }
  const object = { objectId: id + "-primary", kind, bounds, data, nodeIds: (data.nodes || data.series || []).map((n) => n.nodeId), ...content.relationships !== void 0 ? { relationships: structuredClone(content.relationships), relationshipPolicy: "explicit" } : { relationshipPolicy: "sequence" }, overrides: {} };
  const composed = applyPageType({ slideId: id, mode: "composition", styleId: style.id, compositionId: kind === "images" ? style.layout.imageComposition : style.layout.composition, label: content.title, sourceAdaptation, elements, objects: [object], readerTask: content.readerTask, requiredContentRefs: content.requiredContentRefs || [] }, content, style);
  for (const e of composed.elements) {
    const ref = e.role === "title" ? content.titleRef : e.id === "explanation" ? content.explanationRef : e.id === "scope" ? content.scopeRef : void 0;
    if (ref) e.contentRef = ref;
  }
  assignElementRoles(composed);
  composed.styleBindingVersion = 1;
  composed.elements = composed.elements.map(e => bindElementAppearance(e, style));
  for (const object of composed.objects) object.geometryTokens = geometryTokens(style);
  return composed;
}
export { composeContentSlide };
