import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { reviewVisualDecisions } from '../../skills/dawang-ppt/project/src/fusion/qa/visual-decisions.mjs';

// Synthetic three-page deck; wording and geometry are test material, not a template.
const text = (id, value, fontSize, bounds, extra = {}) => ({ id, type: 'text', text: value, bounds, style: { fontSize, fontWeight: 400, color: '#222222' }, ...extra });
const runs = (id, parts, bounds) => text(id, parts.map((p) => p[0]).join(''), 64, bounds, { runs: parts.map(([t, style]) => ({ text: t, style })) });
function input(decisions, slides) {
  return {
    requirements: { projectId: 'visual-decisions-test', title: '合成测试' },
    sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] }, media: { entries: [] },
    designChoice: { styleId: 'authored/custom' },
    contentPlan: { nodes: {}, slides: decisions.map((visualDecision, i) => ({ slideId: `s${i}`, visualDecision })) },
    slides: slides.map((elements, i) => ({ slideId: `s${i}`, elements }))
  };
}
const kinds = (r) => r.issues.map((i) => i.kind);
const titled = [
  [runs('t', [['先选定主体，', { fontSize: 48 }], ['画面跟随', { fontSize: 112, fontWeight: 900, color: '#C8102E' }]], [96, 300, 1000, 200]), text('b', '说明', 28, [96, 600, 800, 60])],
  [text('big', '45%', 164, [1200, 300, 500, 220]), text('h', '效果与使用流程', 72, [96, 100, 900, 100])],
  [text('k', '持续改进', 104, [96, 700, 900, 140]), text('d', '四项计划', 38, [96, 860, 900, 60])]
];

test('recorded decisions that reach the slide pass and are listed for delivery', () => {
  const r = reviewVisualDecisions(createAuthoredProject(input([
    { focus: { elementId: 't', text: '画面跟随' }, layout: '错位文字作主视觉，右侧截图证据' },
    { focus: { elementId: 'big' }, layout: '大数字占右半，标题在左上' },
    { waived: '结束页，沿用封面构图' }
  ], titled)));
  assert.equal(r.strict, true);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.review.slides.map((s) => s.focus ?? s.waived), ['画面跟随', '45%', '结束页，沿用封面构图']);
});

test('a skipped or prose-only decision is blocked on new decks', () => {
  const r = reviewVisualDecisions(createAuthoredProject(input([undefined, '标题88px，左右分栏', { focus: { elementId: 'k' } }], titled)));
  assert.deepEqual(kinds(r), ['visual-decision-missing', 'visual-decision-unstructured', 'visual-decision-layout-missing']);
});

test('a focus left inside one uniform title box is caught', () => {
  const flat = [[text('t', '先选定主体，画面跟随', 76, [96, 100, 1700, 100]), text('b', '说明', 28, [96, 300, 800, 60])], ...titled.slice(1)];
  const r = reviewVisualDecisions(createAuthoredProject(input([
    { focus: { elementId: 't', text: '画面跟随' }, layout: '顶栏标题' },
    { focus: { elementId: 'h' }, layout: '标题在左上' },
    { waived: '结束页' }
  ], flat)));
  assert.deepEqual(kinds(r), ['visual-focus-not-distinct', 'visual-focus-not-leading']);
});

test('identical compositions across the deck are flagged for a second look', () => {
  const same = [0, 1, 2].map((i) => [text(`t${i}`, `第${i}页结论`, 76, [100, 100, 1700, 100]), text(`b${i}`, '正文', 28, [100, 300, 1700, 600])]);
  const r = reviewVisualDecisions(createAuthoredProject(input(same.map((_, i) => ({ focus: { elementId: `t${i}` }, layout: '顶栏+正文' })), same)));
  assert.deepEqual(r.issues, []);
  assert(r.warnings.some((w) => w.kind === 'visual-layout-repeated'));
});

test('projects made before the contract only get warnings', () => {
  const project = createAuthoredProject(input([undefined, undefined, undefined], titled));
  delete project.requirements.visualContract;
  const r = reviewVisualDecisions(project);
  assert.deepEqual(r.issues, []);
  assert.equal(r.warnings.filter((w) => w.kind === 'visual-decision-missing').length, 3);
});
