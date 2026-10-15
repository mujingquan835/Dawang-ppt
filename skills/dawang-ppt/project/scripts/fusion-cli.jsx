#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { THEME_PACK_OPTIONS } from "../src/options.jsx";
import { composeDeck } from "../src/deckComposer.jsx";
import { validateGoalSpec } from "./validate-goal-spec.mjs";
import { importGoal } from "../src/fusion/project/import-goal.mjs";
import { loadProject, saveProject, hashFile } from "../src/fusion/project/store.mjs";
import { resolveStyle, STYLE_DEFINITIONS } from "../src/fusion/styles/registry.mjs";
import { composeContentSlide } from "../src/fusion/styles/compose.mjs";
import { renderProject } from "../src/fusion/scene/render-project.jsx";
import { createFusionServer } from "./fusion-preview.jsx";
import { measureProject } from "../src/fusion/qa/measure.mjs";
const caller = process.env.INIT_CWD || process.cwd();
const absolute = (file) => path.resolve(caller, file);
function stageMedia(project, sourceDir, targetDir) {
  const media = [];
  const transform = (value, key = "") => {
    if (Array.isArray(value)) return value.map((v) => transform(v, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, transform(v, k)]));
    if (typeof value === "string" && value.trim() && /^(src|image|images|imageSrc|imageUrl|heroImage|coverImage)$/.test(key) && !value.startsWith("data:") && !/^https?:/.test(value)) {
      const candidates = value.startsWith("file:") ? [fileURLToPath(value)] : [path.resolve(sourceDir, value), path.resolve(sourceDir, "ppt", value)];
      const found = candidates.filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
      if (found.length > 1 && new Set(found.map(hashFile)).size > 1) throw new Error("Ambiguous local image: " + value);
      const file = found[0] || candidates[0];
      const existing = path.resolve(targetDir, value);
      if (!fs.existsSync(file)) {
        if (fs.existsSync(existing)) return value;
        throw new Error("Required local image not found: " + value);
      }
      const hash = hashFile(file), name = hash.slice(0, 20) + path.extname(file), rel = "assets/user-media/" + name;
      fs.mkdirSync(path.join(targetDir, "assets/user-media"), { recursive: true });
      if (path.resolve(file) !== path.resolve(targetDir, rel)) fs.copyFileSync(file, path.join(targetDir, rel));
      media.push({ mediaId: hash, sha256: hash, source: file, src: rel });
      return rel;
    }
    return value;
  };
  const p = transform(project);
  p.media.entries = [...p.media.entries, ...media.filter((m) => !p.media.entries.some((e) => e.mediaId === m.mediaId))];
  return p;
}
function createProjectFromBrief(brief) {
  const style = resolveStyle(brief.styleId);
  const resolvedContents = brief.contentSlides.map((c) => {
    const v = structuredClone(c);
    for (const k of ["title", "explanation", "scope"]) if (v[k + "Ref"]) {
      const node = brief.contentNodes?.[v[k + "Ref"]];
      if (!node) throw new Error("Missing content node " + v[k + "Ref"]);
      v[k] = node.text;
    }
    for (const node of v.data?.nodes || []) if (node.contentRef) {
      const source = brief.contentNodes?.[node.contentRef];
      if (!source) throw new Error("Missing node content " + node.contentRef);
      node.label = source.text;
    }
    return v;
  });
  const contents = resolvedContents.flatMap((c) => {
    const images = c.data?.images || c.images || [];
    if (!style.media.onlyPrimary || images.length <= 1) return [c];
    if (!style.id.startsWith("kimi/work/moon-white")) throw new Error("该家族的多照片处理尚需明确取舍；保留全部图片并询问，不自动拆页或删除。");
    if (brief.fixedPageCount || brief.pageCount) throw new Error("Moon-white requires photo page splitting, conflicting with fixed page count. Ask the user before changing page count.");
    return images.map((image, i) => ({ ...c, slideId: c.slideId + "/photo-" + (i + 1), title: c.title, data: { ...c.data, arrangement: "single", images: [image] }, imageSequence: { index: i + 1, total: images.length, sourceSlideId: c.slideId } }));
  });
  const slides = contents.map((c) => composeContentSlide(c, style));
  const p = importGoal({ title: brief.title, audience: brief.audience, goal: brief.purpose, styleId: brief.styleId, slides });
  p.designChoice = { styleId: brief.styleId, sourceVariant: style.source.variant, originalTemplate: false };
  p.editorState.legacy.typography = { mode: "global", headingFont: "theme", bodyFont: "theme", monoFont: "theme" };
  p.contentPlan = { audience: brief.audience || "", purpose: brief.purpose || "", scenario: brief.scenario || "management-report", nodes: brief.contentNodes || {}, slides: contents.map((c, i) => ({ ...c, slideId: slides[i].slideId, requiredContentRefs: c.requiredContentRefs || [] })) };
  p.requirements.requiredMedia = brief.requiredMedia || [];
  p.requirements.fixedPageCount = brief.fixedPageCount || brief.pageCount || null;
  return p;
}
async function main(args = process.argv.slice(2)) {
  const [mode, input, output] = args;
  if (mode === "styles") {
    console.log(JSON.stringify([...Object.entries(THEME_PACK_OPTIONS).map(([key, s]) => ({ id: "legacy/" + key, name: s.label || s.name, mode: "template", compositionSupport: !!STYLE_DEFINITIONS["legacy/" + key], status: "source-retained" })), ...Object.values(STYLE_DEFINITIONS).filter((s) => s.id.startsWith("kimi/")).map((s) => ({ id: s.id, name: s.name, status: s.status, pageTypes: s.pageTypes || s.compositions, signature: s.signature }))], null, 2));
    return;
  }
  if (!input) throw new Error("Usage: dawang <render:goal|render:brief|render:project|preview:start|export:pptx|export:pdf|qa:project> <file-or-project-directory> [output.html|output.pptx|port]");
  if (["render:goal", "render:brief", "render:project"].includes(mode)) {
    if (!output) throw new Error("Output HTML path required");
    const file = absolute(input), outFile = absolute(output), dir2 = path.dirname(outFile), pf2 = path.join(dir2, "deck-project.json");
    if (mode === "render:project") {
      let p2 = loadProject(file);
      if (file !== pf2) {
        if (fs.existsSync(pf2)) throw new Error("Output project exists; refusing to overwrite edits");
        p2 = stageMedia(p2, path.dirname(file), dir2);
        p2 = saveProject(pf2, p2, null).project;
      }
      renderProject(p2, outFile);
      console.log(JSON.stringify({ outFile, projectFile: pf2, revision: p2.revision }));
      return;
    }
    if (fs.existsSync(pf2)) throw new Error("Project already exists. Re-render saved ProjectV2 instead of importing the initial goal over edits.");
    const source = JSON.parse(fs.readFileSync(file, "utf8"));
    let project;
    if (mode === "render:brief") project = createProjectFromBrief(source);
    else {
      const issues = validateGoalSpec(source);
      if (issues.length) throw new Error(issues.join("\n"));
      let state = null;
      const fromFlag = args.indexOf("--from-html");
      if (fromFlag >= 0) {
        const text = fs.readFileSync(absolute(args[fromFlag + 1]), "utf8");
        const block = /<script id="deck-view-model" type="application\/json">([\s\S]*?)<\/script>/.exec(text);
        if (!block) throw new Error("Embedded original editor state missing");
        state = JSON.parse(block[1]).state;
        const textState = /<script id="embedded-text-state" type="application\/json">([\s\S]*?)<\/script>/.exec(text);
        if (textState) state.text = { ...state.text, ...JSON.parse(textState[1]) };
      }
      project = importGoal({ ...composeDeck(source), audience: source.audience, goal: source.goal }, state);
    }
    project.sources.entries[0] = { sourceId: "goal", kind: "input", source: file, sha256: hashFile(file) };
    project = stageMedia(project, path.dirname(file), dir2);
    const result = saveProject(pf2, project, null);
    if (!result.ok) throw new Error(JSON.stringify(result));
    renderProject(result.project, outFile);
    console.log(JSON.stringify({ outFile, projectFile: pf2, revision: result.revision }));
    return;
  }
  const dir = absolute(input), pf = path.join(dir, "deck-project.json");
  const p = loadProject(pf);
  renderProject(p, path.join(dir, "index.html"));
  if (mode === "preview:start") {
    const server2 = await createFusionServer({ dir, port: Number(output) || 8766 });
    console.log(`Dawang-PPT http://127.0.0.1:${server2.address().port}/index.html`);
    return;
  }
  const server = await createFusionServer({ dir });
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (mode === "qa:project") {
      const qa = await measureProject(origin + "/index.html", p);
      fs.writeFileSync(path.join(dir, "qa-report.json"), JSON.stringify(qa, null, 2));
      console.log(JSON.stringify({ ok: qa.ok, pages: qa.pages.length, issues: qa.pages.flatMap((p2) => p2.issues), aestheticAcceptance: qa.aestheticAcceptance }));
      if (!qa.ok) process.exitCode = 1;
    } else if (["export:pptx", "export:pdf"].includes(mode)) {
      const response = await fetch(origin + (mode === "export:pdf" ? "/api/export-pdf" : "/api/export-editable-pptx"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: p.revision }) });
      const result = await response.json();
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      const file = path.join(dir, "exports", result.downloadName);
      if (output) fs.copyFileSync(file, absolute(output));
      console.log(JSON.stringify({ ...result, file: output ? absolute(output) : file }));
    } else throw new Error("Unknown command " + mode);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
if (process.argv[1] === import.meta.filename) main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
export {
  createProjectFromBrief,
  main
};
