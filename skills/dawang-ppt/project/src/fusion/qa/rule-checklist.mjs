import { materializeElements } from '../scene/model.mjs';
import { ruleItems } from '../rules/items.mjs';

// The rule checklist records how the pinned production rules for the chosen scenario were applied: applied (with
// the slides/elements that carry it), not-applicable or user-override (with a reason). v2 records one entry per rule
// section, so a deck answers a handful of real decisions instead of dozens of bullets; v1 decks keep per-item entries
// (a section could only dismiss its items). The check proves every unit got a decision and applied entries point at
// real elements; whether the design honours the rule is judged by looking and by the independent review.
export const RULE_CONTRACT = 'rules-checklist-v2';
const ITEM_CONTRACTS = new Set(['rules-checklist-v1', 'kimi-checklist-v1']);
export const isRuleContract = (project) => project.requirements?.ruleContract === RULE_CONTRACT || ITEM_CONTRACTS.has(project.requirements?.ruleContract);
export const isSectionChecklist = (project) => !ITEM_CONTRACTS.has(project.requirements?.ruleContract);
const STATUSES = new Set(['applied', 'not-applicable', 'user-override']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

export function reviewRuleChecklist(project, { itemsFor = ruleItems } = {}) {
  const strict = isRuleContract(project), issues = [], warnings = [];
  // New authored decks are blocked; older projects only see warnings, so existing work keeps publishing.
  const report = (record) => (strict ? issues : warnings).push(record);
  const checklist = project.contentPlan?.ruleChecklist;
  if (!checklist) { report({ kind: 'rules-checklist-missing', hint: 'rules:checklist <scenario> 输出待填清单' }); return { issues, warnings, review: null, strict }; }
  let rules;
  try { rules = itemsFor(checklist.scenario); }
  catch (error) { report({ kind: 'rules-unavailable', scenario: checklist.scenario, message: error.message }); return { issues, warnings, review: null, strict }; }

  const hidden = new Set([...(project.editorState?.deletedSlides || []), ...(project.editorState?.skippedSlides || [])]);
  const elementsOf = new Map(project.slides.filter((s) => !hidden.has(s.slideId)).map((s) => [s.slideId, new Set(materializeElements(s, project).map((e) => e.id))]));
  const entries = checklist.items && typeof checklist.items === 'object' ? checklist.items : {};
  const itemIds = new Set(rules.items.map((i) => i.id)), sectionIds = new Set(rules.sections.map((s) => s.id));
  const bySection = isSectionChecklist(project);

  for (const [id, entry] of Object.entries(entries)) {
    if (!itemIds.has(id) && !sectionIds.has(id)) { warnings.push({ kind: 'rule-unknown', id }); continue; }
    if (bySection && itemIds.has(id)) { warnings.push({ kind: 'rule-item-entry-ignored', id, need: '按章节记录：' + rules.items.find((i) => i.id === id).section }); continue; }
    if (!STATUSES.has(entry?.status)) { report({ kind: 'rule-status-invalid', id, status: entry?.status }); continue; }
    if (entry.status !== 'applied') { if (!nonempty(entry.reason)) report({ kind: 'rule-reason-missing', id }); continue; }
    // A whole section may be dismissed at once, but each applied item needs its own evidence.
    if (!bySection && sectionIds.has(id)) { report({ kind: 'rule-section-applied', id, need: '逐条记录 ' + id + '#序号' }); continue; }
    if (!nonempty(entry.how)) report({ kind: 'rule-how-missing', id });
    const evidence = Array.isArray(entry.evidence) ? entry.evidence : [];
    const broken = evidence.flatMap((e) => (e?.elementIds?.length ? e.elementIds : [undefined]).filter((el) => !elementsOf.get(e?.slideId)?.has(el)).map((el) => ({ slideId: e?.slideId, elementId: el })));
    if (!evidence.length) report({ kind: 'rule-evidence-missing', id });
    else if (broken.length) report({ kind: 'rule-evidence-broken', id, broken });
  }

  // An item is decided by its own entry, or else by its section's dismissal (a section never counts as applied).
  const dismissal = (entry) => (entry && entry.status !== 'applied' ? entry : undefined);
  const decided = bySection ? rules.sections.map((sec) => ({ item: sec, entry: entries[sec.id] }))
    : rules.items.map((item) => ({ item, entry: entries[item.id] || dismissal(entries[item.section]) }));
  const unrecorded = decided.filter((d) => !d.entry).map((d) => d.item.id);
  if (unrecorded.length) report({ kind: 'rules-unrecorded', count: unrecorded.length, of: decided.length, ids: unrecorded });

  const counts = { applied: 0, 'not-applicable': 0, 'user-override': 0 };
  for (const d of decided) if (d.entry && STATUSES.has(d.entry.status)) counts[d.entry.status]++;
  const skipped = counts['not-applicable'] + counts['user-override'];
  if (decided.length && skipped * 2 > decided.length) warnings.push({ kind: 'rules-mostly-skipped', skipped, total: decided.length });
  const review = {
    scenario: rules.scenario, pin: rules.pin, unit: bySection ? 'section' : 'item', items: decided.length, counts,
    // Listed in the delivery reply so the user sees which rules were not followed and why.
    notApplied: Object.entries(entries).filter(([id, e]) => (itemIds.has(id) || sectionIds.has(id)) && e?.status !== 'applied')
      .map(([id, e]) => ({ id, label: rules.items.find((i) => i.id === id)?.label ?? id.replace(/^[a-z]+#/, ''), status: e.status, reason: e.reason }))
  };
  return { issues, warnings, review, strict };
}
