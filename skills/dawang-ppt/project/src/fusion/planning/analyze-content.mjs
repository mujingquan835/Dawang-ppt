// Step 1 of content-first layout: describe the slide's material before choosing any layout.
const LANDSCAPE = 1.2, PORTRAIT = 0.83;
function classifyAspect(width, height) {
  const r = Number(width) / Number(height);
  if (!Number.isFinite(r) || r <= 0) return "unknown";
  return r >= LANDSCAPE ? "landscape" : r <= PORTRAIT ? "portrait" : "square";
}
const len = (s) => [...String(s ?? "")].length;
function analyzeContent(content) {
  const data = content.data || {};
  const rawImages = data.images || content.images || [];
  const images = rawImages.map((img, i) => {
    const width = img.width ?? img.naturalWidth, height = img.height ?? img.naturalHeight;
    const orientation = classifyAspect(width, height);
    return { index: i, mediaId: img.mediaId, kind: img.kind || "photo", width, height, ratio: orientation === "unknown" ? null : width / height, orientation };
  });
  const points = (content.points || []).map((p) => typeof p === "string" ? { body: p } : p);
  const bodyTexts = [content.explanation, ...(content.judgments || []), ...points.flatMap((p) => [p.heading || p.title, p.body || p.detail])].filter(Boolean);
  const textChars = bodyTexts.reduce((a, s) => a + len(s), 0);
  const series = data.series || [], rows = data.rows || [], metrics = content.metrics || [], actions = content.actions || [], nodes = data.nodes || [];
  let dataType = "text";
  if (series.length) dataType = "chart";
  else if (rows.length) dataType = "table";
  else if (metrics.length) dataType = "metrics";
  else if (actions.length) dataType = "actions";
  else if (nodes.length) dataType = "relation";
  else if (images.length) dataType = "images";
  const counts = { landscape: 0, portrait: 0, square: 0, unknown: 0 };
  images.forEach((im) => counts[im.orientation]++);
  const kinds = Object.entries(counts).filter(([, v]) => v).map(([k]) => k);
  const imageMix = !images.length ? "none" : kinds.length === 1 ? kinds[0] : "mixed";
  const itemCount = points.length || series.length || rows.length || metrics.length || actions.length || nodes.length;
  const density = textChars > 320 || itemCount > 5 ? "heavy" : textChars < 90 && itemCount <= 1 ? "light" : "medium";
  return { dataType, textChars, itemCount, points: points.length, density, imageCount: images.length, images, orientation: counts, imageMix, columns: data.columns?.length || 0, hasUnit: !!data.unit, chartKind: content.kind === "line" ? "line" : series.length ? "bar" : null, title: content.title, warnings: images.filter((im) => im.orientation === "unknown").map((im) => ({ kind: "image-size-unknown", mediaId: im.mediaId })) };
}
export { analyzeContent, classifyAspect };
