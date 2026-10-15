import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {importGoal, mergeEditorState} from '../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs';
import {saveProject,loadProject} from '../../skills/dawang-ppt/project/src/fusion/project/store.mjs';
import {resolveStyle} from '../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs';
test('legacy edits and copy/order/delete/skip survive import without modifying input',()=>{
 const goal={title:'测试',audience:'测试',slides:[{id:'a',layout:'theme13_page001',props:{title:'原文'}},{id:'b',layout:'theme09_page001',props:{}}]};
 const state={slideOrder:['copy','b','a'],text:{'text:theme13_page001:1':'修改'},props:{a:{title:'改后'}},media:{a:'photo'},typography:{body:'simsun'},textFonts:{x:'arial'},mediaSlotStyles:{image:{shape:'rect'}},duplicatedSlides:[{id:'copy',sourceId:'a'}],deletedSlides:['b'],skippedSlides:['a']};
 const original=JSON.stringify(goal);const p=importGoal(goal,state);assert.equal(p.version,2);assert.deepEqual(p.editorState.legacy,state);assert.deepEqual(p.editorState.slideOrder,state.slideOrder);assert(p.slides.find(s=>s.slideId==='copy'));assert.equal(p.slides[0].props.title,'改后');assert.equal(JSON.stringify(goal),original);
});
test('atomic revision check refuses stale state',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fusion-project-'));try{const f=path.join(dir,'deck-project.json');const p=importGoal({slides:[{id:'a',layout:'theme13_page001',props:{}}]});assert(saveProject(f,p,null).ok);const saved=loadProject(f);const edited=mergeEditorState(saved,{...saved.editorState.legacy,text:{x:'修改'}});assert(saveProject(f,edited,saved.revision).ok);assert.equal(saveProject(f,p,saved.revision).ok,false);assert.equal(loadProject(f).editorState.legacy.text.x,'修改');}finally{fs.rmSync(dir,{recursive:true});}
});
test('three legacy styles specify composition and media rules, unsupported style rejects',()=>{
 for(const key of ['legacy/theme13','legacy/theme09','legacy/theme16']){const s=resolveStyle(key);assert(s.typography.heading);assert(s.grid.margin);assert(s.media.screenshotFit==='contain');assert(s.compositions.length>3);}assert.throws(()=>resolveStyle('legacy/theme01'),/not adapted/);
});
