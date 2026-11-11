import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceLineBreaks } from '../../skills/dawang-ppt/project/src/fusion/authoring/report-deck.mjs';
import { createLayoutMeasurer } from '../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';

// User feedback 2026-11-11: "客户。" alone on the last line and "转介/绍率" split across two lines.
test('a short last line or a cut word is moved by narrowing the box, never by adding a line', async (t) => {
  const measurer = await createLayoutMeasurer();
  t.after(() => measurer.close());
  const style = { fontSize: 24, lineHeight: 1.5 };
  const box = async (text, keep) => { const [m] = await measurer.texts([{ id: 'w', type: 'text', text: text.slice(0, keep), bounds: [0, 0, 3000, 40], style }]); return Math.ceil(m.naturalWidth) + 2; };
  const lines = async (e) => (await measurer.texts([{ ...e, lastLine: true }]))[0];

  const orphan = '让每一分营销费用，都能换算成门店展厅里的那一批客户，并且让每一分投入都看得见回报的那一批客户。';
  const a = { id: 'a', type: 'text', text: orphan, bounds: [100, 0, await box(orphan, orphan.length - 2), 80], style };
  const cut = '品牌联名做高度、商超静展做广度、车主社群做深度、门店直播做速度，把留资成本打下来、把转介绍率做上去。';
  const b = { id: 'b', type: 'text', text: cut, bounds: [100, 0, await box(cut, cut.indexOf('介') + 1), 80], style };
  const before = [await lines(a), await lines(b)];
  assert.equal(before[0].lastLineChars, 2);
  assert(before[1].breaks.includes(cut.indexOf('绍')), 'the word is cut before the fix');

  assert.deepEqual(await balanceLineBreaks([{ elements: [a, b] }], measurer), ['a', 'b']);
  const after = [await lines(a), await lines(b)];
  assert(after[0].lastLineChars > 4 && after[0].lines === before[0].lines, JSON.stringify(after[0]));
  assert(!after[1].breaks.some((k) => k > cut.indexOf('转') && k <= cut.indexOf('率')) && after[1].lines === before[1].lines, JSON.stringify(after[1]));
  // Narrowed boxes keep their left edge.
  assert.equal(a.bounds[0], 100);
});
