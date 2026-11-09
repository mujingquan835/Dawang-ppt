import fs from 'node:fs';
import path from 'node:path';
import {loadProject,saveProject} from './store.mjs';
import {clone,revision} from './schema.mjs';
import {applyEditCommand} from '../editor/commands.mjs';

function applyGlobalCommand(project, command) {
 const p = clone(project);
 if (command.type === 'theme') {
  if (command.designChoice && typeof command.designChoice === 'object') {
   p.designChoice = { ...(p.designChoice || {}), ...clone(command.designChoice) };
  }
  if (typeof command.fontFamily === 'string' && command.fontFamily.trim()) {
   const font = command.fontFamily.trim();
   for (const slide of p.slides || []) {
    for (const el of slide.elements || []) {
     if (el.type === 'text') {
      el.style = { ...(el.style || {}), fontFamily: font };
      if (Array.isArray(el.runs)) el.runs = el.runs.map(r => ({ ...r, style: { ...(r.style || {}), fontFamily: font } }));
     }
    }
   }
  }
  p.revision = revision();
  return { ok: true, project: p };
 }
 return null;
}

export function patchProject(dir,{expectedRevision,commands}) {
 const file=path.join(dir,'deck-project.json');let project=loadProject(file);
 if(project.revision!==expectedRevision)return {ok:false,conflicts:[{kind:'revision',expected:expectedRevision,actual:project.revision}]};
 if(!Array.isArray(commands)||!commands.length)return {ok:false,conflicts:[{kind:'commands-required'}]};
 const changed=new Set();let checkScope='slides';
 for(const command of commands){
  let r;
  try{
   r=applyGlobalCommand(project,command)||applyEditCommand(project,command);
  }catch(error){
   return {ok:false,conflicts:[{kind:'invalid-command',message:error.message}]};
  }
  if(!r.ok)return r;
  project=r.project;
  if(command.type==='theme'||command.global||command.type==='appearance'){
   checkScope='all';
   for(const s of project.slides||[])changed.add(s.slideId);
  }else if(command.slideId){
   changed.add(command.slideId);
  }
 }
 const saved=saveProject(file,project,expectedRevision);
 const reusableSlideIds=(project.slides||[]).map(s=>s.slideId).filter(id=>!changed.has(id));
 if(saved.ok)fs.writeFileSync(path.join(dir,'last-patch.json'),JSON.stringify({revision:saved.revision,changedSlideIds:[...changed],reusableSlideIds,checkScope}));
 return saved.ok?{...saved,projectFile:file,changedSlideIds:[...changed],reusableSlideIds,checkScope}:saved;
}
