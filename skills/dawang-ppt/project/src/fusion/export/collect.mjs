// Independent DOM collector. Coordinates are measured in the logical 1920×1080 canvas.
export function collectSlideInDom(slideId){
 const slide=[...document.querySelectorAll('#deck > .slide')].find(s=>s.dataset.vmSlideId===slideId);if(!slide)throw new Error('Slide not materialized: '+slideId);
 const root=slide.querySelector('.fusion-root,.imported-theme-root')||slide;const box=root.getBoundingClientRect();const scale=box.width/1920;
 const bounds=r=>[(r.x-box.x)/scale,(r.y-box.y)/scale,r.width/scale,r.height/scale];const objects=[],issues=[];
 const rgba=color=>{const m=/rgba?\(([^)]+)\)/.exec(color);if(m){const parts=m[1].split(',').map(Number);if(parts[3]===0)return null;return '#'+parts.slice(0,3).map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');}const srgb=/color\(srgb ([^)]+)\)/.exec(color);if(srgb){const nums=srgb[1].split('/')[0].trim().split(/\s+/).map(Number);return '#'+nums.map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('');}return color==='transparent'||color==='none'?null:color;};
 const alpha=color=>{const m=/rgba\([^)]+,\s*([\d.]+)\)/.exec(color)||/color\([^/]+\/\s*([\d.]+)\)/.exec(color);return m?Number(m[1]):1;};
 const base=getComputedStyle(root);objects.push({id:slideId+'-background',type:'shape',bounds:[0,0,1920,1080],style:{fill:rgba(base.backgroundColor)||'#ffffff'}});
 const elements=[...root.querySelectorAll('*')];let count=0;
 for(const el of elements){const css=getComputedStyle(el);const r=el.getBoundingClientRect();if(!r.width||!r.height||css.display==='none'||css.visibility==='hidden')continue;
 const id=el.dataset.fusionElement||el.dataset.editableId||`${slideId}-dom-${++count}`;const b=bounds(r);
 if(el instanceof HTMLImageElement){if(!el.complete||!el.naturalWidth){issues.push({id,kind:'missing-image',src:el.src});continue;}objects.push({id,type:'image',bounds:b,src:el.src,fit:css.objectFit||'contain',focal:css.objectPosition,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,style:{radius:parseFloat(css.borderRadius)||0}});continue;}
 if(el instanceof SVGElement){if(el.tagName.toLowerCase()==='svg'){
 const vb=el.viewBox.baseVal;const sx=b[2]/(vb.width||b[2]),sy=b[3]/(vb.height||b[3]);
 for(const node of el.querySelectorAll('rect,circle,ellipse,line,polyline,polygon,path,text,image,use')){const nc=getComputedStyle(node);const tag=node.tagName.toLowerCase();const n=node.getBoundingClientRect();const nb=bounds(n);const sid=id+'-svg-'+objects.length;
 if(tag==='line')objects.push({id:sid,type:'line',bounds:[b[0],b[1],b[2],b[3]],points:[Number(node.getAttribute('x1'))*sx,Number(node.getAttribute('y1'))*sy,Number(node.getAttribute('x2'))*sx,Number(node.getAttribute('y2'))*sy],style:{stroke:rgba(nc.stroke)||'#111111',strokeWidth:Number(nc.strokeWidth)*sx}});
 else if(['rect','circle','ellipse'].includes(tag))objects.push({id:sid,type:'shape',shape:tag==='rect'?'rect':'ellipse',bounds:nb,style:{fill:rgba(nc.fill),stroke:rgba(nc.stroke),strokeWidth:Number(nc.strokeWidth)}});
 else if(tag==='text')objects.push({id:sid,type:'text',bounds:nb,text:node.textContent,style:{color:rgba(nc.fill),fontSize:parseFloat(nc.fontSize),fontFamily:nc.fontFamily}});
 else issues.push({id:sid,kind:'unsupported-svg',tag});
 }
 }continue;}
 const fill=rgba(css.backgroundColor);const border=Number.parseFloat(css.borderTopWidth);const uniformBorder=['Top','Right','Bottom','Left'].every(k=>css['border'+k+'Width']===css.borderTopWidth&&css['border'+k+'Color']===css.borderTopColor);if(!uniformBorder){for(const k of ['Top','Right','Bottom','Left']){const width=parseFloat(css['border'+k+'Width']);if(!width)continue;const points=k==='Top'?[0,0,b[2],0]:k==='Bottom'?[0,b[3],b[2],b[3]]:k==='Left'?[0,0,0,b[3]]:[b[2],0,b[2],b[3]];objects.push({id:id+'-border-'+k,type:'line',bounds:b,points,style:{stroke:rgba(css['border'+k+'Color']),strokeWidth:width,strokeTransparency:(1-alpha(css['border'+k+'Color']))*100}});}}if(fill||(border&&uniformBorder)){const st={fill,fillTransparency:(1-alpha(css.backgroundColor))*100,stroke:border&&uniformBorder?rgba(css.borderTopColor):null,strokeTransparency:(1-alpha(css.borderTopColor))*100,strokeWidth:border,radius:parseFloat(css.borderRadius)||0};let sb=b;
 if(css.transform!=='none'){const matrix=new DOMMatrix(css.transform);const rotation=Math.atan2(matrix.b,matrix.a)*180/Math.PI;const ow=el.offsetWidth,oh=el.offsetHeight;sb=[b[0]+b[2]/2-ow/2,b[1]+b[3]/2-oh/2,ow,oh];st.rotate=rotation;}
 objects.push({id:id+'-shape',type:'shape',bounds:sb,style:st});}
 for(const node of el.childNodes){if(node.nodeType!==Node.TEXT_NODE||!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);const nr=range.getBoundingClientRect();if(!nr.width||!nr.height)continue;const single=el.childNodes.length===1 && css.display!=='inline';const bb=single?b:bounds(nr);if(!single)bb[2]+=6;bb[3]=Math.max(bb[3],parseFloat(css.lineHeight)||parseFloat(css.fontSize)*1.25);objects.push({id:id+'-text-'+objects.length,type:'text',text:node.textContent,bounds:bb,style:{color:rgba(css.color),fontSize:parseFloat(css.fontSize),fontFamily:css.fontFamily,fontWeight:css.fontWeight,fontStyle:css.fontStyle,textAlign:css.textAlign,wrap:range.getClientRects().length>1,lineHeight:parseFloat(css.lineHeight)||parseFloat(css.fontSize)*1.25}});}
 }
 return{slideId,objects,issues};
}
export async function collectExportObjects(page,project){
 await page.evaluate(()=>document.fonts.ready);const results=[];const state=project.editorState;const hidden=new Set([...(state.deletedSlides||[]),...(state.skippedSlides||[])]);
 for(const id of state.slideOrder||project.slides.map(s=>s.slideId)){if(hidden.has(id))continue;await page.evaluate(id=>{const slides=window.__getVisibleSlides?.()||[];const i=slides.findIndex(s=>s.dataset.vmSlideId===id);window.go(i,{force:true,animate:false});window.__ensureRuntimeSlideRendered?.(slides[i]);},id);await page.waitForFunction(id=>{const s=[...document.querySelectorAll('.slide')].find(s=>s.dataset.vmSlideId===id);return s&&[...s.querySelectorAll('img')].every(i=>i.complete);},id);const result=await page.evaluate(collectSlideInDom,id);
 for(const o of result.objects)if(o.type==='image'&&!o.src.startsWith('data:'))o.src=await page.evaluate(async src=>{const blob=await(await fetch(src)).blob();return await new Promise(resolve=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.readAsDataURL(blob);});},o.src);
 results.push(result);
 }
 return{revision:project.revision,width:1920,height:1080,slides:results};
}
