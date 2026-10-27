import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {extractPortableProject} from '../portable/html.mjs';
import {readAuthoringRules,SCENARIOS} from '../rules/index.mjs';

// Candidates only: the agent confirms them into contentPlan.authorNotes / keyLine and may reject any of them.
const AUTHOR_SECTION=/不放进|不放入|不上屏|不进\s*PPT|仅供|内部|备注|配图说明|制作说明|for author/i;
const AUTHOR_LINE=/建议(写|标注|改为|使用|注明)|对外(宣传|发布)时|[为是]示意|仅供参考|待确认|TODO|不放进|不要放/i;
const KEY_LABEL=/^(定位|一句话|核心|结尾|收尾|口号|slogan|标题|主张)[^：:]{0,6}[：:]/i;
export function scanMaterialText(text){
 const authorNoteCandidates=[],keyLineCandidates=[],strip=l=>l.replace(/^\s*(?:[-*+](?=\s)|>|\d+[.、)])\s*/,'').replace(/\*\*/g,'').trim();
 let section=null;
 String(text).split(/\r?\n/).forEach((line,index)=>{
  const heading=/^(#{1,6})\s+(.*)$/.exec(line);
  if(heading){section=AUTHOR_SECTION.test(heading[2])?{level:heading[1].length,title:heading[2].trim()}:(section&&heading[1].length>section.level?section:null);if(section)return;}
  const body=strip(line);if(!body||/^-{3,}$/.test(body))return;
  if(section)authorNoteCandidates.push({line:index+1,text:body,reason:'section: '+section.title});
  else if(AUTHOR_LINE.test(body))authorNoteCandidates.push({line:index+1,text:body,reason:'author wording'});
  if(section)return;
  const label=KEY_LABEL.exec(body);
  if(label)keyLineCandidates.push({line:index+1,text:body.slice(label[0].length).trim(),reason:'labelled: '+label[1]});
  for(const m of line.matchAll(/\*\*([^*]{4,40})\*\*/g))if(!KEY_LABEL.test(m[1]+'：'))keyLineCandidates.push({line:index+1,text:m[1].trim(),reason:'bold in material'});
 });
 return {authorNoteCandidates,keyLineCandidates};
}

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
 const text=project?[...Object.values(project.contentPlan?.nodes||{}).map(n=>n?.text),...project.slides.flatMap(s=>(s.elements||[]).map(e=>e.runs?e.runs.map(r=>r.text).join(''):e.text))].filter(t=>typeof t==='string').join('\n'):raw;
 const candidates=scanMaterialText(text);
 fs.mkdirSync(path.join(dest,'media'),{recursive:true});
 for(const entry of media)fs.writeFileSync(entry.path,entry.data);
 const manifest=media.map(({data,...entry})=>entry);
 fs.writeFileSync(path.join(dest,'material.json'),JSON.stringify({source:input,sourceSha256:createHash('sha256').update(raw).digest('hex'),...material,extractedMedia:manifest,...candidates},null,2));
 if(rules)fs.writeFileSync(path.join(dest,'rules.json'),JSON.stringify(rules,null,2));
 return {materialFile:path.join(dest,'material.json'),rulesFile:rules?path.join(dest,'rules.json'):null,media:manifest,...candidates,scenarios:SCENARIOS.map(({id,zh})=>({id,name:zh})),note:'Read the full material and applicable Dawang-PPT rules; inspect required images. This preparation makes no content or layout decisions. Relative media paths in JSON resolve against source directory: '+path.dirname(input)};
}
