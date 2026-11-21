import { validateProject } from '../project/schema.mjs';

const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const safeScript = (text) => String(text ?? '').replace(/<\/script/gi, '<\\/script');
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Undo history repeats slides, so inlining media in the project grew the file by every image on each edit.
// The embedded project keeps short tokens instead; each image is stored once in #portable-assets and resolved
// on demand via AssetPool (in browser) or inflatePortableAssets (on import).
const MEDIA_KEYS = new Set(['src', 'image', 'images', 'imageSrc', 'imageUrl', 'heroImage', 'coverImage']);
const ASSET_PREFIX = 'portable-asset:';

const mapStrings = (value, fn, key = '') =>
  Array.isArray(value)
    ? value.map((v) => mapStrings(v, fn, key))
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn, k)]))
      : typeof value === 'string' && MEDIA_KEYS.has(key)
        ? fn(value)
        : value;

export function poolProjectMedia(project, shared) {
  const pool = shared?.pool || {};
  const tokens = shared?.tokens || new Map();
  // Preserve existing pool mappings if shared.pool already has entries
  if (shared?.pool && !tokens.size) {
    for (const [t, v] of Object.entries(shared.pool)) tokens.set(v, t);
  }
  const token = (v) => {
    if (!v.startsWith('data:')) return v;
    if (!tokens.has(v)) {
      const t = ASSET_PREFIX + (tokens.size + 1);
      tokens.set(v, t);
      pool[t] = v;
    }
    return tokens.get(v);
  };
  return { project: mapStrings(project, token), pool, tokens };
}

export function inflatePortableAssets(project, pool) {
  return pool && Object.keys(pool).length
    ? mapStrings(project, (v) => (v.startsWith(ASSET_PREFIX) && pool[v] ? pool[v] : v))
    : project;
}

function optionalBlock(html, id) {
  try {
    return block(html, id);
  } catch {
    return null;
  }
}

function block(html, id) {
  const match = new RegExp(
    '<script\\b(?=[^>]*\\bid=["\']' + id + '["\'])(?=[^>]*\\btype=["\']application/json["\'])[^>]*>([\\s\\S]*?)</script>',
    'i'
  ).exec(html);
  if (!match) throw Error('Supported portable snapshot missing: ' + id);
  return JSON.parse(match[1]);
}

export function extractPortableMeta(html) {
  const meta = block(html, 'portable-project-meta');
  if (
    meta.version !== 1 ||
    !['projectId', 'baseRevision', 'snapshotRevision', 'runtimeFingerprint'].every(
      (k) => typeof meta[k] === 'string' && meta[k]
    )
  ) {
    throw Error('Unsupported portable metadata');
  }
  return meta;
}

export function extractPortableProject(html) {
  const meta = extractPortableMeta(html);
  const project = inflatePortableAssets(block(html, 'fusion-project'), optionalBlock(html, 'portable-assets'));
  const issues = validateProject(project);
  if (
    issues.length ||
    !project.slides?.length ||
    meta.projectId !== project.requirements.projectId ||
    meta.snapshotRevision !== project.revision
  ) {
    throw Error('Invalid portable snapshot: ' + issues.join(', '));
  }
  return project;
}

export function validatePortableHtml(html) {
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (whole) => whole.slice(0, whole.indexOf('>') + 1) + '</script>')
    .replace(/<!--[\s\S]*?-->/g, '');
  const unresolvedResources = [];
  for (const tag of markup.matchAll(/<(?:script|img|source|video|audio|iframe|link)\b[^>]*>/gi)) {
    for (const m of tag[0].matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
      if (!/^(data:|#|portable-asset:)/i.test(m[1])) unresolvedResources.push(m[1]);
    }
  }
  const styles = [...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .concat([...markup.matchAll(/\bstyle="([^"]*)"/gi)].map((m) => m[1].replaceAll('&quot;', '"')))
    .join('\n');
  for (const m of styles.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) {
    if (!/^(data:|#)/i.test(m[1])) unresolvedResources.push(m[1]);
  }
  const issues = [];
  try {
    const p = extractPortableProject(html);
    const walk = (value, key = '') => {
      if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, Array.isArray(value) ? key : k);
      } else if (
        typeof value === 'string' &&
        MEDIA_KEYS.has(key) &&
        !value.startsWith('data:')
      ) {
        unresolvedResources.push(value);
      }
    };
    walk(p);
  } catch (error) {
    issues.push(error.message);
  }
  return { ok: !unresolvedResources.length && !issues.length, unresolvedResources: [...new Set(unresolvedResources)], issues };
}

const fontKey = (family) => family.trim().replace(/^['"]|['"]$/g, '').toLowerCase();

export function collectUsedFontFamilies(doc, project) {
  const used = new Set();
  const add = (stack) => {
    for (const family of String(stack || '').split(',')) {
      if (family.trim()) used.add(fontKey(family));
    }
  };
  if (doc) {
    for (const el of doc.querySelectorAll('*')) {
      add(getComputedStyle(el).fontFamily);
      for (const pseudo of ['::before', '::after']) {
        const c = getComputedStyle(el, pseudo);
        if (c.content && !['none', 'normal'].includes(c.content)) add(c.fontFamily);
      }
    }
  }
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if ((k === 'fontFamily' || k === 'heading' || k === 'body') && typeof v === 'string') add(v);
        else walk(v);
      }
    }
  };
  walk(project?.slides);
  walk(project?.designChoice);
  return used;
}

export function dropUnusedFontFaces(text, used) {
  return text.replace(/@font-face\s*{[^}]*}/gi, (rule) => {
    const family = /font-family\s*:\s*([^;}]+)/i.exec(rule)?.[1];
    return !family || used.has(fontKey(family)) ? rule : '';
  });
}

// Assemble a self-contained portable HTML document as an array of string parts (zero-copy Blob friendly).
// Fonts live in #portable-fonts (loaded via FontFace API) instead of <style>, keeping live DOM tiny.
export function assemblePortableHtmlParts({
  title,
  deckCss,
  slidesHtml,
  projectJson,
  assetsJson,
  fontsJson,
  metaJson,
  vendorScripts = [],
  editorScript = '',
  fontNote = '本演示使用思源黑体（Source Han Sans SC）与优设标题黑。',
}) {
  const safeTitle = escapeHtml(title || '演示文稿');
  const parts = [
    '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="generator" content="Dawang-PPT">\n<title>',
    safeTitle,
    '</title>\n<style id="deck-base-css">',
    deckCss || '',
    '</style>\n',
  ];

  // Detached JSON payloads: fonts, assets, project, metadata
  parts.push('<script id="portable-fonts" type="application/json">', fontsJson || '[]', '</script>\n');
  parts.push('<script id="portable-assets" type="application/json">', assetsJson || '{}', '</script>\n');
  parts.push('<script id="fusion-project" type="application/json">', projectJson || '{}', '</script>\n');
  parts.push('<script id="portable-project-meta" type="application/json">', metaJson || '{}', '</script>\n');

  for (const v of vendorScripts) {
    if (!v?.code) continue;
    parts.push('<script data-portable-vendor="', escapeHtml(v.src || ''), '">', safeScript(v.code), '</script>\n');
  }

  parts.push(
    '</head>\n<body class="deck-editing">\n',
    '<header id="deck-topbar">\n',
    ' <div class="deck-top-left">\n',
    '  <div class="deck-brand"><span class="deck-mark" aria-hidden="true">D</span><span class="deck-name" title="',
    safeTitle,
    '">',
    safeTitle,
    '</span></div>\n',
    ' </div>\n',
    ' <div id="deck-insert-tools" role="toolbar" aria-label="插入元素">\n',
    '  <button type="button" id="deck-add-text" class="deck-tool-btn" title="插入文本框"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3.5h10M8 3.5v9.5M5.5 13h5"/></svg><span>文本</span></button>\n',
    '  <button type="button" id="deck-add-shape" class="deck-tool-btn" title="插入矩形色块"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2.5" y="3.5" width="11" height="9" rx="2"/></svg><span>形状</span></button>\n',
    '  <button type="button" id="deck-add-image" class="deck-tool-btn" title="插入本地图片"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="2.8" width="12" height="10.4" rx="2"/><circle cx="5.8" cy="6.2" r="1.1"/><path d="M2.5 11.4 6.2 8l2.8 2.6 2-1.8 2.5 2.4"/></svg><span>图片</span></button>\n',
    ' </div>\n',
    ' <div class="deck-actions">\n',
    '  <button type="button" id="deck-present" class="deck-button" title="全屏放映（Esc 退出）"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 3.2 12.6 8l-8.1 4.8V3.2Z"/></svg><span>放映</span></button>\n',
    '  <div class="deck-export" id="deck-export">\n',
    '   <button type="button" id="deck-export-main" class="deck-button deck-primary" aria-haspopup="menu" aria-expanded="false"><span>导出</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg></button>\n',
    '   <div class="deck-export-menu" id="deck-export-menu" role="menu" hidden>\n',
    '    <button type="button" role="menuitem" data-export="pptx"><span>PPTX 演示文稿</span><span class="menu-sub">原生可编辑</span></button>\n',
    '    <button type="button" role="menuitem" data-export="pdf"><span>PDF 文档</span><span class="menu-sub">高清打印</span></button>\n',
    '    <button type="button" role="menuitem" data-export="image"><span>当前页图片</span><span class="menu-sub">1080p PNG</span></button>\n',
    '    <button type="button" role="menuitem" data-export="html"><span>HTML 副本</span><span class="menu-sub">离线单文件</span></button>\n',
    '   </div>\n',
    '  </div>\n',
    ' </div>\n',
    '</header>\n',
    '<main id="deck-main">\n',
    ' <aside id="deck-rail" aria-label="页面">\n',
    '  <div class="deck-rail-head"><div class="deck-rail-meta"><span>页面</span><span id="deck-rail-count"></span></div><button type="button" id="deck-add-slide" title="新增空白页">+ 新建</button></div>\n',
    '  <ol id="deck-rail-list"></ol>\n',
    ' </aside>\n',
    ' <div id="deck-viewport">\n',
    '  <div id="deck">',
    slidesHtml || '',
    '</div>\n',
    '  <div id="deck-dock">\n',
    '   <nav id="deck-pager" aria-label="翻页"><button type="button" data-step="-1" aria-label="上一页">‹</button><span id="deck-page"></span><button type="button" data-step="1" aria-label="下一页">›</button></nav>\n',
    '   <span class="deck-dock-sep" aria-hidden="true"></span>\n',
    '   <div id="deck-zoom" aria-label="画布缩放"><button type="button" id="deck-zoom-out" title="缩小">−</button><button type="button" id="deck-zoom-fit" title="重置为适应窗口（⌘0）">适应</button><button type="button" id="deck-zoom-in" title="放大">+</button></div>\n',
    '  </div>\n',
    ' </div>\n',
    ' <aside id="deck-panel" aria-label="属性">\n',
    '  <div id="deck-props-field" class="is-hidden"><div class="deck-panel-title">选中对象</div><div id="deck-props"></div></div>\n',
    '  <div id="deck-empty-panel"></div>\n',
    '  <p class="deck-font-note">',
    escapeHtml(fontNote),
    '</p>\n',
    ' </aside>\n',
    '</main>\n',
    '<div id="fusion-status" role="status" aria-live="polite"></div>\n',
    '<script id="dawang-editor-runtime">',
    safeScript(editorScript),
    '</script>\n</body>\n</html>\n'
  );
  return parts;
}

// Fast zero-clone browser serializer for saving/exporting an already-portable (or served) deck HTML.
// Never clones document.documentElement or regex-scans megabytes of CSS; reuses raw font/vendor script blocks verbatim.
export async function serializePortablePartsFast({
  document: doc,
  project,
  assetPool,
  baseRevision,
  runtimeFingerprint,
}) {
  // 1. Clean slide markup: clone ONLY #deck (tiny: ~50-200 KB without base64 images) and swap blob: -> portable-asset: token
  const deckClone = doc.getElementById('deck').cloneNode(true);
  deckClone.querySelectorAll('.fusion-selection,.fusion-guide,.fusion-crop-editor').forEach((n) => n.remove());
  deckClone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
  const PLACEHOLDER_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  deckClone.querySelectorAll('img[data-asset-token]').forEach((img) => {
    img.setAttribute('src', PLACEHOLDER_GIF);
  });
  // Ensure any remaining relative img src (in served mode) is captured into assetPool
  const base = doc.baseURI || globalThis.document?.baseURI;
  const fetchToDataUrl = async (url) => {
    const resp = await fetch(new URL(url, base));
    if (!resp.ok) throw Error('Required portable asset: ' + url);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const mime = resp.headers.get('content-type') || 'application/octet-stream';
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return 'data:' + mime + ';base64,' + btoa(bin);
  };
  for (const img of deckClone.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('portable-asset:') || src.startsWith('data:')) continue;
    const dataUrl = await fetchToDataUrl(src);
    const token = assetPool.register(dataUrl);
    img.setAttribute('data-asset-token', token);
    img.setAttribute('src', token);
  }

  // 2. Ensure project media entries are tokenized into assetPool
  const cleanProject = structuredClone(project);
  const resolveMediaWalk = async (value, key = '') => {
    if (Array.isArray(value)) return Promise.all(value.map((v) => resolveMediaWalk(v, key)));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = await resolveMediaWalk(v, k);
      return out;
    }
    if (typeof value === 'string' && value && MEDIA_KEYS.has(key)) {
      if (value.startsWith(ASSET_PREFIX)) return value;
      if (value.startsWith('data:')) return assetPool.register(value);
      const dataUrl = await fetchToDataUrl(value);
      return assetPool.register(dataUrl);
    }
    return value;
  };
  const tokenizedProject = await resolveMediaWalk(cleanProject);

  // 3. Reuse detached #portable-fonts verbatim (zero decoding, zero copying into <style>)
  const fontsNode = doc.getElementById('portable-fonts');
  const fontsJson = fontsNode ? fontsNode.textContent : '[]';

  // 4. Clean base CSS (strip any legacy inline @font-face if #portable-fonts is present)
  const baseStyleNode = doc.getElementById('deck-base-css') || doc.querySelector('head style');
  let deckCss = baseStyleNode ? baseStyleNode.textContent : '';
  if (fontsNode && fontsJson.length > 4) {
    deckCss = deckCss.replace(/@font-face\s*\{[^}]*\}/gi, '').trim();
  }

  // 5. Reuse inlined vendor scripts and editor runtime verbatim (or fetch once if in served mode)
  const vendorList = ['assets/vendor/html-to-image.js', 'assets/vendor/pdf-lib.min.js', 'assets/vendor/pptxgen.bundle.js'];
  const vendorScripts = [];
  for (const src of vendorList) {
    const existing = doc.querySelector(`script[data-portable-vendor="${src}"]`);
    if (existing && !existing.getAttribute('src') && existing.textContent.trim()) {
      vendorScripts.push({ src, code: existing.textContent });
    } else {
      const resp = await fetch(new URL(src, base));
      if (resp.ok) vendorScripts.push({ src, code: await resp.text() });
    }
  }

  let editorScript = doc.getElementById('dawang-editor-runtime')?.textContent || '';
  if (!editorScript) {
    const edTag = [...doc.querySelectorAll('script')].find((s) => s.getAttribute('src')?.includes('fusion-editor.js'));
    if (edTag) {
      const resp = await fetch(new URL(edTag.getAttribute('src'), base));
      if (resp.ok) editorScript = await resp.text();
    } else {
      // Fallback for already-inlined older portable HTML
      const inlineScripts = [...doc.querySelectorAll('script:not([type="application/json"]):not([data-portable-vendor])')];
      editorScript = inlineScripts.map((s) => s.textContent).join('\n');
    }
  }

  // 6. Compute / reuse runtime fingerprint
  const oldMetaNode = doc.getElementById('portable-project-meta');
  const previous = oldMetaNode ? JSON.parse(oldMetaNode.textContent) : null;
  let fp = runtimeFingerprint || previous?.runtimeFingerprint;
  if (!fp) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editorScript));
    fp = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const meta = {
    version: 1,
    projectId: tokenizedProject.requirements.projectId,
    baseRevision: previous?.baseRevision || baseRevision || tokenizedProject.revision,
    snapshotRevision: tokenizedProject.revision,
    runtimeFingerprint: fp,
  };

  return assemblePortableHtmlParts({
    title: tokenizedProject.requirements?.title || doc.title || '演示文稿',
    deckCss,
    slidesHtml: deckClone.innerHTML,
    projectJson: safeJson(tokenizedProject),
    assetsJson: safeJson(assetPool.toObject()),
    fontsJson,
    metaJson: safeJson(meta),
    vendorScripts,
    editorScript,
    fontNote: doc.querySelector('.deck-font-note')?.textContent || undefined,
  });
}

// Backward-compatible DOM serializer (still exported for legacy callers/tests).
export async function serializePortableHtml({ document: doc, project, resolveAsset, baseRevision, runtimeFingerprint, usedFontFamilies }) {
  const clone = doc.documentElement ? doc.documentElement.cloneNode(true) : doc;
  const base = doc.baseURI || globalThis.document?.baseURI;
  const cache = new Map();
  const resource = async (url) => {
    if (!url || /^(data:|#|portable-asset:)/i.test(url)) return url;
    if (!cache.has(url)) {
      cache.set(
        url,
        (async () => {
          let bytes, mime;
          if (resolveAsset) ({ bytes, mime } = await resolveAsset(url, base));
          else {
            const response = await fetch(new URL(url, base));
            if (!response.ok) throw Error('Required portable asset: ' + url);
            bytes = new Uint8Array(await response.arrayBuffer());
            mime = response.headers.get('content-type') || 'application/octet-stream';
          }
          const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
          let binary = '';
          for (let i = 0; i < array.length; i += 32768) binary += String.fromCharCode(...array.subarray(i, i + 32768));
          return 'data:' + mime + ';base64,' + btoa(binary);
        })()
      );
    }
    return cache.get(url);
  };
  const css = async (text) => {
    const matches = [...text.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi)];
    for (const m of matches) text = text.replace(m[0], 'url("' + (await resource(m[2])) + '")');
    return text;
  };
  const mapMedia = async (value, key = '') => {
    if (Array.isArray(value)) return Promise.all(value.map((v) => mapMedia(v, key)));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await mapMedia(v, k)])));
    if (typeof value === 'string' && value && MEDIA_KEYS.has(key)) return resource(value);
    return value;
  };
  const p = await mapMedia(structuredClone(project));
  clone.querySelectorAll('.fusion-selection,.fusion-guide,.fusion-crop-editor,.deck-export-overlay,.page-transition-stage,#fusion-save-controls,#fusion-history-controls,#fusion-status,.deck-busy').forEach((n) => n.remove());
  clone.querySelector('#deck-rail-list')?.replaceChildren();
  const body = clone.querySelector('body');
  if (body) {
    body.classList.remove('deck-presenting');
    body.classList.add('deck-editing');
  }
  for (const src of ['assets/vendor/html-to-image.js', 'assets/vendor/pdf-lib.min.js', 'assets/vendor/pptxgen.bundle.js']) {
    if (clone.querySelector('script[data-portable-vendor="' + src + '"]')) continue;
    const script = clone.ownerDocument.createElement('script');
    script.dataset.portableVendor = src;
    script.src = src;
    clone.querySelector('head').append(script);
  }
  for (const link of clone.querySelectorAll('link[rel="stylesheet"]')) {
    const response = await fetch(new URL(link.getAttribute('href'), base));
    if (!response.ok) throw Error('Stylesheet unavailable');
    const style = clone.ownerDocument.createElement('style');
    style.textContent = await css(await response.text());
    link.replaceWith(style);
  }
  for (const script of clone.querySelectorAll('script[src]')) {
    const url = script.getAttribute('src');
    const data = await resource(url);
    const response = await fetch(data);
    script.textContent = safeScript(await response.text());
    script.removeAttribute('src');
    script.removeAttribute('integrity');
    script.removeAttribute('crossorigin');
  }
  for (const style of clone.querySelectorAll('style')) {
    style.textContent = await css(usedFontFamilies ? dropUnusedFontFaces(style.textContent, usedFontFamilies) : style.textContent);
  }
  for (const node of clone.querySelectorAll('[style]')) node.setAttribute('style', await css(node.getAttribute('style')));
  for (const node of clone.querySelectorAll('[src]')) node.setAttribute('src', await resource(node.getAttribute('src')));
  for (const node of clone.querySelectorAll('a[href^="assets/"],link[href]')) node.setAttribute('href', await resource(node.getAttribute('href')));
  const put = (id, value) => {
    let node = clone.querySelector('#' + id);
    if (!node) {
      node = clone.ownerDocument.createElement('script');
      node.id = id;
      node.type = 'application/json';
      clone.querySelector('head').append(node);
    }
    node.textContent = safeJson(value);
  };
  const pooled = poolProjectMedia(p);
  put('fusion-project', pooled.project);
  put('portable-assets', pooled.pool);
  const old = clone.querySelector('#portable-project-meta');
  const previous = old ? JSON.parse(old.textContent) : null;
  if (!runtimeFingerprint) {
    const scripts = [...clone.querySelectorAll('script:not([type="application/json"])')].map((s) => s.textContent).join('\n');
    runtimeFingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scripts)))).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  put('portable-project-meta', {
    version: 1,
    projectId: p.requirements.projectId,
    baseRevision: previous?.baseRevision || baseRevision || p.revision,
    snapshotRevision: p.revision,
    runtimeFingerprint,
  });
  return '<!DOCTYPE html>\n' + clone.outerHTML;
}
