import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version='v0.2.0-preview.20261027';
const out=path.resolve(root,process.argv[2]||'output/releases/'+version);
const zip=new JSZip(),prefix='skills/dawang-ppt/';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Git-indexed/public source only. No recursive copy of local dependencies or materials.
const files=[...new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root}).toString().split('\0').filter(Boolean))].sort();
const excluded=new Set(['references/legacy-and-revision.md','references/kimi-rules.lock.json','project/src/fusion/styles/source-index.json']);
const contents=new Map();
for(const file of files){
 if(!file.startsWith(prefix))continue;
 const relative=file.slice(prefix.length);
 if(excluded.has(relative)||relative.startsWith('project/src/fusion/kimi/')||relative.startsWith('references/kimi/'))continue;
 if(/(^|\/)(node_modules|output|\.cache|\.git)(\/|$)/.test(relative)||/\.env(?:\.|$)/.test(relative))throw Error('Private path in package: '+relative);
 const full=path.join(root,file),stat=fs.lstatSync(full);if(!stat.isFile())throw Error('Expected ordinary source file: '+file);
 contents.set(relative,fs.readFileSync(full));
}
let readme=fs.readFileSync(path.join(root,'README.md'),'utf8').replaceAll('skills/dawang-ppt/SKILL.md','SKILL.md');
contents.set('README.md',Buffer.from(readme));
for(const file of ['LICENSE','docs/USAGE.md','docs/RELEASE-20261027.md'])contents.set(file,fs.readFileSync(path.join(root,file)));
contents.set('NOTICE.md',Buffer.from(fs.readFileSync(path.join(root,'docs/SHARE-NOTICE.md'),'utf8')));
for(const [file,bytes] of contents){
 if(file==='SKILL.md'||file.startsWith('references/')||file==='README.md'||file==='docs/USAGE.md'){
  if(/\bKimi\b|dashi(?:ai)?[- ]ppt|KIMI_PPT_SKILL_DIR|kimi-rules\.lock/i.test(bytes.toString()))throw Error('Legacy rule instruction in public entry: '+file);
 }
}
const manifest={version,layout:'dawang-ppt/SKILL.md',files:Object.fromEntries([...contents].sort(([a],[b])=>a.localeCompare(b)).map(([file,bytes])=>[file,{bytes:bytes.length,sha256:sha(bytes)}]))};
contents.set('PACKAGE-MANIFEST.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
for(const [file,bytes] of contents)zip.file('dawang-ppt/'+file,bytes,{date:new Date('2026-10-27T00:00:00Z'),unixPermissions:0o100644});
const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:9},platform:'UNIX'});
// Read the produced archive back; every recorded file must survive with identical bytes.
const check=await JSZip.loadAsync(bytes,{checkCRC32:true});
for(const [file,record] of Object.entries(manifest.files)){
 if(sha(await check.file('dawang-ppt/'+file).async('nodebuffer'))!==record.sha256)throw Error('Archive integrity failed: '+file);
}
fs.mkdirSync(out,{recursive:true});
const name='dawang-ppt-'+version+'.zip';fs.writeFileSync(path.join(out,name),bytes);
fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),sha(bytes)+'  '+name+'\n');
console.log(JSON.stringify({version,files:contents.size,bytes:bytes.length,zip:path.join(out,name),sha256:sha(bytes)},null,2));
