import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {extractPortableProject} from '../portable/html.mjs';
import {readAuthoringRules,SCENARIOS} from '../kimi/reference-index.mjs';

export function prepareMaterial({inputFile,outDir,scenarioId}) {
 const input=path.resolve(inputFile),dest=path.resolve(outDir);
 // Read and validate before creating output. Never overwrite a previous preparation.
 const raw=fs.readFileSync(input,'utf8'),ext=path.extname(input).toLowerCase();
 let project;
 if(ext==='.html')project=extractPortableProject(raw);
 else if(ext==='.json'){project=JSON.parse(raw);if(!Array.isArray(project.slides))throw Error('Expected authored/ProjectV2 JSON with slides');}
 else if(!['.md','.txt'].includes(ext))throw Error('Supported inputs: portable HTML, authored/ProjectV2 JSON, Markdown, text');
 const rules=scenarioId?readAuthoringRules({scenarioId}):null;
 if(fs.existsSync(dest))throw Error('Preparation output already exists: '+dest);
 const media=[];
 function asset(value){
  if(typeof value!=='string')return value;
  if(!value.startsWith('data:'))return value;
  const m=/^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if(!m)return {omittedDataUrl:true,reason:'not an archived supported image'};
  const bytes=Buffer.from(m[2],'base64'),hash=createHash('sha256').update(bytes).digest('hex');
  const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'}[m[1]];
  const file=path.join(dest,'media',hash+'.'+extension);
  if(!media.some(x=>x.sha256===hash))media.push({path:file,mime:m[1],bytes:bytes.length,sha256:hash,data:bytes});
  return file;
 }
 function clean(v){if(typeof v==='string')return asset(v);if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clean(x)]));return v;}
 const material=project?{title:project.requirements?.title,requirements:clean(project.requirements),sources:clean(project.sources),revision:project.revision,contentPlan:clean(project.contentPlan),slides:project.slides.map(s=>({slideId:s.slideId,hidden:s.hidden,elements:(s.elements||[]).map(e=>({id:e.id,type:e.type,text:e.text,runs:clean(e.runs),contentRef:e.contentRef,src:e.src?asset(e.src):undefined,mediaRef:e.mediaRef,bounds:e.bounds,crop:e.crop,fit:e.fit}))})),media:clean(project.media)}:{text:raw};
 fs.mkdirSync(path.join(dest,'media'),{recursive:true});
 for(const entry of media)fs.writeFileSync(entry.path,entry.data);
 const manifest=media.map(({data,...entry})=>entry);
 fs.writeFileSync(path.join(dest,'material.json'),JSON.stringify({source:input,sourceSha256:createHash('sha256').update(raw).digest('hex'),...material,extractedMedia:manifest},null,2));
 if(rules)fs.writeFileSync(path.join(dest,'rules.json'),JSON.stringify(rules,null,2));
 return {materialFile:path.join(dest,'material.json'),rulesFile:rules?path.join(dest,'rules.json'):null,media:manifest,scenarios:SCENARIOS.map(({id,zh})=>({id,name:zh})),note:'Read the full material and applicable original rules; inspect required images. This preparation makes no content or layout decisions. Relative media paths in JSON resolve against source directory: '+path.dirname(input)};
}
