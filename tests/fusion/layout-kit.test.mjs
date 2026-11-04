import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTheme, createGrid, estimateLines, metricGroup, flow, imageRow, imageSize, table } from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';
import { lintLayout } from '../../skills/dawang-ppt/project/src/fusion/qa/layout-lint.mjs';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { validateProject } from '../../skills/dawang-ppt/project/src/fusion/project/schema.mjs';
import { reviewVisualDecisions } from '../../skills/dawang-ppt/project/src/fusion/qa/visual-decisions.mjs';
import { authored } from '../../skills/dawang-ppt/examples/layout-patterns.mjs';

const theme = createTheme(), grid = createGrid();
const byId = (els, id) => els.find((e) => e.id === id);

test('the grid spans the content width and text estimates count CJK as one em', () => {
  const [x, w] = grid.span(0, 12);
  assert.equal(x, 96); assert.equal(w, 1728);
  // Lines fill to 95% of the box: five 20px characters need a 106px box.
  assert.equal(estimateLines('一二三四五', 20, 106), 1);
  assert.equal(estimateLines('一二三四五', 20, 100), 2);
  assert.equal(estimateLines('“引号”', 20, 86), 1);
  assert.equal(estimateLines('“引号”', 20, 80), 2);
  assert.equal(estimateLines('a\nb', 20, 100), 2);
});

test('a metric keeps value and unit in one text element with the label directly below', () => {
  const m = metricGroup({ id: 'm', x: 100, y: 200, width: 300, value: '20', unit: '单', label: '辅助新签', size: 100, theme });
  const v = byId(m.elements, 'm-value'), l = byId(m.elements, 'm-label');
  assert.deepEqual(v.runs.map((r) => r.text), ['20', ' 单']);
  assert.equal(l.bounds[0], v.bounds[0]);
  assert(l.bounds[1] >= v.bounds[1] + v.bounds[3]);
});

test('flow labels start at their node and arrows sit between nodes', () => {
  const f = flow({ id: 'f', x: 100, y: 500, width: 900, steps: [{ title: '一', detail: 'a' }, { title: '二' }, { title: '三' }], theme });
  for (const i of [1, 2, 3]) assert.equal(byId(f.elements, `f-title-${i}`).bounds[0], byId(f.elements, `f-node-${i}`).bounds[0]);
  const link = byId(f.elements, 'f-link-1');
  assert.equal(link.endArrow, true);
  assert(link.bounds[0] > byId(f.elements, 'f-node-1').bounds[0] && link.bounds[0] + link.bounds[2] < byId(f.elements, 'f-node-2').bounds[0]);
});

test('an image row shares one height, follows aspect ratios, and never enlarges a small photo past 2×', () => {
  const r = imageRow({ id: 'r', x: 0, y: 0, width: 1200, theme, images: [{ src: 'a', size: { width: 360, height: 480 }, caption: '甲' }, { src: 'b', size: { width: 384, height: 256 } }] });
  const [a, b] = r.elements.filter((e) => e.type === 'image');
  assert.equal(a.bounds[3], b.bounds[3]);
  assert(a.bounds[3] <= 512);
  assert(Math.abs(b.bounds[2] / b.bounds[3] - 1.5) < 0.02);
  assert.equal(byId(r.elements, 'r-caption-1').bounds[0], a.bounds[0]);
});

test('imageSize reads PNG and JPEG headers', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const png = Buffer.alloc(24); png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(640, 16); png.writeUInt32BE(320, 20);
  fs.writeFileSync(path.join(dir, 'a.png'), png);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x01, 0x00, 0x02, 0x00, 3, 0, 0, 0]);
  fs.writeFileSync(path.join(dir, 'b.jpg'), jpg);
  assert.deepEqual(imageSize(path.join(dir, 'a.png')), { width: 640, height: 320 });
  assert.deepEqual(imageSize(path.join(dir, 'b.jpg')), { width: 512, height: 256 });
});

test('table rows grow with the tallest cell', () => {
  const tb = table({ id: 't', x: 0, y: 0, theme, columns: [{ key: 'a', label: 'A', width: 200 }, { key: 'b', label: 'B', width: 200 }], rows: [{ a: '短', b: '很长的一段文字需要换行很多次才能放下' }, { a: '短', b: '短' }] });
  const r1 = byId(tb.elements, 't-rule-1').bounds[1], r2 = byId(tb.elements, 't-rule-2').bounds[1];
  assert(r1 - byId(tb.elements, 't-head-rule').bounds[1] > r2 - r1);
});

test('the lint flags uneven image rows, detached units, near misses and upscaled photos', () => {
  const img = (id, x, h, extra = {}) => ({ type: 'image', id, src: 'x', bounds: [x, 100, 300, h], ...extra });
  const text = (id, s, x, y, size = 24) => ({ type: 'text', id, text: s, bounds: [x, y, 400, size * 1.3], style: { fontSize: size } });
  const kinds = lintLayout([
    img('a', 0, 200), img('b', 320, 260), img('c', 700, 200, { naturalSize: [100, 80] }),
    text('n', '150', 0, 500, 96), text('u', '份', 400, 520),
    text('t1', '标题', 0, 800), text('t2', '说明', 6, 836)
  ]).map((w) => w.kind);
  assert.deepEqual([...new Set(kinds)].sort(), ['image-row-uneven', 'image-upscaled', 'metric-unit-detached', 'near-misaligned']);
});

test('every pattern page in the example is valid, inside the canvas, lint-clean and passes the visual checks', () => {
  const project = createAuthoredProject(structuredClone(authored));
  assert.deepEqual(validateProject(project), []);
  for (const slide of authored.slides) {
    for (const e of slide.elements) {
      const [x, y, w, h] = e.bounds;
      assert(x >= 0 && y >= 0 && x + w <= 1920 && y + h <= 1080, `${slide.slideId}/${e.id} leaves the canvas: ${e.bounds}`);
    }
    assert.deepEqual(lintLayout(slide.elements), [], slide.slideId);
    const ids = slide.elements.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `${slide.slideId} has duplicate ids`);
  }
  const r = reviewVisualDecisions(project);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.warnings.filter((w) => w.kind !== 'visual-layout-repeated'), []);
});

test('items with photos keep each photo inside its own item column, sized to its pixels', async () => {
  const slide = authored.slides.find((s) => s.slideId === 'p6');
  for (const i of [1, 2, 3]) {
    const panel = slide.elements.find((e) => e.id === `item-${i}-panel`), photo = slide.elements.find((e) => e.id === `item-${i}-photo`);
    assert(photo.bounds[0] >= panel.bounds[0] && photo.bounds[0] + photo.bounds[2] <= panel.bounds[0] + panel.bounds[2], `photo ${i} leaves its column`);
    assert(photo.bounds[2] <= photo.naturalSize[0] * 2 + 1);
  }
});

test('a zone with a large empty block is reported as sparse', () => {
  const project = createAuthoredProject({
    requirements: { projectId: 'sparse', title: '合成' }, sources: { entries: [{ sourceId: 's', kind: 'synthetic' }] }, media: { entries: [] },
    designChoice: { styleId: 'authored/custom' },
    contentPlan: { nodes: {}, slides: [{ slideId: 'a', visualDecision: { focus: { elementId: 'big' }, layout: '左上大字', zones: [{ id: 'main', role: 'focus', bounds: [96, 200, 1728, 760] }] } }] },
    slides: [{ slideId: 'a', elements: [{ id: 'big', type: 'text', text: '42%', bounds: [96, 200, 500, 200], style: { fontSize: 160 } }] }]
  });
  const w = reviewVisualDecisions(project).warnings.find((x) => x.kind === 'visual-zone-sparse');
  assert(w && w.zone === 'main' && w.emptyShare > 0.5);
});

test('imageFill covers the whole box with mild crops, or declines when crops would be heavy', async () => {
  const { imageFill } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs');
  const imgs = [{ src: 'a', size: { width: 360, height: 480 } }, { src: 'b', size: { width: 384, height: 256 } }, { src: 'c', size: { width: 384, height: 256 } }];
  const f = imageFill({ id: 'p', x: 0, y: 0, width: 1000, height: 650, images: imgs, theme });
  const boxes = f.elements.filter((e) => e.type === 'image');
  assert(f.crop <= 1.45);
  assert.equal(Math.max(...boxes.map((b) => b.bounds[0] + b.bounds[2])), 1000);
  assert.equal(Math.max(...boxes.map((b) => b.bounds[1] + b.bounds[3])), 650);
  assert(boxes.every((b) => b.fit === 'cover'));
  assert.equal(imageFill({ id: 'p', x: 0, y: 0, width: 1800, height: 200, images: imgs.slice(0, 1), theme }), null);
});

test('metric tiles put each number in a rounded block with its label above; the highlight gets an accent bar', async () => {
  const { metricTiles } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs');
  const t = metricTiles({ id: 'm', x: 0, y: 0, width: 1000, items: [{ value: '20', unit: '单', label: '新签' }, { value: '30', unit: '单', label: '续费' }], theme });
  const tile = byId(t.elements, 'm-tile-1'), label = byId(t.elements, 'm-label-1'), value = byId(t.elements, 'm-value-1');
  assert.equal(tile.style.radius, 14);
  assert(label.bounds[1] < value.bounds[1] && value.bounds[1] + value.bounds[3] <= tile.bounds[1] + tile.bounds[3]);
  assert(byId(t.elements, 'm-bar-1') && !byId(t.elements, 'm-bar-2'));
  assert.equal(value.runs[0].style.color, theme.palette.accent);
});

test('photo panels fade from the panel colour into the photo and keep text on the solid side', () => {
  const slide = authored.slides.find((s) => s.slideId === 'p7');
  for (const i of [1, 2, 3]) {
    const fade = byId(slide.elements, `panel-${i}-fade`), title = byId(slide.elements, `panel-${i}-title`), photo = byId(slide.elements, `panel-${i}-photo`);
    assert.match(fade.style.fill, /^linear-gradient\(/);
    assert(/rgba\([^)]*, 0\) 100%/.test(fade.style.fill));
    assert.equal(photo.fit, 'cover');
    // Text stays left of (or above) where the photo begins.
    assert(title.bounds[0] + title.bounds[2] <= photo.bounds[0] + photo.bounds[2]);
  }
});

test('photo panels refuse data-heavy content, which belongs in metric tiles', async () => {
  const { photoPanels, pageHeader } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/patterns.mjs');
  const header = pageHeader({ theme, grid, title: '合成' }), photo = { src: 'x', size: { width: 1600, height: 900 } };
  assert.throws(() => photoPanels({ theme, grid, header, panels: [{ title: '门票', lines: ['春季 800 张、秋季 400 张'], photo }, { title: '门店', lines: ['维护 80 家，新增 2 个'], photo }] }), /metric tiles/);
});

test('tiles add an icon only when there is spare room, sized to it, and pick it from the label', async () => {
  const { metricTiles } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs');
  const { pickIcon } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/icons.mjs');
  assert.equal(pickIcon('续费金额万元'), 'coin');
  assert.equal(pickIcon('辅助新签单'), 'pen');
  assert.equal(pickIcon('门店客情维护家'), 'store');
  const wide = metricTiles({ id: 'w', x: 0, y: 0, width: 1000, items: [{ value: '20', unit: '单', label: '辅助新签' }], theme });
  const icon = byId(wide.elements, 'w-tile-1-icon'), tile = byId(wide.elements, 'w-tile-1');
  assert(icon && icon.type === 'vector' && icon.bounds[0] + icon.bounds[2] <= tile.bounds[0] + tile.bounds[2]);
  const full = metricTiles({ id: 'f', x: 0, y: 0, width: 300, items: [{ value: '1000000', unit: '万元', label: '一个很长的指标名称' }], theme });
  assert.equal(byId(full.elements, 'f-tile-1-icon'), undefined);
  const off = metricTiles({ id: 'o', x: 0, y: 0, width: 1000, items: [{ value: '20', label: '新签' }], theme, icons: false });
  assert.equal(byId(off.elements, 'o-tile-1-icon'), undefined);
});

test('tiles, panels and photos share the theme corner radius', async () => {
  const { imageFill, metricTiles } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs');
  const t = createTheme({ radius: 18 });
  const tile = metricTiles({ id: 'm', x: 0, y: 0, width: 600, items: [{ value: '1', label: '甲' }], theme: t }).elements.find((e) => e.id === 'm-tile-1');
  const photos = imageFill({ id: 'p', x: 0, y: 0, width: 1000, height: 650, images: [{ src: 'a', size: { width: 360, height: 480 } }, { src: 'b', size: { width: 384, height: 256 } }, { src: 'c', size: { width: 384, height: 256 } }], theme: t }).elements.filter((e) => e.type === 'image');
  assert.equal(tile.style.radius, 18);
  assert(photos.every((e) => e.style.radius === 18));
});
