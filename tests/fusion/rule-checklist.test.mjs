import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as rules from '../../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';
import { ruleItems } from '../../skills/dawang-ppt/project/src/fusion/rules/items.mjs';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { reviewRuleChecklist } from '../../skills/dawang-ppt/project/src/fusion/qa/rule-checklist.mjs';

// Synthetic rule texts only; the real upstream documents are never copied into tests.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-checklist-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'reference/slides_categories'), { recursive: true });
  const write = (file, text) => fs.writeFileSync(path.join(root, file), text);
  write('SKILL.md', '# Definition\nformat\n## PPT production workflow\n### step1. Read the context thoroughly\nread all\n');
  write('reference/slides_categories.md', '# PPT category guide\n## step1. General rules\n### Requirements\n1. **Reader task** per page\n2. Paging has rhythm\n   continued line\n### Strictly forbidden\n- no cards\n');
  write('reference/slides_categories/management-report.md', '# Management Reporting\n## Clear content\n- Titles state status\n- Cover carries the key status line\n## Visual References\n1. Font families split\n2. Motif through deck\n## Direction A / B\n1. Borrowable grid\n2. Suits concept teaching\n');
  const lockFile = path.join(root, 'lock.json');
  rules.writeRulesLock({ root, file: lockFile, label: 'fixture' });
  const lock = rules.readRulesLock(lockFile);
  return (scenario) => ruleItems(scenario, { root, lock });
}

test('items come from numbered/bullet lines of applicable sections; forbidden and workflow sections are not listed', (t) => {
  const r = fixture(t)('management-report');
  assert.deepEqual(r.items.map((i) => i.id), [
    'general#Requirements#1', 'general#Requirements#2',
    'scenario#Clear content#1', 'scenario#Clear content#2',
    'scenario#Visual References#1', 'scenario#Visual References#2',
    'scenario#Direction A / B#1', 'scenario#Direction A / B#2'
  ]);
  assert.equal(r.items[0].label, 'Reader task per page');
  assert.equal(r.pin.status, 'pinned');
});

const deck = (ruleChecklist) => createAuthoredProject({
  requirements: { projectId: 'rule-checklist-test', title: '合成测试' },
  sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] }, media: { entries: [] },
  designChoice: { styleId: 'authored/custom' },
  contentPlan: { nodes: {}, slides: [], ...(ruleChecklist ? { ruleChecklist } : {}) },
  slides: [
    { slideId: 'cover', elements: [{ id: 'title', type: 'text', text: '本季度完成率 92%', bounds: [100, 100, 1400, 120], style: { fontSize: 80 } }] },
    { slideId: 'body', elements: [{ id: 'motif', type: 'line', bounds: [100, 300, 1600, 1] }, { id: 'claim', type: 'text', text: '结论', bounds: [100, 100, 1400, 100], style: { fontSize: 64 } }] }
  ]
});
const applied = (how, ...evidence) => ({ status: 'applied', how, evidence: evidence.map(([slideId, ...elementIds]) => ({ slideId, elementIds })) });
const complete = {
  'general#Requirements#1': applied('每页标题写读者要得出的结论', ['cover', 'title'], ['body', 'claim']),
  'general#Requirements#2': applied('封面大数字页与正文线条页交替', ['cover', 'title'], ['body', 'motif']),
  'scenario#Clear content#1': applied('标题即状态', ['body', 'claim']),
  'scenario#Clear content#2': applied('封面放完成率', ['cover', 'title']),
  'scenario#Visual References#1': { status: 'user-override', reason: '用户指定全稿单一字体' },
  'scenario#Visual References#2': applied('细线母题贯穿', ['body', 'motif']),
  'scenario#Direction A / B': { status: 'not-applicable', reason: '参考方向，本稿未借用' }
};
const kinds = (r) => r.issues.map((i) => i.kind);

test('a complete checklist passes and reports what was not applied', (t) => {
  const itemsFor = fixture(t);
  const r = reviewRuleChecklist(deck({ scenario: 'management-report', items: complete }), { itemsFor });
  assert.equal(r.strict, true);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.review.counts, { applied: 5, 'not-applicable': 2, 'user-override': 1 });
  assert.deepEqual(r.review.notApplied.map((n) => n.id), ['scenario#Visual References#1', 'scenario#Direction A / B']);
});

test('missing checklist, unrecorded items and unsupported claims are blocked', (t) => {
  const itemsFor = fixture(t);
  assert.deepEqual(kinds(reviewRuleChecklist(deck(), { itemsFor })), ['rules-checklist-missing']);
  const { 'scenario#Visual References#2': _motif, ...partial } = complete;
  const unrecorded = reviewRuleChecklist(deck({ scenario: 'management-report', items: partial }), { itemsFor }).issues[0];
  assert.equal(unrecorded.kind, 'rules-unrecorded');
  assert.deepEqual(unrecorded.ids, ['scenario#Visual References#2']);
  const weak = reviewRuleChecklist(deck({ scenario: 'management-report', items: {
    ...complete,
    'scenario#Clear content#1': { status: 'applied', how: '标题即状态' },
    'scenario#Clear content#2': applied('封面放完成率', ['cover', 'nope']),
    'scenario#Visual References#1': { status: 'not-applicable' }
  } }), { itemsFor });
  assert.deepEqual(kinds(weak), ['rule-evidence-missing', 'rule-evidence-broken', 'rule-reason-missing']);
});

test('a whole section can be dismissed but not claimed as applied', (t) => {
  const itemsFor = fixture(t);
  const { 'scenario#Visual References#1': _a, 'scenario#Visual References#2': _b, ...rest } = complete;
  const r = reviewRuleChecklist(deck({ scenario: 'management-report', items: { ...rest, 'scenario#Visual References': applied('都做了', ['body', 'motif']) } }), { itemsFor });
  assert.deepEqual(kinds(r), ['rule-section-applied', 'rules-unrecorded']);
});

test('unknown scenario or missing rules block; older projects only warn', (t) => {
  const itemsFor = fixture(t);
  assert.deepEqual(kinds(reviewRuleChecklist(deck({ scenario: 'nope', items: {} }), { itemsFor })), ['rules-unavailable']);
  const old = deck();
  delete old.requirements.ruleContract;
  const r = reviewRuleChecklist(old, { itemsFor });
  assert.deepEqual(r.issues, []);
  assert.equal(r.warnings[0].kind, 'rules-checklist-missing');
});
