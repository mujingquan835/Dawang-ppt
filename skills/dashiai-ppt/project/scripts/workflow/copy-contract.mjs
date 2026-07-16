// @ts-check
// copy 预算与角色词表域:文案密度/字符预算、文案根/路径展开、可填文案叶子判定。
import { getDecorativeKeys } from '../../src/components/themes/decorative-overrides.mjs';
import {
  FREE_TEXT_ARRAY_FIELD_PATHS,
  isMediaArrayKey,
  isNonContentContractValue,
  isPrunedContractOmit,
  isSerializedReactElementLike,
  pruneContractValue,
  reactElementText,
} from '../../src/prop-contract-core.mjs';
import {
  arrayFieldName,
  getLayoutRecord,
  isNumericPathSegment,
  isPlainObject,
  normalizeName,
} from './theme-registry.mjs';
import { getMediaSlots } from './media-slots.mjs';

export function getCopyBudgetsForLayout(layout) {
  const record = getLayoutRecord(layout);
  if (!record) return {};
  const mediaSlots = getMediaSlots(record);
  const decorativeKeys = getDecorativeKeys(record.page.key);
  const copyKeyRoots = getCopyKeyRoots(record.defaultProps, record.controls, mediaSlots, decorativeKeys);
  return getCopyBudgets(record.defaultProps, copyKeyRoots);
}

// 顶层文案根:对象 copy 仍是单根(copy),内部路径由 expandCopyKeys/collectCopyBudgets 递归。
export function getCopyKeyRoots(defaultProps, controls, mediaSlots, decorativeKeys = []) {
  const controlKeys = new Set(controls.map(control => control.key));
  const mediaFields = new Set(mediaSlots.map(slot => slot.field));
  const decorative = new Set(decorativeKeys);
  return Object.entries(defaultProps || {})
    .filter(([key, value]) => {
      if ((controlKeys.has(key) && key !== 'copy') || mediaFields.has(key) || decorative.has(key) || isMediaArrayKey(key)) return false;
      const pruned = pruneContractValue(value, key);
      return !isPrunedContractOmit(pruned) && pruned !== null && isCopyValue(pruned) && hasFillableCopyLeaf(pruned, key);
    })
    .map(([key]) => key);
}

// JAD-212:把文案根扁平化为可填路径。对象 copy 展开成 copy.eyebrow / copy.points[].t,
// 顶层数组展开成 items[].label,与扁平主题(theme01)形态一致。
export function expandCopyKeys(defaultProps, copyKeyRoots) {
  const keys = [];
  for (const root of copyKeyRoots) collectCopyPaths(defaultProps?.[root], root, keys);
  return [...new Set(keys)];
}

function collectCopyPaths(value, pathName, out) {
  value = pruneContractValue(value, pathName);
  if (isPrunedContractOmit(value)) return;
  if (typeof value === 'string' || typeof value === 'number' || isSerializedReactElementLike(value)) {
    if (isFillableCopyLeaf(pathName, value)) out.push(pathName);
    return;
  }
  if (Array.isArray(value)) {
    const shape = value.find(isPlainObject);
    if (shape) {
      for (const [key, item] of Object.entries(shape)) collectCopyPaths(item, `${pathName}[].${key}`, out);
      return;
    }
    if (value.some(item => (typeof item === 'string' || typeof item === 'number') && isFillableCopyLeaf(`${pathName}[]`, item))) out.push(`${pathName}[]`);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, item] of Object.entries(value)) collectCopyPaths(item, `${pathName}.${key}`, out);
}

export function isColorString(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(text) || /^(rgb|rgba|hsl|hsla)\(/i.test(text);
}

export function isColorArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isColorString);
}

function isVisualConfigValue(pathName, value) {
  if (isVisualConfigLeaf(pathName, value)) return true;
  if (Array.isArray(value)) return isVisualConfigArray(pathName, value);
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value || {});
  const numericGroups = entries.filter(([key]) => isNumericPathSegment(key));
  return numericGroups.length > 0
    && numericGroups.length === entries.length
    && numericGroups.every(([key, item]) => isVisualConfigValue(`${pathName}.${key}`, item));
}

function isVisualConfigArray(pathName, value) {
  if (!Array.isArray(value) || !value.length) return false;
  if (isColorArray(value)) return true;
  const field = arrayFieldName(pathName);
  if (value.every(item => typeof item === 'number' && Number.isFinite(item))) return isVisualArrayField(field);
  const objects = value.filter(isPlainObject);
  if (!objects.length || objects.length !== value.filter(item => item != null).length) return false;
  const scalarFields = objects.flatMap(item => scalarObjectEntries(item).map(([key, itemValue]) => [key, itemValue]));
  if (!scalarFields.some(([key, itemValue]) => isVisualConfigLeaf(key, itemValue))) return false;
  return scalarFields.every(([key, itemValue]) => (
    isVisualConfigLeaf(key, itemValue) || isVisualDecorationLabelField(pathFieldName(key))
  ));
}

function scalarObjectEntries(value, prefix = '') {
  if (!isPlainObject(value)) return [];
  const rows = [];
  for (const [key, item] of Object.entries(value)) {
    const pathName = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(item)) continue;
    if (isPlainObject(item)) {
      rows.push(...scalarObjectEntries(item, pathName));
      continue;
    }
    rows.push([pathName, item]);
  }
  return rows;
}

function isVisualConfigLeaf(pathName, value) {
  const field = pathFieldName(pathName);
  if (isColorString(value)) return true;
  if (typeof value === 'number' && Number.isFinite(value)) return isVisualNumericField(field);
  if (typeof value === 'string' && isVisualStyleField(field) && (isTokenLike(value) || isCssVarLike(value))) return true;
  return false;
}

function isVisualNumericField(field) {
  return /^(x|y|l|t|r|w|h|cx|cy|dx|dy|box|width|height|left|top|right|bottom|ratio|rotate|rotation|angle|tilt|scale|sr|opacity|radius|z|zindex)$/i.test(String(field || ''));
}

function isVisualArrayField(field) {
  return /^(tilts?|rotations?|angles?|offsets?|positions?|coords?|coordinates?)$/i.test(String(field || ''));
}

function isVisualStyleField(field) {
  return /^(c|color|colour|accent|fill|stroke|background|bg|tint|hex|tone|subcolor)$/i.test(String(field || ''));
}

function isVisualDecorationLabelField(field) {
  return /^(ph|placeholder|label|sub|caption|cap)$/i.test(String(field || ''));
}

function isCssVarLike(value) {
  return /^var\(--[A-Za-z0-9_-]+\)$/.test(String(value || '').trim());
}

// 文案槽角色:eyebrow(短标签)/ title(标题)/ paragraph(段落)/ metric(数字)/ serial(序号)。
export function copyRoleForField(pathName) {
  return {
    metric: 'metric',
    serial: 'serial',
    tagline: 'eyebrow',
    display: 'title',
    brief: 'paragraph',
    body: 'paragraph',
    compact: 'eyebrow',
  }[inferCopyDensity(pathName)] || 'eyebrow';
}

export function buildCopyRoles(copyKeys = []) {
  const roles = {};
  // 扁平 copyKeys 已含 copy.eyebrow / items[].label 形态;数组路径(以 [] 结尾)按字段角色判定,不当 eyebrow 标题。
  for (const key of copyKeys) roles[key] = copyRoleForField(key);
  return roles;
}

const METRIC_FIELD_RE = /^(value|val|amount|amt|funding|fund|funds|budget|spend|investment|capital|revenue|sales|cost|price|arr|mrr|gmv|share|pct|percent|percentage|ratio|rate|portion|weight|num|number|score|index|rank|total|metric)$/;

export function isMetricFieldName(field) {
  return METRIC_FIELD_RE.test(normalizeName(field));
}

export function getCopyBudgets(defaultProps, copyKeys) {
  const budgets = {};
  for (const key of copyKeys) {
    collectCopyBudgets(defaultProps?.[key], key, budgets);
  }
  return budgets;
}

function collectCopyBudgets(value, pathName, budgets) {
  value = pruneContractValue(value, pathName);
  if (isPrunedContractOmit(value)) return;
  if (typeof value === 'string' || typeof value === 'number') {
    if (isFillableCopyLeaf(pathName, value)) setCopyBudget(budgets, pathName, copyBudget(pathName, value));
    return;
  }
  if (isSerializedReactElementLike(value)) {
    if (isFillableCopyLeaf(pathName, value)) setCopyBudget(budgets, pathName, copyBudget(pathName, reactElementText(value)));
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 4).forEach(item => collectCopyBudgets(item, `${pathName}[]`, budgets));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    collectCopyBudgets(item, `${pathName}.${key}`, budgets);
  }
}

function setCopyBudget(budgets, key, budget) {
  if (!budget) return;
  const existing = budgets[key];
  if (!existing || budget.maxChars < existing.maxChars) budgets[key] = budget;
}

export function copyBudget(pathName, value) {
  const density = inferCopyDensity(pathName);
  const length = charLength(value);
  const floor = { body: 18, serial: 4, tagline: 8 }[density] ?? 6;
  const base = Math.max(length, floor);
  const maxChars = {
    // serial/序号槽:物理可容字符极少(如 80px mono 大序号),收紧到 6–8。
    serial: Math.min(8, Math.max(6, Math.ceil(base * 1.2))),
    metric: Math.max(8, Math.min(16, Math.ceil(base * 1.4))),
    // 刊头 mono 标语(panelEn 等):单行不换行,约束在 ~14。
    tagline: Math.min(14, Math.max(12, Math.ceil(base * 1.1))),
    display: Math.max(18, Math.min(36, Math.ceil(base * 1.8))),
    compact: Math.max(18, Math.min(42, Math.ceil(base * 1.8))),
    brief: Math.max(36, Math.min(80, Math.ceil(base * 1.6))),
    body: Math.max(36, Math.min(120, Math.ceil(base * 2.2))),
  }[density];
  return { density, maxChars };
}

export function inferCopyDensity(pathName) {
  const normalized = String(pathName || '').toLowerCase();
  const field = normalized.split('.').at(-1)?.replace(/\[\]/g, '') || normalized;
  const nested = normalized.includes('.') || normalized.includes('[]');
  // 序号 / 刊号槽:物理容量极小,先于 metric 命中,避免被当成普通数字放宽到 16。
  if (!nested && /^(panelindex|panelno|panelnum|vol|volume|issueno|serialno|partno)$/.test(field)) return 'serial';
  if (!nested && /^(panelen|panelsub|paneltag)$/.test(field)) return 'tagline';
  if (isMetricFieldName(field)) return 'metric';
  if (!nested && /^(title|titletop|titlebottom|headline|headlinehl|headlinetail|statement|quote|word|brand|kicker)$/.test(field)) return 'display';
  if (/^(lead|subtitle|sub|desc|description|summary|note|caption|detail|footnote|intro|insight|excerpt|takeaway|reason|conclusion)$/.test(field)) return 'brief';
  if (/^(body|copy|paragraph)$/.test(field)) return 'body';
  if (/^(title|headline|label|name|kicker|tag|chip|pill|category)$/.test(field)) return 'compact';
  return 'compact';
}

// 文案长度按「视觉宽度」折算:全角(CJK 及全角标点)记 1,半角记 0.5(issue #15)。
// 预算本质是布局的物理容宽,1 个中文字 ≈ 2 个拉丁字母宽;此前按码点计数,英文/混排
// 文案(如 "GPT · Gemini · Claude",21 码点但视觉仅 ≈11 个中文字宽)被误拦,而预算
// 常数是按中文字符标定的——视觉宽度口径下中文文案计数不变,预算常数无需调整。
export function charLength(value) {
  let width = 0;
  for (const ch of String(value ?? '')) {
    const code = ch.codePointAt(0);
    const fullWidth = (code >= 0x1100 && code <= 0x115f) // Hangul Jamo
      || (code >= 0x2e80 && code <= 0xa4cf)   // CJK 部首/汉字/假名/注音等
      || (code >= 0xac00 && code <= 0xd7a3)   // Hangul 音节
      || (code >= 0xf900 && code <= 0xfaff)   // CJK 兼容汉字
      || (code >= 0xfe30 && code <= 0xfe4f)   // CJK 兼容形式
      || (code >= 0xff00 && code <= 0xff60)   // 全角 ASCII/标点
      || (code >= 0xffe0 && code <= 0xffe6)   // 全角符号
      || (code >= 0x3000 && code <= 0x303e)   // CJK 标点(含全角空格、「」)
      || (code >= 0x20000 && code <= 0x3fffd); // CJK 扩展
    width += fullWidth ? 1 : 0.5;
  }
  return Math.ceil(width);
}

function hasFillableCopyLeaf(value, pathName) {
  value = pruneContractValue(value, pathName);
  if (isPrunedContractOmit(value)) return false;
  if (typeof value === 'string' || typeof value === 'number' || isSerializedReactElementLike(value)) {
    return isFillableCopyLeaf(pathName, value);
  }
  if (Array.isArray(value)) {
    return value.some(item => hasFillableCopyLeaf(item, `${pathName}[]`));
  }
  if (!isPlainObject(value)) return false;
  return Object.entries(value).some(([key, item]) => hasFillableCopyLeaf(item, `${pathName}.${key}`));
}

export function isFillableCopyLeaf(pathName, value) {
  const field = pathFieldName(pathName);
  if (/axesData\[\]\.id$/i.test(String(pathName || '')) && typeof value === 'string') return true;
  if (isNonContentContractValue(pathName, value)) return false;
  if (isColorString(value) && /^(c|color|colour|accent|fill|stroke|background|bg|tint|hex)$/i.test(field)) return false;
  if (/^(id|key|type|kind|mode|variant|style|layout|align|side|position|fit|icon|href|url|src|className)$/i.test(field)) return false;
  // 'q' is ambiguous by name alone: a structural quadrant/scorecard token elsewhere (locked, see
  // FREE_TEXT_ARRAY_FIELD_PATHS comment in prop-contract-core.mjs) vs. a rewritable quarter-tick
  // label / quote / FAQ question here. Registered array[].field paths opt out of the token-like
  // exclusion so props:safe / goal-scaffold / validate-goal-spec treat them as authorable copy.
  if (/^(theme|tone|q)$/i.test(field) && isTokenLike(value) && !FREE_TEXT_ARRAY_FIELD_PATHS.has(normalizeArrayPathIndex(pathName))) return false;
  return true;
}

// "colsData[3].q" -> "colsData[].q": collapse a concrete array index back to the "[]" wildcard
// form FREE_TEXT_ARRAY_FIELD_PATHS is keyed by (collectCopyPaths already emits "[]" for shape
// probing, but other isFillableCopyLeaf callers pass concrete per-item paths).
function normalizeArrayPathIndex(pathName) {
  return String(pathName || '').replace(/\[\d+\]/g, '[]');
}

export function pathFieldName(pathName) {
  return String(pathName || '').split('.').pop()?.replace(/\[\]$/, '') || '';
}

function isTokenLike(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return /^[A-Za-z0-9_-]{1,24}$/.test(text);
}

function isCopyValue(value) {
  if (value == null) return false;
  if (['string', 'number'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.length > 0 && value.every(item => item == null || ['string', 'number'].includes(typeof item) || isPlainObject(item));
  return isPlainObject(value);
}
