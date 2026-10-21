import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {main} from '../../../skills/dawang-ppt/project/scripts/fusion-cli.jsx';
import {createFusionServer} from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';
const dir=path.resolve('output/magic-move-review');fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
const picture='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#5c8dff"/><circle cx="300" cy="180" r="110" fill="#ffc76b"/></svg>').toString('base64');
const source={requirements:{title:'神奇移动演示'},sources:{entries:[],userEdits:[]},media:{entries:[]},contentPlan:{nodes:{},slides:[{slideId:'one'},{slideId:'two'}]},designChoice:{styleId:'legacy/theme09'},slides:[
 {slideId:'one',elements:[{id:'title',type:'text',text:'神奇移动（平滑）',bounds:[120,100,1400,100],style:{fontSize:64}},{id:'photo',type:'image',src:picture,bounds:[140,300,600,400]},{id:'gone',type:'text',text:'这一段淡出',bounds:[1000,650,600,100],style:{fontSize:44}},{id:'box',type:'shape',bounds:[1400,350,200,200],style:{fill:'#ffc76b',radius:30}}]},
 {slideId:'two',elements:[{id:'title',type:'text',text:'神奇移动（平滑）',bounds:[250,160,1400,100],style:{fontSize:64}},{id:'photo',type:'image',src:picture,bounds:[900,380,900,600]},{id:'new',type:'text',text:'新的内容淡入',bounds:[180,700,600,100],style:{fontSize:44}},{id:'box',type:'shape',bounds:[250,350,350,250],style:{fill:'#ffc76b',radius:30}}]}
]};
fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify(source));
await main(['render:authored',path.join(dir,'input.json'),path.join(dir,'index.html')]);
const server=await createFusionServer({dir});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript('window.__name = fn => fn');
 const url=`http://127.0.0.1:${server.address().port}/index.html`;
 const ready=async()=>{await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());await page.evaluate(()=>window.__exitPresentMode());await page.waitForFunction(()=>!window.__getDeckNavigationState?.().locked);};
 await page.goto(url);await ready();
 assert.equal(await page.locator('#preview-transition option').first().getAttribute('value'),'magicMove');
 assert.equal(await page.evaluate(()=>window.__getPageTransition()),'none','ordering must not change the default');
 await page.locator('#preview-transition').selectOption('magicMove');
 assert.equal(await page.evaluate(()=>window.__getPageTransition()),'magicMove');
 // Pause the real GSAP timeline at exact times; inspect geometry rather than implementation strings.
 const sample=await page.evaluate(()=>{
  const slides=[...document.querySelectorAll('#deck > .slide')];
  window.__playPageTransition('magicMove',slides[0],slides[1],1,()=>{});
  const stage=document.querySelector('.page-transition-stage'),tl=stage.__transitionTimeline;tl.pause(0);
  const read=()=>{const e=stage.querySelector('[data-transition-role="next"] [data-fusion-element="photo"]');const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  const sourceRect=stage.querySelector('[data-transition-role="current"] [data-fusion-element="photo"]').getBoundingClientRect();
  const start=read();tl.seek(.35);const middle=read();tl.seek(.699);const end=read();tl.seek(.35);
  return {source:{x:sourceRect.x,w:sourceRect.width},start,middle,end,matches:stage.dataset.morphMatches};
 });
 assert.equal(Number(sample.matches),3);assert(Math.abs(sample.start.x-sample.source.x)<1);assert(Math.abs(sample.start.w-sample.source.w)<1);assert(sample.middle.x>sample.start.x+30&&sample.middle.x<sample.end.x-30,JSON.stringify(sample));assert(sample.middle.w>sample.start.w+10&&sample.middle.w<sample.end.w-10);
 await page.screenshot({path:path.join(dir,'midpoint.png')});
 await page.evaluate(()=>document.querySelector('.page-transition-stage').__transitionTimeline.progress(1));
 assert.equal(await page.locator('.page-transition-stage').count(),0);
 // Reverse and interrupt in-flight playback. Every returned promise must settle and stages must clear.
 const cancelled=await page.evaluate(async()=>{
  const [a,b]=document.querySelectorAll('#deck > .slide');let commits=0;
  const first=window.__playPageTransition('magicMove',b,a,-1,()=>commits++);
  const second=window.__playPageTransition('magicMove',a,b,1,()=>commits++);
  document.querySelector('.page-transition-stage').__transitionTimeline.progress(1);
  await Promise.all([first,second]);return {commits,count:document.querySelectorAll('.page-transition-stage').length};
 });assert.deepEqual(cancelled,{commits:1,count:0});
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(async()=>{const [a,b]=document.querySelectorAll('#deck > .slide');let n=0;await window.__playPageTransition('magicMove',a,b,1,()=>n++);return n;}),1);
 await page.emulateMedia({reducedMotion:'no-preference'});
 // Legacy decks match unique content; repeated labels are deliberately left to the crossfade.
 const legacy=await page.evaluate(()=>{
   const a=document.createElement('section'),b=document.createElement('section');
   a.className=b.className='slide';
   a.innerHTML='<div data-editable-id="a" style="width:200px;height:50px">相同文字</div><div data-editable-id="b" style="width:200px;height:50px">重复</div><div data-editable-id="c" style="width:200px;height:50px">重复</div>';
   b.innerHTML='<div data-editable-id="x" style="width:200px;height:50px">相同文字</div><div data-editable-id="y" style="width:200px;height:50px">重复</div>';
   window.__playPageTransition('magicMove',a,b,1,()=>{});
   const stage=document.querySelector('.page-transition-stage');const n=stage.dataset.morphMatches;stage.__transitionTimeline.progress(1);return n;
 });assert.equal(legacy,'1');
 await page.evaluate(()=>window.go(1));
 await page.waitForFunction(()=>!document.querySelector('.page-transition-stage'));
 assert.equal(await page.locator('#deck > .slide.active').getAttribute('data-vm-slide-id'),'two');
 await page.evaluate(()=>window.go(0));
 await page.waitForFunction(()=>!document.querySelector('.page-transition-stage'));
 assert.equal(await page.locator('#deck > .slide.active').getAttribute('data-vm-slide-id'),'one');
 // Existing editor saves transition in the same legacy state used by all other effects.
 await page.waitForTimeout(1000);await page.reload();await ready();
 assert.equal(await page.locator('#preview-transition').inputValue(),'magicMove');
 assert.equal(await page.evaluate(()=>window.__getPageTransition()),'magicMove');
 const downloadPromise=page.waitForEvent('download');
 await page.evaluate(()=>window.__exportDeckHtml());
 const download=await downloadPromise;const exported=path.join(dir,'exported.html');await download.saveAs(exported);
 const fresh=await browser.newContext({viewport:{width:1600,height:1000}}),reopened=await fresh.newPage();
 await reopened.goto('file://'+exported);await reopened.waitForFunction(()=>window.__getPageTransition?.()==='magicMove');
 assert.equal(await reopened.locator('#preview-transition').inputValue(),'magicMove');
 await fresh.close();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify({sample,cancelled,saved:true,errors},null,2));
 console.log(JSON.stringify({magicMove:true,saved:true}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
