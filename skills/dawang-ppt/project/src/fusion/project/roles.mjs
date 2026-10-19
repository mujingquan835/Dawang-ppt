// Single role vocabulary shared by template contracts (theme17 props) and composition elements.
const ROLE_VOCAB = Object.freeze({
  kicker: { kind: "text", scope: "page", note: "eyebrow above the title; never a title" },
  title: { kind: "text", scope: "page", note: "exactly one per page" },
  subtitle: { kind: "text", scope: "page", note: "lead sentence under the title; not body" },
  heading: { kind: "text", scope: "item", note: "item/section heading inside content (nested title fields)" },
  body: { kind: "text", scope: "any", minFontPx: 28 },
  label: { kind: "text", scope: "any" },
  value: { kind: "text", scope: "any" },
  caption: { kind: "text", scope: "any" },
  source: { kind: "text", scope: "page", note: "provenance footer; required on content pages" },
  note: { kind: "text", scope: "any" },
  media: { kind: "media", scope: "any" }
});
const PAGE_ROLES = new Set(["kicker", "title", "subtitle", "source"]);
// theme17 field -> role. Top-level `title` is the page title; nested `title` (points/actions/steps) is a heading.
const THEME17_FIELD_ROLES = Object.freeze({
  kicker: "kicker", title: "title", subtitle: "subtitle", source: "source", caption: "caption",
  summary: "body", detail: "body", insight: "body", conclusion: "body", evidence: "body", action: "body",
  chartTitle: "heading", leftTitle: "heading", rightTitle: "heading",
  label: "label", name: "label", when: "label", owner: "label", headers: "label", unit: "label",
  value: "value", metric: "value", images: "media"
});
const NON_COPY = /^(imageFit|.*Count)$/;
function roleForField(field, nested) {
  if (nested && field === "title") return "heading";
  return THEME17_FIELD_ROLES[field];
}
function collectFieldRoles(props, path = [], out = []) {
  for (const [k, v] of Object.entries(props || {})) {
    if (NON_COPY.test(k)) continue;
    const nested = path.length > 0;
    if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] !== null) v.forEach((item, i) => collectFieldRoles(item, [...path, k, i], out));
    else out.push({ path: [...path, k].join("."), field: k, nested, role: roleForField(k, nested) });
  }
  return out;
}
// Consistency check for theme17 page contracts (role vocab + media slot limits).
function checkTemplateRoleSchema(pages) {
  const issues = [];
  for (const page of pages) {
    const roles = collectFieldRoles(page.defaultProps);
    for (const r of roles) {
      if (!r.role) issues.push({ page: page.key, kind: "unmapped-field", path: r.path });
      else if (!ROLE_VOCAB[r.role]) issues.push({ page: page.key, kind: "unknown-role", path: r.path, role: r.role });
      else if (r.nested && PAGE_ROLES.has(r.role)) issues.push({ page: page.key, kind: "page-role-nested", path: r.path, role: r.role });
    }
    const titles = roles.filter((r) => r.role === "title");
    if (titles.length !== 1) issues.push({ page: page.key, kind: "title-count", count: titles.length });
    if (!roles.some((r) => r.role === "source")) issues.push({ page: page.key, kind: "source-missing" });
    if (roles.some((r) => r.field === "kicker" && r.role !== "kicker")) issues.push({ page: page.key, kind: "kicker-misrole" });
    for (const control of page.controls || []) for (const slot of control.mediaSlots || []) {
      const maxCount = slot.maxCount;
      if (!Number.isInteger(maxCount) || maxCount < 1) issues.push({ page: page.key, kind: "media-maxCount-invalid", field: slot.field });
      if (slot.max === null || slot.max === void 0 || slot.max !== maxCount) issues.push({ page: page.key, kind: "media-max-mismatch", field: slot.field, max: slot.max ?? null, maxCount });
      const value = page.defaultProps?.[slot.field];
      if (!Array.isArray(value) || value.length > maxCount) issues.push({ page: page.key, kind: "media-default-exceeds", field: slot.field });
    }
  }
  return issues;
}
const ELEMENT_ROLE_DEFAULTS = [
  [/^(title|contents-title|chapter-title|section-title|photo-verdict-title)$/, "title"],
  [/^(source)$/, "source"], [/^(scope|chapter-scope|section-note|contents-note)$/, "subtitle"],
  [/^(document-role|kicker)$/, "kicker"], [/caption$/, "caption"],
  [/^(section|page|number|navigation|running-title|blueprint-index|chapter-number|contents-item-.*|profile-nav-label-.*|.*\/category|.*\/label|scope|.*-index)$/, "label"],
  [/\/value$/, "value"]
];
function defaultElementRole(id) {
  for (const [re, role] of ELEMENT_ROLE_DEFAULTS) if (re.test(id)) return role;
  return "body";
}
function assignElementRoles(slide) {
  for (const e of slide.elements || []) if (e.type === "text" && !e.role) e.role = defaultElementRole(e.id);
  return slide;
}
function checkElementRoles(slide, { minBodyPx = slide.typography?.bodyPt*2 || 28 } = {}) {
  const issues = [], texts = (slide.elements || []).filter((e) => e.type === "text");
  for (const e of texts) {
    if (!e.role) issues.push({ slideId: slide.slideId, id: e.id, kind: "role-missing" });
    else if (!ROLE_VOCAB[e.role] || ROLE_VOCAB[e.role].kind !== "text") issues.push({ slideId: slide.slideId, id: e.id, kind: "unknown-role", role: e.role });
    if (e.role === "body" && (e.style?.fontSize ?? minBodyPx) < minBodyPx) issues.push({ slideId: slide.slideId, id: e.id, kind: "body-below-min", fontSize: e.style.fontSize });
  }
  const titles = texts.filter((e) => e.role === "title").length;
  if (titles > 1) issues.push({ slideId: slide.slideId, kind: "title-count", count: titles });
  return issues;
}
export { ROLE_VOCAB, THEME17_FIELD_ROLES, collectFieldRoles, checkTemplateRoleSchema, assignElementRoles, checkElementRoles, defaultElementRole };
