import test from 'node:test';import assert from 'node:assert/strict';
import PptxGenJS from '../../skills/dawang-ppt/project/node_modules/pptxgenjs/dist/pptxgen.es.js';
import JSZip from '../../skills/dawang-ppt/project/node_modules/jszip/lib/index.js';
import {composeEditablePptx} from '../../skills/dawang-ppt/project/src/fusion/export/pptx-core.mjs';
import {writeEditablePackage} from '../../skills/dawang-ppt/project/src/fusion/export/write.mjs';
import {verifyPptxZip} from '../../skills/dawang-ppt/project/src/fusion/export/zip-integrity.mjs';
import {chromium} from '../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {collectSlideInDom} from '../../skills/dawang-ppt/project/src/fusion/export/collect.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
function collection(){return{revision:'saved-revision-17',fonts:[{requested:['Arial'],used:['Arial'],embedding:'not-embedded',targetEnvironment:'unverified'}],slides:[{slideId:'s',objects:[
 {id:'rich',type:'text',text:'先看结构，再剪辑',bounds:[100,100,1400,150],style:{fontSize:72,fontFamily:'Arial',color:'#ffffff'},runs:[{text:'先看结构，',style:{fontSize:72,fontFamily:'Arial',color:'#ffffff',fontWeight:400}},{text:'再剪辑',style:{fontSize:72,fontFamily:'Arial',color:'#B6D8D1',fontWeight:700}}]},
 {id:'crop',type:'image',bounds:[100,400,800,200],src:image,naturalWidth:1600,naturalHeight:1000,fit:'cover',focal:'25% 40%'}
]}]};}
test('native rich text keeps multiple editable runs in one text shape and font/report boundaries',async()=>{
 const c=collection(),{pptx,report}=composeEditablePptx(PptxGenJS,c);const zip=await JSZip.loadAsync(await writeEditablePackage(pptx,c));const xml=await zip.file('ppt/slides/slide1.xml').async('string');
 assert(xml.includes('<a:t>先看结构，</a:t>'));assert(xml.includes('<a:t>再剪辑</a:t>'));assert.match(xml,/<a:rPr[^>]*b="1"[^>]*>[\s\S]*?B6D8D1/i);
 assert.equal((xml.match(/<p:sp>/g)||[]).length,1);assert.equal(report.revision,'saved-revision-17');assert.equal(report.fonts[0].embedding,'not-embedded');assert.equal(report.fonts[0].targetEnvironment,'unverified');assert.deepEqual(report.unsupported,[]);assert.deepEqual(report.rasterized,[]);
});
test('cover crop matches focal math and generated packages have no missing override warnings',async()=>{
 const c=collection();c.slides.push({...structuredClone(c.slides[0]),slideId:'second'});const {pptx}=composeEditablePptx(PptxGenJS,c);const bytes=await writeEditablePackage(pptx,c),zip=await JSZip.loadAsync(bytes);const xml=await zip.file('ppt/slides/slide1.xml').async('string');
 assert.match(xml,/<a:srcRect l="0" r="0" t="24000" b="36000"\/>/);
 const integrity=await verifyPptxZip(bytes,{expectedSlides:2});assert.equal(integrity.ok,true);assert.deepEqual(integrity.missingOverrides,[]);
 zip.remove('ppt/slides/slide1.xml');assert.equal((await verifyPptxZip(await zip.generateAsync({type:'nodebuffer'}))).ok,false);
});
test('non-finite geometry and unsupported information produce a report-bearing export failure',()=>{
 for(const modify of [c=>c.slides[0].objects[0].bounds[0]=NaN,c=>c.slides[0].objects[0].type='unknown-information']){
  const c=collection();modify(c);assert.throws(()=>composeEditablePptx(PptxGenJS,c),e=>!!e.report&&e.report.revision===c.revision&&(e.report.unsupported.length+e.report.issues.length)>0);
 }
});
test('DOM rich spans become one editable rich text object, not separately positioned fragments',async t=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});t.after(()=>browser.close());const page=await browser.newPage();
 await page.setContent('<style>body{margin:0}.fusion-root{width:1920px;height:1080px}</style><div id="deck"><section class="slide" data-vm-slide-id="s"><div class="fusion-root"><div data-element-type="text" data-fusion-element="rich" style="font-size:40px;width:500px;height:180px"><span data-fusion-run="0">先看结构，</span><span data-fusion-run="1" style="color:#B6D8D1;font-weight:700">再剪辑</span></div></div></section></div>');
 const result=await page.evaluate(collectSlideInDom,'s');const text=result.objects.filter(o=>o.type==='text');assert.equal(text.length,1);assert.equal(text[0].runs.length,2);assert.equal(text[0].runs[1].style.color.toUpperCase(),'#B6D8D1');
});

test('saved revision drives QA, offline HTML and actual PPTX/PDF reports, and stale requests fail',async t=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{spawnSync}=await import('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kimi-export-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const result=spawnSync('skills/dawang-ppt/project/node_modules/.bin/tsx',['tests/fusion/helpers/kimi-export-run.jsx',dir],{encoding:'utf8',timeout:90000});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);assert.match(result.stdout,/"sameRevision":true/);assert.match(result.stdout,/"offline":true/);
});
