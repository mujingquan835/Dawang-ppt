import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import { PNG } from '../../../skills/dawang-ppt/project/node_modules/pngjs/lib/png.js';
import { composeContentSlide } from '../../../skills/dawang-ppt/project/src/fusion/styles/compose.mjs';
import { resolveStyle } from '../../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import { importGoal } from '../../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs';
import { saveProject, loadProject } from '../../../skills/dawang-ppt/project/src/fusion/project/store.mjs';
import { renderProject } from '../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx';
import { measureProject } from '../../../skills/dawang-ppt/project/src/fusion/qa/measure.mjs';
import { createFusionServer } from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';

const dir = path.resolve('output/fusion-v3/m1/browser');
fs.mkdirSync(path.join(dir, 'qa'), { recursive: true });
const image = new PNG({ width: 320, height: 180 });
for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) {
  const i = (y * 320 + x) * 4;
  image.data.set([60 + x % 120, 110 + y % 100, 160, 255], i);
}
fs.writeFileSync(path.join(dir, 'synthetic.png'), PNG.sync.write(image));
const nodes = [0, 1, 2].map(i => ({ nodeId: 'n' + i, label: '步骤' + (i + 1), detail: '合成说明', date: '2026-10-' + (10 + i) }));
const variants = [
  ['process', { nodes }],
  ['timeline', { nodes, direction: 'alternating' }],
  ['table', { columns: [{ columnId: 'a', label: '事项' }, { columnId: 'b', label: '说明' }], rows: [0, 1, 2, 3].map(i => ({ rowId: 'r' + i, cells: { a: '事项' + i, b: '合成输入完整保留' } })) }],
  ...['bar', 'line'].map(kind => [kind, { unit: '合成单位', period: '结构检查', series: [{ nodeId: 'p', label: '正', value: 10 }, { nodeId: 'n', label: '负', value: -5 }, { nodeId: 'z', label: '零', value: 0 }, { nodeId: 'e', label: '空', value: null }] }]),
  ['images', { images: [{ mediaId: 'synthetic', kind: 'photo', src: 'synthetic.png' }] }]
];
const skins = ['theme14', 'theme06', 'theme13', 'theme17'];
const slides = [{ slideId: 'legacy', layout: 'theme13_page001', props: {} }, ...skins.flatMap(key => variants.map(([kind, data]) =>
  composeContentSlide({ slideId: key + '-' + kind, kind, title: '合成结构检查 · ' + kind, scope: '只验证结构，不代表真实业绩', explanation: '每种外观复用可编辑对象。', source: '来源：公开合成夹具', data }, resolveStyle('legacy/' + key))
))];
const pf = path.join(dir, 'deck-project.json');
fs.rmSync(pf, { force: true });
let project = importGoal({ title: 'V3 风格数据化验证（合成材料）', slides });
project.editorState.legacy.typography = { mode: 'global', headingFont: 'theme', bodyFont: 'theme', monoFont: 'theme' };
project = saveProject(pf, project, null).project;
renderProject(project, path.join(dir, 'index.html'));
const server = await createFusionServer({ dir });
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__fusionEditor);
  await page.evaluate(() => window.__fusionEditor.ready());
  const templateFont = await page.evaluate(async () => {
    window.go(1, { animate: false, force: true });
    await document.fonts.ready;
    return getComputedStyle(document.querySelector('#deck [data-vm-slide-id="theme14-process"] .fusion-title')).fontFamily;
  });
  assert.match(templateFont, /OPPO Sans 4\.0/, 'template font family must survive CSS parsing');
  await page.evaluate(() => window.__exitPresentMode());
  await page.waitForFunction(() => !window.__getDeckNavigationState().locked);
  await page.evaluate(() => window.go(window.__getVisibleSlides().findIndex(s => s.dataset.vmSlideId === 'theme13-process'), { animate: false, force: true }));
  await page.waitForFunction(() => document.querySelector('#deck > [data-vm-slide-id="theme13-process"]').classList.contains('active'));
  const behavior = await page.evaluate(`(async () => {
    const api = window.__fusionEditor, slideId = 'theme13-process';
    const settle = async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); };
    const apply = command => { const r = api.apply({ slideId, ...command }); if (!r.ok) throw new Error(JSON.stringify(r.conflicts)); };
    const bounds = () => [...document.querySelectorAll('#deck [data-vm-slide-id="theme13-process"] [data-fusion-element]')].map(e => {
      const b = e.getBoundingClientRect(); return [e.dataset.fusionElement, b.x, b.y, b.width, b.height];
    });
    apply({ type: 'text', elementId: 'title', text: '浏览器换肤后保留文字' });
    apply({ type: 'geometry', elementId: 'title', bounds: [130, 100, 1200, 110] });
    apply({ type: 'style', elementId: 'title', style: { color: '#ac3456', fontSize: 58 } });
    await settle();
    const before = bounds();
    const titleNode = document.querySelector('#deck [data-vm-slide-id="theme13-process"] [data-fusion-element="title"]');
    const titleDiagnostic = { html: titleNode.outerHTML, display: getComputedStyle(titleNode).display, active: window.__getVisibleSlides().filter(e => e.classList.contains('active')).map(e => e.dataset.vmSlideId) };
    for (const theme of ['theme14', 'theme06', 'theme17', 'theme13']) {
      apply({ type: 'appearance', styleId: 'legacy/' + theme });
      await settle();
      if (JSON.stringify(bounds()) !== JSON.stringify(before)) throw new Error('Appearance moved DOM geometry: ' + theme + ' ' + JSON.stringify({ titleDiagnostic, before, after: bounds() }));
    }
    api.undo();
    if (api.getProject().slides.find(s => s.slideId === slideId).styleId !== 'legacy/theme17') throw new Error('Undo did not restore appearance');
    api.redo();
    await api.save();
    return { geometryPreserved: true, undoRedo: true, text: api.getProject().slides.find(s => s.slideId === slideId).elements.find(e => e.id === 'title').text };
  })()`);
  await page.reload();
  await page.waitForFunction(() => window.__fusionEditor);
  await page.evaluate(() => window.__fusionEditor.ready());
  const reopened = await page.evaluate(() => window.__fusionEditor.getProject().slides.find(s => s.slideId === 'theme13-process'));
  assert.equal(reopened.elements.find(e => e.id === 'title').text, '浏览器换肤后保留文字');
  assert.deepEqual(reopened.elements.find(e => e.id === 'title').bounds, [130, 100, 1200, 110]);
  assert.equal(reopened.elements.find(e => e.id === 'title').style.color, '#ac3456');
  const saved = loadProject(pf);
  const qa = await measureProject(url, saved, { screenshotDir: path.join(dir, 'qa') });
  // Exercise the actual editor export queue; a captured revision can go stale while legacy autosave runs.
  const exported = await page.evaluate(() => window.__exportDeckPptx());
  const evidence = { pages: qa.pages.length, behavior, reopened: true, qa, exported, browserErrors: errors };
  fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log({ pages: qa.pages.length, issues: qa.pages.flatMap(p => p.issues), exported: exported.ok, behavior });
  assert.equal(qa.ok, true, JSON.stringify(qa.pages.filter(p => p.issues.length).map(p => ({ slideId: p.slideId, issues: p.issues }))));
  assert.equal(exported.ok, true, JSON.stringify(exported));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
