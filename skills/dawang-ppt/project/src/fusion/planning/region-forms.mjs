// Content relationships select forms before geometry is measured. Explicit choices stay locked.
function selectRegionForms(content){
 const copy=structuredClone(content),decisions=[];
 for(const r of copy.regions){
  const d=r.data;
  if(!d)continue;
  let reason='保留明确指定的内容对象与表达形式';
  if(!d.presentation&&r.kind==='process'){
   d.presentation='numbered-sequence';reason='有序步骤用编号关系链呈现，避免普通文字列表';
  }else if(!d.presentation&&r.kind==='comparison'){
   d.presentation='open-comparison';reason='同维度差异用开放对照呈现，不暗示先后关系';
  }else if(r.kind==='timeline')reason='按已提供的节点和业务线组织时间，不推断日期或新增事项';
  decisions.push({regionId:r.regionId,kind:r.kind,presentation:d.presentation||r.kind,reason});
 }
 return {content:copy,decisions};
}
function regionLayouts(content){
 if(content.layout)return [{id:'explicit',tree:content.layout,reason:'保留已明确指定的区域布局'}];
 const leaf=r=>({regionId:r.regionId});
 for(const r of content.regions)if(r.attachedTo&&(!content.regions.some(t=>t.regionId===r.attachedTo&&!t.attachedTo)||r.attachedTo===r.regionId))throw new Error('Invalid attached region '+r.regionId);
 const bundled=r=>{const notes=content.regions.filter(n=>n.attachedTo===r.regionId);return notes.length?{direction:'column',children:[leaf(r),...notes.map(leaf)]}:leaf(r);};
 const roots=content.regions.filter(r=>!r.attachedTo),all=roots.map(bundled);
 const layouts=[{id:'reading-order',tree:{direction:'column',children:all},reason:'全宽顺序阅读，优先保持原内容次序'}];
 const related=content.regions.filter(r=>['process','comparison'].includes(r.kind));
 if(related.length===2&&content.regions.indexOf(related[1])===content.regions.indexOf(related[0])+1){
  const ids=new Set(related.map(r=>r.regionId)),children=[];let grouped=false;
  for(const r of roots){if(ids.has(r.regionId)){if(!grouped){children.push({direction:'row',children:related.map(bundled)});grouped=true;}}else children.push(bundled(r));}
  layouts.push({id:'evidence-with-pair',tree:{direction:'column',children},reason:'两组关系并列比较，表格与结论保持全宽'});
 }
 if(all.length===2&&!content.regions.some(r=>['table','timeline'].includes(r.kind)))layouts.push({id:'side-by-side',tree:{direction:'row',children:all},reason:'两组内容并排，按实测文字量分配栏宽'});
 return layouts;
}
export {selectRegionForms,regionLayouts};
