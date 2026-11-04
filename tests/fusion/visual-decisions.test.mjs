import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { reviewVisualDecisions } from '../../skills/dawang-ppt/project/src/fusion/qa/visual-decisions.mjs';

// Synthetic three-page deck; wording and geometry are test material, not a template.
const text = (id, value, fontSize, bounds, extra = {}) => ({ id, type: 'text', text: value, bounds, style: { fontSize, fontWeight: 400, color: '#222222' }, ...extra });
const runs = (id, parts, bounds) => text(id, parts.map((p) => p[0]).join(''), 64, bounds, { runs: parts.map(([t, style]) => ({ text: t, style })) });
// Zones are checked in their own test; elsewhere a decision gets one full-page zone unless it brings its own.
// Fixtures record a page type (free, with its reason) and one page zone unless a test sets its own.
const withZone = (d) => (d && typeof d === 'object' && !d.waived ? { pattern: 'free：合成测试页', componentsWaived: '合成测试页只验证当前规则', ...d, ...('zones' in d ? {} : { zones: [{ id: 'page', role: 'support', bounds: [0, 0, 1920, 1080] }] }) } : d);
function input(decisions, slides) {
  return {
    requirements: { projectId: 'visual-decisions-test', title: '合成测试' },
    sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] }, media: { entries: [] },
    designChoice: { styleId: 'authored/custom' },
    contentPlan: { nodes: {}, slides: decisions.map((visualDecision, i) => ({ slideId: `s${i}`, visualDecision: withZone(visualDecision) })) },
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

test('the same title-bar page repeated across the deck is blocked and flagged', () => {
  const same = [0, 1, 2].map((i) => [text(`t${i}`, `第${i}页结论`, 76, [100, 100, 1700, 100]), text(`b${i}`, '正文', 28, [100, 300, 1700, 600])]);
  const r = reviewVisualDecisions(createAuthoredProject(input(same.map((_, i) => ({ focus: { elementId: `t${i}` }, layout: '顶栏+正文' })), same)));
  // Every page "chose" its whole title, which is the largest text anyway: no page made a focus decision.
  assert.deepEqual(kinds(r), ['visual-focus-all-titles']);
  assert(r.warnings.some((w) => w.kind === 'visual-layout-repeated'));
  assert.equal(r.warnings.filter((w) => w.kind === 'visual-text-only').length, 3);
});

test('a page with a shape or image is not text-only, and large inline photos are blocked', () => {
  const photo = 'data:image/png;base64,' + 'A'.repeat(70 * 1024), icon = 'data:image/svg+xml;base64,' + 'A'.repeat(200);
  const pages = [
    [...titled[0], { id: 'bar', type: 'shape', bounds: [96, 900, 600, 40], style: { fill: '#123B2F' } }],
    [...titled[1], { id: 'p', type: 'image', src: photo, bounds: [1000, 600, 400, 300] }],
    [...titled[2], { id: 'i', type: 'image', src: icon, bounds: [1600, 100, 100, 100] }]
  ];
  const r = reviewVisualDecisions(createAuthoredProject(input([
    { focus: { elementId: 't', text: '画面跟随' }, layout: '错位文字' }, { focus: { elementId: 'big' }, layout: '大数字' }, { waived: '结束页' }
  ], pages)));
  // The fixture's whole-page zone also makes the photo small for its zone; this test is about the inline source.
  assert.deepEqual(kinds(r).filter((k) => k !== 'image-small-in-zone'), ['image-inline-src']);
  assert.equal(r.issues.find((i) => i.kind === 'image-inline-src').elementId, 'p');
  assert.deepEqual(r.warnings.filter((w) => w.kind === 'visual-text-only'), []);
});

test('projects made before the contract only get warnings', () => {
  const project = createAuthoredProject(input([undefined, undefined, undefined], titled));
  delete project.requirements.visualContract;
  const r = reviewVisualDecisions(project);
  assert.deepEqual(r.issues, []);
  assert.equal(r.warnings.filter((w) => w.kind === 'visual-decision-missing').length, 3);
});

test('v2 decks need zones that do not overlap and hold the page content', () => {
  const z = (id, role, bounds) => ({ id, role, bounds });
  const run = (zones) => kinds(reviewVisualDecisions(createAuthoredProject(input([
    { focus: { elementId: 't', text: '画面跟随' }, layout: '错位文字', zones }, { waived: '略' }, { waived: '略' }
  ], titled))));
  assert.deepEqual(run(undefined).filter((k) => k.startsWith('visual-zone')), ['visual-zones-missing']);
  assert.deepEqual(run([z('a', 'focus', [0, 250, 1920, 300]), z('b', 'support', [0, 560, 1920, 200])]), []);
  assert.deepEqual(run([z('a', 'focus', [0, 250, 1920, 300]), z('b', 'support', [0, 400, 1920, 400])]), ['visual-zones-overlap']);
  assert.deepEqual(run([z('a', 'focus', [0, 250, 1920, 300]), z('b', 'nope', [0, 600, 100, 100])]), ['visual-zone-invalid']);
  // The body text (y 600–660) sits between the zones' top and bottom but inside neither.
  assert.deepEqual(run([z('a', 'focus', [0, 250, 1920, 300]), z('b', 'support', [1500, 560, 400, 200])]), ['visual-element-outside-zones']);
});

test('v2 decks record the page type each page started from', () => {
  const r = reviewVisualDecisions(createAuthoredProject(input([{ pattern: '', focus: { elementId: 'big' }, layout: '大数字' }], [[{ type: 'text', id: 'big', text: '42%', bounds: [96, 300, 600, 200], style: { fontSize: 160 } }]])));
  assert(r.issues.some((i) => i.kind === 'visual-pattern-missing'));
});

test('a freely composed page needs a report component or a stated reason', () => {
  const page = [[{ type: 'text', id: 'big', text: '42%', bounds: [96, 300, 600, 200], style: { fontSize: 160 } }]];
  const bare = reviewVisualDecisions(createAuthoredProject(input([{ pattern: 'free：自由组合', componentsWaived: '', focus: { elementId: 'big' }, layout: '大数字' }], page)));
  assert(bare.issues.some((i) => i.kind === 'report-component-missing'));
  const withBlock = [[...page[0], { type: 'shape', id: 'a', component: 'answerBlock', bounds: [96, 560, 600, 200], style: { fill: '#23338B' } }]];
  const ok = reviewVisualDecisions(createAuthoredProject(input([{ pattern: 'free：自由组合', componentsWaived: '', focus: { elementId: 'big' }, layout: '大数字' }], withBlock)));
  assert(!ok.issues.some((i) => i.kind === 'report-component-missing'));
});
