import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {authored} from '../../../skills/dawang-ppt/examples/authored-minimal.mjs';
import {createAuthoredProject} from '../../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import {renderProject} from '../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx';
import {createFusionServer} from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';
import {extractPortableProject} from '../../../skills/dawang-ppt/project/src/fusion/portable/html.mjs';
const dir=process.argv[2];
renderProject(createAuthoredProject(structuredClone(authored)),path.join(dir,'index.html'));
const server=await createFusionServer({dir});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}`;
 await page.goto(base+'/index.html');await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());
 assert.equal(await page.locator('#deck-topbar #fusion-save-html').count(),1);
 const html=await page.evaluate(()=>window.__fusionEditor.serializeHtml());
 const file=path.join(dir,'离线报告.html');fs.writeFileSync(file,html);
 const ctx=await browser.newContext({offline:true,acceptDownloads:true,viewport:{width:1440,height:900}});
 const offline=await ctx.newPage();offline.setDefaultTimeout(8000);offline.on('pageerror',e=>errors.push(e.message));
 const downloads=[];offline.on('download',d=>downloads.push(d));
 await offline.addInitScript({content:`
  Object.defineProperty(window,'indexedDB',{get(){throw Error('test storage unavailable');}});
  window.__writes=[];window.__pickerCalls=0;window.__pickerMode='success';
  window.showOpenFilePicker=async()=>{
   window.__pickerCalls++;
   if(window.__pickerMode==='cancel')throw new DOMException('cancelled','AbortError');
   return [{name:'离线报告.html',kind:'file',
    getFile:async()=>new File([window.__selectedHtml],window.__pickerMode==='wrong'?'其他文件.html':'离线报告.html',{type:'text/html'}),
    queryPermission:async()=>window.__pickerMode==='denied'?'denied':'granted',
    requestPermission:async()=>window.__pickerMode==='denied'?'denied':'granted',
    createWritable:async()=>({write:async html=>{
     if(window.__pickerMode==='fail')throw Error('disk full');
     window.__pendingHtml=html;
     if(window.__pickerMode==='pause')await new Promise(resolve=>window.__resumeWrite=resolve);
    },close:async()=>{window.__selectedHtml=window.__pendingHtml;window.__writes.push(window.__pendingHtml);},abort:async()=>{}})
   }];
  };
 `});
 await offline.goto(pathToFileURL(file).href);await offline.waitForFunction(()=>window.__fusionEditor);await offline.evaluate(()=>window.__fusionEditor.ready());await offline.evaluate(html=>window.__selectedHtml=html,html);
 const claim=offline.locator('#deck > .active [data-fusion-element="claim"]');
 await claim.fill('直接覆盖原文件');
 await offline.evaluate(()=>window.__pickerMode='wrong');await offline.locator('#fusion-save-html').click();
 await offline.waitForFunction(()=>document.querySelector('#fusion-save-state').textContent.includes('请选择'));
 assert.equal(await offline.evaluate(()=>window.__writes.length),0,'must not overwrite a different named file');
 await offline.evaluate(()=>window.__pickerMode='success');await offline.locator('#fusion-save-html').click();
 await offline.waitForFunction(()=>window.__writes.length===1);
 assert.equal(downloads.length,0,'Save must NEVER start an HTML download');
 assert.equal(await offline.evaluate(()=>window.__pickerCalls),2,'first save selects an existing source file');
 assert.equal(extractPortableProject(await offline.evaluate(()=>window.__writes[0])).slides[0].elements.find(e=>e.id==='claim').text,'直接覆盖原文件');
 assert.match(await offline.locator('#fusion-save-state').innerText(),/已保存/);
 await claim.fill('快捷键覆盖');await offline.keyboard.press('Meta+s');await offline.waitForFunction(()=>window.__writes.length===2);
 assert.equal(await offline.evaluate(()=>window.__pickerCalls),2,'subsequent Save reuses source');
 assert.equal(downloads.length,0);
 await offline.evaluate(()=>window.__pickerMode='cancel');await offline.locator('#fusion-save-as').click();await offline.waitForFunction(()=>document.querySelector('#fusion-save-state').textContent.includes('取消'));
 await offline.evaluate(()=>window.__pickerMode='fail');await claim.fill('失败后保留修改');await offline.locator('#fusion-save-html').click();await offline.waitForFunction(()=>document.querySelector('#fusion-save-state').textContent.includes('失败'));
 assert.equal(await offline.evaluate(()=>window.__writes.length),2);assert.equal(downloads.length,0,'failed write must not fall back to a download');
 await offline.evaluate(()=>window.__pickerMode='denied');await offline.locator('#fusion-save-html').click();await offline.waitForFunction(()=>document.querySelector('#fusion-save-state').textContent.includes('授权'));
 assert.equal(downloads.length,0);
 await offline.evaluate(()=>window.__pickerMode='pause');await offline.locator('#fusion-save-html').click();await offline.waitForFunction(()=>window.__resumeWrite);
 await claim.fill('保存期间的新修改');await offline.evaluate(()=>window.__resumeWrite());await offline.waitForFunction(()=>window.__writes.length===3);
 assert.match(await offline.locator('#fusion-save-state').innerText(),/未保存/);
 await offline.evaluate(()=>window.__pickerMode='success');await offline.keyboard.press('Control+s');await offline.waitForFunction(()=>window.__writes.length===4);
 // Replace and reopen THE SAME file; no new HTML file is created by Save.
 fs.writeFileSync(file,await offline.evaluate(()=>window.__writes[3]));
 await offline.reload();await offline.waitForFunction(()=>window.__fusionEditor);await offline.evaluate(()=>window.__fusionEditor.ready());
 assert.equal(await claim.innerText(),'保存期间的新修改');assert.equal(await offline.locator('#fusion-save-html').count(),1);
 await claim.fill('只导出副本未保存源文件');
 const [copy]=await Promise.all([offline.waitForEvent('download'),offline.evaluate(()=>window.__exportDeckHtml())]);assert(copy.suggestedFilename().endsWith('.html'),'download only via explicit export');
 assert.match(await offline.locator('#fusion-save-state').innerText(),/未保存/,'exporting a copy must not mark source saved');
 const unsupported=await ctx.newPage();await unsupported.addInitScript(()=>{window.showOpenFilePicker=undefined;});
 const unsupportedDownloads=[];unsupported.on('download',d=>unsupportedDownloads.push(d));
 await unsupported.goto(pathToFileURL(file).href);await unsupported.waitForFunction(()=>window.__fusionEditor);await unsupported.evaluate(()=>window.__fusionEditor.ready());await unsupported.locator('#fusion-save-html').click();
 assert.match(await unsupported.locator('#fusion-save-state').innerText(),/不支持/);assert.equal(unsupportedDownloads.length,0);
 // Real browser FileSystemFileHandle + IndexedDB structured clone, without any OS dialog.
 fs.writeFileSync(path.join(dir,'persistent.html'),html);
 const persistent=await browser.newPage({viewport:{width:1440,height:900}});
 persistent.on('pageerror',e=>errors.push(e.message));
 await persistent.goto(base+'/persistent.html');await persistent.waitForFunction(()=>window.__fusionEditor);await persistent.evaluate(()=>window.__fusionEditor.ready());
 await persistent.evaluate(async html=>{
  const root=await navigator.storage.getDirectory();const handle=await root.getFileHandle('persistent.html',{create:true});const writer=await handle.createWritable();await writer.write(html);await writer.close();
  window.showOpenFilePicker=async()=>[handle];window.__persistentHandle=handle;
 },html);
 await persistent.locator('#deck > .active [data-fusion-element="claim"]').fill('关联持久保存');await persistent.locator('#fusion-save-html').click();
 await persistent.waitForFunction(()=>document.querySelector('#fusion-save-state').textContent.includes('已保存'));
 await persistent.reload();await persistent.waitForFunction(()=>window.__fusionEditor);await persistent.evaluate(()=>window.__fusionEditor.ready());
 await persistent.waitForFunction(()=>document.querySelector('#fusion-save-state').textContent.includes('已关联'));
 await persistent.evaluate(()=>{window.showOpenFilePicker=()=>{throw Error('must restore file association without opening picker');};});
 await persistent.locator('#deck > .active [data-fusion-element="claim"]').fill('重开后仍覆盖同一文件');await persistent.locator('#fusion-save-html').click();
 await persistent.waitForFunction(()=>document.querySelector('#fusion-save-state').textContent.includes('已保存'));
 const persistedHtml=await persistent.evaluate(async()=>{const root=await navigator.storage.getDirectory();return (await (await root.getFileHandle('persistent.html')).getFile()).text();});
 assert.equal(extractPortableProject(persistedHtml).slides[0].elements.find(e=>e.id==='claim').text,'重开后仍覆盖同一文件');
 await persistent.screenshot({path:path.join(dir,'save-controls.png')});
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({ok:true,checks:['source-overwrite','no-save-download','shortcuts','cancel','failure','permission-denied','concurrent-edits','same-file-reopen','unsupported-no-fallback','persisted-real-file-handle'],screenshot:path.join(dir,'save-controls.png')}));
} finally {server.closeAllConnections();server.close();await browser.close();}
