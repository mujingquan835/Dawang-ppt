import { planSlide } from "../planning/plan-slide.mjs";
const T = (id, text, bounds, style = {}, role) => ({ id, type: "text", text, bounds, style, role });
const S = (id, bounds, style) => ({ id, type: "shape", bounds, style });
const L = (id, x, y, w, color, width = 2) => ({ id, type: "line", bounds: [x, y, w, 2], x1: 0, y1: 0, x2: w, y2: 0, style: { stroke: color, strokeWidth: width } });
function composeContentSlide(content, style) {
  const id = content.slideId || crypto.randomUUID(), kind = content.kind || planSlide(content, style).objectKind;
  if (!kind) throw new Error("Content relationship required");
  const m = style.grid.margin, ink = style.palette.ink, accent = style.palette.accent;
  let bounds = [m, 270, 1920 - 2 * m, 700], elements = [], sourceAdaptation;
  const title = (b, size = style.typography.sizes.title) => T("title", content.title, b, { fontSize: size, fontFamily: style.typography.heading, fontWeight: 600, color: ink }, "title");
  const footer = () => T("source", content.source || "来源待补充", [m, 1020, 1920 - 2 * m, 42], { fontSize: style.typography.sizes.note, color: style.palette.muted });
  if (style.id.startsWith("kimi/consulting")) {
    const image = kind === "images";
    elements = [S("judgment-panel", [1320, 250, 600, 750], { fill: style.palette.surface }), S("number-marker", [m, 94, 54, 54], { fill: style.palette.header, radius: 999 }), T("number", content.sequence || "01", [m + 6, 100, 42, 44], { fontSize: 26, color: "#ffffff", textAlign: "center" }), title([m + 80, 78, 1600, 112]), T("scope", content.scope || "材料、口径与范围", [m, 208, 1720, 40], { fontSize: 30, color: style.palette.muted }), L("evidence-rule", m, 255, 1230, style.palette.ink), footer()];
    bounds = [m, 290, 1170, 690];
    const judgments = content.judgments || [];
    if (judgments.length < 2) throw new Error("靛蓝判断栏需要至少两项真实判断，不能留空");
    judgments.slice(0, 4).forEach((text, i) => elements.push(T("judgment-" + i, text, [1360, 310 + i * 160, 490, 140], { fontSize: 34, lineHeight: 1.2, color: ink })));
    if (judgments.length > 4) throw new Error("判断栏超量；不能删除结论，请拆页或选择另一构图");
    if (image) sourceAdaptation = "photo-evidence-extension";
  } else if (style.id.startsWith("kimi/work")) {
    elements = [T("document-role", content.documentRole || "制作与验证", [m, 42, 250, 35], { fontSize: 25, color: ink }), T("section", content.section || "证据与判断", [290, 42, 1200, 35], { fontSize: 25, color: style.palette.muted }), T("page", content.sequence || "01", [1720, 42, 160, 35], { fontSize: 25, color: ink, textAlign: "right" }), footer()];
    if (kind === "images") {
      if (content.data.images.length !== 1) throw new Error("月白多照片须拆为单主图证据页，不能删照片");
      elements.push(title([m, 215, 650, 350]), T("explanation", content.explanation || content.scope || "证据说明待补充", [m, 770, 620, 200], { fontSize: 34, lineHeight: 1.28, color: ink }));
      bounds = [770, 190, 1110, 800];
    } else {
      elements.push(title([m, 195, 1800, 150]), T("explanation", content.explanation || content.scope || "", [m, 373, 1770, 110], { fontSize: 34, lineHeight: 1.2, color: ink }));
      bounds = [m, 545, 1840, 445];
    }
  } else if (style.id.startsWith("kimi/academic")) {
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
    elements = [title([m, 90, 1920 - 2 * m, 110]), T("scope", content.scope || "", [m, 207, 1920 - 2 * m, 44], { fontSize: 28, color: style.palette.muted }), L("content-rule", m, 258, 1920 - 2 * m, style.palette.line), footer()];
    bounds = [m, 285, 1920 - 2 * m, 700];
    if (style.id === "legacy/theme13") elements.push(S("cobalt-marker", [m - 28, 95, 9, 90], { fill: accent }));
    if (style.id === "legacy/theme16") {
      elements.find((e) => e.id === "title").bounds[2] = 1500;
    }
    if (style.id === "legacy/theme16") elements.push(T("blueprint-index", content.sequence || "01", [1730, 82, 100, 78], { fontSize: 50, color: accent, textAlign: "right" }));
  }
  const data = structuredClone(content.data || {});
  if (kind === "images") {
    data.arrangement = data.arrangement || "single";
    if (style.id.startsWith("kimi/academic")) data.images = data.images.map((image) => ({ ...image, clipShape: image.kind === "screenshot" ? void 0 : "ellipse" }));
  }
  const object = { objectId: id + "-primary", kind, bounds, data, nodeIds: (data.nodes || data.series || []).map((n) => n.nodeId), ...content.relationships !== void 0 ? { relationships: structuredClone(content.relationships), relationshipPolicy: "explicit" } : { relationshipPolicy: "sequence" }, overrides: {} };
  const composed = applyPageType({ slideId: id, mode: "composition", styleId: style.id, compositionId: kind === "images" ? style.id.startsWith("kimi/consulting") ? "photo-evidence-extension" : style.id.startsWith("kimi/work") ? "text-photo" : style.id.startsWith("kimi/academic") ? "argument-image" : "image" : style.id.startsWith("kimi/consulting") ? "conclusion-judgment" : style.id.startsWith("kimi/academic") ? "method-diagram" : "conclusion-evidence", label: content.title, sourceAdaptation, elements, objects: [object], readerTask: content.readerTask, requiredContentRefs: content.requiredContentRefs || [] }, content, style);
  for (const e of composed.elements) {
    const ref = e.role === "title" ? content.titleRef : e.id === "explanation" ? content.explanationRef : e.id === "scope" ? content.scopeRef : void 0;
    if (ref) e.contentRef = ref;
  }
  return composed;
}
function applyPageType(slide, content, style) {
  const type = content.pageType;
  if (type && style.pageTypes && !style.pageTypes.includes(type)) throw new Error("Unsupported family page type " + type);
  if (!type) return slide;
  const ink = style.palette.ink, accent = style.palette.accent, m = style.grid.margin;
  slide.compositionId = type;
  if (style.id.startsWith("kimi/consulting")) {
    if (type === "framework") {
      slide.elements = slide.elements.filter((e) => e.id !== "judgment-panel" && !e.id.startsWith("judgment-"));
      slide.objects[0].bounds = [m, 310, 1740, 500];
      (content.judgments || []).forEach((note, i) => slide.elements.push(T("framework-note-" + i, note, [m + i % 2 * 850, 850 + Math.floor(i / 2) * 75, 800, 65], { fontSize: 30, color: ink })));
    }
    if (type === "contents") {
      if (content.data.nodes.length > 6) throw new Error("目录超过六项需要另一页型");
      slide.objects = [];
      slide.elements = [S("contents-gray", [960, 0, 960, 1080], { fill: style.palette.surface }), T("contents-title", content.title, [m, 200, 730, 160], { fontSize: 88, fontFamily: style.typography.heading, color: ink }, "title"), T("contents-note", content.scope || "", [m, 430, 700, 230], { fontSize: 34, color: style.palette.muted })];
      content.data.nodes.forEach((node, i) => {
        if (i === content.activeIndex) slide.elements.push(S("contents-active-" + node.nodeId, [960, 200 + i * 118, 960, 100], { fill: style.palette.header }));
        slide.elements.push(T("contents-item-" + node.nodeId, `${i + 1}. ${node.label}`, [1040, 220 + i * 118, 790, 84], { fontSize: 42, color: i === content.activeIndex ? "#ffffff" : ink }));
      });
    }
    if (type === "chapter") {
      slide.elements = [S("chapter-navy", [0, 0, 610, 1080], { fill: style.palette.header }), T("chapter-number", content.sequence || "01", [m, 180, 450, 205], { fontSize: 140, color: accent }), T("chapter-title", content.title, [m, 440, 450, 430], { fontSize: 78, fontFamily: style.typography.heading, color: "#ffffff" }, "title"), T("chapter-scope", content.scope || "", [680, 100, 1130, 150], { fontSize: 40, color: ink })];
      slide.objects[0].bounds = [680, 310, 1130, 650];
    }
    if (type === "heat-table") {
      if (content.kind !== "table" || content.data.rows.length < 8 || content.data.columns.length < 6) throw new Error("热表页需要至少八行六列的实际材料");
      slide.objects[0].data.heat = true;
    }
    if (type === "profile") {
      if (!content.microCharts || content.microCharts.length !== 4 || !content.navigation || content.navigation.length !== 5) throw new Error("画像页需要五项导航与四行实际微图表材料");
      slide.elements = slide.elements.filter((e) => e.id !== "judgment-panel" && !e.id.startsWith("judgment-"));
      slide.objects[0].bounds = [m, 330, 810, 650];
      content.navigation.forEach((item, i) => {
        slide.elements.push(S("profile-nav-" + i, [m + i * 330, 240, 308, 60], { fill: i === content.activeIndex ? style.palette.secondary : style.palette.surface, radius: 30 }), T("profile-nav-label-" + i, item, [m + i * 330 + 14, 253, 280, 43], { fontSize: 26, color: ink }));
      });
      content.microCharts.forEach((chart, i) => {
        slide.objects.push({ objectId: slide.slideId + "-micro-" + i, kind: chart.kind || "line", bounds: [980, 330 + i * 162, 490, 146], data: { ...chart.data, micro: true }, relationships: [], overrides: {} });
        if (!chart.judgments?.length) throw new Error("微图表旁缺少判断材料");
        chart.judgments.forEach((note, j) => slide.elements.push(T("profile-note-" + i + "-" + j, note, [1500, 340 + i * 162 + j * 65, 330, 58], { fontSize: 26, color: ink })));
      });
    }
  }
  if (style.id.startsWith("kimi/work")) {
    if (["photo-verdict", "image-statement"].includes(type)) {
      if (content.kind !== "images" || content.data.images.length !== 1) throw new Error("全幅观点页需要一张真实主照片");
      slide.objects[0].bounds = [40, 40, 1840, 1e3];
      slide.objects[0].layer = -2;
      slide.elements = [S("photo-caption-band", [40, 720, 1840, 320], { fill: "#002a12", opacity: 0.75 }), T("photo-verdict-title", content.title, [90, 765, 1650, 116], { fontSize: 88, fontFamily: style.typography.heading, color: "#ffffff" }, "title"), T("photo-verdict-note", content.explanation || content.scope || "", [90, 905, 1530, 100], { fontSize: 34, color: "#ffffff" })];
    }
    if (type === "section") {
      if (content.requiredContentRefs?.length || content.data?.series?.length || content.data?.rows?.length) throw new Error("章节页不能丢弃必需数据；请使用正文页型");
      slide.objects = [];
      slide.elements = [T("section-title", content.title, [40, 370, 1720, 330], { fontSize: 154, fontFamily: style.typography.heading, color: ink }, "title"), T("section-note", content.scope || "", [45, 810, 1200, 110], { fontSize: 34, color: style.palette.muted })];
    }
    if (type === "sparse-table") {
      if (content.data.rows.length > 8) throw new Error("月白稀疏表超过八行；请选择长表页型或拆页，不能删行");
      slide.objects[0].bounds = [m, 490, 1840, 500];
    }
  }
  if (style.id.startsWith("kimi/academic")) {
    if (type === "cover-section") {
      if (content.kind !== "images") throw new Error("蓝线封面需要真实主照片");
      slide.elements = [L("blue-top-rule", 0, 0, 1920, accent, 5), T("section-number", content.sequence || "01", [m, 105, 620, 195], { fontSize: 136, color: accent }), T("title", content.title, [m, 320, 735, 420], { fontSize: 122, fontFamily: style.typography.heading, color: ink }, "title"), T("scope", content.scope || "", [m, 835, 730, 140], { fontSize: 36, color: style.palette.muted }), S("geometry-circle", [1680, 880, 130, 130], { fill: accent, radius: 999 }), S("geometry-capsule", [1510, 1e3, 220, 35], { fill: "#202124", radius: 18 })];
      slide.objects[0].bounds = [960, 260, 850, 650];
    }
    if (type === "comparison-case") {
      if (content.kind !== "comparison" || content.data.nodes.length !== 2) throw new Error("教学比较页需要两个明示比较对象");
      slide.objects[0].data.direction = "vertical";
      if (content.deviceImage) slide.elements.push({ id: "device-screenshot", type: "image", src: content.deviceImage, fit: "contain", bounds: [1310, 670, 450, 270] });
    }
  }
  return slide;
}
export {
  composeContentSlide
};
