// html-deck-to-pptx —— 公共入口。
// JAD-183 / JAD-179:导出引擎已物理迁入本包 src/(editable.mjs + screenshot.mjs)。
//
// 公共 API:
//   exportEditablePptxFromUrl(browser, url, options)   // 给一个 Playwright browser + deck URL → 可编辑 .pptx
//   exportEditablePptxFromPage(page, options)          // 给一个已打开的 Playwright page
//   exportScreenshotPdfFromUrl(browser, url, options)  // 截图式 PDF 导出
// options.activeSlideSelector 可覆盖 deck 的 DOM 契约(默认匹配 #deck > .slide 结构)。
export {
  exportEditablePptxFromPage,
  exportEditablePptxFromUrl,
} from './src/editable.mjs';
export {
  exportScreenshotPdfFromUrl,
} from './src/screenshot.mjs';
