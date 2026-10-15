import { text } from "../objects/primitives.mjs";
function layoutImages(o, style) {
  const images = o.data.images || [];
  if (new Set(images.map((i) => i.mediaId)).size !== images.length || images.some((i) => !i.mediaId)) throw new Error("Stable unique image IDs required");
  if (!images.length) throw new Error("Image material missing");
  const [x, y, w, h] = o.bounds;
  const gap = style.grid.gap || 32;
  const mode = o.data.arrangement || "text-photo";
  const boxes = [];
  if (["text-photo", "full-bleed", "single"].includes(mode)) {
    if (images.length !== 1) throw new Error("Single image structure requires exactly one image");
    boxes.push([x, y, w, h]);
  } else if (mode === "primary-secondary") {
    if (images.length < 2) throw new Error("Primary-secondary layout requires at least two images");
    boxes.push([x, y, w * 0.6, h]);
    const sw = w * 0.4 - gap, sh = (h - gap * (images.length - 2)) / (images.length - 1);
    for (let i = 1; i < images.length; i++) boxes.push([x + w * 0.6 + gap, y + (i - 1) * (sh + gap), sw, sh]);
  } else if (mode === "grid") {
    const cols = o.data.columns || Math.ceil(Math.sqrt(images.length));
    const rows = Math.ceil(images.length / cols);
    const cw = (w - (cols - 1) * gap) / cols, ch = (h - (rows - 1) * gap) / rows;
    images.forEach((_, i) => boxes.push([x + i % cols * (cw + gap), y + Math.floor(i / cols) * (ch + gap), cw, ch]));
  } else throw new Error("Unsupported image arrangement " + mode);
  return images.flatMap((image, i) => {
    const b = [...boxes[i]], caption = image.caption && o.data.showCaptions !== false;
    if (caption) b[3] -= 52;
    return [{ id: `${o.objectId}/image/${image.mediaId}`, parentId: o.objectId, type: "image", bounds: b, src: image.src, mediaRef: image.mediaRef || image.mediaId, fit: image.kind === "screenshot" ? "contain" : image.fit || style.media.photoFit, clipShape: image.clipShape, focal: image.focal || "50% 50%", style: { radius: image.kind === "screenshot" ? 0 : style.media.radius || 0 }, sourceRef: image.sourceRef, alt: image.caption || "" }, ...caption ? [text(o, "image/" + image.mediaId + "/caption", image.caption, [b[0], b[1] + b[3] + 10, b[2], 42], style, { dataPath: ["images", i, "caption"], style: { fontSize: 26, color: style.palette.muted } })] : []];
  });
}
export {
  layoutImages
};
