// Actual screenshots and an offline edit/reopen check; no simulated product UI.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {chromium} from '../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
const root=path.resolve(import.meta.dirname,'..'),input=path.resolve(process.argv[2]||'output/github-visual-20261031/showcase.html'),pages=path.resolve(process.argv[3]||'output/github-visual-20261031/pages'),out=path.join(root,'docs/images');fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(input,'utf8');assert(!html.includes(os.homedir()+path.sep),'Do not publish local user paths');
for(let n=1;n<=4;n++)fs.copyFileSync(path.join(pages,String(n).padStart(2,'0')+'.png'),path.join(out,'showcase-'+n+'.png'));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const ctx=await browser.newContext({offline:true,viewport:{width:1600,height:1000},acceptDownloads:true});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(input).href);await page.waitForFunction(()=>window.__fusionEditor);await page.evaluate(()=>window.__fusionEditor.ready());await page.evaluate(()=>window.__exitPresentMode?.());
 await page.waitForFunction(()=>document.querySelectorAll('.rail-thumb[data-overview-rendered="true"]').length===4,null,{timeout:30000});
 const settle=()=>page.waitForFunction(()=>document.querySelectorAll('.rail-thumb[data-overview-rendered="true"]').length===4&&!document.querySelector('.rail-thumb [data-overview-placeholder]'),null,{timeout:30000});
 const cdp=await ctx.newCDPSession(page);
 const snap=async(name,clip)=>{const shot=await cdp.send('Page.captureScreenshot',{format:'png',...(clip?{clip:{...clip,scale:1}}:{})});fs.writeFileSync(path.join(out,name),Buffer.from(shot.data,'base64'));};
 const claim=page.locator('#deck > .active [data-fusion-element="claim"]');await claim.click();await settle();await snap('editor-overview.png');
 const intro=page.locator('#deck > .active [data-fusion-element="intro"]');const box=await intro.boundingBox();await page.mouse.dblclick(box.x+50,box.y+box.height/2);await intro.fill('跨团队交接试点 · 修订版');await page.keyboard.press('Escape');
 assert.equal(await intro.innerText(),'跨团队交接试点 · 修订版');await intro.click();await settle();await snap('editor-text.png');
 await page.locator('#fusion-undo').click();assert.equal(await intro.innerText(),'跨团队交接试点');await page.locator('#fusion-redo').click();assert.equal(await intro.innerText(),'跨团队交接试点 · 修订版');
 await settle();await snap('editor-save-bar.png',await page.locator('#deck-topbar').boundingBox());
 const edited=await page.evaluate(()=>window.__fusionEditor.serializeHtml());const tmp=path.join(path.dirname(input),'showcase-edited-check.html');fs.writeFileSync(tmp,edited);
 const reopened=await ctx.newPage();await reopened.goto(pathToFileURL(tmp).href);await reopened.waitForFunction(()=>window.__fusionEditor);await reopened.evaluate(()=>window.__fusionEditor.ready());assert.equal(await reopened.locator('#deck > .active [data-fusion-element="intro"]').innerText(),'跨团队交接试点 · 修订版');await reopened.close();fs.unlinkSync(tmp);
 await page.locator('#preview-export-main').click();await page.locator('.pp-export-menu').waitFor({state:'visible'});await settle();await snap('editor-export.png');
 assert.equal(errors.length,0,errors.join('\n'));await ctx.close();
 const montage=await browser.newPage({viewport:{width:1600,height:1160}});const imgs=[1,2,3,4].map(n=>'data:image/png;base64,'+fs.readFileSync(path.join(out,'showcase-'+n+'.png')).toString('base64'));
 await montage.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#f3f4f0;color:#123b2f;font-family:Arial,'PingFang SC',sans-serif;padding:50px 64px}.brand{font-size:55px;font-weight:750;margin:0}.sub{font-size:26px;color:#53665c;margin:14px 0 34px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:25px 30px}figure{margin:0}img{width:100%;display:block;box-shadow:0 8px 22px #123b2f12}figcaption{font-size:22px;margin:13px 0 4px}footer{font-size:20px;color:#53665c;margin-top:27px}</style><h1 class="brand">Dawang-PPT</h1><div class="sub">先讲清内容，再设计页面；交付后，仍能继续编辑。</div><div class="grid">${imgs.map((src,i)=>`<figure><img src="${src}"><figcaption>${['01 / 主题与当前状态','02 / 数量比较与口径','03 / 有条件分支的流程','04 / 拟定行动与时间线'][i]}</figcaption></figure>`).join('')}</div><footer>当前引擎实际成稿截图 · 公开合成材料 · 可下载离线 HTML，手动编辑和保存</footer>`);
 await montage.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await montage.screenshot({path:path.join(out,'showcase-overview.png'),fullPage:true});
 console.log(JSON.stringify({ok:true,pages:4,offlineEditReopen:true,undoRedo:true,actualEditorScreenshots:4,privatePaths:false,out}));
}finally{await browser.close();}
