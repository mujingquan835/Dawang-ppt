import fs from 'node:fs';import path from 'node:path';
import {extractPortableProject,extractPortableMeta} from './html.mjs';
import {loadProject,saveProject} from '../project/store.mjs';
export function importPortableHtml(htmlFile,dir,{expectedRevision}={}){
 const html=fs.readFileSync(htmlFile,'utf8'),project=extractPortableProject(html),meta=extractPortableMeta(html),file=path.join(dir,'deck-project.json');
 const current=fs.existsSync(file)?loadProject(file):null;
 if(current&&(current.revision!==expectedRevision||current.revision!==meta.baseRevision||current.requirements.projectId!==meta.projectId))return {ok:false,conflicts:[{kind:'portable-revision',expectedRevision,baseRevision:meta.baseRevision,actual:current.revision}]};
 return saveProject(file,project,current?.revision||null);
}
