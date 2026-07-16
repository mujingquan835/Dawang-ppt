// JAD-203:交付件浏览器运行时(imported-theme-runtime.js)的构建配置与构建器。
//
// 单一事实来源:client-runtime.jsx 经 `@dashi/theme-registry` 别名引入注册表。两条等价路径:
//   - 源路径(dev):别名指向「全主题签入注册表」或「按 deck 裁剪的源注册表」(引 themeNN/runtime.jsx + 源 context)。
//   - 模块路径(安装版):别名指向「引预构建 minified 模块(themeNN.module.mjs)的注册表」,
//     安装版无可读主题 *.jsx 源也能链接出与源路径等价的运行时(单一 React,水合行为一致)。
//
// 预构建产物(build-theme-runtime.mjs 产出,sync 随 skill 发):
//   <THEME_RUNTIME_DIR>/<themeKey>.module.mjs            —— 每主题 minified ESM 模块(react external)。
//   <THEME_RUNTIME_DIR>/imported-theme-runtime.<key>.js  —— 每主题自包含 IIFE(= 模块路径 [单主题]),单主题 deck 直接拷贝。
import fs from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';
import {
  buildThemeModuleEntrySource,
  buildThemeRegistrySource,
} from './theme-registry-codegen.mjs';

// 相对 ROOT(= 仓库根 / 安装版 project 根)。dist/ 在 .gitignore,但随 skill:sync 发到 project/。
export const THEME_RUNTIME_DIR = 'dist/theme-runtime';

// 主题模块对 react 全部 external —— 由外层 client-runtime 打包统一解析,确保单一 React 实例。
const REACT_EXTERNALS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

// JAD-203 修复:把所有 react 子路径别名到 `<root>/node_modules` 下的单一绝对路径。
//
// 根因:模块路径是两段式 bundle —— client-runtime.jsx(在 ROOT/src)与预构建的 *.module.mjs
// (写到 outDir,sync 时即安装版 project/dist)由外层 esbuild 一起打包;后者对 react external,
// 其裸 `import "react"` 由 esbuild 相对「模块文件所在目录」解析。当 outDir 不在 ROOT 的
// node_modules 解析链上(安装版 sync:root=dev 仓、outDir=安装版),或 outDir 旁存在另一份
// react 时,两个 importer 各自解析到不同的 react 物理副本 → 打进两份 React → react-dom 的
// dispatcher 装在副本 A,组件经副本 B 调 hook 取到 null dispatcher → 浏览器水合
// `Cannot read properties of null (reading 'useMemo')`、整片空白。
// nodePaths 只是「找不到时」的回退锚点,挡不住「相对 importer 已能找到另一份 react」。
// 用绝对路径别名强制所有 react specifier 指向同一份,彻底去重(对源路径无影响:本就是同一份)。
function reactAliasMap(root) {
  const nm = path.join(root, 'node_modules');
  return {
    react: path.join(nm, 'react'),
    'react-dom': path.join(nm, 'react-dom'),
    'react-dom/client': path.join(nm, 'react-dom/client.js'),
    'react/jsx-runtime': path.join(nm, 'react/jsx-runtime.js'),
    'react/jsx-dev-runtime': path.join(nm, 'react/jsx-dev-runtime.js'),
  };
}

export function themeModuleFileName(themeKey) {
  return `${themeKey}.module.mjs`;
}

export function themeBundleFileName(themeKey) {
  return `imported-theme-runtime.${themeKey}.js`;
}

export function prebuiltBundlePath(root, themeKey) {
  return path.join(root, THEME_RUNTIME_DIR, themeBundleFileName(themeKey));
}

export function prebuiltModulePath(root, themeKey) {
  return path.join(root, THEME_RUNTIME_DIR, themeModuleFileName(themeKey));
}

// 共享的 client-runtime 打包配置。源路径与模块路径只在 registryPath(别名目标)上不同 ——
// 其余完全一致,保证两条路径产出等价(JAD-201 的源路径行为不变)。
function clientRuntimeBuildOptions({ root, outFile, registryPath }) {
  return {
    entryPoints: [path.join(root, 'src/components/themes/client-runtime.jsx')],
    outfile: outFile,
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'DeckJsxRuntime',
    platform: 'browser',
    jsx: 'automatic',
    alias: {
      '@dashi/theme-registry': registryPath,
      // 强制 react 各子路径解析到 ROOT 的单一副本(去重根因,见 reactAliasMap)。
      ...reactAliasMap(root),
    },
    loader: {
      '.css': 'text',
    },
    inject: [path.join(root, 'src/react-shim.js')],
    // 链接到的预构建模块可能位于无 node_modules 的目录(如 sync 写入的 project/dist)。
    // nodePaths 是回退解析锚点;主题源路径正常解析时不会用到,故不改变 JAD-201 的源路径产出。
    nodePaths: [path.join(root, 'node_modules')],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    logLevel: 'silent',
  };
}

export function buildClientRuntime({ root, outFile, registryPath }) {
  buildSync(clientRuntimeBuildOptions({ root, outFile, registryPath }));
}

// 把一组预构建主题模块链接成交付件运行时(安装版/模块路径)。registryPath 临时生成,引
// <moduleDir>/<themeKey>.module.mjs;外层 esbuild 把这些模块 + react 一起打包(单一 React)。
export function buildClientRuntimeFromModules({ root, outFile, themeKeys, moduleDir = path.join(root, THEME_RUNTIME_DIR), cacheDir }) {
  const importPrefix = `${moduleDir}${path.sep}`;
  const source = buildThemeRegistrySource(themeKeys, { importPrefix, fromModules: true, generated: false });
  const { registryPath, cleanup } = writeTempRegistry(root, source, cacheDir);
  try {
    buildClientRuntime({ root, outFile, registryPath });
  } finally {
    cleanup();
  }
}

// 从主题源码(themeNN/runtime.jsx + 源 context)预构建该主题的 minified ESM 模块。
// react external,供模块路径链接;.jsx/.css 在此一次性内联+minify,产物不含可读组件源。
export function buildThemeModule({ root, themeKey, outDir }) {
  const themesDir = path.join(root, 'src/components/themes');
  const entrySource = buildThemeModuleEntrySource(themeKey, { importPrefix: `${themesDir}${path.sep}` });
  const cacheDir = path.join(root, 'node_modules/.cache/dashi-theme-runtime-build');
  fs.mkdirSync(cacheDir, { recursive: true });
  const entryPath = path.join(cacheDir, `module-entry-${themeKey}-${process.pid}-${Date.now()}-${rand()}.jsx`);
  fs.writeFileSync(entryPath, entrySource);
  const outFile = path.join(outDir, themeModuleFileName(themeKey));
  fs.mkdirSync(outDir, { recursive: true });
  try {
    buildSync({
      entryPoints: [entryPath],
      outfile: outFile,
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      jsx: 'automatic',
      external: REACT_EXTERNALS,
      loader: {
        '.css': 'text',
      },
      inject: [path.join(root, 'src/react-shim.js')],
      nodePaths: [path.join(root, 'node_modules')],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      logLevel: 'silent',
    });
  } finally {
    try { fs.rmSync(entryPath, { force: true }); } catch {}
  }
  return outFile;
}

function writeTempRegistry(root, source, cacheDirOverride) {
  const cacheDir = cacheDirOverride || path.join(root, 'node_modules/.cache/dashi-theme-registry');
  fs.mkdirSync(cacheDir, { recursive: true });
  const registryPath = path.join(cacheDir, `registry-${process.pid}-${Date.now()}-${rand()}.jsx`);
  fs.writeFileSync(registryPath, source);
  return {
    registryPath,
    cleanup: () => { try { fs.rmSync(registryPath, { force: true }); } catch {} },
  };
}

function rand() {
  return Math.random().toString(36).slice(2);
}
