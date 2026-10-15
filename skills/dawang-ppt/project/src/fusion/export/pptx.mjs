import { writeEditablePackage } from "./write.mjs";
import fs from "node:fs";
import PptxGenJS from "pptxgenjs";
import { composeEditablePptx } from "./pptx-core.mjs";
import { verifyPptxZip } from "./zip-integrity.mjs";
async function exportEditablePptx(collection, target) {
  const { pptx, report } = composeEditablePptx(PptxGenJS.default || PptxGenJS, collection, target);
  fs.writeFileSync(target.fileName, await writeEditablePackage(pptx, collection));
  // Verify the bytes actually on disk, not the in-memory buffer.
  report.zipIntegrity = await verifyPptxZip(fs.readFileSync(target.fileName), { expectedSlides: collection.slides.length });
  fs.writeFileSync(target.fileName + ".report.json", JSON.stringify(report, null, 2));
  if (!report.zipIntegrity.ok) throw new Error("PPTX ZIP integrity check failed: " + JSON.stringify(report.zipIntegrity));
  return report;
}
export {
  exportEditablePptx
};
