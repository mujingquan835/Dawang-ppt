import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
import {authored} from '../../../skills/dawang-ppt/examples/authored-minimal.mjs';
import {createAuthoredProject} from '../../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import {renderProject} from '../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx';
import {createFusionServer} from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';
const dir=process.argv[2];
renderProject(createAuthoredProject(structuredClone(authored)),path.join(dir,'index.html'));
const server=await createFusionServer({dir});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(8000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
 await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());
 await page.evaluate(()=>window.__exitPresentMode?.());
 const claim=page.locator('#deck > .active [data-fusion-element="claim"]');
 const selection=page.locator('#deck .fusion-selection');

 // History lives in the top bar, not in each element's inspector.
 assert.equal(await page.locator('#deck-topbar #fusion-undo').count(),1);
 assert.equal(await page.locator('#deck-topbar #fusion-redo').count(),1);
 await claim.click();
 assert.equal(await selection.count(),1);
 assert.equal(await page.locator('#fusion-inspector #fusion-undo, #fusion-inspector #fusion-redo, #fusion-inspector #fusion-save').count(),0);

 // Tab commits a field and focus moves to the next control of the rebuilt inspector.
 const size=page.getByLabel('字号（pt）',{exact:true});
 await size.fill('30');await size.press('Tab');
 await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='文字颜色');
 assert.equal(await page.evaluate(()=>window.__fusionEditor.getProject().slides[0].elements.find(e=>e.id==='claim').style.fontSize),60);

 // Undo and redo from the top bar and the redo shortcut.
 await page.locator('#fusion-undo').click();
 assert.notEqual(await page.evaluate(()=>window.__fusionEditor.getProject().slides[0].elements.find(e=>e.id==='claim').style.fontSize),60);
 await page.locator('#deck-topbar').click({position:{x:5,y:5}});
 await page.keyboard.press('ControlOrMeta+Shift+z');
 assert.equal(await page.evaluate(()=>window.__fusionEditor.getProject().slides[0].elements.find(e=>e.id==='claim').style.fontSize),60);

 // Esc and a click on empty slide space clear the selection.
 await claim.click();await page.locator('#deck-topbar').click({position:{x:5,y:5}});
 assert.equal(await selection.count(),1);
 await page.keyboard.press('Escape');
 assert.equal(await selection.count(),0);
 assert.equal(await page.locator('#fusion-inspector').count(),0);
 await claim.click();assert.equal(await selection.count(),1);
 const root=await page.locator('#deck > .active .fusion-root').boundingBox();
 await page.mouse.click(root.x+root.width-4,root.y+root.height-4);
 assert.equal(await selection.count(),0);

 // Conflicts read as sentences, never raw JSON.
 await page.evaluate(()=>window.__fusionEditor.apply({slideId:'one',elementId:'missing',type:'text',text:'整段替换'}));
 const message=await page.locator('#fusion-status').innerText();
 assert.match(message,/找不到所选对象/);assert.doesNotMatch(message,/[{}\[\]]/);

 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({ok:true}));
} finally {server.closeAllConnections();server.close();await browser.close();}
