import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheme, imageFrames, sidePanel, metricTiles } from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';
import { lintComposition } from '../../skills/dawang-ppt/project/src/fusion/qa/composition-lint.mjs';

const theme = createTheme({ palette: { bg: '#F8F5EF', ink: '#5E1F2D', accent: '#A35536', primary: '#5E1F2D' } });
const kinds = (els) => lintComposition(els).map((w) => w.kind);
const img = (id, b) => ({ type: 'image', id, src: 'x', bounds: b, fit: 'contain' });

test('frames always tile their box with cover crops, even for a portrait among wide photos', () => {
  const images = [{ src: 'a', size: { width: 900, height: 1600 } }, { src: 'b', size: { width: 1600, height: 900 } }, { src: 'c', size: { width: 1600, height: 800 } }];
  const f = imageFrames({ id: 'p', x: 1000, y: 260, width: 900, height: 600, images, theme });
  const boxes = f.elements.filter((e) => e.type === 'image');
  assert.equal(boxes.length, 3);
  assert(boxes.every((b) => b.fit === 'cover'));
  assert.equal(Math.min(...boxes.map((b) => b.bounds[0])), 1000);
  assert.equal(Math.max(...boxes.map((b) => b.bounds[0] + b.bounds[2])), 1900);
  assert.equal(Math.min(...boxes.map((b) => b.bounds[1])), 260);
  assert.equal(Math.max(...boxes.map((b) => b.bounds[1] + b.bounds[3])), 860);
  assert.deepEqual(kinds(f.elements), []);
  // A box no mild crop can fill still gets frames instead of null.
  assert(imageFrames({ id: 'q', x: 0, y: 0, width: 1800, height: 200, images: images.slice(0, 1), theme }));
});

test('photos shrunk to their own ratios with gaps are flagged; the same photos framed edge to edge pass', () => {
  // Before the user's edit: three photos each fitted whole, leaving ragged gaps.
  const before = [img('a', [993, 412, 317, 365]), img('b', [1343, 266, 553, 277]), img('c', [1343, 641, 553, 230])];
  assert.deepEqual(kinds(before), ['image-group-gaps']);
  // After: a tall frame left, two stacked frames right, edges level.
  const after = [img('a', [999, 257, 316, 605]), img('b', [1349, 257, 551, 302]), img('c', [1349, 585, 551, 277])];
  assert.deepEqual(kinds(after), []);
});

test('a wide tile with an empty right strip and no icon is flagged; the kit tile is not', () => {
  const bare = [{ type: 'shape', id: 't', bounds: [96, 790, 790, 180], style: { fill: '#FFFFFF', radius: 10 } },
    { type: 'text', id: 'l', text: '直播券核销 / 全部到店', bounds: [124, 812, 740, 30], style: { fontSize: 22 } },
    { type: 'text', id: 'v', text: '18.0 %', runs: [{ text: '18.0', style: { fontSize: 64 } }, { text: ' %', style: { fontSize: 22 } }], bounds: [124, 850, 740, 80], style: { fontSize: 64 } }];
  assert.deepEqual(kinds(bare), ['tile-spare-no-icon']);
  const kit = metricTiles({ id: 'm', x: 96, y: 790, width: 790, theme, size: 64, items: [{ label: '直播券核销 / 全部到店', value: '18.0', unit: '%' }] });
  assert.deepEqual(kinds(kit.elements), []);
});

test('list items lined up with spaces in one text box are flagged; the side panel lays them out with badges', () => {
  const manual = { type: 'text', id: 'tasks', text: '01  收银台由 4 个增至 8 个\n      另增加 2 台移动收银\n\n02  线上预约分流', bounds: [1196, 575, 588, 370], style: { fontSize: 28 } };
  assert.deepEqual(kinds([manual]), ['text-manual-list']);
  const panel = sidePanel({ id: 'ask', bounds: [1156, 200, 668, 800], theme, figure: { label: '需要审批的支持', value: '3.2', unit: '万元', note: '移动收银设备采购预算' },
    list: { title: '下一步', items: [{ title: '收银台由 4 个增至 8 个', detail: '另增加 2 台移动收银' }, { title: '线上预约分流 30% 高峰客流' }, { title: '直播券增加“工作日专享”', detail: '引导周一至周五到店' }] } });
  assert.deepEqual(kinds(panel.elements), []);
  const content = panel.elements.filter((e) => e.type === 'text'), bottom = Math.max(...content.map((e) => e.bounds[1] + e.bounds[3]));
  // Content reaches the lower part of the panel instead of leaving an empty dark strip.
  assert(1000 - bottom <= 120, `panel leaves ${1000 - bottom}px empty at the bottom`);
  const item = panel.elements.find((e) => e.id === 'ask-item-1'), detail = panel.elements.find((e) => e.id === 'ask-item-1-detail');
  assert.equal(detail.bounds[0], item.bounds[0]);
  assert.throws(() => sidePanel({ id: 'x', bounds: [0, 0, 400, 200], theme, list: { items: Array.from({ length: 6 }, () => ({ title: '一项很长的工作内容需要换行' })) } }), /does not fit/);
});

test('a framed photo later shown whole or shrunk inside its frame is flagged', async () => {
  const f = imageFrames({ id: 'p', x: 900, y: 370, width: 924, height: 420, images: [{ src: 'a', size: { width: 1600, height: 1200 } }], theme });
  const img = f.elements.find((e) => e.type === 'image');
  assert.deepEqual(img.frame, img.bounds);
  assert.deepEqual(kinds([{ ...img, fit: 'contain' }]), ['image-frame-broken']);
  assert.deepEqual(kinds([{ ...img, bounds: [1000, 470, 355, 200] }]), ['image-frame-broken']);
  // Moving the crop is the fix, and it passes.
  assert.deepEqual(kinds([{ ...img, focal: '50% 20%' }]), []);
});

test('a whole photo in a box of another shape leaves empty bands and is flagged', () => {
  assert.deepEqual(kinds([{ type: 'image', id: 'i', src: 'x', bounds: [900, 370, 924, 420], fit: 'contain', naturalSize: [1600, 1200] }]), ['image-letterbox']);
  assert.deepEqual(kinds([{ type: 'image', id: 'i', src: 'x', bounds: [900, 370, 560, 420], fit: 'contain', naturalSize: [1600, 1200] }]), []);
});

test('a lone takeaway sentence is flagged; on a conclusion bar it is not', async () => {
  const { noteBar } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs');
  const lone = { type: 'text', id: 'closing', text: '客流显著增长，下一次重点提升成交效率。', bounds: [96, 790, 760, 100], style: { fontSize: 32, fontWeight: 600 } };
  const tile = { type: 'shape', id: 'tile', bounds: [96, 560, 760, 180], style: { fill: '#FFFFFF', radius: 12 } };
  assert.deepEqual(kinds([tile, lone]), ['text-orphan']);
  const bar = noteBar({ id: 'closing', x: 96, y: 790, width: 760, text: lone.text, theme });
  assert.deepEqual(kinds([tile, ...bar.elements]), []);
  // A line that is part of a text group (a column of facts) is not an orphan.
  assert.deepEqual(kinds([{ ...lone, id: 'a', bounds: [96, 700, 760, 50] }, { ...lone, id: 'b', bounds: [96, 780, 760, 50] }]), []);
});

test('a list split across columns keeps counting, and a narrow conclusion bar stacks its label and can match a neighbour', async () => {
  const { numberedList, noteBar } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs');
  const l = numberedList({ id: 'a', x: 0, y: 0, width: 500, items: [{ title: '门店快闪布景' }], theme, start: 2 });
  assert.equal(l.elements.find((e) => e.id === 'a-num-1').text, '02');
  const bar = noteBar({ id: 'n', x: 96, y: 758, width: 760, text: '客流显著增长，下一次重点提升成交效率。', theme, height: 196 });
  const label = bar.elements.find((e) => e.id === 'n-label'), text = bar.elements.find((e) => e.id === 'n-text');
  assert.equal(bar.height, 196);
  assert(label.bounds[1] < text.bounds[1] && label.bounds[0] === text.bounds[0], 'label sits above the sentence');
});

test('report components fit any region, take words as values, and pass the composition checks', async () => {
  const { answerBlock, comparePair, contrastPair, periodBand } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/report-kit.mjs');
  const a = answerBlock({ id: 'a', x: 96, y: 200, width: 700, label: '整体判断', value: '超额完成', note: '成交转化仍偏低', theme });
  assert.equal(a.elements[0].component, 'answerBlock');
  assert.equal(a.elements.find((e) => e.id === 'a-value').text, '超额完成');
  const c = comparePair({ id: 'c', x: 900, y: 200, width: 900, before: { label: '之前', value: '人工排期' }, after: { label: '之后', value: '自动排期' }, theme });
  assert(c.elements.some((e) => e.component === 'comparePair'));
  // Sides need not pair: three points against one.
  const k = contrastPair({ id: 'k', x: 96, y: 500, width: 1728, left: { title: '现状', points: ['一', '二', '三'] }, right: { title: '改进', points: ['统一流程'] }, theme });
  const s1 = k.elements.find((e) => e.id === 'k-side-1'), s2 = k.elements.find((e) => e.id === 'k-side-2');
  assert.equal(s1.bounds[3], s2.bounds[3]);
  const b = periodBand({ id: 'b', x: 96, y: 900, width: 1728, periods: ['11 月', '12 月'], theme });
  assert.equal(b.columns.length, 2);
  assert.deepEqual(kinds([...a.elements, ...c.elements]), []);
  assert.deepEqual(kinds(k.elements), []);
  const { metricTiles: tiles } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs');
  const t = tiles({ id: 't', x: 96, y: 200, width: 1728, theme, highlight: 1, highlightStyle: 'solid', items: [{ label: '甲', value: '1' }, { label: '乙', value: '2' }, { label: '丙', value: '3' }] });
  const on = t.elements.find((e) => e.id === 't-tile-2');
  assert.equal(on.component, 'highlightTile');
  assert.equal(on.style.fill, theme.palette.primary);
  assert.equal(t.elements.find((e) => e.id === 't-value-2').runs[0].style.color, theme.palette.inverse);
});

test('a block running into the footer band is flagged', () => {
  const source = { type: 'text', id: 'source', text: '演示用 · 数据均为虚构', bounds: [96, 1028, 900, 28], style: { fontSize: 17 } };
  const bar = { type: 'shape', id: 'bar', bounds: [96, 912, 760, 131], style: { fill: '#EFE5DA', radius: 12 } };
  assert(kinds([source, bar]).includes('block-into-footer'));
  assert(!kinds([source, { ...bar, bounds: [96, 870, 760, 130] }]).includes('block-into-footer'));
});
