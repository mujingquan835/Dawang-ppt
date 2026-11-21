// Pure-Node fast text & image measurer implementing the exact interface of createLayoutMeasurer().
// Enables sub-second whole-deck composition via composeReportDeck with ZERO headless Chrome startup.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readImageBytesSize } from '../export/ir-collect.mjs';
import { resolveSlideStyle } from '../styles/registry.mjs';

const CJK_OR_FULL = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u3000-\u303F\u2010-\u203B]/;

function charAdvance(ch, fontSize, fontFamily = '', fontWeight = 400) {
  const isDisplay = /YouShe/i.test(String(fontFamily || ''));
  const weightBoost = Number(fontWeight) >= 700 ? 1.03 : 1.0;
  const displayBoost = isDisplay ? 1.12 : 1.0;
  if (ch === '\t') return fontSize * 1.2;
  if (/\s/.test(ch)) return fontSize * 0.32;
  if (CJK_OR_FULL.test(ch)) return fontSize * 1.0 * weightBoost * displayBoost;
  if (/[A-Z]/.test(ch)) return fontSize * 0.66 * weightBoost * displayBoost;
  if (/[0-9%+\-.,]/.test(ch)) return fontSize * 0.58 * weightBoost * displayBoost;
  return fontSize * 0.55 * weightBoost * displayBoost;
}

function measureTextSpec(spec, defaultStyle) {
  const boxW = Math.max(1, Number(spec.bounds?.[2]) || 1000);
  const baseFontSize = Number(spec.style?.fontSize || defaultStyle?.typography?.sizes?.body || 24);
  const baseFamily = spec.style?.fontFamily || ((spec.role === 'title' || spec.id === 'title') ? defaultStyle?.typography?.heading : defaultStyle?.typography?.body) || 'Source Han Sans SC';
  const baseWeight = Number(spec.style?.fontWeight || 400);
  const lineHeight = Number(spec.style?.lineHeight || 1.25);
  const letterSpacing = Number(spec.style?.letterSpacing || 0);

  // Flatten runs or plain text into per-character token array with advances
  const chars = [];
  if (Array.isArray(spec.runs) && spec.runs.length) {
    for (const run of spec.runs) {
      const rs = run.style || {};
      const sz = Number(rs.fontSize || baseFontSize);
      const fam = rs.fontFamily || baseFamily;
      const wght = Number(rs.fontWeight || baseWeight);
      const ls = Number(rs.letterSpacing ?? letterSpacing);
      for (const ch of String(run.text ?? '')) {
        chars.push({ ch, sz, adv: charAdvance(ch, sz, fam, wght) + ls });
      }
    }
  } else {
    for (const ch of String(spec.text ?? '')) {
      chars.push({ ch, sz: baseFontSize, adv: charAdvance(ch, baseFontSize, baseFamily, baseWeight) + letterSpacing });
    }
  }

  // Natural single-line width (max paragraph width)
  let naturalWidth = 0;
  let curParaW = 0;
  for (const item of chars) {
    if (item.ch === '\n') {
      if (curParaW > naturalWidth) naturalWidth = curParaW;
      curParaW = 0;
    } else {
      curParaW += item.adv;
    }
  }
  if (curParaW > naturalWidth) naturalWidth = curParaW;

  // Wrapped line layout (96% safety factor to prevent browser overflow)
  const wrapLimit = Math.max(baseFontSize, boxW * 0.96);
  let lines = 1;
  let lineW = 0;
  let lineMaxSz = baseFontSize;
  let totalHeight = 0;
  let onLast = 0;
  const breaks = [];
  let maxLineW = 0;

  for (let i = 0; i < chars.length; i++) {
    const item = chars[i];
    if (item.ch === '\n') {
      if (lineW > maxLineW) maxLineW = lineW;
      totalHeight += lineMaxSz * lineHeight;
      lines++;
      lineW = 0;
      lineMaxSz = baseFontSize;
      onLast = 0;
      if (i + 1 < chars.length) breaks.push(i + 1);
      continue;
    }
    if (lineW + item.adv > wrapLimit && lineW > 0) {
      if (lineW > maxLineW) maxLineW = lineW;
      totalHeight += lineMaxSz * lineHeight;
      lines++;
      lineW = item.adv;
      lineMaxSz = item.sz;
      onLast = /\s/.test(item.ch) ? 0 : 1;
      breaks.push(i);
    } else {
      lineW += item.adv;
      if (item.sz > lineMaxSz) lineMaxSz = item.sz;
      if (!/\s/.test(item.ch)) onLast++;
    }
  }
  if (lineW > maxLineW) maxLineW = lineW;
  totalHeight += lineMaxSz * lineHeight;

  return {
    id: spec.id,
    fontAvailable: true,
    height: Math.ceil(totalHeight),
    width: Math.ceil(Math.max(boxW, maxLineW)),
    naturalWidth: Math.ceil(naturalWidth),
    fontFamily: baseFamily,
    fontSize: baseFontSize,
    ...(spec.lastLine ? { lines, lastLineChars: onLast, breaks } : {}),
  };
}

function readLocalImageSize(src) {
  if (!src) throw new Error('Image source missing');
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    const head = Buffer.from(src.slice(comma + 1, comma + 1 + 175000), 'base64');
    const sz = readImageBytesSize(head);
    if (sz) return sz;
    throw new Error('Unsupported data URI image header');
  }
  const abs = src.startsWith('file:') ? fileURLToPath(src) : src;
  const fd = fs.openSync(abs, 'r');
  try {
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const sz = readImageBytesSize(buf.subarray(0, n));
    if (sz) return sz;
    // Retry reading full file if JPEG has large EXIF header before SOF marker
    const full = fs.readFileSync(abs);
    const sz2 = readImageBytesSize(full);
    if (sz2) return sz2;
    throw new Error('Could not parse image dimensions: ' + abs);
  } finally {
    fs.closeSync(fd);
  }
}

export function createFastMeasurer() {
  return {
    async texts(specs, style = resolveSlideStyle({ styleId: 'authored/custom', authoring: { engine: 'dawang-authored-v1' } })) {
      return specs.map((spec) => measureTextSpec(spec, style));
    },
    async imageSize(src) {
      return readLocalImageSize(src);
    },
    async close() {},
  };
}
