// Normalized source rectangle. The original image is always retained.
export const validImageCrop = crop => Array.isArray(crop) && crop.length===4 && crop.every(Number.isFinite) && crop[0]>=0 && crop[1]>=0 && crop[2]>0 && crop[3]>0 && crop[0]+crop[2]<=1+1e-8 && crop[1]+crop[3]<=1+1e-8;
export function imageCropGeometry(element,nw,nh){
 const [x,y,w,h]=element.bounds;
 if(validImageCrop(element.crop)){
  const [cx,cy,cw,ch]=element.crop;return{full:[x-cx*w/cw,y-cy*h/ch,w/cw,h/ch],frame:[x,y,w,h]};
 }
 const scale=(element.fit==='cover'?Math.max:Math.min)(w/nw,h/nh),dw=nw*scale,dh=nh*scale;
 const pct=v=>v==='left'||v==='top'?0:v==='right'||v==='bottom'?1:v==='center'?.5:Math.max(0,Math.min(1,(parseFloat(v)||0)/100));
 const focal=(element.focal||'50% 50%').split(/\s+/),fx=pct(focal[0]),fy=pct(focal[1]||focal[0]);
 const full=[x+(w-dw)*(element.fit==='cover'?fx:.5),y+(h-dh)*(element.fit==='cover'?fy:.5),dw,dh];
 return{full,frame:element.fit==='cover'?[x,y,w,h]:[...full]};
}
