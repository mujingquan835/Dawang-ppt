import { writeEditablePackage } from "./write.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PptxGenJS from "pptxgenjs";
import { composeEditablePptx } from "./pptx-core.mjs";
import { verifyPptxZip } from "./zip-integrity.mjs";
import { collectProjectFromIr } from "./ir-collect.mjs";

function mimeForExt(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "image/jpeg";
}

async function exportEditablePptx(collection, target) {
  const { pptx, report } = composeEditablePptx(PptxGenJS.default || PptxGenJS, collection, target);
  fs.mkdirSync(path.dirname(path.resolve(target.fileName)), { recursive: true });
  fs.writeFileSync(target.fileName, await writeEditablePackage(pptx, collection));
  // Verify the bytes actually on disk, not the in-memory buffer.
  report.zipIntegrity = await verifyPptxZip(fs.readFileSync(target.fileName), { expectedSlides: collection.slides.length });
  fs.writeFileSync(target.fileName + ".report.json", JSON.stringify(report, null, 2));
  if (!report.zipIntegrity.ok) throw new Error("PPTX ZIP integrity check failed: " + JSON.stringify(report.zipIntegrity));
  return report;
}

// Pure-Node headless PPTX export directly from ProjectV2 IR (no Chrome, no DOM scraping).
async function exportProjectPptxHeadless(project, { fileName, baseDir = process.cwd(), assetPool = null, title } = {}) {
  const resolveSrc = (raw) => {
    if (!raw) return raw;
    if (assetPool && raw.startsWith("portable-asset:")) return assetPool.resolveDataUrl(raw);
    if (raw.startsWith("data:")) return raw;
    const abs = raw.startsWith("file:") ? fileURLToPath(raw) : path.resolve(baseDir, raw);
    if (!fs.existsSync(abs)) throw new Error("Missing image file for PPTX export: " + abs);
    return `data:${mimeForExt(abs)};base64,${fs.readFileSync(abs).toString("base64")}`;
  };
  const collection = await collectProjectFromIr(project, { resolveSrc });
  return exportEditablePptx(collection, { fileName, title: title || project.requirements?.title || "Dawang-PPT" });
}

export {
  exportEditablePptx,
  exportProjectPptxHeadless
};
