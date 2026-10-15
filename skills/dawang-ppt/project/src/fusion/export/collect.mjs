import { checkCoverage } from "../qa/coverage.mjs";
function collectSlideInDom(slideId) {
  const slide = [...document.querySelectorAll("#deck > .slide")].find((s) => s.dataset.vmSlideId === slideId);
  if (!slide) throw new Error("Slide not materialized: " + slideId);
  const root = slide.querySelector(".fusion-root,.imported-theme-root") || slide;
  const box = root.getBoundingClientRect();
  const scale = box.width / 1920;
  const bounds = (r) => [(r.x - box.x) / scale, (r.y - box.y) / scale, r.width / scale, r.height / scale];
  const objects = [], issues = [];
  const svgGradient = (value) => {
    const id = /url\(["']?#([^"')]+)/.exec(value)?.[1];
    const g = id && document.getElementById(id);
    if (!g || !["linearGradient", "radialGradient"].includes(g.tagName)) return null;
    return { kind: g.tagName === "radialGradient" ? "radial" : "linear", angle: 0, stops: [...g.querySelectorAll("stop")].map((n) => ({ offset: n.getAttribute("offset")?.endsWith("%") ? parseFloat(n.getAttribute("offset")) / 100 : parseFloat(n.getAttribute("offset")), color: getComputedStyle(n).stopColor, opacity: Number(getComputedStyle(n).stopOpacity) })) };
  };
  const rgba = (color) => {
    if (color?.startsWith("url(")) {
      const g = svgGradient(color);
      return g?.stops.length ? rgba(g.stops[0].color) : null;
    }
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (m) {
      const parts = m[1].split(",").map(Number);
      if (parts[3] === 0) return null;
      return "#" + parts.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
    }
    const srgb = /color\(srgb ([^)]+)\)/.exec(color);
    if (srgb) {
      const nums = srgb[1].split("/")[0].trim().split(/\s+/).map(Number);
      return "#" + nums.map((n) => Math.round(n * 255).toString(16).padStart(2, "0")).join("");
    }
    return color === "transparent" || color === "none" ? null : color;
  };
  const alpha = (color) => {
    const m = /rgba\([^)]+,\s*([\d.]+)\)/.exec(color) || /color\([^/]+\/\s*([\d.]+)\)/.exec(color);
    return m ? Number(m[1]) : 1;
  };
  const resolveActualFont = (stack, text) => {
    const fonts = stack.split(",").map((f) => f.trim().replaceAll('"', "").replaceAll("'", ""));
    const probe = document.createElement("canvas").getContext("2d"), sample = "Aa0123汉字";
    const available = (font) => ["monospace", "serif"].some((fallback) => {
      probe.font = `24px ${fallback}`;
      const base2 = probe.measureText(sample).width;
      probe.font = `24px "${font}",${fallback}`;
      return Math.abs(probe.measureText(sample).width - base2) > 0.01;
    });
    const cjk = /[\u3400-\u9fff]/.test(text);
    return (cjk ? fonts.find((f) => /SC|CJK|MiSans|OPPO|SimSun|SimHei|Microsoft YaHei|DengXian|KaiTi/.test(f) && available(f)) : fonts.find(available)) || fonts.find(available) || fonts[0];
  };
  const base = getComputedStyle(root);
  objects.push({ id: slideId + "-background", type: "shape", bounds: [0, 0, 1920, 1080], style: { fill: rgba(base.backgroundColor) || "#ffffff" } });
  const elements = [...root.querySelectorAll("*")];
  let count = 0;
  for (const el of elements) {
    if (el.closest(".fusion-selection")) continue;
    const css = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || css.display === "none" || css.visibility === "hidden") continue;
    if (el instanceof HTMLCanvasElement) {
      issues.push({ kind: "canvas-needs-classification", message: "Canvas must be classified as decoration or information before export" });
      continue;
    }
    if (el.dataset.elementType === "text" && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) issues.push({ kind: "text-overflow", id: el.dataset.fusionElement, text: el.textContent });
    const id = el.dataset.fusionElement || el.dataset.editableId || `${slideId}-dom-${++count}`;
    const b = bounds(r);
    if (el instanceof HTMLImageElement) {
      if (!el.complete || !el.naturalWidth) {
        issues.push({ id, kind: "missing-image", src: el.src });
        continue;
      }
      objects.push({ id, type: "image", bounds: b, src: el.src, clipShape: el.dataset.clipShape, fit: css.objectFit || "contain", focal: css.objectPosition, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight, style: { radius: parseFloat(css.borderRadius) || 0 } });
      continue;
    }
    if (el instanceof SVGElement) {
      if (el.tagName.toLowerCase() === "svg") {
        const vb = el.viewBox.baseVal;
        const sx = b[2] / (vb.width || b[2]), sy = b[3] / (vb.height || b[3]);
        for (const node of el.querySelectorAll("rect,circle,ellipse,line,polyline,polygon,path,text,image,use")) {
          if (node.closest("defs")) continue;
          const nc = getComputedStyle(node);
          const tag = node.tagName.toLowerCase();
          const n = node.getBoundingClientRect();
          const nb = bounds(n);
          const sid = id + "-svg-" + objects.length;
          if (tag === "line") objects.push({ id: sid, type: "line", endArrow: el.dataset.endArrow, bounds: [b[0], b[1], b[2], b[3]], points: [Number(node.getAttribute("x1")) * sx, Number(node.getAttribute("y1")) * sy, Number(node.getAttribute("x2")) * sx, Number(node.getAttribute("y2")) * sy], style: { stroke: rgba(nc.stroke) || "#111111", strokeWidth: parseFloat(nc.strokeWidth) * sx } });
          else if (["rect", "circle", "ellipse"].includes(tag)) objects.push({ id: sid, type: "shape", shape: tag === "rect" ? "rect" : "ellipse", bounds: nb, style: { fill: rgba(nc.fill), stroke: rgba(nc.stroke), strokeWidth: parseFloat(nc.strokeWidth), gradient: svgGradient(nc.fill) } });
          else if (tag === "text") objects.push({ id: sid, type: "text", bounds: nb, text: node.textContent, style: { color: rgba(nc.fill), fontSize: parseFloat(nc.fontSize), fontFamily: resolveActualFont(nc.fontFamily, node.textContent) } });
          else if (["path", "polygon", "polyline"].includes(tag)) {
            const matrix = node.getScreenCTM(), points = [];
            if (tag === "path") {
              const length = node.getTotalLength(), steps = Math.min(4096, Math.max(8, Math.ceil(length / 2)));
              for (let i = 0; i <= steps; i++) {
                const q = node.getPointAtLength(length * i / steps), qScreen = new DOMPoint(q.x, q.y).matrixTransform(matrix);
                const point = [(qScreen.x - box.x) / scale, (qScreen.y - box.y) / scale];
                const previous = points.at(-1);
                points.push({ ...{ x: point[0] - nb[0], y: point[1] - nb[1] }, move: !!previous && Math.hypot(point[0] - nb[0] - previous.x, point[1] - nb[1] - previous.y) > length / steps * 3 });
              }
            } else for (const q of node.points) {
              const screen = new DOMPoint(q.x, q.y).matrixTransform(matrix);
              points.push({ x: (screen.x - box.x) / scale - nb[0], y: (screen.y - box.y) / scale - nb[1] });
            }
            objects.push({ id: sid, type: "vector", bounds: [nb[0], nb[1], Math.max(1, nb[2]), Math.max(1, nb[3])], points, closed: tag === "polygon" || /z\s*$/i.test(node.getAttribute("d") || ""), style: { fill: rgba(nc.fill), stroke: rgba(nc.stroke), strokeWidth: parseFloat(nc.strokeWidth), fillTransparency: (1 - alpha(nc.fill)) * 100, gradient: svgGradient(nc.fill) }, samplingTolerance: 2 });
          } else if (tag === "image") {
            const src = node.href.baseVal;
            if (!src) issues.push({ id: sid, kind: "missing-image" });
            else objects.push({ id: sid, type: "image", bounds: nb, src, fit: "contain", naturalWidth: nb[2], naturalHeight: nb[3] });
          } else issues.push({ id: sid, kind: "unsupported-svg", tag });
        }
      }
      continue;
    }
    const fill = rgba(css.backgroundColor);
    const border = Number.parseFloat(css.borderTopWidth);
    const uniformBorder = ["Top", "Right", "Bottom", "Left"].every((k) => css["border" + k + "Width"] === css.borderTopWidth && css["border" + k + "Color"] === css.borderTopColor);
    if (!uniformBorder) {
      for (const k of ["Top", "Right", "Bottom", "Left"]) {
        const width = parseFloat(css["border" + k + "Width"]);
        if (!width) continue;
        const points = k === "Top" ? [0, 0, b[2], 0] : k === "Bottom" ? [0, b[3], b[2], b[3]] : k === "Left" ? [0, 0, 0, b[3]] : [b[2], 0, b[2], b[3]];
        objects.push({ id: id + "-border-" + k, type: "line", bounds: b, points, style: { stroke: rgba(css["border" + k + "Color"]), strokeWidth: width, strokeTransparency: (1 - alpha(css["border" + k + "Color"])) * 100 } });
      }
    }
    if (fill || border && uniformBorder) {
      const st = { fill, fillTransparency: (1 - alpha(css.backgroundColor) * Number(css.opacity)) * 100, stroke: border && uniformBorder ? rgba(css.borderTopColor) : null, strokeTransparency: (1 - alpha(css.borderTopColor) * Number(css.opacity)) * 100, strokeWidth: border, radius: parseFloat(css.borderRadius) || 0 };
      let sb = b;
      if (css.transform !== "none") {
        const matrix = new DOMMatrix(css.transform);
        const rotation = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
        const ow = el.offsetWidth, oh = el.offsetHeight;
        sb = [b[0] + b[2] / 2 - ow / 2, b[1] + b[3] / 2 - oh / 2, ow, oh];
        st.rotate = rotation;
      }
      objects.push({ id: id + "-shape", type: "shape", shape: el.dataset.shape, bounds: sb, style: st });
    }
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const nr = range.getBoundingClientRect();
      if (!nr.width || !nr.height) continue;
      const single = el.childNodes.length === 1 && css.display !== "inline";
      const bb = single ? b : bounds(nr);
      if (!single) bb[2] += 6;
      bb[3] = Math.max(bb[3], parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.25);
      objects.push({ id: id + "-text-" + objects.length, type: "text", text: node.textContent, bounds: bb, style: { color: rgba(css.color), textTransparency: (1 - alpha(css.color)) * 100, textStroke: parseFloat(css.webkitTextStrokeWidth) > 0 ? { color: rgba(css.webkitTextStrokeColor), width: parseFloat(css.webkitTextStrokeWidth) } : void 0, letterSpacing: parseFloat(css.letterSpacing) || 0, fontSize: parseFloat(css.fontSize), fontFamily: resolveActualFont(css.fontFamily, node.textContent), fontWeight: css.fontWeight, fontStyle: css.fontStyle, textAlign: css.textAlign, wrap: range.getClientRects().length > 1, lineHeight: parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.25 } });
    }
  }
  return { slideId, objects, issues };
}
async function collectExportObjects(page, project) {
  const coverage = checkCoverage(project);
  if (coverage.length) throw new Error("Export coverage failed: " + JSON.stringify(coverage));
  await page.evaluate(() => document.fonts.ready);
  const results = [];
  const state = project.editorState;
  const hidden = /* @__PURE__ */ new Set([...state.deletedSlides || [], ...state.skippedSlides || []]);
  for (const id of state.slideOrder || project.slides.map((s) => s.slideId)) {
    if (hidden.has(id)) continue;
    await page.evaluate((id2) => {
      const slides = window.__getVisibleSlides?.() || [];
      const i = slides.findIndex((s) => s.dataset.vmSlideId === id2);
      window.go(i, { force: true, animate: false });
      window.__ensureRuntimeSlideRendered?.(slides[i]);
    }, id);
    await page.waitForFunction((id2) => {
      const s = [...document.querySelectorAll(".slide")].find((s2) => s2.dataset.vmSlideId === id2);
      return s && [...s.querySelectorAll("img")].every((i) => i.complete);
    }, id);
    const result = await page.evaluate(collectSlideInDom, id);
    for (const o of result.objects) if (o.type === "image" && !o.src.startsWith("data:")) o.src = await page.evaluate(async (src) => {
      const blob = await (await fetch(src)).blob();
      return await new Promise((resolve) => {
        const f = new FileReader();
        f.onload = () => resolve(f.result);
        f.readAsDataURL(blob);
      });
    }, o.src);
    results.push(result);
  }
  return { revision: project.revision, width: 1920, height: 1080, slides: results };
}
export {
  collectExportObjects,
  collectSlideInDom
};
