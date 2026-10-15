import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { launchExportBrowser } from './preview/launch-export-browser.mjs';

const [url, dir] = process.argv.slice(2);
if (!url || !dir || !/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) throw new Error('Usage: node qa-moon-white.mjs http://127.0.0.1:<port>/ <qa-dir>');
const out = path.resolve(dir);
fs.mkdirSync(path.join(out, 'pages'), { recursive: true });
const browser = await launchExportBrowser(chromium);
const report = { url, pages: [], runtimeErrors: [], limits: 'Geometry and font/image loading only; inspect screenshots and exported PPTX separately.' };
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.runtimeErrors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.go === 'function');
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  const count = await page.locator('#deck > .slide:not([hidden])').count();
  if (!count) throw new Error('No slides found.');
  for (let i = 0; i < count; i++) {
    await page.evaluate(index => {
      window.go(index, { animate: false, force: true });
      const slides = window.__getVisibleSlides();
      window.__ensureRuntimeSlideRendered?.(slides[index]);
    }, i);
    const slide = page.locator('#deck > .slide:not([hidden])').nth(i);
    await slide.locator('.mw-root').waitFor();
    await slide.locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode().catch(() => {}))));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await slide.evaluate(slide => {
      const root = slide.querySelector('.mw-root');
      const rect = root.getBoundingClientRect();
      const scale = rect.width / 1920;
      const box = el => { const r = el.getBoundingClientRect(); return { x:(r.left-rect.left)/scale, y:(r.top-rect.top)/scale, w:r.width/scale, h:r.height/scale }; };
      const errors = [], warnings = [];
      const label = el => el.textContent.trim().slice(0,60);
      const inside = (a,b,t=2) => a.x >= b.x-t && a.y >= b.y-t && a.x+a.w <= b.x+b.w+t && a.y+a.h <= b.y+b.h+t;
      const intersects = (a,b) => Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>3 && Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>3;
      const canvas = {x:0,y:0,w:1920,h:1080};
      const texts = [...root.querySelectorAll('[data-mw-text]')].filter(el=>el.getBoundingClientRect().height>0);
      for (const el of texts) {
        if (!inside(box(el),canvas)) errors.push(`Text outside canvas: ${label(el)}`);
        if (el.scrollHeight > el.clientHeight+2 || el.scrollWidth > el.clientWidth+2) errors.push(`Text overflow: ${label(el)}`);
        const region=el.closest('[data-mw-region]');
        if (region && !inside(box(el),box(region))) errors.push(`Text outside ${region.dataset.mwRegion}: ${label(el)}`);
        const r=document.createRange(); r.selectNodeContents(el);
        const lines=[...r.getClientRects()].filter(r=>r.width>0 && r.height>0);
        const bands=[];
        for(const line of lines.sort((a,b)=>a.top-b.top)){
          const band=bands.find(b=>line.top<b.bottom-2 && line.bottom>b.top+2);
          if(band){band.left=Math.min(band.left,line.left);band.right=Math.max(band.right,line.right);band.bottom=Math.max(band.bottom,line.bottom);}
          else bands.push({top:line.top,bottom:line.bottom,left:line.left,right:line.right});
        }
        const last=bands.at(-1);
        if(bands.length>1 && (last.right-last.left)/scale<parseFloat(getComputedStyle(el).fontSize)*1.5) warnings.push(`Possible short last line: ${label(el)}`);
      }
      for(let a=0;a<texts.length;a++)for(let b=a+1;b<texts.length;b++)if(!texts[a].contains(texts[b])&&!texts[b].contains(texts[a])&&intersects(box(texts[a]),box(texts[b])))errors.push(`Overlapping text: ${label(texts[a])} / ${label(texts[b])}`);
      const regions=[...root.querySelectorAll('[data-mw-region]')].filter(el=>el.getBoundingClientRect().height>0);
      for(let a=0;a<regions.length;a++)for(let b=a+1;b<regions.length;b++){
        if(regions[a].contains(regions[b])||regions[b].contains(regions[a]))continue;
        if(root.dataset.mwKind==='cover-photo' && [regions[a].dataset.mwRegion,regions[b].dataset.mwRegion].includes('photo'))continue;
        if(intersects(box(regions[a]),box(regions[b])))errors.push(`Overlapping regions: ${regions[a].dataset.mwRegion} / ${regions[b].dataset.mwRegion}`);
      }
      for(const img of root.querySelectorAll('img'))if(!img.complete||!img.naturalWidth)errors.push('Image failed to load');
      if(root.querySelector('.mw-empty'))errors.push('Unfilled required image slot');
      if(![...document.fonts].some(f=>f.family.replaceAll('"','')==='OPPO Sans 4.0' && f.status==='loaded'))errors.push('OPPO Sans 4.0 is not loaded');
      return { layout:slide.querySelector('[data-page-key]').dataset.pageKey, kind:root.dataset.mwKind, textCount:texts.length, imageCount:root.querySelectorAll('img').length, tableRows:root.querySelectorAll('tbody tr').length, errors:[...new Set(errors)], warnings:[...new Set(warnings)] };
    });
    report.pages.push({ page:i+1, ...result });
    await slide.screenshot({ path:path.join(out,'pages',`${String(i+1).padStart(2,'0')}.png`), animations:'disabled' });
  }
  // Small contact sheet; use full-size pages to inspect typography.
  const columns=3, tw=640, th=360, gap=12;
  const sheet=new PNG({width:columns*(tw+gap)+gap,height:Math.ceil(count/columns)*(th+gap)+gap});sheet.data.fill(232);
  for(let i=0;i<count;i++){
    const src=PNG.sync.read(fs.readFileSync(path.join(out,'pages',`${String(i+1).padStart(2,'0')}.png`)));
    const ox=gap+(i%columns)*(tw+gap),oy=gap+Math.floor(i/columns)*(th+gap);
    for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
      const si=(Math.min(src.height-1,Math.floor(y*src.height/th))*src.width+Math.min(src.width-1,Math.floor(x*src.width/tw)))*4;
      src.data.copy(sheet.data,((oy+y)*sheet.width+ox+x)*4,si,si+4);
    }
  }
  fs.writeFileSync(path.join(out,'overview.png'),PNG.sync.write(sheet));
} finally { await browser.close(); }
report.passed = report.runtimeErrors.length===0 && report.pages.length>0 && report.pages.every(p=>p.errors.length===0);
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
