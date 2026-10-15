import {clone,revision} from '../project/schema.mjs';
export function applyEditCommand(project,command){
 const p=clone(project);const s=p.slides.find(s=>s.slideId===command.slideId);if(!s)return{ok:false,conflicts:[{kind:'missing-slide'}]};
 const e=s.elements?.find(e=>e.id===command.elementId);const before=clone(project);delete before.editorState.history;delete before.editorState.redo;
 if(!e)return{ok:false,conflicts:[{kind:'missing-element'}]};
 if(command.type==='text'){if(e.contentRef){const old=p.contentPlan.nodes[e.contentRef];const id=command.global?e.contentRef:`edit:${s.slideId}:${e.id}`;p.contentPlan.nodes[id]={...clone(old||{}),text:String(command.text),kind:'user-edit',sourceRef:old?.sourceRef||e.contentRef};e.contentRef=id;}else e.text=String(command.text);}
 else if(command.type==='image'){e.src=command.src;delete e.mediaRef;if(command.fit)e.fit=command.fit;}
 else if(command.type==='geometry'){if(!command.bounds?.every(Number.isFinite)||command.bounds.length!==4||command.bounds[2]<=0||command.bounds[3]<=0)return{ok:false,conflicts:[{kind:'invalid-bounds'}]};e.bounds=clone(command.bounds);p.editorState.overrides[`${s.slideId}/${e.id}`]={...(p.editorState.overrides[`${s.slideId}/${e.id}`]||{}),bounds:e.bounds};}
 else if(command.type==='style')e.style={...e.style,...command.style};
 else return{ok:false,conflicts:[{kind:'unsupported-command',type:command.type}]};
 p.sources.userEdits.push({slideId:s.slideId,elementId:e.id,type:command.type});p.editorState.history.push(before);p.editorState.redo=[];p.revision=revision();return{ok:true,project:p};
}
export function undoProject(project){const p=clone(project);const previous=p.editorState.history.pop();if(!previous)return{ok:false,conflicts:[{kind:'no-history'}]};const current=clone(p);delete current.editorState.history;delete current.editorState.redo;previous.editorState.history=p.editorState.history;previous.editorState.redo=[...p.editorState.redo,current];previous.revision=revision();return{ok:true,project:previous};}
export function redoProject(project){const p=clone(project);const next=p.editorState.redo.pop();if(!next)return{ok:false,conflicts:[{kind:'no-redo'}]};const current=clone(p);delete current.editorState.history;delete current.editorState.redo;next.editorState.history=[...p.editorState.history,current];next.editorState.redo=p.editorState.redo;next.revision=revision();return{ok:true,project:next};}
