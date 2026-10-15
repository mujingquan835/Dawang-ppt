import test from "node:test";
import assert from "node:assert/strict";
import PptxGenJS from "../../skills/dawang-ppt/project/node_modules/pptxgenjs/dist/pptxgen.es.js";
import JSZip from "../../skills/dawang-ppt/project/node_modules/jszip/lib/index.js";
import { composeEditablePptx } from "../../skills/dawang-ppt/project/src/fusion/export/pptx-core.mjs";
import { writeEditablePackage } from "../../skills/dawang-ppt/project/src/fusion/export/write.mjs";
test("left/up connectors export legal positive extents and editable native shapes", async () => {
  const collection = { revision: "test", slides: [{ slideId: "s", objects: [{ id: "back", type: "line", bounds: [100, 100, 500, 300], points: [500, 300, 0, 0], endArrow: "triangle", style: { stroke: "#2255ff", strokeWidth: 3 } }, { id: "curve", type: "vector", bounds: [200, 200, 300, 100], points: [{ x: 0, y: 0 }, { x: 150, y: 100 }, { x: 300, y: 0 }], closed: false, style: { stroke: "#2255ff", strokeWidth: 3 } }] }] };
  const { pptx } = composeEditablePptx(PptxGenJS, collection), zip = await JSZip.loadAsync(await writeEditablePackage(pptx, collection));
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert(!/<a:ext[^>]*[ch][xy]="-/.test(xml));
  assert(xml.includes('flipH="1"'));
  assert(xml.includes("<a:custGeom>"));
  assert(!xml.includes("<p:pic>"));
});
