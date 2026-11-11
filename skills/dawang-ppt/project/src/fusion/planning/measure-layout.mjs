import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {resolveSlideStyle} from '../styles/registry.mjs';
import {cssFontStack} from '../styles/css-font.mjs';

// The same local @font-face declarations and CSS text properties used by the editor.
// Measurement performs no network requests and does not mutate a saved project.
async function createLayoutMeasurer({chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}={}) {
  const root=path.resolve(import.meta.dirname,'../../..');
  const template=fs.readFileSync(path.join(root,'assets/template-swiss.html'),'utf8');
  const fonts=(template.match(/@font-face\s*\{[^}]*\}/g)||[]).join('\n').replace(/url\(['"]?([^)'"\s]+)['"]?\)/g,(_,src)=>`url('${pathToFileURL(path.join(root,src)).href}')`);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dawang-layout-'));
  const file=path.join(dir,'measure.html');
  fs.writeFileSync(file,`<!doctype html><meta charset="utf-8"><style>${fonts}body{margin:0}</style><div id="measure"></div>`);
  let browser;
  try {
    browser=await chromium.launch({executablePath:chrome,headless:true});
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    await page.goto(pathToFileURL(file).href);
    return {
      async texts(specs,style=resolveSlideStyle({styleId:'authored/custom',authoring:{engine:'dawang-authored-v1'}})) {
        const normalized=specs.map(e=>({...e,runs:e.runs?.map(r=>({...r,style:{...r.style,...(r.style?.fontFamily?{fontFamily:cssFontStack(r.style.fontFamily)}:{})}})),fontFamily:cssFontStack(e.style?.fontFamily || ((e.role==='title'||e.id==='title')?style.typography.heading:style.typography.body)),fontSize:e.style?.fontSize||style.typography.sizes.body}));
        return page.evaluate(async specs=>{
          const root=document.getElementById('measure');root.replaceChildren();
          const nodes=specs.map(e=>{
            const node=document.createElement('div');
            const apply=(node,style)=>{for(const [key,value] of Object.entries(style||{}))node.style[key]=typeof value==='number'&&!['fontWeight','lineHeight','opacity','zIndex'].includes(key)?value+'px':String(value);if(style?.fontWeight&&!style?.fontVariationSettings)node.style.fontVariationSettings=`"wght" ${Number(style.fontWeight)||400}`;};
            if(e.runs)for(const run of e.runs){const span=document.createElement('span');span.textContent=run.text;span.dataset.fusionRun='true';apply(span,run.style);node.append(span);}else node.textContent=String(e.text??'');
            apply(node,e.style);
            const wght=Number(e.style?.fontWeight||400)||400;
            Object.assign(node.style,{position:'relative',width:e.bounds[2]+'px',boxSizing:'border-box',fontFamily:e.fontFamily,fontSize:e.fontSize+'px',fontWeight:String(wght),fontVariationSettings:`"wght" ${wght}`,lineHeight:String(e.style?.lineHeight||1.25),whiteSpace:'pre-wrap',overflowWrap:'break-word'});
            root.append(node);return node;
          });
          await document.fonts.ready;
          const generic=new Set(['serif','sans-serif','monospace','cursive','fantasy','system-ui','ui-sans-serif','ui-serif','ui-monospace','-apple-system']);
          const ctx=document.createElement('canvas').getContext('2d');
          for(const node of nodes)for(const el of [node,...node.querySelectorAll('span')]){
           const family=getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g,'');
           if(!generic.has(family)&&!['serif','monospace'].some(fallback=>{ctx.font='24px '+fallback;const base=ctx.measureText('Aa0123汉字').width;ctx.font='24px '+JSON.stringify(family)+','+fallback;return Math.abs(ctx.measureText('Aa0123汉字').width-base)>.01;}))throw new Error('font-unavailable: '+family);
          }
          // Asked per text (lastLine:true): how many lines it wraps to and how many characters sit on the last one.
          // Asked per text (lastLine:true): how many lines it wraps to, how many characters sit on the last one, and the
          // offset in the text where each later line starts. Glyphs of one line can sit a few pixels apart (Latin beside
          // Chinese), so a new line starts half a font size down.
          const lastLine=(node)=>{const half=parseFloat(getComputedStyle(node).fontSize)/2,range=document.createRange(),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),breaks=[];let at=0,lines=0,start=-Infinity,onLast=0;
           for(let t=walker.nextNode();t;t=walker.nextNode()){for(let k=0;k<t.length;k++,at++){if(/\s/.test(t.data[k]))continue;range.setStart(t,k);range.setEnd(t,k+1);const r=range.getClientRects()[0];if(!r)continue;const top=Math.round(r.top);if(top-start>half){lines++;if(lines>1)breaks.push(at);start=top;onLast=0;}onLast++;}}
           return {lines,lastLineChars:onLast,breaks};};
          return nodes.map((node,i)=>{
 const height=node.getBoundingClientRect().height,width=node.scrollWidth,wrap=specs[i].lastLine?lastLine(node):{};
 const clone=node.cloneNode(true);Object.assign(clone.style,{width:'max-content',whiteSpace:'pre'});root.append(clone);
 const naturalWidth=clone.getBoundingClientRect().width;clone.remove();
 return {...wrap,fontAvailable:true,id:specs[i].id,height,width,naturalWidth,fontFamily:getComputedStyle(node).fontFamily,fontSize:parseFloat(getComputedStyle(node).fontSize)};
});
        },normalized);
      },
      async imageSize(src) {
        return page.evaluate(src=>new Promise((resolve,reject)=>{
          const image=new Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});
          image.onerror=()=>reject(new Error('Image decode failed'));image.src=src;
        }),src);
      },
      async close(){await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
    };
  } catch(error) {await browser?.close();fs.rmSync(dir,{recursive:true,force:true});throw error;}
}
export {createLayoutMeasurer};
