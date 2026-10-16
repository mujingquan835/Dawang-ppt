import test from 'node:test';
import assert from 'node:assert/strict';
import {importGoal} from '../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs';
import {applyEditCommand} from '../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs';
import {checkCoverage} from '../../skills/dawang-ppt/project/src/fusion/qa/coverage.mjs';
const project=()=>{const p=importGoal({title:'公开合成编辑测试',styleId:'legacy/theme14',slides:[{slideId:'a',mode:'composition',styleId:'legacy/theme14',elements:[{id:'title',type:'text',role:'title',text:'原始标题',contentRef:'fact',bounds:[100,100,900,80],style:{fontSize:60}},{id:'photo',type:'image',mediaRef:'required-image',src:'synthetic-old',bounds:[100,300,600,400]}],objects:[],requiredContentRefs:['fact']}]});p.contentPlan.nodes={fact:{text:'原始标题',sourceRef:'synthetic'}};p.requirements.requiredMedia=['required-image'];p.media.entries=[{mediaId:'required-image',src:'synthetic-old'}];return p;};
test('explicit edits remain traceable and do not falsely fail coverage against superseded text or media',()=>{
 let p=project();assert.deepEqual(checkCoverage(p),[]);
 let result=applyEditCommand(p,{slideId:'a',elementId:'title',type:'text',text:'用户明确改后的标题'});assert(result.ok);p=result.project;
 assert.deepEqual(checkCoverage(p),[]);assert.equal(p.contentPlan.nodes.fact.text,'原始标题');
 result=applyEditCommand(p,{slideId:'a',elementId:'photo',type:'image',src:'synthetic-replacement'});assert(result.ok);p=result.project;
 assert.deepEqual(checkCoverage(p),[]);assert.equal(p.sources.userEdits.length,2);
 p.slides[0].elements=p.slides[0].elements.filter(e=>e.id!=='photo');
 assert(checkCoverage(p).some(i=>i.kind==='required-media-not-rendered'),'deleting a required image must still fail');
});
