import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_ROLES, actionPanel, createTheme, labelBand } from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';

const theme = createTheme({ palette: { accent: '#23338B' }, roles: REPORT_ROLES });

test('the report scale keeps each level at least one step above the next', () => {
  assert.equal(theme.roles.body.fontSize, 20);
  assert(theme.roles.stepTitle.fontSize > theme.roles.stepDetail.fontSize);
  assert(theme.roles.sectionTitle.fontSize > theme.roles.stepTitle.fontSize);
});

test('a label band grows with its sentence, and the warm tone differs from the plain one', () => {
  const base = { id: 'b', x: 0, y: 0, width: 600, label: '业务问题', theme };
  const one = labelBand({ ...base, text: '一句话' }), long = labelBand({ ...base, text: '很长的句子'.repeat(30) });
  assert(long.height > one.height);
  const warm = labelBand({ ...base, text: '一句话', tone: 'judgment' });
  assert.notEqual(warm.elements[0].style.fill, one.elements[0].style.fill);
  assert.deepEqual(one.elements.map((e) => e.id), ['b-bar', 'b-mark', 'b-label', 'b-text']);
  assert(one.elements.at(-1).bounds[1] + one.elements.at(-1).bounds[3] <= one.height);
});

test('an action panel holds every row inside its frame, with stable ids for bindings', () => {
  const { elements, height } = actionPanel({ id: 'a', x: 0, y: 0, width: 800, heading: '关键动作', theme, items: [{ title: '收集', detail: '短句' }, { title: '组合传播', detail: '很长的句子'.repeat(30) }] });
  const byId = new Map(elements.map((e) => [e.id, e]));
  for (const id of ['a-panel', 'a-heading', 'a-title-1', 'a-detail-1', 'a-title-2', 'a-detail-2', 'a-rule-1']) assert(byId.has(id), id);
  assert(!byId.has('a-rule-2'));
  const last = byId.get('a-detail-2').bounds;
  assert(last[1] + last[3] <= height);
  assert.equal(byId.get('a-detail-1').bounds[0], last[0]);
});
