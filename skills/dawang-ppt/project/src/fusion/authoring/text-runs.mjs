import { cssFontStack } from '../styles/css-font.mjs';
const allowed = new Set(['color','fontWeight','fontStyle','textDecoration','fontFamily','fontSize','letterSpacing']);
export function validateTextRuns(runs) {
  if (!Array.isArray(runs) || !runs.length) return ['runs must be a nonempty array'];
  const issues=[];
  for(const run of runs){
    if(!run || typeof run.text!=='string'){issues.push('runs require string text');continue;}
    if(run.style!==undefined && (!run.style || typeof run.style!=='object' || Array.isArray(run.style))){issues.push('runs style must be an object');continue;}
    for(const [key,value] of Object.entries(run.style||{})){
      if(!allowed.has(key)) issues.push('unsupported runs style '+key);
      else if(['fontSize','letterSpacing'].includes(key)){if(!Number.isFinite(value)||(key==='fontSize'&&value<=0))issues.push('invalid runs style '+key);}
      else if(key==='fontWeight'){if(!['normal','bold'].includes(value)&&!(Number.isFinite(value)&&value>=100&&value<=900))issues.push('invalid runs fontWeight');}
      else if(typeof value!=='string'||/[;{}<>]/.test(value))issues.push('invalid runs style '+key);
      else if(key==='color'&&!/^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i.test(value))issues.push('invalid runs color');
      else if(key==='fontStyle'&&!['normal','italic','oblique'].includes(value))issues.push('invalid runs fontStyle');
      else if(key==='textDecoration'&&!['none','underline','line-through'].includes(value))issues.push('invalid runs textDecoration');
    }
  }
  return issues;
}
export const runsText = runs => runs.map(run=>run.text).join('');
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function runsToHtml(runs) {
  const issues=validateTextRuns(runs);if(issues.length)throw Error(issues.join('\n'));
  return runs.map((run,index)=>{
    const css=Object.entries(run.style||{}).map(([key,value])=>`${key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${key==='fontFamily'?cssFontStack(value):['fontSize','letterSpacing'].includes(key)?value+'px':value}`).join(';');
    return `<span data-fusion-run="${index}" style="${escape(css)}">${escape(run.text).replaceAll('\n','<br>')}</span>`;
  }).join('');
}
// Text edits may change content inside spans, never silently discard run boundaries.
export function readRunsFromDom(element,runs) {
  const spans=[...element.querySelectorAll('[data-fusion-run]')];
  if(spans.length!==runs.length || [...element.childNodes].some(n=>n.nodeType===3&&n.textContent.length>0))return null;
  if(spans.some((span,i)=>span.dataset.fusionRun!==String(i)||span.parentElement!==element))return null;
  return runs.map((run,i)=>({...structuredClone(run),text:spans[i].innerText??spans[i].textContent}));
}
