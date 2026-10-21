import {validImageCrop} from '../scene/image-crop.mjs';
import { validateTextRuns } from '../authoring/text-runs.mjs';
import { validateVector } from '../scene/vector-model.mjs';
const clone = (value) => structuredClone(value);
const revision = () => globalThis.crypto.randomUUID();
function validateProject(p) {
  const issues = [];
  if (p?.version !== 2) issues.push("Project must be version 2");
  const ids = /* @__PURE__ */ new Set();
  for (const s of p?.slides || []) {
    if (!s.slideId || ids.has(s.slideId)) issues.push("Duplicate/missing slideId");
    ids.add(s.slideId);
    if (s.mode === "template" && !s.layout) issues.push(`${s.slideId}: missing layout`);
    if (!["template", "composition"].includes(s.mode)) issues.push(`${s.slideId}: invalid mode`);
    if (s.authoring) issues.push(...validateAuthoredSlide(s, p));
    for (const e of Array.isArray(s.elements) ? s.elements : []) {
      if (!e || typeof e !== "object") { issues.push(`${s.slideId}: invalid element`); continue; }
      if (!["text", "image", "shape", "line", "vector"].includes(e.type)) issues.push(`${s.slideId}: unsupported core element type ${e.type}`);
      if (e.runs !== undefined) issues.push(...(e.type === "text" ? validateTextRuns(e.runs) : ["runs require text element"]));
      if (e.crop !== undefined && (e.type !== 'image' || !validImageCrop(e.crop))) issues.push(`${s.slideId}: invalid image crop`);
      if (e.type === "vector") issues.push(...validateVector(e));
      if (!e.id || !Array.isArray(e.bounds) || e.bounds.length !== 4 || !e.bounds.every(Number.isFinite)) issues.push(`${s.slideId}: invalid element bounds`);
    }
  }
  for(const s of p?.slides || [])for(const o of s.objects || [])for(const over of Object.values(o.overrides || {}))if(over.crop!==undefined&&!validImageCrop(over.crop))issues.push(`${s.slideId}: invalid image crop override`);
  if (!p?.revision) issues.push("Missing revision");
  for (const k of ["requirements", "sources", "media", "contentPlan", "designChoice", "editorState"]) if (!p?.[k]) issues.push(`Missing ${k}`);
  return issues;
}
export {
  clone,
  revision,
  validateProject
};

// Extra guards apply only to the new explicit authoring path. Old pages retain
// their existing schema contract; unsupported new content must not vanish.
function validateAuthoredSlide(slide, project) {
  const issues = [], prefix = `${slide.slideId}: authored`;
  if (slide.authoring.engine !== 'kimi-authored-v1') issues.push(`${prefix} unknown authoring engine`);
  if (slide.mode !== 'composition') issues.push(`${prefix} requires composition mode`);
  if (!slide.styleId) issues.push(`${prefix} requires explicit styleId drawing defaults`);
  if (!Array.isArray(slide.elements) || !slide.elements.length) {
    issues.push(`${prefix} elements must be a nonempty array`);
    return issues;
  }
  if (slide.objects?.length) issues.push(`${prefix} semantic objects are not supported; supply direct elements`);
  const ids = new Set();
  for (const element of slide.elements) {
    if (!element || typeof element !== 'object') { issues.push(`${prefix} invalid element`); continue; }
    if (!element.id || ids.has(element.id)) issues.push(`${prefix} Duplicate/missing element ID`);
    ids.add(element.id);
    if (element.parentId) issues.push(`${prefix} parentId is unsupported for direct elements`);
    if (Array.isArray(element.bounds) && (element.bounds[2] <= 0 || element.bounds[3] <= 0)) issues.push(`${prefix} invalid element bounds`);
    if (element.contentRef && typeof project.contentPlan?.nodes?.[element.contentRef]?.text !== 'string') issues.push(`${prefix} missing content reference ${element.contentRef}`);
    if (element.mediaRef && !project.media?.entries?.some(entry => entry.mediaId === element.mediaRef && entry.src)) issues.push(`${prefix} missing media reference ${element.mediaRef}`);
    if (element.type === 'image' && !element.mediaRef && !element.src) issues.push(`${prefix} image source/reference required`);
  }
  return issues;
}
