import definitions from "./definitions.json" with { type: "json" };
// Definitions are plain data. A new skin selects reusable presets; its id never selects code.
const STYLE_DEFINITIONS = definitions;
function resolveStyle(id, variant) {
  const style = STYLE_DEFINITIONS[id];
  if (!style) throw new Error(`Style ${id} not adapted for composition`);
  if (variant && variant !== style.source?.variant) throw new Error(`Unknown source variant ${variant}`);
  return structuredClone(style);
}
export { STYLE_DEFINITIONS, resolveStyle };

// Project-specific brand tokens do not register a new style or change original templates.
// Authored slides take the deck palette (designChoice.appearance) as their default; a slide's own palette wins.
function resolveSlideStyle(slide,project) {
 const authored=['dawang-authored-v1','kimi-authored-v1'].includes(slide.authoring?.engine) && slide.styleId==='authored/custom';
 const style=authored
  ? {id:'authored/custom',source:{kind:'authored'},palette:{bg:'#FFFFFF',ink:'#161616',muted:'#667085',accent:'#245B48',line:'#D8DEE5'},typography:{heading:'sans-serif',body:'sans-serif',mono:'monospace',sizes:{title:82,body:34,note:23}}}
  : resolveStyle(slide.styleId);
 if(authored&&project?.designChoice?.appearance?.palette)style.palette={...style.palette,...project.designChoice.appearance.palette};
 if(slide.appearance?.palette)style.palette={...style.palette,...slide.appearance.palette};
 if(slide.typography){
  const pt=slide.typography.bodyPt;
  if(!Number.isFinite(pt)||pt<10||pt>24)throw new Error('Invalid project bodyPt');
  style.typography={...style.typography,bodyPt:pt,sizes:{...style.typography.sizes,body:pt*2}};
 }
 return style;
}
export {resolveSlideStyle};

// Historical skins retain their original defaults; only an explicit project setting changes them.
export const bodyPx=s=>s.typography?.bodyPt?s.typography.bodyPt*2:28;
