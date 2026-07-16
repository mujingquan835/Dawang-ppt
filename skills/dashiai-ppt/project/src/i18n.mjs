// Deck 界面语言与词典裁剪(主题注册表层)。纯函数部分(语言归一化/词典加载/
// 文案收集)住 src/i18n-core.mjs,本文件叠加 THEME_PAGES 依赖,给 renderDeck 用。
import { THEME_PAGES, THEME_PACK_OPTIONS } from './components/themes/index.jsx';
import { normalizeOptionLabel } from './control-naming.mjs';
import { collectMetadataStrings, loadI18nDictionary } from './i18n-core.mjs';

export { DECK_LANGUAGES, normalizeDeckLanguage, loadI18nDictionary, collectMetadataStrings } from './i18n-core.mjs';

const PAGES_BY_KEY = new Map(THEME_PAGES.map((page) => [page.key, page]));

// 按 deck 实际用到的页面裁剪词典子集(含这些页所属主题包的名称/场景文案)。
export function buildDeckI18nDict(viewModel) {
  const usedPages = [];
  const usedPackKeys = new Set();
  for (const slide of viewModel.slides || []) {
    const page = PAGES_BY_KEY.get(slide.layout);
    if (page) {
      usedPages.push(page);
      if (page.themeKey) usedPackKeys.add(page.themeKey);
    }
    if (slide.themePack) usedPackKeys.add(slide.themePack);
  }
  const usedPacks = [...usedPackKeys]
    .map((key) => THEME_PACK_OPTIONS[key])
    .filter(Boolean);
  const dict = loadI18nDictionary();
  const subset = {};
  for (const [zh, kinds] of collectMetadataStrings(usedPages, usedPacks)) {
    if (dict[zh]) subset[zh] = dict[zh];
    // 选项 label 在渲染管线写入 DOM 前会经 normalizeOptionLabel 规范化
    // (如 override 注入的 'YES 按键' → '是 按键'),词典 key 与浏览器端
    // 查询用的都是规范化后的形态——裁剪必须按同一形态收词。
    if (kinds.has('option')) {
      const normalized = String(normalizeOptionLabel(zh, zh, 0));
      if (normalized !== zh && dict[normalized]) subset[normalized] = dict[normalized];
    }
  }
  return subset;
}
