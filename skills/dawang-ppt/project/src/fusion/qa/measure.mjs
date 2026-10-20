import { checkCoverage } from './coverage.mjs';
import { chromium } from 'playwright-core';
import { prepareSlideForExport } from '../export/collect.mjs';
import { screenshotSlide } from './readiness.mjs';
async function measureProject(url,project,{chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',screenshotDir,viewport={width:1920,height:1080},readinessTimeout=10000}={}){
 const browser=await chromium.launch({executablePath:chrome,headless:true});
 try{
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.__fusionEditor&&window.__renderRuntimeSlide);await page.evaluate(()=>window.__fusionEditor.ready());
  const report={revision:project.revision,pages:[],browserErrors:errors,coverageIssues:checkCoverage(project),aestheticAcceptance:'requires-human-review',readiness:{ready:false},finiteBounds:false};
  const visible=project.editorState.slideOrder.filter(id=>!project.editorState.deletedSlides.includes(id)&&!project.editorState.skippedSlides.includes(id));
  for(const id of visible){
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
     if(type==='image'&&(!el.complete||!el.naturalWidth))issues.push({kind:'missing-image',id:el.dataset.fusionElement});
     if(!['text','image','shape','line','vector'].includes(type))issues.push({kind:'unsupported-element',id:el.dataset.fusionElement,type});
    }
    const texts=elements.filter(e=>e.type==='text');
    for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
     const a=texts[i],b=texts[j],dx=Math.min(a.bounds[0]+a.bounds[2],b.bounds[0]+b.bounds[2])-Math.max(a.bounds[0],b.bounds[0]),dy=Math.min(a.bounds[1]+a.bounds[3],b.bounds[1]+b.bounds[3])-Math.max(a.bounds[1],b.bounds[1]);
     if(dx>4&&dy>4)issues.push({kind:'text-overlap',ids:[a.id,b.id],intersection:[dx,dy]});
    }
    return{slideId:id,elements,issues,finiteBounds:elements.every(e=>e.bounds.every(Number.isFinite))};
   },id);
   report.pages.push({...result,readiness});
   if(screenshotDir)await screenshotSlide(page,id,screenshotDir+'/'+String(report.pages.length).padStart(2,'0')+'.png');
  }
  report.readiness={ready:report.pages.every(p=>p.readiness.ready),pages:report.pages.map(p=>({slideId:p.slideId,...p.readiness}))};
  report.finiteBounds=report.pages.every(p=>p.finiteBounds);
  report.ok=report.readiness.ready&&report.finiteBounds&&!report.coverageIssues.length&&!errors.length&&report.pages.every(p=>!p.issues.length);
  return report;
 }finally{await browser.close();}
}
export {measureProject};
