import {text,shape,line,uniqueNodes} from './primitives.mjs';
import {bodyPx} from '../styles/registry.mjs';
function timelineLanes(d){
 return d.lanes||[{laneId:'events',label:'',events:d.nodes.map(n=>({nodeId:n.nodeId,text:n.date?n.label:n.detail||'',detail:n.date?n.detail:undefined,contentRef:n.date?n.contentRef:undefined}))}];
}
async function fitMeasuredTimeline(o,s,measurer){
 const d=o.data,nodes=d.nodes||[];uniqueNodes(nodes);
 if(nodes.length<2)throw new Error('Timeline requires at least two nodes');
 if((d.direction&&d.direction!=='horizontal')||(d.distribution&&d.distribution!=='ordinal')||d.stages?.length)throw new Error('显式时间轴方向、按日期比例或阶段带尚未接入多区域实测；保留材料并选择原时间轴路径或调整布局');
 const lanes=timelineLanes(d);
 if(lanes.some(l=>!l.laneId)||new Set(lanes.map(l=>l.laneId)).size!==lanes.length)throw new Error('Stable unique lane IDs required');
 for(const l of lanes)if(l.events.some(e=>!nodes.some(n=>n.nodeId===e.nodeId))||new Set(l.events.map(e=>e.nodeId)).size!==l.events.length)throw new Error('Timeline events require unique existing node references');
 const size=bodyPx(s),w=o.bounds[2],hasLabels=lanes.some(l=>l.label);
 const measure=(values,width,bold=false)=>measurer.texts(values.map((t,i)=>({id:String(i),type:'text',text:t,bounds:[0,0,width,0],style:{fontSize:size,lineHeight:1.16,fontWeight:bold?600:400}})),s);
 const labelWidths=await measure([d.laneHeading||'',...lanes.map(l=>l.label)],w,true);
 const left=hasLabels?Math.min(w*.2,Math.max(105,...labelWidths.map(m=>m.naturalWidth+24))):0;
 const wants=[];
 for(const n of nodes){const ms=await measure([n.date||n.label,...lanes.flatMap(l=>l.events.filter(e=>e.nodeId===n.nodeId).flatMap(e=>[e.text,e.detail||'']))],w);wants.push(Math.max(80,...ms.map(m=>Math.sqrt(m.naturalWidth*Math.max(m.height,1))*2)));}
 const total=wants.reduce((a,b)=>a+b,0),widths=wants.map(v=>v/total*(w-left));
 const header=[],stageHeights={};
 for(const [i,n] of nodes.entries()){
  const main=(await measure([n.date||n.label],widths[i]-24,true))[0].height;
  const label=d.lanes&&n.date?(await measure([n.label],widths[i]-24,true))[0].height:0;
  const detail=d.lanes&&n.detail?(await measure([n.detail],widths[i]-24))[0].height:0;
  stageHeights[n.nodeId]={main,label,detail};header.push({height:main+(label?label+4:0)+(detail?detail+4:0)});
 }
 if(hasLabels)header.push((await measure([d.laneHeading||''],left-18,true))[0]);
 const headerH=Math.max(...header.map(m=>m.height))+24,rows=[],cellHeights={};
 for(const l of lanes){
  let rh=hasLabels?(await measure([l.label],left-18,true))[0].height:0;
  for(const [i,n] of nodes.entries()){
   const e=l.events.find(e=>e.nodeId===n.nodeId);
   const primary=(await measure([e?.text||''],widths[i]-24,!d.lanes&&!!n.date))[0].height;
   const detail=e?.detail?(await measure([e.detail],widths[i]-24))[0].height:0;
   cellHeights[l.laneId+'/'+n.nodeId]={primary,detail};rh=Math.max(rh,primary+(detail?8+detail:0));
  }rows.push(rh+30);
 }
 d.measuredTimeline={left,widths,headerH,rows,cellHeights,stageHeights};o.bounds[3]=headerH+rows.reduce((a,b)=>a+b,0);o.layoutVersion=4;
}
function layoutMeasuredTimeline(o,s){
 const d=o.data,m=d.measuredTimeline;if(!m)throw new Error('Timeline must be measured before rendering');
 const [x,y,w,h]=o.bounds,baseH=m.headerH+m.rows.reduce((a,b)=>a+b,0),sx=w/(m.left+m.widths.reduce((a,b)=>a+b,0)),sy=h/baseH,size=bodyPx(s);
 const nodes=d.nodes,lanes=timelineLanes(d),xs=[x+m.left*sx];m.widths.forEach(v=>xs.push(xs.at(-1)+v*sx));
 const axisY=y+(m.headerH-8)*sy,es=[line(o,'axis',[xs[0]+12,axisY],[x+w-12,axisY],s,{style:{stroke:s.palette.line,strokeWidth:2}})];
 if(d.laneHeading)es.push(text(o,'lane-heading',d.laneHeading,[x,y,m.left*sx-18,(m.headerH-20)*sy],s,{role:'label',contentRef:d.laneHeadingRef,dataPath:['laneHeading'],style:{fontSize:size,fontWeight:600,color:s.palette.muted,lineHeight:1.16}}));
 nodes.forEach((n,i)=>{
  const stage=m.stageHeights[n.nodeId];let stageY=y;
  es.push(text(o,`node/${n.nodeId}/${n.date?'date':'label'}`,n.date||n.label,[xs[i]+12,y,(xs[i+1]-xs[i])-24,stage.main+2],s,{nodeId:n.nodeId,contentRef:n.date?undefined:n.contentRef,dataPath:['nodes',i,n.date?'date':'label'],role:'label',style:{fontSize:size,fontWeight:600,color:s.palette.accent,lineHeight:1.16}}));
  stageY+=stage.main+4;
  if(stage.label){es.push(text(o,`node/${n.nodeId}/label`,n.label,[xs[i]+12,stageY,xs[i+1]-xs[i]-24,stage.label+2],s,{nodeId:n.nodeId,role:'label',contentRef:n.contentRef,dataPath:['nodes',i,'label'],style:{fontSize:size,fontWeight:600,color:s.palette.ink,lineHeight:1.16}}));stageY+=stage.label+4;}
  if(stage.detail)es.push(text(o,`node/${n.nodeId}/detail`,n.detail,[xs[i]+12,stageY,xs[i+1]-xs[i]-24,stage.detail+2],s,{nodeId:n.nodeId,role:'body',dataPath:['nodes',i,'detail'],style:{fontSize:size,color:s.palette.muted,lineHeight:1.16}}));
  es.push(shape(o,`node/${n.nodeId}/dot`,[xs[i]+12,axisY-5,10,10],s,{shape:'ellipse',style:{fill:s.palette.accent,radius:999}}));
 });
 let yy=y+m.headerH*sy;
 lanes.forEach((lane,r)=>{
  const rh=m.rows[r]*sy;
  if(lane.label)es.push(text(o,`lane/${lane.laneId}/label`,lane.label,[x,yy+12,m.left*sx-18,rh-24],s,{role:'label',contentRef:lane.contentRef,dataPath:['lanes',r,'label'],style:{fontSize:size,fontWeight:600,color:s.palette.ink,lineHeight:1.16}}));
  lane.events.forEach((event,j)=>{
   const i=nodes.findIndex(n=>n.nodeId===event.nodeId),cm=m.cellHeights[lane.laneId+'/'+event.nodeId];
   es.push(text(o,`lane/${lane.laneId}/event/${event.nodeId}`,event.text,[xs[i]+12,yy+12,xs[i+1]-xs[i]-24,cm.primary+2],s,{nodeId:event.nodeId,role:'body',contentRef:event.contentRef,dataPath:d.lanes?['lanes',r,'events',j,'text']:['nodes',i,nodes[i].date?'label':'detail'],style:{fontSize:size,fontWeight:!d.lanes&&nodes[i].date?600:400,color:event.text==='—'?s.palette.muted:s.palette.body||s.palette.ink,lineHeight:1.16}}));
   if(event.detail)es.push(text(o,`lane/${lane.laneId}/event/${event.nodeId}/detail`,event.detail,[xs[i]+12,yy+12+cm.primary+8,xs[i+1]-xs[i]-24,cm.detail+2],s,{nodeId:event.nodeId,role:'body',dataPath:d.lanes?['lanes',r,'events',j,'detail']:['nodes',i,'detail'],style:{fontSize:size,color:s.palette.muted,lineHeight:1.16}}));
  });
  es.push(line(o,`lane/${lane.laneId}/rule`,[x,yy+rh],[x+w,yy+rh],s,{style:{stroke:s.palette.line,strokeWidth:1}}));yy+=rh;
 });return es;
}
export {fitMeasuredTimeline,layoutMeasuredTimeline};
