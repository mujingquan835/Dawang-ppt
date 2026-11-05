import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDecisions, applyDecisions, decisionFor } from '../../skills/dawang-ppt/project/src/fusion/qa/user-decisions.mjs';
import { reviewGate, checklistHash, buildReviewPacket, MAX_REVIEW_ROUNDS } from '../../skills/dawang-ppt/project/src/fusion/qa/rules-review.mjs';
import { RULE_CONTRACT } from '../../skills/dawang-ppt/project/src/fusion/qa/rule-checklist.mjs';
import { createTheme, createGrid } from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';
import { pageHeader, itemRows } from '../../skills/dawang-ppt/project/src/fusion/authoring/patterns.mjs';
import { lintComposition } from '../../skills/dawang-ppt/project/src/fusion/qa/composition-lint.mjs';
import { suggestPattern } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';

const decision = { id: 'p3-photos', quote: '图片仅作示意、不必与大纲一致', decision: '第3页保留示意图，按行对齐', covers: ['visual#images', 'image-small-in-zone'], pages: ['p3'] };
const project = (extra = {}) => ({ revision: 'r1', requirements: { ruleContract: RULE_CONTRACT, userDecisions: [decision], ...extra }, contentPlan: { ruleChecklist: { scenario: 's', items: {} } }, slides: [] });

test('a user decision needs the user\'s own words and what it covers', () => {
  assert.deepEqual(checkDecisions(project()), []);
  const bad = checkDecisions(project({ userDecisions: [{ id: 'x', decision: '保留', covers: [] }] })).map((i) => i.need.split('：')[0]);
  assert(bad.includes('quote') && bad.includes('covers'));
});

test('a decision settles only the checks it names, on the pages it names', () => {
  const p = project();
  assert(decisionFor(p, { id: 'visual#images' }));
  const { open, decided } = applyDecisions(p, [{ kind: 'image-small-in-zone', slideId: 'p3' }, { kind: 'image-small-in-zone', slideId: 'p1' }, { kind: 'text-orphan', slideId: 'p3' }]);
  assert.deepEqual(decided.map((d) => d.slideId), ['p3']);
  assert.equal(decided[0].quote, decision.quote);
  assert.deepEqual(open.map((o) => `${o.slideId}:${o.kind}`), ['p1:image-small-in-zone', 'p3:text-orphan']);
});

const gateWith = (p, items, round) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  fs.writeFileSync(path.join(dir, 'rules-review.json'), JSON.stringify({ revision: p.revision, checklistHash: checklistHash(p), reviewer: 'test', round, items }));
  try { return reviewGate(p, dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('a review fail the user decided does not block publishing', () => {
  const g = gateWith(project(), [{ id: 'visual#images', verdict: 'fail', reason: '第3页图片与动作不对应', status: 'visual' }], 1);
  assert.deepEqual(g.issues, []);
  assert.equal(g.review.decided[0].id, 'visual#images');
});

test('other fails block for the first rounds, then travel with the deck as open findings', () => {
  const p = project({ userDecisions: [] }), fail = [{ id: 'visual#hierarchy', verdict: 'fail', reason: '第2页主次不清', status: 'visual' }];
  assert(gateWith(p, fail, MAX_REVIEW_ROUNDS - 1).issues.some((i) => i.kind === 'rules-review-failed'));
  const late = gateWith(p, fail, MAX_REVIEW_ROUNDS);
  assert.deepEqual(late.issues, []);
  assert(late.warnings.some((w) => w.kind === 'rules-review-open'));
  assert.equal(late.review.openFindings[0].id, 'visual#hierarchy');
});

test('the reviewer sees the user\'s words on the claims a decision covers', () => {
  const p = { ...project(), slides: [], contentPlan: { ruleChecklist: { scenario: 's', items: {} } } };
  const packet = buildReviewPacket({ project: p, rules: { scenario: 's', items: [], sections: [] }, pages: [] });
  const claim = packet.claims.find((c) => c.id === 'visual#images');
  assert.equal(claim.userDecision.quote, decision.quote);
  assert.match(packet.prompt, /用户决定/);
});

test('item rows keep the item text plain, stack each figure beside its item, and lay photos out by their own ratios', () => {
  const theme = createTheme(), grid = createGrid(), header = pageHeader({ theme, grid, title: '合成' });
  const items = ['直播预热', '快闪布景', '入会抽奖'].map((title, i) => ({ title, detail: '说明', metric: { value: String(i + 1), label: '指标' } }));
  const photos = [{ src: 'a', size: { width: 1800, height: 900 } }, { src: 'b', size: { width: 1800, height: 752 } }, { src: 'c', size: { width: 1200, height: 1386 } }];
  const page = itemRows({ theme, grid, header, items, photos });
  const byId = (id) => page.elements.find((e) => e.id === id), mid = (e) => e.bounds[1] + e.bounds[3] / 2;
  // No boxes around the item text.
  assert(!page.elements.some((e) => /^row-\d-panel$/.test(e.id)));
  for (const i of [1, 2, 3]) assert(Math.abs(mid(byId(`row-${i}-metric-tile-1`)) - mid(byId(`row-${i}-badge-1`))) <= 40, `tile ${i} sits beside item ${i}`);
  // Each photo keeps close to its own shape: the portrait stays upright, landscapes stay wide.
  const imgs = page.elements.filter((e) => e.type === 'image');
  for (const e of imgs) { const r = e.bounds[2] / e.bounds[3], n = e.naturalSize[0] / e.naturalSize[1]; assert(Math.max(r / n, n / r) <= 1.25, `${e.id} keeps its ratio`); }
  assert(imgs.find((e) => e.naturalSize[0] < e.naturalSize[1]).bounds[2] < imgs.find((e) => e.naturalSize[0] > e.naturalSize[1]).bounds[2]);
  // The photo group's edges line up.
  assert.equal(new Set(imgs.filter((e) => e.bounds[1] > imgs[0].bounds[1] + 10).map((e) => e.bounds[0] + e.bounds[2])).size <= 1, true);
  assert.equal(Math.max(...imgs.map((e) => e.bounds[0] + e.bounds[2])), grid.right);
  assert.deepEqual(lintComposition(page.elements), []);
  assert.equal(suggestPattern({ items, data: [{}, {}, {}] }), 'itemRows');
  assert.equal(suggestPattern({ items, photos: photos.slice(0, 2) }), 'itemRows');
});
