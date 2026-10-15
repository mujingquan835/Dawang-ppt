export function layoutImages(o,style){
 const images=o.data.images||[];if(!images.length)throw new Error('Image material missing');const [x,y,w,h]=o.bounds;const gap=style.grid.gap||32;const mode=o.data.arrangement||'text-photo';const boxes=[];
 if(['text-photo','full-bleed','single'].includes(mode)){if(images.length!==1)throw new Error('Single image structure requires exactly one image');boxes.push([x,y,w,h]);}
 else if(mode==='primary-secondary'){boxes.push([x,y,w*.6,h]);const sw=w*.4-gap,sh=(h-gap*(images.length-2))/(images.length-1);for(let i=1;i<images.length;i++)boxes.push([x+w*.6+gap,y+(i-1)*(sh+gap),sw,sh]);}
 else if(mode==='grid'){const cols=o.data.columns||Math.ceil(Math.sqrt(images.length));const rows=Math.ceil(images.length/cols);const cw=(w-(cols-1)*gap)/cols,ch=(h-(rows-1)*gap)/rows;images.forEach((_,i)=>boxes.push([x+(i%cols)*(cw+gap),y+Math.floor(i/cols)*(ch+gap),cw,ch]));}
 else throw new Error('Unsupported image arrangement '+mode);
 return images.map((image,i)=>({id:`${o.objectId}/image/${image.mediaId}`,parentId:o.objectId,type:'image',bounds:boxes[i],src:image.src,mediaRef:image.mediaRef,fit:image.kind==='screenshot'?'contain':image.fit||style.media.photoFit,clipShape:image.clipShape,focal:image.focal||'50% 50%',style:{radius:image.kind==='screenshot'?0:style.media.radius||0},sourceRef:image.sourceRef,alt:image.caption||''}));
}
