import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium } from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import { authored } from '../../../skills/dawang-ppt/examples/authored-minimal.mjs';
import { createAuthoredProject } from '../../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { writePortableDeckHtml } from '../../../skills/dawang-ppt/project/src/fusion/shell/page.jsx';

const dir = process.argv[2];
const htmlFile = path.join(dir, 'deck.html');
writePortableDeckHtml(createAuthoredProject(structuredClone(authored)), htmlFile, { optimizeAssets: false });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 680 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(pathToFileURL(htmlFile).href);
  await page.waitForFunction(() => window.__fusionEditor);
  await page.evaluate(() => window.__fusionEditor.ready());

  const assertInspectorOpen = async (step) => {
    assert.equal(await page.locator('#fusion-inspector').count(), 1, `${step}: #fusion-inspector must stay mounted`);
    assert.ok(await page.locator('#deck .fusion-selection').count() >= 1, `${step}: selection overlay must stay visible`);
    const emptyHidden = await page.locator('#deck-empty-panel').evaluate((e) => e.classList.contains('is-hidden'));
    assert.equal(emptyHidden, true, `${step}: #deck-empty-panel must stay hidden`);
  };

  const getClaim = () => page.evaluate(() => window.__fusionEditor.getProject().slides[0].elements.find((e) => e.id === 'claim'));

  const claim = page.locator('#deck > .active [data-fusion-element="claim"]');
  await claim.click();
  await assertInspectorOpen('initial text select');

  // 1. Consecutive color swatch clicks without re-selecting text
  const firstColor = await page.locator('#fusion-inspector .fi-swatch:not(.is-active)').first().getAttribute('title');
  await page.locator('#fusion-inspector .fi-swatch:not(.is-active)').first().click();
  await assertInspectorOpen('after 1st color swatch click');
  assert.equal((await getClaim()).style.color.toUpperCase(), firstColor);

  const secondColor = await page.locator('#fusion-inspector .fi-swatch:not(.is-active)').nth(1).getAttribute('title');
  await page.locator('#fusion-inspector .fi-swatch:not(.is-active)').nth(1).click();
  await assertInspectorOpen('after 2nd consecutive color swatch click');
  assert.equal((await getClaim()).style.color.toUpperCase(), secondColor);

  // 2. Consecutive font size stepper clicks (+, +, -) without re-selecting
  const sizeBefore = (await getClaim()).style.fontSize;
  await page.locator('#fusion-inspector .fi-stepper button').last().click();
  await assertInspectorOpen('after 1st + font size');
  await page.locator('#fusion-inspector .fi-stepper button').last().click();
  await assertInspectorOpen('after 2nd + font size');
  assert.equal((await getClaim()).style.fontSize, sizeBefore + 4);
  await page.locator('#fusion-inspector .fi-stepper button').first().click();
  await assertInspectorOpen('after - font size');
  assert.equal((await getClaim()).style.fontSize, sizeBefore + 2);

  // 3. Font family, font weight, text alignment, and canvas alignment without re-selecting
  await page.locator('#fusion-inspector select').nth(0).selectOption('YouSheBiaoTiHei');
  await assertInspectorOpen('after font family change');
  assert.equal((await getClaim()).style.fontFamily, 'YouSheBiaoTiHei');

  await page.locator('#fusion-inspector select').nth(1).selectOption('900');
  await assertInspectorOpen('after font weight change');
  assert.equal((await getClaim()).style.fontWeight, 900);

  await page.locator('#fusion-inspector .fi-seg button:not(.is-active)').first().click();
  await assertInspectorOpen('after text align click');

  await page.locator('#fusion-inspector .fi-grid-6 button').nth(1).click();
  await assertInspectorOpen('after canvas align click');

  // 4. Panel scroll position stays preserved across swatch clicks
  await page.locator('#deck-panel').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const scrollBefore = await page.locator('#deck-panel').evaluate((el) => el.scrollTop);
  await page.locator('#fusion-inspector .fi-swatch:not(.is-active)').first().click();
  await assertInspectorOpen('after scrolled swatch click');
  const scrollAfter = await page.locator('#deck-panel').evaluate((el) => el.scrollTop);
  if (scrollBefore > 0) {
    assert.ok(Math.abs(scrollAfter - scrollBefore) <= 4, `panel scrollTop jumped from ${scrollBefore} to ${scrollAfter}`);
  }

  // 5. Double-click inline text edit then click color swatch directly
  const cb = await claim.boundingBox();
  await page.mouse.dblclick(cb.x + 20, cb.y + cb.height / 2);
  await page.keyboard.type('测试');
  await page.locator('#fusion-inspector .fi-swatch:not(.is-active)').first().click();
  await assertInspectorOpen('after inline edit + swatch click');
  assert.match((await getClaim()).text, /测试/);

  // 6. Duplicate button inside inspector keeps the duplicated element selected
  const countBefore = await page.evaluate(() => window.__fusionEditor.getProject().slides[0].elements.length);
  await page.locator('#fusion-inspector .fi-quick-bar button').first().click();
  await assertInspectorOpen('after duplicate element click');
  const countAfter = await page.evaluate(() => window.__fusionEditor.getProject().slides[0].elements.length);
  assert.equal(countAfter, countBefore + 1);

  // 7. Multi-select inspector stays open after clicking an align button
  // (the duplicated text element from step 6 is already selected, so Shift+clicking body creates a 2-item selection)
  await page.keyboard.down('Shift');
  await page.locator('#deck > .active [data-fusion-element="body"]').click();
  await page.keyboard.up('Shift');
  assert.equal(await page.locator('#deck .fusion-multi-box').count(), 1);
  await page.locator('#fusion-inspector .fi-grid-6 button').first().click();
  await assertInspectorOpen('after multi-select align click');
  assert.equal(await page.locator('#deck .fusion-multi-box').count(), 1);

  // 8. Clicking empty canvas space still deselects cleanly and restores empty panel
  const root = await page.locator('#deck > .active .fusion-root').boundingBox();
  await page.mouse.click(root.x + root.width - 4, root.y + root.height - 4);
  assert.equal(await page.locator('#fusion-inspector').count(), 0);
  assert.equal(await page.locator('#deck .fusion-selection').count(), 0);
  const emptyHiddenAfter = await page.locator('#deck-empty-panel').evaluate((e) => e.classList.contains('is-hidden'));
  assert.equal(emptyHiddenAfter, false);

  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ ok: true }));
} finally {
  await browser.close();
}
