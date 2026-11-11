import test from 'node:test';
import assert from 'node:assert/strict';
import { figuresIn, keyLineFigureIssues, wordingWarnings } from '../../skills/dawang-ppt/project/src/fusion/authoring/wording.mjs';
import { outlineBaselineIssues } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-baseline.mjs';
import { checkOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';

const items = (list) => list.map((w) => w.item);

test('figures are numbers, not dates or ordinals', () => {
  assert.deepEqual(figuresIn('2027 年留资目标 52,000 条，Q3 预算 680 万元，第 2 期同比 -23%，曝光 1.50 亿').map((f) => f.value), ['52000', '680', '23', '1.5']);
});

test('a figure in a title must be on its page; the cover’s on some page of the deck', () => {
  const outline = { kind: 'review', pages: [
    { id: 'cover', role: 'cover', keyLine: { text: '集客完成目标的 114.7%' }, data: [{ label: '销量', value: '3,156', unit: '台' }] },
    { id: 'p1', role: 'results', keyLine: { text: '七项指标全部达成，留资 41,280 条' }, data: [{ label: '留资', value: '41280', unit: '条' }], table: { columns: ['指标', '完成率'], rows: [['留资', '114.7%']] } },
    { id: 'p2', role: 'actions', keyLine: { text: '蓟州露营单台营销成本仅 380 元' }, data: [{ label: '话题曝光', value: '2,300', unit: '万' }] }
  ] };
  const issues = keyLineFigureIssues(outline);
  assert.deepEqual(issues.map((i) => [i.page, i.figures]), [['p2', ['380']]]);
  assert.match(issues[0].need, /限定/);
  // It stops outline:baseline like a missing source location does.
  assert(outlineBaselineIssues({ ...outline, sources: [{ sourceId: 'm', kind: 'markdown' }], audience: '管理层' }).some((i) => i.kind === 'outline-keyline-figure-missing'));
});

test('one thing counted two ways across the deck is pointed out', () => {
  const outline = { kind: 'review', pages: [
    { id: 'p1', role: 'summary', keyLine: { text: '三条线并行，七项指标全部达成' } },
    { id: 'p2', role: 'actions', keyLine: { text: '四线并进，三项核心指标超额' } }
  ] };
  const found = wordingWarnings(outline);
  assert.deepEqual(items(found), ['wording-count']);
  assert.match(found[0].ask, /三条线.*四线/);
});

test('the same figure carries the same target on every page, unless its label already says how it did', () => {
  const tile = (extra) => ({ label: '新增有效线索成本', value: '142', unit: '元/条', ...extra });
  const outline = (coverLabel) => ({ kind: 'review', pages: [
    { id: 'cover', role: 'cover', keyLine: { text: '整体超额' }, data: [tile(coverLabel ? { label: coverLabel } : {})] },
    { id: 'p1', role: 'results', keyLine: { text: '指标全部达成' }, data: [tile({ target: '≤180' })] }
  ] });
  assert.deepEqual(items(wordingWarnings(outline())), ['wording-target']);
  assert.deepEqual(items(wordingWarnings(outline('线索成本 · 优于目标 21%'))), []);
});

test('the same label with different values is a candidate only when the unit is the same', () => {
  const page = (id, value, unit) => ({ id, role: 'results', keyLine: { text: '完成' }, data: [{ label: '甲', value, unit }] });
  assert.deepEqual(items(wordingWarnings({ kind: 'report', pages: [page('p1', '3', '单'), page('p2', '12', '万元')] })), []);
  assert.deepEqual(items(wordingWarnings({ kind: 'report', pages: [page('p1', '3', '单'), page('p2', '4', '单')] })), ['wording-metric']);
});

test('a title keeps the scope its own tile gives the figure', () => {
  const page = (title, label) => ({ kind: 'review', pages: [{ id: 'p2', role: 'actions', keyLine: { text: title }, data: [{ label, value: '380', unit: '元' }] }] });
  assert.deepEqual(items(wordingWarnings(page('露营单台营销成本仅 380 元', '蓟州露营单台营销成本'))), ['wording-scope']);
  assert.deepEqual(items(wordingWarnings(page('蓟州露营单台营销成本仅 380 元', '蓟州露营单台营销成本'))), []);
  // Words that name the whole period narrow nothing.
  assert.deepEqual(items(wordingWarnings(page('申请总投入 380 元', '活动申请总投入'))), []);
});

test('a streak in a title needs every period on the page', () => {
  const page = (rows, columns) => ({ kind: 'review', pages: [{ id: 'p1', role: 'results', keyLine: { text: '线索成本连续两年下降' }, table: { columns, rows } }] });
  assert.deepEqual(items(wordingWarnings(page([['线索成本', '142', '-23%']], ['指标', '2026 实际', '同比 2025']))), ['wording-streak']);
  assert.deepEqual(items(wordingWarnings(page([['线索成本', '240', '185', '142']], ['指标', '2024', '2025', '2026']))), []);
});

test('outline:check lists the wording candidates with the other warnings', () => {
  const r = checkOutline({ kind: 'review', pages: [{ id: 'p1', role: 'summary', keyLine: { text: '三条线并行' } }, { id: 'p2', role: 'actions', keyLine: { text: '四线并进' } }] });
  assert(r.warnings.some((w) => w.item === 'wording-count'));
});
