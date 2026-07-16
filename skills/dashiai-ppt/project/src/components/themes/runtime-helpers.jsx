import React from 'react';
import {
  normalizePublicControls,
} from '../../control-naming.mjs';

export function normalizeRuntimePages(rawPages, { themeKey, layoutPrefix, keepTextControls = false }) {
  return (rawPages || []).map((entry, index) => {
    const pageNumber = index + 1;
    const meta = entry.meta || {};
    const slot = entry.slot || entry.id || entry.key || meta.id || `page${pageNumber}`;
    const defaultProps = {
      ...(entry.defaultProps || entry.defaults || {}),
      ...(entry.initial || entry.initialProps || {}),
    };
    return {
      key: `${themeKey}_page${String(pageNumber).padStart(3, '0')}`,
      themeKey,
      pageNumber,
      layout: `${layoutPrefix}-${String(pageNumber).padStart(3, '0')}`,
      slot,
      label: entry.label || entry.name || entry.title || meta.label || meta.title || slot,
      Component: entry.Component || entry.component || entry.Comp || entry.C,
      controls: normalizeControls(entry.controls || entry.spec?.controls || meta.controls || [], defaultProps, { keepTextControls }),
      defaultProps,
      staticHtml: entry.staticHtml || false,
      bgClass: entry.bgClass || entry.backgroundClass || '',
      // Explicit, page-declared hard domains for array-item fields consumed directly as
      // chart/SVG geometry (fixed-axis scale, normalized position, rank index, ...). Forwarded
      // straight through to createContract() in src/prop-contract-core.mjs; see that file for
      // the "arrayKey[].field" -> {min,max,semantics} shape.
      ...((entry.numberBounds || entry.spec?.numberBounds || meta.numberBounds)
        ? { numberBounds: entry.numberBounds || entry.spec?.numberBounds || meta.numberBounds }
        : {}),
    };
  });
}

export function DeckPageNumber({
  page = '01',
  total = '01',
  pad = 2,
  totalPad = 2,
  separator = ' / ',
  accentStyle,
  currentStyle,
  totalStyle,
  className,
  style,
  as: Tag = 'span',
  ...rest
}) {
  return (
    <Tag
      {...rest}
      className={className}
      style={style}
      data-dashi-page-number="fraction"
      data-dashi-page-pad={pad}
      data-dashi-page-total-pad={totalPad}
      data-dashi-page-separator={separator}
      data-editable-skip="true"
    >
      <b data-dashi-page-current="" style={{ ...(accentStyle || {}), ...(currentStyle || {}) }}>{page}</b>
      <span data-dashi-page-separator="true">{separator}</span>
      <span data-dashi-page-total="" style={totalStyle}>{total}</span>
    </Tag>
  );
}

export function DeckPageCurrent({
  value = '01',
  pad = 2,
  className,
  style,
  as: Tag = 'span',
  ...rest
}) {
  return (
    <Tag
      {...rest}
      className={className}
      style={style}
      data-dashi-page-number="current"
      data-dashi-page-pad={pad}
      data-editable-skip="true"
    >
      <span data-dashi-page-current="">{value}</span>
    </Tag>
  );
}

const TEXT_CONTROL_TYPES = new Set(['text', 'string', 'input', 'url', 'email', 'textarea', 'multiline']);
const REMOVED_CONTROL_TYPES = new Set();
const EMPHASIS_CONTROL_KEYS = new Set([
  'activeIndex',
  'currentIndex',
  'emphasisIndex',
  'featureIndex',
  'focusCol',
  'focusIndex',
  'highlightCol',
  'highlightIndex',
  'highlightRowIndex',
]);

function normalizeControls(controls, defaults = {}, options = {}) {
  const baseControls = (controls || [])
    .filter(control => !isRemovedControl(control, options))
    .map(control => ({
      ...control,
      min: resolveControlValue(control?.min, defaults),
      max: resolveControlValue(control?.max, defaults),
    }));
  const countAwareControls = baseControls.map(control => materializeCountBounds(control, defaults));
  const normalizedControls = countAwareControls.map(control => materializeDerivedBounds(control, countAwareControls, defaults));
  return normalizePublicControls(normalizedControls);
}

function isRemovedControl(control, options = {}) {
  const type = String(control?.type || '').toLowerCase();
  if (options.keepTextControls && TEXT_CONTROL_TYPES.has(type)) return false;
  return TEXT_CONTROL_TYPES.has(type) || REMOVED_CONTROL_TYPES.has(type);
}

function materializeCountBounds(control, defaults) {
  if (control?.max != null || !isOptionalQuantityControl(control)) return control;
  const derivedMax = resolveControlValue(control?.maxFrom, defaults);
  if (derivedMax == null) return control;
  return {
    ...control,
    max: derivedMax,
  };
}

function materializeDerivedBounds(control, controls, defaults) {
  if (control?.max != null) return control;

  if (isEmphasisControl(control)) {
    const linkedControl = resolveLinkedCountControl(controls, control);
    const linkedMax = Number(linkedControl?.max);
    if (Number.isFinite(linkedMax)) {
      const min = Number(control?.min ?? 0);
      return {
        ...control,
        max: resolveEmphasisLinkedMax(linkedMax, min),
        maxFromKey: control.maxFromKey || linkedControl.key,
      };
    }
  }

  const derivedMax = resolveControlValue(control?.maxFrom, defaults);
  if (derivedMax == null) return control;
  return {
    ...control,
    max: derivedMax,
  };
}

function isOptionalQuantityControl(control) {
  return String(control?.type || '').toLowerCase() === 'number'
    && (String(control?.key || '').toLowerCase().includes('count') || control?.key === 'columns');
}

function isEmphasisControl(control) {
  return String(control?.type || '').toLowerCase() === 'number'
    && EMPHASIS_CONTROL_KEYS.has(control?.key);
}

function resolveEmphasisLinkedMax(linkedMax, min) {
  return Math.max(min, linkedMax - (min === 0 ? 1 : 0));
}

function resolveLinkedCountControl(controls, emphasisControl) {
  if (!emphasisControl) return null;
  if (emphasisControl.maxFromKey) {
    return controls.find((control) => control.key === emphasisControl.maxFromKey) || null;
  }
  if (emphasisControl.key === 'focusCol' || emphasisControl.key === 'highlightCol') {
    return controls.find((control) => ['colCount', 'columnCount', 'columns'].includes(control.key)) || null;
  }
  if (emphasisControl.key === 'featureIndex') {
    return controls.find((control) => control.key === 'itemCount') || null;
  }
  return controls.find(isOptionalQuantityControl) || null;
}

function resolveControlValue(value, defaults) {
  if (typeof value === 'function') return value(defaults);
  return value;
}
