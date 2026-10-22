#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const unavailable='unavailable';
function requireValue(condition,message){if(!condition)throw new Error('Invalid benchmark: '+message);}
function unionDuration(intervals){
 if(!intervals.length)return unavailable;
 const sorted=intervals.map(i=>[Date.parse(i.start),Date.parse(i.end)]).sort((a,b)=>a[0]-b[0]);
 let [start,end]=sorted[0],total=0;
 for(const [a,b] of sorted.slice(1)){if(a<=end)end=Math.max(end,b);else{total+=end-start;start=a;end=b;}}
 return total+end-start;
}
function usage(value){
 if(value==null)return unavailable;
 requireValue(value&&typeof value==='object'&&!Array.isArray(value),'usage must be an actual provider record or null');
 for(const key of ['input','output','total'])requireValue(Number.isSafeInteger(value[key])&&value[key]>=0,'invalid token '+key);
 requireValue(value.total===value.input+value.output,'token total mismatch');
 requireValue(typeof value.source==='string'&&value.source.trim(),'actual usage source required');
 return {...value};
}
function correctionUsage(values){
 if(values==null)return unavailable;
 requireValue(Array.isArray(values),'corrections must be records or null');
 const records=values.map(usage);if(records.includes(unavailable))return unavailable;
 return {input:records.reduce((n,r)=>n+r.input,0),output:records.reduce((n,r)=>n+r.output,0),total:records.reduce((n,r)=>n+r.total,0),records};
}
export function summarizeAuthoringRuns(input){
 requireValue(input?.version===1&&Array.isArray(input.runs)&&input.runs.length,'version 1 and nonempty runs required');
 const ids=new Set();
 const runs=input.runs.map(run=>{
  for(const key of ['id','scenarioId','model','materialFingerprint','requirementsFingerprint'])requireValue(typeof run[key]==='string'&&run[key].trim(),'missing '+key);
  requireValue(!ids.has(run.id),'duplicate run id');ids.add(run.id);
  requireValue(['legacy','authored'].includes(run.route),'invalid route');
  requireValue(['authoring','program-replay'].includes(run.scope),'explicit scope required');
  requireValue(Number.isSafeInteger(run.pageCount)&&run.pageCount>0,'invalid pageCount');
  requireValue(Number.isSafeInteger(run.correctionRounds)&&run.correctionRounds>=0,'invalid correctionRounds');
  requireValue(['pending','accepted','rejected'].includes(run.acceptance?.visual),'invalid visual acceptance');
  requireValue(['pending','passed','failed'].includes(run.acceptance?.editing),'invalid editing acceptance');
  requireValue(Array.isArray(run.intervals),'intervals required; use [] when unavailable');
  for(const i of run.intervals){requireValue(typeof i.stage==='string'&&i.stage.trim(),'stage required');requireValue(typeof i.start==='string'&&typeof i.end==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(i.start)&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(i.end)&&Number.isFinite(Date.parse(i.start))&&Number.isFinite(Date.parse(i.end))&&Date.parse(i.end)>=Date.parse(i.start),'invalid interval');}
  for(const key of ['firstVersionMs','endToEndMs'])if(run[key]!=null)requireValue(Number.isFinite(run[key])&&run[key]>=0,'invalid '+key);
  if(run.startup!=null)requireValue(['cold','warm',unavailable].includes(run.startup),'invalid startup');
  const initial=usage(run.tokens?.initial),corrections=correctionUsage(run.tokens?.corrections);
  return {installedFingerprint:run.installedFingerprint||unavailable,host:run.host||unavailable,deliveryProfile:run.deliveryProfile||'unspecified',startup:run.startup||unavailable,firstVersionMs:run.firstVersionMs??unavailable,endToEndMs:run.scope==='authoring'?(run.endToEndMs??unavailable):unavailable,id:run.id,scenarioId:run.scenarioId,route:run.route,pageCount:run.pageCount,model:run.model,materialFingerprint:run.materialFingerprint,requirementsFingerprint:run.requirementsFingerprint,wallClockMs:run.intervals.length?Math.max(...run.intervals.map(i=>Date.parse(i.end)))-Math.min(...run.intervals.map(i=>Date.parse(i.start))):unavailable,measuredActiveMs:unionDuration(run.intervals),stages:Object.fromEntries([...new Set(run.intervals.map(i=>i.stage))].map(stage=>[stage,unionDuration(run.intervals.filter(i=>i.stage===stage))])),tokens:{initial,corrections,total:initial===unavailable||corrections===unavailable?unavailable:initial.total+corrections.total},correctionRounds:run.correctionRounds,visualAcceptance:run.acceptance.visual,editingAcceptance:run.acceptance.editing,scope:run.scope,notes:run.notes||[]};
 });
 const comparisons=[];
 for(const legacy of runs.filter(r=>r.route==='legacy'))for(const authored of runs.filter(r=>r.route==='authored'&&r.scenarioId===legacy.scenarioId)){
  const reasons=[];
  for(const [key,reason]of [['materialFingerprint','material-mismatch'],['requirementsFingerprint','requirements-mismatch'],['pageCount','page-count-mismatch'],['model','model-mismatch'],['scope','scope-mismatch'],['deliveryProfile','delivery-profile-mismatch'],['host','host-mismatch'],['startup','startup-mismatch']])if(legacy[key]!==authored[key])reasons.push(reason);
  if([legacy,authored].some(r=>r.model===unavailable))reasons.push('model-unverified');
  if([legacy,authored].some(r=>r.tokens.total===unavailable))reasons.push('actual-tokens-unavailable');
  if([legacy,authored].some(r=>r.wallClockMs===unavailable))reasons.push('timing-unavailable');
  if([legacy,authored].some(r=>r.visualAcceptance!=='accepted'))reasons.push('visual-acceptance-pending');
  if([legacy,authored].some(r=>r.editingAcceptance!=='passed'))reasons.push('editing-not-passed');
  if([legacy,authored].some(r=>r.scope!=='authoring'))reasons.push('not-end-to-end-authoring');
  comparisons.push({scenarioId:legacy.scenarioId,legacyId:legacy.id,authoredId:authored.id,canClaimAuthoringSavings:reasons.length===0,reasons});
 }
 return {version:1,runs,comparisons,limitations:['Stage durations may overlap; do not sum stage totals as wall-clock cost.','Unavailable actual usage is never estimated from file size or characters.','Program replay time does not measure model authoring or time to user acceptance.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const [input,output]=process.argv.slice(2);requireValue(input&&output,'usage: benchmark-authoring.mjs <runs.json> <report.json>');const report=summarizeAuthoringRuns(JSON.parse(fs.readFileSync(input,'utf8')));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:path.resolve(output),runs:report.runs.length,comparisons:report.comparisons.length}));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
