// User decisions: what the user decided in conversation, recorded in the project so the checks and the independent
// reviewer can see it. The user's choice outranks the rules, the house style and any reviewer opinion; recording it is
// how that priority reaches the gates. Other skills treat confirmed user input as authoritative the same way.
//
// requirements.userDecisions: [{
//   id,                      // short stable id, e.g. 'p3-placeholder-photos'
//   quote,                   // the user's own words — never paraphrased into something they did not say
//   decision,                // what the author will do because of it
//   covers: ['visual#images', 'image-small-in-zone', 'scenario#Color Palette Reference', …],
//                            // review claim ids and/or check kinds this decision settles
//   pages: ['p3']            // optional: limit to these slides; omitted means the whole deck
// }]
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;

export function readDecisions(project) {
  const list = project.requirements?.userDecisions;
  return Array.isArray(list) ? list.filter((d) => d && typeof d === 'object') : [];
}

// Malformed records are reported instead of silently granting or ignoring an exemption.
export function checkDecisions(project) {
  const issues = [], seen = new Set();
  for (const [i, d] of readDecisions(project).entries()) {
    const where = { kind: 'user-decision-invalid', index: i, id: d.id ?? null };
    if (!nonempty(d.id) || seen.has(d.id)) issues.push({ ...where, need: 'id：唯一的短标识' });
    seen.add(d.id);
    if (!nonempty(d.quote)) issues.push({ ...where, need: 'quote：用户原话（不可改写成用户没说过的话）' });
    if (!nonempty(d.decision)) issues.push({ ...where, need: 'decision：据此怎么做' });
    if (!Array.isArray(d.covers) || !d.covers.length || !d.covers.every(nonempty)) issues.push({ ...where, need: 'covers：被这条决定覆盖的复核条目 id 或检查 kind' });
    if (d.pages !== undefined && (!Array.isArray(d.pages) || !d.pages.every(nonempty))) issues.push({ ...where, need: 'pages：页面 slideId 列表，或省略表示全稿' });
  }
  return issues;
}

// The decision that settles a review claim or a check record (by id or kind, and slide when the decision is scoped).
export function decisionFor(project, { id, kind, slideId }) {
  const valid = readDecisions(project).filter((d) => nonempty(d.quote) && Array.isArray(d.covers));
  return valid.find((d) => d.covers.includes(id ?? kind) && (!Array.isArray(d.pages) || !slideId || d.pages.includes(slideId))) || null;
}

// Split check records into those still open and those the user decided; decided ones are kept, as a record.
export function applyDecisions(project, records) {
  const open = [], decided = [];
  for (const r of records) {
    const d = decisionFor(project, { kind: r.kind, slideId: r.slideId });
    if (d) decided.push({ ...r, decidedBy: d.id, quote: d.quote }); else open.push(r);
  }
  return { open, decided };
}
