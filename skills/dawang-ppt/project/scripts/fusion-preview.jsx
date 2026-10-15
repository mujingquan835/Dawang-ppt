#!/usr/bin/env node
import { extractDataUrlMedia } from "./persist-deck-state.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { loadProject, saveProject } from "../src/fusion/project/store.mjs";
import { mergeEditorState } from "../src/fusion/project/import-goal.mjs";
import { renderProject } from "../src/fusion/scene/render-project.jsx";
import { collectExportObjects, prepareSlideForExport } from "../src/fusion/export/collect.mjs";
import { exportEditablePptx } from "../src/fusion/export/pptx.mjs";
import { contentType } from "./preview/mime.mjs";
import { createFileResolver } from "./preview/static-serve.mjs";
function createFusionServer({ dir, port = 0, chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }) {
  dir = path.resolve(dir);
  const projectFile = path.join(dir, "deck-project.json");
  const html = path.join(dir, "index.html");
  const resolveFile = createFileResolver({ lexicalServeRoot: dir, realServeRoot: fs.realpathSync(dir) });
  let busy = false;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const json = (status, obj) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    try {
      if (req.method === "POST") {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}`) return json(403, { ok: false, issues: ["Origin mismatch"] });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 64 * 1024 * 1024) throw new Error("Payload too large");
        }
        const data = JSON.parse(body || "{}");
        if (url.pathname === "/api/save-deck-state") {
          if (busy) return json(409, { ok: false, conflicts: [{ kind: "operation-in-progress" }] });
          busy = true;
          try {
            const old = loadProject(projectFile);
            let project = data.project || old;
            project = mergeEditorState(project, data.state || project.editorState.legacy);
            const staged = extractDataUrlMedia(project, dir);
            const result = saveProject(projectFile, staged.state, data.expectedRevision || old.revision);
            if (!result.ok) return json(409, result);
            let previewError;
            try {
              renderProject(result.project, html);
            } catch (e) {
              previewError = e.message;
            }
            return json(200, { ok: true, revision: result.revision, previewError, mediaMap: staged.mediaMap, mediaWritten: staged.written });
          } finally {
            busy = false;
          }
        }
        if (["/api/export-editable-pptx", "/api/export-pdf"].includes(url.pathname)) {
          if (busy) return json(409, { ok: false, issues: ["Operation in progress"] });
          busy = true;
          let browser;
          try {
            const project = loadProject(projectFile);
            if (data.expectedRevision && data.expectedRevision !== project.revision) return json(409, { ok: false, issues: ["Revision mismatch"] });
            renderProject(project, html);
            browser = await chromium.launch({ executablePath: chrome, headless: true });
            const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
            await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
            await page.waitForFunction(() => window.__fusionEditor && window.__renderRuntimeSlide);
            const collected = await collectExportObjects(page, project);
            const pdf = url.pathname === "/api/export-pdf";
            const name = pdf ? "presentation.pdf" : "presentation.pptx";
            const exportsDir = path.join(dir, "exports");
            fs.mkdirSync(exportsDir, { recursive: true });
            let report;
            if (pdf) {
              const { PDFDocument } = await import("pdf-lib");
              const document = await PDFDocument.create();
              for (const s of collected.slides) {
                await prepareSlideForExport(page, s.slideId);
                const png = await page.locator(`[data-vm-slide-id="${s.slideId}"]`).screenshot();
                const image = await document.embedPng(png);
                const p = document.addPage([960, 540]);
                p.drawImage(image, { x: 0, y: 0, width: 960, height: 540 });
              }
              fs.writeFileSync(path.join(exportsDir, name), await document.save());
              report = { revision: project.revision };
            } else report = await exportEditablePptx(collected, { fileName: path.join(exportsDir, name), title: project.requirements.title });
            return json(200, { ok: true, revision: project.revision, report, downloadName: name, downloadUrl: "/exports/" + name });
          } finally {
            await browser?.close();
            busy = false;
          }
        }
        return json(404, { ok: false, issues: ["Unknown operation"] });
      }
      const file = resolveFile(path.join(dir, decodeURIComponent(url.pathname)));
      if (!file || url.pathname.split("/").some((s) => s.startsWith(".")) || file.endsWith("deck-project.json")) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "content-type": contentType(file) });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      return json(500, { ok: false, issues: [e.message] });
    }
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
if (process.argv[1] === import.meta.filename) {
  const server = await createFusionServer({ dir: process.argv[2], port: Number(process.argv[3]) || 8766 });
  console.log(`Dawang-PPT: http://127.0.0.1:${server.address().port}/index.html`);
}
export {
  createFusionServer
};
