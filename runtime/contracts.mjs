import { compositions, resolveStyle } from "./styles.mjs";
export function validate(project) {
  const errors = [];
  const p = project.contentPlan,
    nodes = project.sources?.nodes,
    media = project.media?.items;
  if (!p || !Array.isArray(p.slides) || !p.slides.length)
    return ["contentPlan.slides is required"];
  if (!Array.isArray(nodes) || !Array.isArray(media))
    return ["sources.nodes and media.items must be arrays"];
  const sourceIds = new Set((project.sources.entries || []).map((s) => s.id));
  const ids = new Set(),
    mids = new Set(),
    sids = new Set();
  for (const n of nodes) {
    if (!n.id || ids.has(n.id))
      errors.push(`Duplicate/missing content ID: ${n.id}`);
    ids.add(n.id);
    if (!n.sourceId || !sourceIds.has(n.sourceId))
      errors.push(`Missing source: ${n.id}`);
    if (!["text", "table", "series"].includes(n.kind))
      errors.push(`Invalid node kind: ${n.id}`);
    if (n.kind === "text" && typeof n.text !== "string")
      errors.push(`Invalid text: ${n.id}`);
  }
  for (const m of media) {
    if (!m.id || mids.has(m.id))
      errors.push(`Duplicate/missing media ID: ${m.id}`);
    mids.add(m.id);
    if (
      !m.source ||
      !m.src ||
      m.src.includes("..") ||
      /^([a-z]+:|\/)/i.test(m.src)
    )
      errors.push(`Invalid local media: ${m.id}`);
    if (m.allowCrop === false && m.fit === "cover")
      errors.push(`Forbidden cropping: ${m.id}`);
  }
  try {
    resolveStyle(project.designBrief);
  } catch (e) {
    errors.push(e.message);
  }
  if (!["management", "analysis", "training"].includes(p.scenario))
    errors.push("Unsupported scenario");
  if (p.pageCount !== p.slides.length)
    errors.push("Fixed page count does not match slides");
  for (const s of p.slides) {
    if (!s.slideId || sids.has(s.slideId))
      errors.push(`Duplicate/missing slide ID: ${s.slideId}`);
    sids.add(s.slideId);
    if (!s.readerTask || !s.relation)
      errors.push(`Missing semantic intent: ${s.slideId}`);
    if (!compositions.includes(s.composition))
      errors.push(`Unsupported composition: ${s.composition}`);
    if (s.constraints?.nativeChart || s.constraints?.smartArt)
      errors.push(`Native chart / SmartArt unsupported: ${s.slideId}`);
    const refs = [
      s.titleRef,
      ...(s.bodyRefs || []),
      ...(s.beforeRefs || []),
      ...(s.afterRefs || []),
      s.dataRef,
    ].filter(Boolean);
    for (const ref of refs)
      if (!ids.has(ref)) errors.push(`Missing content ${ref} on ${s.slideId}`);
    for (const ref of s.requiredContentRefs || [])
      if (!refs.includes(ref))
        errors.push(`Uncovered required content ${ref} on ${s.slideId}`);
    for (const ref of [...(s.mediaRefs || []), ...(s.requiredMediaRefs || [])])
      if (!mids.has(ref) || !(s.mediaRefs || []).includes(ref))
        errors.push(`Uncovered media ${ref} on ${s.slideId}`);
    if (s.composition === "case" && !s.mediaRefs?.length)
      errors.push(`Case requires actual media: ${s.slideId}`);
    if (
      s.composition === "process" &&
      (!s.beforeRefs?.length || !s.afterRefs?.length)
    )
      errors.push(`Before/after steps required: ${s.slideId}`);
    const d = nodes.find((n) => n.id === s.dataRef);
    if (
      s.composition === "table" &&
      (!d ||
        d.kind !== "table" ||
        !d.headers?.length ||
        !d.rows?.length ||
        d.rows.some((r) => r.length !== d.headers.length))
    )
      errors.push(`Invalid table: ${s.slideId}`);
    if (
      s.composition === "comparison" &&
      (!d ||
        d.kind !== "series" ||
        !d.unit ||
        !d.period ||
        !d.basis ||
        !d.values?.length ||
        d.values.some((v) => v.value !== null && !Number.isFinite(v.value)))
    )
      errors.push(
        `Invalid series / missing unit, period or basis: ${s.slideId}`,
      );
  }
  return errors;
}
export function assertValid(project) {
  const errors = validate(project);
  if (errors.length) throw new Error(errors.join("\n"));
}
