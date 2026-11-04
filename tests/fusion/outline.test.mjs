import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkOutline, suggestPattern } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';

const example = JSON.parse(fs.readFileSync(path.resolve('skills/dawang-ppt/examples/outline-work-report.json'), 'utf8'));

test('a complete work-report outline has no gaps and only the optional asks warning', () => {
  const r = checkOutline(example);
  assert.equal(r.ok, true);
  assert.deepEqual(r.gaps, []);
  assert.deepEqual(r.warnings.map((w) => w.item), ['asks']);
  assert.match(r.decision, /进入配色与制作/);
});

test('missing conclusion, issues, plan and period are gaps with their cost, and the user is asked to decide', () => {
  const r = checkOutline({ kind: 'report', scope: 'full', pages: [
    { id: 'a', role: 'actions', keyLine: { text: '梳理三条业务线支持方式' } },
    { id: 'b', role: 'results', keyLine: { text: '新签 20 单' }, data: [{ label: '新签', value: '20' }] }
  ] });
  assert.deepEqual(r.gaps.map((g) => g.item).sort(), ['issues', 'period', 'plan', 'summary']);
  assert(r.gaps.every((g) => g.ask && g.impact));
  assert(r.warnings.some((w) => w.item === 'keyLine' && w.page === 'a'));
  assert(r.warnings.some((w) => w.item === 'unit' && w.page === 'b'));
  assert.match(r.decision, /只问一次/);
});

test('performance reviews need duties, results, shortcomings and a plan', () => {
  const r = checkOutline({ kind: 'review', scope: 'full', period: '2026年', pages: [{ id: 'a', role: 'results', keyLine: { text: '完成 12 个项目' }, data: [{ label: '项目', value: '12', unit: '个' }] }] });
  assert.deepEqual(r.gaps.map((g) => g.item).sort(), ['duties', 'issues', 'plan']);
});

test('page type suggestions put data before photos', () => {
  const photo = { src: 'x.jpg' }, d = (n) => Array.from({ length: n }, (_, i) => ({ label: `指标${i}`, value: String(i), unit: '单' }));
  assert.equal(suggestPattern({ data: d(3), photos: [photo, photo, photo] }), 'listWithPhotos');
  assert.equal(suggestPattern({ data: d(4), photos: [photo] }), 'metricsWithEvidence');
  assert.equal(suggestPattern({ data: d(1), photos: [photo, photo, photo], items: [{}, {}, {}] }), 'photoPanels');
  assert.equal(suggestPattern({ data: d(3) }), 'metricTiles');
  assert.equal(suggestPattern({ table: { rows: [['a']] }, flows: [{}] }), 'tableWithFlows');
  assert.equal(suggestPattern({ table: { rows: [['a']] }, chains: [{}] }), 'tableWithPanel');
});

test('a partial job (the default) checks only its own pages and asks nothing when they are complete', () => {
  const pages = [
    { id: 'a', role: 'actions', keyLine: { text: '梳理三条业务线支持方式' } },
    { id: 'b', role: 'results', keyLine: { text: '新签 20 单' }, data: [{ label: '新签', value: '20', unit: '单' }] }
  ];
  const r = checkOutline({ kind: 'report', pages });
  assert.equal(r.scope, 'part');
  assert.deepEqual(r.gaps, []);
  assert.match(r.decision, /不要为内容再提问/);
  // The period is only a note on a partial job.
  assert(r.warnings.some((w) => w.item === 'period'));
  // A page with no key line is still worth one question.
  assert.deepEqual(checkOutline({ kind: 'report', pages: [{ id: 'c', role: 'results', data: [{ label: 'x', value: '1', unit: '单' }] }] }).gaps.map((g) => g.item), ['keyLine']);
});
