import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as before from '../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';
import * as after from '../skills/dawang-ppt/project/src/fusion/rules/index.mjs';
const root=after.locateRulesRoot(),lock=after.readRulesLock();
assert.equal(after.ruleStatus({root,lock}).status,'pinned','Audit requires the complete matching production source');
const hash=b=>createHash('sha256').update(b).digest('hex');
// Assert that the complete reader and its adaptation decisions have not been reimplemented or shortened.
for(const name of ['reference-index.mjs','rule-dispositions.mjs']){
 const file='skills/dawang-ppt/project/src/fusion/kimi/'+name;
 assert.equal(hash(fs.readFileSync(file)),hash(execFileSync('git',['show','379a84c:'+file])));
}
const projectRoot='skills/dawang-ppt/project/';
const entries=execFileSync('git',['ls-tree','-r','-z','e568d20',projectRoot]).toString().split('\0').filter(Boolean).map(line=>{const [meta,file]=line.split('\t');return {file,oid:meta.split(' ')[2]};});
const runtime=entries.filter(({file:f})=>!f.includes('/src/fusion/rules/')&&!f.endsWith('/scripts/fusion-cli.jsx'));
const gitBlobHash=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const changedRuntime=runtime.filter(({file,oid})=>gitBlobHash(fs.readFileSync(file))!==oid).map(x=>x.file);
assert.deepEqual(changedRuntime,[],'This correction must not change renderer/editor/export or composition behavior');
let profiles=0,sections=0,brandOnlySections=0;
function compare(options){
 const a=before.readAuthoringRules({...options,root,lock}),b=after.readAuthoringRules({...options,root,lock});
 assert.deepEqual(b.summary,a.summary);assert.deepEqual(b.pin,a.pin);
 const expected=a.documents.map(d=>({...d,sections:d.sections.map(s=>({...s,heading:after.brandText(s.heading),...(s.text===undefined?{}:{text:after.brandText(s.text)}),...(s.note===undefined?{}:{note:after.brandText(s.note)})}))}));
 assert.deepEqual(b.documents,expected);
 profiles++;for(const d of a.documents)for(const s of d.sections){sections++;if(s.text!==after.brandText(s.text)||s.heading!==after.brandText(s.heading)||s.note!==after.brandText(s.note))brandOnlySections++;}
 return {sections:a.documents.reduce((n,d)=>n+d.sections.length,0),decisions:a.summary,characters:a.documents.flatMap(d=>d.sections).reduce((n,s)=>n+(s.text?.length||0),0)};
}
const scenarios=before.SCENARIOS.map(s=>{const result=compare({scenarioId:s.id});compare({scenarioId:s.id,includeReplaced:true});return {id:s.id,...result};});
const optional=Object.keys(lock.files).filter(f=>f.startsWith('reference/')&&!f.includes('slides_categories'));
for(const file of optional){const relative=file.slice('reference/'.length);compare({scenarioId:'management-report',...(relative.startsWith('design_system/')?{designDoc:relative}:{formatDocs:[relative]}),includeReplaced:true});}
const report={status:'PASS',baselineCommit:'379a84c',referenceBundleSha256:lock.bundleSha256,referenceFiles:Object.keys(lock.files).length,sourceReaderByteIdentical:true,sourceDispositionTableByteIdentical:true,runtimeFilesUnchangedSincePreviousPreview:runtime.length,comparedProfiles:profiles,comparedSections:sections,brandOnlySections,scenarios,optionalDocuments:optional.length,comparison:'All source hashes, document lists, section boundaries, text (apart from explicit presentation-name replacements), adaptation decisions, replacement targets, omitted sections and review states match the full baseline.',limits:'This verifies rule and runtime preservation; it does not assert identical stochastic model output or user visual acceptance.'};
const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
