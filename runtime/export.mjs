import fs from "node:fs";
import path from "node:path";
import pptxgen from "pptxgenjs";
import { build } from "./build.mjs";
export async function exportPptx(dir, out = path.join(dir, "Dawang-PPT.pptx")) {
  const { plan, revision } = build(dir);
  const qaFile = path.join(dir, "qa/report.json");
  let geometry = fs.existsSync(qaFile)
    ? JSON.parse(fs.readFileSync(qaFile, "utf8"))
    : null;
  if (geometry?.revision !== revision) {
    const { qa } = await import("./qa.mjs");
    geometry = await qa(dir);
  }
  if (!geometry.geometryPassed)
    throw new Error("Geometry QA failed; repair before exporting");
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Dawang-PPT";
  pptx.subject = "Content-driven presentation";
  pptx.title = "Dawang-PPT";
  pptx.lang = "zh-CN";
  const toIn = (v) => v / 72,
    color = (v) => v.replace("#", "");
  let textObjects = 0,
    imageObjects = 0,
    shapeObjects = 0,
    tables = 0;
  for (const p of plan.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: color(plan.style.background) };
    for (const e of p.elements) {
      const box = {
        x: toIn(e.x),
        y: toIn(e.y),
        w: toIn(e.w),
        h: toIn(e.h),
        objectName: e.id,
      };
      if (e.type === "text") {
        slide.addText(e.text, {
          ...box,
          fontFace: e.fontFace,
          lang: "zh-CN",
          fontSize: e.fontSize,
          bold: e.bold || false,
          color: color(e.color),
          margin: 0,
          breakLine: false,
          paraSpaceAfterPt: 0,
          vertAnchor: "top",
          lineSpacingMultiple: 1.05,
        });
        textObjects++;
      }
      if (e.type === "image") {
        const imagePath = path.resolve(dir, e.src);
        slide.addImage({
          path: imagePath,
          ...box,
          sizing: {
            type: e.fit === "cover" ? "cover" : "contain",
            w: box.w,
            h: box.h,
          },
          objectName: e.id,
        });
        imageObjects++;
      }
      if (e.type === "shape") {
        slide.addShape(pptx.ShapeType.rect, {
          ...box,
          line: { color: color(e.fill), transparency: 100 },
          fill: { color: color(e.fill) },
        });
        shapeObjects++;
      }
      if (e.type === "line") {
        slide.addShape(pptx.ShapeType.line, {
          ...box,
          line: {
            color: color(e.color),
            width: 0.75,
            ...(e.arrow
              ? { beginArrowType: "none", endArrowType: "triangle" }
              : {}),
          },
        });
        shapeObjects++;
      }
      if (e.type === "table") {
        slide.addTable(
          [
            e.headers.map((text) => ({
              text,
              options: {
                fill: color(e.headerFill),
                color: "FFFFFF",
                bold: true,
              },
            })),
            ...e.rows.map((row) =>
              row.map((v) => String(v === null ? "缺失" : v)),
            ),
          ],
          {
            ...box,
            fontFace: e.fontFace,
            lang: "zh-CN",
            fontSize: e.fontSize,
            color: color(e.color),
            border: { type: "solid", pt: 0.5, color: "CCD2D8" },
            margin: 4,
            rowH: toIn(e.h / (e.rows.length + 1)),
            colW: Array(e.headers.length).fill(toIn(e.w / e.headers.length)),
            autoPage: false,
          },
        );
        tables++;
      }
    }
  }
  await pptx.writeFile({ fileName: path.resolve(out) });
  const report = {
    revision,
    slideCount: plan.slides.length,
    textObjects,
    imageObjects,
    shapeObjects,
    nativeTables: tables,
    nativeCharts: 0,
    clientVisualAcceptance: "pending",
    independentRendering: "pending",
  };
  fs.writeFileSync(
    path.join(dir, "export-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  return report;
}
