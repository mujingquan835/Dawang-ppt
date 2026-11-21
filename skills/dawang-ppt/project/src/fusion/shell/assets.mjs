// Files and font packs a Dawang-PPT deck page needs.
// Default typography uses a dual-font system:
//   - Body & hierarchy: Source Han Sans SC (400 / 500 / 700 / 900 real weights, WOFF2 subset)
//   - Display / artistic titles: YouSheBiaoTiHei (WOFF2 subset)
// Legacy OPPO Sans 4.0 remains available on demand when an older project explicitly references it.
import fs from 'node:fs';
import path from 'node:path';

export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

export const DEFAULT_BODY_FONT = 'Source Han Sans SC';
export const DEFAULT_DISPLAY_FONT = 'YouSheBiaoTiHei';

export const FONT_PACKS = [
  {
    family: 'Source Han Sans SC',
    weight: 300,
    style: 'normal',
    format: 'woff2',
    mime: 'font/woff2',
    from: 'assets/fonts/source-han-sans-sc-300.woff2',
    to: 'assets/fonts/source-han-sans-sc-300.woff2',
    defaultIncluded: true,
  },
  {
    family: 'Source Han Sans SC',
    weight: 400,
    style: 'normal',
    format: 'woff2',
    mime: 'font/woff2',
    from: 'assets/fonts/source-han-sans-sc-400.woff2',
    to: 'assets/fonts/source-han-sans-sc-400.woff2',
    defaultIncluded: true,
  },
  {
    family: 'Source Han Sans SC',
    weight: 700,
    style: 'normal',
    format: 'woff2',
    mime: 'font/woff2',
    from: 'assets/fonts/source-han-sans-sc-700.woff2',
    to: 'assets/fonts/source-han-sans-sc-700.woff2',
    defaultIncluded: true,
  },
  {
    family: 'Source Han Sans SC',
    weight: 900,
    style: 'normal',
    format: 'woff2',
    mime: 'font/woff2',
    from: 'assets/fonts/source-han-sans-sc-900.woff2',
    to: 'assets/fonts/source-han-sans-sc-900.woff2',
    defaultIncluded: true,
  },
  {
    family: 'YouSheBiaoTiHei',
    weight: 400,
    style: 'normal',
    format: 'woff2',
    mime: 'font/woff2',
    from: 'assets/fonts/youshe-biaotihei.woff2',
    to: 'assets/fonts/youshe-biaotihei.woff2',
    defaultIncluded: true,
  },
  {
    family: 'OPPO Sans 4.0',
    weight: '100 900',
    style: 'normal',
    format: 'truetype',
    mime: 'font/ttf',
    from: 'assets/fonts/oppo-sans-4.0.ttf',
    to: 'assets/fonts/oppo-sans-4.0.ttf',
    defaultIncluded: false,
  },
];

const fontKey = (family) => String(family || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();

export function selectFontPacks(usedFamilies, projectRoot = PROJECT_ROOT) {
  const wanted = usedFamilies && usedFamilies.size
    ? new Set([...usedFamilies].map(fontKey))
    : null;
  const available = FONT_PACKS.filter((p) => fs.existsSync(path.join(projectRoot, p.from)));
  if (!wanted) {
    const defaults = available.filter((p) => p.defaultIncluded);
    return defaults.length ? defaults : available;
  }
  // Always keep default dual-font packs when any default family is used (or none matched),
  // and only include the heavy legacy OPPO Sans 4.0 when explicitly requested.
  const matched = available.filter((p) => wanted.has(fontKey(p.family)));
  if (matched.length) return matched;
  const defaults = available.filter((p) => p.defaultIncluded);
  return defaults.length ? defaults : available;
}

export const FONT_FILES = [
  ...FONT_PACKS.filter((p) => fs.existsSync(path.join(PROJECT_ROOT, p.from))).map(({ from, to }) => ({ from, to })),
  ...(fs.existsSync(path.join(PROJECT_ROOT, 'assets/fonts/oppo-sans-4.0-license-notice.txt'))
    ? [{ from: 'assets/fonts/oppo-sans-4.0-license-notice.txt', to: 'assets/fonts/oppo-sans-4.0-license-notice.txt' }]
    : []),
];

export function fontFaceCss(base = 'assets/fonts/', usedFamilies = null) {
  const packs = selectFontPacks(usedFamilies);
  return packs
    .map((p) => {
      const file = path.basename(p.to);
      // Map CSS weight 600 cleanly to 700 and 800 to 900 via descriptor ranges on static Source Han weights
      const weightDesc =
        p.family === 'Source Han Sans SC'
          ? p.weight === 300
            ? '100 350'
            : p.weight === 400
              ? '351 550'
              : p.weight === 700
                ? '551 799'
                : '800 900'
          : p.family === 'YouSheBiaoTiHei'
            ? '100 900'
            : String(p.weight);
      return `@font-face{font-family:'${p.family}';font-style:${p.style};font-weight:${weightDesc};font-display:block;src:url('${base}${file}') format('${p.format}');}`;
    })
    .join('\n');
}

// Build detached portable font entries for <script id="portable-fonts" type="application/json">.
// Loaded once at boot via FontFace API so <style> contains 0 bytes of base64 font data.
export function buildPortableFontEntries(usedFamilies = null, projectRoot = PROJECT_ROOT) {
  const packs = selectFontPacks(usedFamilies, projectRoot);
  return packs.map((p) => {
    const abs = path.join(projectRoot, p.from);
    const weightDesc =
      p.family === 'Source Han Sans SC'
        ? p.weight === 300
          ? '100 350'
          : p.weight === 400
            ? '351 550'
            : p.weight === 700
              ? '551 799'
              : '800 900'
        : p.family === 'YouSheBiaoTiHei'
          ? '100 900'
          : String(p.weight);
    return {
      family: p.family,
      weight: weightDesc,
      style: p.style,
      format: p.format,
      data: fs.readFileSync(abs).toString('base64'),
    };
  });
}

// Browser libraries loaded by the page for export. They are inlined when the deck is saved as one HTML file.
export const VENDOR_FILES = [
  { from: 'node_modules/pptxgenjs/dist/pptxgen.bundle.js', to: 'assets/vendor/pptxgen.bundle.js' },
  { from: 'node_modules/html-to-image/dist/html-to-image.js', to: 'assets/vendor/html-to-image.js' },
  { from: 'node_modules/pdf-lib/dist/pdf-lib.min.js', to: 'assets/vendor/pdf-lib.min.js' },
];
