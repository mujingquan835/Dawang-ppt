import test from "node:test";
import assert from "node:assert/strict";
import PptxGenJS from "../../skills/dawang-ppt/project/node_modules/pptxgenjs/dist/pptxgen.cjs.js";
import JSZip from "../../skills/dawang-ppt/project/node_modules/jszip/lib/index.js";
import { verifyPptxZip } from "../../skills/dawang-ppt/project/src/fusion/export/zip-integrity.mjs";
async function sample() {
  const P = PptxGenJS.default || PptxGenJS, pptx = new P();
  pptx.addSlide().addText("一", { x: 1, y: 1, w: 3, h: 1 });
  pptx.addSlide().addText("二", { x: 1, y: 1, w: 3, h: 1 });
  return Buffer.from(await pptx.write({ outputType: "arraybuffer" }));
}
test("ZIP integrity check runs and records evidence for a valid package", async () => {
  const r = await verifyPptxZip(await sample(), { expectedSlides: 2 });
  assert.equal(r.checked, true);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.slides, 2);
  assert(r.entries > 5);
  assert(Array.isArray(r.warnings));
});
test("ZIP integrity check fails on corrupt bytes, missing parts and slide-count mismatch", async () => {
  const good = await sample();
  const corrupt = Buffer.from(good); corrupt.fill(0, 200, 400);
  assert.equal((await verifyPptxZip(corrupt)).ok, false);
  const zip = await JSZip.loadAsync(good); zip.remove("ppt/slides/slide2.xml");
  const missing = await verifyPptxZip(await zip.generateAsync({ type: "nodebuffer" }));
  assert.equal(missing.ok, false);
  assert(missing.brokenRelationships.length > 0);
  assert.equal((await verifyPptxZip(good, { expectedSlides: 3 })).ok, false);
});
