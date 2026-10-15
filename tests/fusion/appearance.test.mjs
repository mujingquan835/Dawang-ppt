import test from 'node:test';
import assert from 'node:assert/strict';
import { composeContentSlide } from '../../skills/dawang-ppt/project/src/fusion/styles/compose.mjs';
import { resolveStyle } from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import { importGoal } from '../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs';
import { applyEditCommand, undoProject, redoProject } from '../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs';
import { materializeElements } from '../../skills/dawang-ppt/project/src/fusion/scene/model.mjs';

const content = { slideId: 's', title: '合成证据', source: '公开夹具', kind: 'images', data: { arrangement: 'primary-secondary', images: [{ mediaId: 'p', src: 'portrait.png', kind: 'photo' }, { mediaId: 's', src: 'screenshot.png', kind: 'screenshot' }] } };
const geometry = p => materializeElements(p.slides[0], p).map(e => ({ id: e.id, bounds: e.bounds, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 }));
function edit(p, c) {
  const r = applyEditCommand(p, { slideId: 's', ...c });
  assert.equal(r.ok, true, JSON.stringify(r.conflicts));
  return r.project;
}

test('appearance changes preserve image spacing, manual geometry and custom text style across four skins', () => {
  let p = importGoal({ slides: [composeContentSlide(content, resolveStyle('legacy/theme13'))] });
  p = edit(p, { type: 'geometry', elementId: 'title', bounds: [140, 100, 1200, 120] });
  p = edit(p, { type: 'style', elementId: 'title', style: { color: '#ac3456', fontSize: 58 } });
  p = edit(p, { type: 'image', elementId: 's-primary/image/p', src: 'replacement.png', focal: '20% 30%' });
  const before = structuredClone(p), positions = geometry(p);
  for (const id of ['legacy/theme14', 'legacy/theme06', 'legacy/theme13', 'legacy/theme17']) {
    p = edit(p, { type: 'appearance', styleId: id });
    assert.deepEqual(geometry(p), positions, id);
    assert.equal(p.slides[0].elements.find(e => e.id === 'title').style.color, '#ac3456');
    assert.equal(p.slides[0].elements.find(e => e.id === 'title').style.fontSize, 58);
    assert.equal(materializeElements(p.slides[0], p).find(e => e.id === 's-primary/image/p').focal, '20% 30%');
    assert.equal(p.slides[0].styleId, id);
  }
  assert.deepEqual(p.slides[0].objects[0].data, before.slides[0].objects[0].data);
  const last = p, undo = undoProject(p);
  assert.equal(undo.ok, true);
  assert.equal(undo.project.slides[0].styleId, 'legacy/theme13');
  assert.deepEqual(geometry(undo.project), positions);
  assert.deepEqual(redoProject(undo.project).project.slides, last.slides);
});

test('appearance repaint uses target colors without replanning semantic table structure', () => {
  const c = { slideId: 's', title: '合成表格', source: '公开夹具', kind: 'table', data: { columns: [{ columnId: 'c', label: '列' }], rows: [{ rowId: 'r', cells: { c: '值' } }] } };
  let p = importGoal({ slides: [composeContentSlide(c, resolveStyle('legacy/theme13'))] });
  const before = geometry(p);
  p = edit(p, { type: 'appearance', styleId: 'legacy/theme06' });
  assert.deepEqual(geometry(p), before);
  const els = materializeElements(p.slides[0], p);
  assert.equal(els.find(e => e.id === 'title').style.color, '#f6f6f3');
  assert.equal(els.find(e => e.id === 's-primary/header/c').style.fill, '#d2fb30');
  assert.equal(els.find(e => e.id === 's-primary/header/c/text').style.color, '#0a0a0a');
  p = edit(p, { type: 'appearance', styleId: 'legacy/theme17' });
  assert.deepEqual(geometry(p), before, 'switching to a no-vertical-rule skin cannot remove existing geometry');
});

test('a family header binding can repaint into a legacy skin with no explicit header token', () => {
  const c = { slideId: 's', title: '合成判断', kind: 'process', judgments: ['保留材料', '复核结果'], data: { nodes: [{ nodeId: 'a', label: '材料' }] } };
  let p = importGoal({ slides: [composeContentSlide(c, resolveStyle('kimi/consulting/indigo-due-diligence'))] });
  const before = geometry(p);
  p = edit(p, { type: 'appearance', styleId: 'legacy/theme13' });
  assert.deepEqual(geometry(p), before);
  assert.equal(p.slides[0].elements.find(e => e.id === 'number-marker').style.fill, '#1e2bfa');
});
