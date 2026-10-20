import React from 'react';
export function VectorElement({element,position,attributes}) {
 const s=element.style||{};
 return <svg {...attributes} style={position} viewBox={element.viewBox.join(' ')} preserveAspectRatio="xMidYMid meet" aria-label={element.alt||undefined}>
  <path d={element.path} fill={s.fill??'none'} stroke={s.stroke??'currentColor'} strokeWidth={s.strokeWidth??2} strokeLinecap={s.strokeLinecap??'round'} strokeLinejoin={s.strokeLinejoin??'round'} opacity={s.opacity??1}/>
 </svg>;
}
