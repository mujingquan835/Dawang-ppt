#!/usr/bin/env node
import {patchProject} from '../src/fusion/project/patch.mjs';
import {readAuthoringRules,writeRulesLock} from '../src/fusion/kimi/reference-index.mjs';
import {importPortableHtml} from "../src/fusion/portable/import.mjs";
import {stageMedia} from "../src/fusion/authoring/media.mjs";
import {makeHtml,publishHtml,checkProject} from "../src/fusion/authoring/pipeline.mjs";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { THEME_PACK_OPTIONS } from "../src/options.jsx";
import { composeDeck } from "../src/deckComposer.jsx";
import { validateGoalSpec } from "./validate-goal-spec.mjs";
import { createAuthoredProject } from "../src/fusion/authoring/create-project.mjs";
import { importGoal } from "../src/fusion/project/import-goal.mjs";
import { loadProject, saveProject, hashFile } from "../src/fusion/project/store.mjs";
import { resolveSlideStyle } from "../src/fusion/styles/registry.mjs";
import { planContentSlide } from "../src/fusion/planning/plan-slide.mjs";
import { createLayoutMeasurer } from "../src/fusion/planning/measure-layout.mjs";
import { listAppearances, buildStyleOptions } from "../src/fusion/kimi/style-options.mjs";
import { renderAppearanceGrid } from "../src/fusion/styles/appearance-grid.mjs";
import { renderProject } from "../src/fusion/scene/render-project.jsx";
import { createFusionServer } from "./fusion-preview.jsx";
import { measureProject } from "../src/fusion/qa/measure.mjs";
const caller = process.env.INIT_CWD || process.cwd();
const absolute = (file) => path.resolve(caller, file);
function resolveBriefContents(brief, style) {
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
    if (style.media.multiImagePolicy !== "split") throw new Error("该家族的多照片处理尚需明确取舍；保留全部图片并询问，不自动拆页或删除。");
    if (brief.fixedPageCount || brief.pageCount) throw new Error("Moon-white requires photo page splitting, conflicting with fixed page count. Ask the user before changing page count.");
    return images.map((image, i) => ({ ...c, slideId: c.slideId + "/photo-" + (i + 1), title: c.title, data: { ...c.data, arrangement: "single", images: [image] }, imageSequence: { index: i + 1, total: images.length, sourceSlideId: c.slideId } }));
  });
  return contents;
}
function projectFromContents(brief, style, contents, slides) {
  const p = importGoal({ title: brief.title, audience: brief.audience, goal: brief.purpose, styleId: brief.styleId, slides });
  p.designChoice = { layoutEngine: "content-first", styleId: brief.styleId, sourceVariant: style.source.variant, originalTemplate: false };
  p.editorState.legacy.typography = { mode: "global", headingFont: "theme", bodyFont: "theme", monoFont: "theme" };
  p.contentPlan = { audience: brief.audience || "", purpose: brief.purpose || "", scenario: brief.scenario || "management-report", nodes: brief.contentNodes || {}, slides: contents.map((c, i) => ({ ...c, slideId: slides[i].slideId, requiredContentRefs: c.requiredContentRefs || [] })) };
  p.requirements.requiredMedia = brief.requiredMedia || [];
  p.requirements.fixedPageCount = brief.fixedPageCount || brief.pageCount || null;
  return p;
}
async function createPlannedProjectFromBrief(brief,{sourceDir=caller}={}) {
  if (!Array.isArray(brief.contentSlides) || !brief.contentSlides.length)
    throw new Error('新建需要 contentSlides 内容计划；原样模板请显式使用 render:goal。');
  if (!listAppearances().some(s=>s.id===brief.styleId))
    throw new Error('新建请选择 styles 中的可用外观；旧家族工程请使用 render:project。');
  const style=resolveSlideStyle({styleId:brief.styleId,appearance:brief.appearance}), contents=resolveBriefContents(brief,style);
  const measurer=await createLayoutMeasurer();
  const slides=[], reports=[];
  try {
    for(const content of contents) {
      if(content.pageType) throw new Error('该显式家族页型尚未迁入共享规划器；保留原工程并先确认迁移，不静默替换。');
      content.appearance=brief.appearance;
      content.typography=content.typography||brief.typography;
      for(const image of [...(content.data?.images || []),...(content.regions||[]).flatMap(r=>r.data?.images||[])]) {
        if(!image.src) throw new Error('图片缺失：'+image.mediaId+'；请补充素材或明确占位。');
        let source=image.src;
        if(!source.startsWith('data:')) {
          if(/^https?:/.test(source)) throw new Error('请先把图片归档到本地，再进行可离线验证的排版：'+image.mediaId);
          const file=source.startsWith('file:')?fileURLToPath(source):path.resolve(sourceDir,source);
          const mime=/\.png$/i.test(file)?'image/png':/\.webp$/i.test(file)?'image/webp':/\.gif$/i.test(file)?'image/gif':/\.svg$/i.test(file)?'image/svg+xml':'image/jpeg';
          source='data:'+mime+';base64,'+fs.readFileSync(file).toString('base64');
          image.src=file;
        }
        // Browser decoding applies EXIF orientation and ignores unverified supplied dimensions.
        Object.assign(image,await measurer.imageSize(source));
      }
      const result=await planContentSlide(content,style,{measurer});
      reports.push({slideId:content.slideId,ok:result.ok,candidates:result.candidates.map(({slide,...report})=>report),conflicts:result.conflicts});
      if(!result.ok) {
        const error=new Error(JSON.stringify({slideId:content.slideId,conflicts:result.conflicts}));
        error.planningReport=reports;throw error;
      }
      slides.push(result.slide);
    }
  } finally {await measurer.close();}
  const project=projectFromContents(brief,style,contents,slides);
  project.planningReport=reports;
  return project;
}
async function main(args = process.argv.slice(2)) {
  const [mode, input, output] = args;
  if(['make','publish:html','check'].includes(mode)){
   const flag=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
   let r;if(mode==='make'){if(!output)throw Error('make requires output.html');r=await makeHtml({inputFile:absolute(input),outFile:absolute(output),workspaceDir:flag('--workspace')&&absolute(flag('--workspace'))});}
   else if(mode==='publish:html'){if(!output)throw Error('publish:html requires output.html');r=await publishHtml({workspaceDir:absolute(input),outFile:absolute(output)});}
   else r=await checkProject({workspaceDir:absolute(input),slideIds:flag('--slides')?.split(','),screenshots:flag('--screenshots')&&absolute(flag('--screenshots'))});
   console.log(JSON.stringify(r));if(!r.ok)process.exitCode=1;return;
  }
  if(mode==='import:html'){const i=args.indexOf('--expected-revision'),r=importPortableHtml(absolute(input),absolute(output),{expectedRevision:i<0?undefined:args[i+1]});console.log(JSON.stringify(r));if(!r.ok)process.exitCode=1;return;}
  if(mode==='patch:project'){const result=patchProject(absolute(input),JSON.parse(fs.readFileSync(absolute(output),'utf8')));console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;return;}
  if(mode==='rules:read') {const docs=args.flatMap((v,i)=>v==='--format'?[args[i+1]]:[]);console.log(JSON.stringify(readAuthoringRules({scenarioId:input,designDoc:args.includes('--design')?args[args.indexOf('--design')+1]:undefined,formatDocs:docs,allowDrift:args.includes('--allow-drift'),includeReplaced:args.includes('--full')}),null,2));return;}
  if(mode==='rules:lock') {const flag=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;console.log(JSON.stringify(writeRulesLock({root:flag('--root')&&absolute(flag('--root')),label:flag('--label')}),null,2));return;}
  if(mode==='text:measure') {const m=await createLayoutMeasurer();try{const i=args.indexOf('--project'),p=i<0?null:loadProject(path.join(absolute(args[i+1]),'deck-project.json'));const specs=JSON.parse(fs.readFileSync(absolute(input),'utf8'));const results=[];for(const spec of specs)results.push(...await m.texts([spec],p?resolveSlideStyle(p.slides.find(s=>s.slideId===spec.slideId)||p.slides[0],p):undefined));console.log(JSON.stringify(results,null,2));}finally{await m.close();}return;}
  if (mode === "styles") { console.log(JSON.stringify(listAppearances(),null,2)); return; }
  if (mode === "templates") {
    console.log(JSON.stringify(Object.entries(THEME_PACK_OPTIONS).map(([key,s])=>({id:key,name:s.label||s.name,mode:"template"})),null,2)); return;
  }
  if (mode === "styles:grid") {
    if (!input || !output) throw new Error('Usage: styles:grid <scenario> <output.html>');
    const options=buildStyleOptions({primary:input});
    const file=absolute(output);fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,renderAppearanceGrid(options));
    fs.writeFileSync(file.replace(/\.html$/i,'')+'.json',JSON.stringify(options,null,2));
    console.log(JSON.stringify({file,options}));return;
  }
  if (!input) throw new Error("Usage: dawang <render:authored|render:goal|render:brief|render:project|preview:start|export:pptx|export:pdf|qa:project> <file-or-project-directory> [output.html|output.pptx|port]");
  if (["render:authored", "render:goal", "render:brief", "render:project"].includes(mode)) {
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
    if (mode === "render:authored") project = createAuthoredProject(source);
    else if (mode === "render:brief") project = await createPlannedProjectFromBrief(source, {sourceDir:path.dirname(file)});
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
    if (mode === "render:authored") project.sources.entries.push({ sourceId: "authored-input:" + hashFile(file), kind: "authored-input", source: file, sha256: hashFile(file) });
    else project.sources.entries[0] = { sourceId: "goal", kind: "input", source: file, sha256: hashFile(file) };
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
      console.log(JSON.stringify({ ok: qa.ok, pages: qa.pages.length, issues: qa.pages.flatMap((p2) => p2.issues), warnings: qa.pages.flatMap((p2) => (p2.warnings || []).map((w) => ({ slideId: p2.slideId, ...w }))), aestheticAcceptance: qa.aestheticAcceptance }));
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
  createPlannedProjectFromBrief,
  resolveBriefContents, projectFromContents, main
};
