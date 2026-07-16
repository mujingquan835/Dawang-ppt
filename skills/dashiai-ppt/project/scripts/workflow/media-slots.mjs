// @ts-check
// 媒体判定域:媒体 slot 发现、容量与可写性判定、媒体类型归一化。
import path from 'node:path';
import {
  MEDIA_ARRAY_KEYS,
  isMediaArrayKey,
} from '../../src/prop-contract-core.mjs';
import {
  countArrayNameScore,
  getLayoutRecord,
  isMediaCountBinding,
  isMediaCountText,
  isPlainObject,
  singularFieldName,
} from './theme-registry.mjs';

const HOST_MEDIA_ARRAY_THEMES = new Set(['theme03', 'theme04', 'theme05', 'theme06', 'theme07', 'theme08', 'theme09', 'theme10']);

export function getMediaSlotsForLayout(layout) {
  const record = getLayoutRecord(layout);
  return record ? getMediaSlots(record) : [];
}

export function mediaSlotsCanFit(slots = [], count = 1, { requireInitialMedia = false, mediaKind = null } = {}) {
  const requested = Math.max(1, Number(count) || 1);
  const normalizedKind = normalizeMediaKind(mediaKind);
  return slots.some(slot => {
    if (!isWritableMediaSlot(slot)) return false;
    if (requireInitialMedia && slot.initialSrcSupported !== true) return false;
    if (normalizedKind && !slotAcceptsKind(slot, normalizedKind)) return false;
    return mediaSlotCapacity(slot) >= requested;
  });
}

export function mediaSlotCapacity(slot) {
  const maxCount = Number(slot?.maxCount);
  if (Number.isFinite(maxCount) && maxCount > 0) return maxCount;
  const max = Number(slot?.max);
  if (Number.isFinite(max) && max > 0) return max;
  const defaultCount = Number(slot?.defaultCount);
  if (Number.isFinite(defaultCount) && defaultCount > 0) return defaultCount;
  return 1;
}

function mediaSlotMaxCount(max, defaultVisibleCount) {
  const explicit = max == null ? NaN : Number(max);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  const count = Number(defaultVisibleCount);
  if (Number.isFinite(count) && count > 0) return count;
  return 1;
}

export function getPreferredMediaSlot(layout, { kind = 'images', count = 1 } = {}) {
  const slots = getMediaSlotsForLayout(layout);
  if (!slots.length) return null;
  const requested = Math.max(1, Number(count) || 1);
  const requestedKind = kind === 'media' ? null : 'image';
  const preferredFields = kind === 'media' ? ['media', 'images'] : MEDIA_ARRAY_KEYS;
  return slots.find(slot => slot.initialSrcSupported === true && preferredFields.some(field => field.toLowerCase() === String(slot.field || '').toLowerCase()) && (!requestedKind || slotAcceptsKind(slot, requestedKind)) && mediaSlotCapacity(slot) >= requested)
    || slots.find(slot => slot.initialSrcSupported === true && (!requestedKind || slotAcceptsKind(slot, requestedKind)) && mediaSlotCapacity(slot) >= requested)
    || null;
}

export function typedMediaItemForSource(source) {
  const src = String(source || '').trim();
  const kind = looksLikeVideoSrc(src) ? 'video' : 'image';
  return {
    src,
    kind,
    type: mimeForMediaSource(src, kind),
  };
}

export function isDeckLocalMediaSource(source) {
  const text = String(source || '').trim();
  if (!text || text.includes('\\') || path.posix.isAbsolute(text)) return false;
  if (path.posix.normalize(text) !== text) return false;
  if (!text.startsWith('assets/user-media/')) return false;
  const suffix = text.slice('assets/user-media/'.length);
  if (!suffix) return false;
  return suffix.split('/').every(part => part && part !== '.' && part !== '..');
}

export function getMediaSlots(record) {
  const { controls, countBindings, defaultProps } = record;
  const slots = [];
  const explicitMediaSlotControls = (controls || []).filter(control => Array.isArray(control.mediaSlots) && control.mediaSlots.length);
  for (const control of explicitMediaSlotControls) {
    for (const spec of control.mediaSlots) {
      slots.push(explicitMediaSlot(spec, control, defaultProps, record));
    }
  }
  const explicitCountKeys = new Set(explicitMediaSlotControls.map(control => control.key).filter(Boolean));
  for (const binding of countBindings || []) {
    const mediaArrays = (binding.arrays || []).filter(isMediaArrayKey);
    for (const field of mediaArrays) {
      slots.push(mediaSlot(field, binding.key, controls, defaultProps, binding, record, { writeMode: 'initialProps' }));
    }
  }
  for (const control of controls || []) {
    if (!isWritableMediaControl(control)) continue;
    const field = isMediaArrayKey(control.key) ? control.key : firstMediaArray(defaultProps) || control.key;
    slots.push(mediaSlot(field, control.countKey, controls, defaultProps, control, record, { writeMode: 'initialProps' }));
  }
  for (const field of Object.keys(defaultProps || {}).filter(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key) && defaultArraySupportsInitialMedia(defaultProps[key]))) {
    const countControl = mediaCountControlForArrayField(field, controls);
    slots.push(mediaSlot(field, countControl?.key, controls, defaultProps, countControl || {}, record, { writeMode: 'initialProps' }));
  }
  for (const control of controls || []) {
    if (explicitCountKeys.has(control.key)) continue;
    if (!isMediaCountControl(control)) continue;
    for (const field of hostMediaFields(record, control)) {
      slots.push(mediaSlot(field, control.key, controls, defaultProps, control, record, { writeMode: 'initialProps' }));
    }
  }
  return annotateMediaSlotSemantics(dedupeSlots(slots), record);
}

function annotateMediaSlotSemantics(slots, record) {
  const bindingsByKey = new Map();
  for (const binding of record.countBindings || []) {
    if (binding.key) bindingsByKey.set(binding.key, binding);
    if (binding.publicKey) bindingsByKey.set(binding.publicKey, binding);
  }
  return slots.map(slot => {
    if (!slot.countKey || !slot.field) return slot;
    const binding = bindingsByKey.get(slot.countKey) || bindingsByKey.get(slot.publicCountKey);
    if (binding?.arrays?.includes(slot.field)) return slot;
    if (slot.explicit || !Array.isArray(record.defaultProps?.[slot.field]) || !isMediaCountBinding({ ...(binding || {}), key: slot.countKey, publicKey: slot.publicCountKey, label: slot.label })) {
      return { ...slot, explicitMediaSlot: true };
    }
    return slot;
  });
}

export function explicitMediaSlot(spec, control, defaultProps, record) {
  const field = spec.field || spec.key;
  const writeMode = spec.writeMode || 'initialProps';
  const inferredCountKey = Object.prototype.hasOwnProperty.call(spec, 'countKey')
    ? spec.countKey
    : (isMediaCountControl(control) ? control.key : null);
  const slot = mediaSlot(field, inferredCountKey, [control], defaultProps, { ...control, ...spec }, record, { writeMode });
  return {
    ...slot,
    explicit: true,
    fieldPath: spec.fieldPath || slot.fieldPath,
    writableProp: spec.writableProp ?? slot.writableProp,
    countKey: inferredCountKey || null,
    publicCountKey: inferredCountKey ? slot.publicCountKey : null,
    maxCount: spec.maxCount ?? slot.maxCount,
    initialSrcSupported: spec.initialSrcSupported ?? slot.initialSrcSupported,
    canPresetMedia: spec.canPresetMedia ?? slot.canPresetMedia,
    presetProp: spec.presetProp ?? slot.presetProp,
  };
}

function mediaSlot(field, countKey, controls, defaultProps, source, record, { writeMode = 'initialProps' } = {}) {
  const countControl = controls.find(control => control.key === countKey);
  const fieldControl = controls.find(control => control.key === field);
  const defaultCount = countKey ? defaultProps[countKey] ?? countControl?.default : Array.isArray(defaultProps[field]) ? defaultProps[field].length : undefined;
  const max = source.max ?? countControl?.max ?? null;
  const defaultVisibleCount = defaultCount ?? null;
  const maxCount = mediaSlotMaxCount(max, defaultVisibleCount);
  const accepted = acceptedMediaKinds(record, field, fieldControl, source);
  const acceptedKinds = accepted.kinds;
  const itemShape = acceptedKinds.includes('video') ? 'string | {src,kind,type}' : 'string | {src}';
  return {
    role: 'media',
    field,
    fieldPath: `props.${field}`,
    writableProp: writeMode === 'initialProps' ? `props.${field}` : null,
    countKey: countKey || fieldControl?.countKey || null,
    publicCountKey: countControl?.publicKey || countKey || fieldControl?.countKey || null,
    defaultCount: defaultCount ?? null,
    defaultVisibleCount,
    min: source.min ?? countControl?.min ?? null,
    max,
    maxFromKey: source.maxFromKey ?? countControl?.maxFromKey,
    maxFromKeyOffset: source.maxFromKeyOffset ?? countControl?.maxFromKeyOffset,
    maxByKey: source.maxByKey ?? countControl?.maxByKey,
    maxByValue: source.maxByValue ?? countControl?.maxByValue,
    maxCount,
    controlKey: fieldControl?.key || null,
    publicControlKey: fieldControl?.publicKey || fieldControl?.key || null,
    label: fieldControl?.label || countControl?.label || null,
    accepts: acceptedKinds,
    acceptedKinds,
    acceptedKindsSource: accepted.source,
    itemShape,
    valueShape: `Array<${itemShape}>`,
    initialSrcSupported: writeMode === 'initialProps',
    runtimeReplaceable: true,
    writeMode,
    canPresetMedia: writeMode === 'initialProps',
    presetProp: writeMode === 'initialProps' ? `props.${field}` : null,
    emptySlotBehavior: countKey ? 'hiddenByCount' : 'placeholder',
  };
}

function dedupeSlots(slots) {
  const byField = new Map();
  const countOnly = [];
  for (const slot of slots) {
    if (!slot.field) {
      countOnly.push(slot);
      continue;
    }
    const existing = byField.get(slot.field);
    if (!existing || slotRank(slot) > slotRank(existing)) byField.set(slot.field, slot);
  }
  const writableCountKeys = new Set([...byField.values()].map(slot => slot.countKey).filter(Boolean));
  return [
    ...byField.values(),
    ...countOnly.filter(slot => !writableCountKeys.has(slot.countKey)),
  ];
}

function slotRank(slot) {
  let rank = 0;
  if (slot.initialSrcSupported) rank += 10;
  if (slot.explicit) rank += 5;
  if (slot.countKey) rank += 2;
  if (slot.controlKey) rank += 1;
  return rank;
}

function firstMediaArray(defaultProps = {}) {
  return Object.keys(defaultProps).find(key => Array.isArray(defaultProps[key]) && isMediaArrayKey(key) && defaultArraySupportsInitialMedia(defaultProps[key]));
}

function isWritableMediaControl(control) {
  const type = String(control.type || '').toLowerCase();
  const key = String(control.key || '').toLowerCase();
  if (['images', 'image', 'media', 'picture'].includes(type)) return true;
  if (isMediaArrayKey(key)) return true;
  return false;
}

export function isMediaCountControl(control) {
  const type = String(control.type || '').toLowerCase();
  const key = String(control.key || '');
  const label = String(control.label || '');
  const desc = String(control.desc || control.description || '');
  if (!/(count|数量)$/i.test(key)) return false;
  if (!['number', 'range', 'slider'].includes(type)) return false;
  return isMediaCountText(`${key} ${label} ${desc}`);
}

function mediaCountControlForArrayField(field, controls = []) {
  const candidates = (controls || []).filter(isMediaCountControl);
  const visualSlotCandidates = (controls || []).filter(isVisualSlotCountControl);
  if (!candidates.length && visualSlotCandidates.length === 1) return visualSlotCandidates[0];
  if (!candidates.length) return null;
  const base = singularFieldName(field);
  const exactKeys = new Set([
    ...(base ? [`${base}Count`, `${base}Total`] : []),
    `${field}Count`,
  ].map(item => item.toLowerCase()));
  const exact = candidates.find(control => {
    const keys = [control.key, control.publicKey].filter(Boolean).map(item => String(item).toLowerCase());
    return keys.some(key => exactKeys.has(key));
  });
  if (exact) return exact;
  const scored = candidates
    .map(control => ({ control, score: countArrayNameScore(control.publicKey || control.key, field) }))
    .filter(item => item.score > 0);
  if (scored.length) {
    const best = Math.max(...scored.map(item => item.score));
    return scored.find(item => item.score === best)?.control || null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function isVisualSlotCountControl(control) {
  const type = String(control?.type || '').toLowerCase();
  const key = String(control?.key || '');
  const text = `${key} ${control?.publicKey || ''} ${control?.label || ''} ${control?.desc || control?.description || ''}`;
  return /(count|数量)$/i.test(key)
    && ['number', 'range', 'slider'].includes(type)
    && /(frame|image|media|photo|picture|slot|gallery|画框|画格|图片|图像|媒体|照片|相册)/i.test(text);
}

function defaultArraySupportsInitialMedia(value) {
  if (!Array.isArray(value)) return false;
  if (!value.length) return true;
  return value.some(item => typeof item === 'string' || mediaObjectHasSource(item));
}

function mediaObjectHasSource(value) {
  return isPlainObject(value) && ['src', 'url', 'u', 'href'].some(key => typeof value[key] === 'string' && value[key]);
}

function acceptedMediaKinds(record, field, fieldControl, source = {}) {
  const explicit = normalizeAcceptedKinds(source.acceptedKinds || source.accepts || fieldControl?.acceptedKinds || fieldControl?.accepts);
  if (explicit.length) return { kinds: explicit, source: source.acceptedKinds || source.accepts ? 'slotContract' : 'controlContract' };
  const key = String(field || '').toLowerCase();
  if (/videos?/.test(key)) return { kinds: ['video'], source: 'fieldName' };
  if (isMediaArrayKey(key)) return { kinds: ['image', 'video'], source: 'mediaArrayField' };
  return { kinds: ['image'], source: 'fieldName' };
}

function normalizeAcceptedKinds(value) {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s|]+/) : [];
  return [...new Set(items.map(normalizeMediaKind).filter(kind => kind === 'image' || kind === 'video'))];
}

function hostMediaFields(record, control) {
  if (!HOST_MEDIA_ARRAY_THEMES.has(record?.page?.themeKey)) return [];
  const kinds = acceptedMediaKinds(record, firstMediaArray(record?.defaultProps || {}) || 'images', null, control).kinds;
  if (!kinds.includes('image')) return [];
  const fields = ['images'];
  if (hasRealMediaField(record, 'media')) fields.push('media');
  return fields;
}

function hasRealMediaField(record, field) {
  return Array.isArray(record?.defaultProps?.[field])
    || (record?.controls || []).some(control => control.key === field && isWritableMediaControl(control));
}

export function normalizeMediaKind(kind) {
  const value = String(kind || '').trim().toLowerCase();
  if (!value) return null;
  if (['image', 'images', 'photo', 'photos', 'picture', 'pictures'].includes(value)) return 'image';
  if (['video', 'videos', 'movie', 'movies'].includes(value)) return 'video';
  if (['mixed', 'media', 'any'].includes(value)) return 'mixed';
  return value;
}

export function looksLikeVideoSrc(src) {
  return /\.(mp4|m4v|mov|webm|ogv)(?:[?#].*)?$/i.test(String(src || '').trim())
    || String(src || '').startsWith('data:video/');
}

export function mimeForMediaSource(src, kind) {
  const ext = path.extname(String(src || '').split(/[?#]/)[0]).toLowerCase();
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
  }[ext] || (kind === 'video' ? 'video/mp4' : 'image/*');
}

export function slotAcceptsKind(slot, kind) {
  const normalized = normalizeMediaKind(kind);
  if (!normalized) return true;
  const kinds = slot.acceptedKinds || [];
  if (normalized === 'mixed') return kinds.includes('image') && kinds.includes('video');
  return kinds.includes(normalized);
}

export function isWritableMediaSlot(slot) {
  return slot?.role === 'media'
    && slot.canPresetMedia === true
    && slot.initialSrcSupported === true
    && Boolean(slot.writableProp || slot.fieldPath || slot.presetProp);
}
