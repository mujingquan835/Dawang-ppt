import fs from 'node:fs';
import path from 'node:path';
import {loadProject,saveProject} from './store.mjs';
import {applyEditCommand} from '../editor/commands.mjs';
export function patchProject(dir,{expectedRevision,commands}) {
 const file=path.join(dir,'deck-project.json');let project=loadProject(file);
 if(project.revision!==expectedRevision)return {ok:false,conflicts:[{kind:'revision',expected:expectedRevision,actual:project.revision}]};
 if(!Array.isArray(commands)||!commands.length)return {ok:false,conflicts:[{kind:'commands-required'}]};
 const changed=new Set();let checkScope='slides';
 for(const command of commands){let r;try{r=applyEditCommand(project,command);}catch(error){return {ok:false,conflicts:[{kind:'invalid-command',message:error.message}]};}if(!r.ok)return r;project=r.project;changed.add(command.slideId);if(command.global||command.type==='appearance'||command.type==='image'||command.style?.fontFamily)checkScope='all';}
 const saved=saveProject(file,project,expectedRevision);
 if(saved.ok)fs.writeFileSync(path.join(dir,'last-patch.json'),JSON.stringify({revision:saved.revision,changedSlideIds:[...changed],checkScope}));
 return saved.ok?{...saved,projectFile:file,changedSlideIds:[...changed],checkScope}:saved;
}
