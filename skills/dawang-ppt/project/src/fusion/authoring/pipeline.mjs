import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright-core';
import {workspacePath,withRunDirectory,recordRun} from './workspace.mjs';
import {createAuthoredProject} from './create-project.mjs';import {stageMedia} from './media.mjs';
import {loadProject,saveProject} from '../project/store.mjs';import {renderProject} from '../scene/render-project.jsx';
import {createFusionServer} from '../../../scripts/fusion-preview.jsx';import {measureProject} from '../qa/measure.mjs';
import {validatePortableHtml} from '../portable/html.mjs';import {reviewKeyLines} from '../qa/key-lines.mjs';import {reviewVisualDecisions} from '../qa/visual-decisions.mjs';import {reviewRuleChecklist} from '../qa/rule-checklist.mjs';import {reviewGate} from '../qa/rules-review.mjs';import {checkDecisions,applyDecisions} from '../qa/user-decisions.mjs';
import {missingContracts,draftedContent} from './outline-baseline.mjs';import {validateContentBaseline} from './content-baseline.mjs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function run({workspaceDir,outFile,reviewDraftFile,slideIds,screenshots}){
 const start=performance.now(),phases={};const project=loadProject(path.join(workspaceDir,'deck-project.json'));
 // Patch diagnostics conservatively widen shared edits. Publish never uses a local result.
 const patchFile=path.join(workspaceDir,'last-patch.json'),patch=fs.existsSync(patchFile)?JSON.parse(fs.readFileSync(patchFile,'utf8')):null;
 if(outFile||patch?.revision===project.revision&&patch?.checkScope==='all')slideIds=undefined;
 let result;try{result=await withRunDirectory(async dir=>{
  const renderStart=performance.now();
  const staged=stageMedia(project,workspaceDir,dir);fs.writeFileSync(path.join(dir,'deck-project.json'),JSON.stringify(staged));renderProject(staged,path.join(dir,'index.html'));
  phases.renderMs=performance.now()-renderStart;const server=await createFusionServer({dir});let browser;const browserStart=performance.now();
  try{browser=await chromium.launch({executablePath:chrome,headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080}});const requests=[];page.on('request',r=>{if(r.url().includes('/api/export'))requests.push(r.url());});
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());
   phases.browserReadyMs=performance.now()-browserStart;
   const qaStart=performance.now();if(screenshots)fs.mkdirSync(screenshots,{recursive:true});const qa=await measureProject(null,staged,{page,slideIds,screenshotDir:screenshots});
   phases.qaMs=performance.now()-qaStart;
   if(!qa.pages.length){qa.ok=false;qa.coverageIssues.push({kind:'no-visible-pages'});}
   const content=reviewKeyLines(staged),visual=reviewVisualDecisions(staged),rules=reviewRuleChecklist(staged),gate=reviewGate(project,workspaceDir);
   // Checks the user explicitly decided (requirements.userDecisions) no longer block; they stay listed as decided.
   const pageIssues=qa.pages.flatMap(p=>p.issues.map(i=>({slideId:p.slideId,...i})));const pageDecided=applyDecisions(staged,pageIssues);
   const authored=applyDecisions(staged,[...content.issues,...visual.issues,...rules.issues]),malformed=checkDecisions(staged);
   const decided=[...pageDecided.decided,...authored.decided];
   const issues=[...qa.coverageIssues,...pageDecided.open,...qa.browserErrors.map(message=>({kind:'browser-error',message})),...authored.open,...malformed,...gate.issues];
   const warnings=[...qa.pages.flatMap(p=>(p.warnings||[]).map(w=>({slideId:p.slideId,...w}))),...content.warnings,...visual.warnings,...rules.warnings,...gate.warnings];
   // Same conditions as measure (readiness, finite bounds, coverage, browser errors, page issues), minus decided page issues.
   qa.ok=qa.readiness?.ready!==false&&qa.finiteBounds!==false&&!qa.coverageIssues.length&&!qa.browserErrors.length&&!pageDecided.open.length;
   if(authored.open.length||malformed.length||gate.issues.length)qa.ok=false;
   if(!qa.ok){
    let draftWritten=false;
    if(reviewDraftFile&&qa.readiness?.ready!==false&&qa.finiteBounds!==false){
     const html=await page.evaluate(()=>window.__fusionEditor.serializeHtml());
     const validation=validatePortableHtml(html);
     if(validation.ok){
      fs.mkdirSync(path.dirname(path.resolve(reviewDraftFile)),{recursive:true});
      const tmp=reviewDraftFile+'.'+process.pid+'.tmp';
      try{fs.writeFileSync(tmp,html);fs.renameSync(tmp,reviewDraftFile);draftWritten=true;}finally{fs.rmSync(tmp,{force:true});}
     }
    }
    const releaseStatus=draftWritten?'review-draft':(gate.releaseStatus==='validating'&&!pageDecided.open.length&&!authored.open.length?'validating':'needs-revision');
    return {ok:false,releaseStatus,reviewDraftFile:draftWritten?reviewDraftFile:undefined,issues,warnings,decided,contentReview:content.review,visualReview:visual.review,ruleReview:rules.review,independentReview:gate.review,qa};
   }
   if(outFile){const serializationStart=performance.now();const html=await page.evaluate(()=>window.__fusionEditor.serializeHtml());const validation=validatePortableHtml(html);if(!validation.ok)return {ok:false,releaseStatus:'needs-revision',issues:[validation],qa};
    phases.serializeMs=performance.now()-serializationStart;
    if(requests.length)throw Error('Unexpected automatic format export');
    fs.mkdirSync(path.dirname(path.resolve(outFile)),{recursive:true});const tmp=outFile+'.'+process.pid+'.tmp';try{fs.writeFileSync(tmp,html);fs.renameSync(tmp,outFile);}finally{fs.rmSync(tmp,{force:true});}
   }
   return {ok:true,releaseStatus:'ready',issues,warnings,decided,contentReview:content.review,visualReview:visual.review,ruleReview:rules.review,independentReview:gate.review,qa,exportRequests:requests};
  }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 });}catch(error){result={ok:false,releaseStatus:'needs-revision',issues:[{kind:'operation-failed',message:error.message}]};}
 const drafted=draftedContent(project);const report={...result,...(drafted.length?{drafted}:{}),projectId:project.requirements.projectId,revision:project.revision,workspaceDir,outFile,scope:slideIds?'slides':'all',deliveryProfile:'html-first',phases,durationMs:performance.now()-start,at:new Date().toISOString()};recordRun(workspaceDir,report);return report;
}
export async function publishHtml(options){return run(options);}
export async function checkProject(options){return run({...options,outFile:undefined});}
// make only creates new decks, so this is where the contracts become the default. Existing projects go through patch and publish and keep their own checks.
function newDeckIssues(project,inputFile){
 const missing=missingContracts(project);
 if(missing.length)return [{kind:'new-deck-contracts-required',missing,hint:'新稿从 outline:baseline 生成的 authored-scaffold.json 开始；只有用户明确决定才可记入 userDecisions 跳过'}];
 const file=path.join(path.dirname(inputFile),'content-baseline.json');
 if(!fs.existsSync(file))return [{kind:'content-baseline-file-missing',file,hint:'authored.json 要和 outline:baseline 生成的 content-baseline.json 放在同一目录'}];
 return validateContentBaseline(project,JSON.parse(fs.readFileSync(file,'utf8')));
}
export async function makeHtml({inputFile,outFile,workspaceDir,screenshots}){
 const source=JSON.parse(fs.readFileSync(inputFile,'utf8')),p=createAuthoredProject(source);workspaceDir=workspacePath(p.requirements.projectId,workspaceDir);
 const gate=applyDecisions(p,newDeckIssues(p,inputFile));
 if(gate.open.length)return {ok:false,releaseStatus:'needs-revision',issues:gate.open,warnings:[],decided:gate.decided,projectId:p.requirements.projectId,workspaceDir};
 const file=path.join(workspaceDir,'deck-project.json'),marker=path.join(workspaceDir,'last-make.json');
 if(fs.existsSync(file)){const mark=fs.existsSync(marker)?JSON.parse(fs.readFileSync(marker,'utf8')):null;let run={};try{run=JSON.parse(fs.readFileSync(path.join(workspaceDir,'run.json'),'utf8'));}catch{}if(mark?.revision!==loadProject(file).revision||run.ok===true)throw Error('工程已存在且已修改或已发布：'+workspaceDir+'；使用 patch:project / publish:html 保留修改，或换 projectId 另建。');for(const stale of [file,path.join(workspaceDir,'rules-review.json'),path.join(workspaceDir,'last-patch.json')])fs.rmSync(stale,{force:true});}
 const staged=stageMedia(p,path.dirname(inputFile),workspaceDir);const saved=saveProject(file,staged,null);if(!saved.ok)throw Error(JSON.stringify(saved));const report=await publishHtml({workspaceDir,outFile,screenshots});fs.writeFileSync(marker,JSON.stringify({revision:loadProject(file).revision}));if(!fs.existsSync(outFile))delete report.outFile;return gate.decided.length?{...report,decided:[...gate.decided,...(report.decided||[])]}:report;
}
