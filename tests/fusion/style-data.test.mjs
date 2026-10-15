import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStyle } from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import { composeContentSlide } from '../../skills/dawang-ppt/project/src/fusion/styles/compose.mjs';

const content = { slideId: 'public-fixture', kind: 'process', title: '核对材料后再形成判断', scope: '公开合成夹具', source: '合成材料', judgments: ['保留所有输入。', '关系独立于颜色。'], data: { nodes: [{ nodeId: 'a', label: '材料' }, { nodeId: 'b', label: '复核' }] } };

test('renaming a style does not change its frame, decorations or image policy', () => {
  for (const id of ['legacy/theme13', 'legacy/theme16', 'kimi/consulting/indigo-due-diligence', 'kimi/work/moon-white-imagery', 'kimi/academic/blue-line-courseware']) {
    const style = resolveStyle(id), renamed = { ...structuredClone(style), id: 'custom/unrelated-name' };
    for (const input of [content, { ...content, kind: 'images', data: { images: [{ mediaId: 'fixture', kind: 'photo', src: 'fixture.png' }] } }]) {
      const original = composeContentSlide(input, style), alias = composeContentSlide(input, renamed);
      assert.deepEqual(alias.elements, original.elements, id);
      assert.deepEqual(alias.objects, original.objects, id);
      assert.equal(alias.compositionId, original.compositionId, id);
    }
  }
});

test('theme14, 06, 13 and 17 expose reusable style definitions to the same composer', () => {
  const skins = ['legacy/theme14', 'legacy/theme06', 'legacy/theme13', 'legacy/theme17'].map(id => resolveStyle(id));
  const slides = skins.map(style => composeContentSlide(content, style));
  assert(slides.every(s => s.mode === 'composition' && s.objects[0].kind === 'process'));
  assert.equal(skins[0].palette.accent, '#2e63eb');
  assert.equal(skins[1].palette.bg, '#0a0a0a');
  assert.equal(skins[1].palette.accent, '#d2fb30');
  assert.equal(skins[3].palette.ink, '#002a12');
  assert.notDeepEqual(slides[0].objects[0].bounds, slides[3].objects[0].bounds, 'initial generation can retain different compositions');
  assert(skins.every(s => s.layout.preferredPresets.length && s.source.themeKey));
  for (const slide of slides) {
    const [x, y, w, h] = slide.objects[0].bounds;
    assert(x >= 0 && y >= 0 && x + w <= 1920 && y + h <= 1080, slide.styleId);
  }
});

test('renamed family variants keep their layout and required-content protections', () => {
  const cases = [
    ['kimi/consulting/indigo-due-diligence', 'framework'],
    ['kimi/work/moon-white-imagery', 'section'],
    ['kimi/academic/blue-line-courseware', 'comparison-case']
  ];
  for (const [id, pageType] of cases) {
    const style = resolveStyle(id), alias = { ...structuredClone(style), id: 'custom/family' };
    const c = { ...content, pageType, kind: 'comparison' };
    const a = composeContentSlide(c, style), b = composeContentSlide(c, alias);
    assert.deepEqual(b.elements, a.elements);
    assert.deepEqual(b.objects, a.objects);
  }
  const moon = { ...resolveStyle('kimi/work/moon-white-imagery'), id: 'custom/photo' };
  assert.throws(() => composeContentSlide({ ...content, pageType: 'section', requiredContentRefs: ['required'] }, moon), /必需/);
});
