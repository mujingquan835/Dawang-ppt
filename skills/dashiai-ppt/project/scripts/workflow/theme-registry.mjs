// @ts-check
// 契约消费共享域:主题登记表/清单缓存/getLayoutRecord 契约装配/count 绑定数组解析等基础能力,供其余模块复用。
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  filterAcceptedThemePacks,
  filterAcceptedThemePages,
} from '../../src/accepted-themes.mjs';
import {
  GENERATED_THEME_PACKS,
  GENERATED_THEME_PAGES,
} from '../../src/components/themes/generated-metadata.js';
import { normalizePublicControls } from '../../src/control-naming.mjs';
import {
  createLazyLayoutContracts,
  isContractContentArray,
  isMediaArrayKey,
} from '../../src/prop-contract-core.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const THEME_PACKS = filterAcceptedThemePacks(GENERATED_THEME_PACKS);

export const THEME_PAGES = filterAcceptedThemePages(GENERATED_THEME_PAGES);

const contracts = createLazyLayoutContracts(THEME_PAGES);

const pagesByKey = new Map(THEME_PAGES.map(page => [page.key, page]));

const themePacksByKey = new Map(THEME_PACKS.map(theme => [theme.key, theme]));

let manifestCache;

const getManifest = () => (manifestCache ??= readManifest());

export function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (next == null || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

export function compactJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function getLayoutRecord(layout) {
  const page = pagesByKey.get(layout);
  if (!page) return null;
  const baseContract = contracts.get(layout);
  const manifestLayout = getManifest().layouts?.[layout] || {};
  const controls = normalizePublicControls(manifestLayout.controls || baseContract?.controls || [], { layout, themeKey: page.themeKey });
  const rawCountBindings = mergeCountBindings(manifestLayout.countBindings, baseContract?.countBindings);
  const countBindings = resolveCountBindings(rawCountBindings, baseContract?.defaultProps || {}, controls);
  const lengthBindings = mergeLengthBindings(manifestLayout.lengthBindings, baseContract?.lengthBindings);
  const contract = {
    ...(baseContract || {}),
    controls,
    countBindings,
    lengthBindings,
  };
  return {
    page,
    contract,
    controls,
    countBindings,
    lengthBindings,
    defaultProps: baseContract?.defaultProps || {},
  };
}

function mergeCountBindings(primary = [], fallback = []) {
  const result = [];
  const seen = new Set();
  for (const binding of [...(primary || []), ...(fallback || [])]) {
    if (!binding?.key || seen.has(binding.key)) continue;
    seen.add(binding.key);
    result.push(binding);
  }
  return result;
}

function resolveCountBindings(bindings = [], defaultProps = {}, controls = []) {
  return (bindings || []).map(binding => {
    const control = (controls || []).find(item => item.key === binding.key || item.publicKey === binding.publicKey);
    return {
      ...binding,
      publicKey: control?.publicKey || binding.publicKey,
      maxFromKey: binding.maxFromKey ?? control?.maxFromKey,
      maxFromKeyOffset: binding.maxFromKeyOffset ?? control?.maxFromKeyOffset,
      maxByKey: binding.maxByKey ?? control?.maxByKey,
      maxByValue: binding.maxByValue ?? control?.maxByValue,
      arrays: resolveBindingArrays(binding, defaultProps, controls),
    };
  });
}

function mergeLengthBindings(primary = [], fallback = []) {
  const result = [];
  const seen = new Set();
  for (const binding of [...(primary || []), ...(fallback || [])]) {
    if (!binding?.dependent || !binding?.anchor) continue;
    const key = `${binding.relation || 'same-length'}:${binding.dependent}:${binding.anchor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(binding);
  }
  return result;
}

export function getThemePackMetadata(themeKey) {
  return themePacksByKey.get(themeKey) || null;
}

export function layoutExists(layout) {
  return pagesByKey.has(layout);
}

export function themeDisplayName(theme, fallback) {
  return theme?.displayName || theme?.label || theme?.name || fallback;
}

export function isCoverCandidate(layout) {
  return /^theme\d+_page00[1-5]$/.test(layout);
}

export function isCoverLikeLayout(layout) {
  const record = getLayoutRecord(layout);
  if (!record) return false;
  const slot = String(record.page.slot || '').toLowerCase();
  const label = String(record.page.label || '').toLowerCase();
  return slot.startsWith('cover') || label.startsWith('封面') || /^cover/.test(label);
}

export function isBodyContentCandidate(page) {
  return !isCoverCandidate(page.key)
    && !isCoverLikeLayout(page.key)
    && !isClosingLikePage(page);
}

function isClosingLikePage(page) {
  const slot = String(page.slot || '').toLowerCase();
  const label = String(page.label || '').toLowerCase();
  const text = `${slot} ${label}`;
  return /(^|[\s_-])(closing|contact|join|end|endcap|colophon|appendix)([\s_-]|$)/.test(text)
    || label.startsWith('封底')
    || label.startsWith('结语')
    || label.startsWith('致谢')
    || label.startsWith('谢谢');
}

// defaultProps 中实际承载内容的数组键(排除媒体数组与纯色板数组)。
function contentArrayKeys(defaultProps = {}) {
  return Object.keys(defaultProps || {})
    .filter(key => Array.isArray(defaultProps[key]) && !isMediaArrayKey(key) && isContractContentArray(key, defaultProps[key]));
}

function arrayHeadExists(defaultProps, pathName) {
  return Array.isArray(valueAtPath(defaultProps, pathName));
}

// 把 count 控件解析到 defaultProps 里真实存在的数组键;命不中时只保留可由命名或长度证明的数组。
export function resolveBindingArrays(binding, defaultProps = {}, controls = []) {
  const explicit = explicitCountArraysForBinding(binding, controls);
  if (explicit.length) {
    const kept = explicit.filter(pathName => isExplicitBindableCountArray(defaultProps, pathName));
    if (kept.length) return [...new Set(kept)];
    return [];
  }
  if (isMediaCountBinding(binding)) {
    const declaredMedia = [
      ...(Array.isArray(binding?.arrays) ? binding.arrays : []),
    ].filter(pathName => isMediaArrayPath(pathName) && arrayHeadExists(defaultProps, pathName));
    if (declaredMedia.length) return narrowCountBindingArrays(binding, [...new Set(declaredMedia)]);

    const mediaArrays = Object.keys(defaultProps || {}).filter(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key));
    const preferred = preferredMediaBindingArray(binding, mediaArrays);
    if (preferred) return [preferred];
  }
  const declared = Array.isArray(binding?.arrays) ? binding.arrays : [];
  if (Array.isArray(binding?.arrays) && !declared.length) return [];
  const kept = declared.filter(pathName => isBindableCountArray(defaultProps, pathName));
  if (kept.length && isVisualSlotCountBinding(binding, controls)) {
    const mediaArrays = Object.keys(defaultProps || {}).filter(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key));
    if (mediaArrays.length) return [...new Set([...kept, ...mediaArrays])];
  }
  if (kept.length) return narrowCountBindingArrays(binding, kept);
  const paths = discoverContentArrayPaths(defaultProps);
  const byField = declared
    .flatMap(pathName => paths.filter(candidate => arrayFieldName(candidate) === arrayFieldName(pathName)));
  if (byField.length) return [...new Set(byField)];
  const content = contentArrayKeys(defaultProps);
  if (!content.length) return [];
  const max = Number(binding?.max);
  const byMax = Number.isFinite(max) ? content.filter(key => defaultProps[key].length === max) : [];
  if (byMax.length === 1) return byMax;
  const fallbackDefault = Number(defaultProps[binding?.key]);
  const byDefault = Number.isFinite(fallbackDefault) ? content.filter(key => defaultProps[key].length === fallbackDefault) : [];
  if (byDefault.length === 1) return byDefault;
  return [];
}

function isBindableCountArray(defaultProps, pathName) {
  if (!arrayHeadExists(defaultProps, pathName)) return false;
  if (isMediaArrayPath(pathName)) return true;
  return isContractContentArray(pathName, valueAtPath(defaultProps, pathName));
}

function isExplicitBindableCountArray(defaultProps, pathName) {
  if (!arrayHeadExists(defaultProps, pathName)) return false;
  if (isBindableCountArray(defaultProps, pathName)) return true;
  const value = valueAtPath(defaultProps, pathName);
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

function explicitCountArraysForBinding(binding, controls = []) {
  const control = (controls || []).find(item => (
    item?.key && (item.key === binding?.key || item.key === binding?.publicKey)
  ) || (
    item?.publicKey && (item.publicKey === binding?.key || item.publicKey === binding?.publicKey)
  ));
  const value = control?.countArrays;
  if (typeof value === 'string' && value) return [value];
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' && item);
  return [];
}

function isMediaArrayPath(pathName) {
  const root = String(pathName || '').split('.')[0].replace(/\[\]$/, '');
  return isMediaArrayKey(root) || isMediaArrayKey(arrayFieldName(pathName));
}

export function isMediaCountBinding(binding) {
  const text = `${binding?.key || ''} ${binding?.publicKey || ''} ${binding?.label || ''}`;
  return isMediaCountText(text)
    && /(count|数量)/i.test(text);
}

export function isMediaCountText(text) {
  return /image|media|photo|picture|video|logo|slot|图片|图像|视频|媒体|照片|徽标|标志|槽/i.test(String(text || ''));
}

function isVisualSlotCountBinding(binding, controls = []) {
  const control = (controls || []).find(item => (
    item?.key && (item.key === binding?.key || item.key === binding?.publicKey)
  ) || (
    item?.publicKey && (item.publicKey === binding?.key || item.publicKey === binding?.publicKey)
  ));
  const text = `${binding?.key || ''} ${binding?.publicKey || ''} ${binding?.label || ''} ${control?.label || ''}`;
  return /(count|数量)$/i.test(String(binding?.key || control?.key || ''))
    && /(frame|image|media|photo|picture|slot|gallery|画框|画格|图片|图像|媒体|照片|相册)/i.test(text);
}

function preferredMediaBindingArray(binding, mediaArrays = []) {
  if (!mediaArrays.length) return null;
  const stem = normalizeName(String(binding?.publicKey || binding?.key || '').replace(/Count$/i, ''));
  const exact = mediaArrays.find(key => normalizeName(key).startsWith(stem));
  return exact || mediaArrays[0];
}

function narrowCountBindingArrays(binding, arrays) {
  if (!arrays.length) return arrays;
  const scored = arrays.map(pathName => ({ pathName, score: countArrayNameScore(binding?.key, pathName) }));
  const best = Math.max(...scored.map(item => item.score));
  if (best <= 0) return arrays;
  return scored.filter(item => item.score === best).map(item => item.pathName);
}

export function countArrayNameScore(countKey, pathName) {
  const stem = normalizeName(String(countKey || '').replace(/Count$/i, ''));
  if (!stem) return 0;
  const aliases = countStemAliases(stem);
  const field = normalizeName(arrayFieldName(pathName));
  if (aliases.has(field)) return 3;
  const full = normalizeName(pathName);
  if (aliases.has(full)) return 2;
  return 0;
}

function countStemAliases(stem) {
  const aliases = {
    column: ['column', 'columns', 'coldata', 'colsdata', 'columndata', 'columnsdata'],
    col: ['column', 'columns', 'col', 'cols', 'coldata', 'colsdata'],
    row: ['row', 'rows', 'rowdata', 'rowsdata'],
  }[stem] || [];
  return new Set([stem, pluralize(stem), ...aliases].map(normalizeName));
}

function pluralize(value) {
  if (!value) return value;
  if (value.endsWith('y')) return `${value.slice(0, -1)}ies`;
  if (value.endsWith('s')) return value;
  return `${value}s`;
}

export function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function singularFieldName(field) {
  const value = String(field || '').toLowerCase();
  if (value.length <= 1) return value;
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('s')) return value.slice(0, -1);
  return value;
}

export function arrayFieldName(pathName) {
  return String(pathName || '').split('.').at(-1).replace(/\[\]$/, '').toLowerCase();
}

// 承载内容的数组路径:顶层数组 + copy 等对象内的一层嵌套数组(排除媒体/纯色板)。
export function discoverContentArrayPaths(defaultProps = {}) {
  const out = [];
  for (const [key, value] of Object.entries(defaultProps || {})) {
    if (Array.isArray(value)) {
      if (!isMediaArrayKey(key) && isContractContentArray(key, value)) out.push(key);
      for (const pathName of nestedArrayPaths(value, key)) out.push(pathName);
      continue;
    }
    if (!isPlainObject(value)) continue;
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (isNumericPathSegment(nestedKey)) continue;
      const pathName = `${key}.${nestedKey}`;
      if (Array.isArray(nestedValue) && !isMediaArrayKey(nestedKey) && isContractContentArray(pathName, nestedValue)) {
        out.push(`${key}.${nestedKey}`);
      }
      if (Array.isArray(nestedValue)) {
        for (const pathName of nestedArrayPaths(nestedValue, `${key}.${nestedKey}`)) out.push(pathName);
      }
    }
  }
  return [...new Set(out)];
}

function nestedArrayPaths(items, prefix) {
  const out = [];
  for (const item of items || []) {
    if (!isPlainObject(item)) continue;
    for (const [key, value] of Object.entries(item)) {
      if (!Array.isArray(value)) continue;
      const pathName = `${prefix}[].${key}`;
      if (!isMediaArrayKey(key) && isContractContentArray(pathName, value)) out.push(pathName);
      for (const nestedPathName of nestedArrayPaths(value, pathName)) out.push(nestedPathName);
    }
  }
  return out;
}

export function isNumericPathSegment(value) {
  return /^\d+$/.test(String(value || ''));
}

export function valueAtPath(defaultProps, pathName) {
  let current = defaultProps;
  for (const segment of String(pathName || '').split('.')) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const arrayKey = segment.endsWith('[]') ? segment.slice(0, -2) : segment;
      const values = current.map(item => arrayKey ? item?.[arrayKey] : item).filter(item => item !== undefined);
      current = segment.endsWith('[]') ? values.find(Array.isArray) : values.find(item => item !== undefined);
      continue;
    }
    if (segment.endsWith('[]')) {
      const array = current[segment.slice(0, -2)];
      if (!Array.isArray(array)) return undefined;
      current = array;
      continue;
    }
    current = current[segment];
  }
  return current;
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// layout-manifest.json 只是 `contracts`(createLazyLayoutContracts,见上方 103 行)的缓存层——
// getLayoutRecord 里 manifestLayout.controls/countBindings/lengthBindings 缺失时都会回退到
// baseContract。所以文件缺失或损坏时不应崩栈:给出可行动提示(如何重新生成),照常返回空
// manifest,让唯一的调用点 getLayoutRecord() 走 baseContract 实时回退。
function readManifest() {
  const file = path.join(ROOT, 'layout-manifest.json');
  if (!existsSync(file)) {
    console.warn(
      '[dashi-ppt] layout-manifest.json not found; falling back to live contracts derived from theme metadata. '
      + 'Run `npm run manifest:update` to regenerate the cached manifest.',
    );
    return { layouts: {} };
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.warn(
      `[dashi-ppt] layout-manifest.json is present but could not be parsed (${error.message}); `
      + 'falling back to live contracts derived from theme metadata. '
      + 'Run `npm run manifest:update` to regenerate the cached manifest.',
    );
    return { layouts: {} };
  }
}
