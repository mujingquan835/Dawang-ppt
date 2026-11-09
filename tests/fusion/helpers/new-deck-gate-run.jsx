import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {authored} from '../../../skills/dawang-ppt/examples/authored-minimal.mjs';
import {makeHtml} from '../../../skills/dawang-ppt/project/src/fusion/authoring/pipeline.mjs';
import {NEW_DECK_CONTRACTS,buildOutlineBaseline} from '../../../skills/dawang-ppt/project/src/fusion/authoring/outline-baseline.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'new-deck-gate-'));
try{
 const inputFile=path.join(dir,'authored.json'),workspaceDir=path.join(dir,'ws'),outFile=path.join(dir,'a.html'),baselineFile=path.join(dir,'content-baseline.json');
 const make=async deck=>{fs.writeFileSync(inputFile,JSON.stringify(deck));const r=await makeHtml({inputFile,outFile,workspaceDir});assert.equal(r.ok,false);assert.equal(fs.existsSync(workspaceDir),false);return r;};
 let r=await make(authored);
 assert.deepEqual(r.issues.map(i=>i.kind),['new-deck-contracts-required']);assert.deepEqual(r.issues[0].missing,Object.keys(NEW_DECK_CONTRACTS));
 const built=buildOutlineBaseline({kind:'report',title:'合成',audience:'管理层',sources:[{sourceId:'m',kind:'synthetic'}],pages:[{id:'p1',role:'actions',items:[{title:'事项',from:{locator:'L1',excerpt:'事项'}}]}]});
 assert(built.ok,JSON.stringify(built.issues));
 const deck={...built.scaffold,requirements:{...built.scaffold.requirements,projectId:'gate-fixture'},slides:[{slideId:'p1',elements:[{id:'t',type:'text',text:'事项',bounds:[100,100,600,80],style:{fontSize:32}}]}]};
 // Declaring the contracts is not enough: the independent baseline file has to sit beside the deck and match it.
 r=await make(deck);assert.deepEqual(r.issues.map(i=>i.kind),['content-baseline-file-missing']);
 fs.writeFileSync(baselineFile,JSON.stringify({...built.baseline,id:'another'}));
 r=await make(deck);assert.deepEqual(r.issues.map(i=>i.kind),['content-baseline-replaced']);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
