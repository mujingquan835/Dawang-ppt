import test from 'node:test';import assert from 'node:assert/strict';
import {semanticFixture} from './helpers/semantic-fixture.mjs';
import {createContentBaseline,validateContentBaseline} from '../../skills/dawang-ppt/project/src/fusion/authoring/content-baseline.mjs';
import {reviewComposition} from '../../skills/dawang-ppt/project/src/fusion/authoring/composition-contract.mjs';
import {panelGroup,capacityTable,allocationList,capacityCycle,measureModule} from '../../skills/dawang-ppt/project/src/fusion/authoring/capacity-kit.mjs';
import {createTheme} from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';
import {createLayoutMeasurer} from '../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';
function baseline(){const p=semanticFixture();for(const item of [...Object.values(p.contentPlan.nodes),...p.contentPlan.relations])item.sourceLocations=[{sourceId:'s',locator:'section 1',excerpt:'合成测试来源'}];p.requirements.contentBaselineContract='source-baseline-v1';p.contentPlan.baseline=createContentBaseline({id:'v1',...p.contentPlan});return p;}
test('source baseline detects lost content, relationship drift and replacement independently',()=>{const p=baseline(),original=structuredClone(p.contentPlan.baseline);assert.deepEqual(validateContentBaseline(p,original),[]);delete p.contentPlan.nodes.a;assert.ok(validateContentBaseline(p,original).some(i=>i.field==='nodes'));p.contentPlan.baseline.snapshot.nodes={};assert.ok(validateContentBaseline(p,original).some(i=>i.kind==='content-baseline-replaced'));});
test('baseline rejects generic source references without locations and does not absorb slides',()=>{const p=semanticFixture();assert.throws(()=>createContentBaseline({id:'b',...p.contentPlan}),/sourceLocations/);const b=baseline();assert.equal(b.contentPlan.baseline.snapshot.slides,undefined);});
function page(){return {slideId:'p',visualDecision:{zones:[{id:'a',bounds:[0,0,400,500]},{id:'b',bounds:[440,0,400,500]}]},regions:['a','b'].map((id,i)=>({zoneId:id,frameElementId:id,module:{name:'panel',variant:'summary'},typography:{title:30,body:24},designReference:{source:'local case',principle:'shared boundaries'},hierarchy:i?'secondary':'primary',padding:20,bindings:[]})),composition:{alignments:[{edge:'bottom',zones:['a','b']}],gaps:[{from:'a',to:'b',axis:'horizontal',min:40}]}};}
test('regional contract rejects misalignment, overlapping lanes and missing design decisions',()=>{const p=page();assert.deepEqual(reviewComposition(p,new Map(p.visualDecision.zones.map(z=>[z.id,{type:'shape',bounds:z.bounds}]))),[]);p.visualDecision.zones[1].bounds=[390,0,400,450];delete p.regions[1].module;const kinds=reviewComposition(p,new Map()).map(i=>i.kind);for(const k of ['alignment-violated','composition-gap-violated','region-design-required'])assert.ok(kinds.includes(k));});
function spec(){return {id:'pair',bounds:[100,220,1700,700],panels:[3,6].map((n,i)=>({id:'p'+i,title:i?'效果预估':'预算分配',summary:i?'15—20 组':'10,000 元',distributeRows:true,builder:s=>capacityTable({...s,columns:[{key:'value',label:'明细',width:s.bounds[2]}]}),spec:{rows:Array.from({length:n},(_,j)=>({id:'r'+j,value:'测试条目 '+j})),size:24}}))};}
test('measured composition aligns three versus six rows without deleting or shrinking content',async()=>{const m=await createLayoutMeasurer();try{const r=await measureModule(panelGroup,spec(),m);assert.equal(r.capacity.status,'fits');assert.equal(r.capacity.method,'measured');assert.equal(r.regions[0].bodyBounds[1],r.regions[1].bodyBounds[1]);const rules=r.elements.filter(e=>e.id.endsWith('-rule-r2')||e.id.endsWith('-rule-r5'));assert.equal(rules[0].bounds[1],rules.at(-1).bounds[1]);assert.equal(r.elements.filter(e=>e.id.includes('-row-')).length,9);assert.ok(r.elements.filter(e=>e.id.includes('-row-')).every(e=>e.style.fontSize===24));const crowded=spec();crowded.bounds[3]=220;assert.notEqual((await measureModule(panelGroup,crowded,m)).capacity.status,'fits');}finally{await m.close();}});

test('actual project validation enforces both new opt-in contracts',async()=>{const {validateContentModel}=await import('../../skills/dawang-ppt/project/src/fusion/authoring/content-model.mjs');const {reviewPagePlan}=await import('../../skills/dawang-ppt/project/src/fusion/authoring/page-plan.mjs');const p=baseline();const {createAuthoredProject}=await import('../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs');assert.deepEqual(validateContentModel(p),[]);p.requirements.compositionContract='regional-composition-v1';assert.ok(reviewPagePlan(createAuthoredProject(p)).issues.some(i=>i.kind==='composition-required'));p.contentPlan.nodes.a.text='替换事实';assert.ok(validateContentModel(p).some(i=>i.kind==='content-baseline-drift'));p.requirements.compositionContract='regional-composition-v1';p.requirements.compositionContract='unknown';assert.ok(validateContentModel(p).some(i=>i.kind==='unsupported-authoring-contract'));});
test('alignment requires a real matching frame, not only declared empty zones',()=>{const p=page();assert.ok(reviewComposition(p,new Map()).some(i=>i.kind==='alignment-frame-required'));const e=new Map(p.visualDecision.zones.map(z=>[z.id,{type:'shape',bounds:[...z.bounds]}]));e.get('b').bounds[3]=430;const kinds=reviewComposition(p,e).map(i=>i.kind);assert.ok(kinds.includes('region-frame-mismatch'));assert.ok(kinds.includes('alignment-violated'));});
test('unified typography roles apply headingFamily, metricRuns and enforce declared role sizes on bound elements',()=>{
 const theme=createTheme({fontFamily:'PingFang SC',headingFamily:'Songti SC',palette:{accent:'#23338B',ink:'#1F2430'}});
 assert.equal(theme.roleStyle('pageTitle').fontFamily,'Songti SC');
 assert.equal(theme.roleStyle('body').fontFamily,'PingFang SC');
 assert.equal(theme.font(30,{fontWeight:700}).fontFamily,'Songti SC');
 const mr=theme.metricRuns('10,000','元');
 assert.equal(mr.runs[0].style.fontSize,80);assert.equal(mr.runs[1].style.fontSize,26);
 const p=page();p.typographyRoles=theme.roles;delete p.regions[0].frameElementId;delete p.regions[1].frameElementId;p.regions[0].openGroup=true;p.regions[1].openGroup=true;
 p.regions[0].bindings=[{ref:'r1',elementIds:['t1']}];p.regions[1].bindings=[{ref:'r2',elementIds:['t2']}];
 const els=new Map([['t1',{id:'t1',type:'text',bounds:[20,100,200,380],style:{fontSize:30}}],['t2',{id:'t2',type:'text',bounds:[460,100,200,380],style:{fontSize:24}}]]);
 assert.deepEqual(reviewComposition(p,els),[]);
 els.get('t2').style.fontSize=29;
 assert.ok(reviewComposition(p,els).some(i=>i.kind==='region-typography-mismatch'));
});
test('capacityCycle measures clockwise closed loop with center metric, leader lines and return edge bindings',async()=>{
 const m=await createLayoutMeasurer();
 try{
  const theme=createTheme({palette:{accent:'#23338B',gold:'#B58A42',ink:'#1F2430',pale:'#F0F2F9'}});
  const cycleSpec={id:'cycle',bounds:[96,190,1060,780],theme,relationRef:'route',center:{value:'约40分钟',label:'一轮走播',ref:'dur'},note:{text:'动线示意，非实际平面图',ref:'note'},nodes:[
   {id:'n1',title:'迎宾区',detail:'开场·政策·抽奖',ref:'p1'},
   {id:'n2',title:'沙盘区',detail:'区位·项目规划',ref:'p2'},
   {id:'n3',title:'样板间',detail:'2—3个主力户型带看',ref:'p3'},
   {id:'n4',title:'商业/园林',detail:'配套展示·客户互动',ref:'p4'}
  ]};
  const r=await measureModule(capacityCycle,cycleSpec,m);
  assert.equal(r.capacity.status,'fits');assert.equal(r.capacity.method,'measured');
  assert.equal(r.bindings.filter(b=>b.ref==='route'&&b.edgeId).length,4);
  assert.equal(r.elements.find(e=>e.id==='cycle-node-n1').style.fill,'#B58A42');
  assert.equal(r.elements.find(e=>e.id==='cycle-arc-e4').style.stroke,'#B58A42');
  const tiny=await measureModule(capacityCycle,{...cycleSpec,bounds:[96,190,460,260]},m);
  assert.notEqual(tiny.capacity.status,'fits');
 }finally{await m.close();}
});
test('unequal panelGroup with structured summary, allocationList proportion bar and highlighted table rows fits',async()=>{
 const m=await createLayoutMeasurer();
 try{
  const theme=createTheme({palette:{accent:'#23338B',gold:'#B58A42',ink:'#1F2430',pale:'#F0F2F9',highlightBg:'#F7F0E3'}});
  const r=await measureModule(panelGroup,{id:'p5',bounds:[96,190,1728,720],shares:[0.44,0.56],theme,panels:[
   {id:'budget',title:'投流总预算',summary:{value:'10,000',unit:'元'},distributeRows:true,builder:allocationList,spec:{relationRef:'alloc',items:[
    {id:'dy',title:'抖音 DOU+ / 千川',detail:'直播间进场、留资组件',amount:'6,000',share:'60%',highlight:true,ref:'c1'},
    {id:'qw',title:'企微 / 朋友圈',detail:'精准触达周边意向客户',amount:'2,500',share:'25%',ref:'c2'},
    {id:'sp',title:'短视频预热',detail:'活动预告视频引流直播间',amount:'1,500',share:'15%',ref:'c3'}
   ]}},
   {id:'forecast',title:'预计到店',summary:{value:'15—20',unit:'组'},distributeRows:true,builder:s=>capacityTable({...s,columns:[{key:'stage',label:'指标',width:s.bounds[2]*0.24},{key:'value',label:'预估值',width:s.bounds[2]*0.32,emphasize:true},{key:'basis',label:'测算依据',width:s.bounds[2]*0.44}]}),spec:{size:22,padY:10,rows:[
    {id:'r1',stage:'总曝光量',value:'20—25万次',basis:'CPM 约 40—50 元',ref:'f1'},
    {id:'r2',stage:'观看人次',value:'8,000—12,000人次',basis:'进入率约 4—5%',ref:'f2'},
    {id:'r3',stage:'留资线索',value:'250—350组',basis:'留资率约 3%',ref:'f3'},
    {id:'r4',stage:'有效线索',value:'80—120组',basis:'有效率约 35%',ref:'f4'},
    {id:'r5',stage:'预计到店',value:'15—20组',basis:'线索到店率约 15—20%',highlight:true,ref:'f5'},
    {id:'r6',stage:'预计成交',value:'1—2套',basis:'到访成交率约 10%',tone:'secondary',ref:'f6'}
   ]}}
  ]},m);
  assert.equal(r.capacity.status,'fits');
  assert(r.regions[0].bounds[2]<r.regions[1].bounds[2]);
  const sumEl=r.elements.find(e=>e.id==='p5-budget-summary');
  assert.equal(sumEl.runs[0].style.fontSize,80);assert.equal(sumEl.runs[1].style.fontSize,26);
  const bars=r.elements.filter(e=>e.id.startsWith('p5-budget-body-bar-'));
  assert.equal(bars.length,3);assert(bars[0].bounds[2]>bars[1].bounds[2]&&bars[1].bounds[2]>bars[2].bounds[2]);
  assert(r.elements.some(e=>e.id==='p5-forecast-body-bg-r5'));
 }finally{await m.close();}
});
