import { GENERATED_THEME_PACKS, GENERATED_THEME_PAGES } from './generated-metadata.js';
import { OPEN_DESIGN_THEME_PACKS, OPEN_DESIGN_THEME_PAGES } from './open-design-bridge/definitions.mjs';

import { MOON_WHITE_PACKS, MOON_WHITE_PAGES } from './theme17/metadata.mjs';

export const THEME_CATALOG_PACKS = [...GENERATED_THEME_PACKS, ...OPEN_DESIGN_THEME_PACKS, ...MOON_WHITE_PACKS];
export const THEME_CATALOG_PAGES = [...GENERATED_THEME_PAGES, ...OPEN_DESIGN_THEME_PAGES, ...MOON_WHITE_PAGES];
