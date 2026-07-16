// 单一规范的「主题页 -> generated-metadata 记录」序列化。
// JAD-174:此前 update-generated-metadata.mjs(完整:含 clamp + theme09 修正)与
// import-claude-themes.jsx(只 normalizePublicControls)各写一份 generated-metadata.js,
// 导致导入产物不经第二遍 metadata:update 就不合 CI。两个 writer 现共用本模块,杜绝漂移。
import { normalizePublicControls, sanitizeImportedControls } from './control-naming.mjs';
import {
  clampCountControlLimits,
  clampDefaultCountProps,
  createContract,
  serializeValue,
} from './prop-contract-core.mjs';

export function serializePage(page) {
  const defaultProps = serializeValue(page.defaultProps || page.defaults || {}) || {};
  const controls = normalizePageControls(page, defaultProps);
  const serialized = {
    key: page.key,
    themeKey: page.themeKey,
    pageNumber: page.pageNumber,
    layout: page.layout,
    slot: page.slot,
    label: page.label,
    bgClass: page.bgClass || '',
    staticHtml: page.staticHtml || undefined,
    controls,
    defaultProps: clampDefaultCountProps(defaultProps, controls),
    // Carried through so createContract() below can see it; overwritten right after with the
    // normalized/validated form (same round-trip pattern as lengthBindings) so a bad hand-authored
    // entry (non-finite min/max) is dropped rather than silently round-tripped.
    ...(page.numberBounds ? { numberBounds: page.numberBounds } : {}),
  };
  const contract = createContract(serialized, page.themeKey);
  if (contract.lengthBindings?.length) serialized.lengthBindings = contract.lengthBindings;
  if (contract.numberBounds && Object.keys(contract.numberBounds).length) {
    serialized.numberBounds = contract.numberBounds;
  } else {
    delete serialized.numberBounds;
  }
  return serialized;
}

export function normalizePageControls(page, defaultProps) {
  const controls = normalizePublicControls(sanitizeImportedControls(page.controls || []), { layout: page.key, themeKey: page.themeKey })
    .map(control => page.themeKey === 'theme09' ? normalizeTheme09Control(control, page) : control);
  return clampCountControlLimits(controls, defaultProps)
    .map(control => Object.fromEntries(Object.entries(control).filter(([, value]) => value !== undefined)));
}

function normalizeTheme09Control(control, page) {
  return normalizeTheme09LabelTypeControl(
    normalizeTheme09HighlightColControl(
      normalizeTheme09FocusToggleControl(normalizeTheme09FocusControl(control, page), page),
      page,
    ),
  );
}

function normalizeTheme09LabelTypeControl(control) {
  if ((control.key || control.prop) !== 'labelType') return control;
  return {
    ...control,
    options: [
      { value: 'number', label: '数字' },
      { value: 'symbol', label: '符号' },
      { value: 'keyword', label: '关键词' },
    ],
  };
}

function normalizeTheme09HighlightColControl(control, page) {
  if ((control.key || control.prop) !== 'highlightCol') return control;
  if (control.maxFromKey || control.maxByKey || control.maxByValue) return control;
  const maxFromKey = ['colCount', 'columnCount'].find(key => hasControlOrDefault(page, key));
  if (!maxFromKey) return control;
  const maxSource = controlDefault(page, maxFromKey);
  return {
    ...control,
    max: Number.isFinite(maxSource) ? maxSource - 1 : control.max,
    maxFromKey,
    maxFromKeyOffset: -1,
  };
}

function hasControlOrDefault(page, key) {
  return Object.hasOwn(page.defaultProps || {}, key)
    || (page.controls || []).some(control => (control.key || control.prop) === key);
}

function controlDefault(page, key) {
  const fromDefaults = page.defaultProps?.[key];
  if (Number.isFinite(fromDefaults)) return fromDefaults;
  const fromControl = (page.controls || []).find(control => (control.key || control.prop) === key)?.default;
  return Number.isFinite(fromControl) ? fromControl : undefined;
}

function normalizeTheme09FocusControl(control, page) {
  if ((control.key || control.prop) !== 'focusIndex') return control;
  if (!isNumericFocusControl(control)) {
    const {
      displayOffset,
      max,
      maxFromKey,
      maxFromKeyOffset,
      maxByKey,
      maxByValue,
      ...rest
    } = control;
    return rest;
  }
  const next = {
    ...control,
    displayOffset: control.displayOffset ?? 1,
  };
  if (
    next.maxFromKey === undefined
    && next.maxByKey === undefined
    && next.maxByValue === undefined
  ) {
    const maxFromKey = theme09FocusMaxFromKey(page);
    if (maxFromKey) {
      const maxSource = controlDefault(page, maxFromKey);
      next.max = Number.isFinite(maxSource) ? maxSource - 1 : next.max;
      next.maxFromKey = maxFromKey;
      next.maxFromKeyOffset = -1;
    } else {
      if (next.max === 10) next.max = 9;
      if (next.max === undefined) next.max = 9;
    }
  }
  return next;
}

function normalizeTheme09FocusToggleControl(control, page) {
  if ((control.key || control.prop) !== 'focus') return control;
  if (!Object.hasOwn(page.defaultProps || {}, 'focus')) return control;
  return {
    ...control,
    default: page.defaultProps.focus,
  };
}

function theme09FocusMaxFromKey(page) {
  const explicit = {
    theme09_page001: 'metaCount',
    theme09_page002: 'indexCount',
    theme09_page003: 'fieldCount',
    theme09_page004: 'bandCount',
    theme09_page006: 'tickerCount',
    theme09_page008: 'statCount',
    theme09_page010: 'cardCount',
    theme09_page026: 'imgCount',
    theme09_page036: 'itemCount',
  }[page.key];
  if (explicit && hasControlOrDefault(page, explicit)) return explicit;
  return [
    'itemCount',
    'cardCount',
    'imgCount',
    'metaCount',
    'indexCount',
    'fieldCount',
    'bandCount',
    'tickerCount',
    'statCount',
    'supportCount',
    'caseCount',
    'seriesCount',
    'roundCount',
    'segCount',
    'catCount',
    'noteCount',
    'panelCount',
    'axisCount',
    'setCount',
    'rowCount',
    'colCount',
    'columnCount',
    'wordCount',
    'planCount',
    'stepCount',
    'laneCount',
    'phaseCount',
    'memberCount',
    'expCount',
  ].find(key => hasControlOrDefault(page, key));
}

function isNumericFocusControl(control) {
  return ['slider', 'range', 'number'].includes(String(control.type || '').toLowerCase());
}
