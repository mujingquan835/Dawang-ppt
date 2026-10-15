import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createProjectFromBrief } from "../../../skills/dawang-ppt/project/scripts/fusion-cli.jsx";
import { saveProject, loadProject } from "../../../skills/dawang-ppt/project/src/fusion/project/store.mjs";
import { renderProject } from "../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx";
import { createFusionServer } from "../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx";
import { measureProject } from "../../../skills/dawang-ppt/project/src/fusion/qa/measure.mjs";
import { STYLE_DEFINITIONS } from "../../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs";
const base = path.resolve("output/fusion-v1/family-variants");
fs.mkdirSync(base, { recursive: true });
const { PNG } = await import("../../../skills/dawang-ppt/project/node_modules/pngjs/lib/png.js");
const image = new PNG({ width: 320, height: 180 });
image.data.fill(200);
for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
const photo = path.join(base, "synthetic.png");
fs.writeFileSync(photo, PNG.sync.write(image));
const nodes = Array.from({ length: 4 }, (_, i) => ({ nodeId: "n" + i, label: "测试步骤 " + (i + 1) })), chart = { unit: "合成单位", period: "结构测试", series: [{ nodeId: "a", label: "甲", value: 8 }, { nodeId: "b", label: "乙", value: 12 }, { nodeId: "c", label: "丙", value: 6 }] }, columns = Array.from({ length: 6 }, (_, i) => ({ columnId: "c" + i, label: "测试项" + (i + 1), width: i === 0 ? 2 : 1 })), rows = Array.from({ length: 8 }, (_, i) => ({ rowId: "r" + i, cells: Object.fromEntries(columns.map((c, j) => [c.columnId, j === 0 ? "对象" + (i + 1) : (i + j) % 10])) }));
const evidence = [];
for (const style of Object.values(STYLE_DEFINITIONS).filter((s) => s.id.startsWith("kimi/"))) {
  const dir = path.join(base, style.id.split("/").at(-1));
  fs.mkdirSync(path.join(dir, "assets/user-media"), { recursive: true });
  fs.copyFileSync(photo, path.join(dir, "assets/user-media/photo.png"));
  const contents = style.pageTypes.map((type) => {
    const isPhoto = /photo|image|text-photo|cover-section/.test(type);
    const kind = type === "heat-table" || type === "profile" || type === "sparse-table" ? "table" : type === "comparison-case" || type === "comparison" ? "comparison" : "process";
    return { slideId: type, pageType: type, kind: isPhoto ? "images" : kind, title: "合成页型结构验证", scope: "合成材料仅验证结构，不代表业务业绩。", explanation: "完整保留输入，检查结构与编辑能力。", source: "来源：公开合成夹具", judgments: ["判断一：保留所有输入材料。", "判断二：使用家族构图规则。"], navigation: ["总览", "结构", "趋势", "证据", "判断"], microCharts: Array.from({ length: 4 }, (_, i) => ({ kind: "line", data: chart, judgments: ["合成判断 " + (i + 1)] })), data: isPhoto ? { images: [{ mediaId: "test", src: "assets/user-media/photo.png", kind: "photo" }] } : kind === "table" ? { columns: type === "profile" ? columns.slice(0, 4) : columns, rows } : { nodes: type === "comparison-case" ? nodes.slice(0, 2) : nodes } };
  });
  const p = createProjectFromBrief({ title: "首批家族页型（合成结构验证）", styleId: style.id, contentSlides: contents });
  const pf = path.join(dir, "deck-project.json");
  fs.rmSync(pf, { force: true });
  const saved = saveProject(pf, p, null);
  renderProject(saved.project, path.join(dir, "index.html"));
  const server = await createFusionServer({ dir });
  try {
    fs.mkdirSync(path.join(dir, "qa"), { recursive: true });
    const origin = `http://127.0.0.1:${server.address().port}`, qa = await measureProject(origin + "/index.html", saved.project, { screenshotDir: path.join(dir, "qa") });
    fs.writeFileSync(path.join(dir, "qa.json"), JSON.stringify(qa, null, 2));
    const res = await (await fetch(origin + "/api/export-editable-pptx", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: saved.revision }) })).json();
    evidence.push({ styleId: style.id, pages: qa.pages.length, issues: qa.pages.flatMap((p2) => p2.issues), export: res });
    console.log({ style: style.name, issues: qa.pages.flatMap((p2) => p2.issues), export: res.ok });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
fs.writeFileSync(path.join(base, "evidence.json"), JSON.stringify(evidence, null, 2));
assert(evidence.every((e) => !e.issues.length && e.export.ok), "Family page types must pass actual browser/export validation");
