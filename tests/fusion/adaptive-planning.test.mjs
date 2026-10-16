import test from 'node:test';
import assert from 'node:assert/strict';
import * as planning from '../../skills/dawang-ppt/project/src/fusion/planning/plan-slide.mjs';
import { resolveStyle } from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import { lintSlide } from '../../skills/dawang-ppt/project/src/fusion/kimi/design-lint.mjs';
import { layoutImages } from '../../skills/dawang-ppt/project/src/fusion/scene/image-layout.mjs';
const title = { id:'title', type:'text', role:'title', text:'明确关系', bounds:[100,80,1700,100], style:{fontSize:60} };
test('shared planner offers content-dependent candidates for every adapted skin without style-id dispatch', () => {
  assert.equal(typeof planning.generateLayoutCandidates, 'function');
  const content = {slideId:'steps', title:'三个步骤', relation:'process', data:{nodes:['a','b','c'].map(nodeId=>({nodeId,label:nodeId}))}};
  for (const id of ['legacy/theme14','legacy/theme06','legacy/theme13','legacy/theme17']) {
    const style = resolveStyle(id), renamed = {...style,id:'renamed'};
    const a = planning.generateLayoutCandidates(content, style), b = planning.generateLayoutCandidates(content, renamed);
    assert(a.length >= 2 && a.length <= 3);
    assert.deepEqual(a.map(c=>c.presetId), b.map(c=>c.presetId));
    assert(a.every(c=>c.slide.mode==='composition' && c.slide.objects[0].layoutVersion===2));
    assert(new Set(a.map(c=>JSON.stringify(c.slide.objects[0].data.direction))).size > 1);
  }
});
test('semantic matrix and connected process are not mistaken for decorative cards, small body still fails', () => {
  const objects=[{objectId:'relation',kind:'matrix'}];
  const es=[title,...[0,1,2,3].flatMap(i=>{
    const b=[100+i%2*500,250+Math.floor(i/2)*300,450,250];
    return [{id:'s'+i,parentId:'relation',type:'shape',bounds:b,style:{fill:'#eeeeee'}},{id:'t'+i,parentId:'relation',type:'text',role:'body',text:'关系',bounds:[b[0]+20,b[1]+20,400,100],style:{fontSize:28}}];
  })];
  assert.deepEqual(lintSlide({slideId:'matrix',objects,elements:es}), []);
  const decorative=es.map(({parentId,...e})=>e);
  assert(lintSlide({slideId:'cards',elements:decorative}).some(i=>i.rule==='no-cards'));
  es[2].style.fontSize=26;
  assert(lintSlide({slideId:'small',objects,elements:es}).some(i=>i.rule==='body-min-14pt'));
});
test('justified image layout uses true mixed ratios, keeps screenshots whole and focal coordinates', () => {
  const images=[{mediaId:'portrait',width:300,height:600,src:'p',focal:'30% 40%'},{mediaId:'landscape',width:900,height:500,src:'l'},{mediaId:'screen',width:900,height:1600,src:'s',kind:'screenshot'}];
  const es=layoutImages({objectId:'photos',bounds:[100,200,1700,700],data:{arrangement:'justified',images}},resolveStyle('legacy/theme14'));
  assert.equal(es.length,3);
  assert.equal(es[0].focal,'30% 40%');
  assert.equal(es[2].fit,'contain');
  es.forEach((e,i)=>assert(Math.abs(e.bounds[2]/e.bounds[3]-images[i].width/images[i].height)<0.01));
  assert.throws(()=>layoutImages({objectId:'bad',bounds:[0,0,100,100],data:{arrangement:'justified',images:[{mediaId:'unknown',src:'x'}]}},resolveStyle('legacy/theme14')),/size|ratio|尺寸/i);
});
test('measured planner rejects overflow rather than dropping required text, and retains 12-row table', async () => {
  assert.equal(typeof planning.planContentSlide,'function');
  const {createLayoutMeasurer}=await import('../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs');
  const measurer=await createLayoutMeasurer();
  try {
    const style=resolveStyle('legacy/theme14');
    const rows=Array.from({length:12},(_,i)=>({rowId:'r'+i,cells:{item:'事项'+i,evidence:'完整的合成证据文字',state:'待核实'}}));
    const result=await planning.planContentSlide({slideId:'long-table',title:'保留全部十二行',relation:'tabular',source:'公开合成数据',data:{columns:[{columnId:'item',label:'事项',width:1},{columnId:'evidence',label:'证据',width:3},{columnId:'state',label:'状态',width:1}],rows}},style,{measurer});
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(result.slide.objects[0].data.rows.length,12);
    assert.equal(result.candidates.length,3);
    assert.equal(result.candidates.find(c=>c.selected).measurement.issues.length,0);
    assert(result.candidates.every(c=>c.measurement?.engine==='chromium-dom'));
    const dense=await planning.planContentSlide({slideId:'dense',title:'内容不得删除',relation:'text',points:[{body:'必需文字'.repeat(2000)}]},style,{measurer});
    assert.equal(dense.ok,false);
    assert(dense.conflicts.some(c=>c.kind==='no-fitting-layout'));
    assert(dense.candidates.every(c=>c.measurement.issues.some(i=>['text-overflow','outside-canvas'].includes(i.kind))));
  } finally {await measurer.close();}
});
test('new relation planning uses the lower content area and never emits sub-14pt body', async () => {
  const {createLayoutMeasurer}=await import('../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs');
  const {deriveSlideElements}=await import('../../skills/dawang-ppt/project/src/fusion/objects/index.mjs');
  const measurer=await createLayoutMeasurer();
  try {
    for (const kind of ['process','timeline']) for(const count of [2,5,9]) {
      const style=resolveStyle('legacy/theme14');
      const result=await planning.planContentSlide({slideId:kind+count,title:'合成关系验证',relation:kind,data:{nodes:Array.from({length:count},(_,i)=>({nodeId:'n'+i,label:'阶段'+i,date:'阶段 '+i,detail:'保留节点说明'}))}},style,{measurer});
      assert(result.ok,JSON.stringify(result));
      const selected=result.candidates.find(c=>c.selected);
      assert(selected.measurement.contentEnvelopeFill>=0.7,JSON.stringify({kind,count,fill:selected.measurement.contentEnvelopeFill}));
      const texts=deriveSlideElements(result.slide,style).filter(e=>e.type==='text' && e.parentId);
      assert(texts.every(e=>e.style.fontSize>=28),JSON.stringify(texts));
    }
  } finally {await measurer.close();}
});
test('image evidence keeps all supplied explanation and points beside the photographs', async () => {
  const {createLayoutMeasurer}=await import('../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs');
  const {deriveSlideElements}=await import('../../skills/dawang-ppt/project/src/fusion/objects/index.mjs');
  const measurer=await createLayoutMeasurer();
  try {
    const style=resolveStyle('legacy/theme14');
    const result=await planning.planContentSlide({slideId:'mixed',title:'图片与证据',relation:'photographic',explanation:'必须保留的说明',points:[{heading:'可核对事实',body:'此处是完整事实与口径'}],data:{images:[{mediaId:'a',width:400,height:600,src:'synthetic'},{mediaId:'b',width:900,height:600,src:'synthetic'}]}},style,{measurer});
    assert(result.ok,JSON.stringify(result));
    const text=deriveSlideElements(result.slide,style).map(e=>e.text).join('\n');
    for(const required of ['必须保留的说明','可核对事实','此处是完整事实与口径']) assert(text.includes(required),required);
  } finally {await measurer.close();}
});
test('short paragraphs use measured heights and natural gaps, with an explicit approved whitespace policy',async()=>{
  const {createLayoutMeasurer}=await import('../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs');
  const measurer=await createLayoutMeasurer();
  try {
    const result=await planning.planContentSlide({slideId:'short',title:'短文字仍保留清晰层级',relation:'text',points:[{heading:'判断',body:'这是第一段短说明。'},{heading:'行动',body:'这是第二段短说明。'}]},resolveStyle('legacy/theme14'),{measurer});
    assert(result.ok,JSON.stringify(result));
    const a=result.slide.elements.find(e=>e.id==='point/0/body'),b=result.slide.elements.find(e=>e.id==='point/1/heading');
    const actual=result.candidates.find(c=>c.selected).measurement.texts.find(e=>e.id===a.id);
    assert(a.bounds[3]<=actual.height+3,'text boxes must track the measured text height');
    assert(b.bounds[1]-(a.bounds[1]+a.bounds[3])<=48,'no equal-height empty block between paragraphs');
    assert.equal(result.slide.planning.measurement.fillPolicy,'short-text-whitespace');
  } finally {await measurer.close();}
});
test('mixed caption presence does not change any justified photo aspect ratio',()=>{
  const images=[{mediaId:'one',width:300,height:600,src:'p',caption:'唯一图注'},{mediaId:'two',width:900,height:500,src:'l'}];
  const es=layoutImages({objectId:'captioned',bounds:[100,200,1700,700],data:{arrangement:'justified',images}},resolveStyle('legacy/theme14')).filter(e=>e.type==='image');
  es.forEach((e,i)=>assert(Math.abs(e.bounds[2]/e.bounds[3]-images[i].width/images[i].height)<0.01));
});
