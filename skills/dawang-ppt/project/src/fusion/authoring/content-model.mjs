// Versioned, opt-in semantic contract. Validation never infers facts or mutates a saved deck.
export const SEMANTIC_CONTRACT = 'content-relations-v1';
export const PAGE_DESIGN_CONTRACT = 'page-design-v1';
export const record = x => !!x && typeof x === 'object' && !Array.isArray(x);
export const list = x => Array.isArray(x) ? x : [];
export const nonempty = x => typeof x === 'string' && x.trim().length > 0;
export const hasSemanticContract = p => p?.requirements?.semanticContract === SEMANTIC_CONTRACT;
export const hasPageDesignContract = p => p?.requirements?.pageDesignContract === PAGE_DESIGN_CONTRACT;
const types = new Set(['statement','metric','person','stage','action','category','media']);
const statuses = new Set(['confirmed','user-provided-unverified','estimated','planned','missing']);
const kinds = new Set(['sequence','assignment','classification','comparison','composition','conversion','cycle','branch','support','custom']);
export function decidedDisposition(project, disposition) {
 return !!list(project.requirements?.userDecisions).find(d => d?.id === disposition?.decisionRef && nonempty(d.quote) && nonempty(d.decision) && list(d.covers).includes('content#' + (disposition.ref || disposition.id)));
}
export function validateContentModel(project) {
 const issues=[], add=(kind,detail={})=>issues.push({kind,...detail}), req=project?.requirements||{};
 if (!Object.hasOwn(req,'semanticContract') && !Object.hasOwn(req,'pageDesignContract')) return issues;
 if (req.semanticContract !== SEMANTIC_CONTRACT) add(Object.hasOwn(req,'semanticContract')?'semantic-contract-version':'semantic-contract-required');
 if (Object.hasOwn(req,'pageDesignContract') && req.pageDesignContract !== PAGE_DESIGN_CONTRACT) add('page-design-contract-version');
 if (!hasSemanticContract(project)) return issues;
 if (project.version === 2 && !Object.hasOwn(req,'pageDesignContract')) add('page-design-contract-required');
 const plan=project.contentPlan||{}, nodes=record(plan.nodes)?plan.nodes:{}, sources=new Set(list(project.sources?.entries).map(s=>s?.sourceId));
 if (!record(plan.brief) || !nonempty(plan.brief.purpose) || !nonempty(plan.brief.audience) || !['proposal','report','review','training','other'].includes(plan.brief.scenario) || !['part','full'].includes(plan.brief.scope)) add('content-brief-invalid');
 if (!record(plan.nodes) || !Object.keys(nodes).length) add('content-nodes-required');
 for (const key of ['relations','gaps','dispositions']) if (!Array.isArray(plan[key])) add('content-list-required',{field:key});
 const sourceCheck=(item,ref)=>{if(!Array.isArray(item.sourceRefs)||!item.sourceRefs.length||item.sourceRefs.some(s=>!sources.has(s))) add('content-source-invalid',{ref});};
 const importance=(item,ref)=>{if(!['required','optional'].includes(item.importance))add('content-importance-invalid',{ref});};
 for(const [ref,node] of Object.entries(nodes)) {
  if(!record(node)){add('content-node-invalid',{ref});continue;}
  if(!nonempty(ref)||!types.has(node.type)||!nonempty(node.text)||!statuses.has(node.status))add('content-node-invalid',{ref});
  sourceCheck(node,ref);importance(node,ref);
  if(node.type==='metric' && (!record(node.facts)||!nonempty(node.facts.display)||!nonempty(node.facts.unit)||!['target','actual','estimated','planned'].includes(node.facts.role)))add('content-facts-invalid',{ref});
 }
 const refs=new Set(Object.keys(nodes));
 for(const rel of list(plan.relations)) {
  if(!record(rel)){add('content-relation-invalid');continue;}
  if(!nonempty(rel.id)||refs.has(rel.id))add('content-id-duplicate',{ref:rel.id});
  refs.add(rel.id);sourceCheck(rel,rel.id);importance(rel,rel.id);
  const members=list(rel.members);
  if(!kinds.has(rel.kind)||members.length<2||new Set(members).size!==members.length||members.some(n=>!Object.hasOwn(nodes,n))||(rel.kind==='custom'&&!nonempty(rel.description))) add('content-relation-invalid',{ref:rel.id});
  if (rel.edges !== undefined && !Array.isArray(rel.edges) || rel.rows !== undefined && !Array.isArray(rel.rows)) add('relation-structure-invalid',{ref:rel.id});
  const edges=list(rel.edges), edgeIds=new Set();
  for(const edge of edges){
   if(!record(edge)||!nonempty(edge.id)||edgeIds.has(edge.id)||!members.includes(edge.from)||!members.includes(edge.to))add('relation-edge-invalid',{ref:rel.id});
   edgeIds.add(edge?.id);
  }
  if(['sequence','conversion','cycle','branch'].includes(rel.kind)&&!edges.length)add('relation-edges-required',{ref:rel.id});
  if(['sequence','conversion'].includes(rel.kind)&&members.slice(1).some((to,i)=>!edges.some(e=>e?.from===members[i]&&e?.to===to)))add('relation-sequence-incomplete',{ref:rel.id});
  if(rel.kind==='branch'&&!members.some(n=>edges.filter(e=>e?.from===n&&nonempty(e.condition)).length>=2))add('relation-branch-conditions',{ref:rel.id});
  if(rel.kind==='cycle'&&members.length){
   // Every member must reach every other member: an isolated loop is not a complete cycle.
   const connected=members.every(start=>{const seen=new Set([start]), queue=[start];for(let i=0;i<queue.length;i++)for(const e of edges)if(e?.from===queue[i]&&members.includes(e.to)&&!seen.has(e.to)){seen.add(e.to);queue.push(e.to);}return members.every(n=>seen.has(n));});
   if(!connected)add('relation-cycle-open',{ref:rel.id});
  }
  if(['assignment','classification','comparison','composition','support','custom'].includes(rel.kind)&&!edges.length&&!list(rel.rows).length)add('relation-structure-required',{ref:rel.id});
  const rowIds=new Set();
  for(const row of list(rel.rows)){if(!record(row)||!nonempty(row.id)||rowIds.has(row.id)||!list(row.members).length||row.members.some(n=>!members.includes(n)))add('relation-row-invalid',{ref:rel.id});rowIds.add(row?.id);}
 }
 const disposed=new Set();
 for(const d of list(plan.dispositions)){
  if(!record(d)||!refs.has(d.ref)||disposed.has(d.ref)||!['included','merged','deferred','excluded'].includes(d.action)||!nonempty(d.reason)){add('content-disposition-invalid',{ref:d?.ref});continue;}
  disposed.add(d.ref);
  const item=nodes[d.ref]||list(plan.relations).find(r=>r?.id===d.ref);
  if(['deferred','excluded'].includes(d.action)&&item?.importance==='required'&&!decidedDisposition(project,d))add('content-decision-required',{ref:d.ref});
 }
 const gapIds=new Set();
 for(const g of list(plan.gaps)){
  if(!record(g)||!nonempty(g.id)||gapIds.has(g.id)||!list(g.affectedRefs).length||g.affectedRefs.some(r=>!refs.has(r))||!nonempty(g.missing)||!nonempty(g.impact)||!['pending','placeholder','user-accepted','resolved'].includes(g.resolution))add('content-gap-invalid',{ref:g?.id});
  gapIds.add(g?.id);
  if(g?.resolution==='user-accepted'&&!decidedDisposition(project,g))add('content-decision-required',{ref:g.id});
 }
 return issues;
}
