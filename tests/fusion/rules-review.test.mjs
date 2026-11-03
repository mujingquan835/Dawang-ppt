import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { buildReviewPacket, normalizeVerdict, writeReview, reviewGate, REVIEW_FILE } from '../../skills/dawang-ppt/project/src/fusion/qa/rules-review.mjs';
import { resolveReviewer } from '../../skills/dawang-ppt/project/src/fusion/authoring/independent-review.mjs';

// Synthetic rules and deck; the real upstream rule text is never copied into tests.
const rules = {
  scenario: 'management-report',
  sections: [{ id: 'scenario#Visual', items: 2 }, { id: 'scenario#Directions', items: 1 }],
  items: [
    { id: 'scenario#Visual#1', section: 'scenario#Visual', text: '1. Structural diagrams for dependencies' },
    { id: 'scenario#Visual#2', section: 'scenario#Visual', text: '2. Motif through deck' },
    { id: 'scenario#Directions#1', section: 'scenario#Directions', text: '1. Borrowable grid' }
  ]
};
const project = () => createAuthoredProject({
  requirements: { projectId: 'rules-review-test', title: '合成测试' },
  sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] }, media: { entries: [] },
  designChoice: { styleId: 'authored/custom' },
  contentPlan: { nodes: {}, slides: [], ruleChecklist: { scenario: 'management-report', items: {
    'scenario#Visual#1': { status: 'applied', how: '条形图', evidence: [{ slideId: 's', elementIds: ['bar'] }] },
    'scenario#Visual#2': { status: 'applied', how: '页脚细线', evidence: [{ slideId: 's', elementIds: ['line'] }] },
    'scenario#Directions': { status: 'not-applicable', reason: '参考方向' }
  } } },
  slides: [{ slideId: 's', elements: [{ id: 'bar', type: 'text', text: '画面稳定效果 42 条', bounds: [100, 100, 800, 60], style: { fontSize: 32 } }, { id: 'line', type: 'line', bounds: [100, 1000, 1700, 1] }] }]
});
const workspace = (t) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-review-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };
const kinds = (r) => r.issues.map((i) => i.kind);

test('the packet carries rule text, claims and an element map, but no author reasoning beyond the claim', () => {
  const p = project(), packet = buildReviewPacket({ project: p, rules, pages: [{ slideId: 's', image: '/tmp/01.png' }] });
  assert.deepEqual(packet.claims.map((c) => [c.id, c.status]), [['scenario#Visual#1', 'applied'], ['scenario#Visual#2', 'applied'], ['scenario#Directions', 'not-applicable']]);
  assert.match(packet.claims[2].rule, /Borrowable grid/);
  assert.match(packet.prompt, /独立复核者/);
  assert.match(packet.prompt, /画面稳定效果 42 条/);
  assert.deepEqual(packet.images, ['/tmp/01.png']);
  assert.deepEqual(packet.schema.properties.items.items.required, ['id', 'verdict', 'reason']);
});

test('a verdict that skips a claim is rejected instead of passing it', () => {
  const claims = buildReviewPacket({ project: project(), rules, pages: [{ slideId: 's', image: 'x' }] }).claims;
  assert.throws(() => normalizeVerdict({ items: [{ id: 'scenario#Visual#1', verdict: 'pass', reason: 'ok' }] }, claims), /缺少条目/);
});

test('publishing needs a current review with no failed claim', (t) => {
  const dir = workspace(t), p = project();
  assert.deepEqual(kinds(reviewGate(p, dir)), ['rules-review-missing']);
  const items = [
    { id: 'scenario#Visual#1', verdict: 'fail', reason: '条形图不是结构图', status: 'applied' },
    { id: 'scenario#Visual#2', verdict: 'pass', reason: '各页可见同一细线', status: 'applied' },
    { id: 'scenario#Directions', verdict: 'pass', reason: '参考方向未借用', status: 'not-applicable' }
  ];
  writeReview(dir, p, { reviewer: 'fake', items });
  const failed = reviewGate(p, dir);
  assert.deepEqual(kinds(failed), ['rules-review-failed']);
  assert.deepEqual(failed.issues[0].items.map((i) => i.id), ['scenario#Visual#1']);
  writeReview(dir, p, { reviewer: 'fake', items: items.map((i) => ({ ...i, verdict: 'pass' })) });
  assert.deepEqual(reviewGate(p, dir).issues, []);
  // Any later edit makes the review stale.
  assert.deepEqual(kinds(reviewGate({ ...p, revision: 'later' }, dir)), ['rules-review-stale']);
  const record = JSON.parse(fs.readFileSync(path.join(dir, REVIEW_FILE), 'utf8'));
  assert.equal(record.reviewer, 'fake');
});

test('older projects only warn, and a custom reviewer command takes priority', (t) => {
  const p = project();
  delete p.requirements.ruleContract;
  const r = reviewGate(p, workspace(t));
  assert.deepEqual(r.issues, []);
  assert.equal(r.warnings[0].kind, 'rules-review-missing');
  assert.equal(resolveReviewer({ DAWANG_REVIEWER_CMD: 'claude -p x', PATH: '' }).kind, 'command');
});
