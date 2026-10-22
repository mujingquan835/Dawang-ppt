import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {measureProject} from '../../skills/dawang-ppt/project/src/fusion/qa/measure.mjs';
import {screenshotSlide} from '../../skills/dawang-ppt/project/src/fusion/qa/readiness.mjs';
import {PNG} from 'pngjs';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>');
for(const viewport of [{width:640,height:480},{width:1280,height:720}])test('crop QA and native screenshot at '+viewport.width,async t=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport});
 await page.setContent(`<style>body{margin:0}.fusion-root{width:1920px;height:1080px;transform:scale(.3);transform-origin:0 0;position:relative}</style><div id="deck"><section class="slide" data-vm-slide-id="s"><div class="fusion-root"><div data-element-type="image" data-fusion-element="crop" style="width:100px;height:100px"><img src="${image}" width="100" height="100"></div></div></section></div>`);
 await page.evaluate(()=>{window.__fusionEditor={ready:()=>{}};window.__renderRuntimeSlide=()=>{};window.__getVisibleSlides=()=>[document.querySelector('.slide')];window.go=()=>{};});
 const p={revision:'x',requirements:{},contentPlan:{nodes:{},slides:[]},media:{entries:[]},slides:[],editorState:{slideOrder:['s'],deletedSlides:[],skippedSlides:[]}};
 const report=await measureProject(null,p,{page});assert.equal(report.ok,true,JSON.stringify(report));
 const before=await page.locator('.fusion-root').getAttribute('style');const png=PNG.sync.read(await screenshotSlide(page,'s'));assert.equal(png.width,1920);assert.equal(png.height,1080);assert.equal(await page.locator('.fusion-root').getAttribute('style'),before);assert(!page.isClosed());
 await page.locator('img').evaluate(el=>el.src='data:image/png;base64,broken');const bad=await measureProject(null,p,{page,readinessTimeout:300});assert(!bad.ok);assert(bad.pages[0].issues.some(i=>i.kind==='missing-image'));
});
