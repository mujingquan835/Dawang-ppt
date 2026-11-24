// Browser-pure Modern Web UI Component Library for Dawang-PPT (100% PPTX-native shapes & text, zero Node imports).
// Inspired by Tremor, shadcn/ui, Magic UI, Aceternity UI, Linear, and Stripe.
// All colors resolve to clean #RRGGBB hex tokens derived from the active 3-tone palette (light & dark compatible).

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function mixHex(a, b, t) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return a || '#23338B';
  return rgbToHex([ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t]);
}

export function uiTokens(palette = {}) {
  const dark = Boolean(palette.dark);
  const bg = palette.bg || (dark ? '#0D1526' : '#FFFFFF');
  const surface = palette.surface || (dark ? '#152238' : '#FFFFFF');
  const surfaceMuted = dark ? mixHex(surface, '#FFFFFF', 0.05) : '#F8FAFC';
  const primary = palette.primary || palette.accent || '#23338B';
  const secondary = palette.secondary || '#E2B898';
  const pop = palette.pop || '#FA6500';
  const ink = palette.ink || (dark ? '#F8FAFC' : '#1A202C');
  const body = palette.body || (dark ? '#CBD5E1' : '#3B4252');
  const muted = palette.muted || (dark ? '#94A3B8' : '#64748B');
  const line = palette.line || (dark ? '#283C5C' : '#E2E6EE');
  const pale = palette.pale || (dark ? mixHex(surface, primary, 0.16) : mixHex(primary, '#FFFFFF', 0.93));
  const softSec = palette.softSecondary || (dark ? mixHex(surface, secondary, 0.16) : mixHex(secondary, '#FFFFFF', 0.84));
  const popSoft = dark ? mixHex(surface, pop, 0.18) : mixHex(pop, '#FFFFFF', 0.90);
  const onSolid = dark ? (palette.onSolid || '#0D1526') : '#FFFFFF';
  const okBg = dark ? '#11302B' : '#ECFDF5';
  const okFg = dark ? '#34D399' : '#047857';
  const errBg = dark ? '#321820' : '#FEF2F2';
  const errFg = dark ? '#FB7185' : '#DC2626';
  const deepFocus = dark ? mixHex(bg, primary, 0.24) : mixHex('#0F172A', primary, 0.45);
  return {
    dark, bg, surface, surfaceMuted, primary, secondary, pop, ink, body, muted, line,
    pale, softSec, popSoft, onSolid, okBg, okFg, errBg, errFg, deepFocus,
  };
}

// Fast CJK/Latin text measurement
const charW = (ch, sz) => (/[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u3000-\u303F]/.test(ch) ? sz : /\s/.test(ch) ? sz * 0.32 : sz * 0.58);
export function estWidth(text, sz) {
  let w = 0;
  for (const ch of String(text ?? '')) w += charW(ch, sz);
  return Math.ceil(w);
}
export function estLines(text, sz, boxW) {
  const limit = Math.max(sz, boxW * 0.94);
  return String(text ?? '').split('\n').reduce((sum, para) => {
    let lines = 1, cur = 0;
    for (const ch of para) {
      const cw = charW(ch, sz);
      if (cur + cw > limit && cur > 0) { lines++; cur = cw; } else cur += cw;
    }
    return sum + lines;
  }, 0);
}
export function fitSize(text, boxW, maxSz, minSz = 20) {
  const w1 = Math.max(1, estWidth(text, 1));
  return Math.max(minSz, Math.min(maxSz, Math.floor((boxW * 0.92) / w1)));
}
export function fitBodySize(text, boxW, boxH, maxSz = 24, minSz = 16, lh = 1.4) {
  for (let sz = maxSz; sz >= minSz; sz -= 2) {
    if (estLines(text, sz, boxW) * sz * lh <= boxH) return sz;
  }
  return minSz;
}

const FONT_BODY = 'Source Han Sans SC';
const shape = (id, bounds, style, extra = {}) => ({ type: 'shape', id, bounds: bounds.map(Math.round), style, ...extra });
const txt = (id, text, bounds, style, extra = {}) => ({
  type: 'text', id, text: String(text ?? ''), bounds: bounds.map(Math.round),
  style: { fontFamily: FONT_BODY, fontSize: 22, fontWeight: 400, lineHeight: 1.35, color: '#1A202C', ...style },
  ...extra,
});
const ln = (id, [x1, y1], [x2, y2], style, extra = {}) => {
  const bx = Math.min(x1, x2), by = Math.min(y1, y2);
  const bw = Math.max(2, Math.abs(x2 - x1)), bh = Math.max(2, Math.abs(y2 - y1));
  return { type: 'line', id, bounds: [Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh)], x1: Math.round(x1 - bx), y1: Math.round(y1 - by), x2: Math.round(x2 - bx), y2: Math.round(y2 - by), style, ...extra };
};

// ===== PILL-01: Eyebrow Pill Badge (dot + label) =====
export function uiEyebrowPill({ id, x, y, text, palette, dotColor }) {
  const t = uiTokens(palette);
  const fs = 15;
  const label = String(text || '').trim();
  const tw = estWidth(label, fs);
  const w = Math.max(110, Math.min(480, tw + 44));
  const h = 30;
  return {
    width: w, height: h,
    elements: [
      shape(`${id}-bg`, [x, y, w, h], { fill: t.pale, stroke: t.line, strokeWidth: 1.5, radius: 15 }),
      shape(`${id}-dot`, [x + 12, y + 11, 8, 8], { fill: dotColor || t.pop, radius: 4 }, { shape: 'ellipse' }),
      txt(`${id}-tx`, label, [x + 26, y + 4, w - 36, 22], { fontSize: fs, fontWeight: 700, color: t.primary, lineHeight: 1.2 }),
    ],
  };
}

// ===== PILL-01b: Compact Status Pill =====
export function uiStatusBadge({ id, x, y, text, tone = 'primary', palette, height = 32, fontSize = 16 }) {
  const t = uiTokens(palette);
  const map = {
    ok: { fill: t.okBg, fg: t.okFg, stroke: t.okFg },
    pop: { fill: t.popSoft, fg: t.pop, stroke: t.pop },
    primary: { fill: t.pale, fg: t.primary, stroke: t.line },
    solid: { fill: t.primary, fg: t.onSolid, stroke: null },
    solidPop: { fill: t.pop, fg: '#FFFFFF', stroke: null },
    secondary: { fill: t.softSec, fg: t.ink, stroke: t.secondary },
    err: { fill: t.errBg, fg: t.errFg, stroke: t.errFg },
    muted: { fill: t.surfaceMuted, fg: t.muted, stroke: t.line },
  };
  const c = map[tone] || map.primary;
  const label = String(text || '');
  const w = Math.max(88, Math.min(340, estWidth(label, fontSize) + 28));
  return {
    width: w, height,
    elements: [
      shape(`${id}-bg`, [x, y, w, height], { fill: c.fill, ...(c.stroke ? { stroke: c.stroke, strokeWidth: 1 } : {}), radius: Math.round(height / 2) }),
      txt(`${id}-tx`, label, [x + 10, y + Math.round((height - fontSize * 1.25) / 2), w - 20, Math.round(fontSize * 1.3)], { fontSize, fontWeight: 700, color: c.fg, textAlign: 'center', lineHeight: 1.2 }),
    ],
  };
}

// ===== PILL-02: Segmented Tab Header Bar =====
export function uiSegmentedHeader({ id, x, y, width, sections = [], activeIndex = 0, palette }) {
  const t = uiTokens(palette);
  const list = sections.length ? sections.slice(0, 6) : ['01 核心结果', '02 关键动作', '03 问题复盘', '04 下一步规划'];
  const h = 42, pad = 4, gap = 6;
  const tabW = Math.floor((width - pad * 2 - gap * (list.length - 1)) / list.length);
  const elements = [
    shape(`${id}-bar`, [x, y, width, h], { fill: t.pale, stroke: t.line, strokeWidth: 1.5, radius: 12 }),
  ];
  list.forEach((label, i) => {
    const tx = x + pad + i * (tabW + gap);
    const active = i === activeIndex;
    if (active) {
      elements.push(shape(`${id}-tab-${i}`, [tx, y + pad, tabW, h - pad * 2], { fill: t.surface, stroke: t.line, strokeWidth: 1, radius: 9 }));
    }
    elements.push(txt(`${id}-lbl-${i}`, label, [tx + 8, y + 10, tabW - 16, 22], {
      fontSize: 16, fontWeight: active ? 700 : 400, color: active ? t.primary : t.muted, textAlign: 'center', lineHeight: 1.25,
    }));
  });
  return { elements, height: h };
}

// ===== PILL-03: Floating Stat Pills =====
export function uiFloatingStatPills({ id, x, y, width, items = [], palette, darkSurface = false }) {
  const t = uiTokens(palette);
  const list = items.slice(0, 4);
  if (!list.length) return { elements: [], height: 0 };
  const gap = 18;
  const pillW = Math.floor((width - gap * (list.length - 1)) / list.length);
  const h = 92;
  const elements = [];
  list.forEach((d, i) => {
    const px = x + i * (pillW + gap);
    const isHi = d.highlight || i === 0;
    const fill = darkSurface ? mixHex(t.primary, '#FFFFFF', 0.12) : t.surface;
    const stroke = darkSurface ? mixHex(t.primary, '#FFFFFF', 0.28) : t.line;
    const valColor = darkSurface ? '#FFFFFF' : (isHi ? t.pop : t.ink);
    const lblColor = darkSurface ? mixHex('#FFFFFF', t.secondary, 0.25) : t.muted;
    elements.push(shape(`${id}-pill-${i}`, [px, y, pillW, h], { fill, stroke, strokeWidth: 1.5, radius: 46 }));
    elements.push(shape(`${id}-ico-${i}`, [px + 14, y + 17, 58, 58], { fill: isHi ? t.pop : t.pale, radius: 29 }, { shape: 'ellipse' }));
    elements.push(txt(`${id}-icx-${i}`, String(i + 1).padStart(2, '0'), [px + 14, y + 32, 58, 30], { fontSize: 22, fontWeight: 900, color: isHi ? '#FFFFFF' : t.primary, textAlign: 'center', lineHeight: 1.2 }));
    const valStr = `${d.value ?? ''}${d.unit ? ' ' + d.unit : ''}`;
    const vSize = fitSize(valStr, pillW - 96, 32, 20);
    elements.push(txt(`${id}-val-${i}`, valStr, [px + 84, y + 14, pillW - 98, 40], { fontSize: vSize, fontWeight: 900, color: valColor, lineHeight: 1.15 }));
    elements.push(txt(`${id}-lbl-${i}`, d.label || '', [px + 84, y + 54, pillW - 98, 26], { fontSize: 17, fontWeight: 400, color: lblColor, lineHeight: 1.25 }));
  });
  return { elements, height: h };
}

// ===== PILL-04: Modern Callout Banner =====
export function uiCalloutBanner({ id, x, y, width, height = 82, label = '核心判断', text = '', badge = '', tone = 'primary', palette }) {
  const t = uiTokens(palette);
  const isPop = tone === 'pop' || tone === 'judgment';
  const bgFill = isPop ? t.popSoft : t.pale;
  const barFill = isPop ? t.pop : t.primary;
  const borderCol = isPop ? mixHex(t.pop, '#FFFFFF', 0.65) : t.line;
  const badgeW = badge ? Math.min(180, estWidth(badge, 16) + 32) : 0;
  const textX = x + 76;
  const textW = width - 94 - (badgeW ? badgeW + 20 : 0);
  const bodySize = fitBodySize(text, textW, Math.max(32, height - 40), 20, 17, 1.38);
  const elements = [
    shape(`${id}-box`, [x, y, width, height], { fill: bgFill, stroke: borderCol, strokeWidth: 1.5, radius: 14 }),
    shape(`${id}-bar`, [x, y + 8, 7, height - 16], { fill: barFill, radius: 4 }),
    shape(`${id}-ico`, [x + 22, y + Math.round((height - 38) / 2), 38, 38], { fill: barFill, radius: 10 }),
    txt(`${id}-icx`, isPop ? '!' : '★', [x + 22, y + Math.round((height - 26) / 2), 38, 26], { fontSize: 19, fontWeight: 900, color: isPop ? '#FFFFFF' : t.onSolid, textAlign: 'center', lineHeight: 1.2 }),
    txt(`${id}-lbl`, label, [textX, y + 11, textW, 24], { fontSize: 16, fontWeight: 700, color: barFill, lineHeight: 1.25 }),
    txt(`${id}-tx`, text, [textX, y + 36, textW, height - 42], { fontSize: bodySize, fontWeight: 400, color: t.ink, lineHeight: 1.38 }),
  ];
  if (badge) {
    const b = uiStatusBadge({ id: `${id}-bdg`, x: x + width - badgeW - 18, y: y + Math.round((height - 32) / 2), text: badge, tone: isPop ? 'solidPop' : 'solid', palette, height: 32, fontSize: 15 });
    elements.push(...b.elements);
  }
  return { elements, height };
}

// ===== KPI-01: Tremor DeltaBadge KPI Cards =====
export function uiDeltaKpiCards({ id, x, y, width, height = 220, items = [], palette }) {
  const t = uiTokens(palette);
  const list = items.slice(0, 5);
  if (!list.length) return { elements: [], height: 0 };
  const gap = 22;
  const cw = Math.floor((width - gap * (list.length - 1)) / list.length);
  const ch = Math.max(190, height);
  const elements = [];

  list.forEach((d, i) => {
    const cx = x + i * (cw + gap);
    const isPop = Boolean(d.highlight) || (i === 0 && !list.some((x2) => x2.highlight));
    const topColor = isPop ? t.pop : i % 2 === 1 ? t.secondary : t.primary;
    const pad = 22;
    const iw = cw - pad * 2;
    elements.push(shape(`${id}-card-${i}`, [cx, y, cw, ch], { fill: t.surface, stroke: t.line, strokeWidth: 1.5, radius: 16 }));
    elements.push(shape(`${id}-top-${i}`, [cx + 12, y, cw - 24, 6], { fill: topColor, radius: 3 }));

    const deltaText = d.delta || (d.target ? `目标 ${d.target}` : isPop ? '核心指标' : '');
    const badgeW = deltaText ? Math.min(Math.round(iw * 0.54), estWidth(deltaText, 15) + 22) : 0;
    const lblW = badgeW ? iw - badgeW - 8 : iw;
    elements.push(txt(`${id}-lbl-${i}`, d.label || '', [cx + pad, y + 22, lblW, 30], { fontSize: 20, fontWeight: 700, color: t.muted, lineHeight: 1.25 }));
    if (deltaText) {
      const isUp = /\+|超|↑|↗|核心/.test(deltaText);
      const b = uiStatusBadge({ id: `${id}-dl-${i}`, x: cx + cw - pad - badgeW, y: y + 18, text: deltaText, tone: isPop ? 'pop' : isUp ? 'ok' : 'primary', palette, height: 30, fontSize: 15 });
      elements.push(...b.elements);
    }

    const valStr = String(d.value ?? '');
    const unitStr = d.unit ? ` ${d.unit}` : '';
    const vSize = fitSize(valStr + unitStr, iw, 64, 34);
    const uSize = Math.max(18, Math.round(vSize * 0.42));
    const valColor = isPop ? t.pop : t.ink;
    const runs = [
      { text: valStr, style: { fontFamily: FONT_BODY, fontSize: vSize, fontWeight: 900, color: valColor } },
      ...(d.unit ? [{ text: unitStr, style: { fontFamily: FONT_BODY, fontSize: uSize, fontWeight: 400, color: t.muted } }] : []),
    ];
    elements.push(txt(`${id}-val-${i}`, valStr + unitStr, [cx + pad, y + 66, iw, Math.round(vSize * 1.25)], { fontSize: vSize, fontWeight: 900, color: valColor, lineHeight: 1.12 }, { runs }));

    const footText = d.note || (d.target ? `对标基线：${d.target}` : '');
    if (footText) {
      const fy = y + ch - 48;
      elements.push(ln(`${id}-div-${i}`, [cx + pad, fy - 10], [cx + cw - pad, fy - 10], { stroke: t.line, strokeWidth: 1.5, strokeDash: 'dash' }));
      elements.push(txt(`${id}-ft-${i}`, footText, [cx + pad, fy, iw, 30], { fontSize: 17, fontWeight: 400, color: t.muted, lineHeight: 1.3 }));
    }
  });
  return { elements, height: ch };
}

// ===== KPI-02: Target Progress Marker Cards =====
export function uiTargetProgressCards({ id, x, y, width, height = 260, items = [], palette }) {
  const t = uiTokens(palette);
  const list = items.slice(0, 4);
  if (!list.length) return { elements: [], height: 0 };
  const cols = list.length >= 3 ? 2 : list.length;
  const rows = Math.ceil(list.length / cols);
  const gapX = 22, gapY = 18;
  const cw = Math.floor((width - gapX * (cols - 1)) / cols);
  const ch = Math.max(132, Math.floor((height - gapY * (rows - 1)) / rows));
  const elements = [];

  const parseNum = (s) => {
    const m = String(s ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  };

  list.forEach((d, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = x + col * (cw + gapX), cy = y + row * (ch + gapY);
    const pad = 22, iw = cw - pad * 2;
    const vNum = parseNum(d.value), tNum = parseNum(d.target);
    let pct = 78, targetPos = 80, badgeText = d.target ? `目标 ${d.target}` : '稳步推进';
    let isPop = Boolean(d.highlight) || i === 0;
    if (vNum != null && tNum != null && tNum > 0) {
      const ratio = vNum / tNum;
      pct = Math.max(12, Math.min(96, Math.round(ratio > 1 ? 92 : ratio * 82)));
      targetPos = ratio > 1 ? Math.max(55, Math.min(84, Math.round(92 / ratio))) : 82;
      const pctNum = Math.round(ratio * 100);
      badgeText = pctNum >= 100 ? `达成 ${pctNum}%` : `进度 ${pctNum}%`;
      if (pctNum >= 100) isPop = true;
    } else if (String(d.unit || '').includes('%') && vNum != null) {
      pct = Math.max(12, Math.min(96, Math.round(vNum)));
      targetPos = 80;
      badgeText = `${vNum}%`;
    }

    elements.push(shape(`${id}-card-${i}`, [cx, cy, cw, ch], { fill: t.surface, stroke: t.line, strokeWidth: 1.5, radius: 16 }));
    elements.push(txt(`${id}-lbl-${i}`, d.label || '', [cx + pad, cy + 16, iw - 140, 28], { fontSize: 20, fontWeight: 700, color: t.body, lineHeight: 1.25 }));

    const valStr = `${d.value ?? ''}${d.unit ? ' ' + d.unit : ''}`;
    const vSz = fitSize(valStr, iw - 160, 42, 26);
    elements.push(txt(`${id}-val-${i}`, valStr, [cx + pad, cy + 44, iw - 150, 46], { fontSize: vSz, fontWeight: 900, color: isPop ? t.pop : t.ink, lineHeight: 1.1 }));

    const bdg = uiStatusBadge({ id: `${id}-bdg-${i}`, x: cx + cw - pad - Math.min(160, estWidth(badgeText, 16) + 28), y: cy + 20, text: badgeText, tone: isPop ? 'pop' : 'primary', palette, height: 32, fontSize: 16 });
    elements.push(...bdg.elements);

    const barY = cy + ch - 34;
    const barH = 14;
    const fillW = Math.max(24, Math.round((iw * pct) / 100));
    const pinX = cx + pad + Math.round((iw * targetPos) / 100);
    elements.push(shape(`${id}-trk-${i}`, [cx + pad, barY, iw, barH], { fill: t.pale, radius: 7 }));
    elements.push(shape(`${id}-fil-${i}`, [cx + pad, barY, fillW, barH], { fill: isPop ? t.pop : t.primary, radius: 7 }));
    elements.push(shape(`${id}-pin-${i}`, [pinX, barY - 5, 4, barH + 10], { fill: t.ink, radius: 2 }));
  });
  return { elements, height: rows * ch + (rows - 1) * gapY };
}

// ===== BENTO-04: Light Cards + 1 High-Contrast Spotlight Focus Card =====
export function uiBentoSpotlightCards({ id, x, y, width, height = 340, items = [], palette, focusIndex = -1 }) {
  const t = uiTokens(palette);
  const list = items.slice(0, 4);
  if (!list.length) return { elements: [], height: 0 };
  const fIdx = focusIndex >= 0 && focusIndex < list.length ? focusIndex : list.length - 1;
  const gap = 22;
  const cw = Math.floor((width - gap * (list.length - 1)) / list.length);
  const ch = Math.max(220, height);
  const elements = [];

  list.forEach((it, i) => {
    const cx = x + i * (cw + gap);
    const isFocus = i === fIdx;
    const pad = 26, iw = cw - pad * 2;
    const cardFill = isFocus ? t.deepFocus : t.surface;
    const cardStroke = isFocus ? t.primary : t.line;
    const titleCol = isFocus ? '#FFFFFF' : t.ink;
    const bodyCol = isFocus ? mixHex('#FFFFFF', t.secondary, 0.22) : t.body;
    elements.push(shape(`${id}-card-${i}`, [cx, y, cw, ch], { fill: cardFill, stroke: cardStroke, strokeWidth: isFocus ? 2 : 1.5, radius: 18 }));

    const bdg = uiStatusBadge({
      id: `${id}-tag-${i}`, x: cx + pad, y: y + pad,
      text: isFocus ? '★ 核心重点' : `动作 ${String(i + 1).padStart(2, '0')}`,
      tone: isFocus ? 'solidPop' : 'muted', palette, height: 32, fontSize: 16,
    });
    elements.push(...bdg.elements);

    const tSize = fitBodySize(it.title || '', iw, 68, 28, 21, 1.25);
    elements.push(txt(`${id}-t-${i}`, it.title || '', [cx + pad, y + pad + 50, iw, 68], { fontSize: tSize, fontWeight: 700, color: titleCol, lineHeight: 1.25 }));

    const detailY = y + pad + 124;
    const detailH = Math.max(60, ch - pad * 2 - 124);
    const dSize = fitBodySize(it.detail || '', iw, detailH, 22, 16, 1.42);
    elements.push(txt(`${id}-d-${i}`, it.detail || '', [cx + pad, detailY, iw, detailH], { fontSize: dSize, fontWeight: 300, color: bodyCol, lineHeight: 1.42 }));
  });
  return { elements, height: ch };
}

// ===== CMP-01: Muted Dashed Old-State vs Elevated Primary New-State =====
export function uiContrastCompare({ id, x, y, width, height = 420, compare = {}, palette }) {
  const t = uiTokens(palette);
  const gap = 30;
  const cw = Math.floor((width - gap) / 2);
  const ch = Math.max(280, height);
  const leftItems = (compare.left || []).slice(0, 5);
  const rightItems = (compare.right || []).slice(0, 5);
  const elements = [];

  const drawSide = (sideKey, sx, label, items, isNew) => {
    const pad = 28, iw = cw - pad * 2;
    elements.push(shape(`${id}-${sideKey}-box`, [sx, y, cw, ch], {
      fill: isNew ? t.surface : t.surfaceMuted,
      stroke: isNew ? t.primary : t.line,
      strokeWidth: isNew ? 3 : 2,
      ...(isNew ? {} : { strokeDash: 'dash' }),
      radius: 20,
    }));
    if (isNew) {
      const fl = uiStatusBadge({ id: `${id}-float`, x: sx + cw - 172, y: y - 16, text: '★ 升级方案', tone: 'solidPop', palette, height: 34, fontSize: 16 });
      elements.push(...fl.elements);
    } else {
      const fl = uiStatusBadge({ id: `${id}-oldtag`, x: sx + cw - 134, y: y + 22, text: '原有现状', tone: 'muted', palette, height: 30, fontSize: 15 });
      elements.push(...fl.elements);
    }
    elements.push(txt(`${id}-${sideKey}-hd`, label, [sx + pad, y + 24, iw - 120, 38], { fontSize: 28, fontWeight: 800, color: isNew ? t.primary : t.muted, lineHeight: 1.2 }));
    elements.push(ln(`${id}-${sideKey}-ln`, [sx + pad, y + 74], [sx + cw - pad, y + 74], { stroke: isNew ? t.pale : t.line, strokeWidth: 2 }));

    const rowAreaH = ch - 100;
    const rowH = Math.floor(rowAreaH / Math.max(1, items.length));
    items.forEach((it, idx) => {
      const ry = y + 88 + idx * rowH;
      const lineStr = it.detail ? `${it.title}：${it.detail}` : (it.title || '');
      const fSize = fitBodySize(lineStr, iw - 44, rowH - 12, 22, 16, 1.38);
      elements.push(shape(`${id}-${sideKey}-mk-${idx}`, [sx + pad, ry + 4, 28, 28], { fill: isNew ? t.primary : t.line, radius: 14 }, { shape: 'ellipse' }));
      elements.push(txt(`${id}-${sideKey}-mx-${idx}`, isNew ? '✓' : '✕', [sx + pad, ry + 7, 28, 22], { fontSize: 16, fontWeight: 900, color: isNew ? t.onSolid : t.muted, textAlign: 'center', lineHeight: 1.2 }));
      elements.push(txt(`${id}-${sideKey}-it-${idx}`, lineStr, [sx + pad + 42, ry, iw - 44, rowH - 8], { fontSize: fSize, fontWeight: isNew ? 500 : 300, color: isNew ? t.ink : t.body, lineHeight: 1.38 }));
    });
  };

  const rightIsNew = compare.current !== 'left';
  drawSide('left', x, compare.leftLabel || '现状 / 痛点', leftItems, !rightIsNew);
  drawSide('right', x + cw + gap, compare.rightLabel || '改进 / 目标', rightItems, rightIsNew);
  return { elements, height: ch };
}

// ===== CMP-03: Issue -> Cause -> Solution Diagnosis Trio =====
export function uiDiagnosisTrio({ id, x, y, width, height = 340, items = [], palette }) {
  const t = uiTokens(palette);
  const list = items.slice(0, 3);
  if (!list.length) return { elements: [], height: 0 };
  const arrowW = 46;
  const cw = Math.floor((width - arrowW * (list.length - 1)) / list.length);
  const ch = Math.max(220, height);
  const accents = [t.errFg, t.secondary, t.primary];
  const tones = ['err', 'secondary', 'solid'];
  const tags = ['01 现状诊断', '02 核心归因', '03 落地抓手'];
  const elements = [];

  list.forEach((it, i) => {
    const cx = x + i * (cw + arrowW);
    const pad = 24, iw = cw - pad * 2;
    const isLast = i === list.length - 1;
    elements.push(shape(`${id}-card-${i}`, [cx, y, cw, ch], { fill: isLast ? t.pale : t.surface, stroke: isLast ? t.primary : t.line, strokeWidth: isLast ? 2 : 1.5, radius: 16 }));
    elements.push(shape(`${id}-bar-${i}`, [cx + 12, y, cw - 24, 6], { fill: accents[i % 3], radius: 3 }));
    const bdg = uiStatusBadge({ id: `${id}-tag-${i}`, x: cx + pad, y: y + 22, text: it.tag || tags[i] || `0${i + 1}`, tone: tones[i % 3], palette, height: 32, fontSize: 16 });
    elements.push(...bdg.elements);
    const tSz = fitBodySize(it.title || '', iw, 64, 26, 20, 1.25);
    elements.push(txt(`${id}-t-${i}`, it.title || '', [cx + pad, y + 70, iw, 64], { fontSize: tSz, fontWeight: 700, color: t.ink, lineHeight: 1.25 }));
    const dH = Math.max(60, ch - 154);
    const dSz = fitBodySize(it.detail || '', iw, dH, 21, 16, 1.42);
    elements.push(txt(`${id}-d-${i}`, it.detail || '', [cx + pad, y + 140, iw, dH], { fontSize: dSz, fontWeight: 300, color: t.body, lineHeight: 1.42 }));
    if (i < list.length - 1) {
      elements.push(txt(`${id}-ar-${i}`, '→', [cx + cw + 4, y + Math.round(ch / 2) - 22, arrowW - 8, 44], { fontSize: 30, fontWeight: 900, color: t.muted, textAlign: 'center', lineHeight: 1.2 }));
    }
  });
  return { elements, height: ch };
}

// ===== FLOW-01: Horizontal Milestone Stepper =====
export function uiMilestoneStepper({ id, x, y, width, height = 340, periods = [], palette }) {
  const t = uiTokens(palette);
  const list = periods.slice(0, 5);
  if (!list.length) return { elements: [], height: 0 };
  const gap = 20;
  const cw = Math.floor((width - gap * (list.length - 1)) / list.length);
  const nodeD = 48;
  const railY = y + nodeD / 2;
  const cardY = y + nodeD + 26;
  const cardH = Math.max(180, height - nodeD - 26);
  const currIdx = Math.max(0, list.length - 2);
  const elements = [];

  // Connector rail
  const firstCx = x + Math.round(cw / 2);
  const lastCx = x + (list.length - 1) * (cw + gap) + Math.round(cw / 2);
  const currCx = x + currIdx * (cw + gap) + Math.round(cw / 2);
  elements.push(shape(`${id}-rail-bg`, [firstCx, railY - 3, lastCx - firstCx, 6], { fill: t.line, radius: 3 }));
  if (currCx > firstCx) {
    elements.push(shape(`${id}-rail-fg`, [firstCx, railY - 3, currCx - firstCx, 6], { fill: t.primary, radius: 3 }));
  }

  list.forEach((p, i) => {
    const cx = x + i * (cw + gap);
    const nx = cx + Math.round((cw - nodeD) / 2);
    const isDone = i < currIdx, isCurr = i === currIdx;
    if (isCurr) {
      elements.push(shape(`${id}-halo-${i}`, [nx - 8, y - 8, nodeD + 16, nodeD + 16], { fill: t.popSoft, radius: (nodeD + 16) / 2 }, { shape: 'ellipse' }));
    }
    elements.push(shape(`${id}-nd-${i}`, [nx, y, nodeD, nodeD], {
      fill: isCurr ? t.pop : isDone ? t.primary : t.surface,
      stroke: isCurr ? t.pop : isDone ? t.primary : t.line,
      strokeWidth: 3, radius: nodeD / 2,
    }, { shape: 'ellipse' }));
    elements.push(txt(`${id}-nx-${i}`, isDone ? '✓' : String(i + 1), [nx, y + 10, nodeD, 28], {
      fontSize: 21, fontWeight: 900, color: isCurr ? '#FFFFFF' : isDone ? t.onSolid : t.muted, textAlign: 'center', lineHeight: 1.2,
    }));

    elements.push(shape(`${id}-card-${i}`, [cx, cardY, cw, cardH], {
      fill: isCurr ? t.popSoft : t.surface,
      stroke: isCurr ? t.pop : t.line,
      strokeWidth: isCurr ? 2 : 1.5, radius: 16,
    }));
    const pad = 20, iw = cw - pad * 2;
    elements.push(txt(`${id}-lb-${i}`, p.label || `阶段 ${i + 1}`, [cx + pad, cardY + 16, iw, 26], { fontSize: 18, fontWeight: 700, color: isCurr ? t.pop : t.primary, lineHeight: 1.25 }));
    elements.push(txt(`${id}-ti-${i}`, p.title || '', [cx + pad, cardY + 46, iw, 44], { fontSize: 24, fontWeight: 700, color: t.ink, lineHeight: 1.25 }));
    const pts = (p.points || []).map((pt) => `• ${pt}`).join('\n');
    const pH = Math.max(60, cardH - 108);
    const pSz = fitBodySize(pts, iw, pH, 19, 15, 1.42);
    elements.push(txt(`${id}-pt-${i}`, pts, [cx + pad, cardY + 96, iw, pH], { fontSize: pSz, fontWeight: 300, color: t.body, lineHeight: 1.42 }));
  });
  return { elements, height: nodeD + 26 + cardH };
}

// ===== FLOW-02: Vertical Milestone Timeline =====
export function uiVerticalTimeline({ id, x, y, width, height = 420, periods = [], palette }) {
  const t = uiTokens(palette);
  const list = periods.slice(0, 5);
  if (!list.length) return { elements: [], height: 0 };
  const gap = 16;
  const rowH = Math.max(76, Math.floor((height - gap * (list.length - 1)) / list.length));
  const dateW = 190, railX = x + dateW + 34, cardX = railX + 46, cardW = width - (cardX - x);
  const elements = [
    shape(`${id}-rail`, [railX - 2, y + 24, 4, Math.max(40, (list.length - 1) * (rowH + gap))], { fill: t.line, radius: 2 }),
  ];

  list.forEach((p, i) => {
    const ry = y + i * (rowH + gap);
    const isLast = i === list.length - 1;
    elements.push(txt(`${id}-dt-${i}`, p.label || `阶段 ${i + 1}`, [x, ry + Math.round((rowH - 30) / 2), dateW, 34], { fontSize: 24, fontWeight: 900, color: isLast ? t.pop : t.primary, textAlign: 'right', lineHeight: 1.2 }));
    elements.push(shape(`${id}-ring-${i}`, [railX - 14, ry + Math.round(rowH / 2) - 14, 28, 28], { fill: isLast ? t.popSoft : t.pale, radius: 14 }, { shape: 'ellipse' }));
    elements.push(shape(`${id}-dot-${i}`, [railX - 8, ry + Math.round(rowH / 2) - 8, 16, 16], { fill: isLast ? t.pop : t.primary, radius: 8 }, { shape: 'ellipse' }));
    elements.push(shape(`${id}-card-${i}`, [cardX, ry, cardW, rowH], { fill: isLast ? t.popSoft : t.surface, stroke: isLast ? t.pop : t.line, strokeWidth: 1.5, radius: 14 }));

    const ptText = (p.points || []).join('  ·  ');
    elements.push(txt(`${id}-ti-${i}`, p.title || '', [cardX + 22, ry + 12, cardW - 180, 30], { fontSize: 22, fontWeight: 700, color: t.ink, lineHeight: 1.25 }));
    const pSz = fitBodySize(ptText, cardW - 180, Math.max(26, rowH - 48), 18, 15, 1.35);
    elements.push(txt(`${id}-pt-${i}`, ptText, [cardX + 22, ry + 44, cardW - 180, Math.max(26, rowH - 52)], { fontSize: pSz, fontWeight: 300, color: t.body, lineHeight: 1.35 }));
    const bdg = uiStatusBadge({ id: `${id}-st-${i}`, x: cardX + cardW - 142, y: ry + Math.round((rowH - 32) / 2), text: isLast ? '重点推进' : '已达成', tone: isLast ? 'solidPop' : 'ok', palette, height: 32, fontSize: 15 });
    elements.push(...bdg.elements);
  });
  return { elements, height: list.length * rowH + (list.length - 1) * gap };
}

// ===== FLOW-04: Watermark Stepper + Dashed Return Flywheel =====
export function uiFlywheelFlow({ id, x, y, width, height = 340, flow = {}, palette }) {
  const t = uiTokens(palette);
  const steps = (flow.steps || []).slice(0, 5);
  if (!steps.length) return { elements: [], height: 0 };
  const hasReturn = flow.returnTo != null;
  const retH = hasReturn ? 62 : 0;
  const cardH = Math.max(185, height - retH);
  const arrowW = 30;
  const cw = Math.floor((width - arrowW * (steps.length - 1)) / steps.length);
  const elements = [];

  steps.forEach((st, i) => {
    const cx = x + i * (cw + arrowW);
    const pad = 22, iw = cw - pad * 2;
    const isKey = i === steps.length - 1 || i === Math.floor(steps.length / 2);
    elements.push(shape(`${id}-card-${i}`, [cx, y, cw, cardH], { fill: t.surface, stroke: isKey ? t.primary : t.line, strokeWidth: isKey ? 2 : 1.5, radius: 16 }));
    // Watermark big number
    elements.push(txt(`${id}-wm-${i}`, String(i + 1).padStart(2, '0'), [cx + cw - 92, y + 6, 78, 72], { fontSize: 56, fontWeight: 900, color: t.pale, textAlign: 'right', lineHeight: 1 }));
    // Icon pill
    elements.push(shape(`${id}-ico-${i}`, [cx + pad, y + pad, 42, 42], { fill: isKey ? t.popSoft : t.pale, radius: 12 }));
    elements.push(txt(`${id}-icx-${i}`, String(i + 1), [cx + pad, y + pad + 8, 42, 26], { fontSize: 20, fontWeight: 900, color: isKey ? t.pop : t.primary, textAlign: 'center', lineHeight: 1.2 }));

    const tSz = fitBodySize(st.title || '', iw, 58, 25, 19, 1.25);
    elements.push(txt(`${id}-t-${i}`, st.title || '', [cx + pad, y + 80, iw, 58], { fontSize: tSz, fontWeight: 700, color: t.ink, lineHeight: 1.25 }));
    const dH = Math.max(54, cardH - 156);
    const dSz = fitBodySize(st.detail || '', iw, dH, 19, 15, 1.4);
    elements.push(txt(`${id}-d-${i}`, st.detail || '', [cx + pad, y + 142, iw, dH], { fontSize: dSz, fontWeight: 300, color: t.body, lineHeight: 1.4 }));

    if (i < steps.length - 1) {
      elements.push(txt(`${id}-ar-${i}`, '→', [cx + cw + 2, y + Math.round(cardH / 2) - 18, arrowW - 4, 36], { fontSize: 24, fontWeight: 900, color: t.muted, textAlign: 'center', lineHeight: 1.2 }));
    }
  });

  if (hasReturn) {
    const ry = y + cardH + 14;
    const lx = x + Math.round(cw / 2), rx = x + (steps.length - 1) * (cw + arrowW) + Math.round(cw / 2);
    elements.push(ln(`${id}-ret-l`, [rx, ry + 20], [lx, ry + 20], { stroke: t.secondary, strokeWidth: 2.5, strokeDash: 'dash' }, { endArrow: true }));
    const pillText = `↺ ${flow.title || '数据反哺'} · 闭环回流持续迭代`;
    const pw = Math.min(rx - lx - 40, estWidth(pillText, 17) + 38);
    const px = Math.round((lx + rx - pw) / 2);
    elements.push(shape(`${id}-ret-bg`, [px, ry + 2, pw, 36], { fill: t.softSec, stroke: t.secondary, strokeWidth: 1.5, radius: 18 }));
    elements.push(txt(`${id}-ret-tx`, pillText, [px + 10, ry + 8, pw - 20, 24], { fontSize: 17, fontWeight: 700, color: t.ink, textAlign: 'center', lineHeight: 1.25 }));
  }
  return { elements, height: cardH + retH };
}

// =========================================================================
// Studio Editor Quick-Insert UI Component Presets (+ UI 组件 toolbar menu)
// =========================================================================
export const UI_INSERT_PRESETS = [
  { id: 'kpi-delta', name: '涨跌胶囊 KPI 卡', sub: 'Tremor 指标卡', group: 'KPI 数据' },
  { id: 'kpi-progress', name: '目标刻度进度条', sub: '达成进度 + 目标线', group: 'KPI 数据' },
  { id: 'callout-banner', name: '现代结论横幅', sub: '左竖条 + 状态胶囊', group: '徽章微件' },
  { id: 'pill-badges', name: '眉标与状态胶囊', sub: '圆点徽章 / 小标签', group: '徽章微件' },
  { id: 'bento-spotlight', name: '深浅对比焦点卡', sub: 'Bento 聚光灯 3 卡', group: 'Bento 网格' },
  { id: 'compare-cards', name: '旧态 vs 新态对比', sub: '虚线降权 + 主色抬升', group: '对比与流程' },
  { id: 'trio-diagnosis', name: '问题→归因→解法', sub: '三联复盘诊断卡', group: '对比与流程' },
  { id: 'milestone-step', name: '水平里程碑节点', sub: '三态进度时间轴', group: '对比与流程' },
];

export function buildUiPresetElements(presetId, palette = {}, uid = 'ui') {
  const id = `ui-${uid}`;
  switch (presetId) {
    case 'kpi-delta':
      return uiDeltaKpiCards({
        id, x: 160, y: 390, width: 1600, height: 220, palette,
        items: [
          { label: '核心活跃用户', value: '48.2', unit: '万', delta: '↗ +24.8%', target: '40万', highlight: true },
          { label: '月度新增团队', value: '1,268', unit: '个', delta: '↗ +18.2%', target: '1,000个' },
          { label: '平均响应耗时', value: '146', unit: 'ms', delta: '↘ -14.5%', target: '180ms' },
        ],
      }).elements;
    case 'kpi-progress':
      return uiTargetProgressCards({
        id, x: 220, y: 340, width: 1480, height: 320, palette,
        items: [
          { label: '年度交付进度', value: '482', unit: '项', target: '400项', highlight: true },
          { label: '核心模块覆盖', value: '86', unit: '%', target: '100%' },
        ],
      }).elements;
    case 'callout-banner':
      return uiCalloutBanner({
        id, x: 120, y: 840, width: 1680, height: 100, palette,
        label: '核心结论',
        text: '新一代架构已完成压力验证，下阶段将重点推进多端协作体验与插件生态建设。',
        badge: '重点方向',
        tone: 'pop',
      }).elements;
    case 'pill-badges': {
      const p1 = uiEyebrowPill({ id: `${id}-ey`, x: 160, y: 120, text: '01 核心能力概览', palette });
      const b1 = uiStatusBadge({ id: `${id}-ok`, x: 160 + p1.width + 18, y: 123, text: '✓ 已验证', tone: 'ok', palette });
      const b2 = uiStatusBadge({ id: `${id}-pop`, x: 160 + p1.width + 18 + b1.width + 14, y: 123, text: '★ 重点特性', tone: 'pop', palette });
      const b3 = uiStatusBadge({ id: `${id}-pri`, x: 160 + p1.width + 18 + b1.width + 14 + b2.width + 14, y: 123, text: '● 进行中', tone: 'solid', palette });
      return [...p1.elements, ...b1.elements, ...b2.elements, ...b3.elements];
    }
    case 'bento-spotlight':
      return uiBentoSpotlightCards({
        id, x: 120, y: 340, width: 1680, height: 350, palette, focusIndex: 2,
        items: [
          { title: '模块化组件沉淀', detail: '将高频页面元素沉淀为标准组件，显著减少重复搭建成本。' },
          { title: '多端协同同步', detail: '统一数据结构与离线存储协议，确保桌面与网页端体验一致。' },
          { title: '智能排版引擎', detail: '根据内容密度自动计算字号与版面层级，实现开箱即用的视觉规范。' },
        ],
      }).elements;
    case 'compare-cards':
      return uiContrastCompare({
        id, x: 120, y: 280, width: 1680, height: 460, palette,
        compare: {
          leftLabel: '旧版 · 传统手工方式',
          rightLabel: '新版 · 智能引擎方式',
          current: 'right',
          left: [
            { title: '人工对齐耗时久', detail: '手工逐页微调字号与边距，平均耗时较长' },
            { title: '视觉风格难统一', detail: '多人协作时配色与字体容易割裂，返工频繁' },
            { title: '格式导出易错位', detail: '静态截图无法二次编辑，交付后修改困难' },
          ],
          right: [
            { title: '结构化一键出稿', detail: '输入大纲秒级自动成稿，自动校验零溢出' },
            { title: '一键换色与换版式', detail: '内置多套配色与现代版式，现场即时切换' },
            { title: '离线精修与原生导出', detail: '支持浏览器离线精修，直出原生可编辑 PPTX' },
          ],
        },
      }).elements;
    case 'trio-diagnosis':
      return uiDiagnosisTrio({
        id, x: 120, y: 330, width: 1680, height: 360, palette,
        items: [
          { tag: '01 现状观察', title: '首屏加载耗时偏高', detail: '大体积静态资源阻塞渲染，弱网环境下首屏等待超过 3 秒。' },
          { tag: '02 原因定位', title: '字体与媒体未按需裁剪', detail: '全量嵌入多套字库与原图，单文件体积膨胀至数十兆。' },
          { tag: '03 优化方案', title: '动态子集化与资源池', detail: '启用按字提取子集与去重媒体池，文件体积缩减 80%。' },
        ],
      }).elements;
    case 'milestone-step':
      return uiMilestoneStepper({
        id, x: 120, y: 340, width: 1680, height: 360, palette,
        periods: [
          { label: '阶段 1 · 已完成', title: '架构立项', points: ['确立双字体与色板体系', '完成基础渲染内核'] },
          { label: '阶段 2 · 已完成', title: '试点验证', points: ['跑通纯 Node 极速管道', '验证原生 PPTX 导出'] },
          { label: '阶段 3 · 当前阶段', title: '体验升级', points: ['上线现代 UI 组件体系', '支持一键换色与换版式'] },
          { label: '阶段 4 · 规划中', title: '生态开放', points: ['开放自定义主题与插件', '完善公开示例与文档'] },
        ],
      }).elements;
    default:
      return [];
  }
}
