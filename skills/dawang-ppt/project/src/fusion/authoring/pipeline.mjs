import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright-core';
import {workspacePath,withRunDirectory,recordRun} from './workspace.mjs';
import {createAuthoredProject} from './create-project.mjs';import {stageMedia} from './media.mjs';
import {loadProject,saveProject} from '../project/store.mjs';import {renderProject} from '../scene/render-project.jsx';
import {createFusionServer} from '../../../scripts/fusion-preview.jsx';import {measureProject} from '../qa/measure.mjs';
import {validatePortableHtml} from '../portable/html.mjs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function run({workspaceDir,outFile,slideIds,screenshots}){
 const start=performance.now();const project=loadProject(path.join(workspaceDir,'deck-project.json'));
 // Patch diagnostics conservatively widen shared edits. Publish never uses a local result.
 const patchFile=path.join(workspaceDir,'last-patch.json'),patch=fs.existsSync(patchFile)?JSON.parse(fs.readFileSync(patchFile,'utf8')):null;
 if(outFile||patch?.revision===project.revision&&patch?.checkScope==='all')slideIds=undefined;
 const result=await withRunDirectory(async dir=>{
  const staged=stageMedia(project,workspaceDir,dir);fs.writeFileSync(path.join(dir,'deck-project.json'),JSON.stringify(staged));renderProject(staged,path.join(dir,'index.html'));
  const server=await createFusionServer({dir});let browser;
  try{browser=await chromium.launch({executablePath:chrome,headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080}});const requests=[];page.on('request',r=>{if(r.url().includes('/api/export'))requests.push(r.url());});
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());
   if(screenshots)fs.mkdirSync(screenshots,{recursive:true});const qa=await measureProject(null,staged,{page,slideIds,screenshotDir:screenshots});
   if(!qa.pages.length){qa.ok=false;qa.coverageIssues.push({kind:'no-visible-pages'});}
   const issues=[...qa.coverageIssues,...qa.pages.flatMap(p=>p.issues),...qa.browserErrors.map(message=>({kind:'browser-error',message}))];
   if(!qa.ok)return {ok:false,issues,qa};
   if(outFile){const html=await page.evaluate(()=>window.__fusionEditor.serializeHtml());const validation=validatePortableHtml(html);if(!validation.ok)return {ok:false,issues:[validation],qa};
    if(requests.length)throw Error('Unexpected automatic format export');
    fs.mkdirSync(path.dirname(path.resolve(outFile)),{recursive:true});const tmp=outFile+'.'+process.pid+'.tmp';try{fs.writeFileSync(tmp,html);fs.renameSync(tmp,outFile);}finally{fs.rmSync(tmp,{force:true});}
   }
   return {ok:true,issues,qa,exportRequests:requests};
  }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 });
 const report={...result,projectId:project.requirements.projectId,revision:project.revision,workspaceDir,outFile,scope:slideIds?'slides':'all',deliveryProfile:'html-first',durationMs:performance.now()-start,at:new Date().toISOString()};recordRun(workspaceDir,report);return report;
}
export async function publishHtml(options){return run(options);}
export async function checkProject(options){return run({...options,outFile:undefined});}
export async function makeHtml({inputFile,outFile,workspaceDir}){
 const source=JSON.parse(fs.readFileSync(inputFile,'utf8')),p=createAuthoredProject(source);workspaceDir=workspacePath(p.requirements.projectId,workspaceDir);
 const file=path.join(workspaceDir,'deck-project.json');if(fs.existsSync(file))throw Error('工程已存在：'+workspaceDir+'；使用 patch:project / publish:html 保留修改。');
 const staged=stageMedia(p,path.dirname(inputFile),workspaceDir);const saved=saveProject(file,staged,null);if(!saved.ok)throw Error(JSON.stringify(saved));return publishHtml({workspaceDir,outFile});
}
