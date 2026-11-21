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
 <div class="deck-brand"><span class="deck-mark" aria-hidden="true"></span><span class="deck-name">${title}</span></div>
 <div class="deck-actions">
  <div id="deck-insert-tools" style="display:flex;align-items:center;gap:4px">
   <button type="button" id="deck-add-text" class="deck-button" title="插入文本框">+ 文本</button>
   <button type="button" id="deck-add-shape" class="deck-button" title="插入矩形色块">+ 色块</button>
   <button type="button" id="deck-add-image" class="deck-button" title="插入图片">+ 图片</button>
  </div>
  <button type="button" id="deck-present" class="deck-button">放映</button>
  <div class="deck-export" id="deck-export">
   <button type="button" id="deck-export-main" class="deck-button deck-primary" aria-haspopup="menu" aria-expanded="false">导出</button>
   <div class="deck-export-menu" id="deck-export-menu" role="menu" hidden>
    <button type="button" role="menuitem" data-export="pptx">PPTX（可编辑）</button>
    <button type="button" role="menuitem" data-export="pdf">PDF</button>
    <button type="button" role="menuitem" data-export="image">当前页图片</button>
    <button type="button" role="menuitem" data-export="html">HTML 副本</button>
   </div>
  </div>
 </div>
</header>
<main id="deck-main">
 <aside id="deck-rail" aria-label="页面">
  <div class="deck-rail-head"><span>页面</span><span id="deck-rail-count"></span></div>
  <ol id="deck-rail-list"></ol>
 </aside>
 <div id="deck-viewport">
  <div id="deck">${slides}</div>
  <nav id="deck-pager" aria-label="翻页"><button type="button" data-step="-1" aria-label="上一页">‹</button><span id="deck-page"></span><button type="button" data-step="1" aria-label="下一页">›</button></nav>
 </div>
 <aside id="deck-panel" aria-label="属性">
  <div id="deck-props-field" class="is-hidden"><div class="deck-panel-title">选中对象</div><div id="deck-props"></div></div>
  <p class="deck-panel-hint">单击选中对象，双击修改文字；方向键微调位置（Shift 10px），Delete 删除选中对象。</p>
  <p class="deck-font-note">本演示使用思源黑体（Source Han Sans SC）与优设标题黑。</p>
 </aside>
</main>
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
