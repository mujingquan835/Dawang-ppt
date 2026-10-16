import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as cli from '../../../skills/dawang-ppt/project/scripts/fusion-cli.jsx';
import {resolveStyle} from '../../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
import {PNG} from '../../../skills/dawang-ppt/project/node_modules/pngjs/lib/png.js';
import {renderProject} from '../../../skills/dawang-ppt/project/src/fusion/scene/render-project.jsx';
import {createFusionServer} from '../../../skills/dawang-ppt/project/scripts/fusion-preview.jsx';
import {saveProject,loadProject} from '../../../skills/dawang-ppt/project/src/fusion/project/store.mjs';
import {measureProject} from '../../../skills/dawang-ppt/project/src/fusion/qa/measure.mjs';
import {chromium} from '../../../skills/dawang-ppt/project/node_modules/playwright-core/index.mjs';
assert.equal(typeof cli.createPlannedProjectFromBrief,'function');
const dir=path.resolve('output/fusion-v3/m2/shared-planner');fs.mkdirSync(dir,{recursive:true});
const png=new PNG({width:400,height:600});png.data.fill(180);const photo=path.join(dir,'portrait.png');fs.writeFileSync(photo,PNG.sync.write(png));
const imageData='data:image/png;base64,'+fs.readFileSync(photo).toString('base64');
const nodes=Array.from({length:5},(_,i)=>({nodeId:'n'+i,label:'步骤'+i,detail:'公开合成证据'}));
const variants=[
  {slideId:'text',title:'先提出判断，再呈现支持证据',relation:'text',points:[{heading:'判断与依据',body:'本页只验证可编辑正文与布局，不代表任何真实业务结果。'},{heading:'下一步',body:'保留全部文字，按真实测量选择候选。'}]},
  {slideId:'process',title:'流程节点连接完整',relation:'process',data:{nodes}},
  {slideId:'timeline',title:'九个阶段不删减',relation:'timeline',data:{nodes:Array.from({length:9},(_,i)=>({nodeId:'n'+i,label:'阶段'+i,date:'节点'+i,detail:'待核实'}))}},
  {slideId:'table',title:'八项清单完整展示',relation:'tabular',data:{columns:[{columnId:'item',label:'事项',width:1},{columnId:'evidence',label:'说明',width:3}],rows:Array.from({length:8},(_,i)=>({rowId:'r'+i,cells:{item:'事项'+i,evidence:'用于验证规划与可编辑导出'}}))}},
  ...['bar','line'].map(kind=>({slideId:kind,title:'正负零空值均保留',relation:kind==='bar'?'ranking':'trend',data:{unit:'合成单位',period:'合成期间',series:[10,-5,0,null].map((value,i)=>({nodeId:'s'+i,label:'样例'+i,value}))}})),
  {slideId:'image',title:'完整截图与竖图证据',relation:'photographic',explanation:'两份图片保留原比例；截图完整显示。',points:[{heading:'证据说明',body:'所有素材均为合成测试图。'}],data:{images:[{mediaId:'photo',src:imageData,focal:'30% 40%'},{mediaId:'screen',src:imageData,kind:'screenshot'}]}}
];
const cliDir=path.join(dir,'cli-default');fs.mkdirSync(cliDir,{recursive:true});
const briefFile=path.join(cliDir,'input.json'),cliOut=path.join(cliDir,'index.html');
if(fs.existsSync(path.join(cliDir,'deck-project.json')))fs.unlinkSync(path.join(cliDir,'deck-project.json'));
fs.writeFileSync(briefFile,JSON.stringify({title:'默认入口验证',styleId:'legacy/theme14',contentSlides:[variants[0]]}));
await cli.main(['render:brief',briefFile,cliOut]);
assert.equal(loadProject(path.join(cliDir,'deck-project.json')).slides[0].planning.engine,'content-first-v3');
const projects=[];
for(const styleId of ['legacy/theme14','legacy/theme06','legacy/theme13','legacy/theme17']) {
  const slides=styleId==='legacy/theme17'?variants.filter(v=>v.slideId!=='image'):variants;
  const p=await cli.createPlannedProjectFromBrief({title:'通用规划器合成验证',styleId,contentSlides:slides.map(v=>({...structuredClone(v),slideId:styleId.split('/')[1]+'-'+v.slideId,source:'公开合成夹具'}))},{sourceDir:dir});
  assert(p.slides.every(s=>s.planning.engine==='content-first-v3'));
  projects.push(p);
}
let p=projects[0];p.slides=projects.flatMap(p=>p.slides);p.editorState.slideOrder=p.slides.map(s=>s.slideId);p.editorState.legacy.slideOrder=p.editorState.slideOrder;p.contentPlan.slides=projects.flatMap(p=>p.contentPlan.slides);p.media.entries=projects.flatMap(p=>p.media.entries);
const pf=path.join(dir,'deck-project.json');if(fs.existsSync(pf))fs.unlinkSync(pf);
p=saveProject(pf,p,null).project;renderProject(p,path.join(dir,'index.html'));
const server=await createFusionServer({dir}),url=`http://127.0.0.1:${server.address().port}/index.html`;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});await page.goto(url);await page.waitForFunction(()=>window.__fusionEditor);
  const edited=await page.evaluate(()=>window.__fusionEditor.apply({slideId:'theme14-process',elementId:'theme14-process-primary/node/n0/label',type:'text',text:'编辑后的真实节点'}));assert(edited.ok);
  await page.evaluate(()=>window.__fusionEditor.undo());await page.evaluate(()=>window.__fusionEditor.redo());await page.evaluate(()=>window.__fusionEditor.save());await page.reload();await page.waitForFunction(()=>window.__fusionEditor);
  assert.equal(await page.evaluate(()=>window.__fusionEditor.getProject().slides.find(s=>s.slideId==='theme14-process').objects[0].data.nodes[0].label),'编辑后的真实节点');
  const exported=await page.evaluate(()=>window.__exportDeckPptx());assert(exported.ok,JSON.stringify(exported));
  fs.mkdirSync(path.join(dir,'qa'),{recursive:true});
  const qa=await measureProject(url,loadProject(pf),{screenshotDir:path.join(dir,'qa')});fs.writeFileSync(path.join(dir,'qa.json'),JSON.stringify(qa,null,2));
  assert.deepEqual(qa.pages.map(s=>s.slideId),p.editorState.slideOrder);
  for(let i=0;i<p.slides.length;i++) {
    const shot=PNG.sync.read(fs.readFileSync(path.join(dir,'qa',String(i+1).padStart(2,'0')+'.png')));
    const hex=resolveStyle(p.slides[i].styleId).palette.bg;
    const rgb=[1,3,5].map(j=>parseInt(hex.slice(j,j+2),16));
    const index=(Math.floor(shot.height*.05)*shot.width+Math.floor(shot.width*.8))*4;
    assert(rgb.every((v,c)=>Math.abs(v-shot.data[index+c])<3),`Screenshot must show active ${p.slides[i].slideId}; got ${[...shot.data.slice(index,index+3)]}`);
  }
  assert(qa.ok,JSON.stringify(qa.pages.flatMap(p=>p.issues)));
  fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify({pages:p.slides.length,exported:exported.report,issues:qa.pages.flatMap(p=>p.issues),planning:p.slides.map(s=>({slideId:s.slideId,...s.planning}))},null,2));
  console.log(JSON.stringify({pages:p.slides.length,issues:[],editableExport:true}));
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
