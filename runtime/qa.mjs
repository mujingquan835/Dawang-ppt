import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { serve } from "./server.mjs";
import { hash, load } from "./project.mjs";
export async function qa(dir) {
  const server = await serve(dir);
  let browser = null;
  const out = path.join(dir, "qa");
  fs.mkdirSync(path.join(out, "pages"), { recursive: true });
  const report = {
    revision: hash(load(dir)),
    pages: [],
    runtimeErrors: [],
    visualReview: "pending",
    clientReview: "pending",
    coverage:
      "Text geometry, table cells, image loading, font availability and unintended text overlap. Image subject cropping requires visual review.",
  };
  try {
    browser = await chromium.launch({
      executablePath:
        process.env.DAWANG_CHROME ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: 1060, height: 800 },
      deviceScaleFactor: 1,
    });
    page.on("pageerror", (e) => report.runtimeErrors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator("img")
      .evaluateAll((imgs) =>
        Promise.all(imgs.map((i) => i.decode().catch(() => {}))),
      );
    for (let i = 0; i < (await page.locator(".slide").count()); i++) {
      const slide = page.locator(".slide").nth(i);
      const result = await slide.evaluate((root) => {
        const errors = [],
          warnings = [],
          fonts = [];
        const frame = root.getBoundingClientRect();
        const elements = [...root.querySelectorAll(".text,th,td")];
        for (const el of elements) {
          const box = el.getBoundingClientRect(),
            cs = getComputedStyle(el),
            id = el.dataset.elementId || el.textContent.slice(0, 30);
          if (
            el.scrollHeight > el.clientHeight + 2 ||
            el.scrollWidth > el.clientWidth + 2
          )
            errors.push(`Text overflow: ${id}`);
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const r of range.getClientRects()) {
            if (
              r.top < box.top - parseFloat(cs.fontSize) * 0.3 ||
              r.bottom > box.bottom + parseFloat(cs.fontSize) * 0.3 ||
              r.left < box.left - 2 ||
              r.right > box.right + 2
            )
              errors.push(`Text escapes container: ${id}`);
            if (
              r.left < frame.left - 2 ||
              r.right > frame.right + 2 ||
              r.top < frame.top - 2 ||
              r.bottom > frame.bottom + 2
            )
              errors.push(`Text outside slide: ${id}`);
          }
          const family = cs.fontFamily
            .split(",")[0]
            .replaceAll('"', "")
            .replaceAll("'", "");
          const probe = document.createElement("canvas").getContext("2d");
          const sample = "中文字体测试AbCd0123";
          const measure = (f) => {
            probe.font = `32px ${f}`;
            return probe.measureText(sample).width;
          };
          const available = ["sans-serif", "serif", "monospace"].some(
            (f) => Math.abs(measure(`"${family}",${f}`) - measure(f)) > 0.01,
          );
          if (!available)
            errors.push(
              `Font fallback: ${family}; specify available font and remeasure`,
            );
          fonts.push({ family, available });
        }
        const texts = [...root.querySelectorAll(".text")];
        for (let a = 0; a < texts.length; a++)
          for (let b = a + 1; b < texts.length; b++) {
            const x = texts[a].getBoundingClientRect(),
              y = texts[b].getBoundingClientRect();
            if (
              Math.min(x.right, y.right) - Math.max(x.left, y.left) > 2 &&
              Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2
            )
              errors.push(
                `Text overlap: ${texts[a].dataset.elementId} / ${texts[b].dataset.elementId}`,
              );
          }
        for (const image of root.querySelectorAll("img")) {
          if (!image.naturalWidth)
            errors.push(`Missing image: ${image.dataset.mediaRef}`);
          else if (image.naturalWidth < image.clientWidth * 0.75)
            warnings.push(`Low resolution image: ${image.dataset.mediaRef}`);
        }
        return {
          slideId: root.dataset.slideId,
          errors: [...new Set(errors)],
          warnings: [...new Set(warnings)],
          fonts: [...new Map(fonts.map((f) => [f.family, f])).values()],
          textCount: texts.length,
          imageCount: root.querySelectorAll("img").length,
          tableRows: root.querySelectorAll("tbody tr").length,
        };
      });
      report.pages.push(result);
      await slide.screenshot({ path: path.join(out, "pages", `${i + 1}.png`) });
    }
    const tw = 480,
      th = 270,
      gap = 12,
      cols = 3;
    const sheet = new PNG({
      width: cols * (tw + gap) + gap,
      height: Math.ceil(report.pages.length / cols) * (th + gap) + gap,
    });
    sheet.data.fill(232);
    for (let i = 0; i < report.pages.length; i++) {
      const src = PNG.sync.read(
        fs.readFileSync(path.join(out, "pages", `${i + 1}.png`)),
      );
      for (let y = 0; y < th; y++)
        for (let x = 0; x < tw; x++) {
          const from =
              (Math.floor((y * src.height) / th) * src.width +
                Math.floor((x * src.width) / tw)) *
              4,
            to =
              ((gap + Math.floor(i / cols) * (th + gap) + y) * sheet.width +
                gap +
                (i % cols) * (tw + gap) +
                x) *
              4;
          src.data.copy(sheet.data, to, from, from + 4);
        }
    }
    fs.writeFileSync(path.join(out, "overview.png"), PNG.sync.write(sheet));
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
  report.geometryPassed =
    report.runtimeErrors.length === 0 &&
    report.pages.every((p) => !p.errors.length);
  report.passed = false;
  fs.writeFileSync(
    path.join(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  return report;
}
