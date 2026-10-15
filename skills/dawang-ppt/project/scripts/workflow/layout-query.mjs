// @ts-check
// layout-query 域:按 role/关键词/媒体需求筛选并打分候选版式(listLayouts 的实现)。
import {
  THEME_PAGES,
  isBodyContentCandidate,
  isCoverCandidate,
} from './theme-registry.mjs';
import {
  isWritableMediaSlot,
  mediaSlotsCanFit,
  normalizeMediaKind,
  slotAcceptsKind,
} from './media-slots.mjs';
import {
  ROLE_KEYWORDS,
  hasAmbientBackground,
  inspectLayout,
  pageMatches,
  pageSearchText,
} from './inspect-fillplan.mjs';

const ROLE_ALIASES = {
  agenda: 'breakdown',
  summary: 'statement',
  insight: 'observation',
  quote: 'observation',
  // 批测实证的直觉词(codex 多轮使用未命中):映射到最接近的既有 role。
  numbers: 'metrics',
  section: 'transition',
  chapter: 'transition',
  list: 'breakdown',
  product: 'case',
  feature: 'case',
  faq: 'risks',
  content: 'content',
  body: 'content',
  main: 'content',
  inner: 'content',
  interior: 'content',
  '正文': 'content',
  '内容': 'content',
  '主体': 'content',
  '内页': 'content',
  chart: 'metrics',
  timeline: 'trend',
  compare: 'comparison',
  flow: 'process',
  roadmap: 'actions',
  visual: 'image',
  gallery: 'image',
  media: 'image',
  picture: 'image',
  photo: 'image',
  atmosphere: 'ambient',
  background: 'ambient',
  dynamic: 'ambient',
};

/** @param {import('../../src/types').ListLayoutsOptions} [options] */
export function listLayouts({
  theme,
  role,
  keyword,
  needsMedia = false,
  plannedImages = false,
  providedImages = false,
  providedMedia = false,
  imageGen = false,
  needsVisual = false,
  mediaCount = null,
  mediaKind = null,
  requireInitialMedia = false,
  limit = 12,
  seed = null,
} = {}) {
  const requestedRole = role ? String(role).trim().toLowerCase() : '';
  const normalizedRole = requestedRole ? ROLE_ALIASES[requestedRole] || requestedRole : '';
  const keywords = normalizedRole ? ROLE_KEYWORDS[normalizedRole] || [normalizedRole] : [];
  const keywordText = String(keyword || '').trim().toLowerCase();
  const requestedMediaCount = getRequestedMediaCount({ plannedImages, providedImages, providedMedia, imageGen, needsVisual, mediaCount });
  const normalizedMediaKind = normalizeMediaKind(mediaKind);
  const needsInitialMedia = Boolean(requireInitialMedia || providedImages || providedMedia);
  const requiresMedia = needsMedia || requestedMediaCount > 0 || normalizedRole === 'image' || needsInitialMedia || Boolean(normalizedMediaKind);

  const rows = listLayoutsForMediaCount({ theme, normalizedRole, keywords, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia, seed });
  return rows.slice(0, Math.max(1, Math.min(50, Number(limit) || 12)));
}

function listLayoutsForMediaCount({ theme, normalizedRole, keywords, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia, seed }) {
  const rows = THEME_PAGES
    .filter(page => !theme || page.themeKey === theme)
    .filter(page => {
      if (!normalizedRole) return true;
      if (normalizedRole === 'cover') return isCoverCandidate(page.key);
      if (normalizedRole === 'content') return isBodyContentCandidate(page);
      if (normalizedRole === 'image') return inspectLayout(page.key, { compact: true })?.mediaSlots.some(slot => slot.canPresetMedia);
      if (normalizedRole === 'ambient') return hasAmbientBackground(page);
      return pageMatches(page, keywords);
    })
    .filter(page => !keywordText || pageSearchText(page).includes(keywordText))
    .map(page => compactLayoutCandidate(inspectLayout(page.key, { compact: true })))
    .filter(Boolean)
    .filter(row => !requiresMedia || mediaSlotsCanFit(row.mediaSlots, requestedMediaCount || 1, { requireInitialMedia: true, mediaKind: normalizedMediaKind }))
    .filter(row => !requestedMediaCount || mediaSlotsCanFit(row.mediaSlots, requestedMediaCount, { requireInitialMedia: true, mediaKind: normalizedMediaKind }))
    .filter(row => !normalizedMediaKind || mediaSlotsCanFit(row.mediaSlots, requestedMediaCount || 1, { requireInitialMedia: true, mediaKind: normalizedMediaKind }));

  // 同分候选用 seed 随机打散:打分只表达"是否更匹配",同等匹配的页面之间没有天然
  // 优先级。历史上并列项按页码稳定排序,所有调用方(Agent 与 goal:scaffold)都贪婪
  // 取列表最前,导致不同用户生成的 deck 大量选中同一批"前面的页",成片雷同。
  const tieBreakSeed = seed === null || seed === undefined || seed === '' ? String(Math.floor(Math.random() * 0xffffffff)) : String(seed);
  const scoreOf = row => scoreLayout(row, { normalizedRole, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia });
  return rows.sort((a, b) => {
    const diff = scoreOf(b) - scoreOf(a);
    if (diff !== 0) return diff;
    return hashSeed(`${tieBreakSeed}:${b.layout}`) - hashSeed(`${tieBreakSeed}:${a.layout}`);
  });
}

function compactLayoutCandidate(row) {
  if (!row) return row;
  const {
    copyBudgets,
    propShapes,
    fieldContracts,
    copyRoles,
    countBindings,
    defaultVisibleCounts,
    fillPlan,
    lengthBindings,
    themeDisplayName,
    themeScenario,
    themeAudience,
    ...candidate
  } = row;
  const copyKeys = (row.copyKeys || []).slice(0, 6);
  return {
    ...candidate,
    themeDisplayName,
    copyKeys,
    copyBudgets: compactCopyBudgets(row.copyBudgets, copyKeys),
    arrayMeta: (row.arrayMeta || []).map(compactCandidateArrayMeta),
    mediaSlots: (row.mediaSlots || []).map(compactQueryMediaSlot),
  };
}

function compactCopyBudgets(copyBudgets = {}, copyKeys = []) {
  return Object.fromEntries((copyKeys || [])
    .map(key => [key, copyBudgets?.[key]])
    .filter(([, budget]) => budget?.maxChars)
    .map(([key, budget]) => [key, { maxChars: budget.maxChars }]));
}

function compactCandidateArrayMeta(meta) {
  return {
    key: meta.key,
    role: meta.role,
    defaultVisibleCount: meta.defaultVisibleCount,
    maxCount: meta.maxCount,
    countKey: meta.countKey,
    maxFromKey: meta.maxFromKey,
    maxFromKeyOffset: meta.maxFromKeyOffset,
    maxByKey: meta.maxByKey,
    maxByValue: meta.maxByValue,
  };
}

function compactQueryMediaSlot(slot) {
  return {
    role: slot.role,
    field: slot.field,
    fieldPath: slot.fieldPath,
    writableProp: slot.writableProp,
    countKey: slot.countKey,
    publicCountKey: slot.publicCountKey || slot.countKey,
    defaultVisibleCount: slot.defaultVisibleCount,
    max: slot.max,
    maxFromKey: slot.maxFromKey,
    maxFromKeyOffset: slot.maxFromKeyOffset,
    maxByKey: slot.maxByKey,
    maxByValue: slot.maxByValue,
    maxCount: slot.maxCount,
    acceptedKinds: slot.acceptedKinds,
    acceptedKindsSource: slot.acceptedKindsSource,
    initialSrcSupported: slot.initialSrcSupported,
    canPresetMedia: slot.canPresetMedia,
    presetProp: slot.presetProp,
    emptySlotBehavior: slot.emptySlotBehavior,
  };
}

function compactCandidateFillPlan(plan) {
  return {
    arrays: (plan.arrays || []).slice(0, 4).map(item => ({
      key: item.key,
      role: item.role,
      visibleCount: item.visibleCount,
      maxCount: item.maxCount,
      countKey: item.countKey,
      ...(item.itemShape === 'string' ? { itemShape: item.itemShape } : {}),
      ...(item.item?.maxChars ? { item: item.item } : {}),
      ...(item.nestedArrays && Object.keys(item.nestedArrays).length ? { nestedArrays: item.nestedArrays } : {}),
    })),
    media: (plan.media || []).slice(0, 2),
  };
}

export function hashSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // FNV-1a 对仅末字符不同的 key(themeNN_page010/011…)雪崩不足,直接用会让"随机"
  // 顺序呈现大片连续页码;补一轮 murmur3 终混(fmix32)打散。
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** @param {import('../../src/types').CompactLayoutCandidate} layout */
export function scoreLayout(layout, { normalizedRole, keywordText, requiresMedia, requestedMediaCount, normalizedMediaKind, needsInitialMedia }) {
  let score = 0;
  if (normalizedRole && layout.roles.includes(normalizedRole)) score += 20;
  if (keywordText && `${layout.label} ${layout.slot}`.toLowerCase().includes(keywordText)) score += 10;
  if (requiresMedia && layout.mediaSlots.some(isWritableMediaSlot)) score += 8;
  if (needsInitialMedia && layout.mediaSlots.some(slot => isWritableMediaSlot(slot) && slot.initialSrcSupported)) score += 6;
  if (normalizedMediaKind && layout.mediaSlots.some(slot => isWritableMediaSlot(slot) && slotAcceptsKind(slot, normalizedMediaKind))) score += 4;
  if (requestedMediaCount && layout.mediaSlots.some(slot => isWritableMediaSlot(slot) && Number(slot.defaultCount) === requestedMediaCount)) score += 3;
  return score;
}

function getRequestedMediaCount({ plannedImages, providedImages, providedMedia, imageGen, needsVisual, mediaCount }) {
  const explicit = Number(mediaCount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  const provided = mediaIntentCount(providedImages) || mediaIntentCount(providedMedia);
  if (provided) return provided;
  const planned = mediaIntentCount(plannedImages);
  if (planned) return planned;
  if (imageGen || needsVisual) return 1;
  return 0;
}

function mediaIntentCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value === true) return 1;
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return Math.round(number);
  return 0;
}
