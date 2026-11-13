// Files a Dawang-PPT deck page needs next to its HTML. Paths are relative to the project root on the build side and
// to the deck folder on the page side. Everything here is either ours or a third-party file with its own licence.
import path from 'node:path';

export const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../..');

// OPPO Sans 4.0 is embedded whole: its licence forbids subsetting (see assets/fonts/oppo-sans-4.0-license-notice.txt).
export const FONT_FILES = [
  { from: 'assets/fonts/oppo-sans-4.0.ttf', to: 'assets/fonts/oppo-sans-4.0.ttf' },
  { from: 'assets/fonts/oppo-sans-4.0-license-notice.txt', to: 'assets/fonts/oppo-sans-4.0-license-notice.txt' }
];

export function fontFaceCss(base = 'assets/fonts/') {
  return `@font-face{font-family:'OPPO Sans 4.0';font-style:normal;font-weight:100 900;font-display:block;src:url('${base}oppo-sans-4.0.ttf') format('truetype');}`;
}

// Browser libraries loaded by the page for export. They are inlined when the deck is saved as one HTML file.
export const VENDOR_FILES = [
  { from: 'node_modules/pptxgenjs/dist/pptxgen.bundle.js', to: 'assets/vendor/pptxgen.bundle.js' },
  { from: 'node_modules/html-to-image/dist/html-to-image.js', to: 'assets/vendor/html-to-image.js' },
  { from: 'node_modules/pdf-lib/dist/pdf-lib.min.js', to: 'assets/vendor/pdf-lib.min.js' }
];
