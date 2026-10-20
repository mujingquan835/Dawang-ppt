import { screenshotSlide } from '../qa/readiness.mjs';
import fs from "node:fs";
import { collectExportObjects, prepareSlideForExport } from "./collect.mjs";
import { exportEditablePptx } from "./pptx.mjs";
async function captureUrl(browser, url, { snapshot, expectedRevision, onProgress = () => {
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
    if(expectedRevision && project.revision!==expectedRevision)throw new Error("Revision mismatch: "+project.revision);
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
    const report=await writeScreenshotPdf(page,project,collection,options.outFile,{title:options.title});
    if(options.reportFile)fs.writeFileSync(options.reportFile,JSON.stringify(report,null,2));
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

export async function writeScreenshotPdf(page,project,collection,outFile,{title}={}){
 const issues=collection.slides.flatMap(s=>s.issues||[]);
 if(issues.length)throw new Error('PDF collection blocked: '+JSON.stringify(issues));
 const {PDFDocument}=await import('pdf-lib'),pdf=await PDFDocument.create();
 pdf.setTitle(title||project.requirements.title);pdf.setSubject('ProjectV2 revision '+project.revision);
 for(const slide of collection.slides){
  await prepareSlideForExport(page,slide.slideId);
  const image=await pdf.embedPng(await screenshotSlide(page,slide.slideId));
  pdf.addPage([960,540]).drawImage(image,{x:0,y:0,width:960,height:540});
 }
 fs.writeFileSync(outFile,await pdf.save());
 const report={revision:project.revision,pages:collection.slides.length,generationMode:'screenshot-pdf',textSelectable:false,fonts:(collection.fonts||[]).map(font=>({...font,embedding:'not-embedded',representation:'rasterized-glyphs'})),unsupported:[],rasterized:collection.slides.map(slide=>({slideId:slide.slideId,scope:'entire-slide',includesText:true})),slideReports:collection.slides.map(slide=>({slideId:slide.slideId}))};
 fs.writeFileSync(outFile+'.report.json',JSON.stringify(report,null,2));return report;
}
