import {text,shape,line,uniqueNodes} from './primitives.mjs';
// Open rows expose labels and evidence directly; no fixed-height card grid.
function layoutAdaptiveRelation(o,s) {
  const nodes=o.data.nodes||[];uniqueNodes(nodes);
  if(!nodes.length) throw new Error('Relationship nodes required');
  const [x,y,w,h]=o.bounds, vertical=o.data.direction==='vertical';
  if(!vertical) return null;
  const gap=Math.min(36,h/nodes.length*0.18),rh=(h-gap*(nodes.length-1))/nodes.length;
  const boxes=nodes.map((_,i)=>[x+36,y+i*(rh+gap),w-36,rh]);
  const es=nodes.flatMap((node,i)=>{
    const b=boxes[i], cy=b[1]+b[3]/2;
    return [shape(o,`node/${node.nodeId}/shape`,b,s,{nodeId:node.nodeId,style:{fill:'transparent',radius:0}}),
      text(o,`node/${node.nodeId}/label`,node.label,[b[0]+22,cy-25,(w-80)*(node.detail?0.32:1),50],s,{nodeId:node.nodeId,contentRef:node.contentRef,dataPath:['nodes',i,'label'],style:{fontSize:32,lineHeight:1.12,color:s.palette.ink}}),
      ...node.detail?[text(o,`node/${node.nodeId}/detail`,node.detail,[b[0]+w*0.36,cy-23,w*0.59,46],s,{nodeId:node.nodeId,dataPath:['nodes',i,'detail'],style:{fontSize:28,lineHeight:1.12,color:s.palette.muted}})]:[],
      line(o,`node/${node.nodeId}/rule`,[b[0],b[1]+b[3]],[x+w,b[1]+b[3]],s,{style:{stroke:s.palette.line,strokeWidth:1}})];
  });
  const edges=o.relationshipPolicy==='explicit' ? o.relationships||[] : o.kind==='comparison'?[]:nodes.slice(1).map((n,i)=>({relationshipId:nodes[i].nodeId+'-'+n.nodeId,from:nodes[i].nodeId,to:n.nodeId}));
  const links=edges.map(r=>{
    const a=nodes.findIndex(n=>n.nodeId===r.from),b=nodes.findIndex(n=>n.nodeId===r.to);
    if(a<0||b<0) throw new Error('dangling relationship '+r.relationshipId);
    const moved=id=>o.overrides?.[`${o.objectId}/node/${id}/shape`]?.bounds;
    const ab=moved(r.from)||boxes[a],bb=moved(r.to)||boxes[b];
    return line(o,'link/'+r.relationshipId,[ab[0]-20,ab[1]+ab[3]/2],[bb[0]-20,bb[1]+bb[3]/2],s,{relationshipId:r.relationshipId,fromNodeId:r.from,toNodeId:r.to,endArrow:'triangle'});
  });
  // Node moves retain anchored links and move unmodified text with their node.
  nodes.forEach((n,i)=>{
    const moved=o.overrides?.[`${o.objectId}/node/${n.nodeId}/shape`]?.bounds;
    if(moved) for(const e of es.filter(e=>e.nodeId===n.nodeId&&e.type==='text')) if(!o.overrides?.[e.id]?.bounds) e.bounds=[moved[0]+(e.bounds[0]-boxes[i][0]),moved[1]+(e.bounds[1]-boxes[i][1]),e.bounds[2],e.bounds[3]];
  });
  return [...links,...es];
}
function layoutAdaptiveTimeline(o,s) {
  if(o.data.direction!=='vertical'||o.data.stages?.length) return null;
  const nodes=o.data.nodes||[];uniqueNodes(nodes);
  if(nodes.length<2) throw new Error('Timeline requires at least two nodes');
  const [x,y,w,h]=o.bounds, row=h/nodes.length,ax=x+w*.21;
  const es=[line(o,'axis',[ax,y+20],[ax,y+h-20],s,{style:{stroke:s.palette.line,strokeWidth:3}})];
  nodes.forEach((n,i)=>{
    const cy=y+(i+.5)*row;
    es.push(shape(o,n.nodeId+'/dot',[ax-8,cy-8,16,16],s,{shape:'ellipse',style:{fill:s.palette.accent,radius:999}}));
    if(n.date) es.push(text(o,n.nodeId+'/date',n.date,[x,cy-20,w*.18,40],s,{nodeId:n.nodeId,dataPath:['nodes',i,'date'],style:{fontSize:28,color:s.palette.accent,lineHeight:1.12}}));
    es.push(text(o,n.nodeId+'/label',n.label,[ax+30,cy-23,w*.31,46],s,{nodeId:n.nodeId,contentRef:n.contentRef,dataPath:['nodes',i,'label'],style:{fontSize:32,color:s.palette.ink,lineHeight:1.12}}));
    if(n.detail) es.push(text(o,n.nodeId+'/detail',n.detail,[x+w*.58,cy-23,w*.42,46],s,{nodeId:n.nodeId,dataPath:['nodes',i,'detail'],style:{fontSize:28,color:s.palette.muted,lineHeight:1.12}}));
  });
  return es;
}
export {layoutAdaptiveRelation,layoutAdaptiveTimeline};

function layoutMeasuredRelation(o,s){
 const nodes=o.data.nodes||[];uniqueNodes(nodes);
 const fitted=o.data.measuredNodes||[];
 if(nodes.some(n=>!fitted.some(m=>m.nodeId===n.nodeId)))throw new Error('Measured node missing; replan before structural edits');
 const [x,y,w]=o.bounds;
 const extent=Math.max(...fitted.map(m=>m.bounds[0]+m.bounds[2]));
 const sx=w/extent;
 const boxes=fitted.map(m=>[x+m.bounds[0]*sx,y+m.bounds[1],m.bounds[2]*sx,m.bounds[3]]);
 const elements=nodes.flatMap((n,i)=>{
  const m=fitted.find(m=>m.nodeId===n.nodeId),b=boxes[fitted.indexOf(m)];
  return [shape(o,`node/${n.nodeId}/shape`,b,s,{nodeId:n.nodeId,style:{fill:'transparent',stroke:s.palette.line,strokeWidth:1,radius:0}}),
   text(o,`node/${n.nodeId}/label`,n.label,[b[0],b[1],b[2],m.labelHeight],s,{nodeId:n.nodeId,contentRef:n.contentRef,dataPath:['nodes',i,'label'],style:{fontSize:32,lineHeight:1.16,fontWeight:600,color:s.palette.ink}}),
   ...n.detail?[text(o,`node/${n.nodeId}/detail`,n.detail,[b[0],b[1]+m.labelHeight+12,b[2],m.detailHeight],s,{nodeId:n.nodeId,dataPath:['nodes',i,'detail'],style:{fontSize:o.data.fontSize,lineHeight:1.16,color:s.palette.muted}})]:[]];
 });
 for(const [i,n] of nodes.entries()){
  const moved=o.overrides?.[`${o.objectId}/node/${n.nodeId}/shape`]?.bounds;
  if(moved)for(const e of elements.filter(e=>e.nodeId===n.nodeId&&e.type==='text'))if(!o.overrides?.[e.id]?.bounds)e.bounds=[moved[0]+e.bounds[0]-boxes[i][0],moved[1]+e.bounds[1]-boxes[i][1],moved[2],e.bounds[3]];
 }
 const edges=o.relationshipPolicy==='explicit'?o.relationships:o.kind==='comparison'?[]:nodes.slice(1).map((n,i)=>({relationshipId:nodes[i].nodeId+'-'+n.nodeId,from:nodes[i].nodeId,to:n.nodeId}));
 for(const edge of edges){
  const a=nodes.findIndex(n=>n.nodeId===edge.from),b=nodes.findIndex(n=>n.nodeId===edge.to);if(a<0||b<0)throw new Error('dangling relationship');
  const aa=o.overrides?.[`${o.objectId}/node/${edge.from}/shape`]?.bounds||boxes[a],bb=o.overrides?.[`${o.objectId}/node/${edge.to}/shape`]?.bounds||boxes[b];
  elements.push(line(o,'link/'+edge.relationshipId,[aa[0]+aa[2]+4,aa[1]+aa[3]/2],[bb[0]-8,bb[1]+bb[3]/2],s,{relationshipId:edge.relationshipId,fromNodeId:edge.from,toNodeId:edge.to,endArrow:'triangle',style:{stroke:s.palette.accent,strokeWidth:2}}));
 }
 return elements;
}
export {layoutMeasuredRelation};
