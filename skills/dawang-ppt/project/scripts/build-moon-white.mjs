import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildThemeModule, buildClientRuntimeFromModules } from '../src/components/themes/runtime-build.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'dist/theme-runtime');
buildThemeModule({ root, themeKey: 'theme17', outDir });
buildClientRuntimeFromModules({ root, outFile: path.join(outDir, 'imported-theme-runtime.theme17.js'), themeKeys: ['theme17'] });
console.log('Built theme17 module and browser runtime.');
