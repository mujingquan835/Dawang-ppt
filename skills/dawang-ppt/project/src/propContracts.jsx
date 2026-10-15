import { THEME_PAGES } from './components/themes/index.jsx';
import {
  COUNT_ARRAY_BINDINGS,
  buildLayoutManifestFromContracts,
  createLazyLayoutContracts,
  normalizeSlidePropsForContract,
} from './prop-contract-core.mjs';

export { COUNT_ARRAY_BINDINGS };

const CONTRACTS = createLazyLayoutContracts(THEME_PAGES);

export function getLayoutContract(layout) {
  return CONTRACTS.get(layout) || null;
}

export function normalizeSlidePropsForLayout(layout, props = {}) {
  return normalizeSlidePropsForContract(layout, props, getLayoutContract(layout));
}

export function buildLayoutManifest() {
  return buildLayoutManifestFromContracts(CONTRACTS);
}
