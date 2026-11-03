import { materializeElements } from '../scene/model.mjs';
import { kimiRuleItems } from '../kimi/rule-items.mjs';

// The rule checklist records, item by item, how the pinned Kimi rules for the chosen scenario were applied:
// applied (with the slides/elements that carry it), not-applicable or user-override (with a reason). A section-level
// entry may dismiss all its items at once; applied is always recorded per item. The check proves every item got a recorded decision and
// that applied items point at real elements; whether the design honours the rule is still judged by looking.
export const RULE_CONTRACT = 'kimi-checklist-v1';
const STATUSES = new Set(['applied', 'not-applicable', 'user-override']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export function reviewRuleChecklist(project, { itemsFor = kimiRuleItems } = {}) {
  const strict = project.requirements?.ruleContract === RULE_CONTRACT, issues = [], warnings = [];
  // New authored decks are blocked; older projects only see warnings, so existing work keeps publishing.
  const report = (record) => (strict ? issues : warnings).push(record);
  const checklist = project.contentPlan?.ruleChecklist;
  if (!checklist) { report({ kind: 'kimi-checklist-missing', hint: 'rules:checklist <scenario> 输出待填清单' }); return { issues, warnings, review: null, strict }; }
  let rules;
  try { rules = itemsFor(checklist.scenario); }
  catch (error) { report({ kind: 'kimi-rules-unavailable', scenario: checklist.scenario, message: error.message }); return { issues, warnings, review: null, strict }; }

  const hidden = new Set([...(project.editorState?.deletedSlides || []), ...(project.editorState?.skippedSlides || [])]);
  const elementsOf = new Map(project.slides.filter((s) => !hidden.has(s.slideId)).map((s) => [s.slideId, new Set(materializeElements(s, project).map((e) => e.id))]));
  const entries = checklist.items && typeof checklist.items === 'object' ? checklist.items : {};
  const itemIds = new Set(rules.items.map((i) => i.id)), sectionIds = new Set(rules.sections.map((s) => s.id));

  for (const [id, entry] of Object.entries(entries)) {
    if (!itemIds.has(id) && !sectionIds.has(id)) { warnings.push({ kind: 'kimi-rule-unknown', id }); continue; }
    if (!STATUSES.has(entry?.status)) { report({ kind: 'kimi-rule-status-invalid', id, status: entry?.status }); continue; }
    if (entry.status !== 'applied') { if (!nonempty(entry.reason)) report({ kind: 'kimi-rule-reason-missing', id }); continue; }
    // A whole section may be dismissed at once, but each applied item needs its own evidence.
    if (sectionIds.has(id)) { report({ kind: 'kimi-rule-section-applied', id, need: '逐条记录 ' + id + '#序号' }); continue; }
    if (!nonempty(entry.how)) report({ kind: 'kimi-rule-how-missing', id });
    const evidence = Array.isArray(entry.evidence) ? entry.evidence : [];
    const broken = evidence.flatMap((e) => (e?.elementIds?.length ? e.elementIds : [undefined]).filter((el) => !elementsOf.get(e?.slideId)?.has(el)).map((el) => ({ slideId: e?.slideId, elementId: el })));
    if (!evidence.length) report({ kind: 'kimi-rule-evidence-missing', id });
    else if (broken.length) report({ kind: 'kimi-rule-evidence-broken', id, broken });
  }

  // An item is decided by its own entry, or else by its section's dismissal (a section never counts as applied).
  const dismissal = (entry) => (entry && entry.status !== 'applied' ? entry : undefined);
  const decided = rules.items.map((item) => ({ item, entry: entries[item.id] || dismissal(entries[item.section]) }));
  const unrecorded = decided.filter((d) => !d.entry).map((d) => d.item.id);
  if (unrecorded.length) report({ kind: 'kimi-rules-unrecorded', count: unrecorded.length, of: rules.items.length, ids: unrecorded });

  const counts = { applied: 0, 'not-applicable': 0, 'user-override': 0 };
  for (const d of decided) if (d.entry && STATUSES.has(d.entry.status)) counts[d.entry.status]++;
  const skipped = counts['not-applicable'] + counts['user-override'];
  if (rules.items.length && skipped * 2 > rules.items.length) warnings.push({ kind: 'kimi-rules-mostly-skipped', skipped, total: rules.items.length });
  const review = {
    scenario: rules.scenario, pin: rules.pin, items: rules.items.length, counts,
    // Listed in the delivery reply so the user sees which Kimi rules were not followed and why.
    notApplied: Object.entries(entries).filter(([id, e]) => (itemIds.has(id) || sectionIds.has(id)) && e?.status !== 'applied')
      .map(([id, e]) => ({ id, label: rules.items.find((i) => i.id === id)?.label, status: e.status, reason: e.reason }))
  };
  return { issues, warnings, review, strict };
}
