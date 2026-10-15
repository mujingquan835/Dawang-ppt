// Appearance selection only: every new deck uses the same content-first planner.
import { SCENARIOS } from "./reference-index.mjs";
import { STYLE_DEFINITIONS } from "../styles/registry.mjs";
const DASHI_BY_SCENARIO = {
  "analysis-decision": ["theme13", "theme07", "theme05", "theme16", "theme09", "theme17"],
  "business-plan": ["theme13", "theme15", "theme09", "theme17", "theme04", "theme16"],
  "management-report": ["theme13", "theme14", "theme17", "theme07", "theme05", "theme16"],
  "academic-research": ["theme07", "theme16", "theme13", "theme05", "theme17", "theme06"],
  "education-training": ["theme16", "theme17", "theme14", "theme01", "theme07", "theme13"],
  "tech-engineering": ["theme03", "theme06", "theme16", "theme09", "theme13", "theme07"],
  "brand-creative": ["theme09", "theme15", "theme17", "theme04", "theme02", "theme16"]
};
const IMPLEMENTED_PRESETS = { "consulting/indigo-due-diligence": "kimi/consulting/indigo-due-diligence", "work/moon-white-imagery": "kimi/work/moon-white-imagery", "academic/blue-line-courseware": "kimi/academic/blue-line-courseware" };
function buildStyleOptions(scenario, { presets = [], dashiThemes, availableThemes, dashiCount = 5, presetCount = 4 } = {}) {
  const s = SCENARIOS.find(x => x.id === scenario.primary);
  if (!s) throw new Error("Primary scenario required before style choice");
  const matched = presets.filter(p => s.presetCategories.includes(p.category)).sort((a, b) =>
    Number(!!a.numbered) - Number(!!b.numbered) ||
    Number(!!IMPLEMENTED_PRESETS[`${b.category}/${b.name}`]) - Number(!!IMPLEMENTED_PRESETS[`${a.category}/${a.name}`]) ||
    s.presetCategories.indexOf(a.category) - s.presetCategories.indexOf(b.category) || a.name.localeCompare(b.name)
  );
  const presetTiles = matched.slice(0, presetCount).map(p => ({
    kind: "kimi-preset", id: p.presetId, label: `Kimi 预设 · ${p.name}`, category: p.category,
    doc: p.doc, styleId: IMPLEMENTED_PRESETS[`${p.category}/${p.name}`] || null,
    implemented: !!STYLE_DEFINITIONS[IMPLEMENTED_PRESETS[`${p.category}/${p.name}`]],
    reason: `${s.zh}场景适用；迁移未完成的预设仅作资料索引`
  }));
  const preferred = dashiThemes || DASHI_BY_SCENARIO[s.id];
  const keys = [...new Set([...preferred, ...(availableThemes || Object.values(DASHI_BY_SCENARIO).flat())])]
    .filter(key => !availableThemes || availableThemes.includes(key));
  const dashi = keys.map(key => ({ kind: "dashi-theme", id: key, themeKey: key,
    label: `dashi ${key}`, styleId: "legacy/" + key,
    implemented: !!STYLE_DEFINITIONS["legacy/" + key], reason: `保留${s.zh}适用的原风格；新稿使用统一规划器` }));
  const tiles = [...dashi.slice(0, dashiCount), ...presetTiles, ...dashi.slice(dashiCount)]
    .slice(0, 9).map((tile, i) => ({ index: i + 1, ...tile }));
  return { scenario: s.id, scenarioZh: s.zh, auxiliary: scenario.auxiliary || null,
    layoutEngine: "content-first", defaultIndex: null, tiles };
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
export { buildStyleOptions, resolveChoice, checkDesignConsistency, DASHI_BY_SCENARIO, IMPLEMENTED_PRESETS };
