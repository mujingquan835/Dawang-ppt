// Reusable frame presets. Style data selects one; no preset is coupled to a style identifier.
const T = (id, text, bounds, style = {}, role) => ({ id, type: "text", text, bounds, style, role });
const S = (id, bounds, style) => ({ id, type: "shape", bounds, style });
const L = (id, x, y, w, color, width = 2) => ({ id, type: "line", bounds: [x, y, w, 2], x1: 0, y1: 0, x2: w, y2: 0, style: { stroke: color, strokeWidth: width } });
function materializeDecoration(descriptor, content, style) {
  const d = structuredClone(descriptor);
  d.bounds = d.bounds.map(v => typeof v === "number" ? v : /^m([+-]\d+)?$/.test(v) ? style.grid.margin + Number(v.slice(1) || 0) : NaN);
  if (d.bounds.some(v => !Number.isFinite(v))) throw new Error("Invalid decoration bounds");
  d.style = Object.fromEntries(Object.entries(d.style || {}).map(([k, v]) => [k, typeof v === "string" && v.startsWith("$") ? v.slice(1).split(".").reduce((o, key) => o?.[key], style) : v]));
  if (d.text && typeof d.text === "object") d.text = content[d.text.field] || d.text.fallback || "";
  return d;
}
function composeFrame(content, style, kind) {
  const frame = style.layout.frame;
  const m = style.grid.margin, ink = style.palette.ink, accent = style.palette.accent;
  let bounds = [m, 270, 1920 - 2 * m, 700], elements = [], sourceAdaptation;
  const title = (b, size = style.typography.sizes.title) => T("title", content.title, b, { fontSize: size, fontFamily: style.typography.heading, fontWeight: 600, color: ink }, "title");
  const footer = () => T("source", content.source || "来源待补充", [m, 1020, 1920 - 2 * m, 42], { fontSize: style.typography.sizes.note, color: style.palette.muted });
  if (frame === "judgment-sidebar") {
    const image = kind === "images";
    elements = [S("judgment-panel", [1320, 250, 600, 750], { fill: style.palette.surface }), S("number-marker", [m, 94, 54, 54], { fill: style.palette.header, radius: 999 }), T("number", content.sequence || "01", [m + 6, 100, 42, 44], { fontSize: 26, color: "#ffffff", textAlign: "center" }), title([m + 80, 78, 1600, 112]), T("scope", content.scope || "材料、口径与范围", [m, 208, 1720, 40], { fontSize: 30, color: style.palette.muted }), L("evidence-rule", m, 255, 1230, style.palette.ink), footer()];
    bounds = [m, 290, 1170, 690];
    const judgments = content.judgments || [];
    if (judgments.length < 2) throw new Error("靛蓝判断栏需要至少两项真实判断，不能留空");
    judgments.slice(0, 4).forEach((text, i) => elements.push(T("judgment-" + i, text, [1360, 310 + i * 160, 490, 140], { fontSize: 34, lineHeight: 1.2, color: ink })));
    if (judgments.length > 4) throw new Error("判断栏超量；不能删除结论，请拆页或选择另一构图");
    if (image) sourceAdaptation = "photo-evidence-extension";
  } else if (frame === "documentary") {
    elements = [T("document-role", content.documentRole || "制作与验证", [m, 42, 250, 35], { fontSize: 25, color: ink }), T("section", content.section || "证据与判断", [m + 250, 42, 1200, 35], { fontSize: 25, color: style.palette.muted }), T("page", content.sequence || "01", [1720, 42, 160, 35], { fontSize: 25, color: ink, textAlign: "right" }), footer()];
    if (kind === "images") {
      if (content.data.images.length !== 1) throw new Error("月白多照片须拆为单主图证据页，不能删照片");
      elements.push(title([m, 215, 650, 350]), T("explanation", content.explanation || content.scope || "证据说明待补充", [m, 770, 620, 200], { fontSize: 34, lineHeight: 1.28, color: ink }));
      bounds = [770, 190, 1110, 800];
    } else {
      elements.push(title([m, 195, 1800, 150]), T("explanation", content.explanation || content.scope || "", [m, 373, 1770, 110], { fontSize: 34, lineHeight: 1.2, color: ink }));
      bounds = [m, 545, 1920 - 2 * m, 445];
    }
  } else if (frame === "teaching") {
    elements = [L("blue-top-rule", 0, 0, 1920, accent, 5), T("navigation", content.section || "方法 · 关系 · 实践", [m, 45, 850, 40], { fontSize: 28, color: style.palette.muted }), T("running-title", content.documentRole || "Dawang-PPT 融合制作", [1050, 45, 750, 40], { fontSize: 28, color: style.palette.muted, textAlign: "right" }), title([m, 130, 1696, 120]), footer(), S("corner-anchor", [1820, 980, 60, 60], { fill: "#e8eaed", radius: 999 })];
    if (kind === "images") {
      elements.push(T("explanation", content.explanation || content.scope || "照片证据与方法说明", [m, 300, 680, 550], { fontSize: 38, lineHeight: 1.25, color: ink }));
      bounds = [920, 315, 800, 650];
    } else {
      bounds = [m, 330, 1080, 620];
      const notes = content.explanations || content.judgments || [content.scope || "读者任务待确认"];
      notes.forEach((note, i) => elements.push(T("method-explanation-" + i, note, [1280, 345 + i * 180, 510, 155], { fontSize: 34, lineHeight: 1.2, color: ink })));
    }
  } else {
    const regions = style.layout.regions || {};
    elements = [title([m, 90, 1920 - 2 * m, regions.titleHeight || 110]), T("scope", content.scope || "", [m, regions.scopeY || 207, 1920 - 2 * m, 44], { fontSize: 28, color: style.palette.muted }), L("content-rule", m, regions.ruleY || 258, 1920 - 2 * m, style.palette.line), footer()];
    bounds = [m, regions.objectY || 285, 1920 - 2 * m, regions.objectHeight || 700];
    if (style.layout.titleWidth) elements.find(e => e.id === "title").bounds[2] = style.layout.titleWidth;
    elements.push(...(style.layout.decorations || []).map(d => materializeDecoration(d, content, style)));

  }
  return { elements, bounds, sourceAdaptation };
 }
export { composeFrame };
