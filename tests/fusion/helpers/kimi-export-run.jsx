import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {PNG} from '../../../skills/dawang-ppt/project/node_modules/pngjs/lib/png.js';
import {main} from '../../../skills/dawang-ppt/project/scripts/fusion-cli.jsx';
import {createFusionServer} from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';
import {loadProject} from '../../../skills/dawang-ppt/project/src/fusion/project/store.mjs';
import {measureProject} from '../../../skills/dawang-ppt/project/src/fusion/qa/measure.mjs';
import {exportEditablePptxFromUrl} from '../../../skills/dawang-ppt/project/src/fusion/export/from-url.mjs';
const dir=process.argv[2],out=path.join(dir,'deck');
const image=new PNG({width:160,height:100});image.data.fill(180);for(let i=3;i<image.data.length;i+=4)image.data[i]=255;fs.writeFileSync(path.join(dir,'image.png'),PNG.sync.write(image));
const input={requirements:{title:'合成W3验收'},sources:{entries:[],userEdits:[]},media:{entries:[{mediaId:'image',src:'image.png'}]},contentPlan:{nodes:{},slides:[{slideId:'s'}]},designChoice:{styleId:'legacy/theme09'},slides:[{slideId:'s',elements:[
 {id:'text',type:'text',bounds:[100,100,1600,120],style:{fontSize:70,color:'#ffffff',fontFamily:'Arial'},runs:[{text:'先看结构，',style:{color:'#ffffff'}},{text:'再剪辑',style:{color:'#B6D8D1',fontWeight:700}}]},
 {id:'image',type:'image',mediaRef:'image',fit:'cover',focal:'25% 40%',bounds:[100,300,1600,400]},
 {id:'icon',type:'vector',bounds:[100,800,80,80],viewBox:[0,0,24,24],path:'M 3 12 L 9 18 L 21 6',style:{fill:'none',stroke:'#B6D8D1',strokeWidth:2}}
]}]};
fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify(input));await main(['render:authored',path.join(dir,'input.json'),path.join(out,'index.html')]);
const project=loadProject(path.join(out,'deck-project.json')),server=await createFusionServer({dir:out});
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const stale=await fetch(url+'/api/export-editable-pptx',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:'stale'})});assert.equal(stale.status,409);
 await assert.rejects(()=>exportEditablePptxFromUrl(browser,url+'/index.html',{expectedRevision:'stale',outFile:path.join(dir,'stale.pptx')}),/Revision mismatch/);assert(!fs.existsSync(path.join(dir,'stale.pptx')));
 const qa=await measureProject(url+'/index.html',project);assert.equal(qa.ok,true,JSON.stringify(qa.pages.map(p=>p.issues)));assert.equal(qa.readiness.ready,true);assert.equal(qa.finiteBounds,true);
 const pptx=await exportEditablePptxFromUrl(browser,url+'/index.html',{expectedRevision:project.revision,outFile:path.join(dir,'test.pptx')});assert.equal(pptx.revision,project.revision);assert(pptx.fonts.length>0);assert(pptx.fonts.every(f=>f.embedding==='not-embedded'&&f.targetEnvironment==='unverified'));assert.deepEqual(pptx.zipIntegrity.missingOverrides,[]);
 const firstResponse=await fetch(url+'/api/export-editable-pptx',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:project.revision})});assert.equal(firstResponse.status,200);await firstResponse.json();
 const response=await fetch(url+'/api/export-pdf',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:project.revision})});const pdf=await response.json();assert(pdf.ok,JSON.stringify(pdf));assert.equal(pdf.revision,project.revision);assert.equal(pdf.report.generationMode,'screenshot-pdf');assert.equal(pdf.report.textSelectable,false);assert.equal(pdf.report.rasterized[0].includesText,true);assert(fs.readFileSync(path.join(out,'exports/presentation.pdf')).subarray(0,4).equals(Buffer.from('%PDF')));
 const page=await browser.newPage();await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());await page.goto(url+'/index.html');await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());assert.equal(await page.locator('#deck [data-fusion-run]').count(),2);assert.equal(await page.locator('#deck img').first().evaluate(e=>e.complete&&e.naturalWidth>0),true);
 console.log(JSON.stringify({sameRevision:true,offline:true,qa:true,nativeRichText:true,fontEvidence:pptx.fonts.length,pdfMode:pdf.report.generationMode,staleRejected:true}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
