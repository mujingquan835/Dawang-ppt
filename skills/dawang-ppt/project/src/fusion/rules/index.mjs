// Rule providers. The default is Dawang-PPT's own report rules, shipped in references/rules/.
// The earlier external rule set is kept as the optional "original" provider: DAWANG_PPT_RULES_PROVIDER=original,
// or an explicit root/lock passed by a caller. It is read from the user's local installation and never bundled.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as source from '../kimi/reference-index.mjs';

export const SCENARIOS=source.SCENARIOS;
export const RULES_LOCK_FILE=path.resolve(import.meta.dirname,'../../../../references/production-rules.lock.json');
export const LOCAL_REFERENCE_DIR=path.join(os.homedir(),'.dawang-ppt/production-rules');
export const BUNDLED_RULES_DIR=path.resolve(import.meta.dirname,'../../../../references/rules');
export const BUNDLED_LABEL='Dawang-PPT 汇报规则（内置）';
// Bundled documents per scenario. Dawang-PPT is scoped to work reports, so only this scenario has bundled rules.
const BUNDLED={'management-report':{general:'general.md',scenario:'work-report.md'}};
export const BUNDLED_SCENARIOS=Object.keys(BUNDLED);

export function rulesProvider(options={}){
 if(options.provider)return options.provider;
 if(options.root!==undefined||options.lock!==undefined)return 'original';
 return process.env.DAWANG_PPT_RULES_PROVIDER==='original'?'original':'bundled';
}

export function brandText(text){
 if(typeof text!=='string')return text;
 return text.replace(/\bKimi\b/g,'Dawang-PPT').replace(/dashi 原样模板/g,'Dawang-PPT 原样模板')
  .replace(/PPTD\/kimi-slides 校验或导出脚本/g,'PPTD旧格式校验或导出脚本')
  .replace(/访问 kimi\.com/g,'访问外部演示服务');
}

const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
function bundledFingerprint(){
 const files=Object.fromEntries(fs.readdirSync(BUNDLED_RULES_DIR).filter(f=>f.endsWith('.md')).sort().map(f=>[f,sha(fs.readFileSync(path.join(BUNDLED_RULES_DIR,f)))]));
 return {files,bundleSha256:sha(JSON.stringify(files))};
}

export function readRulesLock(file=RULES_LOCK_FILE){return source.readRulesLock(file);}
export function locateRulesRoot(lock=readRulesLock()){
 // An explicit public setting is never silently replaced by another installation.
 if(process.env.DAWANG_PPT_RULES_DIR)return path.resolve(process.env.DAWANG_PPT_RULES_DIR);
 if(source.locateKimiSkill([LOCAL_REFERENCE_DIR]))return LOCAL_REFERENCE_DIR;
 return source.locatePinnedKimiSkill(lock);
}
const available=root=>!!root&&!!source.locateKimiSkill([root]);
const missing=()=>new Error('未找到原规则资料（DAWANG_PPT_RULES_PROVIDER=original）；请设置 DAWANG_PPT_RULES_DIR 或准备 ~/.dawang-ppt/production-rules/。不设该变量时使用内置汇报规则。');

export function ruleStatus(options={}){
 if(rulesProvider(options)==='bundled'){
  if(!fs.existsSync(path.join(BUNDLED_RULES_DIR,'general.md')))return {provider:'dawang-ppt',source:'bundled',status:'missing',root:BUNDLED_RULES_DIR};
  return {provider:'dawang-ppt',source:'bundled',status:'pinned',root:BUNDLED_RULES_DIR,label:BUNDLED_LABEL,scenarios:BUNDLED_SCENARIOS,lockedBundleSha256:bundledFingerprint().bundleSha256};
 }
 const {root=locateRulesRoot(),lock=readRulesLock()}=options;
 if(!available(root))return {provider:'dawang-ppt',source:'original',status:'missing',root:root||null};
 return {provider:'dawang-ppt',source:'original',root,label:lock?.label??null,...source.compareToLock(source.fingerprintKimiRules(root),lock),lockedBundleSha256:lock?.bundleSha256??null};
}
export function writeRulesLock({root=locateRulesRoot(),file=RULES_LOCK_FILE,label='Dawang-PPT full production rules (pinned baseline)'}={}){
 if(!available(root))throw missing();
 return source.writeRulesLock({root,file,label});
}
function present(result){
 return {...result,provider:'dawang-ppt',source:'original',legend:Object.fromEntries(Object.entries(result.legend).map(([k,v])=>[k,brandText(v)])),
  documents:result.documents.map(d=>({...d,sections:d.sections.map(s=>({...s,heading:brandText(s.heading),...(s.text===undefined?{}:{text:brandText(s.text)}),...(s.note===undefined?{}:{note:brandText(s.note)})}))}))};
}

function readBundledRules({scenarioId}){
 const docs=BUNDLED[scenarioId];
 if(!docs)throw Error('内置汇报规则只覆盖 '+BUNDLED_SCENARIOS.join('、')+'；场景 '+scenarioId+' 需要 DAWANG_PPT_RULES_PROVIDER=original 和原规则资料。');
 const {bundleSha256}=bundledFingerprint();
 const documents=[['general','通用要求',docs.general],['scenario:'+scenarioId,'主场景',docs.scenario]].map(([id,section,file])=>{
  const full=path.join(BUNDLED_RULES_DIR,file),bytes=fs.readFileSync(full);
  const sections=source.splitRuleSections(bytes.toString('utf8')).map((s,i)=>({id:id+'#'+String(i+1).padStart(2,'0'),...s,disposition:s.level===2?'apply':'context'}));
  return {id,path:full,section,relativePath:file,sha256:sha(bytes),sections};
 });
 const summary={};
 for(const s of documents.flatMap(d=>d.sections))summary[s.disposition]=(summary[s.disposition]||0)+1;
 return {version:1,provider:'dawang-ppt',source:'bundled',legend:{apply:'照做',context:'说明，不单独检查'},
  pin:{status:'pinned',label:BUNDLED_LABEL,lockedBundleSha256:bundleSha256,root:BUNDLED_RULES_DIR,changed:[],added:[],removed:[]},summary,documents};
}

export function readAuthoringRules(options={}){
 if(!SCENARIOS.some(s=>s.id===options.scenarioId))throw Error('Unknown scenario '+options.scenarioId+'. Valid scenarios: '+SCENARIOS.map(s=>s.id).join(', '));
 if(rulesProvider(options)==='bundled')return readBundledRules(options);
 const {lock=readRulesLock(),root=locateRulesRoot(lock),...rest}=options;
 if(!available(root))throw missing();
 try{return present(source.readAuthoringRules({...rest,root,lock}));}
 catch(error){error.message=brandText(error.message);throw error;}
}
export const fingerprint=source.fingerprintKimiRules;
export const splitSections=source.splitRuleSections;
