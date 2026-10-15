import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs";
import JSZip from "../../../skills/dawang-ppt/project/node_modules/jszip/lib/index.js";
import { importGoal } from "../../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs";
import { saveProject, loadProject } from "../../../skills/dawang-ppt/project/src/fusion/project/store.mjs";
import { renderProject } from "../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx";
import { createFusionServer } from "../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx";
const dir = path.resolve("output/fusion-v1/vertical-test");
fs.mkdirSync(path.join(dir, "assets/user-media"), { recursive: true });
const { PNG } = await import("../../../skills/dawang-ppt/project/node_modules/pngjs/lib/png.js");
const image = new PNG({ width: 320, height: 180 });
image.data.fill(210);
for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
const imagePath = path.join(dir, "fixture.png");
fs.writeFileSync(imagePath, PNG.sync.write(image));
fs.copyFileSync(process.env.FUSION_TEST_IMAGE || imagePath, path.join(dir, "assets/user-media/source.jpg"));
const pf = path.join(dir, "deck-project.json");
if (fs.existsSync(pf)) fs.unlinkSync(pf);
let p = importGoal({ title: "融合纵向小样（结构测试）", themePack: "theme13", slides: [{ id: "old", layout: "theme13_page001", props: { title: "原界面与新组合共存" } }, { slideId: "new", mode: "composition", styleId: "legacy/theme13", compositionId: "text-photo", label: "新组合页", elements: [{ id: "title", type: "text", text: "纵向小样初始标题", bounds: [112, 100, 1696, 110], style: { fontSize: 76, fontWeight: 700 } }, { id: "body", type: "text", text: "真实图片仅验证排版与替换，不推断业务结果。", bounds: [112, 244, 650, 150], style: { fontSize: 34 } }, { id: "rule", type: "line", bounds: [112, 420, 600, 2], style: { stroke: "#1e2bfa", strokeWidth: 3 } }, { id: "photo", type: "image", src: "assets/user-media/source.jpg", fit: "contain", bounds: [850, 245, 960, 650] }], objects: [] }] });
p = saveProject(pf, p, null).project;
renderProject(p, path.join(dir, "index.html"));
const server = await createFusionServer({ dir });
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  const page = await b.newPage({ viewport: { width: 1600, height: 1e3 } });
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("BROWSER", e.message);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__fusionEditor && window.__renderRuntimeSlide);
  await page.evaluate(() => window.__fusionEditor.ready());
  await page.evaluate(() => {
    window.__exitPresentMode();
    window.go(1, { animate: false, force: true });
  });
  await page.locator('#deck [data-fusion-element="title"]').fill("纵向编辑后的标题");
  await page.locator('#deck [data-fusion-element="photo"]').click();
  await page.locator("#fusion-image-input").setInputFiles(imagePath);
  await page.waitForFunction(() => window.__fusionEditor.getProject().slides[1].elements.find((e) => e.id === "photo").mediaRef?.startsWith("upload/"));
  await page.evaluate(() => window.__fusionEditor.save());
  const saved = loadProject(pf);
  assert(saved.slides[1].elements[0].text === "纵向编辑后的标题");
  await page.screenshot({ path: path.join(dir, "editor-after.png") });
  await page.reload();
  await page.waitForFunction(() => window.__fusionEditor);
  await page.evaluate(() => window.__fusionEditor.ready());
  await page.evaluate(() => window.go(1, { animate: false, force: true }));
  assert.equal(await page.locator('#deck [data-fusion-element="title"]').textContent(), "纵向编辑后的标题");
  await page.route("**/api/save-deck-state", (route) => route.abort());
  await page.evaluate(async () => {
    const api = window.__fusionEditor;
    api.apply({ slideId: "new", elementId: "title", type: "text", text: "断网草稿\n第二行" });
    api.apply({ slideId: "new", elementId: "photo", type: "geometry", bounds: [880, 270, 920, 600] });
    await api.flushDraft();
    try {
      await api.save();
    } catch {
    }
  });
  await page.reload();
  await page.waitForFunction(() => window.__fusionEditor);
  await page.evaluate(() => window.__fusionEditor.ready());
  assert.equal(await page.evaluate(() => window.__fusionEditor.getProject().slides[1].elements[0].text), "断网草稿\n第二行");
  assert.deepEqual(await page.evaluate(() => window.__fusionEditor.getProject().slides[1].elements.find((e) => e.id === "photo").bounds), [880, 270, 920, 600]);
  await page.unroute("**/api/save-deck-state");
  await page.evaluate(async () => {
    window.__fusionEditor.apply({ slideId: "new", elementId: "title", type: "text", text: "纵向编辑后的标题" });
    await window.__fusionEditor.save();
  });
  await page.locator('#deck [data-vm-slide-id="new"]').screenshot({ path: path.join(dir, "new-page.png") });
  const result = await page.evaluate(() => window.__exportDeckPptx());
  assert(result.ok);
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(dir, "exports/presentation.pptx")));
  const xml = (await Promise.all(Object.values(zip.files).filter((f) => /^ppt\/slides\/slide\d+.xml$/.test(f.name)).map((f) => f.async("string")))).join("");
  assert(xml.includes("纵向编辑后的标题"));
  assert(xml.includes("真实图片仅验证排版与替换，不推断业务结果。"));
  const evidence = { url, savedText: saved.slides[1].elements[0].text, imageChanged: saved.slides[1].elements.find((e) => e.id === "photo").mediaRef?.startsWith("upload/"), reopened: true, editableTexts: (xml.match(/<a:t>/g) || []).length, editableImages: (xml.match(/<p:pic>/g) || []).length, sameRevision: result.revision === loadProject(pf).revision, report: result.report, browserErrors: errors };
  fs.writeFileSync(path.join(dir, "evidence.json"), JSON.stringify(evidence, null, 2));
  console.log(evidence);
} finally {
  await b.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
