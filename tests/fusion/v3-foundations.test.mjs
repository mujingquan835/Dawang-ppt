import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildStyleOptions, resolveChoice } from '../../skills/dawang-ppt/project/src/fusion/kimi/style-options.mjs';
import { locateKimiSkill, scenarioDocs, listPresets } from '../../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';
import { detectScenario } from '../../skills/dawang-ppt/project/src/fusion/kimi/scenario.mjs';
import { analyzeContent } from '../../skills/dawang-ppt/project/src/fusion/planning/analyze-content.mjs';
import { justifyImages } from '../../skills/dawang-ppt/project/src/fusion/scene/justify.mjs';
import { composeContentSlide } from '../../skills/dawang-ppt/project/src/fusion/styles/compose.mjs';
import { resolveStyle } from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';

test('style choices select appearance while retaining one layout engine and no autonomous-design tile', () => {
  const presets = [
    { category: 'work', name: 'moon-white-imagery', presetId: 'kimi-preset:work/moon-white-imagery' },
    { category: 'consulting', name: 'indigo-due-diligence', presetId: 'kimi-preset:consulting/indigo-due-diligence' },
    { category: 'finance', name: 'pending', presetId: 'kimi-preset:finance/pending' }
  ];
  const options = buildStyleOptions({ primary: 'management-report' }, { presets });
  assert.equal(options.tiles.length, 9);
  assert(!options.tiles.some(t => t.kind === 'kimi-free'));
  const legacy = options.tiles.find(t => t.themeKey === 'theme13');
  const kimi = options.tiles.find(t => t.styleId === 'kimi/work/moon-white-imagery');
  assert.equal(resolveChoice(options, legacy.index).layoutEngine, 'content-first');
  assert.equal(resolveChoice(options, kimi.index).layoutEngine, 'content-first');
  assert.throws(() => resolveChoice(options), /选择/);
  const pending = options.tiles.find(t => t.id === 'kimi-preset:finance/pending');
  assert.equal(pending.implemented, false);
  assert.throws(() => resolveChoice(options, pending.index), /迁移/);
});

test('external reference index respects configured location and incomplete references are reported', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-local-reference-'));
  const old = process.env.KIMI_PPT_SKILL_DIR;
  try {
    fs.mkdirSync(path.join(root, 'reference/slides_categories'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reference/slides_categories.md'), 'synthetic fixture');
    process.env.KIMI_PPT_SKILL_DIR = root;
    assert.equal(locateKimiSkill(), root);
    assert.equal(scenarioDocs('management-report', root).available, false);
    assert.deepEqual(listPresets(root), []);
    fs.writeFileSync(path.join(root, 'reference/slides_categories/management-report.md'), 'synthetic fixture');
    assert.equal(scenarioDocs('management-report', root).available, true);
    assert.equal(scenarioDocs('management-report', null).available, false);
  } finally {
    if (old === undefined) delete process.env.KIMI_PPT_SKILL_DIR;
    else process.env.KIMI_PPT_SKILL_DIR = old;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('shared role assignment does not leave composition source text unclassified', () => {
  const s = composeContentSlide({ slideId: 'fixture', kind: 'process', title: '合成流程', scope: '测试范围', source: '公开合成夹具', data: { nodes: [{ nodeId: 'a', label: '材料' }, { nodeId: 'b', label: '复核' }] } }, resolveStyle('legacy/theme13'));
  assert.equal(s.elements.find(e => e.id === 'source').role, 'source');
  assert.equal(s.elements.find(e => e.id === 'scope').role, 'subtitle');
});

test('content analysis recognizes brief slides and packs mixed images without losing any', () => {
  const scenario = detectScenario({ title: '工作材料', contentSlides: [{ title: '季度汇报与业绩复盘' }] });
  assert.equal(scenario.primary, 'management-report');
  const a = analyzeContent({ title: '横竖混排', data: { images: [{ mediaId: 'l', width: 1600, height: 900 }, { mediaId: 'p', width: 900, height: 1600 }] } });
  assert.equal(a.imageMix, 'mixed');
  const packed = justifyImages(a.images.map(im => im.ratio), [100, 300, 1700, 650], 38);
  assert.equal(packed.boxes.length, 2);
  for (const [i, b] of packed.boxes.entries()) {
    assert(Math.abs(b[2] / b[3] - a.images[i].ratio) < 0.01);
    assert(b[0] >= 100 && b[1] >= 300 && b[0] + b[2] <= 1801 && b[1] + b[3] <= 951);
  }
});
