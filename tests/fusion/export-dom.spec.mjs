import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs";
import { collectSlideInDom } from "../../skills/dawang-ppt/project/src/fusion/export/collect.mjs";
test("visible nowrap text is not truncated to the CSS parent width during export", async () => {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent('<style>body{margin:0}.fusion-root{width:1920px;height:1080px}.label{width:100px;white-space:nowrap;font:40px monospace}</style><div id="deck"><section class="slide" data-vm-slide-id="s"><div class="fusion-root"><div class="label">ABCDEFGHIJKLMNOPQRST</div></div></section></div>');
    const data = await page.evaluate(collectSlideInDom, "s"), text = data.objects.find((o) => o.type === "text");
    assert(text.bounds[2] >= 470, "all 20 rendered characters need a wide enough editable text box");
  } finally {
    await browser.close();
  }
});
test("original CSS arrows, opening quotes and circular timeline markers survive editable export", async () => {
  const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.setContent('<style>body{margin:0}.fusion-root{width:1920px;height:1080px}.step{position:relative;width:400px;height:200px}.step::after{content:"→";position:absolute;left:420px;top:80px;font:40px Arial}.quote::before{content:"“";display:block;font:100px Georgia}.dot::before{content:"";position:absolute;left:20px;top:20px;width:22px;height:22px;border:5px solid white;border-radius:50%;background:red}</style><div id="deck"><section class="slide" data-vm-slide-id="s"><div class="fusion-root"><div class="step dot">Step</div><div class="quote">Quote</div></div></section></div>');
    const data = await page.evaluate(collectSlideInDom, "s");
    assert(data.objects.some((o) => o.type === "text" && o.text === "→"));
    assert(data.objects.some((o) => o.type === "text" && o.text === "“"));
    assert(data.objects.some((o) => o.type === "shape" && o.shape === "ellipse" && o.style.strokeWidth === 5));
  } finally {
    await browser.close();
  }
});
test('editable export recollects a slide when hydration replaces marked font nodes', async()=>{
  const {collectExportObjects}=await import('../../skills/dawang-ppt/project/src/fusion/export/collect.mjs');
  const {importGoal}=await import('../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs');
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    await page.setContent('<style>body{margin:0}.fusion-root{width:1920px;height:1080px}.title{font:40px Arial}</style><div id="deck"><section class="slide active" data-vm-slide-id="s"><div class="fusion-root"><div class="title">Hydrated title</div></div></section></div>');
    await page.evaluate(()=>{
      window.__getVisibleSlides=()=>[document.querySelector('.slide')];window.go=()=>{};
      const observer=new MutationObserver(records=>{
        const target=records.find(r=>r.attributeName==='data-dawang-export-font')?.target;
        if(target){observer.disconnect();const clone=target.cloneNode(true);clone.removeAttribute('data-dawang-export-font');target.replaceWith(clone);window.__replaced=true;}
      });observer.observe(document.getElementById('deck'),{attributes:true,subtree:true});
    });
    const p=importGoal({slides:[{slideId:'s',layout:'test',mode:'template'}]});
    const collection=await collectExportObjects(page,p);
    assert.equal(await page.evaluate(()=>window.__replaced),true);
    const text=collection.slides[0].objects.find(o=>o.text==='Hydrated title');
    assert(text?.style.fontFamily);
    assert.equal(collection.slides[0].issues.length,0);
  } finally {await browser.close();}
});
test('SVG connection and table rules retain rgba stroke transparency in editable export',async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    await page.setContent('<style>body{margin:0}.fusion-root{width:1920px;height:1080px;background:#0a0a0a}</style><div id="deck"><section class="slide" data-vm-slide-id="s"><div class="fusion-root"><svg width="1000" height="100"><line x1="0" y1="50" x2="1000" y2="50" stroke="rgba(255,255,255,0.1)" stroke-width="2"/></svg></div></section></div>');
    const data=await page.evaluate(collectSlideInDom,'s');
    const rule=data.objects.find(o=>o.type==='line');assert.equal(rule.style.strokeTransparency,90);
  } finally {await browser.close();}
});
