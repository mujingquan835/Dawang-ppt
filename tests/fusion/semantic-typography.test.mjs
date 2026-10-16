import test from 'node:test';import assert from 'node:assert/strict';
import {planContentSlide} from '../../skills/dawang-ppt/project/src/fusion/planning/plan-slide.mjs';
import {createLayoutMeasurer} from '../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';
import {resolveStyle} from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {deriveSlideElements} from '../../skills/dawang-ppt/project/src/fusion/objects/index.mjs';
const style=resolveStyle('legacy/theme14');
test('semantic bands distinguish identity, support tag, context and action and keep all copy',async()=>{
 const measurer=await createLayoutMeasurer();try{
 const result=await planContentSlide({slideId:'bands',title:'合成语义层级',typographyPolicy:'semantic',regions:[{regionId:'table',kind:'table',data:{presentation:'bands',columns:[{columnId:'who',label:'业务',semanticRole:'identity'},{columnId:'context',label:'现状',semanticRole:'context'},{columnId:'action',label:'行动',semanticRole:'action'}],rows:[{rowId:'r',cells:{who:'合成业务',context:'需要核实的背景',action:'下一步行动'},secondaryCells:{who:{text:'重点支持',semanticRole:'emphasis'}}}]}}]},style,{measurer});
 assert(result.ok,JSON.stringify(result.conflicts));const es=deriveSlideElements(result.slide,style);
 const find=t=>es.find(e=>e.text===t);
 assert(find('重点支持'));assert(find('合成业务').style.fontSize>find('重点支持').style.fontSize);
 assert.notEqual(find('需要核实的背景').style.color,find('下一步行动').style.color);
 assert.equal(find('重点支持').style.color,style.palette.accent);
 assert(!es.filter(e=>e.type==='line').some(e=>e.style.stroke===style.palette.accent));
 }finally{await measurer.close();}
});
test('inline sequence is unboxed and context/action styles survive individual step editing',async()=>{
 const measurer=await createLayoutMeasurer();try{
 const result=await planContentSlide({slideId:'flows',title:'合成流程对比',typographyPolicy:'semantic',regions:['context','action'].map(role=>({regionId:role,kind:'process',data:{presentation:'inline-sequence',semanticRole:role,nodes:[{nodeId:'a',label:'输入材料'},{nodeId:'b',label:'核对后输出'}]}}))},style,{measurer});
 assert(result.ok,JSON.stringify(result.conflicts));const es=deriveSlideElements(result.slide,style);
 assert(!es.some(e=>e.type==='shape'&&e.id.includes('/node/')));
 assert.notEqual(es.find(e=>e.parentId==='flows-context'&&e.type==='text').style.color,es.find(e=>e.parentId==='flows-action'&&e.type==='text').style.color);
 assert(es.filter(e=>e.type==='text'&&e.parentId).every(e=>e.style.fontWeight===400));
 }finally{await measurer.close();}
});
test('invisible metadata does not change column widths and emphasis prefixes remain separate editable text',async()=>{
 const measurer=await createLayoutMeasurer();try{
 const content={slideId:'widths',title:'合成内容宽度',typographyPolicy:'semantic',regions:[{regionId:'left',kind:'text',paragraphs:[{prefix:{text:'应用说明｜',semanticRole:'emphasis'},text:'保留完整说明文字'}]},{regionId:'right',kind:'text',paragraphs:[{text:'另一条合成说明'}]}],layout:{direction:'row',children:[{regionId:'left'},{regionId:'right'}]}};
 const a=await planContentSlide(content,style,{measurer});content.regions[1].debugSourcePath='x'.repeat(3000);
 const b=await planContentSlide(content,style,{measurer});assert(a.ok&&b.ok);
 assert.deepEqual(a.slide.planning.regions.map(r=>r.bounds),b.slide.planning.regions.map(r=>r.bounds));
 const es=a.slide.elements;assert(es.some(e=>e.text==='应用说明｜'&&e.semanticRole==='emphasis'));assert(es.some(e=>e.text==='保留完整说明文字'));
 }finally{await measurer.close();}
});
test('semantic lint catches an accidental border on an explicitly unboxed sequence',async()=>{
 const {lintSlide}=await import('../../skills/dawang-ppt/project/src/fusion/kimi/design-lint.mjs');
 const issues=lintSlide({slideId:'a',typographyPolicy:'semantic',objects:[{objectId:'f',kind:'process',data:{presentation:'inline-sequence'}}],elements:[{id:'title',type:'text',role:'title',text:'合成',bounds:[0,0,100,50]},{id:'f/node/a/shape',parentId:'f',type:'shape',bounds:[0,100,300,80],style:{stroke:'#eee'}}]});
 assert(issues.some(i=>i.rule==='unboxed-sequence'));
});
test('semantic body and quiet colors repaint with the skin without becoming frozen brand colors',async()=>{
 const {bindElementAppearance,changeSlideAppearance}=await import('../../skills/dawang-ppt/project/src/fusion/styles/appearance.mjs');
 const before={...style,palette:{...style.palette,body:'#1F2937',quiet:'#C9D2DC'}},after=resolveStyle('legacy/theme17');
 const elements=['body','quiet'].map((key,i)=>bindElementAppearance({id:'t'+i,type:'text',role:'body',text:'合成',bounds:[0,i*60,300,50],style:{fontSize:28,color:before.palette[key]}},before));
 const result=changeSlideAppearance({styleId:before.id,styleBindingVersion:1,elements,objects:[]},before,after);
 assert.equal(result.elements[0].style.color,after.palette.body||after.palette.ink);assert.equal(result.elements[1].style.color,after.palette.quiet||after.palette.line);
});
