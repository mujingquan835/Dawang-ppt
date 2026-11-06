// Independent pre-layout content snapshot. Keep its JSON outside the authored deck too.
const canonical=v=>JSON.stringify(normalize(v));
function normalize(v){if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));return v;}
export function createContentBaseline({id,brief,nodes,relations,gaps=[],dispositions=[]}) {
 if(!id||!brief||!nodes||!Array.isArray(relations))throw new TypeError('baseline id, brief, nodes and relations required');
 const snapshot=structuredClone({brief,nodes,relations,gaps,dispositions});
 for(const [ref,item] of [...Object.entries(nodes),...relations.map(r=>[r.id,r])]){
  if(!item.sourceLocations?.length||item.sourceLocations.some(s=>!item.sourceRefs?.includes(s.sourceId)||!s.locator?.trim()||!s.excerpt?.trim()))throw new TypeError('precise sourceLocations required: '+ref);
 }
 return {version:1,id,origin:'source-before-layout',snapshot};
}
export function validateContentBaseline(project,externalBaseline) {
 if(project.requirements?.contentBaselineContract!=='source-baseline-v1')return [];
 const b=externalBaseline||project.contentPlan?.baseline,issues=[];
 try{if(b?.version!==1||b.origin!=='source-before-layout')throw Error();createContentBaseline({id:b.id,...b.snapshot});}catch{return [{kind:'content-baseline-invalid'}];}
 if(externalBaseline&&canonical(externalBaseline)!==canonical(project.contentPlan?.baseline))issues.push({kind:'content-baseline-replaced'});
 for(const key of ['brief','nodes','relations','gaps','dispositions'])if(canonical(b.snapshot[key])!==canonical(project.contentPlan?.[key]))issues.push({kind:'content-baseline-drift',field:key});
 return issues;
}
