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
const project = () => { const p = createAuthoredProject({
  requirements: { projectId: 'rules-review-test', title: '合成测试' },
  sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] }, media: { entries: [] },
  designChoice: { styleId: 'authored/custom' },
  contentPlan: { nodes: {}, slides: [], ruleChecklist: { scenario: 'management-report', items: {
    'scenario#Visual#1': { status: 'applied', how: '条形图', evidence: [{ slideId: 's', elementIds: ['bar'] }] },
    'scenario#Visual#2': { status: 'applied', how: '页脚细线', evidence: [{ slideId: 's', elementIds: ['line'] }] },
    'scenario#Directions': { status: 'not-applicable', reason: '参考方向' }
  } } },
  slides: [{ slideId: 's', elements: [{ id: 'bar', type: 'text', text: '画面稳定效果 42 条', bounds: [100, 100, 800, 60], style: { fontSize: 32 } }, { id: 'line', type: 'line', bounds: [100, 1000, 1700, 1] }] }]
}); p.requirements.ruleContract = 'rules-checklist-v1'; return p; };
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

test('failed reviews count rounds and tell the author to keep fixing until the limit', async (t) => {
  const { nextStep, MAX_REVIEW_ROUNDS } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/independent-review.mjs');
  const dir = workspace(t), p = project();
  const fail = [{ id: 'scenario#Visual#1', verdict: 'fail', reason: '缺结构图', status: 'applied' }];
  assert.equal(writeReview(dir, p, { reviewer: 'fake', items: fail }).round, 1);
  assert.equal(writeReview(dir, p, { reviewer: 'fake', items: fail }).round, 2);
  assert.equal(reviewGate(p, dir).issues[0].round, 2);
  assert.match(nextStep(1, 2), /本轮继续/);
  assert.match(nextStep(1, MAX_REVIEW_ROUNDS), /停止/);
  assert.match(nextStep(0, 2), /publish:html/);
  writeReview(dir, p, { reviewer: 'fake', items: fail.map((i) => ({ ...i, verdict: 'pass' })) });
  assert.equal(writeReview(dir, p, { reviewer: 'fake', items: fail }).round, 1);
});

test('the reviewer is told not to fail claims for information the material never had', () => {
  const packet = buildReviewPacket({ project: project(), rules, pages: [{ slideId: 's', image: 'x' }] });
  assert.match(packet.prompt, /原材料本身没有提供的信息/);
});

test('v2 decks add concrete visual claims to the packet', () => {
  const p = project(); p.requirements.ruleContract = 'rules-checklist-v2';
  p.contentPlan.ruleChecklist.items = { 'scenario#Visual': { status: 'applied', how: '条形图与细线', evidence: [{ slideId: 's', elementIds: ['bar'] }] }, 'scenario#Directions': { status: 'not-applicable', reason: '参考方向' } };
  const packet = buildReviewPacket({ project: p, rules, pages: [{ slideId: 's', image: 'x' }] });
  assert.deepEqual(packet.claims.map((c) => c.id), ['scenario#Visual', 'scenario#Directions', 'visual#alignment', 'visual#hierarchy', 'visual#images']);
  assert.match(packet.prompt, /status=visual/);
  const followUp = buildReviewPacket({ project: p, rules, pages: [{ slideId: 's', image: 'x' }], only: new Set(['visual#images']) });
  assert.deepEqual(followUp.claims.map((c) => c.id), ['visual#images']);
  assert.equal(followUp.all.length, 5);
});

test('a follow-up round starts only from a failed review of the same checklist', async (t) => {
  const { previousRound } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/independent-review.mjs');
  const dir = workspace(t), p = project();
  assert.equal(previousRound(dir, p), null);
  writeReview(dir, p, { reviewer: 'fake', items: [{ id: 'scenario#Visual#1', verdict: 'fail', reason: 'x', status: 'applied' }, { id: 'scenario#Visual#2', verdict: 'pass', reason: 'y', status: 'applied' }] });
  assert.deepEqual(previousRound(dir, { ...p, revision: 'later' }).items.map((i) => i.verdict), ['fail', 'pass']);
  const changed = structuredClone(p); changed.contentPlan.ruleChecklist.items['scenario#Directions'].reason = '改了理由';
  assert.equal(previousRound(dir, changed), null);
  writeReview(dir, p, { reviewer: 'fake', items: [{ id: 'scenario#Visual#1', verdict: 'pass', reason: 'x', status: 'applied' }] });
  assert.equal(previousRound(dir, p), null);
});

test('the reviewer is told the confirmed house style outranks no-card clauses', () => {
  const packet = buildReviewPacket({ project: project(), rules, pages: [{ slideId: 's', image: 'x' }] });
  assert.match(packet.prompt, /用户确认的 Dawang 版式/);
  assert.match(packet.prompt, /数字色块/);
  assert.match(packet.prompt, /不得仅因/);
});

test('the Codex reviewer can run at a chosen reasoning effort', () => {
  const r = resolveReviewer({ DAWANG_REVIEWER_EFFORT: 'low', PATH: '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin' });
  if (r?.kind === 'codex') { assert.equal(r.effort, 'low'); assert.match(r.name, /\/low$/); }
});
