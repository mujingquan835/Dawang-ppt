import test from 'node:test';import assert from 'node:assert/strict';
import {roleGroup,schedule,capacityFlow,measureModule} from '../../skills/dawang-ppt/project/src/fusion/authoring/capacity-kit.mjs';
const people=()=>[{id:'a',ref:'a',name:'主播 A',role:'营销负责人',detail:'价值讲解与政策答疑'},{id:'c',ref:'c',name:'场控 C',role:'福利官',detail:'上链接、答疑与抽奖',placeholder:'形象待补'}];
const spec=()=>({id:'roles',bounds:[100,200,700,650],items:people()});
test('roles retain missing-photo state and grow rows for long names without shrinking text',()=>{
 const a=roleGroup(spec()),s=spec();s.items[0].name='很长的主播名称与职责说明'.repeat(8);const b=roleGroup(s);
 assert(b.rows[0].bounds[3]>a.rows[0].bounds[3]);assert.equal(b.elements.find(e=>e.id==='roles-a-name').style.fontSize,30);assert(b.elements.some(e=>e.text==='形象待补'));assert.equal(b.bindings.length,2);assert.equal(s.items[0].name,b.elements.find(e=>e.id==='roles-a-name').text);
});
test('height shortages return reflow or cannot-fit and tag every generated element',()=>{
 const s=spec();s.bounds[3]=100;const r=roleGroup(s);assert.equal(r.capacity.status,'needs-reflow');assert(r.elements.every(e=>e.capacityModule.status==='needs-reflow'));
 s.items[0].detail='信息不能被丢弃。'.repeat(200);const huge=roleGroup(s);assert.equal(huge.capacity.status,'cannot-fit');assert.equal(huge.elements.find(e=>e.id==='roles-a-detail').text,s.items[0].detail);
});
test('schedule grows each row to its tallest cell and binds relation rows',()=>{
 const s={id:'times',bounds:[100,200,1000,650],relationRef:'r',rows:[{id:'morning',time:'10:00—12:00',content:'沙盘与政策',people:'A + C'},{id:'evening',time:'19:00—21:00',content:'长场次内容'.repeat(30),people:'A + B + C'}]};const r=schedule(s);assert(r.rows[1].bounds[3]>r.rows[0].bounds[3]);assert.deepEqual(r.bindings.map(b=>b.rowId),['morning','evening']);assert(r.occupiedBounds[3]>0);
});
test('measured layout replaces estimates and reports measurement failure',async()=>{
 const s=spec();const r=await measureModule(roleGroup,s,{texts:async texts=>texts.map(e=>({id:e.id,height:200,width:e.bounds[2],fontAvailable:true}))});assert.equal(r.capacity.method,'measured');assert(r.rows[0].bounds[3]>=600);
 await assert.rejects(()=>measureModule(roleGroup,s,{texts:async()=>[]}),/Incomplete/);
});
test('flow repositions details after measured wrapped titles',async()=>{
 const r=await measureModule(capacityFlow,{id:'flow',bounds:[100,100,1400,800],steps:[{id:'a',title:'核对',detail:'检查资料',ref:'a'},{id:'b',title:'确认',detail:'进入执行',ref:'b'}]},{texts:async texts=>texts.map(e=>({id:e.id,height:e.id.includes('title')?160:40,width:e.bounds[2],fontAvailable:true}))});
 const t=r.elements.find(e=>e.id==='flow-title-a'),d=r.elements.find(e=>e.id==='flow-detail-a');assert.equal(t.bounds[3],164);assert(d.bounds[1]>=t.bounds[1]+t.bounds[3]);assert.equal(r.bindings.length,2);
});
test('invalid bounds, duplicate identities and impossible column widths fail explicitly',()=>{
 assert.throws(()=>roleGroup({...spec(),bounds:[0,0,100,300]}));assert.throws(()=>roleGroup({...spec(),items:[people()[0],people()[0]]}));assert.throws(()=>schedule({id:'x',bounds:[0,0,500,500],columns:[{key:'a',label:'a',width:100}],rows:[{id:'r',a:'x'}]}));
});
test('unresolved capacity blocks visual checking even if geometry fits the canvas',async()=>{
 const {createAuthoredProject}=await import('../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs');
 const {reviewVisualDecisions}=await import('../../skills/dawang-ppt/project/src/fusion/qa/visual-decisions.mjs');
 const {semanticFixture}=await import('./helpers/semantic-fixture.mjs');
 const p=createAuthoredProject(semanticFixture());p.slides[0].elements.push(...roleGroup({...spec(),bounds:[100,200,700,100]}).elements);
 assert(reviewVisualDecisions(p).issues.some(i=>i.kind==='module-capacity-unresolved'));
});
test('schedule and flow identities survive row or step reordering',()=>{
 const rows=[{id:'am',time:'上午',content:'介绍',people:'A'},{id:'pm',time:'下午',content:'答疑',people:'B'}],base={id:'s',bounds:[100,200,1000,500]};
 const a=schedule({...base,rows}),b=schedule({...base,rows:[...rows].reverse()});assert.equal(a.elements.find(e=>e.id==='s-row-am-content').text,b.elements.find(e=>e.id==='s-row-am-content').text);
 const steps=[{id:'one',title:'第一项'},{id:'two',title:'第二项'}];const f=capacityFlow({...base,steps}),g=capacityFlow({...base,steps:[...steps].reverse()});assert.equal(f.elements.find(e=>e.id==='s-title-one').text,g.elements.find(e=>e.id==='s-title-one').text);
});
