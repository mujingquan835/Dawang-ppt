import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContentModel } from '../../skills/dawang-ppt/project/src/fusion/authoring/content-model.mjs';
import { reviewPagePlan } from '../../skills/dawang-ppt/project/src/fusion/authoring/page-plan.mjs';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { checkCoverage } from '../../skills/dawang-ppt/project/src/fusion/qa/coverage.mjs';
import { reviewVisualDecisions } from '../../skills/dawang-ppt/project/src/fusion/qa/visual-decisions.mjs';
import { checkOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';
import { semanticFixture } from './helpers/semantic-fixture.mjs';
const kinds = x => x.map(i=>i.kind);
test('legacy projects remain opt-in; unsupported and incomplete version pairs are rejected',()=>{
 assert.deepEqual(validateContentModel({}),[]);
 for(const value of ['content-relations-v9','']) {const p=semanticFixture();p.requirements.semanticContract=value;assert(kinds(validateContentModel(p)).includes('semantic-contract-version'));}
 const p=semanticFixture();delete p.requirements.semanticContract;assert(kinds(validateContentModel(p)).includes('semantic-contract-required'));
});
test('branch and cycle relationships retain sources, members and return paths',()=>{
 const p=semanticFixture();assert.deepEqual(validateContentModel(p),[]);
 p.contentPlan.relations[0].kind='cycle';p.contentPlan.relations[0].edges.splice(1,0,{id:'continue',from:'b',to:'c'});assert.deepEqual(validateContentModel(p),[]);
 p.contentPlan.relations[0].edges.pop();assert(kinds(validateContentModel(p)).includes('relation-cycle-open'));
});
test('malformed content, missing sources and invalid endpoints return diagnostics',()=>{
 for(const mutate of [p=>p.contentPlan.nodes=null,p=>p.contentPlan.relations={},p=>p.contentPlan.relations[0]=null,p=>p.contentPlan.nodes.a.sourceRefs=['unknown'],p=>p.contentPlan.relations[0].edges[0].to='unknown']) {
 const p=semanticFixture();mutate(p);assert(validateContentModel(p).length);
 }
});
test('required content cannot silently disappear behind a disposition',()=>{
 const p=semanticFixture();p.contentPlan.dispositions=[{ref:'a',action:'excluded',reason:'too long'}];
 assert(kinds(validateContentModel(p)).includes('content-decision-required'));
 p.requirements.userDecisions=[{id:'d1',quote:'本页不要A',decision:'排除A',covers:['content#a']}];p.contentPlan.dispositions[0].decisionRef='d1';assert.deepEqual(validateContentModel(p),[]);
});
test('valid free design binds all members and relation edges without a mandatory component',()=>{
 const p=createAuthoredProject(semanticFixture());assert.deepEqual(checkCoverage(p),[]);
 assert.deepEqual(reviewPagePlan(p).issues,[]);
 assert(!reviewVisualDecisions(p).issues.some(i=>i.kind==='report-component-missing'));
});
test('deleting a binding or hiding the only evidence blocks coverage',()=>{
 for(const mutate of [p=>p.contentPlan.slides[0].regions[0].bindings.pop(),p=>p.slides[0].elements.find(e=>e.id==='ea').style.opacity=0,p=>p.editorState.skippedSlides=['p1']]) {
 const p=createAuthoredProject(semanticFixture());mutate(p);assert(checkCoverage(p).length);
 }
});
test('return edge evidence cannot be replaced with an unrelated component',()=>{
 const p=createAuthoredProject(semanticFixture());p.contentPlan.slides[0].regions[0].bindings.find(b=>b.edgeId==='return').elementIds=['absent'];
 p.slides[0].elements.push({id:'tile',type:'shape',component:'answerBlock',bounds:[100,900,400,100],style:{fill:'#123456'}});
 assert(kinds(checkCoverage(p)).includes('binding-element-missing'));
});
test('bindings must live in their declared zone and cover declared references',()=>{
 const p=createAuthoredProject(semanticFixture());p.contentPlan.slides[0].regions[0].zoneId='unknown';assert(kinds(checkCoverage(p)).includes('region-zone-missing'));
 const q=createAuthoredProject(semanticFixture());q.slides[0].elements[0].bounds=[1800,1000,80,60];assert(kinds(checkCoverage(q)).includes('binding-outside-zone'));
});
test('exact metric displays and missing asset status remain explicit',()=>{
 const p=semanticFixture();p.contentPlan.nodes.a.type='metric';p.contentPlan.nodes.a.facts={display:'34 项',unit:'项',role:'estimated'};
 p.slides[0].elements[0].text='34 项';assert.deepEqual(reviewPagePlan(createAuthoredProject(p)).issues,[]);
 p.slides[0].elements[0].text='134 项';assert(kinds(reviewPagePlan(createAuthoredProject(p)).issues).includes('bound-fact-mismatch'));
 const q=semanticFixture();q.contentPlan.gaps=[{id:'photo',affectedRefs:['a'],missing:'照片',impact:'需占位',resolution:'placeholder'}];assert.deepEqual(validateContentModel(q),[]);
});
test('proposal outline validates content model without imposing report chapters',()=>{
 const p=semanticFixture();const r=checkOutline({...p,kind:'proposal',scope:'full',pages:[{id:'p1',role:'other',keyLine:{text:'核对后接收'}}]});assert.equal(r.ok,true);assert.equal(r.kind,'proposal');
 p.contentPlan.nodes.a.sourceRefs=['missing'];assert.equal(checkOutline({...p,kind:'proposal',pages:[]}).ok,false);
});

test('actual project creation requires paired contract; source input is not mutated',()=>{
 const p=semanticFixture(), before=structuredClone(p);createAuthoredProject(p);assert.deepEqual(p,before);
 delete p.requirements.pageDesignContract;assert.throws(()=>createAuthoredProject(p),/page-design-contract-required/);
});
test('row bindings and members are required for schedules without prescribing a shape',()=>{
 const p=semanticFixture(),r=p.contentPlan.relations[0];r.kind='assignment';delete r.edges;r.rows=[{id:'morning',members:['a','b']},{id:'afternoon',members:['a','c']}];
 const region=p.contentPlan.slides[0].regions[0];region.bindings=region.bindings.filter(b=>b.ref!=='r');region.bindings.push({ref:'r',rowId:'morning',elementIds:['eyes']},{ref:'r',rowId:'afternoon',elementIds:['eno']});
 assert.deepEqual(reviewPagePlan(createAuthoredProject(p)).issues,[]);
 region.bindings.pop();assert(kinds(reviewPagePlan(createAuthoredProject(p)).issues).includes('relation-row-unbound'));
});
test('regional review claims include facts and exact edges, not an automatic verdict',async()=>{
 const {pageDesignClaims}=await import('../../skills/dawang-ppt/project/src/fusion/authoring/page-plan.mjs');
 const claims=pageDesignClaims(createAuthoredProject(semanticFixture()));assert.equal(claims.length,1);assert.equal(claims[0].relations[0].edges[2].id,'return');assert.equal(claims[0].nodes.length,3);assert.equal(claims[0].verdict,undefined);
});
test('manual text edits save without losing bindings, become dirty, undo/redo preserves state',async()=>{
 const {applyEditCommand,undoProject,redoProject}=await import('../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs');
 const {validateProject}=await import('../../skills/dawang-ppt/project/src/fusion/project/schema.mjs');
 const p=createAuthoredProject(semanticFixture()),edited=applyEditCommand(p,{type:'text',slideId:'p1',elementId:'ea',text:'人工改后的核对说明'});
 assert(edited.ok);assert.deepEqual(validateProject(edited.project),[]);assert(kinds(checkCoverage(edited.project)).includes('bound-content-needs-reconciliation'));
 const undo=undoProject(edited.project);assert.deepEqual(checkCoverage(undo.project),[]);assert(kinds(checkCoverage(redoProject(undo.project).project)).includes('bound-content-needs-reconciliation'));
 const original=semanticFixture();original.slides[0].elements[0].contentRef='a';const r=applyEditCommand(createAuthoredProject(original),{type:'text',slideId:'p1',elementId:'ea',text:'改字'});assert.deepEqual(validateProject(r.project),[]);
});
test('a page removed from presentation order no longer satisfies required content coverage',()=>{
 const p=createAuthoredProject(semanticFixture());p.editorState.slideOrder=[];assert(kinds(checkCoverage(p)).includes('required-content-unbound'));
});
test('sequence gaps, duplicate rows and unrelated user decisions are rejected',()=>{
 const p=semanticFixture();p.contentPlan.relations[0].kind='sequence';assert(kinds(validateContentModel(p)).includes('relation-sequence-incomplete'));
 const q=semanticFixture();q.contentPlan.relations[0].rows=[{id:'x',members:['a']},{id:'x',members:['b']}];assert(kinds(validateContentModel(q)).includes('relation-row-invalid'));
 const r=semanticFixture();r.contentPlan.dispositions=[{ref:'a',action:'excluded',reason:'removed',decisionRef:'d'}];r.requirements.userDecisions=[{id:'d',quote:'换蓝色',decision:'蓝色',covers:['palette']}];assert(kinds(validateContentModel(r)).includes('content-decision-required'));
});
test('independent-review packet contains regional facts and sources alongside existing claims',async()=>{
 const {buildReviewPacket}=await import('../../skills/dawang-ppt/project/src/fusion/qa/rules-review.mjs');
 const p=createAuthoredProject(semanticFixture());p.sources.entries[0].excerpt='合成：资料不完整返回补充';
 const packet=buildReviewPacket({project:p,rules:{scenario:'business-plan',items:[],sections:[]},pages:[{slideId:'p1',image:'synthetic.png'}]});
 const claim=packet.claims.find(c=>c.id==='page-design#p1/body');assert(claim);assert.equal(claim.sources[0].excerpt,p.sources.entries[0].excerpt);assert.match(packet.prompt,/不能因为有色块或箭头/);
});
