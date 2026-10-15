import React from 'react';import {resolveStyle} from '../styles/registry.mjs';
import {useSlideViewModel} from '../../view-model/context.jsx';
import {materializeElements} from './model.mjs';
export {materializeElements} from './model.mjs';
export function SceneRoot({slide,project}){
 const style=resolveStyle(slide.styleId);return <div className="fusion-root" style={{position:'absolute',left:0,top:0,width:1920,height:1080,overflow:'hidden',transform:'scale(var(--deck-scale))',transformOrigin:'top left',background:style.palette.bg,color:style.palette.ink,fontFamily:style.typography.body}}>
 {materializeElements(slide,project).map(e=><SceneElement key={e.id} element={e} styleDefinition={style}/>)}
 </div>;
}
export function SceneElement({element:e,styleDefinition:s}){
 const [x,y,w,h]=e.bounds;const markerId=('arrow-'+s.id+'-'+e.id).replace(/[^a-zA-Z0-9_-]/g,'-');const st={position:'absolute',left:x,top:y,width:w,height:h,boxSizing:'border-box',...e.style};const props={'data-fusion-element':e.id,'data-fusion-parent':e.parentId||undefined,'data-element-type':e.type,'data-end-arrow':e.endArrow||undefined,'data-shape':e.shape||undefined,'data-clip-shape':e.clipShape||undefined};
 if(e.type==='text')return <div {...props} className={e.role==='title'||(e.style?.fontSize||0)>50?'fusion-title':'fusion-body'} data-editable-path={`fusion-${e.id}`} style={{...st,fontSize:e.style?.fontSize||s.typography.sizes.body,lineHeight:e.style?.lineHeight||1.25,whiteSpace:'pre-wrap',overflowWrap:'break-word'}}>{e.text||''}</div>;
 if(e.type==='image')return <img {...props} alt={e.alt||''} src={e.src} draggable={false} style={{...st,objectFit:e.fit||'contain',objectPosition:e.focal||'50% 50%',borderRadius:e.clipShape==='ellipse'?'50%':e.style?.radius||0}}/>;
 if(e.type==='line')return <svg {...props} style={{...st,overflow:'visible'}} viewBox={`0 0 ${w||1} ${h||1}`}><line x1={e.x1??0} y1={e.y1??0} x2={e.x2??w} y2={e.y2??h} stroke={e.style?.stroke||s.palette.accent} strokeWidth={e.style?.strokeWidth||3} markerEnd={e.endArrow?`url(#${markerId})`:''}/><defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill={e.style?.stroke||s.palette.accent}/></marker></defs></svg>;
 return <div {...props} style={{...st,background:e.style?.fill||e.style?.background||'transparent',border:e.style?.stroke?`${e.style.strokeWidth||2}px solid ${e.style.stroke}`:undefined,borderRadius:e.style?.radius||0}}/>;
}
export function CompositionPage(props){const vm=useSlideViewModel();return <section className="slide fusion-slide" data-layout="fusion-composition" data-vm-slide-id={vm.id} data-vm-slide-key={vm.key} data-vm-layout="fusion-composition" data-vm-index={vm.index} data-label={vm.label}><SceneRoot slide={props.fusionSlide} project={props.fusionProject}/></section>;}
