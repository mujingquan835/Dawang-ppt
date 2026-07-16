# html-deck-to-pptx

把一个**已渲染的 HTML 幻灯片 deck** 导出成**可编辑的 `.pptx`**。

与「又一个 HTML→pptx」不同点:别的工具在渐变 / SVG / 复杂背景上**拍平成图或转崩**,本引擎靠
**逐节点保真回退链**——映射不了的区域截图,却**从实时 DOM 把文字重新抽回来保持可编辑**(无 OCR),
再加 alpha-matte 透明背景捕获。基线见 `scripts/benchmark`(editableFidelity 0.851)。

## API

```js
import { exportEditablePptxFromUrl } from 'html-deck-to-pptx';
import { chromium } from 'playwright-core';

const browser = await chromium.launch();
const report = await exportEditablePptxFromUrl(browser, 'http://localhost:4178/', {
  outFile: 'deck.pptx',
  // 覆盖 deck 的 DOM 契约(默认匹配 #deck > .slide 结构):
  activeSlideSelector: '#deck > .slide.active',
});
// report: { slideCount, textObjects, shapeObjects, imageObjects, warnings, ... }
```

- `exportEditablePptxFromUrl(browser, url, options)` — 给 Playwright browser + deck URL。
- `exportEditablePptxFromPage(page, options)` — 给已打开的 Playwright page。

## DOM 契约

引擎假设 deck 满足:`#deck > .slide`(active 页含 `.active`/`[data-deck-active]`),并读一组
`data-editable-pptx-*` 注解(由引擎自行打标)。消费者侧可配置的入口选择器已参数化
(`options.activeSlideSelector`);其余注解协议的完全参数化是发布前的收尾项。

## 现状(JAD-183)

- ✅ 包边界:`package.json`(MIT,open-core 核心,见 JAD-185)、公共 API(`index.mjs`)、LICENSE、README。
- ✅ 入口 DOM 契约参数化起步(`activeSlideSelector`)。
- ✅ **引擎已物理迁入本包 `src/`**:`editable.mjs` + `screenshot.mjs` 从开发仓 `git mv` 进来,`index.mjs`
  用本地路径;开发仓 5 个 importer(serve-preview-https、validate-* 等)改为引用本包路径。
  验证:经包入口端到端导出 2 页 → 41 可编辑文本对象;`npm test` 绿。
- ⏳ **正式分发收尾**:6140 行验证器迁入本包作自带 CI 门、`data-dashi-*` / `data-editable-pptx-*` 注解协议
  完全参数化成 config(目前仅 `activeSlideSelector`)、独立仓发布。

> 商业层(托管 API / 高保真插件)不在本开源包内(open-core,见 JAD-185)。
