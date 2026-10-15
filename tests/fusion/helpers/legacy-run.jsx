import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs";
import { importGoal } from "../../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs";
import { saveProject } from "../../../skills/dawang-ppt/project/src/fusion/project/store.mjs";
import { renderProject } from "../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx";
import { createFusionServer } from "../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx";
import { collectExportObjects } from "../../../skills/dawang-ppt/project/src/fusion/export/collect.mjs";
import { exportEditablePptx } from "../../../skills/dawang-ppt/project/src/fusion/export/pptx.mjs";
import { THEME_PAGES } from "../../../skills/dawang-ppt/project/src/components/themes/index.jsx";
const dir = path.resolve("output/fusion-v1/legacy-regression");
fs.mkdirSync(dir, { recursive: true });
const pages = THEME_PAGES.filter((page) => page.pageNumber === 1 || ["theme09", "theme13", "theme16"].includes(page.themeKey) && [6, 11].includes(page.pageNumber));
let p = importGoal({ title: "原模板回归（原始示例素材）", slides: pages.map((page) => ({ id: page.key, layout: page.key, props: {} })) });
p.editorState.legacy.typography = { mode: "global", headingFont: "theme", bodyFont: "theme", monoFont: "theme" };
const pf = path.join(dir, "deck-project.json");
fs.rmSync(pf, { force: true });
p = saveProject(pf, p, null).project;
renderProject(p, path.join(dir, "index.html"));
const server = await createFusionServer({ dir });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }), errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => window.__fusionEditor);
  await page.evaluate(() => window.__fusionEditor.ready());
  const collection = await collectExportObjects(page, p);
  fs.writeFileSync(path.join(dir, "collection.json"), JSON.stringify(collection, null, 2));
  const results = [];
  for (const s of collection.slides) {
    await page.evaluate((id) => {
      const slides = window.__getVisibleSlides();
      window.go(slides.findIndex((s2) => s2.dataset.vmSlideId === id), { force: true, animate: false });
    }, s.slideId);
    await page.locator(`#deck > [data-vm-slide-id="${s.slideId}"]`).screenshot({ path: path.join(dir, s.slideId + ".png") });
    let report, error;
    try {
      report = await exportEditablePptx({ ...collection, slides: [s] }, { fileName: path.join(dir, s.slideId + ".pptx") });
    } catch (e) {
      error = e.message;
    }
    results.push({ slideId: s.slideId, objects: s.objects.length, issues: s.issues, error, report });
  }
  fs.writeFileSync(path.join(dir, "evidence.json"), JSON.stringify({ pages: results, browserErrors: errors }, null, 2));
  console.log(results.map((s) => ({ id: s.slideId, issues: s.issues, error: s.error })));
  assert.equal(errors.length, 0);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
