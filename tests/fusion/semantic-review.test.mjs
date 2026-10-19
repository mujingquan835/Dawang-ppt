import test from 'node:test';
import assert from 'node:assert/strict';
import {planContentSlide} from '../../skills/dawang-ppt/project/src/fusion/planning/plan-slide.mjs';
import {createLayoutMeasurer} from '../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';
import {resolveStyle,resolveSlideStyle} from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {deriveSlideElements} from '../../skills/dawang-ppt/project/src/fusion/objects/index.mjs';
const style=resolveStyle('legacy/theme14');
test('content review surfaces unclassified quantitative prose instead of silently passing it',async()=>{
 const {reviewContent}=await import('../../skills/dawang-ppt/project/src/fusion/planning/content-review.mjs');
 const content={regions:[{regionId:'r',kind:'text',paragraphs:[{text:'合成物资 300 份',contentRef:'fact'}]}]};
 assert(reviewContent(content).some(i=>i.rule==='quantity-review-required'));
 content.regions[0].paragraphs[0].dataDecision={nature:'resource',presentation:'prose',reason:'次要支撑，保留在说明中'};
 assert.equal(reviewContent(content).length,0);
 content.regions[0].paragraphs[0].dataDecision.reason='';
 assert(reviewContent(content).some(i=>i.rule==='quantity-review-required'));
});
test('balanced evidence uses spare height and centers each measured cell without growing body type',async()=>{
 const m=await createLayoutMeasurer();try{
  const c={slideId:'balanced',title:'合成表格与说明',typography:{bodyPt:12},typographyPolicy:'semantic',spacingPolicy:'balanced-evidence',regions:[{regionId:'t',kind:'table',data:{verticalAlign:'middle',columns:[{columnId:'a',label:'名称',semanticRole:'identity'},{columnId:'b',label:'说明'}],rows:[{rowId:'r',cells:{a:'业务',b:'正文'}}]}},{regionId:'note',kind:'text',paragraphs:[{text:'辅助说明',semanticRole:'support'}]}]};
  const a=await planContentSlide(c,style,{measurer:m});assert(a.ok);
  const o=a.slide.objects[0],es=deriveSlideElements(a.slide,resolveSlideStyle(a.slide));
  const cell=es.find(e=>e.id.endsWith('/cell/r/b/text')),cm=o.data.cellMetrics['r/b'];
  const rowTop=o.bounds[1]+o.data.headerWeight;
  assert(Math.abs(cell.bounds[1]-(rowTop+(o.data.rows[0].height-cm.primaryHeight)/2))<.1);
  assert.equal(cell.style.fontSize,24);
  assert(o.data.rows[0].height>=76);
  assert(a.slide.planning.visualReview);
 }finally{await m.close();}
});
test('required content review blocks unclassified data before geometry and allows explained supporting prose',async()=>{
 const c={slideId:'review',title:'合成来源',contentReview:'required',regions:[{regionId:'r',kind:'text',paragraphs:[{text:'投入 20 箱',contentRef:'source'}]}]};
 const failed=await planContentSlide(c,style,{measurer:{}});assert.equal(failed.ok,false);assert(failed.conflicts.some(i=>i.rule==='quantity-review-required'));
 const {reviewContent}=await import('../../skills/dawang-ppt/project/src/fusion/planning/content-review.mjs');
 c.regions=[{regionId:'r',kind:'metrics',data:{items:[{value:'20箱',label:'资源投入',nature:'resource',valueRef:'source-value',labelRef:'source-label'}]}}];
 assert.deepEqual(reviewContent(c),[]);delete c.regions[0].data.items[0].nature;assert(reviewContent(c).some(i=>i.rule==='metric-basis-required'));
});
