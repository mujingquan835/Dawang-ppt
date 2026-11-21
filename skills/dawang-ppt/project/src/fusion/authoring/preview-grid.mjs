// Built-in 1-image visual overview generator for fast:build --preview <out.png>.
// Renders all slides in headless Chrome, checks real DOM overflows, and stitches
// every slide into ONE crisp grid PNG so the LLM validates an entire deck in 1 read_file call.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function renderPreviewGrid({ htmlFile, previewFile, chrome = DEFAULT_CHROME }) {
  const start = performance.now();
  const absHtml = path.resolve(htmlFile);
  const absPreview = path.resolve(previewFile);
  fs.mkdirSync(path.dirname(absPreview), { recursive: true });

  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(pathToFileURL(absHtml).href);
    await page.waitForFunction(() => window.__fusionEditor && window.__deck);
    await page.evaluate(() => window.__fusionEditor.ready());
    await page.evaluate(() => document.fonts.ready);

    // Hide editor chrome so we capture clean full-bleed 1920x1080 slides
    await page.addStyleTag({
      content: `
        #deck-topbar, #deck-rail, #deck-panel, #deck-pager, #deck-dock, #fusion-status { display: none !important; }
        #deck-main { display: block !important; position: fixed !important; inset: 0 !important; padding: 0 !important; margin: 0 !important; }
        #deck-viewport { position: fixed !important; inset: 0 !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
        #deck { position: fixed !important; inset: 0 !important; width: 1920px !important; height: 1080px !important; }
        :root { --deck-scale: 1 !important; }
        .slide.active { width: 1920px !important; height: 1080px !important; box-shadow: none !important; border-radius: 0 !important; }
      `,
    });

    const count = await page.evaluate(() => window.__getVisibleSlides().length);
    const slideBuffers = [];
    const overflows = [];

    for (let i = 0; i < count; i++) {
      await page.evaluate((idx) => window.go(idx, { force: true }), i);
      await page.waitForTimeout(60);

      // Quick real-DOM overflow check
      const pageOverflows = await page.evaluate((idx) => {
        const slide = document.querySelector('#deck > .slide.active');
        const root = slide?.querySelector('.fusion-root');
        if (!root) return [];
        const issues = [];
        for (const el of root.querySelectorAll('[data-element-type="text"]')) {
          const fs = parseFloat(getComputedStyle(el).fontSize) || 20;
          const over = el.scrollHeight - el.clientHeight;
          // Ignore harmless single-line CJK font metric descender overhang (< 0.45em and <= 12px)
          if (over > Math.max(12, fs * 0.45)) {
            issues.push({
              slideIndex: idx + 1,
              slideId: slide.dataset.slideId,
              elementId: el.dataset.fusionElement,
              text: el.textContent.slice(0, 24),
              overflowPx: Math.round(over),
            });
          }
        }
        return issues;
      }, i);
      overflows.push(...pageOverflows);

      const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      slideBuffers.push(buf);
    }

    if (slideBuffers.length === 1) {
      // Single slide: write clean 1440x810 overview directly via browser canvas resize
      const b64 = slideBuffers[0].toString('base64');
      const resized = await page.evaluate(async (src) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + src; });
        const c = document.createElement('canvas');
        c.width = 1440; c.height = 810;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 1440, 810);
        return c.toDataURL('image/png').split(',')[1];
      }, b64);
      fs.writeFileSync(absPreview, Buffer.from(resized, 'base64'));
    } else {
      // Multi-slide: stitch into ONE crisp grid image (2x2 for <=4 slides, 3xN for >4 slides)
      const cols = slideBuffers.length <= 4 ? 2 : 3;
      const rows = Math.ceil(slideBuffers.length / cols);
      const cellW = cols === 2 ? 960 : 640;
      const cellH = Math.round((cellW * 9) / 16);
      const gap = 16;
      const b64s = slideBuffers.map((b) => b.toString('base64'));
      const stitched = await page.evaluate(async ({ b64s, cols, rows, cellW, cellH, gap }) => {
        const c = document.createElement('canvas');
        c.width = cols * cellW + (cols + 1) * gap;
        c.height = rows * cellH + (rows + 1) * gap;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#E5E9F0';
        ctx.fillRect(0, 0, c.width, c.height);
        for (let i = 0; i < b64s.length; i++) {
          const img = new Image();
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64s[i]; });
          const r = Math.floor(i / cols), col = i % cols;
          const x = gap + col * (cellW + gap), y = gap + r * (cellH + gap);
          ctx.drawImage(img, x, y, cellW, cellH);
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellW, cellH);
        }
        return c.toDataURL('image/png').split(',')[1];
      }, { b64s, cols, rows, cellW, cellH, gap });
      fs.writeFileSync(absPreview, Buffer.from(stitched, 'base64'));
    }

    return {
      previewFile: absPreview,
      slides: count,
      overflows,
      previewMs: Math.round(performance.now() - start),
    };
  } finally {
    await browser.close();
  }
}
