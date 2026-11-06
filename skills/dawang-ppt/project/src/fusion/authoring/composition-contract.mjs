// Numeric composition constraints complement, never replace, visual review.
export function reviewComposition(page,elements) {
 const issues=[],add=(kind,detail={})=>issues.push({kind,slideId:page.slideId,...detail});
 const c=page.composition,zones=page.visualDecision?.zones||[],regions=page.regions||[];
 if(!c||!Array.isArray(c.alignments)||!Array.isArray(c.gaps)){add('composition-required');return issues;}
 const z=new Map(zones.map(z=>[z.id,z]));
 for(const r of regions){
  if(!r||typeof r!=='object'){add('region-design-required');continue;}
  if(!r.module?.name||!r.module?.variant||!r.typography?.title||!r.typography?.body||!(r.typography.title>=r.typography.body)||!r.designReference?.source||!r.designReference?.principle)add('region-design-required',{zoneId:r.zoneId});
  const bound=z.get(r.zoneId)?.bounds;
  if(!Array.isArray(bound)||bound.length!==4||!bound.every(Number.isFinite)||bound[2]<=0||bound[3]<=0){add('composition-zone-invalid',{zoneId:r.zoneId});continue;}
  if(!['primary','secondary','support'].includes(r.hierarchy))add('region-hierarchy-required',{zoneId:r.zoneId});
  if(!Number.isFinite(r.padding)||r.padding<0){add('region-padding-invalid',{zoneId:r.zoneId});continue;}
  if(r.frameElementId){const frame=elements.get(r.frameElementId);if(!frame||frame.type!=='shape'||frame.hidden||frame.style?.display==='none'||frame.style?.visibility==='hidden'||frame.style?.opacity===0||!Array.isArray(frame.bounds)||frame.bounds.some((n,i)=>Math.abs(n-bound[i])>2))add('region-frame-mismatch',{zoneId:r.zoneId});}
  const ids=new Set((r.bindings||[]).flatMap(b=>b.elementIds||[]));
  for(const id of ids){const e=elements.get(id);if(!e)continue;const [x,y,w,h]=e.bounds;if(x<bound[0]+r.padding-2||y<bound[1]+r.padding-2||x+w>bound[0]+bound[2]-r.padding+2||y+h>bound[1]+bound[3]-r.padding+2)add('region-padding-violated',{zoneId:r.zoneId,elementId:id});}
 }
 if(regions.filter(r=>r?.hierarchy==='primary').length!==1)add('composition-primary-required');
 const edges={left:b=>b[0],right:b=>b[0]+b[2],top:b=>b[1],bottom:b=>b[1]+b[3]};
 for(const a of c.alignments){
  if(!a||typeof a!=='object'){add('alignment-invalid');continue;}
  const tol=a.tolerance??2;
  if(!edges[a.edge]||!Array.isArray(a.zones)||a.zones.length<2||new Set(a.zones).size!==a.zones.length||a.zones.some(id=>!z.has(id))||!Number.isFinite(tol)||tol<0||tol>8){add('alignment-invalid');continue;}
  const actual=a.zones.map(id=>{const r=regions.find(r=>r?.zoneId===id);const frame=elements.get(r?.frameElementId);if(!frame){add('alignment-frame-required',{zoneId:id});return z.get(id).bounds;}return frame.bounds;});
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
