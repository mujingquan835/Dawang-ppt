// One-click whole-deck palette remapper for Dawang-PPT Studio editor (100% browser-pure, zero Node imports).
// Accurately remaps primary/secondary/pop roles, derived tints, surfaces, strokes,
// cover panels, and light <-> dark polarities across every slide, element, and text run.

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function mixHex(a, b, t) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return a;
  return rgbToHex([ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t]);
}

function lighten(hex, t) {
  return mixHex(hex, '#FFFFFF', t);
}

function relLum(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function readableInk(color, bg, min = 3.1) {
  if (!hexToRgb(color) || !hexToRgb(bg)) return color;
  if (contrastRatio(color, bg) >= min) return color;
  const darkBg = relLum(bg) < 0.3;
  const target = darkBg ? '#FFFFFF' : '#0B1220';
  for (let t = 0.08; t <= 1.0; t += 0.06) {
    const c = mixHex(color, target, t);
    if (contrastRatio(c, bg) >= min) return c;
  }
  return target;
}

const LIGHT_BASE = { bg: '#FFFFFF', surface: '#FFFFFF', ink: '#1A202C', body: '#3B4252', muted: '#64748B', line: '#E2E6EE', inverse: '#FFFFFF', dark: false };
const mkLight = (id, name, primary, secondary, pop, fit) => ({
  id, name, fit,
  palette: { ...LIGHT_BASE, tile: '#FFFFFF', accent: primary, primary, secondary, pop, pale: lighten(primary, 0.94), band: lighten(primary, 0.94), softSecondary: lighten(secondary, 0.82), highlightBg: lighten(secondary, 0.86) },
});
const mkDark = (id, name, primary, secondary, pop, fit, extra = {}) => ({
  id, name, fit,
  palette: {
    bg: extra.bg || '#0D1526', surface: extra.surface || '#152238', tile: extra.surface || '#152238',
    ink: '#F8FAFC', body: '#CBD5E1', muted: '#94A3B8', line: extra.line || '#283C5C',
    inverse: extra.onPrimary || '#0D1526', accent: primary, primary, secondary, pop,
    pale: extra.pale || '#192945', band: extra.band || '#142138', softSecondary: '#1E2C47', highlightBg: '#24293D',
    dark: true, onSolid: extra.onPrimary || '#0D1526',
  },
});

const REPORT_PALETTES = [
  mkLight('blue-gold', '蓝金色', '#23338B', '#E2B898', '#FA6500', '皇家宝蓝 + 香槟暖金 + 活力橙点睛'),
  mkLight('stone-gold', '皓石金', '#2D4F6E', '#F1B871', '#E49882', '深海皓蓝 + 暖麦金 + 珊瑚杏'),
  mkLight('business-gold', '商务金', '#2A2936', '#B4A393', '#D2C6BB', '黑曜炭灰 + 流沙金'),
  mkLight('jade-gold', '翡翠金', '#438C80', '#E1BC8B', '#DE8784', '清雅翡翠绿 + 香槟金 + 珊瑚粉'),
  mkLight('green-red-gold', '绿红金', '#59846C', '#D2423C', '#E1A662', '松柏绿 + 朱砂红 + 暖金'),
  mkLight('blue-cyan', '蓝青色', '#3A7EBF', '#3AB4C9', '#EFCC6B', '晴空蓝 + 湖光青 + 柠檬金'),
  mkLight('red-gold', '红金色', '#C72231', '#D45022', '#E3A557', '正统朱红 + 炽橙暖金'),
  mkLight('purple-gold-orange', '紫金橙', '#4A4C81', '#F0C25E', '#ED8300', '典雅鸢尾紫 + 明金 + 活力橙'),
  mkLight('primary-colors', '三原色', '#5E96FA', '#F65474', '#F8CF67', '明快晴蓝 + 珊瑚玫红 + 明黄'),
  mkDark('midnight-gold', '星夜曜金', '#F59E0B', '#38BDF8', '#FB7185', '深海夜蓝暗底 + 高光琥珀金'),
  mkDark('cyber-cyan', '黑曜电青', '#22D3EE', '#818CF8', '#F59E0B', '黑曜石暗底 + 极光青', { bg: '#0E121B', surface: '#171E2E', pale: '#1B2538', band: '#151D2C', line: '#29354D', onPrimary: '#0B111A' }),
];
const reportPalette = (id) => (REPORT_PALETTES.find((x) => x.id === id || x.name === id) || REPORT_PALETTES[0]).palette;

function rgbDist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

function saturation([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

function luminance([r, g, b]) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function normHex(v) {
  const s = String(v || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
  return null;
}

function buildColorTable(oldPal, newPal) {
  const map = new Map();
  const reg = (from, to) => {
    const k = normHex(from), v = normHex(to);
    if (k && v && !map.has(k)) map.set(k, v);
  };

  const op = oldPal || reportPalette('blue-gold');
  const np = newPal;
  const oPri = op.primary || op.accent || '#23338B';
  const oSec = op.secondary || '#E2B898';
  const oPop = op.pop || '#FA6500';
  const nPri = np.primary || np.accent || '#23338B';
  const nSec = np.secondary || '#E2B898';
  const nPop = np.pop || '#FA6500';

  const oBg = op.bg || '#FFFFFF';
  const oSurf = op.surface || '#FFFFFF';
  const oPale = op.pale || lighten(oPri, 0.94);
  const oSoftSec = op.softSecondary || lighten(oSec, 0.82);
  const oHiBg = op.highlightBg || lighten(oSec, 0.86);

  const nBg = np.bg || '#FFFFFF';
  const nSurf = np.surface || '#FFFFFF';
  const nPale = np.pale || (np.dark ? '#192945' : lighten(nPri, 0.94));
  const nSoftSec = np.softSecondary || (np.dark ? '#1E2C47' : lighten(nSec, 0.82));
  const nHiBg = np.highlightBg || (np.dark ? '#24293D' : lighten(nSec, 0.86));

  // 1. Direct exact role mappings (primary / secondary / pop + readableInk variants)
  reg(oPri, nPri);
  reg(readableInk(oPri, oBg), np.dark ? nPri : readableInk(nPri, nBg));
  reg(readableInk(oPri, oSurf), np.dark ? nPri : readableInk(nPri, nSurf));
  reg(readableInk(oPri, oPale), np.dark ? nPri : readableInk(nPri, nPale));
  reg(oSec, nSec);
  reg(readableInk(oSec, oBg), np.dark ? nSec : readableInk(nSec, nBg));
  reg(readableInk(oSec, oSurf), np.dark ? nSec : readableInk(nSec, nSurf));
  reg(oPop, nPop);
  reg(readableInk(oPop, oBg), np.dark ? nPop : readableInk(nPop, nBg));
  reg(readableInk(oPop, oSurf), np.dark ? nPop : readableInk(nPop, nSurf));

  // 2. Derived light/dark tints generated by layout-kit / report-deck
  for (const t of [0.94, 0.92, 0.9, 0.88, 0.86, 0.84, 0.82, 0.78, 0.72, 0.55, 0.45, 0.3, 0.25, 0.15]) {
    const nTint = (role) => (np.dark ? mixHex(nSurf, role, Math.max(0.12, 1 - t)) : lighten(role, t));
    reg(lighten(oPri, t), nTint(nPri));
    reg(lighten(oSec, t), nTint(nSec));
    reg(lighten(oPop, t), nTint(nPop));
    reg(mixHex(oSurf, oPri, Math.max(0.12, 1 - t)), nTint(nPri));
    reg(mixHex(oSurf, oSec, Math.max(0.12, 1 - t)), nTint(nSec));
    reg(mixHex(oSurf, oPop, Math.max(0.12, 1 - t)), nTint(nPop));
  }

  // 3. Structural surfaces, borders, inks
  reg(oPale, nPale);
  reg(op.band || oPale, np.band || nPale);
  reg(oSoftSec, nSoftSec);
  reg(oHiBg, nHiBg);
  reg(op.line || '#E2E6EE', np.line || '#E2E6EE');
  reg(op.ink || '#1A202C', np.ink || '#1A202C');
  reg(op.body || '#3B4252', np.body || '#3B4252');
  reg(op.muted || '#64748B', np.muted || '#64748B');

  // Palette anchors for perceptual nearest-match fallback on tinted fills/strokes
  const anchors = [
    { rgb: hexToRgb(oPri), target: nPri },
    { rgb: hexToRgb(oSec), target: nSec },
    { rgb: hexToRgb(oPop), target: nPop },
  ].filter((a) => a.rgb);

  return function mapColor(raw, { isText = false, isBg = false, isCover = false } = {}) {
    const h = normHex(raw);
    if (!h) return raw;
    if (isCover) {
      if (isBg) return np.dark ? nBg : nPri;
      if (h === '#FFFFFF' || h === normHex(op.inverse)) return '#FFFFFF';
      // Soft tinted cover eyebrow / subtitle
      const rgb = hexToRgb(h);
      if (rgb && luminance(rgb) > 0.65) return mixHex('#FFFFFF', nSec, 0.28);
      if (map.has(h)) return map.get(h);
      return raw;
    }

    // Surfaces / page background
    if (h === normHex(oBg) && isBg) return nBg;
    if (h === normHex(oSurf) && isBg) return nSurf;
    if (h === '#FFFFFF' && !isText && isBg) return nSurf;
    if (h === '#FFFFFF' && isText) return np.dark ? (np.onSolid || '#0D1526') : '#FFFFFF';
    if (h === normHex(op.inverse) && isText) return np.dark ? (np.onSolid || '#0D1526') : '#FFFFFF';

    if (map.has(h)) return map.get(h);

    const rgb = hexToRgb(h);
    if (!rgb) return raw;
    const sat = saturation(rgb);
    const lum = luminance(rgb);

    // Polarity flip for neutral grays when switching light <-> dark
    if (sat < 0.14) {
      if (Boolean(op.dark) !== Boolean(np.dark)) {
        if (isText) return lum < 0.45 ? np.ink : np.muted;
        if (lum > 0.85) return nPale;
        if (lum < 0.25) return nSurf;
      }
      return raw;
    }

    // Saturated color close to one of old palette's 3 roles -> map proportionally
    let best = null, bestD = Infinity;
    for (const a of anchors) {
      const d = rgbDist(rgb, a.rgb);
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best && bestD < 82) {
      return isText && !np.dark ? readableInk(best.target, nSurf) : best.target;
    }
    return raw;
  };
}

export function applyPaletteToProject(project, paletteId) {
  const entry = REPORT_PALETTES.find((x) => x.id === paletteId || x.name === paletteId);
  if (!entry) throw new Error('未知配色方案：' + paletteId);
  const oldPal = project.designChoice?.appearance?.palette || reportPalette('blue-gold');
  const newPal = entry.palette;
  const mapColor = buildColorTable(oldPal, newPal);

  project.designChoice = project.designChoice || {};
  project.designChoice.appearance = { ...(project.designChoice.appearance || {}), palette: structuredClone(newPal), paletteId: entry.id };

  for (const slide of project.slides || []) {
    const isCoverSlide = (slide.elements || []).some((e) => e.id === 'cover-panel' || e.id === 'cover-name');
    for (const el of slide.elements || []) {
      const isCoverEl = isCoverSlide && (el.id === 'cover-panel' || el.id === 'cover-name' || el.id === 'cover-eyebrow' || el.id === 'cover-subtitle' || el.id === 'cover-note' || el.id === 'title' || el.id?.startsWith('ph1-caption'));
      if (el.style) {
        if (el.style.fill) el.style.fill = mapColor(el.style.fill, { isBg: true, isCover: el.id === 'cover-panel' });
        if (el.style.background) el.style.background = mapColor(el.style.background, { isBg: true, isCover: el.id === 'cover-panel' });
        if (el.style.stroke) el.style.stroke = mapColor(el.style.stroke, { isBg: false });
        if (el.style.color) el.style.color = mapColor(el.style.color, { isText: true, isCover: isCoverEl });
      }
      if (el.manualStyle) {
        if (el.manualStyle.fill) el.manualStyle.fill = mapColor(el.manualStyle.fill, { isBg: true });
        if (el.manualStyle.stroke) el.manualStyle.stroke = mapColor(el.manualStyle.stroke, { isBg: false });
        if (el.manualStyle.color) el.manualStyle.color = mapColor(el.manualStyle.color, { isText: true, isCover: isCoverEl });
      }
      if (Array.isArray(el.runs)) {
        for (const run of el.runs) {
          if (run.style?.color) {
            run.style.color = mapColor(run.style.color, { isText: true, isCover: isCoverEl });
          }
        }
      }
    }
  }
  return { paletteId: entry.id, name: entry.name };
}

export { REPORT_PALETTES };
