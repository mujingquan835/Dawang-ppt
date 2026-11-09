import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildOutlineBaseline, missingContracts } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-baseline.mjs';
import { checkOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';
import { validateContentBaseline } from '../../skills/dawang-ppt/project/src/fusion/authoring/content-baseline.mjs';

const from = (locator) => ({ locator, excerpt: `${locator} 的原文` });
const outline = () => ({
  kind: 'report', scope: 'part', title: '合成汇报', audience: '管理层',
  sources: [{ sourceId: 'md', kind: 'markdown', title: '合成材料' }],
  pages: [{
    id: 'p1', role: 'results', keyLine: { text: '新签 20 单', source: 'distilled' },
    data: [{ label: '新签', value: '20', unit: '单', from: from('L1') }, { label: '完成率', value: '96%', from: from('L2') }],
    items: [{ title: '案例传播', detail: '每周两次', from: from('L3') }],
    flows: [{ title: '流程', steps: ['收集', '审核', '传播'], from: from('L4') }],
    compare: { left: [{ title: '去年' }], right: [{ title: '今年' }], from: from('L5') },
    table: { columns: ['线', '定位'], rows: [['二手房', '重点'], ['爱房', '持续']], from: from('L6') }
  }]
});

test('an outline becomes an independent baseline and a scaffold with every contract declared', () => {
  const r = buildOutlineBaseline(outline());
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  const { nodes, relations } = r.baseline.snapshot;
  assert.equal(r.baseline.origin, 'source-before-layout');
  assert.equal(nodes['p1:data-1'].facts.display, '20 单');
  assert.equal(nodes['p1:data-2'].facts.display, '96%');
  assert.equal(nodes['p1:data-2'].facts.unit, '%');
  assert.deepEqual(relations.map((x) => [x.id, x.kind]), [['p1:flow-1', 'sequence'], ['p1:compare', 'comparison'], ['p1:table', 'classification']]);
  assert.deepEqual(relations[0].edges.map((e) => [e.from, e.to]), [['p1:flow-1-1', 'p1:flow-1-2'], ['p1:flow-1-2', 'p1:flow-1-3']]);
  assert.deepEqual(missingContracts(r.scaffold), []);
  assert.deepEqual(r.scaffold.contentPlan.slides[0].requiredRefs.filter((x) => x === 'p1:flow-1'), ['p1:flow-1']);
  assert.deepEqual(validateContentBaseline(r.scaffold, r.baseline), []);
});

test('facts without a source location stop the baseline and are not put to the user', () => {
  const o = outline();
  delete o.pages[0].data[0].from;
  const built = buildOutlineBaseline(o);
  assert.equal(built.ok, false);
  assert.deepEqual(built.issues.map((i) => [i.kind, i.item]), [['outline-source-location-missing', 'p1:data-1']]);
  const check = checkOutline(o);
  assert.equal(check.ok, true);
  assert.deepEqual(check.gaps, []);
  assert.equal(check.baselineIssues.length, 1);
  assert.match(check.next, /baselineIssues/);
});

test('relations the agent identified are carried over, and only those', () => {
  const o = outline();
  o.relations = [{ id: 'p1:why', kind: 'support', members: ['p1:item-1', 'p1:data-1'], rows: [{ id: 'r', members: ['p1:item-1', 'p1:data-1'] }], from: from('L9'), page: 'p1' }];
  const r = buildOutlineBaseline(o);
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.baseline.snapshot.relations.at(-1).id, 'p1:why');
  assert.equal(r.baseline.snapshot.relations.at(-1).from, undefined);
  assert(r.scaffold.contentPlan.slides[0].requiredRefs.includes('p1:why'));
  o.relations[0].members = ['p1:item-1', 'p1:nothing'];
  o.relations[0].rows = [{ id: 'r', members: ['p1:item-1'] }];
  assert(buildOutlineBaseline(o).issues.some((i) => i.kind === 'content-relation-invalid'));
});

test('make refuses a new deck without contracts and creates no workspace', () => {
  const r = spawnSync('skills/dawang-ppt/project/node_modules/.bin/tsx', ['tests/fusion/helpers/new-deck-gate-run.jsx'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('outline:baseline writes both files and will not overwrite an existing baseline', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'outline.json'), out = path.join(dir, 'deck');
  fs.writeFileSync(input, JSON.stringify(outline()));
  const run = () => spawnSync('node', ['skills/dawang-ppt/scripts/dawang.mjs', 'outline:baseline', input, out], { encoding: 'utf8' });
  const first = run();
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.deepEqual(fs.readdirSync(out).sort(), ['authored-scaffold.json', 'content-baseline.json']);
  const second = run();
  assert.notEqual(second.status, 0);
  assert.match(second.stderr + second.stdout, /基线已存在/);
});
