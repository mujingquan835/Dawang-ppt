import { cssDecoration, cssTextGradient } from "./css-paint.mjs";
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
  const paint = (el, css, b, id) => {
    if (css.backgroundClip === "text" || css.webkitBackgroundClip === "text") return;
    if (css.backgroundImage && css.backgroundImage !== "none") {
      let rotate = 0, paintBounds = b;
      if (css.transform !== "none") {
        const m = new DOMMatrix(css.transform);
        rotate = Math.atan2(m.b, m.a) * 180 / Math.PI;
        const w = el.offsetWidth, h = el.offsetHeight;
        paintBounds = [b[0] + b[2] / 2 - w / 2, b[1] + b[3] / 2 - h / 2, w, h];
      }
      objects.push({ id: id + "-css", type: "css-paint", bounds: paintBounds, image: css.backgroundImage, size: css.backgroundSize, position: css.backgroundPosition, mask: css.maskImage, opacity: Number(css.opacity), radius: parseFloat(css.borderRadius) || 0, blur: parseFloat(/blur\(([^)]+)/.exec(css.filter)?.[1]) || 0, rotate });
    }
  };
  const pseudoPaint = (el, id) => {
    for (const pseudo of ["::before", "::after"]) {
      const computed=getComputedStyle(el,pseudo),entries=[...computed].map(key=>[key,computed.getPropertyValue(key)]);
      const css=Object.fromEntries(entries.flatMap(([key,value])=>[[key,value],[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]]));
      css.borderRadius=computed.borderRadius;
      if (["none", "normal"].includes(css.content) || css.display === "none") continue;
      const ghost = document.createElement("div"), hide = document.createElement("style"), token = "pseudo-" + objects.length;
      for (const [key,value] of entries) ghost.style.setProperty(key,value);
      const old = el.getAttribute("data-dawang-export-pseudo");
      el.setAttribute("data-dawang-export-pseudo", token);
      hide.textContent = `[data-dawang-export-pseudo="${token}"]${pseudo}{content:none!important;display:none!important}`;
      document.head.appendChild(hide);
      ghost.style.visibility = "hidden";
      ghost.style.content = "none";
      ghost.style.pointerEvents = "none";
      const text = css.content.startsWith('"') ? css.content.slice(1, -1).replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))) : "";
      ghost.textContent = text;
      if (pseudo === "::before") el.prepend(ghost);
      else el.append(ghost);
      try {
        const b = bounds(ghost.getBoundingClientRect()), fill = rgba(css.backgroundColor), border = parseFloat(css.borderTopWidth), radius = css.borderRadius?.endsWith("%")?parseFloat(css.borderRadius)*Math.min(b[2],b[3])/100:parseFloat(css.borderRadius)||0;
        if (fill || border) objects.push({ id: id + pseudo + "-fill", type: "shape", shape: radius >= Math.min(b[2], b[3]) / 2 ? "ellipse" : void 0, bounds: b, style: { fill, radius, fillTransparency: (1 - alpha(css.backgroundColor) * Number(css.opacity)) * 100, stroke: border ? rgba(css.borderTopColor) : null, strokeWidth: border, strokeTransparency: (1 - alpha(css.borderTopColor) * Number(css.opacity)) * 100 } });
        paint(ghost, css, b, id + pseudo);
        if (text) {
          const range = document.createRange();
          range.selectNodeContents(ghost);
          const nr = range.getBoundingClientRect(), bb = bounds(nr);
          bb[2] += 6;
          bb[3] = Math.max(bb[3], parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.25);
          objects.push({ id: id + pseudo + "-text", type: "text", text, bounds: bb, style: { color: rgba(css.color), fontSize: parseFloat(css.fontSize), fontFamily: resolveActualFont(css.fontFamily, text), fontWeight: css.fontWeight, fontStyle: css.fontStyle, textTransparency: (1 - alpha(css.color) * Number(css.opacity)) * 100, wrap: false } });
        }
      } finally {
        ghost.remove();
        hide.remove();
        if (old === null) el.removeAttribute("data-dawang-export-pseudo");
        else el.setAttribute("data-dawang-export-pseudo", old);
      }
    }
  };
  if (root !== slide) {
    paint(slide, getComputedStyle(slide), [0, 0, 1920, 1080], slideId + "-slide");
  }
  paint(root, base, [0, 0, 1920, 1080], slideId + "-root");
  pseudoPaint(root, slideId + "-root");
  const elements = [...root.querySelectorAll("*")];
  let count = 0;
  for (const el of elements) {
    if (el.closest(".fusion-selection") || ["STYLE", "SCRIPT"].includes(el.tagName)) continue;
    const css = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || css.display === "none" || css.visibility === "hidden") continue;
    if (el instanceof HTMLCanvasElement) {
      issues.push({ kind: "canvas-needs-classification", message: "Canvas must be classified as decoration or information before export" });
      continue;
    }
    if (el.dataset.elementType === "text" && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)) issues.push({ kind: "text-overflow", id: el.dataset.fusionElement, text: el.textContent });
    let elementOpacity = 1;
    for (let parent = el; parent && slide.contains(parent); parent = parent.parentElement) elementOpacity *= Number(getComputedStyle(parent).opacity);
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
          if (tag === "line") objects.push({ id: sid, type: "line", endArrow: el.dataset.endArrow, bounds: [b[0], b[1], b[2], b[3]], points: [Number(node.getAttribute("x1")) * sx, Number(node.getAttribute("y1")) * sy, Number(node.getAttribute("x2")) * sx, Number(node.getAttribute("y2")) * sy], style: { stroke: rgba(nc.stroke) || "#111111", strokeWidth: parseFloat(nc.strokeWidth) * sx, strokeTransparency: (1 - alpha(nc.stroke) * Number(nc.strokeOpacity) * Number(nc.opacity) * elementOpacity) * 100 } });
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
    paint(el, css, b, id);
    pseudoPaint(el, id);
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const nr = range.getBoundingClientRect();
      if (!nr.width || !nr.height) continue;
      const single = el.childNodes.length === 1 && css.display !== "inline";
      const bb = single ? b : bounds(nr);
      if (single) bb[2] = Math.max(bb[2], bounds(nr)[2]);
      else bb[2] += 6;
      bb[3] = Math.max(bb[3], parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.25);
      let textPaint;
      for (let ancestor = el; ancestor && slide.contains(ancestor); ancestor = ancestor.parentElement) {
        const ac = getComputedStyle(ancestor);
        if ((ac.backgroundClip === "text" || ac.webkitBackgroundClip === "text") && ac.backgroundImage !== "none") {
          textPaint = { image: ac.backgroundImage, bounds: bounds(ancestor.getBoundingClientRect()) };
          break;
        }
      }
      el.dataset.dawangExportFont ||= slideId + "-font-" + count + "-" + objects.length;
      objects.push({ fontNode: el.dataset.dawangExportFont, id: id + "-text-" + objects.length, type: "text", text: node.textContent, bounds: bb, style: { color: rgba(css.color), textBackground: textPaint?.image, textBackgroundBounds: textPaint?.bounds, textTransparency: (1 - alpha(css.color) * elementOpacity) * 100, textStroke: parseFloat(css.webkitTextStrokeWidth) > 0 ? { color: rgba(css.webkitTextStrokeColor), width: parseFloat(css.webkitTextStrokeWidth), opacity: alpha(css.webkitTextStrokeColor) * elementOpacity } : void 0, letterSpacing: parseFloat(css.letterSpacing) || 0, fontSize: parseFloat(css.fontSize), fontFamily: resolveActualFont(css.fontFamily, node.textContent), fontWeight: css.fontWeight, fontStyle: css.fontStyle, textAlign: css.textAlign, wrap: range.getClientRects().length > 1, lineHeight: parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.25 } });
    }
  }
  return { slideId, objects, issues };
}
async function prepareSlideForExport(page, id) {
  await page.evaluate(async (id2) => {
    const slides = window.__getVisibleSlides?.() || [];
    const slide = slides.find((s) => s.dataset.vmSlideId === id2);
    if (!slide) throw new Error("Missing export slide: " + id2);
    window.go(slides.indexOf(slide), { force: true, animate: false });
    await window.__ensureRuntimeSlideRendered?.(slide);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await document.fonts.ready;
    for (const animation of slide.getAnimations({ subtree: true })) {
      const end = animation.effect?.getComputedTiming().endTime;
      try {
        if (Number.isFinite(end) && end > 0) animation.finish();
        else animation.pause();
      } catch {
      }
    }
    for (const tween of window.gsap?.globalTimeline?.getChildren?.(true, true, true) || []) {
      if (!tween.targets?.().some((t) => t instanceof Node && slide.contains(t))) continue;
      if (Number.isFinite(tween.totalDuration?.())) tween.progress?.(1);
      tween.pause?.();
    }
    await new Promise((r) => requestAnimationFrame(r));
    await document.fonts.ready;
  }, id);
  await page.waitForFunction((id2) => {
    const slide = [...document.querySelectorAll("#deck > .slide")].find((s) => s.dataset.vmSlideId === id2);
    return slide && [...slide.querySelectorAll("img")].every((i) => i.complete);
  }, id);
}
async function collectExportObjects(page, project) {
  const coverage = checkCoverage(project);
  if (coverage.length) throw new Error("Export coverage failed: " + JSON.stringify(coverage));
  await page.evaluate(() => document.fonts.ready);
  const results = [];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const state = project.editorState;
  const hidden = /* @__PURE__ */ new Set([...state.deletedSlides || [], ...state.skippedSlides || []]);
  for (const id of state.slideOrder || project.slides.map((s) => s.slideId)) {
    if (hidden.has(id)) continue;
    let collected;
    for (let attempt = 0; attempt < 3; attempt++) {
    await prepareSlideForExport(page, id);
    try {
    const result = await page.evaluate(collectSlideInDom, id);
    const expanded = [];
    const doc = await cdp.send("DOM.getDocument");
    for (const o of result.objects) {
      if (o.type === "css-paint") {
        try {
          const decoration = cssDecoration(o);
          decoration.preview = await page.evaluate(async ({ svg, w, h }) => {
            const img = new Image();
            img.src = "data:image/svg+xml;base64," + btoa(Array.from(new TextEncoder().encode(svg), (n) => String.fromCharCode(n)).join(""));
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(w);
            canvas.height = Math.ceil(h);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/png");
          }, { svg: decoration.svg, w: decoration.bounds[2], h: decoration.bounds[3] });
          expanded.push(decoration);
        } catch (error) {
          result.issues.push({ id: o.id, kind: "unsupported-css-background", message: error.message });
        }
        continue;
      }
      if (o.style?.textBackground && o.style.textBackground !== "none") {
        try {
          o.style.textGradient = cssTextGradient(o.style.textBackground, o.bounds, o.style.textBackgroundBounds);
        } catch (error) {
          result.issues.push({ id: o.id, kind: "unsupported-text-gradient", message: error.message });
        }
        delete o.style.textBackground;
        delete o.style.textBackgroundBounds;
      }
      if (o.fontNode) {
        const selector = '[data-dawang-export-font="' + o.fontNode + '"]';
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
        if (!nodeId) throw new Error("FontSnapshotChanged: marked text node was replaced");
        let fonts;
        try { ({fonts} = await cdp.send("CSS.getPlatformFontsForNode", {nodeId})); }
        catch (error) {
          if (/Could not find node|No node with given id/.test(error.message)) throw new Error("FontSnapshotChanged: " + error.message);
          throw error;
        }
        const cjk = /[\u3400-\u9fff]/.test(o.text);
        const preferred = cjk ? fonts.filter((f) => /SC|CJK|OPPO|Sans Han|Song|Hei|Kai|Yahei|苹方|宋体|黑体/i.test(f.familyName)) : fonts;
        const actual = [...preferred.length ? preferred : fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0];
        if (actual) {
          o.style.declaredFontFamily = o.style.fontFamily;
          o.style.fontFamily = actual.familyName;
          o.style.fontPostScript = actual.postScriptName;
        }
        delete o.fontNode;
      }
      expanded.push(o);
    }
    result.objects = expanded;
    for (const o of result.objects) if (o.type === "image" && !o.src.startsWith("data:")) o.src = await page.evaluate(async (src) => {
      const blob = await (await fetch(src)).blob();
      return await new Promise((resolve) => {
        const f = new FileReader();
        f.onload = () => resolve(f.result);
        f.readAsDataURL(blob);
      });
    }, o.src);
    collected = result;
    break;
    } catch (error) {
      // Recollect geometry and font evidence together; never keep an old snapshot with guessed fonts.
      if (!error.message.startsWith("FontSnapshotChanged:") || attempt === 2) throw error;
    }
    }
    results.push(collected);
  }
  await cdp.detach();
  return { revision: project.revision, width: 1920, height: 1080, slides: results };
}
export {
  collectExportObjects,
  collectSlideInDom,
  prepareSlideForExport
};
