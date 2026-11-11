import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkOutline, suggestPattern } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';

const example = JSON.parse(fs.readFileSync(path.resolve('skills/dawang-ppt/examples/outline-work-report.json'), 'utf8'));

test('a complete work-report outline passes and goes straight to the first version', () => {
  const r = checkOutline(example);
  assert.equal(r.ok, true);
  assert.deepEqual(r.gaps, []);
  assert.deepEqual(r.warnings, []);
  assert.match(r.decision, /第一版/);
});

test('missing conclusion, issues, plan and period are relation gaps that never stop the first version', () => {
  const r = checkOutline({ kind: 'report', scope: 'full', pages: [
    { id: 'a', role: 'actions', keyLine: { text: '梳理三条业务线支持方式' } },
    { id: 'b', role: 'results', keyLine: { text: '新签 20 单' }, data: [{ label: '新签', value: '20' }] }
  ] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.gaps, []);
  const deck = r.relationGaps.filter((g) => g.level === 'deck').map((g) => g.item).sort();
  assert.deepEqual(deck, ['issues', 'period', 'plan', 'summary']);
  for (const g of r.relationGaps) for (const field of ['relation', 'have', 'question', 'whyItMatters', 'ask', 'afterFill', 'draftable', 'fallback']) assert(g[field], `${g.item} lacks ${field}`);
  assert(r.relationGaps.every((g) => !/材料未提供|不做/.test(g.fallback)));
  assert(r.warnings.some((w) => w.item === 'keyLine' && w.page === 'a'));
  assert(r.warnings.some((w) => w.item === 'unit' && w.page === 'b'));
  assert.match(r.decision, /不为这些关系缺口停下/);
});

test('performance reviews list duties, shortcomings, a plan and personal contribution as relations', () => {
  const r = checkOutline({ kind: 'review', scope: 'full', period: '2026年', pages: [{ id: 'a', role: 'results', keyLine: { text: '完成 12 个项目' }, data: [{ label: '项目', value: '12', unit: '个' }] }] });
  const items = r.relationGaps.map((g) => g.item);
  for (const item of ['duties', 'issues', 'plan', 'contribution']) assert(items.includes(item), item);
  assert.equal(r.ok, true);
});

test('each missing relation on a page is found, and an existing one is not reported', () => {
  const gaps = (p, extra = {}) => checkOutline({ kind: 'report', pages: [{ id: 'p', ...p }], ...extra }).relationGaps.map((g) => g.item);
  const data = [{ label: '新签', value: '48', unit: '单' }];
  assert.deepEqual(gaps({ role: 'results', keyLine: { text: '新签 48 单' }, data }), ['target']);
  assert.deepEqual(gaps({ role: 'results', keyLine: { text: '新签 48 单' }, data: [{ ...data[0], target: '50' }] }), []);
  assert.deepEqual(gaps({ role: 'actions', keyLine: { text: '搭建案例库' }, items: [{ title: '搭建案例库' }] }), ['result']);
  assert.deepEqual(gaps({ role: 'issues', keyLine: { text: '转化偏低' } }), ['cause', 'measure']);
  assert.deepEqual(gaps({ role: 'issues', keyLine: { text: '回访慢导致转化偏低，已建立改进措施' } }), []);
  assert.deepEqual(gaps({ role: 'plan', keyLine: { text: '建立回访机制' } }), ['owner-time']);
  assert.deepEqual(gaps({ role: 'plan', keyLine: { text: '10月底前建立回访，负责人张三' } }), []);
});

test('non-report decks are not held to report relations', () => {
  assert.deepEqual(checkOutline({ kind: 'training', pages: [{ id: 'p', role: 'issues', keyLine: { text: '常见错误' } }] }).relationGaps, []);
});

test('an XX placeholder counts as a figure', () => {
  const r = checkOutline({ kind: 'report', pages: [{ id: 'p', role: 'results', keyLine: { text: '完成 XX 单' }, data: [{ label: '完成', value: 'XX', unit: '单', target: 'XX' }] }] });
  assert(!r.warnings.some((w) => w.item === 'keyLine' || w.item === 'unit'));
  assert.deepEqual(r.relationGaps, []);
});

test('only an outline with no pages asks the user for material', () => {
  const r = checkOutline({ kind: 'report', pages: [] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.gaps.map((g) => g.item), ['pages']);
  assert.match(r.decision, /向用户要材料/);
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

test('a partial job (the default) checks only its own pages, never deck-level pieces', () => {
  const pages = [
    { id: 'a', role: 'actions', keyLine: { text: '梳理三条业务线支持方式' } },
    { id: 'b', role: 'results', keyLine: { text: '新签 20 单' }, data: [{ label: '新签', value: '20', unit: '单' }] }
  ];
  const r = checkOutline({ kind: 'report', pages });
  assert.equal(r.scope, 'part');
  assert.equal(r.ok, true);
  assert(r.relationGaps.every((g) => g.level === 'page'));
  // The period is only a note on a partial job.
  assert(r.warnings.some((w) => w.item === 'period'));
  // A page with no key line is the agent's to distill.
  const noKey = checkOutline({ kind: 'report', pages: [{ id: 'c', role: 'results', data: [{ label: 'x', value: '1', unit: '单' }] }] });
  assert.deepEqual(noKey.gaps, []);
  assert(noKey.warnings.some((w) => w.item === 'keyLine'));
});

test('targets, comparisons and photos without items are pointed out so the report page types can be suggested', () => {
  const page = (extra) => ({ kind: 'report', pages: [{ id: 'p1', role: 'results', keyLine: { text: '到店 12,860 人' }, data: [{ label: '到店人数', value: '12860', unit: '人' }], ...extra }] });
  const items = (o) => checkOutline(o, '/').warnings.map((w) => w.item);
  assert(items(page({ data: [{ label: '到店人数｜目标10,000人', value: '12860', unit: '人' }] })).includes('target'));
  assert(!items(page({ data: [{ label: '到店人数', value: '12860', unit: '人', target: '10000' }] })).includes('target'));
  assert(items(page({ keyLine: { text: '到店人数同比增长 56%' } })).includes('compare'));
  const photo = { src: 'x.jpg' };
  assert(items(page({ photos: [photo, photo, photo] })).includes('items'));
  const acts = [1, 2, 3].map((i) => ({ title: `动作${i}`, detail: '活动前3天直播3场；核销到店2,310人' }));
  assert.equal(suggestPattern({ items: acts, photos: [photo, photo, photo], data: [{}] }), 'itemsWithPhotos');
});

test('the delivery note is written out in full, page by page', () => {
  const r = checkOutline({ kind: 'report', pages: [{ id: 'x', role: 'other', keyLine: { text: 'a' } }, { id: 'y', role: 'results', keyLine: { text: '新签 48 单' }, data: [{ label: '新签', value: '48', unit: '单' }] }] });
  assert.equal(r.deliveryNote.gaps.length, 1);
  assert.match(r.deliveryNote.gaps[0], /^第 2 页，新签 48 单算好还是差？材料里有：.*例如.*补上后/);
  assert.equal(checkOutline(example).deliveryNote?.gaps.length, checkOutline(example).relationGaps.length);
});
