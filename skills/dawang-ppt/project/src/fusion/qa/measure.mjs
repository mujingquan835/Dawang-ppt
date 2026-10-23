import { checkCoverage } from './coverage.mjs';
import { chromium } from 'playwright-core';
import { prepareSlideForExport } from '../export/collect.mjs';
import { screenshotSlide } from './readiness.mjs';
async function measureProject(url,project,{chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',screenshotDir,viewport={width:1920,height:1080},readinessTimeout=10000,page:injectedPage,slideIds,capture}={}){
 const browser=injectedPage?null:await chromium.launch({executablePath:chrome,headless:true});
 try{
  const page=injectedPage||await browser.newPage({viewport}),errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
  if(url)await page.goto(url);await page.waitForFunction(()=>window.__fusionEditor&&window.__renderRuntimeSlide);await page.evaluate(()=>window.__fusionEditor.ready());
  const report={revision:project.revision,pages:[],browserErrors:errors,coverageIssues:checkCoverage(project),aestheticAcceptance:'requires-human-review',readiness:{ready:false},finiteBounds:false};
  const visible=project.editorState.slideOrder.filter(id=>!project.editorState.deletedSlides.includes(id)&&!project.editorState.skippedSlides.includes(id));
  for(const id of visible.filter(id=>!slideIds||slideIds.includes(id))){
   let readiness;
   try{readiness=await prepareSlideForExport(page,id,{timeout:readinessTimeout});}
   catch(error){report.pages.push({slideId:id,elements:[],issues:error.readiness?.issues||[{kind:'layout-not-ready',message:error.message}],readiness:error.readiness||{ready:false},finiteBounds:false});continue;}
   const result=await page.evaluate(id=>{
    const slide=[...document.querySelectorAll('#deck > .slide')].find(s=>s.dataset.vmSlideId===id),root=slide.querySelector('.fusion-root,.imported-theme-root')||slide;
    const box=root.getBoundingClientRect(),scale=box.width/1920,issues=[],elements=[];
    for(const el of root.querySelectorAll('[data-fusion-element]')){
     const r=el.getBoundingClientRect(),bounds=[(r.x-box.x)/scale,(r.y-box.y)/scale,r.width/scale,r.height/scale],type=el.dataset.elementType;
     elements.push({id:el.dataset.fusionElement,type,bounds,text:type==='text'?el.textContent:undefined});
     if(!bounds.every(Number.isFinite))issues.push({kind:'non-finite-bounds',id:el.dataset.fusionElement});
     if(bounds[0]<-2||bounds[1]<-2||bounds[0]+bounds[2]>1922||bounds[1]+bounds[3]>1082)issues.push({kind:'outside-canvas',id:el.dataset.fusionElement,bounds});
     if(type==='text'&&(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2))issues.push({kind:'text-overflow',id:el.dataset.fusionElement,bounds});
     if(!['text','image','shape','line','vector'].includes(type))issues.push({kind:'unsupported-element',id:el.dataset.fusionElement,type});
    }
    const texts=elements.filter(e=>e.type==='text');
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
     const a=texts[i],b=texts[j],dx=Math.min(a.bounds[0]+a.bounds[2],b.bounds[0]+b.bounds[2])-Math.max(a.bounds[0],b.bounds[0]),dy=Math.min(a.bounds[1]+a.bounds[3],b.bounds[1]+b.bounds[3])-Math.max(a.bounds[1],b.bounds[1]);
     if(dx>4&&dy>4)issues.push({kind:'text-overlap',ids:[a.id,b.id],intersection:[dx,dy]});
    }
    // Contrast: text colour against the solid fills painted beneath its text (earlier elements, then the slide background).
    // Text over images, gradients or vectors is not judged. Below 3:1 blocks new authored decks; below 4.5:1 warns for normal-size text.
    const warnings=[],strict=root.dataset.authoringEngine==='kimi-authored-v1';
    const parse=c=>{const m=/rgba?\(([^)]+)\)/.exec(c||'');if(!m)return null;const v=m[1].split(/[\s,/]+/).filter(Boolean).map(Number);return{r:v[0],g:v[1],b:v[2],a:v.length>3?v[3]:1};};
    const over=(top,base)=>({r:top.r*top.a+base.r*(1-top.a),g:top.g*top.a+base.g*(1-top.a),b:top.b*top.a+base.b*(1-top.a),a:1});
    const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4;};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);};
    const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    const all=[...root.querySelectorAll('[data-fusion-element]')];
    for(const el of all.filter(e=>e.dataset.elementType==='text'&&e.textContent.trim())){
     const range=document.createRange();range.selectNodeContents(el);const t=range.getBoundingClientRect();if(!t.width||!t.height)continue;
     const cx=t.x+t.width/2,cy=t.y+t.height/2,inside=n=>{const b=n.getBoundingClientRect();return cx>=b.left&&cx<=b.right&&cy>=b.top&&cy<=b.bottom;};
     let unknown=false;const fills=[];
     for(const n of [el,...all.slice(0,all.indexOf(el)).reverse().filter(inside)]){
      const cs=getComputedStyle(n),type=n.dataset.elementType;
      if(cs.backgroundImage!=='none'||(n!==el&&['image','vector'].includes(type))){unknown=true;break;}
      const fill=parse(cs.backgroundColor);if(fill&&fill.a>0){fills.push(fill);if(fill.a>=1)break;}
     }
     if(unknown)continue;
     let bg=parse(getComputedStyle(root).backgroundColor)||{r:255,g:255,b:255,a:1};bg=over(bg,{r:255,g:255,b:255,a:1});
     for(const fill of fills.reverse())bg=over(fill,bg);
     const runs=el.querySelectorAll('[data-fusion-run]');let worst=null;
     for(const node of runs.length?runs:[el]){
      if(!node.textContent.trim())continue;
      const cs=getComputedStyle(node),fg=parse(cs.color);if(!fg)continue;
      const size=parseFloat(cs.fontSize),large=size>=36||(Number(cs.fontWeight)>=600&&size>=28),value=ratio(fg.a<1?over(fg,bg):fg,bg);
      if(!worst||value<worst.ratio)worst={ratio:value,color:hex(fg),fontSize:size,large};
     }
     if(!worst)continue;
     const record={kind:'low-contrast',id:el.dataset.fusionElement,ratio:Math.round(worst.ratio*100)/100,color:worst.color,background:hex(bg),fontSize:worst.fontSize};
     if(worst.ratio<3)(strict?issues:warnings).push(record);else if(!worst.large&&worst.ratio<4.5)warnings.push({...record,kind:'low-contrast-small-text'});
    }
    return{slideId:id,elements,issues,warnings,finiteBounds:elements.every(e=>e.bounds.every(Number.isFinite))};
   },id);
   report.pages.push({...result,readiness});
   if(screenshotDir||capture){const buffer=await screenshotSlide(page,id,screenshotDir?screenshotDir+'/'+String(report.pages.length).padStart(2,'0')+'.png':undefined);if(typeof capture==='function')await capture({slideId:id,buffer});}
  }
  report.readiness={ready:report.pages.every(p=>p.readiness.ready),pages:report.pages.map(p=>({slideId:p.slideId,...p.readiness}))};
  report.finiteBounds=report.pages.every(p=>p.finiteBounds);
  report.ok=report.readiness.ready&&report.finiteBounds&&!report.coverageIssues.length&&!errors.length&&report.pages.every(p=>!p.issues.length);
  page.off('pageerror',onError);
  return report;
 }finally{await browser?.close();}
}
export {measureProject};
