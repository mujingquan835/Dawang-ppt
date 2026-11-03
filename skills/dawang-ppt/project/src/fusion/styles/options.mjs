// Appearance selection only: every new deck uses the same content-first planner.
import { SCENARIOS } from "../rules/index.mjs";
import { STYLE_DEFINITIONS } from "./registry.mjs";
const THEMES_BY_SCENARIO = {
  "analysis-decision": ["theme13", "theme07", "theme05", "theme16", "theme09", "theme17"],
  "business-plan": ["theme13", "theme15", "theme09", "theme17", "theme04", "theme16"],
  "management-report": ["theme13", "theme14", "theme17", "theme07", "theme05", "theme16"],
  "academic-research": ["theme07", "theme16", "theme13", "theme05", "theme17", "theme06"],
  "education-training": ["theme16", "theme17", "theme14", "theme01", "theme07", "theme13"],
  "tech-engineering": ["theme03", "theme06", "theme16", "theme09", "theme13", "theme07"],
  "brand-creative": ["theme09", "theme15", "theme17", "theme04", "theme02", "theme16"]
};
// Only already-adapted original appearances are selectable for new decks.
function listAppearances() {
  return Object.values(STYLE_DEFINITIONS).filter(s => s.id.startsWith("legacy/")).map(s => ({
    id:s.id, styleId:s.id, themeKey:s.id.split('/')[1], label:s.name,
    kind:"appearance", implemented:true, layoutEngine:"content-first",
    palette:s.palette, typography:{heading:s.typography.heading,body:s.typography.body}
  }));
}
function buildStyleOptions(scenario, { preferredThemes, dashiThemes, availableThemes } = {}) {
  const s = SCENARIOS.find(x => x.id === scenario.primary);
  if (!s) throw new Error("Primary scenario required before style choice");
  const preferred=preferredThemes || dashiThemes || THEMES_BY_SCENARIO[s.id];
  const available=listAppearances().filter(t=>!availableThemes||availableThemes.includes(t.themeKey));
  const keys=[...new Set([...preferred,...available.map(t=>t.themeKey)])];
  const tiles=keys.map(key=>available.find(t=>t.themeKey===key)).filter(Boolean).slice(0,9)
    .map((t,i)=>({...t,index:i+1,reason:`${s.zh}适用外观；布局由内容关系与实测决定`}));
  return {scenario:s.id,scenarioZh:s.zh,auxiliary:scenario.auxiliary||null,
    layoutEngine:"content-first",defaultIndex:null,tiles};
}
function resolveChoice(options, choice) {
  if (choice == null) throw new Error("请先选择外观；不会自动选择另一条制作路线");
  const tile = options.tiles.find(t => t.index === Number(choice) || t.id === choice || t.styleId === choice);
  if (!tile) throw new Error("Unknown style choice " + choice);
  if (!tile.implemented) throw new Error("该外观尚未完成新链路迁移；可明确选择原样模板兼容入口");
  return { mode: "composition", styleId: tile.styleId, sourceId: tile.id,
    scenario: options.scenario, auxiliary: options.auxiliary,
    layoutEngine: "content-first", export: "editable-pptx" };
}
function checkDesignConsistency(project) {
  const dc = project.designChoice || {}, issues = [];
  for (const slide of project.slides || []) {
    if (dc.layoutEngine === "content-first" && slide.mode === "template" && !dc.originalTemplate)
      issues.push({ slideId: slide.slideId, kind: "new-deck-bypassed-planner", layout: slide.layout });
    if (dc.styleId && slide.mode === "composition" && slide.styleId !== dc.styleId)
      issues.push({ slideId: slide.slideId, kind: "unrequested-style-change", styleId: slide.styleId });
  }
  return issues;
}
export { buildStyleOptions, resolveChoice, checkDesignConsistency, THEMES_BY_SCENARIO, listAppearances };
