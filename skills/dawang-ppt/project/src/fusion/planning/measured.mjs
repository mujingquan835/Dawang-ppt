import {generateLayoutCandidates} from './candidates.mjs';
import {deriveSlideElements} from '../objects/index.mjs';
import {assignElementRoles} from '../project/roles.mjs';
import {lintSlide} from '../kimi/design-lint.mjs';

async function fitTable(object,style,measurer) {
  const columns=object.data.columns, rows=object.data.rows;
  const total=columns.reduce((sum,c)=>sum+(c.width||1),0);
  const specs=[columns.map(c=>c.label),...rows.map(r=>columns.map(c=>r.cells[c.columnId]))].flatMap((row,r)=>row.map((text,c)=>({id:r+'/'+c,type:'text',text,bounds:[0,0,object.bounds[2]*(columns[c].width||1)/total-28,0],style:{fontSize:object.data.fontSize,lineHeight:1.08,fontWeight:r===0?700:400}})));
  const measures=await measurer.texts(specs,style);
  const heights=Array.from({length:rows.length+1},(_,r)=>Math.max(...measures.slice(r*columns.length,(r+1)*columns.length).map(m=>m.height))+20);
  object.data.headerWeight=heights[0];
  rows.forEach((r,i)=>r.height=heights[i+1]);
}
async function fitTextBlocks(candidate,style,measurer) {
  const points=candidate.slide.elements.filter(e=>/^point\//.test(e.id));
  if(!points.length) return;
  const measurements=await measurer.texts(points,style), heights=new Map(measurements.map(m=>[m.id,m.height]));
  const groups=[...new Set(points.map(e=>e.id.split('/')[1]))];
  let y=candidate.contentBounds[1];
  for(const group of groups) {
    const elements=points.filter(e=>e.id.split('/')[1]===group);
    for(const e of elements) {e.bounds[1]=y;e.bounds[3]=heights.get(e.id)+2;y+=e.bounds[3]+14;}
    y+=26;
  }
}
async function measureCandidate(candidate,style,measurer) {
  const slide=candidate.slide;
  await fitTextBlocks(candidate,style,measurer);
  for(const o of slide.objects) if(o.kind==='table') await fitTable(o,style,measurer);
  const elements=deriveSlideElements(slide,style);
  assignElementRoles({elements});
  const measured=await measurer.texts(elements.filter(e=>e.type==='text'),style);
  const byId=new Map(measured.map(m=>[m.id,m]));
  const issues=[];
  for(const e of elements) {
    const [x,y,w,h]=e.bounds;
    if(![x,y,w,h].every(Number.isFinite)||w<0||h<0||x < -2 || y < -2 || x+w>1922||y+h>1082) issues.push({kind:'outside-canvas',id:e.id,bounds:e.bounds});
    if(e.type==='text') {
      const m=byId.get(e.id);
      if(m.height>h+2||m.width>w+2) issues.push({kind:'text-overflow',id:e.id,neededHeight:m.height,availableHeight:h});
    }
  }
  const texts=elements.filter(e=>e.type==='text' && e.text);
  for(let i=0;i<texts.length;i++) for(let j=i+1;j<texts.length;j++) {
    const a=texts[i],b=texts[j], dx=Math.min(a.bounds[0]+a.bounds[2],b.bounds[0]+b.bounds[2])-Math.max(a.bounds[0],b.bounds[0]),dy=Math.min(a.bounds[1]+byId.get(a.id).height,b.bounds[1]+byId.get(b.id).height)-Math.max(a.bounds[1],b.bounds[1]);
    if(dx>4&&dy>4) issues.push({kind:'text-overlap',ids:[a.id,b.id]});
  }
  issues.push(...lintSlide({...slide,elements}));
  const [x,y,w,h]=candidate.contentBounds;
  const body=elements.filter(e=>e.parentId || /^point\//.test(e.id));
  const used=body.length ? [Math.min(...body.map(e=>e.bounds[0])),Math.min(...body.map(e=>e.bounds[1])),Math.max(...body.map(e=>e.bounds[0]+e.bounds[2])),Math.max(...body.map(e=>e.bounds[1]+(e.type==='text'?Math.min(e.bounds[3],byId.get(e.id).height):e.bounds[3])))] : [x,y,x,y];
  // Envelope, not ink density: relationship connectors and intentional whitespace carry meaning.
  const fill=Math.max(0,Math.min(1,(used[2]-used[0])*(used[3]-used[1])/(w*h)));
  const onlyText=!slide.objects.length;
  const photo=slide.objects.some(o=>o.kind==='images');
  const fillPolicy=onlyText?'short-text-whitespace':photo?'photo-aspect-and-caption-whitespace':'evidence-min-70';
  if(fillPolicy==='evidence-min-70' && fill<.7) issues.push({kind:'content-underfilled',fill,minimum:.7});
  return {engine:'chromium-dom',issues,texts:measured,contentEnvelopeFill:fill,fillPolicy,...fillPolicy!=='evidence-min-70'?{whitespaceReason:onlyText?'按实测文字高度连续阅读；用户允许短文字留白，不扩充空框。':'保持图片比例，说明按实测高度连续排布；不拉伸或用空文本框撑满。'}:{}};
}
async function planContentSlide(content,style,{measurer}={}) {
  if(!measurer) throw new Error('A real browser measurer is required; estimated-only selection is forbidden');
  const provisional=generateLayoutCandidates(content,style);
  if(!provisional.length) return {ok:false,conflicts:[{kind:'planning-conflict',message:'当前材料与风格规则不能组合；保留内容等待选择。'}],candidates:[]};
  const title=provisional[0].slide.elements.find(e=>e.role==='title');
  const description=provisional[0].slide.elements.find(e=>['scope','explanation'].includes(e.id));
  const header=await measurer.texts([title,...description?[description]:[]],style);
  const candidates=generateLayoutCandidates(content,style,{titleHeight:header[0].height+4,descriptionHeight:header[1]?.height+4});
  for(const candidate of candidates) {
    candidate.measurement=await measureCandidate(candidate,style,measurer);
    candidate.score=100-candidate.measurement.issues.length*1000+candidate.measurement.contentEnvelopeFill*10;
  }
  const fitting=candidates.filter(c=>!c.measurement.issues.length).sort((a,b)=>b.score-a.score);
  if(!fitting.length) return {ok:false,conflicts:[{kind:'no-fitting-layout',message:'候选版式均未通过真实字体测量；不删文字、不压低正文下限。',choices:['调整该页版式','允许拆页','由用户精简内容']}],candidates};
  const selected=fitting[0];selected.selected=true;
  selected.slide.planning={engine:'content-first-v3',presetId:selected.presetId,reason:selected.reason,measurement:selected.measurement};
  return {ok:true,slide:selected.slide,candidates};
}
export {planContentSlide,measureCandidate};
