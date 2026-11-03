import { readAuthoringRules, SCENARIOS } from './index.mjs';

// Checkable items of the pinned production rules for one scenario: every numbered or top-level bullet item of the
// scenario document's apply/adapt sections, plus the general Requirements list. Ids are built from headings
// and item numbers; item text is read from the user's local installation at run time and never stored here
// (the independent reviewer receives it in its prompt, not in any repository file).
const GENERAL_SECTIONS = new Set(['Requirements']);
const ITEM_START = /^(?:\d+\.|[-*])\s+/;

function splitItems(text) {
  const body = text.split('\n').slice(1), items = [];
  let current = null;
  for (const line of body) {
    if (ITEM_START.test(line)) { current = [line]; items.push(current); }
    else if (current && line.trim()) current.push(line);
  }
  if (items.length) return items.map((lines) => lines.join('\n').trim());
  const whole = body.join('\n').trim();
  return whole ? [whole] : [];
}

const label = (text) => text.replace(ITEM_START, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);

export function ruleItems(scenarioId, options = {}) {
  if (!SCENARIOS.some((s) => s.id === scenarioId)) throw new Error('Unknown scenario ' + scenarioId + '. Valid scenarios: ' + SCENARIOS.map((s) => s.id).join(', '));
  const rules = readAuthoringRules({ scenarioId, ...options });
  const items = [], sections = [];
  for (const doc of rules.documents) {
    const key = doc.id === 'general' ? 'general' : doc.id.startsWith('scenario:') ? 'scenario' : null;
    if (!key) continue;
    const seen = new Map();
    for (const section of doc.sections) {
      if (!['apply', 'adapt', 'unreviewed'].includes(section.disposition) || !section.text) continue;
      if (key === 'general' && !GENERAL_SECTIONS.has(section.heading)) continue;
      const parts = splitItems(section.text);
      if (!parts.length) continue;
      // Headings may contain "/", so ids use "#"; a repeated heading gets a counter.
      const n = (seen.get(section.heading) || 0) + 1; seen.set(section.heading, n);
      const sectionId = `${key}#${section.heading}${n > 1 ? ` (${n})` : ''}`;
      sections.push({ id: sectionId, items: parts.length });
      parts.forEach((text, i) => items.push({
        id: `${sectionId}#${i + 1}`, section: sectionId, label: label(text), text, disposition: section.disposition, ...(section.note ? { note: section.note } : {})
      }));
    }
  }
  return { scenario: scenarioId, pin: { status: rules.pin.status, label: rules.pin.label }, sections, items };
}
