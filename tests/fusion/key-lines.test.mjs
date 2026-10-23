import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { reviewKeyLines, noteShare } from '../../skills/dawang-ppt/project/src/fusion/qa/key-lines.mjs';
import { scanMaterialText } from '../../skills/dawang-ppt/project/src/fusion/authoring/prepare.mjs';

// Synthetic two-page deck; wording is test material, not a template.
const text = (id, value, fontSize, bounds) => ({ id, type: 'text', text: value, bounds, style: { fontSize } });
function input(plan = {}) {
  return {
    requirements: { projectId: 'key-lines-test', title: '合成测试' },
    sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] }, media: { entries: [] },
    designChoice: { styleId: 'authored/custom' },
    contentPlan: {
      nodes: {},
      slides: [
        { slideId: 'a', keyLine: { elementId: 'a-title', source: 'quoted', from: '大纲第 1 行' } },
        { slideId: 'b', keyLine: { elementId: 'b-claim', source: 'created', support: ['实测最大加速度 25.0 → 6.2'] } }
      ],
      throughLine: { placements: [{ slideId: 'a', elementId: 'a-title' }], source: 'quoted', from: '大纲定位句' },
      authorNotes: [{ text: '图3 第 2 格的框是示意，和用户当时在界面里画的框不一定完全一致', reason: '配图说明' }],
      ...plan
    },
    slides: [
      { slideId: 'a', elements: [text('a-title', '选中主体，剩下的交给虚拟镜头', 72, [100, 100, 1400, 120]), text('a-body', '把手持抖动的视频变成锁定主体的成片', 30, [100, 300, 1400, 80])] },
      { slideId: 'b', elements: [text('b-title', '为什么成片好看', 56, [100, 80, 1400, 90]), text('b-claim', '主体被挡再出现，镜头不再猛甩', 44, [100, 220, 1400, 80]), text('b-body', '镜头路径整体规划，不逐帧硬跟。', 28, [100, 360, 1400, 60]), text('b-note', '数据来自样片', 22, [100, 900, 900, 40])] }
    ]
  };
}
const kinds = (r) => r.issues.map((i) => i.kind);

test('a complete plan passes and lists created lines for confirmation at delivery', () => {
  const r = reviewKeyLines(createAuthoredProject(input()));
  assert.equal(r.strict, true);
  assert.deepEqual(r.issues, []);
  assert.equal(r.review.throughLine.text, '选中主体，剩下的交给虚拟镜头');
  assert.deepEqual(r.review.created.map((c) => c.text), ['主体被挡再出现，镜头不再猛甩']);
});

test('missing, unsupported or buried key lines are blocked; a waived page is accepted', () => {
  const missing = createAuthoredProject(input({ slides: [{ slideId: 'a', keyLine: { waived: '目录页' } }] }));
  assert.deepEqual(kinds(reviewKeyLines(missing)), ['key-line-missing']);
  const bare = createAuthoredProject(input({ slides: [{ slideId: 'a', keyLine: { elementId: 'a-title', source: 'quoted' } }, { slideId: 'b', keyLine: { elementId: 'b-claim', source: 'created' } }] }));
  assert.deepEqual(kinds(reviewKeyLines(bare)), ['key-line-basis-missing', 'key-line-basis-missing']);
  const buried = createAuthoredProject(input({ slides: [{ slideId: 'a', keyLine: { elementId: 'a-title', source: 'quoted', from: 'x' } }, { slideId: 'b', keyLine: { elementId: 'b-body', source: 'quoted', from: 'x' } }] }));
  const issue = reviewKeyLines(buried).issues.find((i) => i.kind === 'key-line-not-prominent');
  assert.equal(issue.elementId, 'b-body');
  assert.deepEqual(issue.topLevels, [56, 44]);
});

test('the deck line must sit on the first or last page', () => {
  const r = reviewKeyLines(createAuthoredProject(input({ throughLine: { placements: [{ slideId: 'b', elementId: 'nope' }], source: 'quoted', from: 'x' } })));
  assert.deepEqual(kinds(r), ['through-line-not-at-ends']);
});

test('a reworded author note on a slide is caught', () => {
  const deck = input();
  deck.slides[1].elements[3].text = '三步操作界面 · 第 2 格的框为示意，与用户当时在界面里画的框不一定完全一致';
  const issue = reviewKeyLines(createAuthoredProject(deck)).issues.find((i) => i.kind === 'author-note-on-slide');
  assert.equal(issue.elementId, 'b-note');
  assert(issue.share >= 0.6);
  assert(noteShare('对外宣传时建议写"样片实测"', '本页数字来自内部测试，对外宣传建议标注「样片实测」') >= 0.6);
  assert(noteShare('对外宣传时建议写"样片实测"', '镜头路径整体规划，不逐帧硬跟') < 0.2);
});

test('projects made before the contract only get warnings', () => {
  const project = createAuthoredProject(input({ slides: [] , throughLine: undefined }));
  delete project.requirements.contentContract;
  const r = reviewKeyLines(project);
  assert.deepEqual(r.issues, []);
  assert(r.warnings.some((w) => w.kind === 'key-line-missing'));
  assert(r.warnings.some((w) => w.kind === 'through-line-missing'));
});

test('prepare surfaces author-note and key-line candidates without deciding', () => {
  const r = scanMaterialText(['> 定位一句话：**先听懂音乐，再决定怎么剪**', '## 第 1 页', '**标题**：一首歌，剪出一条片', '- 区别：会**锁定节拍点**', '对外宣传时建议写"内测数据"', '### 配图说明（不放进 PPT）', '- 图2 的曲线为示意', '## 第 2 页', '正文'].join('\n'));
  assert.deepEqual(r.authorNoteCandidates.map((c) => c.text), ['对外宣传时建议写"内测数据"', '图2 的曲线为示意']);
  const keys = r.keyLineCandidates.map((c) => c.text);
  for (const expected of ['先听懂音乐，再决定怎么剪', '一首歌，剪出一条片', '锁定节拍点']) assert(keys.includes(expected), expected);
  assert(!keys.includes('正文'));
});
