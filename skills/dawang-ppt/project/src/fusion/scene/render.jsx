import { VectorElement } from './vector.jsx';
import React from "react";
import { resolveStyle, resolveSlideStyle } from "../styles/registry.mjs";
import { materializeElements } from "./model.mjs";
import { materializeElements as materializeElements2 } from "./model.mjs";
import { cssFontStack } from "../styles/css-font.mjs";

function SceneRoot({ slide, project, resolveAssetUrl }) {
  const style = resolveSlideStyle(slide, project);
  return <div className="fusion-root" data-authoring-engine={slide.authoring?.engine} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, overflow: "hidden", transform: "scale(var(--deck-scale))", transformOrigin: "top left", background: style.palette.bg, color: style.palette.ink, fontFamily: cssFontStack(style.typography.body) }}>
 {materializeElements(slide, project).map((e) => <SceneElement key={e.id} element={e} styleDefinition={style} resolveAssetUrl={resolveAssetUrl} />)}
 </div>;
}

// Only apply font-variation-settings for variable fonts like OPPO Sans 4.0;
// static multi-weight fonts (Source Han Sans SC, YouSheBiaoTiHei) rely on standard font-weight.
function weightVariation(weight, family) {
  if (!/OPPO\s*Sans/i.test(String(family || ''))) return void 0;
  const n = Number(weight);
  return Number.isFinite(n) && n >= 100 && n <= 900 ? `"wght" ${n}` : void 0;
}

function SceneElement({ element: e, styleDefinition: s, resolveAssetUrl }) {
  const [x, y, w, h] = e.bounds;
  const markerId = ("arrow-" + s.id + "-" + e.id).replace(/[^a-zA-Z0-9_-]/g, "-");
  const st = { position: "absolute", left: x, top: y, width: w, height: h, boxSizing: "border-box", ...e.style };
  const props = { "data-node-id": e.nodeId, "data-relationship-id": e.relationshipId, "data-from-node": e.fromNodeId, "data-to-node": e.toNodeId, "data-fusion-element": e.id, "data-fusion-parent": e.parentId || void 0, "data-element-type": e.type, "data-end-arrow": e.endArrow || void 0, "data-shape": e.shape || void 0, "data-clip-shape": e.clipShape || void 0 };
  if (e.type === "text") {
    const resolvedFamily = e.style?.fontFamily || (e.role === "title" || e.id === "title" ? s.typography.heading : s.typography.body);
    const fvs = e.style?.fontVariationSettings || weightVariation(e.style?.fontWeight || 400, resolvedFamily);
    return <div {...props} className={e.role === "title" || (e.style?.fontSize || 0) > 50 ? "fusion-title" : "fusion-body"} data-editable-path={`fusion-${e.id}`} data-fusion-font={e.manualStyle?.fontFamily ? "true" : undefined} style={{ ...st, ...(fvs ? { fontVariationSettings: fvs } : {}), "--fusion-text-font": cssFontStack(e.manualStyle?.fontFamily || e.style?.fontFamily), fontFamily: cssFontStack(resolvedFamily), fontSize: e.style?.fontSize || s.typography.sizes.body, lineHeight: e.style?.lineHeight || 1.25, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{e.runs ? e.runs.map((run,index)=>{const runFam=run.style?.fontFamily||resolvedFamily;const rfvs=run.style?.fontVariationSettings||weightVariation(run.style?.fontWeight||e.style?.fontWeight||400,runFam);return <span key={index} data-fusion-run={index} style={{...run.style,...(rfvs?{fontVariationSettings:rfvs}:{}),...(run.style?.fontFamily?{fontFamily:cssFontStack(run.style.fontFamily)}:{})}}>{run.text}</span>;}) : e.text || ""}</div>;
  }
  if (e.type === "vector") return <VectorElement element={e} position={{position:"absolute",left:x,top:y,width:w,height:h}} attributes={props} />;
  if (e.type === 'image' && e.crop) {
    const [cx,cy,cw,ch]=e.crop;
    const rawSrc = e.src || '';
    const isToken = rawSrc.startsWith('portable-asset:');
    const renderSrc = resolveAssetUrl ? resolveAssetUrl(rawSrc) : (isToken ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' : rawSrc);
    const tokenAttr = isToken ? rawSrc : undefined;
    return <div {...props} data-fusion-crop={JSON.stringify(e.crop)} style={{...st,overflow:'hidden',borderRadius:e.clipShape==='ellipse'?'50%':e.style?.radius||0}}><img alt={e.alt||''} src={renderSrc} data-asset-token={tokenAttr} draggable={false} style={{position:'absolute',maxWidth:'none',width:(100/cw)+'%',height:(100/ch)+'%',left:(-100*cx/cw)+'%',top:(-100*cy/ch)+'%',pointerEvents:'none'}} /></div>;
  }
  if (e.type === "image") {
    const rawSrc = e.src || '';
    const isToken = rawSrc.startsWith('portable-asset:');
    const renderSrc = resolveAssetUrl ? resolveAssetUrl(rawSrc) : (isToken ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' : rawSrc);
    const tokenAttr = isToken ? rawSrc : undefined;
    return <img {...props} alt={e.alt || ""} src={renderSrc} data-asset-token={tokenAttr} draggable={false} style={{ ...st, objectFit: e.fit || "contain", objectPosition: e.focal || "50% 50%", borderRadius: e.clipShape === "ellipse" ? "50%" : e.style?.radius || 0 }} />;
  }
  if (e.type === "line") return <svg {...props} style={{ ...st, overflow: "visible" }} viewBox={`0 0 ${w || 1} ${h || 1}`}><line x1={e.x1 ?? 0} y1={e.y1 ?? 0} x2={e.x2 ?? w} y2={e.y2 ?? h} stroke={e.style?.stroke || s.palette.accent} strokeWidth={e.style?.strokeWidth || 3} strokeDasharray={e.style?.strokeDash === "dash" ? "10 8" : void 0} markerEnd={e.endArrow ? `url(#${markerId})` : ""} /><defs><marker id={markerId} markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="14" refX="14" refY="7" orient="auto" overflow="visible"><path d="M0,0 L16,7 L0,14 Z" fill={e.style?.stroke || s.palette.accent} /></marker></defs></svg>;
  return <div {...props} style={{ ...st, background: e.style?.fill || e.style?.background || "transparent", border: e.style?.stroke ? `${e.style.strokeWidth || 2}px ${e.style.strokeDash === "dash" ? "dashed" : "solid"} ${e.style.stroke}` : void 0, borderRadius: e.style?.radius || 0 }} />;
}
export {
  SceneElement,
  SceneRoot,
  materializeElements2 as materializeElements
};
