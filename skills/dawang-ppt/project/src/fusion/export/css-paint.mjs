function split(value) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out;
}
function color(value) {
  if (value === "transparent") return [0, 0, 0, 0];
  if (value.startsWith("#")) {
    const h = value.slice(1);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  if (value.startsWith("color(srgb")) {
    const v = value.slice(11, -1).split("/");
    return v[0].trim().split(/\s+/).map((x) => Number(x) * 255).concat(v[1] === void 0 ? 1 : Number(v[1]));
  }
  const nums = value.slice(value.indexOf("(") + 1, -1).split(/[,\s/]+/).filter(Boolean).map(Number);
  return nums.slice(0, 3).concat(nums[3] ?? 1);
}
const length = (v, size) => v?.endsWith("%") ? parseFloat(v) * size / 100 : parseFloat(v);
function parse(image, w, h) {
  const repeating = image.startsWith("repeating-");
  image = image.replace(/^repeating-/, "");
  const kind = image.startsWith("radial-gradient(") ? "radial" : image.startsWith("linear-gradient(") ? "linear" : null;
  if (!kind) throw new Error("Unsupported gradient");
  let parts = split(image.slice(image.indexOf("(") + 1, -1));
  let spec = "";
  if (!/^(rgba?\(|color\(|#|transparent)/.test(parts[0])) spec = parts.shift();
  let geometry;
  if (kind === "linear") {
    let degrees = 180;
    if (spec.includes("deg")) degrees = parseFloat(spec);
    else if (spec.startsWith("to ")) {
      const right = spec.includes("right"), left = spec.includes("left"), top = spec.includes("top"), bottom = spec.includes("bottom");
      degrees = Math.atan2(right ? 1 : left ? -1 : 0, top ? 1 : bottom ? -1 : 0) * 180 / Math.PI;
    }
    const a = degrees * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
    geometry = { dx, dy, total: Math.abs(w * dx) + Math.abs(h * dy) };
  } else {
    const [shape, at] = spec.split(/\s+at\s+/), pos = (at || "50% 50%").split(/\s+/);
    const coord = (p, size) => p === "left" || p === "top" ? 0 : p === "right" || p === "bottom" ? size : p === "center" ? size / 2 : length(p, size);
    const cx = coord(pos[0], w), cy = coord(pos[1] || "50%", h);
    let rx, ry;
    const sizes = shape.match(/[\d.]+(?:%|px)/g);
    if (sizes?.length) {
      rx = length(sizes[0], w);
      ry = length(sizes[1] || sizes[0], h);
      if (shape.includes("circle")) ry = rx;
    } else {
      const near = shape.includes("closest"), side = shape.includes("side");
      const x = (near ? Math.min : Math.max)(cx, w - cx), y = (near ? Math.min : Math.max)(cy, h - cy);
      if (shape.includes("circle")) rx = ry = side ? (near ? Math.min : Math.max)(x, y) : Math.hypot(x, y);
      else {
        rx = x * (side ? 1 : Math.SQRT2);
        ry = y * (side ? 1 : Math.SQRT2);
      }
    }
    geometry = { cx, cy, rx, ry, total: rx };
  }
  const stops = [];
  for (const p of parts) {
    const m = /^(rgba?\([^)]*\)|color\([^)]*\)|#[\da-f]+|transparent)(.*)$/i.exec(p);
    if (!m) throw new Error("Unsupported color stop");
    const offsets = m[2].trim().split(/\s+/).filter(Boolean);
    if (!offsets.length) stops.push({ color: color(m[1]), offset: null });
    else offsets.forEach((v) => stops.push({ color: color(m[1]), offset: length(v, geometry.total) / geometry.total }));
  }
  if (stops[0].offset === null) stops[0].offset = 0;
  if (stops.at(-1).offset === null) stops.at(-1).offset = 1;
  for (let i = 1; i < stops.length; i++) if (stops[i].offset !== null) stops[i].offset = Math.max(stops[i].offset, ...stops.slice(0, i).map((s) => s.offset ?? -Infinity));
  for (let i = 0; i < stops.length; i++) if (stops[i].offset === null) {
    const start = i - 1;
    let end = i;
    while (stops[end].offset === null) end++;
    for (let j = i; j < end; j++) stops[j].offset = stops[start].offset + (stops[end].offset - stops[start].offset) * (j - start) / (end - start);
    i = end;
  }
  return { kind, repeating, ...geometry, stops };
}
function sample(g, t) {
  const s = g.stops;
  if (t < s[0].offset) return s[0].color;
  for (let i = 1; i < s.length; i++) if (t < s[i].offset) {
    const a = s[i - 1], b = s[i], r = (t - a.offset) / (b.offset - a.offset);
    const alpha = a.color[3] + (b.color[3] - a.color[3]) * r;
    return a.color.slice(0, 3).map((v, j) => alpha ? (v * a.color[3] * (1 - r) + b.color[j] * b.color[3] * r) / alpha : 0).concat(alpha);
  }
  return s.at(-1).color;
}
function cssTextGradient(image, bounds, origin = bounds) {
  const g = parse(image, origin[2], origin[3]);
  if (g.kind !== "linear") throw new Error("Unsupported text gradient: " + image);
  const min = (origin[2] * g.dx + origin[3] * g.dy - g.total) / 2;
  const project = (px, py) => ((px - origin[0]) * g.dx + (py - origin[1]) * g.dy - min) / g.total;
  const ts = [[bounds[0], bounds[1]], [bounds[0] + bounds[2], bounds[1]], [bounds[0], bounds[1] + bounds[3]], [bounds[0] + bounds[2], bounds[1] + bounds[3]]].map(([px, py]) => project(px, py));
  const a = Math.min(...ts), b = Math.max(...ts);
  const stops = [{ offset: a, color: sample(g, a) }, ...g.stops.filter((s) => s.offset > a && s.offset < b), { offset: b, color: sample(g, b) }];
  return { kind: "linear", angle: (Math.atan2(g.dy, g.dx) * 180 / Math.PI + 360) % 360, stops: stops.map((s) => ({ offset: (s.offset - a) / (b - a), color: "#" + s.color.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""), opacity: s.color[3] })) };
}
function cssDecoration(paint) {
  const [, , w, h] = paint.bounds, defs = [], layers = [];
  const gradient = (g, id) => {
    const first = g.repeating ? g.stops[0].offset : 0, last = g.repeating ? g.stops.at(-1).offset : 1, span = last - first;
    if (span <= 0) throw new Error("Unsupported repeating gradient period");
    const repeat = g.repeating ? ' spreadMethod="repeat"' : "";
    const stops = g.stops.map((s) => `<stop offset="${(s.offset - first) / span}" stop-color="rgb(${s.color.slice(0, 3).join(",")})" stop-opacity="${s.color[3]}"/>`).join("");
    if (g.kind === "radial") return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${g.repeating ? span : 1}"${repeat} gradientTransform="translate(${g.cx} ${g.cy}) scale(${g.rx} ${g.ry})">${stops}</radialGradient>`;
    const cx = g.w / 2, cy = g.h / 2;
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${cx - g.dx * g.total / 2 + g.dx * g.total * first}" y1="${cy - g.dy * g.total / 2 + g.dy * g.total * first}" x2="${cx - g.dx * g.total / 2 + g.dx * g.total * last}" y2="${cy - g.dy * g.total / 2 + g.dy * g.total * last}"${repeat}>${stops}</linearGradient>`;
  };
  const images = split(paint.image), sizes = split(paint.size || "auto"), positions = split(paint.position || "0% 0%");
  for (let i = images.length - 1; i >= 0; i--) {
    if (images[i] === "none") continue;
    const dims = sizes[i % sizes.length].split(/\s+/);
    let tw = dims[0] === "auto" ? w : length(dims[0], w), th = !dims[1] || dims[1] === "auto" ? h : length(dims[1], h);
    if (images[i].startsWith("url(")) {
      let uri = images[i].slice(4, -1);
      if (['"', "'"].includes(uri[0])) uri = uri.slice(1, -1);
      if (!uri.startsWith("data:image/svg+xml,")) throw new Error("Unsupported external CSS image");
      const source = decodeURIComponent(uri.split(",").slice(1).join(","));
      if (/<script|<foreignObject|<!ENTITY|(?:href|src)\s*=|url\((?!#)/i.test(source)) throw new Error("Unsupported active SVG texture");
      const naturalW = parseFloat(/\bwidth=['"]([\d.]+)/.exec(source)?.[1]), naturalH = parseFloat(/\bheight=['"]([\d.]+)/.exec(source)?.[1]);
      if (!naturalW || !naturalH) throw new Error("Unsupported SVG texture dimensions");
      if (dims[0] === "auto") tw = naturalW;
      if (!dims[1] || dims[1] === "auto") th = naturalH;
      const href = uri.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
      defs.push(`<pattern id="texture${i}" width="${tw}" height="${th}" patternUnits="userSpaceOnUse"><image width="${tw}" height="${th}" href="${href}"/></pattern>`);
      layers.push(`<rect width="${w}" height="${h}" fill="url(#texture${i})"/>`);
      continue;
    }
    const g = { ...parse(images[i], tw, th), w: tw, h: th }, id = "g" + i;
    defs.push(gradient(g, id));
    if (positions[i % positions.length] !== "0% 0%") throw new Error("Unsupported CSS background position");
    if (tw !== w || th !== h) {
      defs.push(`<pattern id="p${i}" width="${tw}" height="${th}" patternUnits="userSpaceOnUse"><rect width="${tw}" height="${th}" fill="url(#${id})"/></pattern>`);
      layers.push(`<rect width="${w}" height="${h}" fill="url(#p${i})"/>`);
    } else layers.push(`<rect width="${w}" height="${h}" fill="url(#${id})"/>`);
  }
  let mask = "";
  if (paint.mask && paint.mask !== "none") {
    defs.push(gradient({ ...parse(paint.mask, w, h), w, h }, "mask-gradient"));
    defs.push(`<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:alpha"><rect width="${w}" height="${h}" fill="url(#mask-gradient)"/></mask>`);
    mask = ' mask="url(#fade)"';
  }
  const pad = Math.ceil((paint.blur || 0) * 3), clip = paint.radius ? ` clip-path="url(#outline)"` : "";
  if (paint.radius) defs.push(`<clipPath id="outline"><rect width="${w}" height="${h}" rx="${Math.min(paint.radius, w / 2, h / 2)}"/></clipPath>`);
  if (paint.blur) defs.push(`<filter id="blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${paint.blur}"/></filter>`);
  const content = layers.join("").replace(/<rect width=/g, `<rect rx="${Math.min(paint.radius || 0, w / 2, h / 2)}" width=`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}" viewBox="0 0 ${w + pad * 2} ${h + pad * 2}"><defs>${defs.join("")}</defs><g transform="translate(${pad} ${pad})"><g opacity="${paint.opacity ?? 1}"${mask}${paint.blur ? ' filter="url(#blur)"' : ""}>${content}</g></g></svg>`;
  return { id: paint.id, type: "decoration", classification: "background-decoration", bounds: [paint.bounds[0] - pad, paint.bounds[1] - pad, w + pad * 2, h + pad * 2], rotate: paint.rotate || 0, svg: svg.replace(/\bid="([^"]+)"/g, (m, id) => `id="d-${paint.id.replace(/[^a-z0-9]/ig, "_")}-${id}"`).replace(/url\(#([^)]+)\)/g, (m, id) => `url(#d-${paint.id.replace(/[^a-z0-9]/ig, "_")}-${id})`) };
}
export {
  cssDecoration,
  cssTextGradient
};
