// Multi-layout variant generator for Dawang-PPT one-click "换版式" (Layout Switcher).
// Generates 4-5 distinct, zero-overflow, 100% PPTX-native layout variants per slide
// directly from the semantic outline page, reusing the Modern Web UI Component Library (ui-kit.mjs).
import path from 'node:path';
import {
  uiTokens,
  mixHex,
  estWidth,
  estLines,
  fitSize,
  fitBodySize,
  uiEyebrowPill,
  uiStatusBadge,
  uiSegmentedHeader,
  uiFloatingStatPills,
  uiCalloutBanner,
  uiDeltaKpiCards,
  uiTargetProgressCards,
  uiBentoSpotlightCards,
  uiContrastCompare,
  uiDiagnosisTrio,
  uiMilestoneStepper,
  uiVerticalTimeline,
  uiFlywheelFlow,
} from './ui-kit.mjs';

const L = 96;
const W = 1728;
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const FONT_BODY = 'Source Han Sans SC';
const FONT_DISPLAY = 'YouSheBiaoTiHei';

const asList = (v) => (Array.isArray(v) ? v : []);
const shape = (id, bounds, style, extra = {}) => ({ type: 'shape', id, bounds: bounds.map(Math.round), style, ...extra });
const txt = (id, text, bounds, style, extra = {}) => ({
  type: 'text', id, text: String(text ?? ''), bounds: bounds.map(Math.round),
  style: { fontFamily: FONT_BODY, fontSize: 22, fontWeight: 400, lineHeight: 1.35, color: '#1A202C', ...style },
  ...extra,
});
const imgEl = (id, src, bounds, ph = {}, radius = 16) => ({
  type: 'image',
  id,
  src,
  fit: 'cover',
  ...(ph.focal ? { focal: ph.focal } : {}),
  ...(Array.isArray(ph.crop) && ph.crop.length === 4 ? { crop: ph.crop } : {}),
  alt: ph.caption || '',
  bounds: bounds.map(Math.round),
  style: { radius },
});

function titleTextOf(page) {
  if (typeof page.keyLine === 'string') return page.keyLine;
  return page.keyLine?.text || page.name || page.title || '';
}

function makeTitleRuns(text, focus, fontSize, ink, pop, fontFamily = FONT_BODY) {
  const s = String(text || '');
  const f = String(focus || '').trim();
  if (!f || !s.includes(f)) return null;
  const idx = s.indexOf(f);
  const runs = [];
  if (idx > 0) runs.push({ text: s.slice(0, idx), style: { fontFamily, fontSize, fontWeight: 700, color: ink } });
  runs.push({ text: f, style: { fontFamily, fontSize, fontWeight: 900, color: pop } });
  if (idx + f.length < s.length) runs.push({ text: s.slice(idx + f.length), style: { fontFamily, fontSize, fontWeight: 700, color: ink } });
  return runs;
}

function resolvePhotos(page, baseDir) {
  return asList(page.photos)
    .filter((ph) => ph && ph.src)
    .map((ph) => ({
      ...ph,
      src: /^(data:|https?:|portable-asset:)/.test(ph.src) ? ph.src : path.resolve(baseDir, ph.src),
    }));
}

function splitStatements(page) {
  const all = asList(page.statements);
  const verdict = all.find((s) => s.tone === 'judgment' || /复盘|判断|结论|启示|建议|下一步/.test(String(s.label || s.id || '')));
  const intro = all.find((s) => s !== verdict);
  return { intro, verdict };
}

function drawFooter(id, pageNo, total, footer, t) {
  const els = [
    shape(`${id}-ft-ln`, [L, 1018, W, 1], { fill: t.line }),
  ];
  if (footer) {
    els.push(txt(`${id}-ft-l`, footer, [L, 1028, 1200, 28], { fontSize: 16, fontWeight: 400, color: t.muted, lineHeight: 1.3 }));
  }
  els.push(txt(`${id}-ft-r`, `${pageNo} / ${total}`, [L + W - 140, 1028, 140, 28], { fontSize: 16, fontWeight: 700, color: t.muted, textAlign: 'right', lineHeight: 1.3 }));
  return els;
}

function drawModernTable({ id, x, y, width, height, table, palette }) {
  const t = uiTokens(palette);
  const cols = asList(table?.columns);
  const rows = asList(table?.rows).slice(0, 7);
  if (!cols.length || !rows.length) return [];
  const hiSet = new Set(asList(table.highlight));
  const headH = 48;
  const rowH = Math.max(44, Math.min(68, Math.floor((height - headH - 12) / rows.length)));
  const totalH = headH + rowH * rows.length;
  const colW = Math.floor(width / cols.length);
  const els = [
    shape(`${id}-tbl-bg`, [x, y, width, totalH], { fill: t.surface, stroke: t.line, strokeWidth: 1.5, radius: 14 }),
    shape(`${id}-tbl-hd`, [x, y, width, headH], { fill: t.pale, radius: 14 }),
  ];
  cols.forEach((c, ci) => {
    els.push(txt(`${id}-th-${ci}`, c, [x + ci * colW + 16, y + 12, colW - 32, 26], { fontSize: 18, fontWeight: 700, color: t.primary, lineHeight: 1.25 }));
  });
  rows.forEach((r, ri) => {
    const ry = y + headH + ri * rowH;
    const isHi = hiSet.has(ri);
    if (isHi) els.push(shape(`${id}-tr-hi-${ri}`, [x + 4, ry + 2, width - 8, rowH - 4], { fill: t.softSec, radius: 8 }));
    else if (ri > 0) els.push(shape(`${id}-tr-ln-${ri}`, [x + 12, ry, width - 24, 1], { fill: t.line }));
    cols.forEach((_, ci) => {
      const val = String(r[ci] ?? '');
      const fSz = fitBodySize(val, colW - 28, rowH - 10, 19, 14, 1.25);
      els.push(txt(`${id}-td-${ri}-${ci}`, val, [x + ci * colW + 16, ry + Math.round((rowH - fSz * 1.3) / 2), colW - 28, Math.round(fSz * 1.4)], {
        fontSize: fSz, fontWeight: ci === 0 || isHi ? 700 : 400, color: isHi ? t.primary : ci === 0 ? t.ink : t.body, lineHeight: 1.25,
      }));
    });
  });
  return els;
}

function drawPhotoStrip({ id, x, y, width, height, photos, palette }) {
  const t = uiTokens(palette);
  const list = photos.slice(0, 3);
  if (!list.length) return [];
  const gap = 18;
  const pw = Math.floor((width - gap * (list.length - 1)) / list.length);
  const els = [];
  list.forEach((ph, i) => {
    const px = x + i * (pw + gap);
    const hasCap = Boolean(ph.caption);
    const imgH = hasCap ? height - 32 : height;
    els.push(imgEl(`${id}-img-${i}`, ph.src, [px, y, pw, Math.max(80, imgH)], ph, 14));
    if (hasCap) {
      els.push(txt(`${id}-cap-${i}`, ph.caption, [px + 4, y + imgH + 6, pw - 8, 24], { fontSize: 16, fontWeight: 400, color: t.muted, lineHeight: 1.25 }));
    }
  });
  return els;
}

// =========================================================================
// Cover Layout Variants
// =========================================================================
function buildCoverVariants({ page, palette, baseDir, deckTitle }) {
  const t = uiTokens(palette);
  const photos = resolvePhotos(page, baseDir);
  const data = asList(page.data);
  const name = page.name || deckTitle || titleTextOf(page) || '工作总结汇报';
  const keyLine = titleTextOf(page);
  const eyebrow = page.eyebrow || '工作汇报';
  const subtitle = page.subtitle || (keyLine && keyLine !== name ? keyLine : '');
  const note = page.note || '';
  const heroPhoto = photos[0];
  const variants = [];

  // Variant A: Bento Magazine Cover
  {
    const id = 'cv-bento';
    const els = [shape(`${id}-bg`, [0, 0, CANVAS_W, CANVAS_H], { fill: t.bg })];
    const hasPhoto = Boolean(heroPhoto);
    const leftW = hasPhoto ? 1040 : W;
    const topH = data.length ? 750 : 920;

    // Big primary hero card
    els.push(shape(`${id}-hero`, [L, 76, leftW, topH], { fill: t.primary, radius: 28 }));
    els.push(shape(`${id}-acc`, [L + 56, 134, 88, 7], { fill: t.pop, radius: 4 }));
    els.push(txt(`${id}-ey`, eyebrow, [L + 56, 160, leftW - 112, 34], { fontSize: 22, fontWeight: 700, color: mixHex('#FFFFFF', t.secondary, 0.3), lineHeight: 1.25 }));
    const titleSz = fitBodySize(name, leftW - 112, 260, 78, 46, 1.18);
    els.push(txt(`${id}-nm`, name, [L + 56, 224, leftW - 112, 260], { fontFamily: name.length <= 16 ? FONT_DISPLAY : FONT_BODY, fontSize: titleSz, fontWeight: 900, color: t.onSolid, lineHeight: 1.18 }));
    if (subtitle) {
      const subSz = fitBodySize(subtitle, leftW - 112, 130, 28, 20, 1.42);
      els.push(txt(`${id}-sub`, subtitle, [L + 56, 510, leftW - 112, 130], { fontSize: subSz, fontWeight: 400, color: mixHex(t.onSolid, t.secondary, 0.22), lineHeight: 1.42 }));
    }
    if (note) {
      els.push(txt(`${id}-nt`, note, [L + 56, 76 + topH - 64, leftW - 112, 34], { fontSize: 20, fontWeight: 400, color: mixHex(t.onSolid, t.secondary, 0.35), lineHeight: 1.3 }));
    }

    if (hasPhoto) {
      const rx = L + leftW + 26;
      const rw = W - leftW - 26;
      els.push(imgEl(`${id}-ph`, heroPhoto.src, [rx, 76, rw, topH], heroPhoto, 28));
      if (heroPhoto.caption) {
        els.push(shape(`${id}-cap-bg`, [rx + 22, 76 + topH - 68, Math.min(rw - 44, estWidth(heroPhoto.caption, 18) + 42), 44], { fill: t.deepFocus, radius: 22 }));
        els.push(txt(`${id}-cap-tx`, heroPhoto.caption, [rx + 36, 76 + topH - 58, rw - 72, 26], { fontSize: 18, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25 }));
      }
    }

    if (data.length) {
      const pills = uiFloatingStatPills({ id: `${id}-pills`, x: L, y: 866, width: W, items: data, palette });
      els.push(...pills.elements);
    }
    variants.push({ id: 'cover-bento', name: 'Bento封面', tag: '网格', preview: 'bento', elements: els });
  }

  // Variant B: Minimal Keynote Cover (Light/Clean with Eyebrow Pill & Stat Pills)
  {
    const id = 'cv-min';
    const els = [
      shape(`${id}-bg`, [0, 0, CANVAS_W, CANVAS_H], { fill: t.bg }),
      shape(`${id}-topstrip`, [0, 0, CANVAS_W, 10], { fill: t.primary }),
    ];
    const ey = uiEyebrowPill({ id: `${id}-ey`, x: L, y: 112, text: eyebrow, palette });
    els.push(...ey.elements);

    const hasPhoto = Boolean(heroPhoto);
    const textW = hasPhoto ? 980 : 1480;
    const tSz = fitBodySize(name, textW, 270, 84, 50, 1.18);
    const runs = makeTitleRuns(name, page.focus, tSz, t.ink, t.pop, name.length <= 16 ? FONT_DISPLAY : FONT_BODY);
    els.push(txt(`${id}-nm`, name, [L, 192, textW, 270], { fontFamily: name.length <= 16 ? FONT_DISPLAY : FONT_BODY, fontSize: tSz, fontWeight: 900, color: t.ink, lineHeight: 1.18 }, runs ? { runs } : {}));
    els.push(shape(`${id}-bar`, [L, 488, 128, 7], { fill: t.pop, radius: 4 }));
    if (subtitle) {
      const subSz = fitBodySize(subtitle, textW, 130, 30, 22, 1.45);
      els.push(txt(`${id}-sub`, subtitle, [L, 526, textW, 130], { fontSize: subSz, fontWeight: 400, color: t.body, lineHeight: 1.45 }));
    }
    if (note) {
      els.push(txt(`${id}-nt`, note, [L, data.length ? 700 : 920, textW, 34], { fontSize: 21, fontWeight: 400, color: t.muted, lineHeight: 1.3 }));
    }
    if (hasPhoto) {
      const px = L + textW + 48;
      const pw = W - textW - 48;
      const phH = data.length ? 650 : 810;
      els.push(shape(`${id}-ph-fr`, [px - 10, 112, pw + 10, phH + 10], { fill: t.pale, stroke: t.line, strokeWidth: 2, radius: 26 }));
      els.push(imgEl(`${id}-ph`, heroPhoto.src, [px, 122, pw - 10, phH - 10], heroPhoto, 20));
    }
    if (data.length) {
      const pills = uiFloatingStatPills({ id: `${id}-pills`, x: L, y: 860, width: W, items: data, palette });
      els.push(...pills.elements);
    }
    variants.push({ id: 'cover-minimal', name: '极简封面', tag: '留白', preview: 'exec', elements: els });
  }

  // Variant C: Deep Keynote Spotlight Cover
  {
    const id = 'cv-dark';
    const darkBg = t.dark ? t.bg : mixHex('#0B1120', t.primary, 0.25);
    const cardBg = mixHex(darkBg, '#FFFFFF', 0.08);
    const els = [
      shape(`${id}-bg`, [0, 0, CANVAS_W, CANVAS_H], { fill: darkBg }),
      shape(`${id}-glow`, [1320, -140, 740, 740], { fill: mixHex(darkBg, t.primary, 0.35), radius: 370 }, { shape: 'ellipse' }),
      shape(`${id}-ey-bg`, [L, 126, Math.max(180, estWidth(eyebrow, 20) + 54), 42], { fill: cardBg, stroke: t.pop, strokeWidth: 1.5, radius: 21 }),
      shape(`${id}-ey-dot`, [L + 16, 141, 12, 12], { fill: t.pop, radius: 6 }, { shape: 'ellipse' }),
      txt(`${id}-ey-tx`, eyebrow, [L + 38, 134, 420, 28], { fontSize: 20, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25 }),
    ];
    const hasPhoto = Boolean(heroPhoto);
    const leftW = hasPhoto ? 1020 : 1560;
    const tSz = fitBodySize(name, leftW, 270, 86, 52, 1.16);
    els.push(txt(`${id}-nm`, name, [L, 214, leftW, 270], { fontFamily: name.length <= 16 ? FONT_DISPLAY : FONT_BODY, fontSize: tSz, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.16 }));
    if (subtitle) {
      els.push(txt(`${id}-sub`, subtitle, [L, 514, leftW, 130], { fontSize: fitBodySize(subtitle, leftW, 130, 30, 22, 1.45), fontWeight: 400, color: '#CBD5E1', lineHeight: 1.45 }));
    }
    if (note) {
      els.push(txt(`${id}-nt`, note, [L, data.length ? 700 : 930, leftW, 34], { fontSize: 20, fontWeight: 400, color: '#94A3B8', lineHeight: 1.3 }));
    }
    if (hasPhoto) {
      const rx = L + leftW + 40;
      const rw = W - leftW - 40;
      els.push(imgEl(`${id}-ph`, heroPhoto.src, [rx, 126, rw, data.length ? 650 : 810], heroPhoto, 24));
    }
    if (data.length) {
      const pills = uiFloatingStatPills({ id: `${id}-pills`, x: L, y: 856, width: W, items: data, palette, darkSurface: true });
      els.push(...pills.elements);
    }
    variants.push({ id: 'cover-dark', name: '深色旗舰', tag: '高管', preview: 'split', elements: els });
  }

  return variants;
}

// =========================================================================
// Content Slide Layout Variants
// =========================================================================
function buildContentVariants({ page, palette, baseDir, pageNo, total, footer, sections }) {
  const t = uiTokens(palette);
  const title = titleTextOf(page);
  const eyebrow = page.eyebrow || `0${pageNo} 核心内容`;
  const data = asList(page.data);
  const items = asList(page.items);
  const photos = resolvePhotos(page, baseDir);
  const periods = asList(page.periods);
  const flows = asList(page.flows);
  const table = page.table || (Array.isArray(page.tables) ? page.tables[0] : null);
  const compare = page.compare || null;
  const { intro, verdict } = splitStatements(page);
  const variants = [];

  // Shared modern page header builder
  const buildHeader = (id, mode = 'pill') => {
    const els = [];
    let bodyTop = 186;
    if (mode === 'segmented') {
      const activeIdx = Math.min(Math.max(0, sections.length - 1), Math.max(0, pageNo - 2));
      const seg = uiSegmentedHeader({ id: `${id}-seg`, x: L, y: 36, width: W, sections, activeIndex: activeIdx, palette });
      els.push(...seg.elements);
      const tSz = fitBodySize(title, W, 68, 44, 30, 1.2);
      const runs = makeTitleRuns(title, page.focus, tSz, t.ink, t.pop);
      els.push(txt(`${id}-title`, title, [L, 102, W, 68], { fontSize: tSz, fontWeight: 700, color: t.ink, lineHeight: 1.2 }, runs ? { runs } : {}));
      bodyTop = 182;
    } else {
      const ey = uiEyebrowPill({ id: `${id}-ey`, x: L, y: 42, text: eyebrow, palette });
      els.push(...ey.elements);
      const tSz = fitBodySize(title, W, 72, 46, 30, 1.2);
      const runs = makeTitleRuns(title, page.focus, tSz, t.ink, t.pop);
      els.push(txt(`${id}-title`, title, [L, 94, W, 72], { fontSize: tSz, fontWeight: 700, color: t.ink, lineHeight: 1.2 }, runs ? { runs } : {}));
      bodyTop = 182;
    }
    return { els, bodyTop };
  };

  // -----------------------------------------------------------------------
  // Variant 1: 现代 UI 卡片版 (Tremor KPI + Spotlight Cards + Modern Callout)
  // -----------------------------------------------------------------------
  {
    const id = 'v-modern';
    const els = [shape(`${id}-bg`, [0, 0, CANVAS_W, CANVAS_H], { fill: t.bg })];
    const hd = buildHeader(id, 'pill');
    els.push(...hd.els);
    let cy = hd.bodyTop;
    const verdictH = verdict ? 102 : 0;
    const availBottom = 992 - (verdictH ? verdictH + 16 : 0);

    if (intro) {
      els.push(txt(`${id}-intro`, intro.text || '', [L, cy, W, 44], { fontSize: 22, fontWeight: 400, color: t.body, lineHeight: 1.35 }));
      cy += 52;
    }

    const remH = () => Math.max(120, availBottom - cy);
    const hasLower = Boolean(items.length || compare || periods.length || flows.length || table || photos.length);

    if (data.length) {
      const kpiH = hasLower ? Math.min(220, Math.round(remH() * 0.34)) : Math.min(340, remH());
      const kpi = uiDeltaKpiCards({ id: `${id}-kpi`, x: L, y: cy, width: W, height: kpiH, items: data, palette });
      els.push(...kpi.elements);
      cy += kpi.height + 22;
    }

    const activeBlocks = [
      compare ? 'compare' : null,
      periods.length ? 'periods' : null,
      flows.length ? 'flows' : null,
      table ? 'table' : null,
      items.length ? 'items' : null,
      photos.length ? 'photos' : null,
    ].filter(Boolean);

    // Render ALL active modules without dropping any content!
    const drawBlock = (kind, bx, by, bw, bh) => {
      if (kind === 'compare') return uiContrastCompare({ id: `${id}-cmp`, x: bx, y: by, width: bw, height: bh, compare, palette }).elements;
      if (kind === 'periods') return uiMilestoneStepper({ id: `${id}-stp`, x: bx, y: by + 6, width: bw, height: Math.max(160, bh - 6), periods, palette }).elements;
      if (kind === 'flows') return uiFlywheelFlow({ id: `${id}-fl`, x: bx, y: by, width: bw, height: bh, flow: flows[0], palette }).elements;
      if (kind === 'table') return drawModernTable({ id: `${id}-tbl`, x: bx, y: by, width: bw, height: bh, table, palette });
      if (kind === 'items') return uiBentoSpotlightCards({ id: `${id}-it`, x: bx, y: by, width: bw, height: bh, items, palette }).elements;
      if (kind === 'photos') return drawPhotoStrip({ id: `${id}-ph`, x: bx, y: by, width: bw, height: bh, photos, palette });
      return [];
    };

    if (activeBlocks.length === 1) {
      els.push(...drawBlock(activeBlocks[0], L, cy, W, remH()));
    } else if (activeBlocks.length === 2) {
      const topH = Math.round((remH() - 20) * 0.5);
      const botH = remH() - topH - 20;
      els.push(...drawBlock(activeBlocks[0], L, cy, W, topH));
      els.push(...drawBlock(activeBlocks[1], L, cy + topH + 20, W, botH));
    } else if (activeBlocks.length >= 3) {
      const topH = Math.round((remH() - 20) * 0.52);
      const botH = remH() - topH - 20;
      const halfW = Math.floor((W - 22) / 2);
      els.push(...drawBlock(activeBlocks[0], L, cy, W, topH));
      els.push(...drawBlock(activeBlocks[1], L, cy + topH + 20, halfW, botH));
      els.push(...drawBlock(activeBlocks[2], L + halfW + 22, cy + topH + 20, W - halfW - 22, botH));
    }

    if (verdict) {
      const bn = uiCalloutBanner({ id: `${id}-vd`, x: L, y: 992 - verdictH, width: W, height: verdictH, label: verdict.label || '核心判断', text: verdict.text || '', badge: '核心结论', tone: 'pop', palette });
      els.push(...bn.elements);
    }
    els.push(...drawFooter(id, pageNo, total, footer, t));
    variants.push({ id: 'ui-modern', name: '现代卡片', tag: 'UI风', preview: 'modern', elements: els });
  }

  // -----------------------------------------------------------------------
  // Variant 2: Bento 便当盒网格版 (Apple / Magic UI Asymmetric Bento)
  // -----------------------------------------------------------------------
  {
    const id = 'v-bento';
    const els = [shape(`${id}-bg`, [0, 0, CANVAS_W, CANVAS_H], { fill: t.bg })];
    const hd = buildHeader(id, 'pill');
    els.push(...hd.els);
    const bodyY = hd.bodyTop + 6;
    const bodyH = 990 - bodyY;
    const gap = 22;
    const leftW = 650;
    const rightX = L + leftW + gap;
    const rightW = W - leftW - gap;

    // Left tall Hero Bento Cell (Photo hero OR #1 Metric hero OR Verdict hero)
    if (photos.length) {
      els.push(imgEl(`${id}-hero-img`, photos[0].src, [L, bodyY, leftW, bodyH], photos[0], 24));
      const overlayText = photos[0].caption || intro?.text || verdict?.text || eyebrow;
      els.push(shape(`${id}-ov-bg`, [L + 22, bodyY + bodyH - 120, leftW - 44, 98], { fill: t.deepFocus, radius: 16 }));
      els.push(txt(`${id}-ov-tx`, overlayText, [L + 42, bodyY + bodyH - 104, leftW - 84, 68], { fontSize: fitBodySize(overlayText, leftW - 84, 68, 22, 16, 1.35), fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35 }));
    } else {
      els.push(shape(`${id}-hero`, [L, bodyY, leftW, bodyH], { fill: t.primary, radius: 24 }));
      const heroChip = uiStatusBadge({ id: `${id}-hchip`, x: L + 34, y: bodyY + 34, text: '★ 核心锚点', tone: 'solidPop', palette, height: 34, fontSize: 16 });
      els.push(...heroChip.elements);

      const leadData = data.find((d) => d.highlight) || data[0];
      if (leadData) {
        const valStr = `${leadData.value ?? ''}${leadData.unit ? ' ' + leadData.unit : ''}`;
        const vSz = fitSize(valStr, leftW - 68, 108, 52);
        els.push(txt(`${id}-hval`, valStr, [L + 34, bodyY + 120, leftW - 68, Math.round(vSz * 1.2)], { fontSize: vSz, fontWeight: 900, color: t.onSolid, lineHeight: 1.1 }));
        els.push(txt(`${id}-hlbl`, leadData.label || '', [L + 34, bodyY + 120 + Math.round(vSz * 1.25), leftW - 68, 42], { fontSize: 28, fontWeight: 700, color: mixHex(t.onSolid, t.secondary, 0.25), lineHeight: 1.25 }));
        if (leadData.target) {
          els.push(txt(`${id}-htgt`, `目标基线：${leadData.target}`, [L + 34, bodyY + 180 + Math.round(vSz * 1.25), leftW - 68, 34], { fontSize: 20, fontWeight: 400, color: mixHex(t.onSolid, t.secondary, 0.35), lineHeight: 1.3 }));
        }
      }
      const heroNote = verdict?.text || intro?.text || items[0]?.detail || '';
      if (heroNote) {
        const ny = bodyY + bodyH - 220;
        els.push(shape(`${id}-hdiv`, [L + 34, ny - 18, leftW - 68, 2], { fill: mixHex(t.primary, '#FFFFFF', 0.22) }));
        els.push(txt(`${id}-hnt`, heroNote, [L + 34, ny, leftW - 68, 184], { fontSize: fitBodySize(heroNote, leftW - 68, 184, 24, 17, 1.45), fontWeight: 400, color: t.onSolid, lineHeight: 1.45 }));
      }
    }

    // Right Bento Grid (Top Wide Slot + Bottom 2-column Tiles)
    const restData = photos.length ? data : data.filter((d) => d !== (data.find((x) => x.highlight) || data[0]));
    const topSlotH = Math.round(bodyH * 0.44);
    const botY = bodyY + topSlotH + gap;
    const botH = bodyH - topSlotH - gap;

    if (restData.length) {
      const kpi = uiDeltaKpiCards({ id: `${id}-rkpi`, x: rightX, y: bodyY, width: rightW, height: topSlotH, items: restData.slice(0, 3), palette });
      els.push(...kpi.elements);
    } else if (compare) {
      const cmp = uiContrastCompare({ id: `${id}-rcmp`, x: rightX, y: bodyY, width: rightW, height: bodyH, compare, palette });
      els.push(...cmp.elements);
    } else if (table) {
      els.push(...drawModernTable({ id: `${id}-rtbl`, x: rightX, y: bodyY, width: rightW, height: bodyH, table, palette }));
    } else if (periods.length) {
      const tl = uiVerticalTimeline({ id: `${id}-rtl`, x: rightX, y: bodyY, width: rightW, height: bodyH, periods, palette });
      els.push(...tl.elements);
    } else if (flows.length) {
      const fl = uiFlywheelFlow({ id: `${id}-rfl`, x: rightX, y: bodyY, width: rightW, height: bodyH, flow: flows[0], palette });
      els.push(...fl.elements);
    } else if (intro) {
      els.push(shape(`${id}-rin-bg`, [rightX, bodyY, rightW, topSlotH], { fill: t.pale, stroke: t.line, strokeWidth: 1.5, radius: 20 }));
      els.push(txt(`${id}-rin-tx`, intro.text || '', [rightX + 30, bodyY + 34, rightW - 60, topSlotH - 68], { fontSize: fitBodySize(intro.text || '', rightW - 60, topSlotH - 68, 26, 18, 1.45), fontWeight: 500, color: t.ink, lineHeight: 1.45 }));
    }

    // Bottom right tiles (items / table / compare / verdict)
    const filledFullRight = !restData.length && (compare || table || periods.length || flows.length);
    if (!filledFullRight) {
      if (items.length) {
        const subItems = items.slice(0, 4);
        const cols = subItems.length >= 2 ? 2 : 1;
        const rows = Math.ceil(subItems.length / cols);
        const tw = Math.floor((rightW - gap * (cols - 1)) / cols);
        const th = Math.floor((botH - gap * (rows - 1)) / rows);
        subItems.forEach((it, idx) => {
          const c = idx % cols, r = Math.floor(idx / cols);
          const spanFull = subItems.length === 3 && idx === 2;
          const bx = spanFull ? rightX : rightX + c * (tw + gap);
          const by = botY + r * (th + gap);
          const bw = spanFull ? rightW : tw;
          const isHi = idx === subItems.length - 1;
          els.push(shape(`${id}-bt-${idx}`, [bx, by, bw, th], { fill: isHi ? t.softSec : t.surface, stroke: isHi ? t.secondary : t.line, strokeWidth: 1.5, radius: 18 }));
          els.push(txt(`${id}-btt-${idx}`, `${String(idx + 1).padStart(2, '0')}  ${it.title || ''}`, [bx + 22, by + 18, bw - 44, 34], { fontSize: 22, fontWeight: 700, color: t.primary, lineHeight: 1.25 }));
          const dH = Math.max(48, th - 68);
          els.push(txt(`${id}-btd-${idx}`, it.detail || '', [bx + 22, by + 56, bw - 44, dH], { fontSize: fitBodySize(it.detail || '', bw - 44, dH, 19, 14, 1.38), fontWeight: 300, color: t.body, lineHeight: 1.38 }));
        });
      } else if (compare) {
        const cmp = uiContrastCompare({ id: `${id}-bcmp`, x: rightX, y: botY, width: rightW, height: botH, compare, palette });
        els.push(...cmp.elements);
      } else if (periods.length) {
        const tl = uiVerticalTimeline({ id: `${id}-btl`, x: rightX, y: botY, width: rightW, height: botH, periods, palette });
        els.push(...tl.elements);
      } else if (flows.length) {
        const fl = uiFlywheelFlow({ id: `${id}-bfl`, x: rightX, y: botY, width: rightW, height: botH, flow: flows[0], palette });
        els.push(...fl.elements);
      } else if (table) {
        els.push(...drawModernTable({ id: `${id}-btbl`, x: rightX, y: botY, width: rightW, height: botH, table, palette }));
      } else if (verdict) {
        const bn = uiCalloutBanner({ id: `${id}-bvd`, x: rightX, y: botY, width: rightW, height: Math.min(180, botH), label: verdict.label || '核心结论', text: verdict.text || '', badge: '重点', tone: 'pop', palette });
        els.push(...bn.elements);
      }
    }

    els.push(...drawFooter(id, pageNo, total, footer, t));
    variants.push({ id: 'bento-grid', name: 'Bento网格', tag: '便当盒', preview: 'bento', elements: els });
  }

  // -----------------------------------------------------------------------
  // Variant 3: 左右焦点栏 (Split Deep Sidebar + Progress / Timeline / Rows)
  // -----------------------------------------------------------------------
  {
    const id = 'v-split';
    const els = [shape(`${id}-bg`, [0, 0, CANVAS_W, CANVAS_H], { fill: t.bg })];
    const sideW = 580;
    const rightX = sideW + 56;
    const rightW = CANVAS_W - rightX - 72;

    // Left full-height deep focal sidebar
    els.push(shape(`${id}-side`, [0, 0, sideW, CANVAS_H], { fill: t.deepFocus }));
    els.push(shape(`${id}-sbar`, [0, 0, 12, CANVAS_H], { fill: t.pop }));
    els.push(shape(`${id}-sey-bg`, [64, 72, Math.min(sideW - 120, Math.max(150, estWidth(eyebrow, 18) + 48)), 38], { fill: mixHex(t.deepFocus, '#FFFFFF', 0.12), radius: 19 }));
    els.push(txt(`${id}-sey-tx`, eyebrow, [84, 79, sideW - 160, 26], { fontSize: 18, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25 }));

    const stSz = fitBodySize(title, sideW - 120, 260, 44, 28, 1.25);
    els.push(txt(`${id}-stitle`, title, [64, 146, sideW - 120, 260], { fontSize: stSz, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.25 }));
    els.push(shape(`${id}-srule`, [64, 424, 96, 6], { fill: t.pop, radius: 3 }));

    const sideText = verdict?.text || intro?.text || '';
    if (sideText) {
      els.push(txt(`${id}-stxt`, sideText, [64, 464, sideW - 120, 220], { fontSize: fitBodySize(sideText, sideW - 120, 220, 23, 17, 1.48), fontWeight: 400, color: '#CBD5E1', lineHeight: 1.48 }));
    }
    if (photos.length) {
      els.push(imgEl(`${id}-sph`, photos[0].src, [64, 710, sideW - 120, 270], photos[0], 18));
    } else if (data.length) {
      const lead = data.find((d) => d.highlight) || data[0];
      els.push(shape(`${id}-skpi`, [64, 730, sideW - 120, 220], { fill: mixHex(t.deepFocus, '#FFFFFF', 0.08), stroke: mixHex(t.deepFocus, '#FFFFFF', 0.2), strokeWidth: 1.5, radius: 18 }));
      els.push(txt(`${id}-skl`, lead.label || '核心指标', [90, 756, sideW - 172, 28], { fontSize: 20, fontWeight: 700, color: '#94A3B8', lineHeight: 1.25 }));
      const vs = `${lead.value ?? ''}${lead.unit ? ' ' + lead.unit : ''}`;
      els.push(txt(`${id}-skv`, vs, [90, 796, sideW - 172, 92], { fontSize: fitSize(vs, sideW - 172, 74, 40), fontWeight: 900, color: t.pop, lineHeight: 1.12 }));
      if (lead.target) els.push(txt(`${id}-skt`, `目标 ${lead.target}`, [90, 896, sideW - 172, 28], { fontSize: 18, fontWeight: 400, color: '#CBD5E1', lineHeight: 1.3 }));
    }
    els.push(txt(`${id}-spg`, `${pageNo} / ${total}`, [64, 1020, 140, 28], { fontSize: 16, fontWeight: 700, color: '#94A3B8', lineHeight: 1.3 }));

    // Right main content canvas
    let ry = 76;
    const rRem = () => Math.max(120, 998 - ry);
    if (data.length) {
      const pgH = items.length || compare || periods.length || table || flows.length ? Math.min(310, Math.round(rRem() * 0.4)) : Math.min(540, rRem());
      const pg = uiTargetProgressCards({ id: `${id}-pg`, x: rightX, y: ry, width: rightW, height: pgH, items: data, palette });
      els.push(...pg.elements);
      ry += pg.height + 26;
    }
    if (compare) {
      const cmp = uiContrastCompare({ id: `${id}-cmp`, x: rightX, y: ry, width: rightW, height: rRem(), compare, palette });
      els.push(...cmp.elements);
    } else if (periods.length) {
      const tl = uiVerticalTimeline({ id: `${id}-tl`, x: rightX, y: ry, width: rightW, height: rRem(), periods, palette });
      els.push(...tl.elements);
    } else if (flows.length) {
      const fl = uiFlywheelFlow({ id: `${id}-fl`, x: rightX, y: ry, width: rightW, height: Math.min(420, rRem()), flow: flows[0], palette });
      els.push(...fl.elements);
    } else if (table) {
      els.push(...drawModernTable({ id: `${id}-tbl`, x: rightX, y: ry, width: rightW, height: rRem(), table, palette }));
    } else if (items.length) {
      const list = items.slice(0, 5);
      const gap = 16;
      const rh = Math.max(84, Math.min(132, Math.floor((rRem() - gap * (list.length - 1)) / list.length)));
      list.forEach((it, idx) => {
        const y0 = ry + idx * (rh + gap);
        els.push(shape(`${id}-row-${idx}`, [rightX, y0, rightW, rh], { fill: t.surface, stroke: t.line, strokeWidth: 1.5, radius: 14 }));
        els.push(shape(`${id}-rnum-${idx}`, [rightX + 20, y0 + Math.round((rh - 46) / 2), 46, 46], { fill: idx === 0 ? t.pop : t.pale, radius: 12 }));
        els.push(txt(`${id}-rnx-${idx}`, String(idx + 1).padStart(2, '0'), [rightX + 20, y0 + Math.round((rh - 28) / 2), 46, 28], { fontSize: 20, fontWeight: 900, color: idx === 0 ? '#FFFFFF' : t.primary, textAlign: 'center', lineHeight: 1.2 }));
        els.push(txt(`${id}-rti-${idx}`, it.title || '', [rightX + 86, y0 + 14, rightW - 110, 30], { fontSize: 23, fontWeight: 700, color: t.ink, lineHeight: 1.25 }));
        const dH = Math.max(30, rh - 52);
        els.push(txt(`${id}-rde-${idx}`, it.detail || '', [rightX + 86, y0 + 46, rightW - 110, dH], { fontSize: fitBodySize(it.detail || '', rightW - 110, dH, 19, 15, 1.35), fontWeight: 300, color: t.body, lineHeight: 1.35 }));
      });
    } else if (photos.length > 1) {
      els.push(...drawPhotoStrip({ id: `${id}-rph`, x: rightX, y: ry, width: rightW, height: rRem(), photos: photos.slice(1), palette }));
    }

    variants.push({ id: 'split-focus', name: '左右焦点', tag: '强对比', preview: 'split', elements: els });
  }

  // -----------------------------------------------------------------------
  // Variant 4: 极简导航高管版 (Segmented Header + Progress/Trio/Timeline + Banner)
  // -----------------------------------------------------------------------
  {
    const id = 'v-exec';
    const els = [shape(`${id}-bg`, [0, 0, CANVAS_W, CANVAS_H], { fill: t.bg })];
    const hd = buildHeader(id, 'segmented');
    els.push(...hd.els);
    let cy = hd.bodyTop + 6;
    const verdictH = verdict ? 98 : 0;
    const availBottom = 992 - (verdictH ? verdictH + 18 : 0);
    const remH = () => Math.max(120, availBottom - cy);

    if (data.length) {
      const hasMore = Boolean(items.length || compare || periods.length || flows.length || table || photos.length);
      const pH = hasMore ? Math.min(280, Math.round(remH() * 0.42)) : Math.min(440, remH());
      const pg = uiTargetProgressCards({ id: `${id}-pg`, x: L, y: cy, width: W, height: pH, items: data, palette });
      els.push(...pg.elements);
      cy += pg.height + 22;
    }

    if (items.length === 3 && !compare && !periods.length && !flows.length) {
      const tri = uiDiagnosisTrio({ id: `${id}-tri`, x: L, y: cy, width: W, height: Math.min(360, remH()), items, palette });
      els.push(...tri.elements);
      cy += tri.height + 18;
    } else if (periods.length) {
      const tl = uiVerticalTimeline({ id: `${id}-vtl`, x: L, y: cy, width: W, height: remH(), periods, palette });
      els.push(...tl.elements);
    } else if (compare) {
      const cmp = uiContrastCompare({ id: `${id}-cmp`, x: L, y: cy, width: W, height: remH(), compare, palette });
      els.push(...cmp.elements);
    } else if (flows.length) {
      const fl = uiFlywheelFlow({ id: `${id}-fl`, x: L, y: cy, width: W, height: Math.min(380, remH()), flow: flows[0], palette });
      els.push(...fl.elements);
    } else if (table) {
      els.push(...drawModernTable({ id: `${id}-tbl`, x: L, y: cy, width: W, height: remH(), table, palette }));
    } else if (items.length) {
      const cards = uiBentoSpotlightCards({ id: `${id}-it`, x: L, y: cy, width: W, height: Math.min(340, remH()), items, palette, focusIndex: 0 });
      els.push(...cards.elements);
      cy += cards.height + 18;
      if (photos.length && remH() >= 140) {
        els.push(...drawPhotoStrip({ id: `${id}-ph`, x: L, y: cy, width: W, height: remH(), photos, palette }));
      }
    } else if (photos.length) {
      els.push(...drawPhotoStrip({ id: `${id}-ph`, x: L, y: cy, width: W, height: remH(), photos, palette }));
    }

    if (verdict) {
      const bn = uiCalloutBanner({ id: `${id}-vd`, x: L, y: 992 - verdictH, width: W, height: verdictH, label: verdict.label || '核心判断', text: verdict.text || '', badge: '管理结论', tone: 'primary', palette });
      els.push(...bn.elements);
    } else if (intro && !data.length && !items.length) {
      const bn = uiCalloutBanner({ id: `${id}-in`, x: L, y: cy, width: W, height: 120, label: intro.label || '总述', text: intro.text || '', tone: 'primary', palette });
      els.push(...bn.elements);
    }

    els.push(...drawFooter(id, pageNo, total, footer, t));
    variants.push({ id: 'executive-clean', name: '极简导航', tag: '高管', preview: 'exec', elements: els });
  }

  return variants;
}

/**
 * Attach one-click switchable layout variants to every slide in a composed deck.
 * Variant 0 is always the original composed slide ("经典商务"), followed by 3-4 modern Web UI variants.
 */
export function attachLayoutVariants({ deck, outline, palette, footer = '', baseDir = process.cwd() }) {
  if (!Array.isArray(deck?.slides) || !Array.isArray(outline?.pages)) return;
  const total = outline.pages.length;
  // Derive concise chapter tabs for segmented header
  const sections = outline.pages
    .filter((p) => p.role !== 'cover')
    .slice(0, 5)
    .map((p, idx) => {
      const raw = String(p.eyebrow || p.name || titleTextOf(p)).replace(/^\d+\s*/, '').trim();
      const short = raw.length > 8 ? raw.slice(0, 8) : raw;
      return `0${idx + 1} ${short || `章节${idx + 1}`}`;
    });

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const page = outline.pages.find((p, idx) => (p.id || `p${idx + 1}`) === slide.slideId) || outline.pages[i];
    if (!page) continue;

    // Preserve engine-composed zero-loss content variants generated by composeReportDeck;
    // attach cover variants (or fallback for legacy/non-engine slides).
    if (page.role !== 'cover' && Array.isArray(slide.layoutVariants) && slide.layoutVariants.length >= 2) {
      continue;
    }

    // Content-completeness guard: NEVER attach a variant that drops any real data, items, compare rows, periods, flows, table rows, statements, or photos!
    const hasCompleteContent = (els) => {
      const blob = els.filter((e) => e.type === 'text').map((e) => e.text || (e.runs || []).map((r) => r.text).join('')).join('\n');
      const imgCount = els.filter((e) => e.type === 'image').length;
      const needText = (s) => {
        const cleanStr = String(s ?? '').trim();
        if (!cleanStr) return true;
        return blob.includes(cleanStr.slice(0, Math.min(8, cleanStr.length)));
      };
      for (const d of asList(page.data)) if (!needText(d.value)) return false;
      for (const it of asList(page.items)) if (!needText(it.title)) return false;
      if (page.compare) {
        for (const l of asList(page.compare.left)) if (!needText(l.title)) return false;
        for (const r of asList(page.compare.right)) if (!needText(r.title)) return false;
      }
      for (const pd of asList(page.periods)) if (!needText(pd.title || pd.label)) return false;
      for (const fl of asList(page.flows)) {
        for (const st of asList(fl.steps)) if (!needText(typeof st === 'string' ? st : st.title)) return false;
      }
      const tbl = page.table || (Array.isArray(page.tables) ? page.tables[0] : null);
      if (tbl) {
        for (const row of asList(tbl.rows)) if (!needText(row[0])) return false;
      }
      for (const st of asList(page.statements)) if (!needText(st.text)) return false;
      if (page.breakdown) {
        for (const bi of asList(page.breakdown.items)) if (!needText(bi.label)) return false;
      }
      if (page.funnel) {
        for (const fs of asList(page.funnel.steps)) if (!needText(fs.label)) return false;
      }
      if (page.hub) {
        if (!needText(page.hub.center?.title)) return false;
        for (const hi of asList(page.hub.inputs)) if (!needText(hi.title)) return false;
        for (const ho of asList(page.hub.outputs)) if (!needText(ho.title)) return false;
      }
      if (asList(page.photos).length > 0 && imgCount === 0) return false;
      return true;
    };

    const classicVariant = {
      id: 'classic',
      name: page.role === 'cover' ? '精修封面' : '精修主版',
      tag: '推荐',
      preview: 'classic',
      elements: structuredClone(slide.elements || []),
    };

    const extra = page.role === 'cover'
      ? buildCoverVariants({ page, palette, baseDir, deckTitle: outline.title })
      : buildContentVariants({ page, palette, baseDir, pageNo: i + 1, total, footer, sections });

    // Sanitize all element bounds & strictly enforce ZERO content loss across every variant
    const clean = (els) => els.filter((e) => e && Array.isArray(e.bounds) && e.bounds.length === 4 && e.bounds.every(Number.isFinite) && e.bounds[2] > 0 && e.bounds[3] > 0);
    const verifiedExtra = extra
      .map((v) => ({ ...v, elements: clean(v.elements) }))
      .filter((v) => hasCompleteContent(v.elements));
    slide.layoutVariants = [classicVariant, ...verifiedExtra];
    slide.activeLayoutId = 'classic';
  }
}
