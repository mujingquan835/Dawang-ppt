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
    for (const e of s.elements || []) {
      if (!["text", "image", "shape", "line"].includes(e.type)) issues.push(`${s.slideId}: unsupported core element type ${e.type}`);
      if (!e.id || !Array.isArray(e.bounds) || e.bounds.length !== 4 || !e.bounds.every(Number.isFinite)) issues.push(`${s.slideId}: invalid element bounds`);
    }
  }
  if (!p?.revision) issues.push("Missing revision");
  for (const k of ["requirements", "sources", "media", "contentPlan", "designChoice", "editorState"]) if (!p?.[k]) issues.push(`Missing ${k}`);
  return issues;
}
export {
  clone,
  revision,
  validateProject
};
