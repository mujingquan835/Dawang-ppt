// Dawang-PPT deck page:
//   - writeDeck(project, outFile): writes served index.html + assets/
//   - writePortableDeckHtml(project, outFile, options): pure-Node single-file offline HTML builder
//     (zero Chrome launch, FontFace API detached WOFF2 fonts, pooled assets, inline editor + PPTX/PDF vendors).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSync } from 'esbuild';
import { SceneRoot } from '../scene/render.jsx';
import { validateProject } from '../project/schema.mjs';
import { PROJECT_ROOT, FONT_FILES, VENDOR_FILES, fontFaceCss, buildPortableFontEntries } from './assets.mjs';
import { AssetPool, MEDIA_KEYS } from '../portable/asset-pool.mjs';
import { assemblePortableHtmlParts, collectUsedFontFamilies } from '../portable/html.mjs';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const safeJson = (v) => JSON.stringify(v).replaceAll('<', '\\u003c');
const DECK_CSS = path.join(import.meta.dirname, 'deck.css');

function mimeForExt(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

// Slides in deck order. Deleted slides are left out; skipped ones stay in the page list but not in the show.
export function deckSlides(project) {
  const byId = new Map(project.slides.map((s) => [s.slideId, s]));
  const order = project.editorState?.slideOrder?.length ? project.editorState.slideOrder : project.slides.map((s) => s.slideId);
  const deleted = new Set(project.editorState?.deletedSlides || []);
  const ids = [...order, ...project.slides.map((s) => s.slideId).filter((id) => !order.includes(id))];
  return [...new Set(ids)].filter((id) => byId.has(id) && !deleted.has(id)).map((id) => byId.get(id));
}

export function slideMarkup(slide, project, skipped = false, resolveAssetUrl = null) {
  const body = renderToStaticMarkup(<SceneRoot slide={slide} project={project} resolveAssetUrl={resolveAssetUrl} />);
  return `<section class="slide fusion-slide" data-slide-id="${escapeHtml(slide.slideId)}" data-label="${escapeHtml(slide.label || slide.title || '')}"${skipped ? ' data-skipped="true"' : ''}>${body}</section>`;
}

export function renderDeckHtml(project) {
  const legacy = project.slides.filter((s) => s.mode !== 'composition');
  if (legacy.length) throw new Error('这份工程含旧模板页（' + legacy.map((s) => s.slideId).join('、') + '），当前版本只支持组版页。');
  const skipped = new Set(project.editorState?.skippedSlides || []);
  const slides = deckSlides(project).map((s) => slideMarkup(s, project, skipped.has(s.slideId))).join('');
  const title = escapeHtml(project.requirements?.title || '演示文稿');
  const used = collectUsedFontFamilies(null, project);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="Dawang-PPT">
<title>${title}</title>
<style id="deck-base-css">${fontFaceCss('assets/fonts/', used)}
${fs.readFileSync(DECK_CSS, 'utf8')}</style>
</head>
<body class="deck-editing">
<header id="deck-topbar">
 <div class="deck-top-left">
  <div class="deck-brand"><span class="deck-mark" aria-hidden="true">D</span><span class="deck-name" title="${title}">${title}</span></div>
 </div>
 <div id="deck-insert-tools" role="toolbar" aria-label="插入元素">
  <button type="button" id="deck-add-text" class="deck-tool-btn" title="插入文本框"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3.5h10M8 3.5v9.5M5.5 13h5"/></svg><span>文本</span></button>
  <button type="button" id="deck-add-shape" class="deck-tool-btn" title="插入矩形色块"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2.5" y="3.5" width="11" height="9" rx="2"/></svg><span>形状</span></button>
  <button type="button" id="deck-add-image" class="deck-tool-btn" title="插入本地图片"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="2.8" width="12" height="10.4" rx="2"/><circle cx="5.8" cy="6.2" r="1.1"/><path d="M2.5 11.4 6.2 8l2.8 2.6 2-1.8 2.5 2.4"/></svg><span>图片</span></button>
 </div>
 <div class="deck-actions">
  <button type="button" id="deck-present" class="deck-button" title="全屏放映（Esc 退出）"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 3.2 12.6 8l-8.1 4.8V3.2Z"/></svg><span>放映</span></button>
  <div class="deck-export" id="deck-export">
   <button type="button" id="deck-export-main" class="deck-button deck-primary" aria-haspopup="menu" aria-expanded="false"><span>导出</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg></button>
   <div class="deck-export-menu" id="deck-export-menu" role="menu" hidden>
    <button type="button" role="menuitem" data-export="pptx"><span>PPTX 演示文稿</span><span class="menu-sub">原生可编辑</span></button>
    <button type="button" role="menuitem" data-export="pdf"><span>PDF 文档</span><span class="menu-sub">高清打印</span></button>
    <button type="button" role="menuitem" data-export="image"><span>当前页图片</span><span class="menu-sub">1080p PNG</span></button>
    <button type="button" role="menuitem" data-export="html"><span>HTML 副本</span><span class="menu-sub">离线单文件</span></button>
   </div>
  </div>
 </div>
</header>
<main id="deck-main">
 <aside id="deck-rail" aria-label="页面">
  <div class="deck-rail-head"><div class="deck-rail-meta"><span>页面</span><span id="deck-rail-count"></span></div><button type="button" id="deck-add-slide" title="新增空白页">+ 新建</button></div>
  <ol id="deck-rail-list"></ol>
 </aside>
 <div id="deck-viewport">
  <div id="deck">${slides}</div>
  <div id="deck-dock">
   <nav id="deck-pager" aria-label="翻页"><button type="button" data-step="-1" aria-label="上一页">‹</button><span id="deck-page"></span><button type="button" data-step="1" aria-label="下一页">›</button></nav>
   <span class="deck-dock-sep" aria-hidden="true"></span>
   <div id="deck-zoom" aria-label="画布缩放"><button type="button" id="deck-zoom-out" title="缩小">−</button><button type="button" id="deck-zoom-fit" title="重置为适应窗口（⌘0）">适应</button><button type="button" id="deck-zoom-in" title="放大">+</button></div>
  </div>
 </div>
 <aside id="deck-panel" aria-label="属性">
  <div id="deck-props-field" class="is-hidden"><div class="deck-panel-title">选中对象</div><div id="deck-props"></div></div>
  <div id="deck-empty-panel"></div>
  <p class="deck-font-note">本演示使用思源黑体（Source Han Sans SC）与优设标题黑。</p>
 </aside>
</main>
<div id="fusion-status" role="status" aria-live="polite"></div>
<script id="fusion-project" type="application/json">${safeJson(project)}</script>
<script src="assets/fusion-editor.js"></script>
</body>
</html>
`;
}

const ENTRY = path.join(PROJECT_ROOT, 'src/fusion/editor/browser.jsx');
function sourceFingerprint() {
  const hash = createHash('sha256');
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) walk(file);
      else if (/\.(mjs|jsx|js|json|css)$/.test(name)) hash.update(name).update(String(stat.size)).update(String(stat.mtimeMs));
    }
  };
  walk(path.join(PROJECT_ROOT, 'src/fusion'));
  return hash.digest('hex').slice(0, 16);
}

export function editorBundle() {
  const file = path.join(PROJECT_ROOT, 'dist', `fusion-editor-${sourceFingerprint()}.js`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    buildSync({
      entryPoints: [ENTRY],
      outfile: tmp,
      bundle: true,
      format: 'iife',
      platform: 'browser',
      jsx: 'automatic',
      minify: true,
      legalComments: 'eof',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
    fs.renameSync(tmp, file);
  }
  return file;
}

export function writeDeck(project, outFile) {
  const issues = validateProject(project);
  if (issues.length) throw new Error(issues.join('\n'));
  const dir = path.dirname(outFile);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(outFile, renderDeckHtml(project));
  for (const { from, to } of [...FONT_FILES, ...VENDOR_FILES]) {
    const target = path.join(dir, to);
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(PROJECT_ROOT, from), target);
  }
  fs.copyFileSync(editorBundle(), path.join(dir, 'assets/fusion-editor.js'));
  return { revision: project.revision, slides: project.slides.length, outFile };
}

// Pure-Node single-file portable HTML builder (no Chrome launch, detached WOFF2 FontFace payload, pooled images).
export function buildPortableDeckHtmlInNode(project, { baseDir = process.cwd(), fontEntries = null } = {}) {
  const issues = validateProject(project);
  if (issues.length) throw new Error(issues.join('\n'));
  const legacy = project.slides.filter((s) => s.mode !== 'composition');
  if (legacy.length) throw new Error('这份工程含旧模板页（' + legacy.map((s) => s.slideId).join('、') + '），当前版本只支持组版页。');

  const pool = new AssetPool();
  const resolveLocalMedia = (value, key = '') => {
    if (Array.isArray(value)) return value.map((v) => resolveLocalMedia(v, key));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = resolveLocalMedia(v, k);
      return out;
    }
    if (typeof value === 'string' && value && MEDIA_KEYS.has(key)) {
      if (value.startsWith('portable-asset:')) return value;
      if (value.startsWith('data:')) return pool.register(value);
      const abs = value.startsWith('file:') ? fileURLToPath(value) : path.resolve(baseDir, value);
      if (fs.existsSync(abs)) {
        const dataUrl = `data:${mimeForExt(abs)};base64,${fs.readFileSync(abs).toString('base64')}`;
        return pool.register(dataUrl);
      }
    }
    return value;
  };

  const tokenizedProject = resolveLocalMedia(structuredClone(project));
  const skipped = new Set(tokenizedProject.editorState?.skippedSlides || []);
  const slidesHtml = deckSlides(tokenizedProject)
    .map((s) => slideMarkup(s, tokenizedProject, skipped.has(s.slideId)))
    .join('');

  const used = collectUsedFontFamilies(null, tokenizedProject);
  // Always ensure both dual-font families are embedded by default so offline editing can switch freely
  if (!used.has('oppo sans 4.0')) {
    used.add('source han sans sc');
    used.add('youshebiaotihei');
  }
  const fonts = fontEntries || buildPortableFontEntries(used, PROJECT_ROOT);

  const editorCode = fs.readFileSync(editorBundle(), 'utf8');
  const vendorScripts = VENDOR_FILES.map(({ from, to }) => {
    const abs = path.join(PROJECT_ROOT, from);
    return fs.existsSync(abs) ? { src: to, code: fs.readFileSync(abs, 'utf8') } : null;
  }).filter(Boolean);

  const runtimeFingerprint = createHash('sha256').update(editorCode).digest('hex');
  const meta = {
    version: 1,
    projectId: tokenizedProject.requirements.projectId,
    baseRevision: tokenizedProject.revision,
    snapshotRevision: tokenizedProject.revision,
    runtimeFingerprint,
  };

  const parts = assemblePortableHtmlParts({
    title: tokenizedProject.requirements?.title || '演示文稿',
    deckCss: fs.readFileSync(DECK_CSS, 'utf8'),
    slidesHtml,
    projectJson: safeJson(tokenizedProject),
    assetsJson: safeJson(pool.toObject()),
    fontsJson: safeJson(fonts),
    metaJson: safeJson(meta),
    vendorScripts,
    editorScript: editorCode,
  });
  return {
    html: parts.join(''),
    parts,
    assetPool: pool,
    tokenizedProject,
    fontCount: fonts.length,
  };
}

export function writePortableDeckHtml(project, outFile, options = {}) {
  const built = buildPortableDeckHtmlInNode(project, options);
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  const tmp = outFile + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, built.html);
    fs.renameSync(tmp, outFile);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return {
    outFile,
    revision: project.revision,
    slides: project.slides.length,
    bytes: Buffer.byteLength(built.html, 'utf8'),
    assets: built.assetPool.size,
    fonts: built.fontCount,
    assetPool: built.assetPool,
    tokenizedProject: built.tokenizedProject,
  };
}
