import {pathToFileURL} from 'node:url';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createLayoutMeasurer} from '../../../skills/dawang-ppt/project/src/fusion/planning/measure-layout.mjs';
import {createTheme} from '../../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';
import {rolesWithSchedule} from '../../../skills/dawang-ppt/project/src/fusion/authoring/patterns.mjs';
import {roleGroup,schedule,capacityFlow,measureModule,panelGroup,capacityTable} from '../../../skills/dawang-ppt/project/src/fusion/authoring/capacity-kit.mjs';
import {createAuthoredProject} from '../../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import {renderProject} from '../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx';
import {createFusionServer} from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';
import {measureProject} from '../../../skills/dawang-ppt/project/src/fusion/qa/measure.mjs';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
const dir=process.argv[2];fs.mkdirSync(dir,{recursive:true});
const measurer=await createLayoutMeasurer();let browser,server;
try {
 const photo=path.join(dir,'synthetic.svg');fs.writeFileSync(photo,'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><rect width="160" height="200" fill="#dbe7f0"/><circle cx="80" cy="65" r="32" fill="#597b9b"/><path d="M20 190V155a60 60 0 0 1 120 0v35" fill="#597b9b"/></svg>');
 const theme=createTheme({palette:{accent:'#23338b'}});
 const roleSpec={id:'people',bounds:[96,250,730,690],theme,items:[{id:'a',name:'A｜营销负责人',role:'价值与政策讲解',detail:'回答客户问题，衔接项目介绍与活动说明。',photo:{src:'synthetic.svg',size:{width:160,height:200}}},{id:'b',name:'B｜负责样板间实景走播与园林现场互动的主播',role:'样板间带看',detail:'介绍空间布局与生活场景，配合现场互动。',photo:{src:'synthetic.svg',size:{width:160,height:200}}},{id:'c',name:'C｜场控 / 福利官',role:'评论与活动执行',detail:'评论区答疑、上链接、协助抽奖；形象待补。'}]};
 const scheduleSpec={id:'schedule',bounds:[920,250,900,690],theme,rows:[{id:'am',time:'10:00—12:00',content:'沙盘介绍与政策答疑',people:'A + C'},{id:'pm',time:'14:00—16:00',content:'样板间实景走播与客户互动',people:'B + C'},{id:'night',time:'19:00—21:00',content:'活动福利说明、抽奖与现场答疑',people:'A + B + C'}]};
 const page=await rolesWithSchedule({roleSpec,scheduleSpec,measurer});assert.equal(page.capacity.status,'fits',JSON.stringify(page.modules));
 const flow=await measureModule(capacityFlow,{id:'route',bounds:[96,200,1728,600],theme,steps:[{id:'a',title:'迎宾开场与政策说明',detail:'确认观众需求，介绍活动内容。'},{id:'b',title:'沙盘与项目规划',detail:'按观众问题介绍区位信息。'},{id:'c',title:'样板间实景带看与不同家庭居住需求说明',detail:'介绍不同空间使用方式。'},{id:'d',title:'互动答疑与返场说明',detail:'回答问题并说明下一轮安排。'}]},measurer);assert.equal(flow.capacity.status,'fits');
 const crowded=await measureModule(schedule,{...scheduleSpec,bounds:[920,250,900,150],rows:[...scheduleSpec.rows,...scheduleSpec.rows.map(r=>({...r,id:r.id+'2'}))]},measurer);assert.notEqual(crowded.capacity.status,'fits');
 const long=await measureModule(roleGroup,{...roleSpec,items:roleSpec.items.map(i=>({...i,detail:i.detail.repeat(30)}))},measurer);assert.equal(long.capacity.status,'cannot-fit');
 const combo=await measureModule(panelGroup,{id:'paired',bounds:[96,230,1728,700],theme,panels:[3,6].map((n,i)=>({id:'col'+i,title:i?'转化预估':'预算分配',summary:i?'15—20 组':'10,000 元',distributeRows:true,builder:s=>capacityTable({...s,columns:[{key:'value',label:'合成明细',width:s.bounds[2]}]}),spec:{rows:Array.from({length:n},(_,j)=>({id:'r'+j,value:'条目 '+(j+1)+'：用于验证不同条目数的布局'})),size:24}}))},measurer);assert.equal(combo.capacity.status,'fits');
 const rolePanels=await measureModule(panelGroup,{id:'role-pair',bounds:[96,230,1728,700],theme,panels:[{id:'roles',title:'主播分工',builder:roleGroup,spec:{...roleSpec,mediaWidth:100,mediaHeight:125,nameSize:26,roleSize:23,detailSize:22}},{id:'schedule',title:'三场排期',builder:schedule,spec:scheduleSpec,distributeRows:true}]},measurer);assert.equal(rolePanels.capacity.status,'fits',JSON.stringify(rolePanels.capacity));
 const input={requirements:{projectId:'synthetic-capacity',title:'模块容量验证（合成示例）'},sources:{entries:[{sourceId:'synthetic',kind:'synthetic'}]},media:{entries:[]},contentPlan:{nodes:{}},designChoice:{styleId:'authored/custom'},slides:[{slideId:'roles',elements:[{id:'heading',type:'text',text:'人员分工与直播排期｜合成验证',bounds:[96,80,1728,100],style:theme.font(48,{fontWeight:700})},...page.elements]},{slideId:'flow',elements:[{id:'heading',type:'text',text:'流程标题换行与说明对齐｜合成验证',bounds:[96,60,1728,100],style:theme.font(44,{fontWeight:700})},...flow.elements]}]};
 input.slides.push({slideId:'panels',elements:[{id:'heading',type:'text',text:'摘要与明细组合｜合成验证',bounds:[96,80,1728,100],style:theme.font(48,{fontWeight:700})},...combo.elements]});
 input.slides.push({slideId:'role-panels',elements:[{id:'heading',type:'text',text:'人员与排期组合｜合成验证',bounds:[96,80,1728,100],style:theme.font(48,{fontWeight:700})},...rolePanels.elements]});
 const project=createAuthoredProject(input);fs.writeFileSync(path.join(dir,'deck-project.json'),JSON.stringify(project));renderProject(project,path.join(dir,'index.html'));server=await createFusionServer({dir});browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const tab=await browser.newPage({viewport:{width:1920,height:1080}});
 const qa=await measureProject(`http://127.0.0.1:${server.address().port}/index.html`,project,{page:tab,screenshotDir:path.join(dir,'screens')});assert(qa.ok,JSON.stringify(qa.pages.map(p=>p.issues)));
 const html=await tab.evaluate(()=>window.__fusionEditor.serializeHtml());fs.writeFileSync(path.join(dir,'模块容量验证.html'),html);
 await tab.goto(pathToFileURL(path.resolve(dir,'模块容量验证.html')).href);
 const offlineQA=await measureProject(null,project,{page:tab});assert(offlineQA.ok,JSON.stringify(offlineQA.pages.map(p=>p.issues)));
 const secondTheme=createTheme({fontFamily:'Arial',palette:{accent:'#438C80'}});
 const variant=await rolesWithSchedule({roleSpec:{...roleSpec,theme:secondTheme},scheduleSpec:{...scheduleSpec,theme:secondTheme},measurer});assert.equal(variant.capacity.method,'measured');assert.equal(variant.capacity.status,'fits');
 assert.equal(variant.modules.roles.elements.find(e=>e.id==='people-b-name').text,roleSpec.items[1].name);

 const report={ok:true,pages:4,offlineReopen:true,alternateThemeMeasured:true,roleStatus:page.capacity.status,flowStatus:flow.capacity.status,crowdedStatus:crowded.capacity.status,longStatus:long.capacity.status,qa:qa.pages.map(p=>({slideId:p.slideId,issues:p.issues}))};fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await measurer.close();await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
