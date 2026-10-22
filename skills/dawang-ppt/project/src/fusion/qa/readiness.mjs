// Shared browser snapshot: no imports/closures so it can be passed to page.evaluate.
export function inspectReadinessInDom(slideId) {
 const slide=[...document.querySelectorAll('#deck > .slide')].find(s=>s.dataset.vmSlideId===slideId);
 const root=slide?.querySelector('.fusion-root,.imported-theme-root')||slide;
 const rect=root?.getBoundingClientRect(),scale=(rect?.width||0)/1920,issues=[],warnings=[],strictFonts=root?.dataset.authoringEngine==='kimi-authored-v1';
 const finiteBounds=!!rect&&[rect.x,rect.y,rect.width,rect.height,scale].every(Number.isFinite)&&scale>0&&rect.height>0;
 if(!finiteBounds)issues.push({kind:'layout-not-ready',slideId});
 const images=[...(root?.querySelectorAll('img')||[])].map(img=>({src:img.currentSrc||img.src,complete:img.complete,decoded:img.complete&&img.naturalWidth>0}));
 for(const image of images)if(!image.decoded)issues.push({kind:image.complete?'missing-image':'image-not-ready',src:image.src});
 const generic=new Set(['serif','sans-serif','monospace','cursive','fantasy','system-ui','ui-serif','ui-sans-serif','ui-monospace','ui-rounded','emoji','math','fangsong','-apple-system','inherit']);
 const ctx=document.createElement('canvas').getContext('2d');
 const available=font=>generic.has(font.toLowerCase())||['monospace','serif'].some(fallback=>{ctx.font='24px '+fallback;const base=ctx.measureText('Aa0123汉字').width;ctx.font='24px '+JSON.stringify(font)+','+fallback;return Math.abs(ctx.measureText('Aa0123汉字').width-base)>.01;});
 const requested=[...new Set([...(root?.querySelectorAll('[data-element-type="text"],[data-fusion-run],[data-editable-id]')||[])].filter(e=>e.textContent.trim()).map(e=>getComputedStyle(e).fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g,'')))];
 const fonts=requested.map(family=>({requested:family,available:available(family)}));
 for(const font of fonts)if(!font.available&&document.fonts.status==='loaded')(strictFonts?issues:warnings).push({kind:'font-unavailable',family:font.requested});
 const fontReady=document.fonts.status==='loaded';
 if(!fontReady)issues.push({kind:'fonts-loading'});
 const navigationReady=!window.__getDeckNavigationState?.().locked;
 if(!navigationReady)issues.push({kind:'navigation-not-ready'});
 const geometry=finiteBounds?[rect.x,rect.y,rect.width,rect.height,...[...root.querySelectorAll('[data-fusion-element]')].flatMap(e=>{const b=e.getBoundingClientRect();return[b.x,b.y,b.width,b.height];})].map(v=>Math.round(v*100)/100):[];
 return{slideId,ready:finiteBounds&&fontReady&&navigationReady&&images.every(i=>i.decoded)&&fonts.every(f=>f.available||!strictFonts),finiteBounds,scale,images,fonts,issues,warnings,strictFonts,geometry};
}
export async function waitForSlideReady(page,slideId,{timeout=10000}={}){
 const deadline=Date.now()+timeout;let last=null,stable=0,snapshot;
 do{
  snapshot=await page.evaluate(inspectReadinessInDom,slideId);
  const geometry=JSON.stringify(snapshot.geometry);stable=snapshot.finiteBounds&&geometry===last?stable+1:0;last=geometry;
  if(snapshot.ready&&stable>=2)return {...snapshot,stable:true};
  if(stable>=2&&snapshot.issues.some(i=>['missing-image','font-unavailable'].includes(i.kind)))break;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 }while(Date.now()<deadline);
 const result={...snapshot,ready:false,stable:stable>=2};
 if(!result.issues.length)result.issues.push({kind:'readiness-timeout'});
 const error=new Error('Slide readiness failed: '+JSON.stringify(result.issues));error.readiness=result;throw error;
}
export async function screenshotSlide(page,slideId,file){
 await waitForSlideReady(page,slideId);
 let locator=page.locator(`#deck > [data-vm-slide-id="${slideId}"] .fusion-root,#deck > [data-vm-slide-id="${slideId}"] .imported-theme-root`).first();
 if(!await locator.count())locator=page.locator(`#deck > [data-vm-slide-id="${slideId}"]`);
 const token=await locator.evaluate(el=>{const old=el.getAttribute('style');el.style.setProperty('transform','none','important');el.style.setProperty('position','fixed','important');el.style.setProperty('left','0','important');el.style.setProperty('top','0','important');el.style.setProperty('width','1920px','important');el.style.setProperty('height','1080px','important');return old;});
 const viewport=page.viewportSize();
 try{
  await page.setViewportSize({width:1920,height:1080});
  return await locator.screenshot(file?{path:file}:{});
 }finally{
  if(viewport)await page.setViewportSize(viewport);
  await locator.evaluate((el,old)=>{if(old===null)el.removeAttribute('style');else el.setAttribute('style',old);},token);
 }
}
