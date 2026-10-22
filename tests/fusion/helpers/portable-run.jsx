import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {authored} from '../../../skills/dawang-ppt/examples/authored-minimal.mjs';
import {createAuthoredProject} from '../../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import {saveProject} from '../../../skills/dawang-ppt/project/src/fusion/project/store.mjs';
import {renderProject} from '../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx';
import {createFusionServer} from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';
import {extractPortableProject,validatePortableHtml,extractPortableMeta} from '../../../skills/dawang-ppt/project/src/fusion/portable/html.mjs';
const dir=process.argv[2];const project=saveProject(path.join(dir,'deck-project.json'),createAuthoredProject(authored),null).project;renderProject(project,path.join(dir,'index.html'));
const server=await createFusionServer({dir});const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());
const html=await page.evaluate(()=>window.__fusionEditor.serializeHtml());const check=validatePortableHtml(html);assert(check.ok,JSON.stringify(check));const moved=path.join(dir,'relocated');fs.mkdirSync(moved);const file=path.join(moved,'重命名.html');fs.writeFileSync(file,html);
server.closeAllConnections();await new Promise(r=>server.close(r));const ctx=await browser.newContext({offline:true,acceptDownloads:true});const offline=await ctx.newPage();const requests=[];offline.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await offline.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw Error('disabled');}}));await offline.goto(pathToFileURL(file).href);await offline.waitForFunction(()=>window.__fusionEditor);await offline.evaluate(()=>window.__fusionEditor.ready());
assert.equal(await offline.locator('#deck [data-fusion-element="claim"]').innerText(),'让内容决定构图');await offline.evaluate(()=>window.__fusionEditor.apply({type:'text',slideId:'one',elementId:'claim',text:'离线修改 </script> 中文'}));
const download=offline.waitForEvent('download');await offline.evaluate(()=>window.__fusionEditor.save());const saved=await download;const savedFile=path.join(moved,'修改后.html');await saved.saveAs(savedFile);const updated=fs.readFileSync(savedFile,'utf8');const p=extractPortableProject(updated);assert.equal(p.slides[0].elements.find(e=>e.id==='claim').text,'离线修改 </script> 中文');assert.equal(extractPortableMeta(updated).baseRevision,project.revision);assert.equal(requests.length,0,requests.join('\n'));await offline.goto(pathToFileURL(savedFile).href);await offline.waitForFunction(()=>window.__fusionEditor);assert.equal(await offline.locator('#deck [data-fusion-element="claim"]').innerText(),'离线修改 </script> 中文');
if(process.argv.includes('--exports')){
 const downloads=[];offline.on('download',d=>downloads.push(d));
 const [pptx]=await Promise.all([offline.waitForEvent('download'),offline.evaluate(()=>window.__exportDeckPptx())]);assert(pptx.suggestedFilename().endsWith('.pptx'));const pptxFile=path.join(dir,'test.pptx');await pptx.saveAs(pptxFile);
 const JSZip=(await import('../../../skills/dawang-ppt/project/node_modules/jszip/lib/index.js')).default;const zip=await JSZip.loadAsync(fs.readFileSync(pptxFile));const xml=await zip.file('ppt/slides/slide1.xml').async('string');assert(xml.includes('离线修改'));assert(xml.includes('<a:t>'));
 const [pdf]=await Promise.all([offline.waitForEvent('download'),offline.evaluate(()=>window.__exportDeckPdf())]);assert(pdf.suggestedFilename().endsWith('.pdf'));const pdfFile=path.join(dir,'test.pdf');await pdf.saveAs(pdfFile);const {PDFDocument}=await import('../../../skills/dawang-ppt/project/node_modules/pdf-lib/es/index.js');assert.equal((await PDFDocument.load(fs.readFileSync(pdfFile))).getPageCount(),1);
 const [png]=await Promise.all([offline.waitForEvent('download'),offline.evaluate(()=>window.__exportDeckImage())]);assert(png.suggestedFilename().endsWith('.png'));assert.equal(downloads.length,3);assert.equal(requests.length,0,requests.join('\n'));
}
console.log(JSON.stringify({ok:true,bytes:html.length}));
}finally{server.closeAllConnections();server.close();await browser.close();}
