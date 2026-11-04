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
