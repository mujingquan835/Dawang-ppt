import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=path.resolve('skills/dawang-ppt/scripts/dawang.mjs');
function isolated(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dawang-independent-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function run(home,...args){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:60000,env:{...process.env,HOME:home,CODEX_HOME:path.join(home,'codex'),KIMI_PPT_SKILL_DIR:path.join(home,'no-external-rules')}});}
test('doctor and complete rule read work without any external rule installation',t=>{
 const home=isolated(t),d=run(home,'doctor');assert.equal(d.status,0,d.stderr);const doctor=JSON.parse(d.stdout);
 assert.equal(doctor.rules?.provider,'dawang-ppt');assert.equal(doctor.rules.status,'pinned');assert.equal(doctor.kimiRules,undefined);
 const list=run(home,'rules:list');assert.equal(list.status,0,list.stderr);
 for(const scenario of JSON.parse(list.stdout)){
  const r=run(home,'rules:read',scenario.id);assert.equal(r.status,0,r.stderr);const rules=JSON.parse(r.stdout);
  assert.equal(rules.provider,'dawang-ppt');assert.equal(rules.pin.status,'pinned');
  assert(rules.documents.some(d=>d.id==='scenario:'+scenario.id));assert(rules.documents.some(d=>d.id==='content-editing'));assert(rules.documents.some(d=>d.id==='visual-review'));
  for(const doc of rules.documents){assert(doc.path.startsWith(path.resolve('skills/dawang-ppt/references')));assert.match(doc.sha256,/^[a-f0-9]{64}$/);assert(doc.sections.some(s=>s.text?.length>30));}
 }
});
test('prepare includes complete bundled rules and preserves source in an isolated environment',t=>{
 const home=isolated(t),input=path.join(home,'input.md'),out=path.join(home,'prepared');fs.writeFileSync(input,'# 合成材料\n试点结果尚待核对，不能表述为生产验证通过。');
 const r=run(home,'prepare',input,out,'--scenario','tech-engineering');assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);
 assert.match(JSON.parse(fs.readFileSync(result.materialFile)).text,/尚待核对/);assert.equal(JSON.parse(fs.readFileSync(result.rulesFile)).provider,'dawang-ppt');
});
test('new authored projects use the Dawang engine and old saved projects remain readable',async()=>{
 const {createAuthoredProject}=await import('../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs');
 const {validateProject}=await import('../../skills/dawang-ppt/project/src/fusion/project/schema.mjs');
 const p=createAuthoredProject({requirements:{title:'合成测试'},sources:{entries:[]},media:{entries:[]},contentPlan:{nodes:{}},designChoice:{styleId:'authored/custom'},slides:[{slideId:'s',elements:[{id:'t',type:'text',text:'合成测试',bounds:[100,100,1000,100]}]}]});
 assert.equal(p.slides[0].authoring.engine,'dawang-authored-v1');assert.deepEqual(validateProject(p),[]);
 p.slides[0].authoring.engine='kimi-authored-v1';assert.deepEqual(validateProject(p),[]);
});
test('modified bundled rules block reading until the maintainer explicitly reviews and locks them',async t=>{
 const {ROOT,readAuthoringRules,writeRulesLock}=await import('../../skills/dawang-ppt/project/src/fusion/rules/index.mjs');
 const home=isolated(t),root=path.join(home,'references');fs.cpSync(ROOT,root,{recursive:true});
 const source=path.join(root,'rules/tech-engineering.md');fs.appendFileSync(source,'\n合成维护变更。\n');
 assert.throws(()=>readAuthoringRules({scenarioId:'tech-engineering',root}),/drift/);
 writeRulesLock({root});const result=readAuthoringRules({scenarioId:'tech-engineering',root});assert.equal(result.pin.status,'pinned');assert(result.documents.some(d=>d.sections.some(s=>s.text.includes('合成维护变更'))));
});
