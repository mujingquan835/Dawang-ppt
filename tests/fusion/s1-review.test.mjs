import test from 'node:test';import assert from 'node:assert/strict';
import {layoutTable} from '../../skills/dawang-ppt/project/src/fusion/objects/table.mjs';
import {resolveStyle,resolveSlideStyle} from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {applyEditCommand} from '../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs';
import {importGoal} from '../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs';
import {layoutObject} from '../../skills/dawang-ppt/project/src/fusion/objects/index.mjs';
const style=resolveStyle('legacy/theme14');
test('timeline swimlanes and information bands preserve cells while removing ordinary table grid',()=>{
 for(const presentation of ['bands','swimlanes']){
  const es=layoutTable({objectId:'lanes',kind:'table',bounds:[100,200,1600,400],data:{presentation,columns:[{columnId:'lane',label:'业务线'},{columnId:'node',label:'合成节点'}],rows:[{rowId:'a',cells:{lane:'合成业务',node:'合成行动'}}]}},style);
  assert(es.some(e=>e.text==='合成行动'));assert(!es.some(e=>e.id.endsWith('/right')));
  assert(!es.some(e=>e.id==='lanes/header/node'&&e.style.fill===style.palette.header));
  if(presentation==='swimlanes')assert(es.some(e=>e.id==='lanes/time-axis'&&e.endArrow==='triangle'));
 }
});
test('appearance command removes previous per-project brand overrides',()=>{
 const slide={slideId:'a',mode:'composition',styleId:style.id,appearance:{palette:{ink:'#16283C',accent:'#C0652B'}},styleBindingVersion:1,elements:[],objects:[]};
 const p=importGoal({styleId:style.id,slides:[slide]});const r=applyEditCommand(p,{slideId:'a',type:'appearance',styleId:'legacy/theme17'});
 assert(r.ok);assert.equal(resolveSlideStyle(r.project.slides[0]).palette.accent,resolveStyle('legacy/theme17').palette.accent);
});
test('measured process rejects a group height below its measured readable minimum',()=>{
 const object={objectId:'f',kind:'process',layoutVersion:3,bounds:[0,0,200,100],data:{fontSize:28,nodes:[{nodeId:'a',label:'合成'}],measuredNodes:[{nodeId:'a',bounds:[0,0,200,100],labelHeight:40,detailHeight:0}]},overrides:{}};
 const p=importGoal({styleId:style.id,slides:[{slideId:'a',mode:'composition',styleId:style.id,elements:[],objects:[object]}]});
 const r=applyEditCommand(p,{slideId:'a',type:'object-geometry',objectId:'f',bounds:[0,0,200,50]});
 assert.equal(r.ok,false);assert(r.conflicts[0].message.includes('实测'));
 const larger=applyEditCommand(p,{slideId:'a',type:'object-geometry',objectId:'f',bounds:[0,0,200,150]});assert(larger.ok);
 const shape=layoutObject(larger.project.slides[0].objects[0],style).find(e=>e.type==='shape');assert.equal(shape.bounds[3],150);
});
