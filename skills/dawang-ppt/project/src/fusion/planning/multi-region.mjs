import {semanticTextStyle,fitSemanticTable} from '../styles/text-semantics.mjs';
import {deriveSlideElements} from '../objects/index.mjs';
import {assignElementRoles} from '../project/roles.mjs';
import {bindElementAppearance,geometryTokens} from '../styles/appearance.mjs';
import {measureCandidate} from './measured.mjs';

// Adapted from the retained MIT open-design bridge: cover-hero (001), metrics (007),
// process (010). These are structural preferences, never copies of fixed template slots.
const REGION_PRESETS=[
 {id:'theme14/page001-open-hierarchy',source:'theme14_page001',titleSize:58,gap:30,bodySize:30,reason:'封面的页眉与主次层级，改为按内容实测的开放正文区域'},
 {id:'theme14/page007-evidence-band',source:'theme14_page007',titleSize:54,gap:24,bodySize:28,reason:'指标页的数字与证据分层，取消等分槽位并保留内容区域'},
 {id:'theme14/page010-ordered-flow',source:'theme14_page010',titleSize:56,gap:26,bodySize:29,reason:'流程页的编号和有序连接，节点按文字需求分配宽度'}
];
const T=(id,text,bounds,size,color,role='body',extra={})=>({id,type:'text',role,text:String(text??''),bounds,style:{fontSize:size,lineHeight:1.16,color,...extra}});
function readingCopy(r){return [r.heading,...(r.paragraphs||[]).flatMap(p=>[p.heading,p.prefix?.text,p.text]),...(r.data?.nodes||[]).flatMap(n=>[n.label,n.detail]),...(r.data?.columns||[]).map(c=>c.label),...(r.data?.rows||[]).flatMap(r=>[...Object.values(r.cells),...Object.values(r.secondaryCells||{}).map(s=>s.text)]),...(r.data?.images||[]).map(i=>i.caption),...(r.data?.items||[]).flatMap(i=>[i.value,i.label])].filter(Boolean);}
async function visibleDemand(node,regions,measurer,style){
 if(!node.regionId){const values=[];for(const c of node.children)values.push(await visibleDemand(c,regions,measurer,style));return Math.sqrt(values.reduce((sum,v)=>sum+v*v,0));}
 const r=regions.get(node.regionId);if(!r)throw new Error('Missing region '+node.regionId);
 const specs=readingCopy(r).map((text,i)=>({id:String(i),type:'text',text,bounds:[0,0,10000,0],style:{fontSize:28,lineHeight:1.18}}));
 const ms=await measurer.texts(specs,style);let area=ms.reduce((sum,m)=>sum+m.naturalWidth*m.height,0);
 if(r.kind==='images')area+=(r.preferredHeight||420)**2*(r.data.images||[]).reduce((sum,i)=>sum+Number(i.width)/Number(i.height),0);
 return Math.max(160,Math.sqrt(area),r.kind==='images'?0:Math.max(0,...ms.map(m=>m.naturalWidth))*.7);
}
function scaled(values,total){const sum=values.reduce((a,b)=>a+b,0);return values.map(v=>v/sum*total);}
async function composeRegionCandidate(content,style,preset,measurer){
 const m=88,gap=preset.gap,bodySize=preset.bodySize,semantic=content.typographyPolicy==='semantic',regions=new Map();
 for(const r of content.regions){if(!r.regionId||regions.has(r.regionId))throw new Error('Stable unique regionId required');regions.set(r.regionId,r);}
 const elements=[T('navigation',`${content.sequence||'01'}  ${content.section||''}`,[m,42,1744,38],28,style.palette.accent,'kicker'),T('title',content.title,[m,104,1744,140],preset.titleSize,style.palette.ink,'title',{fontWeight:600}),T('source',content.source||'来源待补充',[m,1026,1744,34],22,style.palette.muted,'source')];
 if(content.titleRef)elements[1].contentRef=content.titleRef;
 const titleMeasure=await measurer.texts([elements[1]],style);elements[1].bounds[3]=titleMeasure[0].height+2;
 const start=104+elements[1].bounds[3]+32,contentBounds=[m,start,1744,998-start],objects=[],placed=[];
 const seen=new Set();
 async function measureLeaf(r,w){
  const prefix=content.slideId+'-'+r.regionId;let y=0,es=[],object=null;
  async function add(id,text,size=bodySize,color=style.palette.ink,role='body',ref,extra={}){
   const e=T(prefix+'/'+id,text,[0,y,w,0],size,color,role,extra);if(ref)e.contentRef=ref;
   const [v]=await measurer.texts([e],style);e.bounds[3]=v.height+2;es.push(e);y+=e.bounds[3]+12;return e;
  }
  if(r.heading)await add('heading',r.heading,32,semantic?style.palette.ink:style.palette.accent,'heading',r.headingRef,{fontWeight:600});
  if(r.kind==='text'){
   for(const [i,p] of (r.paragraphs||[]).entries()){
    if(p.heading)await add('paragraph/'+i+'/heading',p.heading,30,style.palette.accent,'heading',p.headingRef,{fontWeight:600});
    const ts=semantic?semanticTextStyle(p.semanticRole||'body',style,p.size||bodySize):{fontSize:Math.max(28,p.size||bodySize),color:style.palette.ink,fontWeight:p.bold?600:400};
    let offset=0,prefix;
    if(p.prefix){prefix=T(content.slideId+'-'+r.regionId+'/paragraph/'+i+'/prefix',p.prefix.text,[0,y,w,0],28,style.palette.accent,'body');
     Object.assign(prefix,{semanticRole:p.prefix.semanticRole||'emphasis',contentRef:p.prefix.contentRef});prefix.style=semanticTextStyle(prefix.semanticRole,style,28);
     const [pm]=await measurer.texts([prefix],style);offset=pm.naturalWidth+8;prefix.bounds[2]=offset-8;prefix.bounds[3]=pm.height+2;es.push(prefix);
    }
    const e=T(content.slideId+'-'+r.regionId+'/paragraph/'+i+'/body',p.text,[offset,y,w-offset,0],ts.fontSize,ts.color,p.role||'body',ts);e.semanticRole=p.semanticRole||'body';e.contentRef=p.contentRef;
    const [bm]=await measurer.texts([e],style);e.bounds[3]=bm.height+2;es.push(e);y+=Math.max(e.bounds[3],prefix?.bounds[3]||0)+12;
    y+=p.gap??8;
   }
  }else if(r.kind==='metrics'){
   const items=r.data.items;
   const widths=scaled(items.map(i=>Math.max(String(i.value).length*1.6,String(i.label).length)),w-(items.length-1)*22);
   const specs=items.flatMap((item,i)=>[T('v'+i,item.value,[0,0,widths[i],0],56,style.palette.accent,'value',{fontWeight:600}),T('l'+i,item.label,[0,0,widths[i],0],28,style.palette.ink,'label')]);
   const ms=await measurer.texts(specs,style);let x=0;const valueH=Math.max(...ms.filter((_,i)=>i%2===0).map(m=>m.height))+2;
   items.forEach((item,i)=>{
    const v=T(prefix+'/metric/'+i+'/value',item.value,[x,y,widths[i],valueH],56,style.palette.accent,'value',{fontWeight:600});v.contentRef=item.valueRef;
    const l=T(prefix+'/metric/'+i+'/label',item.label,[x,y+valueH+10,widths[i],ms[i*2+1].height+2],28,style.palette.ink,'label');l.contentRef=item.labelRef;
    es.push(v,l);x+=widths[i]+22;
   });y+=valueH+12+Math.max(...ms.filter((_,i)=>i%2).map(m=>m.height))+2;
  }else{
   object={objectId:prefix,kind:r.kind,layoutVersion:2,bounds:[0,y,w,0],data:structuredClone(r.data),geometryTokens:geometryTokens(style),overrides:{},relationshipPolicy:r.relationships===undefined?'sequence':'explicit',...r.relationships===undefined?{}:{relationships:structuredClone(r.relationships)}};
   object.data.fontSize=bodySize;if(semantic)object.data.typographyPolicy='semantic';
   if(r.kind==='table'){
    const cols=object.data.columns,rows=object.data.rows;
    const wants=cols.map(c=>c.width||Math.min(30,Math.max(String(c.label).length,...rows.map(r=>String(r.cells[c.columnId]??'').length)))**.66);
    cols.forEach((c,i)=>c.width=wants[i]);const widths=scaled(wants,w);
    const specs=[cols.map(c=>c.label),...rows.map(r=>cols.map(c=>r.cells[c.columnId]))].flatMap((row,i)=>row.map((text,j)=>T(i+'/'+j,text,[0,0,widths[j]-28,0],bodySize,style.palette.ink,'body',{lineHeight:1.08,fontWeight:i?400:700})));
    const ms=await measurer.texts(specs,style);
    const hs=Array.from({length:rows.length+1},(_,i)=>Math.max(...ms.slice(i*cols.length,(i+1)*cols.length).map(v=>v.height))+22);
    object.data.headerWeight=hs[0];rows.forEach((r,i)=>r.height=hs[i+1]);object.bounds[3]=semantic?await fitSemanticTable(object,style,measurer):hs.reduce((s,v)=>s+v,0);
   }else if((r.kind==='process'||r.kind==='comparison')&&object.data.presentation==='inline-sequence'){
    const ts=semanticTextStyle(object.data.semanticRole||'action',style,28);
    const specs=object.data.nodes.map((n,i)=>T(String(i),n.label,[0,0,w,0],28,ts.color,'body',ts));
    const ms=await measurer.texts(specs,style),total=ms.reduce((s,m)=>s+m.naturalWidth+4,0)+(specs.length-1)*42-(object.data.leadingLabelNode?30:0);
    const scale=Math.min(1,w/total);let xx=0;
    object.layoutVersion=3;object.data.measuredNodes=object.data.nodes.map((n,i)=>{const ww=(ms[i].naturalWidth+4)*scale,h=ms[i].height+2;const v={nodeId:n.nodeId,bounds:[xx,0,ww,h],labelHeight:h,detailHeight:0};xx+=ww+(object.data.leadingLabelNode&&i===0?12:42)*scale;return v;});
    object.bounds[2]=Math.min(w,total);object.bounds[3]=Math.max(...ms.map(m=>m.height))+2;
   }else if(r.kind==='process'||r.kind==='comparison'){
    const ns=object.data.nodes,ws=scaled(ns.map(n=>Math.max(5,String(n.label).length+String(n.detail||'').length*.7)),w-(ns.length-1)*32);
    const specs=ns.flatMap((n,i)=>[T('l'+i,n.label,[0,0,ws[i],0],32,style.palette.ink,'body',{fontWeight:600}),T('d'+i,n.detail||'',[0,0,ws[i],0],bodySize,style.palette.muted)]);
    const ms=await measurer.texts(specs,style);let x=0;
    object.layoutVersion=3;
    object.data.measuredNodes=ns.map((n,i)=>{const l=ms[i*2].height+2,d=n.detail?ms[i*2+1].height+2:0;const item={nodeId:n.nodeId,bounds:[x,0,ws[i],l+(d?d+12:0)+14],labelHeight:l,detailHeight:d};x+=ws[i]+32;return item;});
    object.bounds[3]=Math.max(...object.data.measuredNodes.map(n=>n.bounds[3]));
   }else if(r.kind==='images'){
    object.data.arrangement='justified';object.data.maxRows=object.data.maxRows||1;object.data.showCaptions=false;
    object.data.images.forEach(i=>i.fit='contain');object.bounds[3]=r.preferredHeight||420;
   }else throw new Error('Unsupported region kind '+r.kind);
   y+=object.bounds[3];
   if(r.kind==='images'){
    const captions=object.data.images.map(i=>i.caption).filter(Boolean);
    if(captions.length){
     const lines=[];let line='';
     for(const caption of captions){
      const next=line?line+' ／ '+caption:caption;
      const [m]=await measurer.texts([T('caption',next,[0,0,w,0],28,style.palette.muted,'caption')],style);
      if(line&&m.height>34){lines.push(line);line=caption;}else line=next;
     }if(line)lines.push(line);y+=12;await add('image-legend',lines.join('\n'),28,style.palette.muted,'caption');
    }
   }
  }
  return {region:r,w,h:Math.max(1,y),es,object};
 }
 async function measureTree(node,w){
  if(node.regionId){const r=regions.get(node.regionId);if(!r)throw new Error('Missing region '+node.regionId);return measureLeaf(r,w);}
  if(!['row','column'].includes(node.direction)||!node.children?.length)throw new Error('Invalid region layout tree');
  const localGap=node.gap??gap;
  const demands=[];if(node.direction==='row')for(const c of node.children)demands.push(await visibleDemand(c,regions,measurer,style));
  const widths=node.direction==='row'?scaled(demands,w-localGap*(node.children.length-1)):node.children.map(()=>w);
  const children=[];for(let i=0;i<node.children.length;i++)children.push(await measureTree(node.children[i],widths[i]));
  return {direction:node.direction,gap:localGap,w,h:node.direction==='row'?Math.max(...children.map(c=>c.h)):children.reduce((s,c)=>s+c.h,0)+localGap*(children.length-1),children};
 }
 function place(tree,x,y){
  if(tree.region){
   const r=tree.region;if(seen.has(r.regionId))throw new Error('Duplicate layout region '+r.regionId);seen.add(r.regionId);
   for(const e of tree.es){e.bounds[0]+=x;e.bounds[1]+=y;elements.push(e);}
   if(tree.object){tree.object.bounds[0]+=x;tree.object.bounds[1]+=y;objects.push(tree.object);}
   placed.push({regionId:r.regionId,kind:r.kind,bounds:[x,y,tree.w,tree.h],measurement:'chromium-dom'});return;
  }
  let xx=x,yy=y;for(const c of tree.children){place(c,xx,yy);if(tree.direction==='row')xx+=c.w+tree.gap;else yy+=c.h+tree.gap;}
 }
 const tree=await measureTree(content.layout||{direction:'column',children:content.regions.map(r=>({regionId:r.regionId}))},contentBounds[2]);
 place(tree,m,start);if(seen.size!==regions.size)throw new Error('Layout must preserve every region');
 const slide={slideId:content.slideId,mode:'composition',styleId:style.id,appearance:content.appearance,typographyPolicy:content.typographyPolicy,styleBindingVersion:1,compositionId:preset.id,label:content.title,readerTask:content.readerTask,elements,objects,requiredContentRefs:content.requiredContentRefs||[]};
 assignElementRoles(slide);slide.elements=elements.map(e=>bindElementAppearance(e,style));
 return {presetId:preset.id,sourcePreset:preset.source,reason:preset.reason,slide,contentBounds,regions:placed,requiredHeight:tree.h};
}
async function planMultiRegion(content,style,{measurer}){
 const candidates=[];
 for(const preset of REGION_PRESETS){
  const c=await composeRegionCandidate(content,style,preset,measurer);
  c.measurement=await measureCandidate(c,style,measurer);
  if(c.requiredHeight>c.contentBounds[3]+2)c.measurement.issues.push({kind:'region-overflow',needed:c.requiredHeight,available:c.contentBounds[3]});
  // Fill is judged per semantic region, not against unrelated short prose or photo whitespace.
  c.measurement.regionMeasurements=c.regions.map(r=>{
   const o=c.slide.objects.find(o=>o.objectId===content.slideId+'-'+r.regionId);
   const es=o?deriveSlideElements({elements:[],objects:[o]},style):[];
   const used=es.length?(Math.max(...es.map(e=>e.bounds[0]+e.bounds[2]))-Math.min(...es.map(e=>e.bounds[0])))*(Math.max(...es.map(e=>e.bounds[1]+e.bounds[3]))-Math.min(...es.map(e=>e.bounds[1]))):0;
   const fill=o?Math.min(1,used/(o.bounds[2]*o.bounds[3])):null;
   const policy=['table','process','comparison'].includes(r.kind)?'evidence-min-70':'content-whitespace';
   if(policy==='evidence-min-70'&&fill<.7)c.measurement.issues.push({kind:'region-underfilled',regionId:r.regionId,fill});
   return {...r,fillPolicy:policy,contentEnvelopeFill:fill};
  });
  c.score=100-c.measurement.issues.length*1000+(content.preferredPreset===c.sourcePreset?20:0)+preset.bodySize;
  candidates.push(c);
 }
 const selected=candidates.filter(c=>!c.measurement.issues.length).sort((a,b)=>b.score-a.score)[0];
 if(!selected)return {ok:false,conflicts:[{kind:'no-fitting-layout',message:'多区域内容未通过实测，保留全部内容与正文下限。'}],candidates};
 selected.selected=true;selected.slide.planning={engine:'content-first-v3',presetId:selected.presetId,sourcePreset:selected.sourcePreset,reason:selected.reason,measurement:selected.measurement,regions:selected.regions};
 return {ok:true,slide:selected.slide,candidates};
}
export {planMultiRegion,REGION_PRESETS};
