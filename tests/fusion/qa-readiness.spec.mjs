import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {collectSlideInDom,prepareSlideForExport} from '../../skills/dawang-ppt/project/src/fusion/export/collect.mjs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function fixture(t,html,viewport={width:640,height:480}){
 const browser=await chromium.launch({executablePath:chrome,headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport});
 await page.setContent(`<style>body{margin:0}.fusion-root{width:600px;height:337.5px;position:relative}</style><div id="deck"><section class="slide" data-vm-slide-id="s"><div class="fusion-root">${html}</div></section></div>`);
 await page.evaluate(()=>{window.__getVisibleSlides=()=>[document.querySelector('.slide')];window.go=()=>{};});return page;
}
test('zero-scale collection fails explicitly without NaN objects',async t=>{
 const page=await fixture(t,'<div data-element-type="text" data-fusion-element="t">测试</div>');
 await page.locator('.fusion-root').evaluate(e=>e.style.transform='scale(0)');
 const result=await page.evaluate(collectSlideInDom,'s');
 assert.equal(result.finiteBounds,false);assert(result.issues.some(i=>i.kind==='layout-not-ready'));assert.deepEqual(result.objects,[]);
});
test('layout waits for actual positive stable geometry at widths below 900',async t=>{
 const page=await fixture(t,'<div data-element-type="text" data-fusion-element="t">等待布局</div>');
 await page.evaluate(()=>{const r=document.querySelector('.fusion-root');r.style.display='none';setTimeout(()=>r.style.display='block',100);});
 const readiness=await prepareSlideForExport(page,'s',{timeout:2000});
 assert.equal(readiness.ready,true);assert.equal(readiness.finiteBounds,true);assert(readiness.scale>0);
});
test('broken image and a missing explicitly requested font cannot be marked ready',async t=>{
 const page=await fixture(t,'<img src="data:image/png;base64,broken"><div style="font-family:DefinitelyMissingKimiFont,sans-serif" data-element-type="text" data-fusion-element="t">字体缺失</div>');
 await page.locator('.fusion-root').evaluate(e=>e.dataset.authoringEngine='kimi-authored-v1');
 await assert.rejects(()=>prepareSlideForExport(page,'s',{timeout:1500}),/missing-image|font-unavailable/);
 await page.locator('img').evaluate(e=>e.remove());
 await assert.rejects(()=>prepareSlideForExport(page,'s',{timeout:1500}),/font-unavailable/);
});
test('pending image has a bounded readiness failure instead of an infinite wait',async t=>{
 const page=await fixture(t,'<img id="image">');
 await page.route('https://pending.invalid/**',()=>{});
 await page.evaluate(()=>document.querySelector('#image').src='https://pending.invalid/never.png');
 await assert.rejects(()=>prepareSlideForExport(page,'s',{timeout:150}),/image-not-ready|readiness-timeout/);
});
test('unsupported information elements are reported instead of silently flattened',async t=>{
 const page=await fixture(t,'<div data-element-type="native-chart" data-fusion-element="chart" style="width:200px;height:100px">数据</div>');
 const r=await page.evaluate(collectSlideInDom,'s');assert(r.issues.some(i=>i.kind==='unsupported-element'));
});

test('legacy font fallback is visible in warnings without newly blocking old projects',async t=>{
 const page=await fixture(t,'<div data-element-type="text" data-fusion-element="t" style="font-family:DefinitelyMissingKimiFont,sans-serif">旧稿回退</div>');
 const result=await prepareSlideForExport(page,'s',{timeout:1500});
 assert.equal(result.ready,true);assert(result.warnings.some(i=>i.kind==='font-unavailable'));assert.equal(result.fonts[0].available,false);
});
