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
function resolveSlideStyle(slide) {
 const style=resolveStyle(slide.styleId);
 if(slide.appearance?.palette)style.palette={...style.palette,...slide.appearance.palette};
 return style;
}
export {resolveSlideStyle};
