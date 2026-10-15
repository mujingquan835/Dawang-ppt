import { THEME_CATALOG_PACKS } from './components/themes/theme-catalog.js';

export const ACCEPTED_THEME_KEYS = THEME_CATALOG_PACKS.map(theme => theme.key);

const ACCEPTED_THEME_KEY_SET = new Set(ACCEPTED_THEME_KEYS);

export function isAcceptedThemeKey(themeKey) {
  return ACCEPTED_THEME_KEY_SET.has(themeKey);
}

export function filterAcceptedThemePacks(packs = []) {
  return packs.filter(theme => isAcceptedThemeKey(theme.key));
}

export function filterAcceptedThemePages(pages = []) {
  return pages.filter(page => isAcceptedThemeKey(page.themeKey));
}
