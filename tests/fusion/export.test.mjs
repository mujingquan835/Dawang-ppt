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
test("gradient text keeps glyph fill and outline watermarks keep their inherited opacity", async () => {
  const collection = { revision: "text-fill", slides: [{ slideId: "s", objects: [{ id: "title", type: "text", text: "标题", bounds: [100, 100, 1e3, 200], style: { fontSize: 148, fontFamily: "PingFang SC", textGradient: { kind: "linear", angle: 90, stops: [{ offset: 0, color: "#ffffff", opacity: 1 }, { offset: 1, color: "#7799ff", opacity: 1 }] } } }, { id: "outline", type: "text", text: "2024", bounds: [400, 700, 1500, 400], style: { fontSize: 540, textTransparency: 100, textStroke: { color: "#ffffff", width: 1.5, opacity: 0.08 } } }] }] };
  const { pptx } = composeEditablePptx(PptxGenJS, collection), zip = await JSZip.loadAsync(await writeEditablePackage(pptx, collection));
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert(xml.includes("</a:solidFill></a:ln><a:noFill/><a:latin"), "transparent outlined text must retain a well-formed stroke and no glyph fill");
  assert.match(xml, /<a:rPr[^>]*>[\s\S]*?<a:gradFill/);
  assert.match(xml, /<a:ln w="9525"><a:solidFill><a:srgbClr val="ffffff"><a:alpha val="8000"/);
});
test("circular timeline and chart markers never receive round-rectangle adjustment guides", async () => {
  const collection = { revision: "marker", slides: [{ slideId: "s", objects: [{ id: "dot", type: "shape", shape: "ellipse", bounds: [100, 100, 20, 20], style: { fill: "#1a73e8", radius: 999 } }, { id: "after", type: "text", text: "marker stays editable", bounds: [150, 100, 400, 100], style: { fontSize: 30 } }] }] };
  const { pptx } = composeEditablePptx(PptxGenJS, collection), zip = await JSZip.loadAsync(await writeEditablePackage(pptx, collection)), xml = await zip.file("ppt/slides/slide1.xml").async("string");
  const circle = xml.match(/<a:prstGeom prst="ellipse">([\s\S]*?)<\/a:prstGeom>/)[1];
  assert(!circle.includes("<a:gd "), "ellipse cannot inherit rectRadius=999 adjustment");
  assert(xml.includes("marker stays editable"));
});
test("background decorations embed SVG and a real compatibility preview without flattening text", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#03071a"/></svg>', preview = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7k0AAAAASUVORK5CYII=";
  const collection = { revision: "svg", slides: [{ slideId: "s", objects: [{ id: "background-art", type: "decoration", classification: "background-decoration", bounds: [0, 0, 1920, 1080], svg, preview }, { id: "title", type: "text", text: "Editable headline", bounds: [100, 100, 1200, 200], style: { fontSize: 100, color: "#ffffff" } }] }] };
  const { pptx, report } = composeEditablePptx(PptxGenJS, collection), zip = await JSZip.loadAsync(await writeEditablePackage(pptx, collection));
  assert.equal(report.texts, 1);
  assert.equal(report.decorations[0].representation, "svg");
  assert.equal(await zip.file(Object.keys(zip.files).find((n) => n.endsWith(".svg"))).async("string"), svg);
  const pngs = await Promise.all(Object.keys(zip.files).filter((n) => n.endsWith(".png")).map((n) => zip.file(n).async("base64")));
  assert(pngs.includes(preview.split(",")[1]));
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert(xml.includes("asvg:svgBlip"));
  assert(xml.includes("<a:t>Editable headline</a:t>"));
});
test("Archivo export selects the matching installed original weight, avoiding Office font substitution", async () => {
  const collection = { revision: "font", slides: [{ slideId: "s", objects: [{ id: "year", type: "text", text: "2024", bounds: [100, 100, 600, 200], style: { fontFamily: "Archivo SemiBold", fontPostScript: "ArchivoRoman-Black", fontWeight: 900, fontSize: 148 } }, { id: "chip", type: "text", text: "120+", bounds: [100, 400, 600, 200], style: { fontFamily: "Archivo SemiBold", fontPostScript: "ArchivoRoman-ExtraBold", fontWeight: 800, fontSize: 80 } }] }] };
  const { pptx } = composeEditablePptx(PptxGenJS, collection), zip = await JSZip.loadAsync(await writeEditablePackage(pptx, collection)), xml = await zip.file("ppt/slides/slide1.xml").async("string");
  assert(xml.includes('typeface="Archivo SemiBold Black"'));
  assert(xml.includes('typeface="Archivo SemiBold ExtraBold"'));
});
