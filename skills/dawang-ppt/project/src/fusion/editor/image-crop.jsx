import {imageCropGeometry} from '../scene/image-crop.mjs';

// Edits only an overlay until confirmed. Coordinates never appear in the UI.
export function mountImageCrop({root,element,image,onApply,onClose}){
  const geometry=imageCropGeometry(element,image.naturalWidth,image.naturalHeight);
  let full=[...geometry.full],frame=[...geometry.frame],gesture=null,closed=false;
  const layer=document.createElement('div');layer.className='fusion-crop-editor';layer.dataset.editableSkip='true';
  layer.style.cssText='position:absolute;inset:0;z-index:20000;touch-action:none;user-select:none;background:rgba(0,0,0,.38)';
  const ghost=document.createElement('img');ghost.src=image.src;ghost.draggable=false;ghost.style.cssText='position:absolute;max-width:none;pointer-events:none;opacity:.5';layer.append(ghost);
  const view=document.createElement('div');view.dataset.cropFrame='true';view.style.cssText='position:absolute;overflow:visible;cursor:grab;border:2px solid white;box-sizing:border-box';layer.append(view);
  const clipped=document.createElement('div');clipped.style.cssText='position:absolute;inset:0;overflow:hidden;pointer-events:none';view.append(clipped);
  const preview=document.createElement('img');preview.src=image.src;preview.draggable=false;preview.style.cssText='position:absolute;max-width:none;pointer-events:none';clipped.append(preview);
  const grid=document.createElement('div');grid.style.cssText='position:absolute;inset:0;pointer-events:none;background:linear-gradient(to right,transparent 33%,#ffffff70 33%,#ffffff70 33.2%,transparent 33.2%,transparent 66%,#ffffff70 66%,#ffffff70 66.2%,transparent 66.2%),linear-gradient(to bottom,transparent 33%,#ffffff70 33%,#ffffff70 33.2%,transparent 33.2%,transparent 66%,#ffffff70 66%,#ffffff70 66.2%,transparent 66.2%)';view.append(grid);
  for(const [direction,left,top] of [['nw','0%','0%'],['n','50%','0%'],['ne','100%','0%'],['e','100%','50%'],['se','100%','100%'],['s','50%','100%'],['sw','0%','100%'],['w','0%','50%']]){
    const handle=document.createElement('button');handle.type='button';handle.dataset.cropHandle=direction;handle.setAttribute('aria-label','调整裁切边框 '+direction);
    handle.style.cssText=`position:absolute;left:${left};top:${top};width:18px;height:18px;transform:translate(-50%,-50%);padding:0;border:2px solid white;background:#151515;cursor:${direction}-resize`;
    view.append(handle);
  }
  const toolbar=document.createElement('div');toolbar.style.cssText='position:absolute;left:24px;top:20px;display:flex;align-items:center;gap:10px;max-width:calc(100% - 48px);padding:12px 16px;border-radius:10px;background:#fff;color:#222;box-shadow:0 3px 15px #0005;font:24px sans-serif';layer.append(toolbar);
  const hint=document.createElement('span');hint.textContent='拖动图片调整位置，拖动边框裁切';toolbar.append(hint);
  const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:8px 12px;border:1px solid #ccc;border-radius:6px;background:white;color:#222;font:22px sans-serif;cursor:pointer';b.onclick=fn;toolbar.append(b);return b;};
  const draw=()=>{
    const [x,y,w,h]=full,[fx,fy,fw,fh]=frame;
    Object.assign(ghost.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    Object.assign(view.style,{left:fx+'px',top:fy+'px',width:fw+'px',height:fh+'px'});
    Object.assign(preview.style,{left:(x-fx-2)+'px',top:(y-fy-2)+'px',width:w+'px',height:h+'px'});
  };
  const close=()=>{
    if(closed)return;closed=true;layer.remove();document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancelGesture);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancelGesture);onClose();
  };
  const confirm=()=>{
    const [x,y,w,h]=full,[fx,fy,fw,fh]=frame;
    const crop=[Math.max(0,(fx-x)/w),Math.max(0,(fy-y)/h),fw/w,fh/h];
    close();onApply({crop,bounds:[...frame]});
  };
  const zoom=factor=>{
    const [x,y,w,h]=full,[fx,fy,fw,fh]=frame;
    const nw=Math.max(fw,w*factor),nh=nw*h/w;
    if(nh<fh)return;
    full=[Math.min(fx,Math.max(fx+fw-nw,x-(nw-w)/2)),Math.min(fy,Math.max(fy+fh-nh,y-(nh-h)/2)),nw,nh];draw();
  };
  button('放大图片',()=>zoom(1.15));button('缩小图片',()=>zoom(1/1.15));
  button('确认裁切',confirm);button('取消裁切',close);
  const point=ev=>{const r=root.getBoundingClientRect(),scale=r.width/1920;return[(ev.clientX-r.left)/scale,(ev.clientY-r.top)/scale];};
  layer.addEventListener('pointerdown',ev=>{
    if(ev.button!==0||ev.target.closest('div')===toolbar||toolbar.contains(ev.target))return;
    const handle=ev.target.closest('[data-crop-handle]');
    if(!handle&&!view.contains(ev.target))return;
    gesture={point:point(ev),full:[...full],frame:[...frame],handle:handle?.dataset.cropHandle,pointerId:ev.pointerId,capture:ev.target};
    ev.target.setPointerCapture?.(ev.pointerId);ev.preventDefault();ev.stopPropagation();
  });
  const move=ev=>{
    if(!gesture||gesture.pointerId!==ev.pointerId)return;
    const p=point(ev),dx=p[0]-gesture.point[0],dy=p[1]-gesture.point[1],g=gesture;
    const [x,y,w,h]=g.full,[fx,fy,fw,fh]=g.frame;
    if(!g.handle){full=[Math.min(fx,Math.max(fx+fw-w,x+dx)),Math.min(fy,Math.max(fy+fh-h,y+dy)),w,h];}
    else{
      let l=fx,t=fy,r=fx+fw,b=fy+fh;
      if(g.handle.includes('w'))l=Math.max(x,Math.min(r-20,fx+dx));
      if(g.handle.includes('e'))r=Math.min(x+w,Math.max(l+20,fx+fw+dx));
      if(g.handle.includes('n'))t=Math.max(y,Math.min(b-20,fy+dy));
      if(g.handle.includes('s'))b=Math.min(y+h,Math.max(t+20,fy+fh+dy));
      frame=[l,t,r-l,b-t];
    }
    draw();ev.preventDefault();
  };
  const release=g=>{if(g.capture.hasPointerCapture?.(g.pointerId))g.capture.releasePointerCapture(g.pointerId);};
  const up=ev=>{if(!gesture||gesture.pointerId!==ev.pointerId)return;move(ev);const g=gesture;gesture=null;release(g);};
  const cancelGesture=()=>{if(!gesture)return;const g=gesture;gesture=null;full=g.full;frame=g.frame;release(g);draw();};
  const key=ev=>{if(ev.key==='Escape'){close();ev.preventDefault();ev.stopImmediatePropagation();}else if(ev.key==='Enter'){confirm();ev.preventDefault();ev.stopImmediatePropagation();}};
  document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancelGesture);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancelGesture);
  root.append(layer);draw();
  return {cancel:close,confirm};
}
