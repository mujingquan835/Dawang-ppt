import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';

const REPO = path.resolve(import.meta.dirname, '../..');
const DAWANG = path.join(REPO, 'skills/dawang-ppt/scripts/dawang.mjs');
const SAMPLE_OUTLINE = path.join(REPO, 'skills/dawang-ppt/examples/outline-work-report.json');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test('fast:build produces sub-second portable HTML + native PPTX with detached FontFace dual fonts and zero-lag browser editing', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-fast-engine-'));
  const htmlOut = path.join(tmp, 'deck.html');
  const pptxOut = path.join(tmp, 'deck.pptx');
  const wsDir = path.join(tmp, 'workspace');

  try {
    const res = spawnSync(
      process.execPath,
      [DAWANG, 'fast:build', SAMPLE_OUTLINE, htmlOut, '--pptx', pptxOut, '--workspace', wsDir],
      { encoding: 'utf8' }
    );
    assert.equal(res.status, 0, res.stderr || res.stdout);
    const report = JSON.parse(res.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.mode, 'fast-build-node');
    assert.equal(report.slides, 5);
    assert.ok(report.durationMs < 5000, `Expected fast pure-Node build, got ${report.durationMs}ms`);
    assert.equal(report.pptx.zipOk, true);
    assert.ok(report.pptx.texts > 0 && report.pptx.shapes > 0);
    assert.ok(fs.existsSync(htmlOut) && fs.existsSync(pptxOut));

    // Verify in real Chrome over file://
    if (fs.existsSync(CHROME)) {
      const browser = await chromium.launch({ executablePath: CHROME, headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

        await page.goto(pathToFileURL(htmlOut).href);
        await page.waitForFunction(() => window.__fusionEditor && window.__deck);
        await page.evaluate(() => window.__fusionEditor.ready());
        await page.evaluate(() => document.fonts.ready);

        const state = await page.evaluate(() => {
          const styleHasBase64 = [...document.querySelectorAll('style')].some((s) => s.textContent.includes('base64,'));
          const families = [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))];
          return { styleHasBase64, families };
        });
        assert.equal(state.styleHasBase64, false, 'Live <style> must not embed base64 fonts');
        assert.ok(state.families.includes('Source Han Sans SC'), 'Source Han Sans SC should be loaded');
        assert.ok(state.families.includes('YouSheBiaoTiHei'), 'YouSheBiaoTiHei should be loaded');

        // Free editing: add text, undo, redo, delete
        const before = await page.evaluate(() => document.querySelectorAll('#deck > .slide.active [data-fusion-element]').length);
        await page.click('#deck-add-text');
        const afterAdd = await page.evaluate(() => document.querySelectorAll('#deck > .slide.active [data-fusion-element]').length);
        assert.equal(afterAdd, before + 1);
        await page.click('#fusion-undo');
        const afterUndo = await page.evaluate(() => document.querySelectorAll('#deck > .slide.active [data-fusion-element]').length);
        assert.equal(afterUndo, before);

        // Zero-clone HTML save + IR-to-PPTX export in browser
        const perf = await page.evaluate(async () => {
          const t1 = performance.now();
          const savedHtml = await window.__fusionEditor.serializeHtml();
          const saveMs = performance.now() - t1;
          const t2 = performance.now();
          const pptx = await window.__dawangExport.exportEditablePptxInBrowser();
          const pptxMs = performance.now() - t2;
          return { saveMs, savedLen: savedHtml.length, pptxMs, pptxBytes: pptx.blob.size, texts: pptx.report.texts };
        });
        assert.ok(perf.savedLen > 100000);
        assert.ok(perf.saveMs < 1000, `Expected fast zero-clone save, got ${perf.saveMs}ms`);
        assert.ok(perf.pptxBytes > 5000 && perf.texts > 0);
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
