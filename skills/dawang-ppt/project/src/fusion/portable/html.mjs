import {validateProject} from '../project/schema.mjs';
const safeJson=value=>JSON.stringify(value).replaceAll('<','\\u003c');
function block(html,id){const match=new RegExp('<script\\b(?=[^>]*\\bid=["\\\']'+id+'["\\\'])(?=[^>]*\\btype=["\\\']application/json["\\\'])[^>]*>([\\s\\S]*?)</script>','i').exec(html);if(!match)throw Error('Supported portable snapshot missing: '+id);return JSON.parse(match[1]);}
export function extractPortableMeta(html){const meta=block(html,'portable-project-meta');if(meta.version!==1||!['projectId','baseRevision','snapshotRevision','runtimeFingerprint'].every(k=>typeof meta[k]==='string'&&meta[k]))throw Error('Unsupported portable metadata');return meta;}
export function extractPortableProject(html){const meta=extractPortableMeta(html),project=block(html,'fusion-project'),issues=validateProject(project);if(issues.length||!project.slides?.length||meta.projectId!==project.requirements.projectId||meta.snapshotRevision!==project.revision)throw Error('Invalid portable snapshot: '+issues.join(', '));return project;}
export function validatePortableHtml(html){
 const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,(whole)=>whole.slice(0,whole.indexOf('>')+1)+'</script>').replace(/<!--[\s\S]*?-->/g,'');
 const unresolvedResources=[];
 for(const tag of markup.matchAll(/<(?:script|img|source|video|audio|iframe|link)\b[^>]*>/gi))for(const m of tag[0].matchAll(/\b(?:src|href)=["']([^"']+)["']/gi))if(!/^(data:|#)/i.test(m[1]))unresolvedResources.push(m[1]);
 const styles=[...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).concat([...markup.matchAll(/\bstyle="([^"]*)"/gi)].map(m=>m[1].replaceAll('&quot;','"'))).join('\n');
 for(const m of styles.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi))if(!/^(data:|#)/i.test(m[1]))unresolvedResources.push(m[1]);
 const issues=[];try{const p=extractPortableProject(html);const walk=(value,key='')=>{if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))walk(v,Array.isArray(value)?key:k);else if(typeof value==='string'&&['src','image','images','imageSrc','imageUrl','heroImage','coverImage'].includes(key)&&!value.startsWith('data:'))unresolvedResources.push(value);};walk(p);}catch(error){issues.push(error.message);}
 return {ok:!unresolvedResources.length&&!issues.length,unresolvedResources:[...new Set(unresolvedResources)],issues};
}
const fontKey=family=>family.trim().replace(/^['"]|['"]$/g,'').toLowerCase();
// Families the live page computes (all stack entries, so fallbacks still load) plus any fontFamily in the project.
export function collectUsedFontFamilies(doc,project){
 const used=new Set(),add=stack=>{for(const family of String(stack||'').split(','))if(family.trim())used.add(fontKey(family));};
 for(const el of doc.querySelectorAll('*')){add(getComputedStyle(el).fontFamily);for(const pseudo of ['::before','::after']){const c=getComputedStyle(el,pseudo);if(c.content&&!['none','normal'].includes(c.content))add(c.fontFamily);}}
 const walk=value=>{if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(k==='fontFamily'&&typeof v==='string')add(v);else walk(v);}};
 walk(project?.slides);return used;
}
export function dropUnusedFontFaces(text,used){return text.replace(/@font-face\s*{[^}]*}/gi,rule=>{const family=/font-family\s*:\s*([^;}]+)/i.exec(rule)?.[1];return !family||used.has(fontKey(family))?rule:'';});}
// Shared DOM serializer: called by both the menu and the CLI's browser page.
// Only media fields are traversed; ordinary prose/URLs in source evidence are not rewritten.
// usedFontFamilies (from collectUsedFontFamilies on the live page) limits embedded @font-face rules; omitted keeps all.
export async function serializePortableHtml({document:doc,project,resolveAsset,baseRevision,runtimeFingerprint,usedFontFamilies}){
 const clone=doc.documentElement?doc.documentElement.cloneNode(true):doc;
 const base=doc.baseURI||globalThis.document?.baseURI;
 const cache=new Map();
 const resource=async url=>{
  if(!url||/^(data:|#)/i.test(url))return url;
  if(!cache.has(url))cache.set(url,(async()=>{
   let bytes,mime;if(resolveAsset)({bytes,mime}=await resolveAsset(url,base));else{const response=await fetch(new URL(url,base));if(!response.ok)throw Error('Required portable asset: '+url);bytes=new Uint8Array(await response.arrayBuffer());mime=response.headers.get('content-type')||'application/octet-stream';}
   const array=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let binary='';for(let i=0;i<array.length;i+=32768)binary+=String.fromCharCode(...array.subarray(i,i+32768));return 'data:'+mime+';base64,'+btoa(binary);
  })());return cache.get(url);
 };
 const css=async text=>{const matches=[...text.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi)];for(const m of matches)text=text.replace(m[0],'url("'+await resource(m[2])+'")');return text;};
 const mediaKeys=new Set(['src','image','images','imageSrc','imageUrl','heroImage','coverImage']);
 const mapMedia=async(value,key='')=>{if(Array.isArray(value))return Promise.all(value.map(v=>mapMedia(v,key)));if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await mapMedia(v,k)])));if(typeof value==='string'&&value&&mediaKeys.has(key))return resource(value);return value;};
 const p=await mapMedia(structuredClone(project));
 clone.querySelectorAll('.fusion-selection,.fusion-crop-editor,.deck-export-overlay,.page-transition-stage,#fusion-save-controls,#fusion-history-controls,#fusion-status').forEach(n=>n.remove());
 clone.querySelector('body')?.classList.remove('exporting-deck');
 // Include lazy dependencies now. No network is needed when the user later clicks export.
 for(const src of ['assets/vendor/html-to-image.js','assets/vendor/pdf-lib.min.js','assets/vendor/pptxgen.bundle.js']){
  if(clone.querySelector('script[data-portable-vendor="'+src+'"]'))continue;
  const script=clone.ownerDocument.createElement('script');script.dataset.portableVendor=src;script.src=src;clone.querySelector('head').append(script);
 }
 for(const link of clone.querySelectorAll('link[rel="stylesheet"]')){const response=await fetch(new URL(link.getAttribute('href'),base));if(!response.ok)throw Error('Stylesheet unavailable');const style=clone.ownerDocument.createElement('style');style.textContent=await css(await response.text());link.replaceWith(style);}
 for(const script of clone.querySelectorAll('script[src]')){const url=script.getAttribute('src');const data=await resource(url);const response=await fetch(data);script.textContent=(await response.text()).replace(/<\/script/gi,'<\\/script');script.removeAttribute('src');script.removeAttribute('integrity');script.removeAttribute('crossorigin');}
 for(const style of clone.querySelectorAll('style'))style.textContent=await css(usedFontFamilies?dropUnusedFontFaces(style.textContent,usedFontFamilies):style.textContent);
 for(const node of clone.querySelectorAll('[style]'))node.setAttribute('style',await css(node.getAttribute('style')));
 for(const node of clone.querySelectorAll('[src]'))node.setAttribute('src',await resource(node.getAttribute('src')));
 for(const node of clone.querySelectorAll('a[href^="assets/"],link[href]'))node.setAttribute('href',await resource(node.getAttribute('href')));
 const put=(id,value)=>{let node=clone.querySelector('#'+id);if(!node){node=clone.ownerDocument.createElement('script');node.id=id;node.type='application/json';clone.querySelector('head').append(node);}node.textContent=safeJson(value);};
 put('fusion-project',p);
 // VM composition props must agree with the embedded ProjectV2, including hidden slides.
 // The project itself lives once in #fusion-project; per-slide copies multiplied every embedded image by the page count.
 const vmNode=clone.querySelector('#deck-view-model');if(vmNode){const vm=await mapMedia(JSON.parse(vmNode.textContent));vm.state=structuredClone(p.editorState.legacy);for(const slide of vm.slides||[]){const s=p.slides.find(s=>s.slideId===slide.id);if(s?.mode==='composition'){const {fusionProject,...props}=slide.props||{};slide.props={...props,fusionSlide:s};}}put('deck-view-model',vm);}
 put('embedded-text-state',p.editorState.legacy.text||{});
 const old=clone.querySelector('#portable-project-meta');const previous=old?JSON.parse(old.textContent):null;
 if(!runtimeFingerprint){const scripts=[...clone.querySelectorAll('script:not([type="application/json"])')].map(s=>s.textContent).join('\n');runtimeFingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scripts)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
 put('portable-project-meta',{version:1,projectId:p.requirements.projectId,baseRevision:previous?.baseRevision||baseRevision||p.revision,snapshotRevision:p.revision,runtimeFingerprint});
 return '<!DOCTYPE html>\n'+clone.outerHTML;
}
