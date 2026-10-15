const relationKinds = { parallel: "comparison", comparison: "comparison", sequence: "process", process: "process", hierarchy: "hierarchy", cycle: "cycle", matrix: "matrix", causal: "causal", chronology: "timeline", timeline: "timeline", tabular: "table", trend: "line", ranking: "bar", photographic: "images" };
function planSlide(content, style, capabilities = style.capabilities) {
  if (content.originalLayout) return { ok: true, mode: "template", layout: content.originalLayout, props: content.props, reason: "用户要求原样模板，保留原组件与结构。" };
  const kind = relationKinds[content.relation];
  if (!kind) return { ok: false, conflicts: [{ kind: "relation-required", message: "请先判断信息关系；不以随机页型替代理解。" }] };
  if (!capabilities.includes(kind) && !["images", "causal"].includes(kind)) return { ok: false, conflicts: [{ kind: "unsupported-object", objectKind: kind, styleId: style.id }] };
  if (style.media.onlyPrimary && (content.images || content.data?.images)?.length > 1) return { ok: false, conflicts: [{ kind: "style-media-conflict", message: "该家族仅允许单张主图，必需照片不可删除。", choices: ["拆为独立证据页", "选择支持图片组的原风格"] }] };
  const composition = kind === "images" ? style.layout.imageComposition : style.layout.composition;
  return { ok: true, mode: "composition", compositionId: composition, objectKind: kind, styleId: style.id, readerTask: content.readerTask, reason: `关系 ${content.relation} 用 ${kind} 表达；${style.signature}。`, contentBindings: content.requiredContentRefs || [], density: content.scenario === "education-training" ? "guided" : style.density };
}
export {
  planSlide
};
