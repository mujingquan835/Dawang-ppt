import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {measureProject} from '../../skills/dawang-ppt/project/src/fusion/qa/measure.mjs';
import {resolveSlideStyle} from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';

const authoredSlide=extra=>({slideId:'s',styleId:'authored/custom',authoring:{engine:'dawang-authored-v1'},...extra});
test('deck palette is the default for authored slides and a slide palette wins per key',()=>{
 const project={designChoice:{styleId:'authored/custom',appearance:{palette:{bg:'#161618',ink:'#F2F0EB'}}}};
 assert.equal(resolveSlideStyle(authoredSlide({}),project).palette.bg,'#161618');
 const own=resolveSlideStyle(authoredSlide({appearance:{palette:{bg:'#FFFFFF'}}}),project).palette;
 assert.equal(own.bg,'#FFFFFF');assert.equal(own.ink,'#F2F0EB');
 assert.equal(resolveSlideStyle(authoredSlide({})).palette.bg,'#FFFFFF');
});

const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#fff"/></svg>');
const text=(id,bounds,style,content='示例文字 Sample')=>`<div data-fusion-element="${id}" data-element-type="text" style="position:absolute;left:${bounds[0]}px;top:${bounds[1]}px;width:${bounds[2]}px;height:${bounds[3]}px;font-family:Arial;${style}">${content}</div>`;
async function measure(t,engine){
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 await page.setContent(`<style>body{margin:0}.fusion-root{width:1920px;height:1080px;transform:scale(.5);transform-origin:0 0;position:relative;background:#ffffff}</style><div id="deck"><section class="slide" data-vm-slide-id="s"><div class="fusion-root" data-authoring-engine="${engine}">`
  +text('invisible',[40,40,800,80],'font-size:40px;color:#F2F0EB')
  +`<div data-fusion-element="panel" data-element-type="shape" style="position:absolute;left:40px;top:160px;width:900px;height:120px;background:#161618"></div>`
  +text('on-panel',[60,180,800,80],'font-size:40px;color:#F2F0EB')
  +text('grey-small',[40,320,800,60],'font-size:24px;color:#777777')
  +`<img data-fusion-element="photo" data-element-type="image" src="${image}" style="position:absolute;left:40px;top:420px;width:900px;height:120px">`
  +text('on-photo',[60,440,800,80],'font-size:40px;color:#FFFFFF')
  +text('light-run',[40,600,900,80],'font-size:40px;color:#111111','<span data-fusion-run="0">深色 </span><span data-fusion-run="1" style="color:#EEEEEE">浅色</span>')
  +`</div></section></div>`);
 await page.evaluate(()=>{window.__fusionEditor={ready:()=>{}};window.__renderRuntimeSlide=()=>{};window.__getVisibleSlides=()=>[document.querySelector('.slide')];window.go=()=>{};});
 const p={revision:'x',requirements:{},contentPlan:{nodes:{},slides:[]},media:{entries:[]},slides:[],editorState:{slideOrder:['s'],deletedSlides:[],skippedSlides:[]}};
 return measureProject(null,p,{page});
}

test('low contrast blocks authored decks using the fills actually beneath the text',async t=>{
 const report=await measure(t,'dawang-authored-v1'),page=report.pages[0];
 const issue=id=>page.issues.find(i=>i.kind==='low-contrast'&&i.id===id);
 assert.equal(issue('invisible').ratio,1.14);assert.equal(issue('invisible').background,'#ffffff');
 assert.equal(issue('on-panel'),undefined);
 assert(issue('light-run'),'a single light run must be judged');
 assert.equal(page.issues.some(i=>i.id==='on-photo'),false);
 const small=page.warnings.find(w=>w.id==='grey-small');assert.equal(small.kind,'low-contrast-small-text');assert(small.ratio>=4.4&&small.ratio<4.5);
 assert.equal(report.ok,false);
});

test('older non-authored pages only warn about low contrast',async t=>{
 const report=await measure(t,'legacy'),page=report.pages[0];
 assert.equal(page.issues.some(i=>i.kind==='low-contrast'),false);
 assert(page.warnings.some(w=>w.kind==='low-contrast'&&w.id==='invisible'));
});
