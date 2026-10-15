import JSZip from "jszip";
const xmlEscape = (v) => String(v).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
async function writeEditablePackage(pptx, collection, { type = "uint8array" } = {}) {
  const bytes = await pptx.write({ outputType: "arraybuffer" });
  const Zip = JSZip.default || JSZip;
  const zip = await Zip.loadAsync(bytes);
  for (let i = 0; i < collection.slides.length; i++) {
    const file = `ppt/slides/slide${i + 1}.xml`;
    let xml = await zip.file(file).async("string");
    const images = new Map(collection.slides[i].objects.filter((o) => o.type === "image").map((o) => [xmlEscape(o.id), o]));
    xml = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => {
      const name = /<p:cNvPr[^>]*name="([^"]+)"/.exec(pic)?.[1];
      const o = images.get(name);
      if (!o) return pic;
      if (o.fit === "cover") {
        const [, , w, h] = o.bounds;
        const nw = o.naturalWidth, nh = o.naturalHeight;
        const scale = Math.max(w / nw, h / nh), dw = nw * scale, dh = nh * scale;
        const raw = (o.focal || "50% 50%").trim().split(/\s+/);
        const pct = (v) => v === "left" || v === "top" ? 0 : v === "right" || v === "bottom" ? 1 : v === "center" ? 0.5 : Math.max(0, Math.min(1, parseFloat(v) / 100 || 0));
        const fx = pct(raw[0]), fy = pct(raw[1] || raw[0]);
        const l = Math.round((dw - w) * fx / dw * 1e5), r = Math.round((dw - w) * (1 - fx) / dw * 1e5), t = Math.round((dh - h) * fy / dh * 1e5), b = Math.round((dh - h) * (1 - fy) / dh * 1e5);
        pic = pic.replace(/<a:srcRect[^>]*\/>/g, "").replace(/<a:stretch>/, `<a:srcRect l="${l}" r="${r}" t="${t}" b="${b}"/><a:stretch>`);
      }
      const radius = o.style?.radius || 0;
      if (o.clipShape === "ellipse") pic = pic.replace(/<a:prstGeom[\s\S]*?<\/a:prstGeom>/, '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>');
      else if (radius > 0) {
        const adj = Math.round(Math.min(0.5, radius / Math.min(o.bounds[2], o.bounds[3])) * 1e5);
        pic = pic.replace(/<a:prstGeom[\s\S]*?<\/a:prstGeom>/, `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`);
      }
      return pic;
    });
    const vectors = new Map(collection.slides[i].objects.filter((o) => o.type === "vector").map((o) => [xmlEscape(o.id), o]));
    const gradients = new Map(collection.slides[i].objects.filter((o) => o.style?.gradient).map((o) => [xmlEscape(o.id), o]));
    const texts = new Map(collection.slides[i].objects.filter((o) => o.type === "text" && o.style.textStroke).map((o) => [xmlEscape(o.id), o]));
    xml = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (sp) => {
      const name = /<p:cNvPr[^>]*name="([^"]+)"/.exec(sp)?.[1], o = vectors.get(name), t = texts.get(name), g = gradients.get(name);
      if (g) {
        const color = (v) => {
          const m = /rgb[a]?\(([^)]+)\)/.exec(v);
          return m ? m[1].split(",").slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("") : v.replace("#", "");
        };
        const stops = g.style.gradient.stops.map((stop) => `<a:gs pos="${Math.round(Math.max(0, Math.min(1, stop.offset)) * 1e5)}"><a:srgbClr val="${color(stop.color)}"><a:alpha val="${Math.round((stop.opacity ?? 1) * 1e5)}"/></a:srgbClr></a:gs>`).join("");
        const fill = `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst>${g.style.gradient.kind === "radial" ? '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>' : `<a:lin ang="${Math.round((g.style.gradient.angle || 0) * 6e4)}" scaled="1"/>`}</a:gradFill>`;
        sp = sp.replace(/(<p:spPr[^>]*>)([\s\S]*?)(<\/p:spPr>)/, (whole, start, body, end) => start + body.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, fill) + end);
      }
      if (o) {
        const coords = o.points.map((p, index) => `${index === 0 || p.move ? "<a:moveTo>" : "<a:lnTo>"}<a:pt x="${Math.round(p.x * 6350)}" y="${Math.round(p.y * 6350)}"/>${index === 0 || p.move ? "</a:moveTo>" : "</a:lnTo>"}`).join("");
        const geom = `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${Math.round(o.bounds[2] * 6350)}" h="${Math.round(o.bounds[3] * 6350)}" fill="${o.style.fill ? "norm" : "none"}">${coords}${o.closed ? "<a:close/>" : ""}</a:path></a:pathLst></a:custGeom>`;
        sp = sp.replace(/<a:prstGeom[\s\S]*?<\/a:prstGeom>/, geom);
      }
      if (t) {
        const stroke = t.style.textStroke;
        sp = sp.replace(/(<a:rPr[^>]*>)/g, `$1<a:ln w="${Math.round(stroke.width * 6350)}"><a:solidFill><a:srgbClr val="${stroke.color.replace("#", "")}"/></a:solidFill></a:ln>`);
      }
      return sp;
    });
    zip.file(file, xml);
  }
  return zip.generateAsync({ type, compression: "DEFLATE" });
}
export {
  writeEditablePackage
};
