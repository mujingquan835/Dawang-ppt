import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
const cli=path.resolve('skills/dawang-ppt/scripts/dawang.mjs');
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kimi-entry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function input(){return{requirements:{title:'合成入口检查',fixedPageCount:1},sources:{entries:[{sourceId:'fixture',kind:'synthetic'}]},media:{entries:[]},contentPlan:{nodes:{claim:{text:'长中文标题按指定构图换行，保留自定义字体层级'}},slides:[{slideId:'one',readerTask:'理解主张'}]},designChoice:{styleId:'authored/custom',direction:'自选外观，不受六种外观列表限制'},slides:[{slideId:'one',appearance:{palette:{bg:'#F6F1E8',ink:'#2E3B2D',accent:'#9B623C'}},elements:[{id:'claim',type:'text',contentRef:'claim',bounds:[111,123,710,260],style:{fontSize:64,fontFamily:'Arial',color:'#2E3B2D'}}]}]};}
function run(...args){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:60000});}
test('default build directly authors arbitrary supported drawing base and preserves custom geometry',t=>{
 const dir=temp(t),file=path.join(dir,'authored.json'),html=path.join(dir,'deck/index.html');fs.writeFileSync(file,JSON.stringify(input()));const r=run('build',file,html);assert.equal(r.status,0,r.stderr);const p=JSON.parse(fs.readFileSync(path.join(dir,'deck/deck-project.json')));assert.equal(p.slides[0].authoring.engine,'dawang-authored-v1');assert.deepEqual(p.slides[0].elements[0].bounds,[111,123,710,260]);assert.equal(p.slides[0].appearance.palette.bg,'#F6F1E8');assert.equal(p.slides[0].styleId,'authored/custom');assert.equal(p.slides[0].planning,undefined);
});
test('old brief cannot silently enter the new build or create output; migration is explicit',t=>{
 const dir=temp(t),file=path.join(dir,'brief.json'),html=path.join(dir,'deck/index.html');fs.writeFileSync(file,JSON.stringify({title:'历史计划',styleId:'legacy/theme14',contentSlides:[{slideId:'one',title:'旧计划'}]}));const r=run('build',file,html);assert.notEqual(r.status,0);assert.match(r.stderr,/render:brief/);assert(!fs.existsSync(html));assert(!fs.existsSync(path.join(dir,'deck/deck-project.json')));
});
test('rerender saved project preserves manual edit; build refuses to overwrite it',t=>{
 const dir=temp(t),file=path.join(dir,'authored.json'),html=path.join(dir,'deck/index.html');fs.writeFileSync(file,JSON.stringify(input()));assert.equal(run('build',file,html).status,0);const saved=path.join(dir,'deck/deck-project.json'),p=JSON.parse(fs.readFileSync(saved));p.contentPlan.nodes.claim.text='已保存的人工修改';p.slides[0].elements[0].bounds=[333,234,900,300];fs.writeFileSync(saved,JSON.stringify(p));assert.equal(run('render:project',saved,html).status,0);assert.match(fs.readFileSync(html,'utf8'),/已保存的人工修改/);const original=fs.readFileSync(saved,'utf8');assert.notEqual(run('build',file,html).status,0);assert.equal(fs.readFileSync(saved,'utf8'),original);
});
test('doctor exposes default route and actual installation separately',()=>{
 const r=run('doctor');assert.equal(r.status,0,r.stderr);const d=JSON.parse(r.stdout);assert.equal(d.defaultBuild,'render:authored');assert.equal(d.legacyBuild,'render:brief');assert.equal(d.skill,path.dirname(path.dirname(cli)));assert(Array.isArray(d.installations));for(const i of d.installations){assert.equal(typeof i.usesThisSkill,'boolean');assert.equal(typeof i.path,'string');assert(['linked','directory','not-installed','broken-link','unreadable'].includes(i.status));}assert.deepEqual(d.installations.map(i=>i.host),['codex','workbuddy','agents']);
});
test('doctor tells an absent host apart from a broken link',t=>{
 const home=temp(t),skill=path.dirname(path.dirname(cli));fs.mkdirSync(path.join(home,'.codex/skills'),{recursive:true});fs.symlinkSync(skill,path.join(home,'.codex/skills/dawang-ppt'));fs.mkdirSync(path.join(home,'.workbuddy/skills'),{recursive:true});fs.symlinkSync(path.join(home,'gone'),path.join(home,'.workbuddy/skills/dawang-ppt'));
 const r=spawnSync(process.execPath,[cli,'doctor'],{encoding:'utf8',timeout:60000,env:{...process.env,HOME:home,CODEX_HOME:''}});assert.equal(r.status,0,r.stderr);const byHost=Object.fromEntries(JSON.parse(r.stdout).installations.map(i=>[i.host,i]));
 assert.equal(byHost.codex.status,'linked');assert.equal(byHost.codex.usesThisSkill,true);assert.equal(byHost.workbuddy.status,'broken-link');assert.equal(byHost.agents.status,'not-installed');
});

test('saved ProjectV2 input must use render:project rather than rebuilding away editor state',t=>{
 const dir=temp(t),source=path.join(dir,'authored.json'),first=path.join(dir,'one/index.html');fs.writeFileSync(source,JSON.stringify(input()));assert.equal(run('build',source,first).status,0);const saved=path.join(dir,'one/deck-project.json'),output=path.join(dir,'two/index.html');const r=run('build',saved,output);assert.notEqual(r.status,0);assert.match(r.stderr,/render:project/);assert(!fs.existsSync(output));
});

test('custom drawing defaults do not silently enable unknown styles for old composition pages',async()=>{
 const {resolveSlideStyle}=await import('../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs');assert.throws(()=>resolveSlideStyle({styleId:'authored/custom'}),/not adapted/);const custom=resolveSlideStyle({styleId:'authored/custom',authoring:{engine:'kimi-authored-v1'},appearance:{palette:{accent:'#AC5101'}}});assert.equal(custom.palette.accent,'#AC5101');assert.equal(custom.source.kind,'authored');
});
test('default build custom composition supports browser sidebar editing, save reopen and same-revision native export',t=>{
 const dir=temp(t);const r=spawnSync('skills/dawang-ppt/project/node_modules/.bin/tsx',['tests/fusion/helpers/kimi-entry-run.jsx',dir],{encoding:'utf8',timeout:90000});assert.equal(r.status,0,r.stderr+'\n'+r.stdout);const report=JSON.parse(fs.readFileSync(path.join(dir,'report.json')));assert(report.sidebarEdit&&report.undoRedo&&report.saveReopen&&report.geometryPreserved&&report.qa&&report.sameRevisionExport);
});
