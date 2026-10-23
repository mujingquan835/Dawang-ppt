// Logical canvas units are CSS px (1920 × 1080); no layout or content decisions.
function element(type, spec) {
 if(!spec?.id||!Array.isArray(spec.bounds)||spec.bounds.length!==4||!spec.bounds.every(Number.isFinite)||spec.bounds[2]<=0||spec.bounds[3]<=0)throw new TypeError('id and positive bounds [x,y,width,height] required');
 return {type,...structuredClone(spec)};
}
export const textElement=spec=>element('text',spec);
export const imageElement=spec=>element('image',spec);
export function lineElement({id,from,to,style}) {
 if(![from,to].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw new TypeError('finite from/to required');
 const x=Math.min(from[0],to[0]),y=Math.min(from[1],to[1]);
 return element('line',{id,bounds:[x,y,Math.max(1,Math.abs(to[0]-from[0])),Math.max(1,Math.abs(to[1]-from[1]))],x1:from[0]-x,y1:from[1]-y,x2:to[0]-x,y2:to[1]-y,...(style?{style}:{} )});
}

// Reuse presentation styles without choosing page structure or changing geometry.
export function createTextAuthor({baseStyle={},roles={}}={}) {
 return ({role,style,...spec})=>{
  if(role&&!Object.hasOwn(roles,role))throw Error('Unknown typography role: '+role);
  return textElement({...spec,style:{...baseStyle,...(roles[role]||{}),...style}});
 };
}
export function distributeBounds({origin:[x,y],sizes,gap=0,direction='horizontal'}) {
 if(!['horizontal','vertical'].includes(direction)||![x,y,gap].every(Number.isFinite)||!Array.isArray(sizes)||sizes.some(s=>!Array.isArray(s)||s.length!==2||!s.every(v=>Number.isFinite(v)&&v>0)))throw Error('Finite origin/gap and positive [width,height] sizes required');
 return sizes.map(([w,h])=>{const bounds=[x,y,w,h];if(direction==='horizontal')x+=w+gap;else y+=h+gap;return bounds;});
}
