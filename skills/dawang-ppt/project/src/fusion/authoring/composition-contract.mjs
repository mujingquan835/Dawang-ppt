// Numeric composition constraints complement, never replace, visual review.
const envelopeOf = (ids, elements) => {
 const held = ids.map(id => elements.get(id)).filter(e => e && !e.hidden && e.style?.display !== 'none' && e.style?.visibility !== 'hidden' && e.style?.opacity !== 0 && Array.isArray(e.bounds) && e.bounds.length === 4);
 if (!held.length) return null;
 const x0 = Math.min(...held.map(e => e.bounds[0])), y0 = Math.min(...held.map(e => e.bounds[1]));
 const x1 = Math.max(...held.map(e => e.bounds[0] + e.bounds[2])), y1 = Math.max(...held.map(e => e.bounds[1] + e.bounds[3]));
 return [x0, y0, x1 - x0, y1 - y0];
};
export function reviewComposition(page,elements) {
 const issues=[],add=(kind,detail={})=>issues.push({kind,slideId:page.slideId,...detail});
 const c=page.composition,zones=page.visualDecision?.zones||[],regions=page.regions||[];
 if(!c||!Array.isArray(c.alignments)||!Array.isArray(c.gaps)){add('composition-required');return issues;}
 const z=new Map(zones.map(z=>[z.id,z]));
 const pageRoleSizes=page.typographyRoles&&typeof page.typographyRoles==='object'?Object.values(page.typographyRoles).map(v=>typeof v==='number'?v:v?.fontSize).filter(Number.isFinite):null;
 for(const r of regions){
  if(!r||typeof r!=='object'){add('region-design-required');continue;}
  if(!r.module?.name||!r.module?.variant||!r.typography?.title||!r.typography?.body||!(r.typography.title>=r.typography.body)||!r.designReference?.source||!r.designReference?.principle)add('region-design-required',{zoneId:r.zoneId});
  const bound=z.get(r.zoneId)?.bounds;
  if(!Array.isArray(bound)||bound.length!==4||!bound.every(Number.isFinite)||bound[2]<=0||bound[3]<=0){add('composition-zone-invalid',{zoneId:r.zoneId});continue;}
  if(!['primary','secondary','support'].includes(r.hierarchy))add('region-hierarchy-required',{zoneId:r.zoneId});
  if(!Number.isFinite(r.padding)||r.padding<0){add('region-padding-invalid',{zoneId:r.zoneId});continue;}
  if(r.frameElementId){const frame=elements.get(r.frameElementId);if(!frame||frame.type!=='shape'||frame.hidden||frame.style?.display==='none'||frame.style?.visibility==='hidden'||frame.style?.opacity===0||!Array.isArray(frame.bounds)||frame.bounds.some((n,i)=>Math.abs(n-bound[i])>2))add('region-frame-mismatch',{zoneId:r.zoneId});}
  const ids=new Set((r.bindings||[]).flatMap(b=>b.elementIds||[]));
  const allowedSizes=pageRoleSizes||r.typography?.strict?new Set([...(pageRoleSizes||[]),...Object.values(r.typography||{}).filter(Number.isFinite),...(Array.isArray(r.typography?.allowedSizes)?r.typography.allowedSizes:[])]):null;
  for(const id of ids){
   const e=elements.get(id);if(!e)continue;
   const [x,y,w,h]=e.bounds;
   if(x<bound[0]+r.padding-2||y<bound[1]+r.padding-2||x+w>bound[0]+bound[2]-r.padding+2||y+h>bound[1]+bound[3]-r.padding+2)add('region-padding-violated',{zoneId:r.zoneId,elementId:id});
   if(allowedSizes&&e.type==='text'){
    const sizes=[e.style?.fontSize,...(e.runs||[]).map(run=>run.style?.fontSize)].filter(Number.isFinite);
    if(!sizes.length||sizes.some(s=>!allowedSizes.has(s)))add('region-typography-mismatch',{zoneId:r.zoneId,elementId:id,sizes});
   }
  }
 }
 if(regions.filter(r=>r?.hierarchy==='primary').length!==1)add('composition-primary-required');
 const edges={left:b=>b[0],right:b=>b[0]+b[2],top:b=>b[1],bottom:b=>b[1]+b[3]};
 for(const a of c.alignments){
  if(!a||typeof a!=='object'){add('alignment-invalid');continue;}
  const tol=a.tolerance??2;
  if(!edges[a.edge]||!Array.isArray(a.zones)||a.zones.length<2||new Set(a.zones).size!==a.zones.length||a.zones.some(id=>!z.has(id))||!Number.isFinite(tol)||tol<0||tol>8){add('alignment-invalid');continue;}
  const actual=a.zones.map(id=>{
   const r=regions.find(r=>r?.zoneId===id);
   if(r?.frameElementId){const frame=elements.get(r.frameElementId);if(!frame){add('alignment-frame-required',{zoneId:id});return z.get(id).bounds;}return frame.bounds;}
   if(r?.openGroup||Array.isArray(r?.anchorElementIds)){
    const env=envelopeOf(r.anchorElementIds||(r.bindings||[]).flatMap(b=>b.elementIds||[]),elements);
    if(env)return env;
   }
   add('alignment-frame-required',{zoneId:id});return z.get(id).bounds;
  });
  const values=actual.map(bounds=>edges[a.edge](bounds));if(Math.max(...values)-Math.min(...values)>tol)add('alignment-violated',{edge:a.edge,zones:a.zones});
 }
 for(const g of c.gaps){
  if(!g||typeof g!=='object'){add('composition-gap-invalid');continue;}
  const a=z.get(g.from)?.bounds,b=z.get(g.to)?.bounds;
  if(!a||!b||!['horizontal','vertical'].includes(g.axis)||!Number.isFinite(g.min)||g.min<0){add('composition-gap-invalid');continue;}
  const n=g.axis==='horizontal'?0:1;if(b[n]-a[n]-a[n+2]<g.min)add('composition-gap-violated',{from:g.from,to:g.to});
 }
 return issues;
}
