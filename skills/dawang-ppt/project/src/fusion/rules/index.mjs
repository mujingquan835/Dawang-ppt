// Public Dawang-PPT naming facade. The complete, previously validated reader remains authoritative.
import os from 'node:os';
import path from 'node:path';
import * as source from '../kimi/reference-index.mjs';

export const SCENARIOS=source.SCENARIOS;
export const RULES_LOCK_FILE=path.resolve(import.meta.dirname,'../../../../references/production-rules.lock.json');
export const LOCAL_REFERENCE_DIR=path.join(os.homedir(),'.dawang-ppt/production-rules');
export function brandText(text){
 if(typeof text!=='string')return text;
 return text.replace(/\bKimi\b/g,'Dawang-PPT').replace(/dashi 原样模板/g,'Dawang-PPT 原样模板')
  .replace(/PPTD\/kimi-slides 校验或导出脚本/g,'PPTD旧格式校验或导出脚本')
  .replace(/访问 kimi\.com/g,'访问外部演示服务');
}
export function readRulesLock(file=RULES_LOCK_FILE){return source.readRulesLock(file);}
export function locateRulesRoot(lock=readRulesLock()){
 // An explicit public setting is never silently replaced by another installation.
 if(process.env.DAWANG_PPT_RULES_DIR)return path.resolve(process.env.DAWANG_PPT_RULES_DIR);
 if(source.locateKimiSkill([LOCAL_REFERENCE_DIR]))return LOCAL_REFERENCE_DIR;
 return source.locatePinnedKimiSkill(lock);
}
const available=root=>!!root&&!!source.locateKimiSkill([root]);
const missing=()=>new Error('未找到完整生产规则资料；请设置 DAWANG_PPT_RULES_DIR 或准备 ~/.dawang-ppt/production-rules/，不能用摘要替代完整规则。');
export function ruleStatus({root=locateRulesRoot(),lock=readRulesLock()}={}){
 if(!available(root))return {provider:'dawang-ppt',status:'missing',root:root||null};
 return {provider:'dawang-ppt',root,label:lock?.label??null,...source.compareToLock(source.fingerprintKimiRules(root),lock),lockedBundleSha256:lock?.bundleSha256??null};
}
export function writeRulesLock({root=locateRulesRoot(),file=RULES_LOCK_FILE,label='Dawang-PPT full production rules (pinned baseline)'}={}){
 if(!available(root))throw missing();
 return source.writeRulesLock({root,file,label});
}
function present(result){
 return {...result,provider:'dawang-ppt',legend:Object.fromEntries(Object.entries(result.legend).map(([k,v])=>[k,brandText(v)])),
  documents:result.documents.map(d=>({...d,sections:d.sections.map(s=>({...s,heading:brandText(s.heading),...(s.text===undefined?{}:{text:brandText(s.text)}),...(s.note===undefined?{}:{note:brandText(s.note)})}))}))};
}
export function readAuthoringRules({lock=readRulesLock(),root=locateRulesRoot(lock),...options}={}){
 if(!SCENARIOS.some(s=>s.id===options.scenarioId))throw Error('Unknown scenario '+options.scenarioId+'. Valid scenarios: '+SCENARIOS.map(s=>s.id).join(', '));
 if(!available(root))throw missing();
 try{return present(source.readAuthoringRules({...options,root,lock}));}
 catch(error){error.message=brandText(error.message);throw error;}
}
export const fingerprint=source.fingerprintKimiRules;
export const splitSections=source.splitRuleSections;
