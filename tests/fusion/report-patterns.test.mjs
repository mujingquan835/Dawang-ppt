import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheme, createGrid, kpiStrip, colorRoles, lighten } from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';
import { pageHeader, targetVsActual, contrastColumns, periodColumns } from '../../skills/dawang-ppt/project/src/fusion/authoring/patterns.mjs';
import { REPORT_PALETTES, reportPalette } from '../../skills/dawang-ppt/project/src/fusion/authoring/report-palettes.mjs';
import { suggestPattern } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';
import { lintLayout } from '../../skills/dawang-ppt/project/src/fusion/qa/layout-lint.mjs';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { validateProject } from '../../skills/dawang-ppt/project/src/fusion/project/schema.mjs';
import { reviewVisualDecisions } from '../../skills/dawang-ppt/project/src/fusion/qa/visual-decisions.mjs';
import { authored } from '../../skills/dawang-ppt/examples/report-patterns.mjs';

const grid = createGrid(), byId = (els, id) => els.find((e) => e.id === id);

test('the report example is valid, inside the canvas, lint-clean and passes the visual checks', () => {
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

test('every report palette keeps one deep primary, a softer secondary and a pop colour on a white page', () => {
  assert.equal(REPORT_PALETTES.length, 9);
  const lum = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const { id, palette: p } of REPORT_PALETTES) {
    assert.equal(p.bg, '#FFFFFF', id);
    assert.equal(p.accent, p.primary, id);
    assert(lum(p.primary) < 0.5, `${id} primary is deep enough for white text`);
    assert(p.secondary && p.pop, id);
  }
  assert.equal(reportPalette('蓝金').primary, '#23338B');
  assert.throws(() => reportPalette('nope'), /unknown report palette/);
});

test('colour roles fall back to ink, an accent tint and accent when a palette has no report roles', () => {
  const t = createTheme(), r = colorRoles(t.palette);
  assert.equal(r.primary, t.palette.ink);
  assert.equal(r.pop, t.palette.accent);
  assert.equal(r.secondary, lighten(t.palette.accent, 0.55));
});

test('a KPI strip anchors the summary figure in a solid primary block and lines its peers up in columns', () => {
  const theme = createTheme({ palette: reportPalette('blue-gold') });
  const s = kpiStrip({ id: 'k', x: 96, y: 600, width: 1728, anchor: { label: '整体完成度', value: '94.5', unit: '%' }, items: [{ value: '128', label: '总任务' }, { value: '97', label: '完成' }], theme });
  assert.equal(byId(s.elements, 'k-anchor').style.fill, '#23338B');
  assert.deepEqual(byId(s.elements, 'k-anchor-value').runs.map((x) => x.text), ['94.5', ' %']);
  assert.equal(s.columns.length, 2);
  assert.equal(byId(s.elements, 'k-value-2').bounds[0], s.columns[1][0] + 12);
});

test('target vs actual keeps each target, result, bar and explanation in one column', () => {
  const theme = createTheme({ palette: reportPalette('blue-gold') }), header = pageHeader({ theme, grid, tag: '成果 | 01', title: '合成' });
  const page = targetVsActual({ theme, grid, header, overall: { label: '整体', value: '106', unit: '%' },
    items: [{ label: '甲', target: { value: '10' }, actual: { value: '12' }, rate: 120, detail: '说明' }, { label: '乙', target: { value: '10' }, actual: { value: '8' }, rate: 80, detail: '说明' }] });
  const els = page.elements, centre = (e) => e.bounds[0] + e.bounds[2] / 2;
  for (const i of [1, 2]) {
    const c = centre(byId(els, `plan-value-${i}`));
    assert(Math.abs(centre(byId(els, `actual-value-${i}`)) - c) <= 1, `column ${i} actual lines up with its target`);
    assert(Math.abs(centre(byId(els, `rate-track-${i}`)) - c) <= 1, `column ${i} bar lines up`);
  }
  // A result below target shows in the secondary colour, a result at or over target in primary.
  assert.equal(byId(els, 'rate-fill-1').style.fill, '#23338B');
  assert.equal(byId(els, 'rate-fill-2').style.fill, '#E2B898');
  assert.equal(byId(els, 'rate-fill-2').bounds[2], Math.round(byId(els, 'rate-track-2').bounds[2] * 0.8));
});

test('contrast columns pair rows across the seam and refuse sides that do not pair', () => {
  const theme = createTheme({ palette: reportPalette('blue-gold') }), header = pageHeader({ theme, grid, title: '合成' });
  const side = (n) => ({ title: '侧', items: Array.from({ length: n }, (_, i) => ({ title: `项${i}`, points: ['一点'] })) });
  assert.throws(() => contrastColumns({ theme, grid, header, left: side(3), right: side(2) }), /same number of rows/);
  const page = contrastColumns({ theme, grid, header, left: side(2), right: side(2) });
  const l = byId(page.elements, 'side-1-rule-1'), r = byId(page.elements, 'side-2-rule-1');
  assert.equal(l.bounds[1], r.bounds[1]);
  assert(byId(page.elements, 'vs-disc') && byId(page.elements, 'row-num-2'));
  // Wrapped points hang under their text, not under the dot.
  const dot = byId(page.elements, 'side-1-points-1-dot-1'), text = byId(page.elements, 'side-1-points-1-1');
  assert(text.bounds[0] > dot.bounds[0] + dot.bounds[2]);
});

test('period columns sit under their band segment and alternate primary and secondary', () => {
  const theme = createTheme({ palette: reportPalette('blue-gold') }), header = pageHeader({ theme, grid, title: '合成' });
  const periods = ['一', '二', '三'].map((label) => ({ label, title: '重点', points: ['要点'] }));
  const page = periodColumns({ theme, grid, header, periods });
  for (const i of [1, 2, 3]) assert.equal(byId(page.elements, `col-${i}-cap`).bounds[0], byId(page.elements, `band-${i}`).bounds[0] + 4);
  assert.equal(byId(page.elements, 'band-1').style.fill, '#23338B');
  assert.equal(byId(page.elements, 'band-2').style.fill, '#E2B898');
  assert.throws(() => periodColumns({ theme, grid, header, periods: periods.slice(0, 2) }), /3–6 periods/);
});

test('outline suggestions route targets, paired sides and periods to the report page types', () => {
  const d = (n, target) => Array.from({ length: n }, (_, i) => ({ label: `指标${i}`, value: String(i), unit: '单', ...(target ? { target: '9' } : {}) }));
  assert.equal(suggestPattern({ data: d(3, true) }), 'targetVsActual');
  assert.equal(suggestPattern({ data: d(3) }), 'metricTiles');
  assert.equal(suggestPattern({ compare: { left: [{}, {}], right: [{}, {}] } }), 'contrastColumns');
  assert.equal(suggestPattern({ periods: [{}, {}, {}] }), 'periodColumns');
});
