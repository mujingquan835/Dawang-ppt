import fs from "node:fs";
import { collectExportObjects } from "./collect.mjs";
import { exportEditablePptx } from "./pptx.mjs";
async function captureUrl(browser, url, { snapshot, onProgress = () => {
} } = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__deckViewModel && window.__getVisibleSlides);
    await page.evaluate(async () => {
      await window.__fusionEditor?.ready();
      await document.fonts.ready;
    });
    if (snapshot) await page.evaluate((snapshot2) => window.__dawangExport?.applyEditablePptxSnapshot(snapshot2), snapshot);
    const project = await page.evaluate(() => {
      if (window.__fusionEditor) return window.__fusionEditor.getProject();
      const vm = window.__deckViewModel;
      return { revision: "legacy-html", slides: vm.model.slides || [], editorState: vm.getState(), requirements: { title: document.title } };
    });
    onProgress({ stage: "collecting", detail: "采集可编辑文字、形状与图片", percent: 30 });
    return { page, project, collection: await collectExportObjects(page, project) };
  } catch (error) {
    await page.close();
    throw error;
  }
}
async function exportEditablePptxFromUrl(browser, url, options = {}) {
  const captured = await captureUrl(browser, url, options);
  try {
    const report = await exportEditablePptx(captured.collection, { fileName: options.outFile, title: options.title || captured.project.requirements.title });
    if (options.reportFile) fs.writeFileSync(options.reportFile, JSON.stringify(report, null, 2));
    return { ...report, slideCount: captured.collection.slides.length, textObjects: report.texts, warnings: report.issues };
  } finally {
    await captured.page.close();
  }
}
async function exportScreenshotPdfFromUrl(browser, url, options = {}) {
  const { page, project, collection } = await captureUrl(browser, url, options);
  try {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    pdf.setTitle(options.title || project.requirements.title);
    for (const s of collection.slides) {
      await page.evaluate((id) => {
        const slides = window.__getVisibleSlides();
        window.go(slides.findIndex((s2) => s2.dataset.vmSlideId === id), { animate: false, force: true });
      }, s.slideId);
      const image = await pdf.embedPng(await page.locator(`#deck > [data-vm-slide-id="${s.slideId}"]`).screenshot());
      const p = pdf.addPage([960, 540]);
      p.drawImage(image, { x: 0, y: 0, width: 960, height: 540 });
    }
    fs.writeFileSync(options.outFile, await pdf.save());
    const report = { revision: project.revision, pages: collection.slides.length, generationMode: "screenshot-pdf", slideReports: collection.slides.map((s) => ({ slideId: s.slideId })) };
    if (options.reportFile) fs.writeFileSync(options.reportFile, JSON.stringify(report, null, 2));
    return report;
  } finally {
    await page.close();
  }
}
export {
  captureUrl,
  exportEditablePptxFromUrl,
  exportScreenshotPdfFromUrl
};
