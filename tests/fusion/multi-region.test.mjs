import test from 'node:test';
import assert from 'node:assert/strict';
import {planContentSlide} from '../../skills/dawang-ppt/project/src/fusion/planning/plan-slide.mjs';
import {createLayoutMeasurer} from '../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';
import {resolveStyle} from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {deriveSlideElements} from '../../skills/dawang-ppt/project/src/fusion/objects/index.mjs';

test('measured multi-region page preserves table, unequal process nodes, short copy and whole images',async()=>{
 const measurer=await createLayoutMeasurer();
 try {
  const content={slideId:'multi',title:'合成公开材料的多区域页面',section:'合成验证',regions:[
   {regionId:'summary',kind:'text',paragraphs:[{text:'短说明保留自然留白。'}]},
   {regionId:'table',kind:'table',heading:'核对清单',data:{columns:[{columnId:'name',label:'事项'},{columnId:'detail',label:'完整说明'}],rows:[{rowId:'r1',cells:{name:'短项',detail:'需要完整保留的较长合成证据文字与检查条件'}},{rowId:'r2',cells:{name:'第二项',detail:'短说明'}}]}},
   {regionId:'flow',kind:'process',heading:'复用步骤',data:{nodes:[{nodeId:'a',label:'输入'},{nodeId:'b',label:'按内容测量',detail:'完整保留这项较长节点说明'},{nodeId:'c',label:'输出'}]}},
   {regionId:'images',kind:'images',data:{images:[{mediaId:'p',width:400,height:700,src:'synthetic',caption:'完整截图的较长来源说明',fit:'contain'},{mediaId:'l',width:900,height:500,src:'synthetic',fit:'contain'}]}}
  ],layout:{direction:'column',children:[{regionId:'summary'},{direction:'row',children:[{regionId:'table'},{regionId:'images'}]},{regionId:'flow'}]}};
  const result=await planContentSlide(content,resolveStyle('legacy/theme14'),{measurer});
  assert(result.ok,JSON.stringify(result));
  assert.equal(result.slide.objects.length,3);
  assert(result.slide.planning.presetId.startsWith('theme14/'));
  assert.equal(result.candidates.length,3);
  const table=result.slide.objects.find(o=>o.kind==='table');
  assert(table.data.columns[1].width>table.data.columns[0].width);
  const elements=deriveSlideElements(result.slide,resolveStyle('legacy/theme14'));
  assert(elements.some(e=>e.text==='短说明保留自然留白。'));
  assert(elements.some(e=>e.text==='需要完整保留的较长合成证据文字与检查条件'));
  const nodes=elements.filter(e=>e.id.startsWith('multi-flow/node/')&&e.id.endsWith('/shape'));
  assert(nodes[1].bounds[2]>nodes[0].bounds[2]);
  const images=elements.filter(e=>e.type==='image');
  assert(elements.some(e=>e.text?.includes('完整截图的较长来源说明')));
  assert.equal(images.length,2);assert(images.every(e=>e.fit==='contain'));
  assert.equal(result.slide.planning.measurement.issues.length,0);
 } finally{await measurer.close();}
});
test('multi-region content overflow is rejected without silently omitting any region',async()=>{
 const measurer=await createLayoutMeasurer();
 try {
  const result=await planContentSlide({slideId:'too-long',title:'合成超长输入',regions:[{regionId:'long',kind:'text',paragraphs:[{text:'禁止静默删减'.repeat(1800)}]}]},resolveStyle('legacy/theme14'),{measurer});
  assert.equal(result.ok,false);assert.equal(result.candidates.length,3);assert(result.candidates.every(c=>c.measurement.issues.length));
 }finally{await measurer.close();}
});
