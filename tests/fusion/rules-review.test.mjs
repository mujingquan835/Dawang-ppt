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
  // Strict structured output rejects a schema unless every property is required (optional fields are nullable).
  const itemSchema = packet.schema.properties.items.items;
  assert.deepEqual([...itemSchema.required].sort(), Object.keys(itemSchema.properties).sort());
  for (const key of ['id', 'verdict', 'reason']) assert.equal(itemSchema.properties[key].type, 'string');
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
  assert.match(nextStep(1, MAX_REVIEW_ROUNDS), /请用户决定/);
  // Missing material is the user's call at any round: the hint says to ask, never to decide or stop alone.
  for (const r of [1, 2, MAX_REVIEW_ROUNDS]) assert.match(nextStep(1, r), /请用户选择补充材料或按现有材料生成/);
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

test('the reviewer gets the house-style exceptions clause by clause, with what each still requires', async () => {
  const { HOUSE_STYLE_TABLE, houseStyleMarkdown } = await import('../../skills/dawang-ppt/project/src/fusion/qa/house-style.mjs');
  const packet = buildReviewPacket({ project: project(), rules, pages: [{ slideId: 's', image: 'x' }] });
  for (const h of HOUSE_STYLE_TABLE) { assert(packet.prompt.includes(h.id)); assert(packet.prompt.includes(h.still)); }
  assert.match(packet.prompt, /同一章节的其他要求照常判断/);
  assert.match(packet.prompt, /不把整章当成豁免/);
  // The reference document is generated from the same table and must not drift.
  const doc = fs.readFileSync(new URL('../../skills/dawang-ppt/references/fusion/house-style.md', import.meta.url), 'utf8');
  assert.equal(doc, houseStyleMarkdown());
});

test('the Codex reviewer can run at a chosen reasoning effort', () => {
  const r = resolveReviewer({ DAWANG_REVIEWER_EFFORT: 'low', PATH: '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin' });
  if (r?.kind === 'codex') { assert.equal(r.effort, 'low'); assert.match(r.name, /\/low$/); }
});

test('partial decks tell the reviewer that deck-level demands do not apply', () => {
  const part = buildReviewPacket({ project: project(), rules, pages: [{ slideId: 's', image: 'x' }] });
  assert.match(part.prompt, /只是汇报中的一部分页面/);
  const p = project(); p.requirements.scope = 'full';
  assert.match(buildReviewPacket({ project: p, rules, pages: [{ slideId: 's', image: 'x' }] }).prompt, /完整的汇报/);
});

test('W4 V11: tiered review classifies three categories, keeps blockers blocking after 3 rounds, and allows advisories as ready', async (t) => {
  const { classifyFinding, inspectReviewScope } = await import('../../skills/dawang-ppt/project/src/fusion/qa/rules-review.mjs');
  const { nextStep, MAX_REVIEW_ROUNDS } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/independent-review.mjs');
  const dir = workspace(t), p = project();
  p.requirements.reviewContract = 'tiered-review-v1';

  const claims = buildReviewPacket({ project: p, rules, pages: [{ slideId: 's', image: 'x' }] }).claims;
  const normalized = normalizeVerdict({
    items: [
      { id: 'scenario#Visual#1', verdict: 'fail', reason: '循环返回边遗漏，事实关系不完整' },
      { id: 'scenario#Visual#2', verdict: 'fail', reason: '第1页底部说明文字裁切溢出' },
      { id: 'scenario#Directions', verdict: 'fail', reason: '可选装饰建议：页脚线条配色微调更精致' }
    ]
  }, claims, p);

  assert.equal(normalized[0].category, 'content');
  assert.equal(normalized[0].severity, 'blocker');
  assert.equal(normalized[0].suggestedAction, 'return-to-content-model');

  assert.equal(normalized[1].category, 'render');
  assert.equal(normalized[1].severity, 'blocker');
  assert.equal(normalized[1].suggestedAction, 'return-to-capacity-layout');

  assert.equal(normalized[2].category, 'design');
  assert.equal(normalized[2].severity, 'advisory');
  assert.equal(normalized[2].suggestedAction, 'local-polish-or-user-decision');

  // Even after MAX_REVIEW_ROUNDS (3 rounds), blockers must NOT auto-pass into warnings.
  writeReview(dir, p, { reviewer: 'fake', items: normalized, claims });
  writeReview(dir, p, { reviewer: 'fake', items: normalized, claims });
  const r3 = writeReview(dir, p, { reviewer: 'fake', items: normalized, claims });
  assert.equal(r3.round, MAX_REVIEW_ROUNDS);

  const gate = reviewGate(p, dir);
  assert.equal(gate.releaseStatus, 'needs-revision');
  assert.deepEqual(kinds(gate), ['rules-review-blocker-unresolved']);
  assert.equal(gate.issues[0].count, 2);
  assert.deepEqual(gate.issues[0].items.map((i) => i.id), ['scenario#Visual#1', 'scenario#Visual#2']);
  assert.equal(gate.warnings[0].kind, 'rules-review-advisory');
  assert.deepEqual(gate.warnings[0].items.map((i) => i.id), ['scenario#Directions']);
  assert.match(nextStep(3, MAX_REVIEW_ROUNDS, { blockers: 2, advisories: 1, tiered: true }), /needs-revision/);

  // Once blockers are resolved and only the advisory remains, releaseStatus becomes ready with advisory warning.
  const onlyAdvisory = [
    { ...normalized[0], verdict: 'pass', severity: 'none', reason: '关系已补齐' },
    { ...normalized[1], verdict: 'pass', severity: 'none', reason: '裁切已修复' },
    normalized[2]
  ];
  writeReview(dir, p, { reviewer: 'fake', items: onlyAdvisory, claims });
  const readyGate = reviewGate(p, dir);
  assert.equal(readyGate.releaseStatus, 'ready');
  assert.deepEqual(readyGate.issues, []);
  assert.equal(readyGate.warnings[0].kind, 'rules-review-advisory');
  assert.equal(readyGate.review.advisories.length, 1);
  assert.equal(inspectReviewScope(p, JSON.parse(fs.readFileSync(path.join(dir, REVIEW_FILE), 'utf8'))).globalChanged, false);
});

test('W4 V10: page-level image/text patch invalidates only affected page claims while global font/theme invalidates all', async (t) => {
  const { inspectReviewScope } = await import('../../skills/dawang-ppt/project/src/fusion/qa/rules-review.mjs');
  const { previousRound } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/independent-review.mjs');
  const { saveProject, loadProject } = await import('../../skills/dawang-ppt/project/src/fusion/project/store.mjs');
  const { patchProject } = await import('../../skills/dawang-ppt/project/src/fusion/project/patch.mjs');

  const dir = workspace(t);
  const p = createAuthoredProject({
    requirements: { projectId: 'w4-granularity', title: '局部失效测试', reviewContract: 'tiered-review-v1', ruleContract: 'rules-checklist-v1' },
    sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] },
    media: { entries: [{ mediaId: 'img1', src: 'a.jpg' }] },
    designChoice: { styleId: 'authored/custom' },
    contentPlan: {
      nodes: {},
      slides: [],
      ruleChecklist: {
        scenario: 'management-report',
        items: {
          'scenario#Visual#1': { status: 'applied', how: '第1页结构图', evidence: [{ slideId: 's1', elementIds: ['t1'] }] },
          'scenario#Visual#2': { status: 'applied', how: '第2页图文', evidence: [{ slideId: 's2', elementIds: ['t2'] }] },
          'scenario#Directions': { status: 'not-applicable', reason: '未借用' }
        }
      }
    },
    slides: [
      { slideId: 's1', elements: [{ id: 't1', type: 'text', text: '第一页稳定内容', bounds: [100, 100, 600, 60], style: { fontSize: 30 } }] },
      { slideId: 's2', elements: [
        { id: 't2', type: 'text', text: '第二页待改内容', bounds: [100, 100, 600, 60], style: { fontSize: 30 } },
        { id: 'pic2', type: 'image', mediaRef: 'img1', bounds: [100, 220, 400, 260], fit: 'cover' }
      ] }
    ]
  });
  p.requirements.ruleContract = 'rules-checklist-v1';
  p.requirements.reviewContract = 'tiered-review-v1';

  const file = path.join(dir, 'deck-project.json');
  const saved = saveProject(file, p, null).project;
  const claims = buildReviewPacket({ project: saved, rules, pages: [{ slideId: 's1', image: '1.png' }, { slideId: 's2', image: '2.png' }] }).claims;
  const items = normalizeVerdict({
    items: [
      { id: 'scenario#Visual#1', verdict: 'pass', reason: 's1 ok' },
      { id: 'scenario#Visual#2', verdict: 'pass', reason: 's2 ok' },
      { id: 'scenario#Directions', verdict: 'pass', reason: 'na ok' }
    ]
  }, claims, saved);
  writeReview(dir, saved, { reviewer: 'fake', items, claims });

  // 1) Patch image + text on s2 only -> s1 remains reusable, only s2 is invalidated.
  const patch1 = patchProject(dir, {
    expectedRevision: saved.revision,
    commands: [
      { type: 'text', slideId: 's2', elementId: 't2', text: '第二页修改后人物名称' },
      { type: 'image', slideId: 's2', elementId: 'pic2', src: 'b.jpg', focal: '50% 25%' }
    ]
  });
  assert(patch1.ok);
  assert.equal(patch1.checkScope, 'slides');
  assert.deepEqual(patch1.changedSlideIds, ['s2']);
  assert.deepEqual(patch1.reusableSlideIds, ['s1']);

  const afterS2 = loadProject(file);
  const record = JSON.parse(fs.readFileSync(path.join(dir, REVIEW_FILE), 'utf8'));
  const scopeS2 = inspectReviewScope(afterS2, record);
  assert.equal(scopeS2.globalChanged, false);
  assert.deepEqual(scopeS2.invalidatedSlideIds, ['s2']);
  assert.deepEqual(scopeS2.reusableSlideIds, ['s1']);
  assert.deepEqual(scopeS2.staleClaimIds, ['scenario#Visual#2']);
  assert.deepEqual(scopeS2.reusableClaimIds, ['scenario#Visual#1', 'scenario#Directions']);

  const prev = previousRound(dir, afterS2);
  assert(prev);
  assert.deepEqual(prev.scope.staleClaimIds, ['scenario#Visual#2']);
  assert.deepEqual(prev.scope.reusableClaimIds, ['scenario#Visual#1', 'scenario#Directions']);

  // 2) Global font/theme change -> checkScope is 'all' and all pages/claims are invalidated.
  writeReview(dir, afterS2, { reviewer: 'fake', items, claims });
  const patchGlobal = patchProject(dir, {
    expectedRevision: afterS2.revision,
    commands: [{ type: 'theme', fontFamily: 'PingFang SC', designChoice: { paletteId: 'earth-gold' } }]
  });
  assert(patchGlobal.ok);
  assert.equal(patchGlobal.checkScope, 'all');
  assert.deepEqual(patchGlobal.changedSlideIds, ['s1', 's2']);

  const afterGlobal = loadProject(file);
  const record2 = JSON.parse(fs.readFileSync(path.join(dir, REVIEW_FILE), 'utf8'));
  const scopeGlobal = inspectReviewScope(afterGlobal, record2);
  assert.equal(scopeGlobal.globalChanged, true);
  assert.deepEqual(scopeGlobal.invalidatedSlideIds, ['s1', 's2']);
  assert.deepEqual(scopeGlobal.reusableSlideIds, []);
  assert.equal(previousRound(dir, afterGlobal), null);
});
