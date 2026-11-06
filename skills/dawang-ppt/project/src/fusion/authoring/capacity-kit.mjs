import { textElement, lineElement } from './elements.mjs';
import { table, flow, photoGroup, textHeight, createTheme } from './layout-kit.mjs';

// Opt-in modules; legacy tools keep their existing geometry. No text is dropped or shrunk.
function validate(spec) {
 const {id,bounds}=spec;
 if(typeof id!=='string'||!id||!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]<0||bounds[1]<0||bounds[2]<=0||bounds[3]<=0||bounds[0]+bounds[2]>1920||bounds[1]+bounds[3]>1080)throw new TypeError('id and in-canvas positive bounds required');
}
const checkItems=items=>{if(!Array.isArray(items)||!items.length||items.some(i=>!i||typeof i.id!=='string'||!i.id)||new Set(items.map(i=>i.id)).size!==items.length)throw new TypeError('nonempty items with unique IDs required');};
const heightFor=(e,measurements)=>Math.ceil(measurements?.get(e.id)?.height ?? textHeight(e.text,e.style.fontSize,e.bounds[2],e.style.lineHeight))+4;
function finish(spec,elements,bindings=[],extra={}) {
 validate(spec);
 const [x,y,w,h]=spec.bounds, right=Math.max(x,...elements.map(e=>e.bounds[0]+e.bounds[2])), bottom=Math.max(y,...elements.map(e=>e.bounds[1]+e.bounds[3]));
 const violations=[];
 if(bottom>y+h+1e-6)violations.push({kind:'height',required:bottom-y,available:h});
 if(right>x+w+1e-6)violations.push({kind:'width',required:right-x,available:w});
 for(const e of elements)if(e.type==='text'&&spec.measurements?.get(e.id)?.width>e.bounds[2]+2)violations.push({kind:'text-width',elementId:e.id,required:spec.measurements.get(e.id).width,available:e.bounds[2]});
 const status=violations.length?(bottom>1080||right>1920||violations.some(v=>v.kind==='text-width')?'cannot-fit':'needs-reflow'):'fits';
 const method=spec.measurements?'measured':'estimated';
 return {...extra,elements:elements.map(e=>({...e,capacityModule:{id:spec.id,status,method}})),height:bottom-y,width:right-x,occupiedBounds:[x,y,right-x,bottom-y],bindings,
 capacity:{status,method,constraints:{bounds:[...spec.bounds]},violations,alternatives:status==='fits'?[]:[{action:'reallocate-region',requiredHeight:bottom-y},{action:'change-layout-or-split',preserveContent:true}]}};
}
function text(id,value,x,y,w,size,theme,measurements,style={}) {
 if(!Number.isFinite(size)||size<=0)throw new TypeError('font size must be positive');
 const e=textElement({id,text:String(value??''),bounds:[x,y,w,1],style:theme.font(size,{lineHeight:1.35,...style})});
 e.bounds[3]=heightFor(e,measurements);return e;
}

// A role is one row: portrait/explicit placeholder + name + role + duties. Rows grow together.
export function roleGroup(spec) {
 validate(spec);checkItems(spec.items);
 const {id,items,bounds:[x,y,w],measurements}=spec,theme=spec.theme||createTheme(),gap=spec.gap??20,mediaW=spec.mediaWidth??124,mediaH=spec.mediaHeight??160;
 if(![gap,mediaW,mediaH].every(Number.isFinite)||gap<0||mediaW<=0||mediaH<=0||w-mediaW-24<100)throw new TypeError('role column too narrow or invalid media dimensions');
 const elements=[],bindings=[],rows=[];let cy=y;
 for(const item of items){
  if(!item.name||!item.role||!item.detail)throw new TypeError('name, role and detail required');
  const prefix=`${id}-${item.id}`,tx=x+mediaW+24,tw=w-mediaW-24,ids=[];let ty=cy;
  for(const [key,size,weight] of [['name',spec.nameSize??30,700],['role',spec.roleSize??24,700],['detail',spec.detailSize??24,400]]){
   const e=text(`${prefix}-${key}`,item[key],tx,ty,tw,size,theme,measurements,{fontWeight:weight});elements.push(e);ids.push(e.id);ty+=e.bounds[3]+8;
  }
  let mediaElements;
  if(item.photo)mediaElements=photoGroup({id:`${prefix}-photo`,x,y:cy,width:mediaW,height:mediaH,images:[{...item.photo,src:item.photo.src||item.photo.file}],theme,gap:0}).elements;
  else {
   const placeholderLabel=item.placeholder||'形象待补';
   const placeholder=text(`${prefix}-placeholder`,placeholderLabel==='形象待补'&&mediaW<120?'形象\n待补':placeholderLabel,x+8,cy+12,mediaW-16,22,theme,measurements,{color:theme.palette.muted,textAlign:'center'});
   mediaElements=[{id:`${prefix}-placeholder-bg`,type:'shape',bounds:[x,cy,mediaW,Math.max(mediaH,placeholder.bounds[3]+24)],style:{fill:theme.palette.pale,radius:theme.radius}},placeholder];
  }
  elements.push(...mediaElements);
  const rh=Math.max(ty-cy-8,...mediaElements.map(e=>e.bounds[1]+e.bounds[3]-cy));
  if(item.ref)bindings.push({ref:item.ref,elementIds:ids});
  rows.push({id:item.id,bounds:[x,cy,w,rh]});cy+=rh+gap;
 }
 return finish(spec,elements,bindings,{rows});
}

// Reuse the table tool's column/row semantics; rebuild geometry from all cell/header heights.
export function capacityTable(spec) {
 validate(spec);checkItems(spec.rows);
 const {id,rows,bounds:[x,y,w],measurements}=spec,theme=spec.theme||createTheme(),columns=spec.columns;
 if(!Array.isArray(columns)||!columns.length||columns.some(c=>!c.key||!c.label||!Number.isFinite(c.width)||c.width<=32)||new Set(columns.map(c=>c.key)).size!==columns.length||Math.abs(columns.reduce((n,c)=>n+c.width,0)-w)>1)throw new TypeError('unique columns must have positive widths summing to region width');
 const seed=table({id,x,y,columns,rows,theme,size:spec.size??26,headSize:spec.headSize??22,padY:spec.padY??16});
 const elements=[],bindings=[],rowBounds=[],pad=spec.padY??16;
 if(!Number.isFinite(pad)||pad<0)throw new TypeError('padY must be nonnegative');
 const heads=seed.elements.filter(e=>e.id.startsWith(id+'-head-')&&e.type==='text');
 heads.forEach(e=>{e.bounds[3]=heightFor(e,measurements);});elements.push(...heads);
 let cy=y+Math.max(...heads.map(e=>e.bounds[3]))+12;
 elements.push(lineElement({id:id+'-header-rule',from:[x,cy],to:[x+w,cy],style:{stroke:theme.palette.ink,strokeWidth:2}}));
 rows.forEach((row,i)=>{
  const cells=columns.map(c=>seed.elements.find(e=>e.id===`${id}-r${i+1}-${c.key}`));
  cells.forEach((e,j)=>{e.id=`${id}-row-${encodeURIComponent(row.id)}-${columns[j].key}`;});
  cells.forEach(e=>{e.bounds[3]=heightFor(e,measurements);e.bounds[1]=cy+pad;});
  const rh=Math.max(...cells.map(e=>e.bounds[3]))+pad*2;elements.push(...cells);
  if(row.ref)bindings.push({ref:row.ref,elementIds:cells.map(e=>e.id)});
  if(spec.relationRef)bindings.push({ref:spec.relationRef,rowId:row.id,elementIds:cells.map(e=>e.id)});
  for(const c of columns)if(row.refs?.[c.key])for(const ref of Array.isArray(row.refs[c.key])?row.refs[c.key]:[row.refs[c.key]])bindings.push({ref,elementIds:[cells.find(e=>e.id.endsWith('-'+c.key)).id]});
  rowBounds.push({id:row.id,bounds:[x,cy,w,rh]});cy+=rh;
  elements.push(lineElement({id:`${id}-rule-${encodeURIComponent(row.id)}`,from:[x,cy],to:[x+w,cy],style:{stroke:theme.palette.line,strokeWidth:1}}));
 });
 return finish(spec,elements,bindings,{rows:rowBounds});
}
export function schedule(spec) {
 const w=spec.bounds?.[2];
 return capacityTable({...spec,columns:spec.columns||[{key:'time',label:'时间',width:w*.29},{key:'content',label:'直播内容',width:w*.44},{key:'people',label:'参与人员',width:w*.27}]});
}

// Existing flow geometry, with measured title/detail heights driving vertical placement.
export function capacityFlow(spec) {
 validate(spec);checkItems(spec.steps);
 const {id,steps,bounds:[x,y,w],measurements}=spec,theme=spec.theme||createTheme();
 if(w/steps.length<100)throw new TypeError('flow slots too narrow: use another layout');
 const result=flow({id,x,y,width:w,steps,theme,titleSize:spec.titleSize??30,detailSize:spec.detailSize??24});
 for(let i=0;i<steps.length;i++){
  const title=result.elements.find(e=>e.id===`${id}-title-${i+1}`),detail=result.elements.find(e=>e.id===`${id}-detail-${i+1}`);
  title.bounds[3]=heightFor({...title,id:`${id}-title-${encodeURIComponent(steps[i].id)}`},measurements);
  if(detail){detail.bounds[1]=title.bounds[1]+title.bounds[3]+6;detail.bounds[3]=heightFor({...detail,id:`${id}-detail-${encodeURIComponent(steps[i].id)}`},measurements);}
 }
 const bindings=steps.flatMap((s,i)=>s.ref?[{ref:s.ref,elementIds:result.elements.filter(e=>e.id===`${id}-title-${i+1}`||e.id===`${id}-detail-${i+1}`).map(e=>e.id)}]:[]);
 // Keep authored IDs stable when steps are reordered; a link identity includes both endpoints.
 const idMap=new Map();
 steps.forEach((step,i)=>{
  for(const part of ['node','num','title','detail'])idMap.set(`${id}-${part}-${i+1}`,`${id}-${part}-${encodeURIComponent(step.id)}`);
  if(i<steps.length-1)idMap.set(`${id}-link-${i+1}`,`${id}-link-${encodeURIComponent(step.id)}-${encodeURIComponent(steps[i+1].id)}`);
 });
 result.elements.forEach(e=>{e.id=idMap.get(e.id)||e.id;});
 bindings.forEach(b=>{b.elementIds=b.elementIds.map(e=>idMap.get(e)||e);});
 return finish(spec,result.elements,bindings);
}

// One measured pass is enough: widths, fonts and text do not change during reflow.
// Caller owns the measurer lifecycle; failures propagate, never masquerade as estimated success.
export async function measureModule(builder,spec,measurer) {
 if(!measurer?.texts)throw new TypeError('a layout measurer is required');
 const initial=builder({...spec,measurements:undefined});
 const texts=initial.elements.filter(e=>e.type==='text');
 const measured=await measurer.texts(texts);
 if(measured.length!==texts.length||texts.some(e=>!measured.some(m=>m.id===e.id&&m.fontAvailable===true&&Number.isFinite(m.height)&&m.height>0&&Number.isFinite(m.width)&&m.width>0)))throw new Error('Incomplete or invalid module measurements');
 return builder({...spec,measurements:new Map(measured.map(m=>[m.id,m]))});
}

// Equal outer panels; internal rows remain independent (no invented row correspondence).
// Optional summaries share a band, so budget/forecast details start on one baseline.
export function panelGroup(spec) {
 validate(spec);checkItems(spec.panels);
 const {id,panels,bounds:[x,y,w,h],measurements}=spec,theme=spec.theme||createTheme();
 const gap=spec.gap??36,pad=spec.padding??24;
 if(![gap,pad].every(v=>Number.isFinite(v)&&v>=0)||panels.length<2)throw new TypeError('panels require nonnegative spacing and at least two panels');
 const pw=(w-gap*(panels.length-1))/panels.length,inner=pw-pad*2;
 if(inner<120)throw new TypeError('panel columns too narrow');
 const heads=panels.map((p,i)=>text(`${id}-${p.id}-heading`,p.title,x+i*(pw+gap)+pad,y+pad,inner,spec.titleSize??30,theme,measurements,{fontWeight:700,color:theme.palette.accent}));
 if(panels.some(p=>!p.title||typeof p.builder!=='function'))throw new TypeError('panel title and builder required');
 const titleH=Math.max(...heads.map(e=>e.bounds[3]));
 const summaries=panels.map((p,i)=>p.summary?text(`${id}-${p.id}-summary`,p.summary,x+i*(pw+gap)+pad,y+pad+titleH+16,inner,spec.summarySize??40,theme,measurements,{fontWeight:700,color:theme.palette.accent}):null);
 const summaryH=Math.max(0,...summaries.filter(Boolean).map(e=>e.bounds[3]));
 const bodyY=y+pad+titleH+24+(summaryH?summaryH+24:0),bodyH=y+h-pad-bodyY;
 if(bodyH<=0)throw new RangeError('panel header leaves no body space; reallocate region');
 const elements=[],bindings=[],regions=[],children=[];
 panels.forEach((p,i)=>{
  const px=x+i*(pw+gap),pid=`${id}-${p.id}`,bounds=[px+pad,bodyY,inner,bodyH];
  let child=p.builder({...p.spec,id:pid+'-body',bounds,theme,measurements});
  // Spread table padding equally, without scaling fonts or forcing row correspondence.
  if(p.distributeRows&&child.rows?.length&&child.capacity.status==='fits'){
   const extra=Math.max(0,bodyH-child.height)/child.rows.length/2;
   child=p.builder({...p.spec,padY:(p.spec?.padY??16)+extra,id:pid+'-body',bounds,theme,measurements});
  }
  elements.push({id:pid+'-panel',type:'shape',bounds:[px,y,pw,h],style:{fill:theme.palette.pale,radius:theme.radius}},
   {id:pid+'-accent',type:'shape',bounds:[px,y,6,h],style:{fill:theme.palette.accent,radius:0}},heads[i],...(summaries[i]?[summaries[i]]:[]),...child.elements);
  bindings.push(...child.bindings);if(p.titleRef)bindings.push({ref:p.titleRef,elementIds:[heads[i].id]});if(p.summaryRef&&summaries[i])bindings.push({ref:p.summaryRef,elementIds:[summaries[i].id]});children.push(child.capacity);
  regions.push({id:p.id,frameElementId:pid+'-panel',padding:pad,bounds:[px,y,pw,h],bodyBounds:bounds,headingId:heads[i].id});
 });
 if(new Set(elements.map(e=>e.id)).size!==elements.length)throw new Error('duplicate panel element IDs');
 const result=finish(spec,elements,bindings,{regions,children});
 const failed=children.filter(c=>c.status!=='fits');
 if(failed.length){result.capacity.status=failed.some(c=>c.status==='cannot-fit')?'cannot-fit':'needs-reflow';result.capacity.violations.push(...failed.flatMap(c=>c.violations));result.capacity.alternatives=[{action:'reallocate-region-or-change-layout',preserveContent:true}];result.elements.forEach(e=>{e.capacityModule.status=result.capacity.status;});}
 return result;
}
