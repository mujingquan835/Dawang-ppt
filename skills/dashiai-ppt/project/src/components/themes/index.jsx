import React from 'react';
import { useSlideViewModel } from '../../view-model/context.jsx';
import {
  normalizeControlOptions,
  normalizeControlValue,
  normalizePublicControls,
} from '../../control-naming.mjs';
import {
  clampCountControlLimits,
  clampDefaultCountProps,
  serializeValue,
} from '../../prop-contract-core.mjs';
import { GENERATED_THEME_PAGES, GENERATED_THEME_PACKS } from './generated-metadata.js';
import { overrides as theme02Overrides } from './theme02/overrides.js';
import { overrides as theme03Overrides } from './theme03/overrides.js';
import { overrides as theme04Overrides } from './theme04/overrides.js';

// JAD-182:per-theme 控件特例集中到各 themeNN/overrides.js,index.jsx 通用消费(不造框架)。
const THEME_OVERRIDES = {
  theme02: theme02Overrides,
  theme03: theme03Overrides,
  theme04: theme04Overrides,
};

const REMOVED_CONTROL_TYPES = new Set(['text', 'string', 'input', 'url', 'email', 'textarea', 'multiline']);

export const THEME_PAGES = GENERATED_THEME_PAGES.map(applyThemePageDefaults);
export const THEME_PACK_OPTIONS = Object.fromEntries(
  GENERATED_THEME_PACKS.map(theme => [
    theme.key,
    {
      label: theme.label,
      displayName: theme.displayName,
      scenario: theme.scenario,
      audience: theme.audience,
      layouts: THEME_PAGES.filter(page => page.themeKey === theme.key).map(page => page.key),
    },
  ]),
);

const PAGES_BY_KEY = new Map(THEME_PAGES.map(page => [page.key, page]));

function applyThemePageDefaults(page) {
  const override = THEME_OVERRIDES[page.themeKey];
  if (!override) return page;
  let next = page;
  if (override.removeControlTypes) {
    const removed = new Set(override.removeControlTypes);
    next = {
      ...next,
      controls: (next.controls || []).filter(control => !removed.has(String(control?.type || '').toLowerCase())),
    };
  }
  if (override.injectControls) {
    const replaced = new Set(override.replaceKeys || []);
    next = {
      ...next,
      controls: [
        ...(next.controls || []).filter(control => !replaced.has(control.key)),
        ...override.injectControls,
      ],
      defaultProps: {
        ...(next.defaultProps || {}),
        ...(override.injectDefaults || {}),
        ...(override.preset3dBySlot?.[page.slot] || {}),
      },
    };
  }
  return next;
}

export function makeImportedThemePage(layoutKey) {
  const page = PAGES_BY_KEY.get(layoutKey);
  if (!page) throw new Error(`Unknown imported theme page "${layoutKey}"`);
  return function ImportedThemePage(props) {
    const viewModel = useSlideViewModel();
    const controls = normalizeControls(page.controls, page.defaultProps, page);
    const defaults = clampDefaultCountProps(serializeDefaults(page.defaultProps), controls);
    return (
      <section
        className={`slide imported-theme-slide ${page.bgClass || ''}`}
        data-layout={page.layout}
        data-vm-slide-id={viewModel?.id}
        data-vm-slide-key={viewModel?.key}
        data-vm-layout={viewModel?.layout}
        data-vm-index={viewModel?.index}
        data-theme-pack={viewModel?.themePack}
        data-logical-slide={viewModel?.logicalIndex}
        data-label={viewModel?.label || page.label}
      >
        <div
          className="imported-theme-root"
          data-theme-key={page.themeKey}
          data-page-key={page.key}
          data-prop-controls={JSON.stringify(controls)}
          data-prop-defaults={JSON.stringify(defaults)}
        />
      </section>
    );
  };
}

function normalizeControls(controls, defaults, page) {
  return clampCountControlLimits(normalizePublicControls((controls || [])
    .map(control => {
      const key = control.key || control.prop;
      if (!key) return null;
      const type = normalizeType(control.type);
      if (page?.themeKey !== 'theme04' && REMOVED_CONTROL_TYPES.has(String(control.type || type || '').toLowerCase())) return null;
      const options = normalizeControlOptions(serializeValue(control.options));
      const explicitDisplay = serializeValue(control.display);
      const next = {
        key,
        label: control.label || key,
        type,
        display: explicitDisplay,
        default: serializeValue(control.default ?? control.def ?? defaults[key]),
        min: serializeValue(resolveValue(control.min, defaults)),
        max: serializeValue(resolveValue(control.max, defaults)),
        step: serializeValue(control.step),
        options,
        countKey: serializeValue(control.countKey),
        countIndex: serializeValue(control.countIndex),
        maxFromKey: serializeValue(control.maxFromKey),
        maxFromKeyOffset: serializeValue(control.maxFromKeyOffset),
        maxByKey: serializeValue(control.maxByKey),
        maxByValue: serializeValue(control.maxByValue),
        displayOffset: serializeValue(control.displayOffset),
        dependsOn: serializeValue(control.dependsOn),
        dependsOnValue: serializeValue(control.dependsOnValue),
        dependsOnValues: serializeValue(control.dependsOnValues),
        mediaSlots: serializeValue(control.mediaSlots),
        desc: serializeValue(control.desc || control.description || control.describe),
      };
      const sourceType = String(control.type || '').toLowerCase();
      if (!explicitDisplay && type === 'select' && (sourceType === 'color' || sourceType === 'palette' || isThemeSwatchControl(page, key))) {
        next.display = 'color';
      }
      const optionCount = Array.isArray(options) ? options.length : 0;
      if (!explicitDisplay && type === 'select' && next.display !== 'color' && optionCount > 0 && optionCount <= 5) {
        next.display = 'tab';
      }
      return next;
    })
    .filter(Boolean), { layout: page?.key, themeKey: page?.themeKey }), serializeDefaults(defaults));
}

function isThemeSwatchControl(page, key) {
  return (THEME_OVERRIDES[page?.themeKey]?.swatchKeys || []).includes(key);
}

function normalizeType(type) {
  if (type === 'slider' || type === 'number') return 'range';
  if (type === 'icons') return 'icons';
  if (['enum', 'radio', 'select', 'segment', 'color', 'palette', 'labelType'].includes(type)) return 'select';
  if (['toggle', 'boolean', 'focus'].includes(type)) return 'toggle';
  return type || 'range';
}

function resolveValue(value, defaults) {
  if (typeof value === 'function') return value(defaults);
  return value;
}

function serializeDefaults(defaultProps) {
  return Object.fromEntries(
    Object.entries(defaultProps || {})
      .map(([key, value]) => [key, serializeValue(value)])
      .filter(([, value]) => value !== undefined),
  );
}
