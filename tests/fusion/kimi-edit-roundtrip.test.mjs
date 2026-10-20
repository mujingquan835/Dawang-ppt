import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createAuthoredProject} from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import {applyEditCommand, undoProject, redoProject} from '../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs';
import {materializeElements,syncCompositionTextState} from '../../skills/dawang-ppt/project/src/fusion/scene/model.mjs';
import {saveProject,loadProject} from '../../skills/dawang-ppt/project/src/fusion/project/store.mjs';
import {validateProject} from '../../skills/dawang-ppt/project/src/fusion/project/schema.mjs';

function source(){return {
 requirements:{title:'合成富文本回环'},sources:{entries:[],userEdits:[]},media:{entries:[{mediaId:'image',src:'image.png'}]},
 contentPlan:{nodes:{title:{text:'先看结构，再动手剪辑'}},slides:[{slideId:'one'}]},designChoice:{styleId:'legacy/theme09'},
 slides:[{slideId:'one',elements:[
  {id:'title',type:'text',text:'先看结构，再动手剪辑',contentRef:'title',bounds:[100,100,1600,120],style:{fontSize:70},runs:[{text:'先看结构',style:{color:'#B6D8D1',fontWeight:700}},{text:'，再动手剪辑',style:{color:'#F3F1E9'}}]},
  {id:'photo',type:'image',mediaRef:'image',bounds:[200,350,1400,480],fit:'cover',focal:'35% 28%'},
  {id:'icon',type:'vector',bounds:[80,850,64,64],viewBox:[0,0,24,24],path:'M 3 12 L 9 18 L 21 6',style:{fill:'none',stroke:'#B6D8D1',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'}}
 ]}]
};}
const edit=(p,c)=>{const r=applyEditCommand(p,{slideId:'one',...c});assert.equal(r.ok,true,JSON.stringify(r.conflicts));return r.project;};
const element=(p,id)=>materializeElements(p.slides[0],p).find(e=>e.id===id);

test('emphasized words keep per-run style through edit undo redo and save reopen',t=>{
 let p=createAuthoredProject(source());const original=structuredClone(p);
 const runs=structuredClone(element(p,'title').runs);runs[0].text='先听懂结构';
 p=edit(p,{type:'text-runs',elementId:'title',runs});
 assert.equal(element(p,'title').text,'先听懂结构，再动手剪辑');
 assert.equal(element(p,'title').runs[0].style.color,'#B6D8D1');
 assert.equal(element(p,'title').runs[0].style.fontWeight,700);
 assert.equal(p.contentPlan.nodes['edit:one:title'].text,'先听懂结构，再动手剪辑');
 const undone=undoProject(p);assert.equal(undone.ok,true);assert.deepEqual(undone.project.slides,original.slides);
 const redone=redoProject(undone.project);assert.equal(redone.ok,true);assert.deepEqual(redone.project.slides,p.slides);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kimi-edit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'deck-project.json');assert.equal(saveProject(file,p,null).ok,true);
 assert.deepEqual(loadProject(file).slides,p.slides);
 const html=syncCompositionTextState(p).editorState.legacy.text['text:one:fusion-title'];
 assert.match(html,/data-fusion-run="0"/);assert.match(html,/color:#B6D8D1/);assert.match(html,/先听懂结构/);
});

test('plain replacement of runs requires explicit reset and leaves original untouched on conflict',()=>{
 const p=createAuthoredProject(source()),before=structuredClone(p);
 const blocked=applyEditCommand(p,{type:'text',slideId:'one',elementId:'title',text:'替换整段'});
 assert.equal(blocked.ok,false);assert.equal(blocked.conflicts[0].kind,'rich-text-reset-required');assert.deepEqual(p,before);
 const changed=edit(p,{type:'text',elementId:'title',text:'替换整段',resetRuns:true});
 assert.equal(element(changed,'title').text,'替换整段');assert.equal(element(changed,'title').runs,undefined);
 assert.deepEqual(element(undoProject(changed).project,'title').runs,element(p,'title').runs);
});

test('replacement keeps image crop and manual geometry survives text edits and re-materialization',()=>{
 let p=createAuthoredProject(source());
 p=edit(p,{type:'image',elementId:'photo',src:'replacement.png'});
 assert.equal(element(p,'photo').fit,'cover');assert.equal(element(p,'photo').focal,'35% 28%');
 p=edit(p,{type:'geometry',elementId:'photo',bounds:[300,400,1300,420]});
 p=edit(p,{type:'text-runs',elementId:'title',runs:[{text:'修改后',style:{color:'#B6D8D1'}}]});
 assert.deepEqual(element(p,'photo').bounds,[300,400,1300,420]);assert.deepEqual(validateProject(p),[]);
 assert.equal(element(p,'icon').path,'M 3 12 L 9 18 L 21 6');
});

test('rich text and vector reject script-bearing or unsupported styles and malformed geometry',()=>{
 for(const change of [
  s=>s.slides[0].elements[0].runs=[],
  s=>s.slides[0].elements[0].runs[0].style.position='absolute',
  s=>s.slides[0].elements[0].runs[0].style.fontSize=Infinity,
  s=>s.slides[0].elements[2].path='<script>alert(1)</script>',
  s=>s.slides[0].elements[2].viewBox=[0,0,0,24],
  s=>s.slides[0].elements[2].style.filter='url(https://example.com)'
 ]){const s=source();change(s);assert.throws(()=>createAuthoredProject(s),/runs|style|vector|viewBox|path/i);}
 const p=createAuthoredProject(source());
 const r=applyEditCommand(p,{slideId:'one',elementId:'title',type:'text-runs',runs:[{text:'x',style:{background:'url(javascript:1)'}}]});
 assert.equal(r.ok,false);assert.equal(element(p,'title').text,'先看结构，再动手剪辑');
});

test('run text is escaped as content rather than executable HTML in legacy state',()=>{
 let p=createAuthoredProject(source());p=edit(p,{type:'text-runs',elementId:'title',runs:[{text:'<img src=x onerror=alert(1)> & "quote"',style:{color:'#B6D8D1'}}]});
 const html=p.editorState.legacy.text['text:one:fusion-title'];
 assert(html.includes('&lt;img'));assert(!html.includes('<img'));assert(html.includes('&amp;'));
});

test('browser edits runs through sidebar and canvas, drags image, saves and reopens with style and crop intact',async t=>{
 const {spawnSync}=await import('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kimi-browser-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const input=source();input.media.entries[0].src='pixel.png';
 fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify(input));
 fs.writeFileSync(path.join(dir,'pixel.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
 const r=spawnSync('skills/dawang-ppt/project/node_modules/.bin/tsx',['tests/fusion/helpers/kimi-edit-run.jsx',dir],{encoding:'utf8',timeout:90000});
 assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 assert.match(r.stdout,/"authorNameRemoved":true/);assert.match(r.stdout,/"canvasRuns":true/);
});
