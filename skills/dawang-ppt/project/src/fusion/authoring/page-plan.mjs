import {reviewComposition} from './composition-contract.mjs';
import { materializeElements } from '../scene/model.mjs';
import { hasPageDesignContract, hasSemanticContract, validateContentModel, decidedDisposition, record, list, nonempty } from './content-model.mjs';
// Structural evidence only: a binding does not prove the text is true or a diagram is understandable.
const visible = e => Array.isArray(e.bounds)&&e.bounds.length===4&&e.bounds.every(Number.isFinite)&&e.bounds[2]>0&&e.bounds[3]>0&&e.bounds[0]>=0&&e.bounds[1]>=0&&e.bounds[0]+e.bounds[2]<=1920&&e.bounds[1]+e.bounds[3]<=1080&&e.hidden!==true&&e.style?.display!=='none'&&e.style?.visibility!=='hidden'&&Number(e.style?.opacity??1)>0;
const inside=(e,z)=>Array.isArray(z?.bounds)&&e.bounds[0]>=z.bounds[0]-2&&e.bounds[1]>=z.bounds[1]-2&&e.bounds[0]+e.bounds[2]<=z.bounds[0]+z.bounds[2]+2&&e.bounds[1]+e.bounds[3]<=z.bounds[1]+z.bounds[3]+2;
// Avoid accepting 134 项 as evidence for the recorded 34 项. Semantic qualifiers still need review.
const containsFact=(text,display)=>{
 if(typeof text!=='string')return false;
 let at=text.indexOf(display);
 while(at>=0){
  const before=text[at-1]||'',after=text[at+display.length]||'';
  if(!(/^\d/.test(display)&&/[\d.,+\-≥≤<>]/.test(before))&&!(/\d$/.test(display)&&/[\d.,]/.test(after)))return true;
  at=text.indexOf(display,at+1);
 }
 return false;
};
export function reviewPagePlan(project) {
 const issues=validateContentModel(project), evidence=[], add=(kind,detail={})=>issues.push({kind,...detail});
 if(!hasPageDesignContract(project)||!hasSemanticContract(project))return {issues,evidence};
 const plan=project.contentPlan||{}, nodes=record(plan.nodes)?plan.nodes:{}, relations=new Map(list(plan.relations).filter(record).map(r=>[r.id,r])), allRefs=new Set([...Object.keys(nodes),...relations.keys()]);
 const excluded=new Set(list(plan.dispositions).filter(d=>['excluded','deferred'].includes(d?.action)&&decidedDisposition(project,d)).map(d=>d.ref));
 const hidden=new Set([...list(project.editorState?.skippedSlides),...list(project.editorState?.deletedSlides)]), covered=new Set(), plans=list(plan.slides), seenPlans=new Set();
 for(const p of plans){if(!record(p)||seenPlans.has(p.slideId)||!list(project.slides).some(s=>s.slideId===p.slideId))add('page-plan-invalid',{slideId:p?.slideId});seenPlans.add(p?.slideId);}
 const order=Array.isArray(project.editorState?.slideOrder)?new Set(project.editorState.slideOrder):null;
 for(const slide of list(project.slides).filter(s=>!hidden.has(s.slideId)&&(!order||order.has(s.slideId)))){
  const page=plans.find(p=>p?.slideId===slide.slideId), where={slideId:slide.slideId};
  for(const ref of list(slide.semanticDirtyRefs))add('bound-content-needs-reconciliation',{...where,ref});
  if(!page||!nonempty(page.readerTask)||!Array.isArray(page.requiredRefs)||!Array.isArray(page.regions)||!page.regions.length){add('page-plan-required',where);continue;}
  const elements=new Map(materializeElements(slide,project).map(e=>[e.id,e])), local=new Set(), regionIds=new Set();
  if(project.requirements?.compositionContract==='regional-composition-v1')issues.push(...reviewComposition(page,elements));
  for(const region of page.regions){
   if(!record(region)){add('page-region-invalid',where);continue;}
   const at={...where,zoneId:region.zoneId}, zone=list(page.visualDecision?.zones).find(z=>z.id===region.zoneId);
   if(!zone)add('region-zone-missing',at);
   if(regionIds.has(region.zoneId))add('page-region-duplicate',at);regionIds.add(region.zoneId);
   if(!nonempty(region.representation)||!nonempty(region.reason)||!Array.isArray(region.contentRefs)||!Array.isArray(region.relationRefs)||!Array.isArray(region.bindings))add('page-region-invalid',at);
   for(const ref of list(region.contentRefs))if(!Object.hasOwn(nodes,ref))add('region-content-missing',{...at,ref});
   for(const ref of list(region.relationRefs))if(!relations.has(ref))add('region-relation-missing',{...at,ref});
   const declared=new Set([...list(region.contentRefs),...list(region.relationRefs)]), bound=new Map();
   for(const binding of list(region.bindings)){
    if(!record(binding)||!declared.has(binding.ref)||!list(binding.elementIds).length){add('page-binding-invalid',{...at,ref:binding?.ref});continue;}
    const ref=binding.ref, rel=relations.get(ref);let valid=true;
    if(binding.edgeId&&!list(rel?.edges).some(e=>e?.id===binding.edgeId)){add('binding-edge-invalid',{...at,ref,edgeId:binding.edgeId});valid=false;}
    if(binding.rowId&&!list(rel?.rows).some(r=>r?.id===binding.rowId)){add('binding-row-invalid',{...at,ref,rowId:binding.rowId});valid=false;}
    const held=[];
    for(const id of binding.elementIds){const e=elements.get(id);if(!e){add('binding-element-missing',{...at,ref,elementId:id});valid=false;}else if(!visible(e)){add('binding-element-hidden',{...at,ref,elementId:id});valid=false;}else if(zone&&!inside(e,zone)){add('binding-outside-zone',{...at,ref,elementId:id});valid=false;}else held.push(e);}
    if(nodes[ref]&&!held.some(e=>e.type==='text'&&nonempty(e.text)||nodes[ref].type==='media'&&e.type==='image')){add('binding-content-not-visible',{...at,ref});valid=false;}
    const display=nodes[ref]?.facts?.display;
    if(display&&!held.some(e=>e.type==='text'&&containsFact(e.text,display))){add('bound-fact-mismatch',{...at,ref,expected:display});valid=false;}
    if(valid){if(!bound.has(ref))bound.set(ref,[]);bound.get(ref).push(binding);}
   }
   for(const ref of declared){
    const bindings=bound.get(ref)||[], rel=relations.get(ref);let valid=bindings.length>0;
    if(!valid)add('region-binding-missing',{...at,ref});
    if(rel){
     for(const edge of list(rel.edges))if(!bindings.some(b=>b.edgeId===edge?.id)){add('relation-edge-unbound',{...at,ref,edgeId:edge?.id});valid=false;}
     for(const row of list(rel.rows))if(!bindings.some(b=>b.rowId===row?.id)){add('relation-row-unbound',{...at,ref,rowId:row?.id});valid=false;}
     for(const member of list(rel.members))if(!bound.has(member)){add('relation-member-unbound',{...at,ref,member});valid=false;}
    }
    if(valid){covered.add(ref);local.add(ref);}
   }
   evidence.push({...at,composition:page.composition,module:region.module,typography:region.typography,hierarchy:region.hierarchy,designReference:region.designReference,frameElementId:region.frameElementId,padding:region.padding,readerTask:page.readerTask,representation:region.representation,reason:region.reason,contentRefs:list(region.contentRefs),relationRefs:list(region.relationRefs),bindings:list(region.bindings)});
  }
  for(const ref of page.requiredRefs)if(!allRefs.has(ref)||!local.has(ref))add('page-required-unbound',{...where,ref});
 }
 for(const [ref,node] of [...Object.entries(nodes),...relations.entries()])if(node?.importance==='required'&&!excluded.has(ref)&&!covered.has(ref))add('required-content-unbound',{ref});
 return {issues,evidence};
}

// Adds inspectable regional tasks to the existing independent-review packet. No model verdict is fabricated here.
export function pageDesignClaims(project) {
 if(!hasPageDesignContract(project))return [];
 const plan=project.contentPlan||{};
 return reviewPagePlan(project).evidence.map(region=>({
  id:`page-design#${encodeURIComponent(region.slideId)}/${encodeURIComponent(region.zoneId)}`,status:'visual',
  rule:'本区域必须完成阅读任务并保留所列事实与关系；按最终截图逐项验证，不以绑定或组件存在代替判断。',
  ...region,
  nodes:region.contentRefs.map(ref=>({id:ref,...plan.nodes?.[ref]})),
  relations:region.relationRefs.map(ref=>list(plan.relations).find(r=>r?.id===ref)),
  sources:list(project.sources?.entries).filter(source=>[...region.contentRefs.map(ref=>plan.nodes?.[ref]),...region.relationRefs.map(ref=>list(plan.relations).find(r=>r?.id===ref))].some(item=>list(item?.sourceRefs).includes(source?.sourceId)))
 }));
}
