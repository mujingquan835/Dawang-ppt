import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const ROOT=path.resolve(import.meta.dirname,'../../../../references');
export const SCENARIOS=Object.freeze([
 ['analysis-decision','分析决策'],['business-plan','商业提案'],['management-report','管理汇报'],
 ['academic-research','学术研究'],['education-training','教育培训'],['tech-engineering','技术工程'],['brand-creative','品牌创意']
].map(([id,zh])=>({id,zh})));
const COMMON=[['workflow','rules/workflow.md'],['general','fusion/production.md'],['content-editing','fusion/content-editing.md'],['visual-review','fusion/visual-review.md']];
const FILES=[...COMMON.map(x=>x[1]),...SCENARIOS.map(s=>'rules/'+s.id+'.md')].sort();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function fingerprint(root=ROOT){
 const files=Object.fromEntries(FILES.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
 return {files,bundleSha256:hash(Object.entries(files).map(([file,sha])=>file+'\0'+sha).join('\n'))};
}
export function ruleStatus({root=ROOT,lockFile=path.join(root,'dawang-rules.lock.json')}={}){
 const current=fingerprint(root);
 if(!fs.existsSync(lockFile))return {provider:'dawang-ppt',status:'unpinned',...current};
 const lock=JSON.parse(fs.readFileSync(lockFile,'utf8'));
 return {provider:'dawang-ppt',label:lock.label,status:lock.bundleSha256===current.bundleSha256?'pinned':'drift',...current};
}
export function writeRulesLock({root=ROOT,file=path.join(root,'dawang-rules.lock.json'),label='Dawang-PPT production rules v1'}={}){
 const lock={version:1,provider:'dawang-ppt',label,...fingerprint(root)};
 fs.writeFileSync(file,JSON.stringify(lock,null,2)+'\n');return {file,...lock};
}
export function splitSections(text){
 const sections=[];let current={heading:'正文',start:1,lines:[]},fence=null;
 for(const [i,line] of text.split('\n').entries()){
  const marker=/^\s*(```|~~~)/.exec(line)?.[1];if(marker)fence=fence===marker?null:fence??marker;
  const title=!fence&&!marker&&/^#{1,6}\s+(.+)$/.exec(line);
  if(title){if(current.lines.some(s=>s.trim()))sections.push(current);current={heading:title[1],start:i+1,lines:[]};}
  current.lines.push(line);
 }
 if(current.lines.some(s=>s.trim()))sections.push(current);
 return sections.map((s,i)=>({id:String(i+1),heading:s.heading,lines:[s.start,s.start+s.lines.length-1],disposition:'apply',text:s.lines.join('\n')}));
}
export function readAuthoringRules({scenarioId,root=ROOT,designDoc,formatDocs=[]}={}){
 if(!SCENARIOS.some(s=>s.id===scenarioId))throw Error('Unknown scenario '+scenarioId+'. Valid scenarios: '+SCENARIOS.map(s=>s.id).join(', '));
 const pin=ruleStatus({root});
 if(pin.status!=='pinned')throw Error('Dawang-PPT bundled rules '+pin.status+'; restore the matching release or have the maintainer review and run rules:lock.');
 const selected=[...COMMON,['scenario:'+scenarioId,'rules/'+scenarioId+'.md'],...(designDoc?[['design',designDoc]]:[]),...formatDocs.map((file,i)=>['format:'+i,file])];
 const documents=selected.map(([id,relativePath])=>{
  const file=path.resolve(root,relativePath),text=fs.readFileSync(file,'utf8');
  return {id,path:file,relativePath:path.relative(root,file),sha256:hash(text),sections:splitSections(text)};
 });
 return {version:1,provider:'dawang-ppt',legend:{apply:'执行本版Dawang-PPT规则；用户明确的事实、品牌与修改范围优先'},pin,summary:{apply:documents.reduce((n,d)=>n+d.sections.length,0)},documents};
}
