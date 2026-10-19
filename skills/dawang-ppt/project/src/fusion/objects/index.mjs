import {layoutMeasuredTimeline} from './measured-timeline.mjs';
import {bodyPx} from '../styles/registry.mjs';
import { layoutAdaptiveRelation, layoutAdaptiveTimeline, layoutMeasuredRelation } from "./adaptive.mjs";
import { layoutTimeline } from "./timeline.mjs";
import { layoutTable } from "./table.mjs";
import { layoutDiagram } from "./diagram.mjs";
import { layoutChart } from "./chart.mjs";
import { layoutImages } from "../scene/image-layout.mjs";
import { applyOverrides } from "./primitives.mjs";
function layoutObject(o, s) {
  // Initial geometry survives an appearance change; palette/type still come from the new skin.
  if (o.geometryTokens) s = { ...s, grid: o.geometryTokens.grid, table: o.geometryTokens.table };
  const fn = o.kind === "timeline" ? layoutTimeline : o.kind === "table" ? layoutTable : ["bar", "line"].includes(o.kind) ? layoutChart : o.kind === "images" ? layoutImages : ["process", "hierarchy", "cycle", "matrix", "comparison", "causal"].includes(o.kind) ? layoutDiagram : null;
  if (!fn) throw new Error("Unsupported semantic kind " + o.kind);
  const adaptive = o.layoutVersion === 2 ? o.kind === "timeline" ? layoutAdaptiveTimeline(o,s) : ["process","causal","comparison"].includes(o.kind) ? layoutAdaptiveRelation(o,s) : null : null;
  let elements = o.layoutVersion === 4 && o.kind==='timeline' ? layoutMeasuredTimeline(o,s) : o.layoutVersion === 3 ? layoutMeasuredRelation(o,s) : adaptive || fn(o,s);
  if (o.layoutVersion === 2) elements = elements.map(e => e.type === "text" && !e.id.endsWith("/caption") ? {...e, style:{...e.style,fontSize:Math.max(bodyPx(s),e.style?.fontSize || s.typography.sizes.body)}} : e);
  return applyOverrides(elements, o);
}
function deriveSlideElements(slide, style) {
  const groups = [...(slide.elements || []).filter((e) => !e.parentId).map((e) => ({ layer: e.layer || 0, elements: [e] })), ...(slide.objects || []).map((o) => ({ layer: o.layer || 0, elements: layoutObject(o, style).sort((a, b) => (a.layer || 0) - (b.layer || 0)) }))];
  return groups.sort((a, b) => a.layer - b.layer).flatMap((g) => g.elements);
}
export {
  deriveSlideElements,
  layoutObject
};
