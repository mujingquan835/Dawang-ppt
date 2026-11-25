// Pure-JS Deck IR -> Editable PPTX collection builder (works in both Node and browser).
// Eliminates DOM scraping (collectSlideInDom) and headless Chrome startup for PPTX export.
import { materializeElements } from '../scene/model.mjs';
import { resolveSlideStyle } from '../styles/registry.mjs';
import { slideNotes } from '../authoring/drafted.mjs';

function activeSlides(project) {
  const byId = new Map((project.slides || []).map((s) => [s.slideId, s]));
  const order = project.editorState?.slideOrder?.length
    ? project.editorState.slideOrder
    : (project.slides || []).map((s) => s.slideId);
  const deleted = new Set(project.editorState?.deletedSlides || []);
  const skipped = new Set(project.editorState?.skippedSlides || []);
  const ids = [...new Set([...order, ...(project.slides || []).map((s) => s.slideId)])];
  return ids.filter((id) => byId.has(id) && !deleted.has(id) && !skipped.has(id)).map((id) => byId.get(id));
}

function decodeBase64Head(dataUrl, maxBytes = 65536) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma);
  if (!header.includes(';base64')) return null;
  const b64 = dataUrl.slice(comma + 1, comma + 1 + Math.ceil((maxBytes * 4) / 3));
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Parse EXIF APP1 orientation tag (0x0112) from a JPEG APP1 segment payload starting at segStart (length segLen including length bytes).
function readJpegExifOrientation(bytes, segStart, segLen) {
  const end = Math.min(bytes.length, segStart + segLen);
  if (segStart + 14 > end) return 1;
  // Check "Exif\0\0"
  if (
    bytes[segStart + 2] !== 0x45 ||
    bytes[segStart + 3] !== 0x78 ||
    bytes[segStart + 4] !== 0x69 ||
    bytes[segStart + 5] !== 0x66 ||
    bytes[segStart + 6] !== 0x00 ||
    bytes[segStart + 7] !== 0x00
  ) {
    return 1;
  }
  const tiff = segStart + 8;
  const le = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const be = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!le && !be) return 1;
  const r16 = (o) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
  const r32 = (o) =>
    (le
      ? bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)
      : (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  if (r16(tiff + 2) !== 0x002a) return 1;
  const ifd0 = tiff + r32(tiff + 4);
  if (ifd0 + 2 > end) return 1;
  const count = r16(ifd0);
  for (let k = 0; k < count; k++) {
    const entry = ifd0 + 2 + k * 12;
    if (entry + 12 > end) break;
    if (r16(entry) === 0x0112 && r16(entry + 2) === 3 && r32(entry + 4) >= 1) {
      return r16(entry + 8);
    }
  }
  return 1;
}

// Fast pure-JS image dimension reader for PNG, JPEG (EXIF-aware), GIF, and WebP.
export function readImageBytesSize(bytes) {
  if (!bytes || bytes.length < 10) return null;
  const u16be = (o) => (bytes[o] << 8) | bytes[o + 1];
  const u16le = (o) => bytes[o] | (bytes[o + 1] << 8);
  const u32be = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;

  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes.length >= 24) {
    return { width: u32be(16), height: u32be(20) };
  }
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: u16le(6), height: u16le(8) };
  }
  // JPEG (with EXIF Orientation 5-8 swap so upright portrait photos report true visual dimensions)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    let orientation = 1;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      while (i < bytes.length && bytes[i] === 0xff) i++;
      if (i >= bytes.length) break;
      const marker = bytes[i++];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > bytes.length) break;
      const segLen = u16be(i);
      if (marker === 0xe1 && orientation === 1) {
        orientation = readJpegExifOrientation(bytes, i, segLen);
      }
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        if (i + 7 <= bytes.length) {
          const height = u16be(i + 3);
          const width = u16be(i + 5);
          return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
        }
      }
      if (segLen < 2) break;
      i += segLen;
    }
  }
  // WebP (RIFF....WEBP)
  if (bytes.length >= 30 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === 'VP8X' && bytes.length >= 30) {
      const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width: w, height: h };
    }
    if (chunk === 'VP8 ' && bytes.length >= 30) {
      return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && bytes.length >= 25) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

function parseColorAndAlpha(value) {
  if (!value || value === 'transparent' || value === 'none') return { hex: null, transparency: 100 };
  const s = String(value).trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return { hex: s, transparency: 0 };
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const hex = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return { hex, transparency: 0 };
  }
  if (/^#[0-9a-f]{8}$/i.test(s)) {
    const alpha = parseInt(s.slice(7, 9), 16) / 255;
    return { hex: s.slice(0, 7), transparency: Math.round((1 - alpha) * 100) };
  }
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i.exec(s);
  if (m) {
    const hex = '#' + [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0')).join('');
    const alpha = m[4] === undefined ? 1 : Number(m[4]);
    return { hex: alpha <= 0 ? null : hex, transparency: Math.round((1 - Math.max(0, Math.min(1, alpha))) * 100) };
  }
  return { hex: s, transparency: 0 };
}

function defaultMediaDimensions(dataUrl, fallbackBounds) {
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/svg+xml')) {
    return { width: fallbackBounds[2] || 100, height: fallbackBounds[3] || 100 };
  }
  if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    const head = decodeBase64Head(dataUrl, 131072);
    const sz = readImageBytesSize(head);
    if (sz && sz.width > 0 && sz.height > 0) return sz;
  }
  return { width: Math.max(1, fallbackBounds[2] || 100), height: Math.max(1, fallbackBounds[3] || 100) };
}

/**
 * Convert ProjectV2 directly to the collection structure consumed by composeEditablePptx.
 * @param {object} project - ProjectV2 (may contain portable-asset:N tokens)
 * @param {object} options
 * @param {(src: string) => Promise<string>|string} [options.resolveSrc] - Resolve token or file path to data: URL
 * @param {(src: string, bounds: number[]) => Promise<{width:number,height:number}>|{width:number,height:number}} [options.measureImage]
 */
export async function collectProjectFromIr(project, { resolveSrc, measureImage } = {}) {
  const slides = [];
  const fontSet = new Set();

  for (const slide of activeSlides(project)) {
    const styleDef = resolveSlideStyle(slide, project);
    const objects = [];

    // Slide background shape
    const bg = parseColorAndAlpha(styleDef.palette?.bg || '#FFFFFF');
    objects.push({
      id: `${slide.slideId}-background`,
      type: 'shape',
      bounds: [0, 0, 1920, 1080],
      style: { fill: bg.hex || '#FFFFFF', fillTransparency: bg.transparency },
    });

    const elements = materializeElements(slide, project);
    for (const e of elements) {
      if (!Array.isArray(e.bounds) || e.bounds.length !== 4) continue;
      const [x, y, w, h] = e.bounds;
      if (![x, y, w, h].every(Number.isFinite) || (e.type !== 'line' && (w <= 0 || h <= 0))) continue;
      const st = e.style || {};
      const opacity = st.opacity === undefined ? 1 : Math.max(0, Math.min(1, Number(st.opacity)));

      if (e.type === 'text') {
        const fam = st.fontFamily || (e.role === 'title' || e.id === 'title' ? styleDef.typography.heading : styleDef.typography.body);
        if (fam) fontSet.add(fam);
        const col = parseColorAndAlpha(st.color || styleDef.palette?.ink || '#111111');
        const runs = Array.isArray(e.runs) && e.runs.length
          ? e.runs.map((run) => {
              const rs = run.style || {};
              const rfam = rs.fontFamily || fam;
              if (rfam) fontSet.add(rfam);
              const rcol = parseColorAndAlpha(rs.color || st.color || styleDef.palette?.ink || '#111111');
              return {
                text: String(run.text ?? ''),
                style: {
                  fontFamily: rfam,
                  fontSize: rs.fontSize || st.fontSize || styleDef.typography?.sizes?.body || 24,
                  fontWeight: rs.fontWeight ?? st.fontWeight ?? 400,
                  fontStyle: rs.fontStyle || st.fontStyle || 'normal',
                  textDecoration: rs.textDecoration || st.textDecoration || '',
                  color: rcol.hex || '#111111',
                  letterSpacing: rs.letterSpacing ?? st.letterSpacing ?? 0,
                },
              };
            })
          : undefined;
        objects.push({
          id: e.id,
          type: 'text',
          text: String(e.text ?? ''),
          ...(runs ? { runs } : {}),
          bounds: [x, y, w, h],
          style: {
            fontFamily: fam,
            fontSize: st.fontSize || styleDef.typography?.sizes?.body || 24,
            fontWeight: st.fontWeight ?? 400,
            fontStyle: st.fontStyle || 'normal',
            color: col.hex || '#111111',
            textAlign: st.textAlign || 'left',
            letterSpacing: st.letterSpacing || 0,
            wrap: st.wrap !== false,
            textTransparency: Math.round((1 - (1 - col.transparency / 100) * opacity) * 100),
          },
        });
      } else if (e.type === 'image') {
        const rawSrc = e.src || '';
        const src = resolveSrc ? await resolveSrc(rawSrc) : rawSrc;
        if (!src) continue;
        const dims = (measureImage && (await measureImage(src, e.bounds))) || defaultMediaDimensions(src, e.bounds);
        objects.push({
          id: e.id,
          type: 'image',
          src,
          bounds: [x, y, w, h],
          naturalWidth: dims.width,
          naturalHeight: dims.height,
          fit: e.fit || 'contain',
          focal: e.focal || '50% 50%',
          ...(e.crop ? { crop: e.crop } : {}),
          ...(e.clipShape ? { clipShape: e.clipShape } : {}),
          style: { radius: st.radius || 0 },
        });
      } else if (e.type === 'line') {
        const stroke = parseColorAndAlpha(st.stroke || styleDef.palette?.accent || '#111111');
        objects.push({
          id: e.id,
          type: 'line',
          bounds: [x, y, Math.max(w, 1), Math.max(h, 1)],
          points: [e.x1 ?? 0, e.y1 ?? 0, e.x2 ?? w, e.y2 ?? h],
          startArrow: e.startArrow,
          endArrow: e.endArrow,
          style: {
            stroke: stroke.hex || '#111111',
            strokeWidth: st.strokeWidth || 3,
            strokeTransparency: Math.round((1 - (1 - stroke.transparency / 100) * opacity) * 100),
            ...(st.strokeDash ? { strokeDash: st.strokeDash } : {}),
          },
        });
      } else if (e.type === 'vector') {
        const fill = parseColorAndAlpha(st.fill);
        const stroke = parseColorAndAlpha(st.stroke);
        objects.push({
          id: e.id,
          type: 'vector',
          ...(e.shape ? { shape: e.shape } : {}),
          bounds: [x, y, w, h],
          points: e.points || [],
          closed: e.closed !== false,
          samplingTolerance: e.samplingTolerance,
          style: {
            fill: fill.hex,
            fillTransparency: fill.hex ? Math.round((1 - (1 - fill.transparency / 100) * opacity) * 100) : 100,
            stroke: stroke.hex,
            strokeWidth: st.strokeWidth || 0,
            strokeTransparency: stroke.hex ? Math.round((1 - (1 - stroke.transparency / 100) * opacity) * 100) : 100,
            rotate: st.rotate || 0,
          },
        });
      } else {
        // shape
        const fill = parseColorAndAlpha(st.fill || st.background);
        const stroke = parseColorAndAlpha(st.stroke);
        if (!fill.hex && !stroke.hex) continue;
        objects.push({
          id: e.id,
          type: 'shape',
          shape: e.shape || (st.radius >= Math.min(w, h) / 2 && w === h ? 'ellipse' : undefined),
          bounds: [x, y, w, h],
          style: {
            fill: fill.hex,
            fillTransparency: fill.hex ? Math.round((1 - (1 - fill.transparency / 100) * opacity) * 100) : 100,
            stroke: stroke.hex,
            strokeWidth: st.strokeWidth || (stroke.hex ? 2 : 0),
            strokeTransparency: stroke.hex ? Math.round((1 - (1 - stroke.transparency / 100) * opacity) * 100) : 100,
            ...(st.strokeDash ? { strokeDash: st.strokeDash } : {}),
            radius: st.radius || 0,
            rotate: st.rotate || 0,
          },
        });
      }
    }

    const notes = slideNotes(project, slide.slideId);
    slides.push({
      slideId: slide.slideId,
      objects,
      ...(notes ? { notes } : {}),
    });
  }

  return {
    revision: project.revision || 'ir-direct',
    width: 1920,
    height: 1080,
    fonts: [...fontSet],
    slides,
  };
}
