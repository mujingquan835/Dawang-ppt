export const clone=value=>structuredClone(value);
export const revision=()=>globalThis.crypto.randomUUID();
export function validateProject(p){
 const issues=[];if(p?.version!==2)issues.push('Project must be version 2');
 const ids=new Set();for(const s of p?.slides||[]){if(!s.slideId||ids.has(s.slideId))issues.push('Duplicate/missing slideId');ids.add(s.slideId);if(s.mode==='template'&&!s.layout)issues.push(`${s.slideId}: missing layout`);if(!['template','composition'].includes(s.mode))issues.push(`${s.slideId}: invalid mode`);for(const e of s.elements||[])if(!e.id||!Array.isArray(e.bounds)||e.bounds.length!==4||!e.bounds.every(Number.isFinite))issues.push(`${s.slideId}: invalid element bounds`);}
 if(!p?.revision)issues.push('Missing revision');for(const k of ['requirements','sources','media','contentPlan','designChoice','editorState'])if(!p?.[k])issues.push(`Missing ${k}`);return issues;
}
