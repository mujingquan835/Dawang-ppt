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
   const labelText=placeholderLabel==='形象待补'&&(mediaW<120||item.placeholderBadge)?'形象\n待补':placeholderLabel;
   const badgeEl=item.placeholderBadge?text(`${prefix}-placeholder-badge`,String(item.placeholderBadge),x+8,cy+12,mediaW-16,item.placeholderBadgeSize??34,theme,measurements,{fontWeight:700,color:theme.palette.accent,textAlign:'center',lineHeight:1.15}):null;
   const placeholder=text(`${prefix}-placeholder`,labelText,x+8,cy+12,mediaW-16,item.placeholderSize??20,theme,measurements,{color:theme.palette.muted,textAlign:'center',lineHeight:1.3});
   const boxH=Math.max(mediaH,(badgeEl?badgeEl.bounds[3]+6:0)+placeholder.bounds[3]+24);
   if(badgeEl){
    const totalH=badgeEl.bounds[3]+4+placeholder.bounds[3],topY=cy+Math.round((boxH-totalH)/2);
    badgeEl.bounds[1]=topY;placeholder.bounds[1]=topY+badgeEl.bounds[3]+4;
    ids.push(badgeEl.id,placeholder.id);
   }
   mediaElements=[{id:`${prefix}-placeholder-bg`,type:'shape',bounds:[x,cy,mediaW,boxH],style:{fill:item.placeholderFill||'#E2E7F4',radius:theme.radius}},...(badgeEl?[badgeEl]:[]),placeholder];
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
 const hasHighlight=rows.some(r=>r.highlight===true||r.tone==='primary'),inset0=hasHighlight?12:0;
 const heads=seed.elements.filter(e=>e.id.startsWith(id+'-head-')&&e.type==='text');
 heads.forEach((e,j)=>{if(j===0&&inset0)e.bounds[0]+=inset0;if(columns[j]?.align)e.style.textAlign=columns[j].align;e.bounds[3]=heightFor(e,measurements);});elements.push(...heads);
 let cy=y+Math.max(...heads.map(e=>e.bounds[3]))+12;
 elements.push(lineElement({id:id+'-header-rule',from:[x,cy],to:[x+w,cy],style:{stroke:theme.palette.ink,strokeWidth:2}}));
 rows.forEach((row,i)=>{
  const isPrimary=row.highlight===true||row.tone==='primary',isSecondary=row.tone==='secondary';
  const cells=columns.map(c=>seed.elements.find(e=>e.id===`${id}-r${i+1}-${c.key}`));
  cells.forEach((e,j)=>{
   const col=columns[j];
   e.id=`${id}-row-${encodeURIComponent(row.id)}-${col.key}`;
   if(j===0&&inset0)e.bounds[0]+=inset0;
   if(col.align)e.style.textAlign=col.align;
   if(row.runs?.[col.key])e.runs=structuredClone(row.runs[col.key]);
   if(isPrimary){
    if(j===0||col.emphasize||col.key==='value'){e.style.fontWeight=700;if(col.emphasize||col.key==='value'){e.style.color=theme.palette.accent;if(col.emphasisSize)e.style.fontSize=col.emphasisSize;}}
   }else if(isSecondary&&(j===0||col.emphasize||col.key==='value')){
    e.style.fontWeight=700;if(col.emphasize||col.key==='value')e.style.color=theme.palette.accent;
   }
   if(row.styles?.[col.key])Object.assign(e.style,row.styles[col.key]);
  });
  cells.forEach(e=>{e.bounds[3]=heightFor(e,measurements);e.bounds[1]=cy+pad;});
  const rh=Math.max(...cells.map(e=>e.bounds[3]))+pad*2;
  if(isPrimary)elements.push({id:`${id}-bg-${encodeURIComponent(row.id)}`,type:'shape',bounds:[x,cy+2,w,Math.max(4,rh-4)],style:{fill:row.fill||theme.palette.highlightBg||'#F7F0E3',radius:6}});
  elements.push(...cells);
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
  const nodeEl=result.elements.find(e=>e.id===`${id}-node-${i+1}`),numEl=result.elements.find(e=>e.id===`${id}-num-${i+1}`);
  const title=result.elements.find(e=>e.id===`${id}-title-${i+1}`),detail=result.elements.find(e=>e.id===`${id}-detail-${i+1}`);
  if(steps[i].nodeFill&&nodeEl)nodeEl.style.fill=steps[i].nodeFill;
  if(steps[i].nodeColor&&numEl)numEl.style.color=steps[i].nodeColor;
  if(steps[i].titleColor&&title)title.style.color=steps[i].titleColor;
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

// Outer panels (equal or proportional shares); internal rows remain independent (no invented row correspondence).
// Optional summaries (string or structured {value,unit}) share a band, so budget/forecast details start on one baseline.
export function panelGroup(spec) {
 validate(spec);checkItems(spec.panels);
 const {id,panels,bounds:[x,y,w,h],measurements}=spec,theme=spec.theme||createTheme();
 const gap=spec.gap??36,pad=spec.padding??24;
 if(![gap,pad].every(v=>Number.isFinite(v)&&v>=0)||panels.length<2)throw new TypeError('panels require nonnegative spacing and at least two panels');
 const rawShares=spec.shares||panels.map(p=>p.share??1);
 if(!Array.isArray(rawShares)||rawShares.length!==panels.length||rawShares.some(s=>!Number.isFinite(s)||s<=0))throw new TypeError('panel shares must be positive numbers');
 const shareSum=rawShares.reduce((a,b)=>a+b,0),availW=w-gap*(panels.length-1);
 let cx=x;
 const cols=panels.map((_,i)=>{
  const pw=i===panels.length-1?x+w-cx:Math.round(availW*rawShares[i]/shareSum),px=cx;
  cx+=pw+gap;return {px,pw,inner:pw-pad*2};
 });
 if(cols.some(c=>c.inner<120))throw new TypeError('panel columns too narrow');
 if(panels.some(p=>!p.title||typeof p.builder!=='function'))throw new TypeError('panel title and builder required');
 const heads=panels.map((p,i)=>text(`${id}-${p.id}-heading`,p.title,cols[i].px+pad,y+pad,cols[i].inner,spec.titleSize??30,theme,measurements,{fontWeight:700,color:theme.palette.accent}));
 const titleH=Math.max(...heads.map(e=>e.bounds[3]));
 const summaries=panels.map((p,i)=>{
  if(!p.summary)return null;
  if(typeof p.summary==='object'){
   const valSize=p.summary.size??spec.summarySize??theme.roles?.heroMetric?.fontSize??80;
   const unitSize=p.summary.unitSize??spec.summaryUnitSize??theme.roles?.metricUnit?.fontSize??26;
   const color=p.summary.color||theme.palette.accent,unitColor=p.summary.unitColor||color;
   const mr=theme.metricRuns(p.summary.value,p.summary.unit||'',{size:valSize,unitSize,color,unitColor,gap:p.summary.gap??' '});
   const e=textElement({id:`${id}-${p.id}-summary`,text:mr.text,runs:mr.runs,bounds:[cols[i].px+pad,y+pad+titleH+16,cols[i].inner,1],style:theme.font(valSize,{fontWeight:700,color,lineHeight:1.3})});
   e.bounds[3]=heightFor(e,measurements);return e;
  }
  return text(`${id}-${p.id}-summary`,p.summary,cols[i].px+pad,y+pad+titleH+16,cols[i].inner,spec.summarySize??40,theme,measurements,{fontWeight:700,color:theme.palette.accent});
 });
 const summaryH=Math.max(0,...summaries.filter(Boolean).map(e=>e.bounds[3]));
 const sharedBodyY=y+pad+titleH+24+(summaryH?summaryH+24:0);
 if(y+h-pad-sharedBodyY<=0)throw new RangeError('panel header leaves no body space; reallocate region');
 const elements=[],bindings=[],regions=[],children=[];
 panels.forEach((p,i)=>{
  const {px,pw,inner}=cols[i],pid=`${id}-${p.id}`;
  const bodyY=(summaries[i]||spec.alignBodyTop)?sharedBodyY:(y+pad+titleH+24),bodyH=y+h-pad-bodyY;
  const bounds=[px+pad,bodyY,inner,bodyH];
  let child=p.builder({...p.spec,id:pid+'-body',bounds,theme,measurements});
  // Spread table/allocation row padding equally, without scaling fonts or forcing row correspondence.
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

// Proportional bar + structured allocation rows with primary row highlight, keyNumber amount and share badge.
export function allocationList(spec) {
 validate(spec);checkItems(spec.items);
 const {id,items,bounds:[x,y,w],measurements}=spec,theme=spec.theme||createTheme();
 const pad=spec.padY??16,gap=spec.gap??14,barH=spec.showBar===false?0:(spec.barHeight??14),barGap=spec.barGap??4;
 if(![pad,gap,barH,barGap].every(v=>Number.isFinite(v)&&v>=0))throw new TypeError('allocationList spacing must be nonnegative');
 const shares=items.map(it=>Number(it.shareValue??String(it.share??'').replace(/[^\d.]/g,'')));
 if(shares.some(s=>!Number.isFinite(s)||s<=0))throw new TypeError('allocationList items require positive share values');
 const shareSum=shares.reduce((a,b)=>a+b,0),elements=[],bindings=[],rowBounds=[];
 let cy=y;
 if(barH>0){
  const availBarW=w-barGap*(items.length-1),colors=[theme.palette.accent,theme.palette.gold||'#B58A42','#9BA8D4','#C5CEE8'];
  let bx=x;
  items.forEach((it,i)=>{
   const sw=i===items.length-1?x+w-bx:Math.max(8,Math.round(availBarW*shares[i]/shareSum));
   const segId=`${id}-bar-${encodeURIComponent(it.id)}`;
   elements.push({id:segId,type:'shape',bounds:[bx,cy,sw,barH],style:{fill:it.barColor||colors[i%colors.length],radius:4}});
   bx+=sw+barGap;
  });
  cy+=barH+20;
 }
 const leftW=Math.round(w*0.56)-28,rightX=x+Math.round(w*0.56),rightW=w-Math.round(w*0.56)-16,badgeW=spec.badgeWidth??92,badgeH=spec.badgeHeight??42;
 if(leftW<80||rightW-badgeW-12<60)throw new TypeError('allocationList region too narrow');
 items.forEach((it,i)=>{
  if(!it.title||it.amount===undefined||it.share===undefined)throw new TypeError('allocationList item requires title, amount and share');
  const rid=`${id}-row-${encodeURIComponent(it.id)}`,isPrimary=it.highlight===true||it.tone==='primary';
  const titleEl=text(`${rid}-title`,it.title,x+20,cy,leftW,spec.titleSize??24,theme,measurements,{fontWeight:isPrimary?700:600,color:theme.palette.ink});
  const detailEl=it.detail?text(`${rid}-detail`,it.detail,x+20,cy,leftW,spec.detailSize??20,theme,measurements,{fontWeight:400,color:theme.palette.body||theme.palette.muted}):null;
  const leftH=titleEl.bounds[3]+(detailEl?6+detailEl.bounds[3]:0);
  const amtSize=it.amountSize??spec.amountSize??(theme.roles?.keyNumber?.fontSize??34),unitSize=spec.unitSize??20;
  const mr=theme.metricRuns(it.amount,it.unit??'元',{valueRole:'keyNumber',unitRole:'metricUnit',size:amtSize,unitSize,color:theme.palette.accent,gap:it.unitGap??''});
  const amtEl=textElement({id:`${rid}-amount`,text:mr.text,runs:mr.runs,bounds:[rightX,cy,rightW-badgeW-14,1],style:theme.font(amtSize,{fontWeight:700,color:theme.palette.accent,textAlign:'right',lineHeight:1.2})});
  amtEl.bounds[3]=heightFor(amtEl,measurements);
  const shareEl=text(`${rid}-share`,String(it.share),x+w-16-badgeW,cy,badgeW,spec.shareSize??28,theme,measurements,{fontWeight:700,color:isPrimary?'#FFFFFF':theme.palette.accent,textAlign:'center',lineHeight:1.2});
  const rightH=Math.max(amtEl.bounds[3],badgeH,shareEl.bounds[3]);
  const rh=Math.max(leftH,rightH)+pad*2;
  const topLeft=cy+Math.round((rh-leftH)/2);
  titleEl.bounds[1]=topLeft;if(detailEl)detailEl.bounds[1]=topLeft+titleEl.bounds[3]+6;
  amtEl.bounds[1]=cy+Math.round((rh-amtEl.bounds[3])/2);
  const badgeY=cy+Math.round((rh-badgeH)/2);
  shareEl.bounds[1]=badgeY+Math.round((badgeH-shareEl.bounds[3])/2);
  elements.push({id:`${rid}-bg`,type:'shape',bounds:[x,cy,w,rh],style:{fill:isPrimary?(it.fill||theme.palette.highlightBg||'#F7F0E3'):'#FFFFFF',radius:8}});
  if(isPrimary)elements.push({id:`${rid}-mark`,type:'shape',bounds:[x,cy,6,rh],style:{fill:theme.palette.gold||'#B58A42',radius:0}});
  elements.push({id:`${rid}-badge`,type:'shape',bounds:[x+w-16-badgeW,badgeY,badgeW,badgeH],style:{fill:isPrimary?(theme.palette.gold||'#B58A42'):'#E2E7F4',radius:8}});
  elements.push(titleEl,...(detailEl?[detailEl]:[]),amtEl,shareEl);
  const heldIds=[titleEl.id,...(detailEl?[detailEl.id]:[]),amtEl.id,shareEl.id];
  if(it.ref)bindings.push({ref:it.ref,elementIds:heldIds});
  if(spec.relationRef)bindings.push({ref:spec.relationRef,rowId:it.id,elementIds:[...heldIds,...(barH>0?[`${id}-bar-${encodeURIComponent(it.id)}`]:[])]});
  if(it.refs)for(const [k,v] of Object.entries(it.refs)){const target=k==='amount'?amtEl.id:k==='share'?shareEl.id:k==='detail'&&detailEl?detailEl.id:titleEl.id;for(const ref of Array.isArray(v)?v:[v])bindings.push({ref,elementIds:[target]});}
  rowBounds.push({id:it.id,bounds:[x,cy,w,rh]});
  cy+=rh+(i<items.length-1?gap:0);
 });
 return finish(spec,elements,bindings,{rows:rowBounds});
}

// Measured circular closed-loop composition: center duration/theme + clockwise nodes + directional arcs + outer labels with leader lines.
export function capacityCycle(spec) {
 validate(spec);checkItems(spec.nodes);
 const {id,nodes,bounds:[x,y,w,h],measurements}=spec,theme=spec.theme||createTheme();
 if(nodes.length<3||nodes.length>6)throw new TypeError('capacityCycle requires 3 to 6 nodes');
 const startColor=spec.startColor||theme.palette.gold||'#B58A42',mainColor=theme.palette.accent;
 const nodeSize=spec.nodeSize??54,nodeR=nodeSize/2,leadLen=spec.leadLength??20;
 const titleSize=spec.titleSize??(theme.roles?.sectionTitle?.fontSize??30),detailSize=spec.detailSize??(theme.roles?.tableBody?.fontSize??24);
 const sideW=spec.sideLabelWidth??Math.min(260,Math.floor(w*0.24)),tbW=spec.topBottomLabelWidth??Math.min(360,Math.floor(w*0.42));
 if(sideW<110||tbW<140)throw new TypeError('capacityCycle bounds too narrow for external labels');
 const n=nodes.length;
 const labelDrafts=nodes.map((node,i)=>{
  if(!node.title)throw new TypeError('capacityCycle node requires title');
  const angle=-Math.PI/2+(2*Math.PI*i)/n,sin=Math.sin(angle),cos=Math.cos(angle);
  const pos=sin<-0.7?'top':sin>0.7?'bottom':cos>=0?'right':'left';
  const lw=pos==='top'||pos==='bottom'?tbW:sideW,align=pos==='top'||pos==='bottom'?'center':pos==='left'?'right':'left';
  const nid=encodeURIComponent(node.id);
  const tEl=text(`${id}-title-${nid}`,node.title,x,y,lw,titleSize,theme,measurements,{fontWeight:700,color:mainColor,textAlign:align});
  const dEl=node.detail?text(`${id}-detail-${nid}`,node.detail,x,y,lw,detailSize,theme,measurements,{fontWeight:400,color:theme.palette.body||theme.palette.muted,textAlign:align}):null;
  return {node,nid,angle,sin,cos,pos,lw,tEl,dEl,blockH:tEl.bounds[3]+(dEl?6+dEl.bounds[3]:0)};
 });
 const noteEl=spec.note?text(`${id}-note`,typeof spec.note==='string'?spec.note:spec.note.text,x+16,y+h-36,w-32,spec.noteSize??(theme.roles?.caption?.fontSize??20),theme,measurements,{color:theme.palette.muted,textAlign:spec.noteAlign||'center'}):null;
 const availH=h-(noteEl?noteEl.bounds[3]+12:0);
 const topH=Math.max(0,...labelDrafts.filter(d=>d.pos==='top').map(d=>d.blockH));
 const botH=Math.max(0,...labelDrafts.filter(d=>d.pos==='bottom').map(d=>d.blockH));
 const maxRx=Math.floor(w/2-sideW-leadLen-nodeR-16);
 const maxRy=Math.floor((availH-(topH+botH+(nodeR+leadLen+10)*2))/2);
 const R=spec.radius??Math.min(205,Math.max(110,Math.min(maxRx,maxRy)));
 const cx=x+Math.round(w/2);
 const totalAssemblyH=topH+botH+(nodeR+leadLen+10)*2+R*2;
 const cy=y+Math.round(topH+nodeR+leadLen+10+R+Math.max(0,(availH-totalAssemblyH)/2));
 const boxPad=nodeR+8,vb=(R+boxPad)*2,boxBounds=[cx-R-boxPad,cy-R-boxPad,vb,vb],c=R+boxPad;
 const elements=[],bindings=[];
 elements.push({id:`${id}-track`,type:'vector',bounds:[...boxBounds],viewBox:[0,0,vb,vb],path:`M ${c} ${c-R} A ${R} ${R} 0 1 1 ${c} ${c+R} A ${R} ${R} 0 1 1 ${c} ${c-R} Z`,style:{fill:'none',stroke:theme.palette.pale,strokeWidth:spec.trackWidth??28}});
 const innerR=Math.max(48,R-22);
 if(spec.center){
  const cw=Math.round(innerR*1.65),cx0=cx-Math.round(cw/2);
  const cVal=text(`${id}-center-value`,spec.center.value,cx0,cy,cw,spec.center.valueSize??52,theme,measurements,{fontWeight:700,color:mainColor,textAlign:'center',lineHeight:1.3});
  const cLab=spec.center.label?text(`${id}-center-label`,spec.center.label,cx0,cy,cw,spec.center.labelSize??24,theme,measurements,{fontWeight:400,color:theme.palette.body||theme.palette.muted,textAlign:'center'}):null;
  const ch=cVal.bounds[3]+(cLab?6+cLab.bounds[3]:0),ctop=cy-Math.round(ch/2);
  cVal.bounds[1]=ctop;if(cLab)cLab.bounds[1]=ctop+cVal.bounds[3]+6;
  elements.push(cVal,...(cLab?[cLab]:[]));
  if(spec.center.ref)bindings.push({ref:spec.center.ref,elementIds:[cVal.id,...(cLab?[cLab.id]:[])]});
 }
 const edges=nodes.map((node,i)=>({id:spec.edges?.[i]?.id||`e${i+1}`,from:node.id,to:nodes[(i+1)%n].id,highlight:spec.edges?.[i]?.highlight??(i===n-1&&spec.highlightReturn!==false)}));
 edges.forEach((edge,i)=>{
  const a1=-Math.PI/2+(2*Math.PI*i)/n,a2=a1+(2*Math.PI)/n;
  const padStart=Math.asin(Math.min(0.75,(nodeR+10)/R)),padTip=Math.asin(Math.min(0.75,(nodeR+6)/R));
  const arrowLen=16,arrowHalfW=8.5,padArrow=Math.asin(Math.min(0.45,arrowLen/R));
  const sAng=a1+padStart,tAng=a2-padTip,eAng=tAng-padArrow;
  const x1=c+R*Math.cos(sAng),y1=c+R*Math.sin(sAng),x2=c+R*Math.cos(eAng),y2=c+R*Math.sin(eAng);
  const xt=c+R*Math.cos(tAng),yt=c+R*Math.sin(tAng);
  const xo=c+(R+arrowHalfW)*Math.cos(eAng),yo=c+(R+arrowHalfW)*Math.sin(eAng),xi=c+(R-arrowHalfW)*Math.cos(eAng),yi=c+(R-arrowHalfW)*Math.sin(eAng);
  const stroke=edge.highlight?startColor:mainColor,eid=encodeURIComponent(edge.id);
  const arcId=`${id}-arc-${eid}`,arrId=`${id}-arrow-${eid}`;
  elements.push(
   {id:arcId,type:'vector',bounds:[...boxBounds],viewBox:[0,0,vb,vb],path:`M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,style:{fill:'none',stroke,strokeWidth:4.5,strokeLinecap:'round'}},
   {id:arrId,type:'vector',bounds:[...boxBounds],viewBox:[0,0,vb,vb],path:`M ${xt.toFixed(2)} ${yt.toFixed(2)} L ${xo.toFixed(2)} ${yo.toFixed(2)} L ${xi.toFixed(2)} ${yi.toFixed(2)} Z`,style:{fill:stroke,stroke:'none'}}
  );
  if(spec.relationRef)bindings.push({ref:spec.relationRef,edgeId:edge.id,elementIds:[arcId,arrId]});
 });
 labelDrafts.forEach(({node,nid,cos,sin,pos,lw,tEl,dEl,blockH},i)=>{
  const nx=Math.round(cx+R*cos),ny=Math.round(cy+R*sin),isStart=node.highlight??(i===0),fill=isStart?startColor:mainColor;
  const badgeId=`${id}-node-${nid}`;
  const numEl=text(`${id}-num-${nid}`,String(node.num??(i+1)),nx-nodeR,ny,nodeSize,28,theme,measurements,{fontWeight:700,color:'#FFFFFF',textAlign:'center',lineHeight:1.15});
  numEl.bounds[1]=ny-Math.round(numEl.bounds[3]/2);
  elements.push({id:badgeId,type:'shape',bounds:[nx-nodeR,ny-nodeR,nodeSize,nodeSize],style:{fill,radius:nodeR}},numEl);
  let lx1=nx,ly1=ny,lx2=nx,ly2=ny;
  if(pos==='top'){
   ly1=ny-nodeR-2;ly2=ny-nodeR-leadLen;
   const bx=cx-Math.round(lw/2),by=ly2-6-blockH;
   tEl.bounds[0]=bx;tEl.bounds[1]=by;
   if(dEl){dEl.bounds[0]=bx;dEl.bounds[1]=by+tEl.bounds[3]+6;}
  }else if(pos==='bottom'){
   ly1=ny+nodeR+2;ly2=ny+nodeR+leadLen;
   const bx=cx-Math.round(lw/2),by=ly2+6;
   tEl.bounds[0]=bx;tEl.bounds[1]=by;
   if(dEl){dEl.bounds[0]=bx;dEl.bounds[1]=by+tEl.bounds[3]+6;}
  }else if(pos==='right'){
   lx1=nx+nodeR+2;lx2=nx+nodeR+leadLen;
   const bx=lx2+8,by=ny-Math.round(blockH/2);
   tEl.bounds[0]=bx;tEl.bounds[1]=by;
   if(dEl){dEl.bounds[0]=bx;dEl.bounds[1]=by+tEl.bounds[3]+6;}
  }else{
   lx1=nx-nodeR-2;lx2=nx-nodeR-leadLen;
   const bx=lx2-8-lw,by=ny-Math.round(blockH/2);
   tEl.bounds[0]=bx;tEl.bounds[1]=by;
   if(dEl){dEl.bounds[0]=bx;dEl.bounds[1]=by+tEl.bounds[3]+6;}
  }
  elements.push(lineElement({id:`${id}-lead-${nid}`,from:[lx1,ly1],to:[lx2,ly2],style:{stroke:isStart?startColor:theme.palette.line,strokeWidth:2}}),tEl,...(dEl?[dEl]:[]));
  if(node.ref)bindings.push({ref:node.ref,elementIds:[numEl.id,tEl.id,...(dEl?[dEl.id]:[])]});
 });
 if(noteEl){
  noteEl.bounds[1]=y+h-noteEl.bounds[3]-4;
  elements.push(noteEl);
  if(spec.note?.ref)bindings.push({ref:spec.note.ref,elementIds:[noteEl.id]});
 }
 return finish(spec,elements,bindings,{center:[cx,cy],radius:R});
}

// Conditional branch workflow with forward main lane, downward exception branch, and return loop edge.
export function capacityBranch(spec) {
 validate(spec);checkItems(spec.steps);
 const {id,steps,branch,bounds:[x,y,w,h],measurements}=spec,theme=spec.theme||createTheme();
 if(!branch||typeof branch.id!=='string'||!branch.title||!branch.from)throw new TypeError('branch with id, title and from step id required');
 const n=steps.length,bIdx=steps.findIndex(s=>s.id===branch.from),rIdx=Math.max(0,steps.findIndex(s=>s.id===(branch.returnTo|| steps[0].id)));
 if(bIdx<0||bIdx>=n-1)throw new TypeError('branch.from must reference a non-terminal main step');
 const gap=spec.gap??48,slotW=Math.floor((w-gap*(n-1))/n);
 if(slotW<140)throw new TypeError('branch main slots too narrow');
 const titleSize=spec.titleSize??30,detailSize=spec.detailSize??24,condSize=spec.conditionSize??20;
 const mainColor=theme.palette.accent,branchColor=spec.branchColor||theme.palette.pop||'#B58A42';
 const topY=y+36,nodeSize=48,elements=[],bindings=[];

 // 1) Main forward lane
 const stepDrafts=steps.map((step,i)=>{
  const sx=x+i*(slotW+gap),sid=encodeURIComponent(step.id);
  const numEl=text(`${id}-num-${sid}`,String(step.num??`0${i+1}`),sx,topY,nodeSize,28,theme,measurements,{fontWeight:700,color:'#FFFFFF',textAlign:'center',lineHeight:1.15});
  numEl.bounds[1]=topY+Math.round((nodeSize-numEl.bounds[3])/2);
  const tEl=text(`${id}-title-${sid}`,step.title,sx,topY+nodeSize+14,slotW,titleSize,theme,measurements,{fontWeight:700,color:step.highlight?mainColor:theme.palette.ink});
  const dEl=step.detail?text(`${id}-detail-${sid}`,step.detail,sx,topY+nodeSize+14+tEl.bounds[3]+8,slotW,detailSize,theme,measurements,{fontWeight:400,color:theme.palette.body||theme.palette.muted}):null;
  const bottom=dEl?dEl.bounds[1]+dEl.bounds[3]:tEl.bounds[1]+tEl.bounds[3];
  return {step,sid,sx,numEl,tEl,dEl,bottom};
 });
 const mainBottom=Math.max(...stepDrafts.map(d=>d.bottom));
 stepDrafts.forEach(({step,sid,sx,numEl,tEl,dEl})=>{
  const fill=step.highlight?mainColor:(step.nodeFill||mainColor);
  elements.push({id:`${id}-node-${sid}`,type:'shape',bounds:[sx,topY,nodeSize,nodeSize],style:{fill,radius:24}},numEl,tEl,...(dEl?[dEl]:[]));
  if(step.ref)bindings.push({ref:step.ref,elementIds:[numEl.id,tEl.id,...(dEl?[dEl.id]:[])]});
 });

 // 2) Forward edges + passCondition badge on bIdx -> bIdx+1
 for(let i=0;i<n-1;i++){
  const from=stepDrafts[i],to=stepDrafts[i+1];
  const lx1=from.sx+nodeSize+12,lx2=to.sx-14,ly=topY+Math.round(nodeSize/2);
  const linkId=`${id}-link-${from.sid}-${to.sid}`,headId=`${id}-head-${from.sid}-${to.sid}`;
  elements.push(
   lineElement({id:linkId,from:[lx1,ly],to:[lx2,ly],style:{stroke:mainColor,strokeWidth:3}}),
   {id:headId,type:'vector',bounds:[lx2-14,ly-8,16,16],viewBox:[0,0,16,16],path:'M 0 0 L 16 8 L 0 16 Z',style:{fill:mainColor,stroke:'none'}}
  );
  const edgeIds=[linkId,headId];
  if(i===bIdx&&branch.passCondition?.label){
   const cw=Math.min(180,Math.max(116,lx2-lx1-16)),cx0=lx1+Math.round((lx2-lx1-cw)/2);
   const cBgId=`${id}-cond-pass-bg`,cTxt=text(`${id}-cond-pass`,branch.passCondition.label,cx0,y,cw,condSize,theme,measurements,{fontWeight:700,color:mainColor,textAlign:'center',lineHeight:1.2});
   elements.push({id:cBgId,type:'shape',bounds:[cx0,y-2,cw,cTxt.bounds[3]+4],style:{fill:theme.palette.pale||'#F0F2F9',radius:6}},cTxt);
   edgeIds.push(cTxt.id);
   if(branch.passCondition.ref)bindings.push({ref:branch.passCondition.ref,elementIds:[cTxt.id]});
  }
  const edgeId=i===bIdx?(branch.passCondition?.edgeId||`e${i+1}`):(spec.forwardEdgeIds?.[i]||`e${i+1}`);
  if(spec.relationRef&&edgeId)bindings.push({ref:spec.relationRef,edgeId,elementIds:edgeIds});
 }

 // 3) Downward exception branch from bIdx
 const bStep=stepDrafts[bIdx],rStep=stepDrafts[rIdx];
 const branchGap=spec.branchGap??78,by=mainBottom+branchGap;
 const downX=bStep.sx+Math.round(nodeSize/2),downY1=bStep.bottom+8,downY2=by-6;
 const failLineId=`${id}-branch-down`,failHeadId=`${id}-branch-down-head`;
 elements.push(
  lineElement({id:failLineId,from:[downX,downY1],to:[downX,downY2],style:{stroke:branchColor,strokeWidth:3}}),
  {id:failHeadId,type:'vector',bounds:[downX-8,downY2-12,16,16],viewBox:[0,0,16,16],path:'M 0 0 L 16 0 L 8 16 Z',style:{fill:branchColor,stroke:'none'}}
 );
 const failEdgeIds=[failLineId,failHeadId];
 if(branch.failCondition?.label){
  const fTxt=text(`${id}-cond-fail`,branch.failCondition.label,downX+14,downY1+Math.max(4,Math.round((downY2-downY1-32)/2)),180,condSize,theme,measurements,{fontWeight:700,color:'#1F2430',lineHeight:1.2});
  elements.push({id:`${id}-cond-fail-bg`,type:'shape',bounds:[downX+10,fTxt.bounds[1]-2,188,fTxt.bounds[3]+4],style:{fill:theme.palette.highlightBg||'#F7F0E3',radius:6}},fTxt);
  failEdgeIds.push(fTxt.id);
  if(branch.failCondition.ref)bindings.push({ref:branch.failCondition.ref,elementIds:[fTxt.id]});
 }
 if(spec.relationRef&&branch.failCondition?.edgeId)bindings.push({ref:spec.relationRef,edgeId:branch.failCondition.edgeId,elementIds:failEdgeIds});

 // 4) Exception branch card
 const maxBranchW=branch.passSummary&&bIdx+1<n?Math.max(slotW+40,stepDrafts[bIdx+1].sx-bStep.sx-28):w-(bStep.sx-x);
 const bCardW=Math.min(maxBranchW,Math.max(slotW+80,Math.round(slotW*1.45))),bid=encodeURIComponent(branch.id);
 const bTitle=text(`${id}-title-${bid}`,branch.title,bStep.sx+24,by+16,bCardW-40,titleSize,theme,measurements,{fontWeight:700,color:'#1F2430'});
 const bDetail=branch.detail?text(`${id}-detail-${bid}`,branch.detail,bStep.sx+24,by+16+bTitle.bounds[3]+8,bCardW-40,detailSize,theme,measurements,{fontWeight:400,color:theme.palette.body||theme.palette.muted}):null;
 let bCardH=(bDetail?bDetail.bounds[1]+bDetail.bounds[3]:bTitle.bounds[1]+bTitle.bounds[3])-by+18;
 let passEls=[];
 if(branch.passSummary&&bIdx+1<n){
  const px0=Math.max(bStep.sx+bCardW+28,stepDrafts[bIdx+1].sx),pw0=x+w-px0;
  if(pw0>=180){
   const pTitle=text(`${id}-pass-summary-title`,branch.passSummary.title,px0+24,by+16,pw0-40,titleSize,theme,measurements,{fontWeight:700,color:mainColor});
   const pDetail=branch.passSummary.detail?text(`${id}-pass-summary-detail`,branch.passSummary.detail,px0+24,by+16+pTitle.bounds[3]+8,pw0-40,detailSize,theme,measurements,{fontWeight:400,color:theme.palette.body||theme.palette.muted}):null;
   const pCardH=(pDetail?pDetail.bounds[1]+pDetail.bounds[3]:pTitle.bounds[1]+pTitle.bounds[3])-by+18;
   bCardH=Math.max(bCardH,pCardH);
   passEls=[
    {id:`${id}-pass-summary-card`,type:'shape',bounds:[px0,by,pw0,bCardH],style:{fill:theme.palette.pale||'#F0F2F9',radius:8}},
    {id:`${id}-pass-summary-bar`,type:'shape',bounds:[px0,by,6,bCardH],style:{fill:mainColor,radius:0}},
    pTitle,
    ...(pDetail?[pDetail]:[])
   ];
   if(branch.passSummary.ref)bindings.push({ref:branch.passSummary.ref,elementIds:[pTitle.id,...(pDetail?[pDetail.id]:[])]});
  }
 }
 elements.push(
  {id:`${id}-card-${bid}`,type:'shape',bounds:[bStep.sx,by,bCardW,bCardH],style:{fill:theme.palette.highlightBg||'#F7F0E3',radius:8}},
  {id:`${id}-bar-${bid}`,type:'shape',bounds:[bStep.sx,by,6,bCardH],style:{fill:branchColor,radius:0}},
  bTitle,
  ...(bDetail?[bDetail]:[]),
  ...passEls
 );
 if(branch.ref)bindings.push({ref:branch.ref,elementIds:[bTitle.id,...(bDetail?[bDetail.id]:[])]});

 // 5) Return loop from branch card left side -> left to rStep -> up to rStep bottom
 const retY=by+Math.round(bCardH/2),retX1=bStep.sx,retX2=rStep.sx+Math.round(nodeSize/2),retTopY=rStep.bottom+10;
 const retVecX=Math.min(retX1,retX2)-12,retVecY=retTopY-4,retVecW=Math.abs(retX1-retX2)+24,retVecH=retY-retTopY+16;
 const vx1=retX1-retVecX,vy1=retY-retVecY,vx2=retX2-retVecX,vy2=retTopY-retVecY+10;
 const retPathId=`${id}-return-path`,retHeadId=`${id}-return-head`;
 elements.push(
  {id:retPathId,type:'vector',bounds:[retVecX,retVecY,retVecW,retVecH],viewBox:[0,0,retVecW,retVecH],path:`M ${vx1} ${vy1} L ${vx2} ${vy1} L ${vx2} ${vy2}`,style:{fill:'none',stroke:branchColor,strokeWidth:3}},
  {id:retHeadId,type:'vector',bounds:[retX2-8,retTopY-2,16,16],viewBox:[0,0,16,16],path:'M 8 0 L 16 14 L 0 14 Z',style:{fill:branchColor,stroke:'none'}}
 );
 const retEdgeIds=[retPathId,retHeadId];
 if(branch.returnEdge?.label){
  const rw=Math.max(180,Math.min(280,retX1-retX2-24)),rx0=retX2+Math.max(12,Math.round((retX1-retX2-rw)/2));
  const rTxt=text(`${id}-return-label`,branch.returnEdge.label,rx0,retY-38,rw,condSize,theme,measurements,{fontWeight:700,color:mainColor,textAlign:'center',lineHeight:1.2});
  elements.push(rTxt);
  retEdgeIds.push(rTxt.id);
  if(branch.returnEdge.ref)bindings.push({ref:branch.returnEdge.ref,elementIds:[rTxt.id]});
 }
 if(spec.relationRef&&branch.returnEdge?.edgeId)bindings.push({ref:spec.relationRef,edgeId:branch.returnEdge.edgeId,elementIds:retEdgeIds});

 if(spec.note?.text){
  const nEl=text(`${id}-note`,spec.note.text,x,by+bCardH+18,w,spec.note.size??20,theme,measurements,{color:theme.palette.muted});
  elements.push(nEl);
  if(spec.note.ref)bindings.push({ref:spec.note.ref,elementIds:[nEl.id]});
 }
 return finish(spec,elements,bindings,{mainBottom,branchBounds:[bStep.sx,by,bCardW,bCardH]});
}
