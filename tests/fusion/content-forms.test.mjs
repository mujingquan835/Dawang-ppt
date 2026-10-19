import test from 'node:test';
import assert from 'node:assert/strict';
import {planContentSlide} from '../../skills/dawang-ppt/project/src/fusion/planning/plan-slide.mjs';
import {createLayoutMeasurer} from '../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';
import {resolveStyle,resolveSlideStyle} from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {deriveSlideElements} from '../../skills/dawang-ppt/project/src/fusion/objects/index.mjs';
import {lintSlide} from '../../skills/dawang-ppt/project/src/fusion/kimi/design-lint.mjs';
const style=resolveStyle('legacy/theme14');
test('multi-region timeline refuses unsupported explicit geometry instead of silently replacing it',async()=>{
 const {fitMeasuredTimeline}=await import('../../skills/dawang-ppt/project/src/fusion/objects/measured-timeline.mjs');
 for(const setting of [{direction:'vertical'},{distribution:'date'},{stages:[{stageId:'s',from:'a',to:'b',label:'阶段说明'}]}]){
  await assert.rejects(()=>fitMeasuredTimeline({bounds:[0,0,1000,0],data:{...setting,nodes:[{nodeId:'a',label:'甲'},{nodeId:'b',label:'乙'}]}},style),/显式时间轴/);
 }
});
test('12pt survives planning, saved-style resolution and object materialization without changing legacy defaults',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const result=await planContentSlide({slideId:'small',title:'合成字号验证',typography:{bodyPt:12},typographyPolicy:'semantic',regions:[{regionId:'copy',kind:'text',paragraphs:[{text:'完整正文'}]},{regionId:'table',kind:'table',data:{columns:[{columnId:'a',label:'项目'}],rows:[{rowId:'r',cells:{a:'表内正文'}}]}}]},style,{measurer});
  assert(result.ok,JSON.stringify(result.conflicts));
  const restored=resolveSlideStyle(JSON.parse(JSON.stringify(result.slide)));
  const es=deriveSlideElements(result.slide,restored);
  for(const copy of ['完整正文','表内正文'])assert.equal(es.find(e=>e.text===copy).style.fontSize,24);
  assert.equal(es.find(e=>e.id==='small-table/header/a/text').style.color,style.palette.onHeader||'#ffffff');
  assert(!lintSlide({...result.slide,elements:es}).some(i=>i.rule.startsWith('body-min')));
  const {changeSlideAppearance}=await import('../../skills/dawang-ppt/project/src/fusion/styles/appearance.mjs');
  const changed=changeSlideAppearance(result.slide,restored,resolveStyle('legacy/theme17'));
  const repainted=deriveSlideElements(changed,resolveSlideStyle(changed));
  for(const copy of ['完整正文','表内正文'])assert.equal(repainted.find(e=>e.text===copy).style.fontSize,24);
  const tooSmall=es.map(e=>e.text==='完整正文'?{...e,style:{...e.style,fontSize:23}}:e);
  assert(lintSlide({...result.slide,elements:tooSmall}).some(i=>i.rule.startsWith('body-min')));
  assert.equal(resolveStyle('legacy/theme14').typography.bodyPt,undefined);
 }finally{await measurer.close();}
});
test('multi-region chronology produces an editable measured timeline with all lane events',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const result=await planContentSlide({slideId:'time',title:'合成节点安排',typography:{bodyPt:12},regions:[{regionId:'time',kind:'timeline',data:{nodes:[{nodeId:'a',label:'本月'},{nodeId:'b',label:'下月'}],lanes:[{laneId:'line',label:'业务甲',events:[{nodeId:'a',text:'持续跟进项目与资料',contentRef:'fact-a'},{nodeId:'b',text:'回收结果',contentRef:'fact-b'}]}]}}]},style,{measurer});
  assert(result.ok,JSON.stringify(result.conflicts));
  const es=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  assert.equal(result.slide.objects[0].kind,'timeline');
  assert(es.some(e=>e.type==='line'&&e.id.endsWith('/axis')));
  const event=es.find(e=>e.text==='持续跟进项目与资料');assert.equal(event.contentRef,'fact-a');
  assert.deepEqual(event.dataPath,['lanes',0,'events',0,'text']);
  assert.equal(event.style.fontSize,24);
  const {importGoal}=await import('../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs');
  const {applyEditCommand}=await import('../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs');
  const p=importGoal({styleId:style.id,slides:[result.slide]}),o=result.slide.objects[0];
  const resized=applyEditCommand(p,{slideId:'time',type:'object-geometry',objectId:o.objectId,bounds:[...o.bounds.slice(0,3),o.bounds[3]/2]});
  assert.equal(resized.ok,false);assert(resized.conflicts[0].message.includes('实测'));
 }finally{await measurer.close();}
});
test('timeline dates, labels and details keep independent editable bindings',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const result=await planContentSlide({slideId:'dates',title:'合成日期与说明',typography:{bodyPt:12},regions:[{regionId:'time',kind:'timeline',data:{nodes:[{nodeId:'a',date:'第一阶段',label:'核对材料',detail:'保留全部来源',contentRef:'source-a'},{nodeId:'b',date:'第二阶段',label:'交付结果',detail:'核实后保存',contentRef:'source-b'}]}}]},style,{measurer});
  assert(result.ok,JSON.stringify(result.conflicts));
  const es=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  const label=es.find(e=>e.text==='核对材料'),detail=es.find(e=>e.text==='保留全部来源');
  assert.equal(label.contentRef,'source-a');assert.deepEqual(label.dataPath,['nodes',0,'label']);
  assert.deepEqual(detail.dataPath,['nodes',0,'detail']);
 }finally{await measurer.close();}
});
test('dated stage labels and details remain visible when timeline also has business lanes',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const result=await planContentSlide({slideId:'dated-lanes',title:'合成阶段与业务事件',typography:{bodyPt:12},regions:[{regionId:'time',kind:'timeline',data:{nodes:[{nodeId:'a',date:'第一阶段',label:'前期准备',detail:'核实资料',contentRef:'first'},{nodeId:'b',date:'第二阶段',label:'正式交付',detail:'保存成果',contentRef:'second'}],lanes:[{laneId:'business',label:'合成业务',events:[{nodeId:'a',text:'收集输入'},{nodeId:'b',text:'核对输出'}]}]}}]},style,{measurer});
  assert(result.ok,JSON.stringify(result.conflicts));const es=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  for(const copy of ['第一阶段','前期准备','核实资料','第二阶段','正式交付','保存成果','收集输入','核对输出'])assert(es.some(e=>e.text===copy),copy);
  assert.deepEqual(es.find(e=>e.text==='核实资料').dataPath,['nodes',0,'detail']);
 }finally{await measurer.close();}
});
test('staged workflow distinguishes its final step and retains editable step anchors',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const result=await planContentSlide({slideId:'stages',title:'合成工作安排',typography:{bodyPt:12},regions:[{regionId:'flow',kind:'process',data:{presentation:'staged-sequence',nodes:[{nodeId:'a',label:'需求汇入',detail:'多线需求并行'},{nodeId:'b',label:'分工回收',detail:'协作执行与结果回收'}]}}]},style,{measurer});assert(result.ok);
  const es=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  assert.equal(es.find(e=>e.id==='stages-flow/node/b/shape').style.fill,style.palette.ink);
  assert.equal(es.find(e=>e.text==='分工回收').style.color,'#ffffff');
 }finally{await measurer.close();}
});
test('numbered node anchors move their badges and keep independent text geometry',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const result=await planContentSlide({slideId:'anchors',title:'合成拖动节点',typography:{bodyPt:12},regions:[{regionId:'flow',kind:'process',data:{nodes:[{nodeId:'a',label:'核对资料'},{nodeId:'b',label:'保存输出'}]}}]},style,{measurer});assert(result.ok);
  const o=result.slide.objects[0],prefix=o.objectId+'/node/a/',before=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  const b=before.find(e=>e.id===prefix+'shape').bounds;o.overrides[prefix+'shape']={bounds:[b[0]+100,b[1]+60,b[2],b[3]]};
  const after=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  for(const suffix of ['marker','number','label']){const a=after.find(e=>e.id===prefix+suffix),old=before.find(e=>e.id===prefix+suffix);assert.deepEqual(a.bounds,[old.bounds[0]+100,old.bounds[1]+60,...old.bounds.slice(2)],suffix);}
 }finally{await measurer.close();}
});
test('automatic multi-region candidates explore different structures while an explicit layout stays locked',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const content={slideId:'forms',title:'合成主次结构',typography:{bodyPt:12},regions:[{regionId:'lead',kind:'text',paragraphs:[{text:'页面结论'}]},{regionId:'a',kind:'process',data:{nodes:[{nodeId:'n1',label:'材料共用'},{nodeId:'n2',label:'模板复用'}]}},{regionId:'b',kind:'comparison',data:{nodes:[{nodeId:'n1',label:'当前状态'},{nodeId:'n2',label:'目标状态'}]}}]};
  const result=await planContentSlide(content,style,{measurer});assert(result.ok);
  assert(new Set(result.candidates.map(c=>JSON.stringify(c.layout))).size>=2);
  assert(result.slide.planning.formDecisions.some(d=>d.regionId==='a'&&d.presentation==='numbered-sequence'));
  const es=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  assert(es.some(e=>e.id.includes('/node/n1/number')&&e.text==='01'));
  assert(!es.some(e=>e.parentId==='forms-b'&&e.type==='shape'&&e.style.stroke));
  content.layout={direction:'column',children:content.regions.map(r=>({regionId:r.regionId}))};
  const locked=await planContentSlide(content,style,{measurer});assert(locked.ok);
  assert(locked.candidates.every(c=>JSON.stringify(c.layout)===JSON.stringify(content.layout)));
 }finally{await measurer.close();}
});
test('notes attached to a relationship remain inside its column in every automatic candidate',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const content={slideId:'attached',title:'合成信息归属',typography:{bodyPt:12},regions:[{regionId:'a',kind:'process',data:{nodes:[{nodeId:'a',label:'材料输入'},{nodeId:'b',label:'材料输出'}]}},{regionId:'b',kind:'process',data:{nodes:[{nodeId:'a',label:'需求排序'},{nodeId:'b',label:'分工执行'}]}},{regionId:'note',attachedTo:'b',kind:'text',paragraphs:[{text:'业务价值与节点条件'}]}]};
  const result=await planContentSlide(content,style,{measurer});assert(result.ok);
  const regions=result.slide.planning.regions,b=regions.find(r=>r.regionId==='b'),note=regions.find(r=>r.regionId==='note');
  assert.equal(note.bounds[0],b.bounds[0]);assert.equal(note.bounds[2],b.bounds[2]);
  assert(note.bounds[1]>=b.bounds[1]+b.bounds[3]);
 }finally{await measurer.close();}
});
test('a relationship column reserves the measured width of all steps before its attached note',async()=>{
 const measurer=await createLayoutMeasurer();try{
  const nodes=[{nodeId:'a',label:'材料输入',detail:'收集合成资料'},{nodeId:'b',label:'规则整理',detail:'核对字段与来源'},{nodeId:'c',label:'结果输出',detail:'保存可编辑成果'}];
  const result=await planContentSlide({slideId:'width-budget',title:'合成宽度预算',typography:{bodyPt:12},regions:[{regionId:'a',kind:'process',data:{nodes}},{regionId:'b',kind:'process',data:{presentation:'staged-sequence',nodes:nodes.map(n=>({...n,detail:'整理并保存'}))}},{regionId:'note',attachedTo:'b',kind:'text',paragraphs:[{text:'说明内容属于右侧模块，需要按段落换行，不应挤占另一条关系链的阅读空间。'}]}]},style,{measurer});
  assert(result.ok);const es=deriveSlideElements(result.slide,resolveSlideStyle(result.slide));
  const details=es.filter(e=>e.parentId==='width-budget-a'&&e.id.endsWith('/detail')),ms=await measurer.texts(details,style);
  for(const [i,e] of details.entries())assert(e.bounds[2]>=ms[i].naturalWidth,e.text);
 }finally{await measurer.close();}
});
