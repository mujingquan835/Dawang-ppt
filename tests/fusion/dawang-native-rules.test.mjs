import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import * as baseline from '../../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';
import * as current from '../../skills/dawang-ppt/project/src/fusion/rules/index.mjs';
const cli=path.resolve('skills/dawang-ppt/scripts/dawang.mjs');
function temp(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'dawang-preserve-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
function fixture(t){const root=temp(t);fs.mkdirSync(path.join(root,'reference/slides_categories'),{recursive:true});fs.mkdirSync(path.join(root,'reference/design_system/custom'),{recursive:true});
 fs.writeFileSync(path.join(root,'SKILL.md'),'# Definition\nsynthetic format\n## PPT production workflow\n### step1. Read the context thoroughly\nRead every source; Kimi\n### step5. PPT output and delivery\nold delivery\n### New heading\nunknown must remain unreviewed\n');
 fs.writeFileSync(path.join(root,'reference/slides_categories.md'),'# PPT category guide\n## Requirements\nSynthetic exact requirement and threshold: 14pt.\n');
 for(const s of baseline.SCENARIOS)fs.writeFileSync(path.join(root,'reference/slides_categories',s.doc),'# Key Requirements\nFull synthetic '+s.id+' rule; keep exceptions, numbers and strong language.\n');
 fs.writeFileSync(path.join(root,'reference/fonts.md'),'# Font requirements\nSynthetic font condition.\n');fs.writeFileSync(path.join(root,'reference/design_system/custom/design.md'),'# Visual constraints\nSynthetic custom layout.\n');
 const file=path.join(root,'lock.json');baseline.writeRulesLock({root,file,label:'fixture'});return{root,lock:baseline.readRulesLock(file)};}

test('full production rule sections and all adaptation decisions match the baseline, including optional documents',t=>{
 const {root,lock}=fixture(t);
 for(const s of baseline.SCENARIOS){const opts={scenarioId:s.id,root,lock,designDoc:'design_system/custom/design.md',formatDocs:['fonts.md']};const before=baseline.readAuthoringRules(opts),after=current.readAuthoringRules(opts);
  assert.equal(after.provider,'dawang-ppt');assert.deepEqual(after.summary,before.summary);assert.equal(after.pin.lockedBundleSha256,before.pin.lockedBundleSha256);
  assert.deepEqual(after.documents.map(d=>[d.relativePath,d.sha256,d.sections.length]),before.documents.map(d=>[d.relativePath,d.sha256,d.sections.length]));
  for(let i=0;i<before.documents.length;i++)for(let j=0;j<before.documents[i].sections.length;j++){
   const a=after.documents[i].sections[j],b=before.documents[i].sections[j];assert.deepEqual(a.lines,b.lines);assert.equal(a.disposition,b.disposition);assert.equal(a.textOmitted,b.textOmitted);assert.equal(a.by,b.by);
   if(b.text!==undefined)assert.equal(a.text,b.text.replace(/\bKimi\b/g,'Dawang-PPT'));
  }
  const full=current.readAuthoringRules({...opts,includeReplaced:true});assert(full.documents[0].sections.some(s=>s.text?.includes('old delivery')));
 }
});
test('drift is blocked; explicit audited override preserves unreviewed status',t=>{
 const {root,lock}=fixture(t);fs.appendFileSync(path.join(root,'reference/slides_categories.md'),'\nSynthetic changed condition.');
 assert.throws(()=>current.readAuthoringRules({scenarioId:'business-plan',root,lock}),/rules:lock/);
 const r=current.readAuthoringRules({scenarioId:'business-plan',root,lock,allowDrift:true});assert.equal(r.pin.status,'drift');assert(r.documents.find(d=>d.id==='general').sections.every(s=>s.disposition==='unreviewed'));
});
test('missing full rules are reported and prepare cannot substitute abbreviated bundled summaries',t=>{
 const home=temp(t),env={...process.env,HOME:home,CODEX_HOME:path.join(home,'codex'),DAWANG_PPT_RULES_DIR:path.join(home,'missing'),KIMI_PPT_SKILL_DIR:''};
 const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:60000,env});const d=run('doctor');const doctor=JSON.parse(d.stdout);assert.equal(doctor.rules.status,'missing');assert.equal(doctor.ready,false);
 const input=path.join(home,'input.md'),out=path.join(home,'prepared');fs.writeFileSync(input,'# 合成材料\n保留待核状态。');const r=run('prepare',input,out,'--scenario','tech-engineering');assert.notEqual(r.status,0);assert.equal(fs.existsSync(out),false);
});
test('new authored projects keep branded metadata and old saved projects remain readable',async()=>{
 const {createAuthoredProject}=await import('../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs');const {validateProject}=await import('../../skills/dawang-ppt/project/src/fusion/project/schema.mjs');
 const p=createAuthoredProject({requirements:{title:'合成测试'},sources:{entries:[]},media:{entries:[]},contentPlan:{nodes:{}},designChoice:{styleId:'authored/custom'},slides:[{slideId:'s',elements:[{id:'t',type:'text',text:'合成测试',bounds:[100,100,1000,100]}]}]});assert.equal(p.slides[0].authoring.engine,'dawang-authored-v1');assert.deepEqual(validateProject(p),[]);p.slides[0].authoring.engine='kimi-authored-v1';assert.deepEqual(validateProject(p),[]);
});
