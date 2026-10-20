import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAuthoringRuns } from '../../skills/dawang-ppt/project/scripts/benchmark-authoring.mjs';
const run=(extra={})=>({id:'new',scenarioId:'training',route:'authored',scope:'authoring',pageCount:4,model:'unavailable',materialFingerprint:'same-material',requirementsFingerprint:'same-requirements',intervals:[{stage:'render',start:'2026-10-20T00:00:00Z',end:'2026-10-20T00:00:10Z'},{stage:'qa',start:'2026-10-20T00:00:05Z',end:'2026-10-20T00:00:15Z'}],tokens:{initial:null,corrections:null},correctionRounds:0,acceptance:{visual:'pending',editing:'passed'},...extra});
test('missing actual tokens stay unavailable and overlapping intervals count once',()=>{
 const r=summarizeAuthoringRuns({version:1,runs:[run()]}).runs[0];assert.equal(r.wallClockMs,15000);assert.equal(r.stages.render,10000);assert.equal(r.tokens.total,'unavailable');assert.equal(r.tokens.initial,'unavailable');assert.equal(r.visualAcceptance,'pending');
});
test('actual usage and disjoint intervals aggregate without character proxies',()=>{
 const r=summarizeAuthoringRuns({version:1,runs:[run({tokens:{initial:{input:100,output:30,total:130,source:'provider-usage'},corrections:[{input:10,output:4,total:14,source:'provider-usage'}]}})]}).runs[0];assert.equal(r.tokens.total,144);assert.equal(r.tokens.initial.total,130);assert.equal(r.tokens.corrections.total,14);
 const missing=summarizeAuthoringRuns({version:1,runs:[run({intervals:[]})]}).runs[0];assert.equal(missing.wallClockMs,'unavailable');
});
test('invalid dates, usage, acceptance and duplicate runs fail explicitly',()=>{
 for(const modify of [r=>r.intervals[0].end='bad',r=>r.intervals[0].end='2026-10-19T00:00:00Z',r=>r.tokens.initial={input:1,output:2,total:4,source:'guess'},r=>r.pageCount=0,r=>r.acceptance.visual='auto-pass',r=>r.correctionRounds=-1]){const r=run();modify(r);assert.throws(()=>summarizeAuthoringRuns({version:1,runs:[r]}));}
 assert.throws(()=>summarizeAuthoringRuns({version:1,runs:[run(),run()]}));
});
test('comparison discloses mismatches and cannot claim savings without actual cost and visual approval',()=>{
 const old=run({id:'old',route:'legacy'}),newer=run();let c=summarizeAuthoringRuns({version:1,runs:[old,newer]}).comparisons[0];assert.equal(c.canClaimAuthoringSavings,false);assert(c.reasons.includes('actual-tokens-unavailable'));assert(c.reasons.includes('visual-acceptance-pending'));assert(c.reasons.includes('model-unverified'));
 c=summarizeAuthoringRuns({version:1,runs:[old,run({materialFingerprint:'other'})]}).comparisons[0];assert(c.reasons.includes('material-mismatch'));
});

test('wall clock includes gaps while active measurement merges only overlapping work',()=>{
 const r=summarizeAuthoringRuns({version:1,runs:[run({intervals:[{stage:'render',start:'2026-10-20T00:00:00Z',end:'2026-10-20T00:00:05Z'},{stage:'render',start:'2026-10-20T00:00:15Z',end:'2026-10-20T00:00:20Z'}]})]}).runs[0];
 assert.equal(r.wallClockMs,20000);assert.equal(r.measuredActiveMs,10000);assert.equal(r.stages.render,10000);
});

test('CLI writes a structured report and rejects malformed input without a success file',async t=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{spawnSync}=await import('node:child_process');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'benchmark-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const input=path.join(dir,'runs.json'),output=path.join(dir,'report.json'),cli='skills/dawang-ppt/project/scripts/benchmark-authoring.mjs';
 fs.writeFileSync(input,JSON.stringify({version:1,runs:[run()]}));assert.equal(spawnSync(process.execPath,[cli,input,output]).status,0);assert.equal(JSON.parse(fs.readFileSync(output)).runs[0].tokens.total,'unavailable');
 fs.writeFileSync(input,'{}');const invalid=path.join(dir,'invalid.json');assert.notEqual(spawnSync(process.execPath,[cli,input,invalid]).status,0);assert.equal(fs.existsSync(invalid),false);
});
