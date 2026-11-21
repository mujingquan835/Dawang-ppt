import { mountSaveControls } from './save-controls.mjs';
import { describeConflicts } from './messages.mjs';
import { HANDLES, HANDLE_CURSORS, resizeBounds, snapBounds, snapTargets } from './geometry.mjs';
import { inspectReadinessInDom } from '../qa/readiness.mjs';
import { serializePortablePartsFast, extractPortableProject } from '../portable/html.mjs';
import { AssetPool } from '../portable/asset-pool.mjs';
import { loadPortableFonts } from '../shell/font-loader.mjs';
import { mountImageCrop } from './image-crop.jsx';
import { readRunsFromDom, runsToHtml } from '../authoring/text-runs.mjs';
import { openDraftStore, draftDecision } from './drafts.mjs';
import { writeEditablePackage } from '../export/write.mjs';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneRoot } from '../scene/render.jsx';
import { materializeElements, syncCompositionTextState } from '../scene/model.mjs';
import { mergeEditorState } from '../project/import-goal.mjs';
import { applyEditCommand } from './commands.mjs';
import { mountInspector, mountDeckPanel } from './inspector.jsx';
import { collectProjectFromIr } from '../export/ir-collect.mjs';
import { composeEditablePptx } from '../export/pptx-core.mjs';
import { mountDeckRuntime } from '../shell/runtime.mjs';

const seed = document.getElementById('fusion-project');
if (seed) {
  // 1. Load detached WOFF2 fonts via FontFace API (0 bytes of base64 in <style>).
  const fontsReady = loadPortableFonts(document).catch(() => ({ loaded: 0 }));

  // 2. Keep heavy base64 images strictly inside AssetPool; live project tree holds short tokens only (~30 KB).
  const initialPoolObj = (() => {
    try { return JSON.parse(document.getElementById('portable-assets')?.textContent || '{}'); }
    catch { return {}; }
  })();
  const assetPool = new AssetPool(initialPoolObj);
  let project = assetPool.tokenizeProject(JSON.parse(seed.textContent));
  let savedRevision = project.revision;
  let editVersion = 0;

  // Hydrate initial static <img> tags in #deck from portable-asset: tokens (or inline data: URLs) to fast Blob ObjectURLs.
  const hydrateDeckImages = (scope = document.getElementById('deck')) => {
    if (!scope) return;
    for (const img of scope.querySelectorAll('img')) {
      const token = img.getAttribute('data-asset-token');
      const src = img.getAttribute('src') || '';
      if (token && token.startsWith('portable-asset:')) {
        img.src = assetPool.resolveRenderUrl(token);
      } else if (src.startsWith('portable-asset:')) {
        img.setAttribute('data-asset-token', src);
        img.src = assetPool.resolveRenderUrl(src);
      } else if (src.startsWith('data:')) {
        const t = assetPool.register(src);
        img.setAttribute('data-asset-token', t);
        img.src = assetPool.resolveRenderUrl(t);
      }
    }
  };
  hydrateDeckImages();

  const runtime = mountDeckRuntime({
    onOrderChange: (next) => reorder(next),
    onDuplicateSlide: (id) => duplicateSlide(id),
    status: (text) => status(text),
  });
  let saveControls = null;
  document.body.classList.add('fusion-editor');
  const syncEditorMode = () => document.body.classList.toggle('fusion-composition-active', !!document.querySelector('#deck > .fusion-slide.active'));
  syncEditorMode();

  const sections = () => [...document.querySelectorAll('#deck > .fusion-slide')];
  let cropEditor = null, exportBusy = false, lastMerge = null;
  let selected = null, selectionMode = 'group', redoSnapshots = [], restoring = false, saveQueue = Promise.resolve();
  const roots = new Map();
  let draftStore = null, draftTimer = null, inputTimer = null, draftQueue = Promise.resolve(), ready = Promise.resolve();
  let pendingTextSync = false;

  // Fast, lightweight dirty key: project contains tokens only (no base64 images), so JSON is tiny (~30 KB).
  let cachedKeyVer = -1, cachedKey = '';
  const saveKey = () => {
    if (pendingTextSync) syncInPlace();
    if (cachedKeyVer !== editVersion) {
      cachedKey = JSON.stringify([project.slides, project.contentPlan, project.media, project.editorState]);
      cachedKeyVer = editVersion;
    }
    return cachedKey;
  };

  function syncInPlace() {
    pendingTextSync = false;
    project = mergeEditorState(project, { ...project.editorState.legacy, ...runtime.orderState() }, { bump: false });
    const activeSection = document.querySelector('#deck > .fusion-slide.active');
    if (activeSection) {
      const slide = project.slides.find((s) => s.slideId === activeSection.dataset.slideId);
      if (slide) {
        const domMap = new Map([...activeSection.querySelectorAll('[data-fusion-element]')].map((n) => [n.dataset.fusionElement, n]));
        for (const e of materializeElements(slide, project)) {
          if (e.type !== 'text') continue;
          const el = domMap.get(e.id);
          if (!el) continue;
          if (el.innerText !== String(e.text ?? '')) {
            const runs = e.runs ? readRunsFromDom(el, e.runs) : null;
            const r = applyEditCommand(project, {
              slideId: slide.slideId,
              elementId: e.id,
              ...(e.runs && runs
                ? { type: 'text-runs', runs }
                : { type: 'text', text: el.innerText, ...(e.runs ? { resetRuns: true } : {}) }),
            });
            if (r.ok) {
              project = r.project;
              editVersion++;
            }
          }
        }
      }
    }
    project.revision = savedRevision;
    return project;
  }

  function sync() {
    return structuredClone(syncInPlace());
  }

  function scheduleDraft() {
    saveControls?.changed();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => persistDraft().catch((error) => status('本地草稿保存失败，当前内容仍在页面中：' + error.message)), 250);
  }

  let statusTimer = null;
  function status(text) {
    let el = document.getElementById('fusion-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fusion-status';
      document.body.append(el);
    }
    el.textContent = text;
    el.classList.remove('is-faded');
    clearTimeout(statusTimer);
    if (text) {
      statusTimer = setTimeout(() => {
        if (!el.querySelector('button')) el.classList.add('is-faded');
      }, 2800);
    }
  }

  const resolveRenderUrl = (v) => assetPool.resolveRenderUrl(v);

  function redraw(id) {
    const slide = project.slides.find((s) => s.slideId === id);
    const el = sections().find((el2) => el2.dataset.slideId === id);
    if (!slide || !el) return;
    let root = roots.get(el);
    if (!root) {
      root = createRoot(el);
      roots.set(el, root);
    }
    flushSync(() => root.render(<SceneRoot slide={slide} project={project} resolveAssetUrl={resolveRenderUrl} />));
    syncCompositionTextState(project);
    runtime.initEditable(el);
    runtime.refreshThumb(el);
    refreshSelection();
  }

  function ensureSlideSections() {
    const deck = document.getElementById('deck');
    if (!deck) return;
    const existing = new Map(sections().map((s) => [s.dataset.slideId, s]));
    const wantedIds = new Set(project.slides.map((s) => s.slideId));
    for (const [id, node] of existing) {
      if (!wantedIds.has(id)) {
        roots.get(node)?.unmount?.();
        roots.delete(node);
        node.remove();
      }
    }
    for (const s of project.slides) {
      if (!existing.has(s.slideId)) {
        const sec = document.createElement('section');
        sec.className = 'slide fusion-slide';
        sec.dataset.slideId = s.slideId;
        sec.dataset.label = s.label || s.title || '';
        deck.append(sec);
      }
    }
  }

  function restore(snapshot) {
    if (exportBusy) return false;
    cropEditor?.cancel();
    restoring = true;
    try {
      const previousSelection = selected;
      project = assetPool.tokenizeProject(structuredClone(snapshot));
      project.revision = savedRevision;
      editVersion++;
      ensureSlideSections();
      applySnapshot(project.editorState);
      selected = previousSelection;
      for (const s of project.slides) if (s.mode === 'composition') redraw(s.slideId);
      runtime.renderRail();
      refreshSelection();
      scheduleDraft();
    } finally {
      restoring = false;
    }
  }

  function redo() {
    if (exportBusy) return false;
    lastMerge = null;
    const next = redoSnapshots.pop();
    if (!next) return false;
    const before = sync();
    restore(next);
    stockPush({ label: '重做', undo: () => restore(before) });
    return true;
  }

  function apply(command, options = {}) {
    if (exportBusy) return { ok: false, conflicts: [{ kind: 'export-in-progress' }] };
    cropEditor?.cancel();
    syncInPlace();
    // Ensure any incoming base64 image in commands is pooled immediately so project stays tiny.
    const normalizedCmd = { ...command };
    if (typeof normalizedCmd.src === 'string' && normalizedCmd.src.startsWith('data:')) {
      normalizedCmd.src = assetPool.register(normalizedCmd.src);
    }
    if (normalizedCmd.element?.src && normalizedCmd.element.src.startsWith('data:')) {
      normalizedCmd.element = { ...normalizedCmd.element, src: assetPool.register(normalizedCmd.element.src) };
    }

    const before = structuredClone(project);
    const r = applyEditCommand(project, normalizedCmd);
    if (!r.ok) {
      status('修改未应用：' + describeConflicts(r.conflicts));
      return r;
    }
    if (
      JSON.stringify([before.slides, before.contentPlan.nodes, before.media.entries]) ===
      JSON.stringify([r.project.slides, r.project.contentPlan.nodes, r.project.media.entries])
    ) {
      return { ...r, project };
    }
    project = r.project;
    editVersion++;
    if (normalizedCmd.type === 'add-slide' || normalizedCmd.type === 'duplicate-slide') {
      selected = null;
      ensureSlideSections();
      applySnapshot(project.editorState);
      if (r.newSlideId) {
        redraw(r.newSlideId);
        runtime.renderRail();
        const targetSec = sections().find((s) => s.dataset.slideId === r.newSlideId);
        if (targetSec) runtime.show(targetSec, { force: true });
      }
    } else {
      if (normalizedCmd.type === 'delete-element') selected = null;
      else if ((normalizedCmd.type === 'add-element' || normalizedCmd.type === 'duplicate-element') && normalizedCmd.elementId) {
        selected = { slideId: normalizedCmd.slideId, elementId: normalizedCmd.elementId };
      }
      redraw(normalizedCmd.slideId);
    }

    const now = Date.now();
    if (options.mergeKey && lastMerge?.key === options.mergeKey && now - lastMerge.at < 1000) {
      lastMerge.at = now;
      redoSnapshots = [];
    } else {
      window.__deckUndo.push({ label: '编辑操作', undo: () => restore(before) });
      lastMerge = options.mergeKey ? { key: options.mergeKey, at: now } : null;
    }
    scheduleDraft();
    return r;
  }

  function applySnapshot(state, currentIndex) {
    runtime.applyOrder({
      slideOrder: state.slideOrder || [],
      skippedSlides: state.skippedSlides || [],
      deletedSlides: state.deletedSlides || [],
    });
    if (currentIndex !== void 0) window.go(currentIndex, { animate: false, force: true });
  }

  function refreshEmptyPanel() {
    const empty = document.getElementById('deck-empty-panel');
    if (!empty) return;
    if (selected) {
      empty.classList.add('is-hidden');
      return;
    }
    empty.classList.remove('is-hidden');
    mountDeckPanel(empty, api);
  }

  function refreshSelection() {
    document.querySelectorAll('#deck .fusion-selection').forEach((e) => e.remove());
    if (!selected) {
      document.getElementById('fusion-inspector')?.remove();
      const field = document.getElementById('deck-props-field'), panel = document.getElementById('deck-props');
      if (field && panel && !panel.children.length) field.classList.add('is-hidden');
      refreshEmptyPanel();
      return;
    }
    const slide = project.slides.find((s) => s.slideId === selected.slideId);
    const el = sections().find((s) => s.dataset.slideId === selected.slideId);
    if (!slide || !el) return;
    const element = materializeElements(slide, project).find((e) => e.id === selected.elementId);
    const object = slide.objects?.find((o) => o.objectId === element?.parentId);
    if (!element) {
      clearSelection();
      return;
    }
    const b = selectionMode === 'group' && object ? object.bounds : element.bounds;
    const root = el.querySelector('.fusion-root');
    const scale = root.getBoundingClientRect().width / 1920;
    const u = (px) => px / (scale > 0 ? scale : 1);
    const overlay = document.createElement('div');
    overlay.className = 'fusion-selection';
    overlay.dataset.editableSkip = 'true';
    overlay.style.cssText = `position:absolute;left:${b[0]}px;top:${b[1]}px;width:${b[2]}px;height:${b[3]}px;outline:${u(2)}px solid var(--ui-accent,#23338B);pointer-events:none;z-index:10000`;
    for (const dir of HANDLES) {
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.setAttribute('aria-label', '缩放选中对象（' + dir + '）');
      handle.dataset.fusionResize = dir;
      const isCorner = dir.length === 2;
      const size = u(isCorner ? 11 : 9), x = dir.includes('w') ? 0 : dir.includes('e') ? 100 : 50, y = dir.includes('n') ? 0 : dir.includes('s') ? 100 : 50;
      handle.style.cssText = `position:absolute;left:calc(${x}% - ${size / 2}px);top:calc(${y}% - ${size / 2}px);width:${size}px;height:${size}px;padding:0;cursor:${HANDLE_CURSORS[dir]};pointer-events:auto;background:#fff;border:${u(1.8)}px solid var(--ui-accent,#23338B);border-radius:${isCorner ? '50%' : u(2) + 'px'};box-shadow:0 ${u(1)}px ${u(3)}px rgba(15,23,42,.25)`;
      overlay.append(handle);
    }
    root.append(overlay);
    const field = document.getElementById('deck-props-field');
    field?.classList.remove('is-hidden');
    document.getElementById('deck-empty-panel')?.classList.add('is-hidden');
    mountInspector(document.getElementById('deck-props'), selected, api);
  }

  function clearSelection() {
    selected = null;
    document.querySelectorAll('#deck .fusion-selection').forEach((e) => e.remove());
    document.getElementById('fusion-inspector')?.remove();
    const field = document.getElementById('deck-props-field'), panel = document.getElementById('deck-props');
    if (field && panel && !panel.children.length) field.classList.add('is-hidden');
    refreshEmptyPanel();
  }

  const projectId =
    project.requirements.projectId ||
    'legacy:' + project.sources.entries.map((s) => s.sha256 || s.sourceId).join(':') + ':' + project.slides.map((s) => s.slideId).join(':');

  async function persistDraft() {
    if (!draftStore) return;
    // Project holds short tokens only (~30 KB), so IndexedDB writes are near-instant.
    const record = {
      projectId,
      baseRevision: savedRevision,
      updatedAt: new Date().toISOString(),
      project: structuredClone(project),
      assets: assetPool.toObject(),
    };
    draftQueue = draftQueue.catch(() => {}).then(() => draftStore.put(record));
    try {
      await draftQueue;
    } catch (error) {
      draftStore = null;
      status('本地草稿不可用，仍可下载HTML：' + error.message);
    }
  }

  const stockUndo = window.__deckUndo.undo.bind(window.__deckUndo);
  const stockPush = window.__deckUndo.push.bind(window.__deckUndo);
  window.__deckUndo.push = (action) => {
    if (!restoring) redoSnapshots = [];
    stockPush(action);
  };
  window.__deckUndo.undo = () => {
    if (exportBusy) return false;
    lastMerge = null;
    const after = sync();
    const ok = stockUndo();
    if (ok) {
      syncInPlace();
      redoSnapshots.push(after);
      refreshSelection();
    }
    return ok;
  };

  const portable = () => location.protocol === 'file:' || !!document.getElementById('portable-project-meta');

  async function saveNow(options = {}) {
    await ready;
    cropEditor?.confirm();
    const current = sync();
    const currentKey = saveKey();
    if (portable()) {
      if (!options.fileHandle) throw Error('请先关联源文件；保存不会自动下载副本');
      return downloadHtml(options.fileHandle);
    }
    await persistDraft().catch((error) => status('草稿不可用：' + error.message));
    // Re-inflate tokens for server save so extractDataUrlMedia can write uploaded images to disk.
    const serverProject = structuredClone(current);
    const expandWalk = (v, key = '') => {
      if (Array.isArray(v)) return v.map((x) => expandWalk(x, key));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, expandWalk(val, k)]));
      if (typeof v === 'string' && v.startsWith('portable-asset:')) return assetPool.resolveDataUrl(v);
      return v;
    };
    const response = await fetch('/api/save-deck-state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: current.editorState.legacy, project: expandWalk(serverProject), expectedRevision: savedRevision }),
    });
    const result = await response.json();
    if (!result.ok) {
      const reason = describeConflicts(result.conflicts || result.issues);
      status('保存未完成，修改已保留为草稿：' + reason);
      throw new Error(reason);
    }
    if (result.mediaMap) {
      const reconcile = (value) =>
        typeof value === 'string'
          ? result.mediaMap[value] || value
          : Array.isArray(value)
            ? value.map(reconcile)
            : value && typeof value === 'object'
              ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reconcile(v)]))
              : value;
      project = reconcile(project);
    }
    savedRevision = result.revision;
    project.revision = savedRevision;
    await persistDraft();
    saveControls?.saved(currentKey, '已保存工程');
    status(result.previewError ? '内容已保存，预览更新失败：' + result.previewError : '已保存');
    return result;
  }

  const save = (options = {}) => {
    if (exportBusy && !options.forExport) return Promise.reject(new Error('导出期间请等待当前操作完成'));
    const task = saveQueue.catch(() => {}).then(async () => {
      saveControls?.begin();
      try {
        return await saveNow({ ...options, fileHandle: options.fileHandle || saveControls?.getFileHandle() });
      } catch (error) {
        saveControls?.failed(error);
        throw error;
      }
    });
    saveQueue = task;
    return task;
  };

  const beginCrop = (selection) => {
    cropEditor?.cancel();
    if (!window.__canEditDeck?.()) return;
    const p = syncInPlace();
    const slide = p.slides.find((s) => s.slideId === selection.slideId);
    const element = slide && materializeElements(slide, p).find((e) => e.id === selection.elementId);
    const root = sections().find((s) => s.dataset.slideId === selection.slideId)?.querySelector('.fusion-root');
    const node = root && [...root.querySelectorAll('[data-fusion-element]')].find((e) => e.dataset.fusionElement === selection.elementId);
    const image = node?.tagName === 'IMG' ? node : node?.querySelector('img');
    if (element?.type !== 'image' || !image?.complete || !image.naturalWidth) {
      status('图片尚未加载完成，请稍后重试。');
      return;
    }
    document.querySelectorAll('#deck .fusion-selection').forEach((e) => e.remove());
    cropEditor = mountImageCrop({
      root,
      element,
      image,
      onClose: () => { cropEditor = null; refreshSelection(); },
      onApply: ({ crop, bounds }) => apply({ ...selection, type: 'image', src: element.src, fit: 'cover', crop, bounds }),
    });
  };

  function activeSlideId() {
    return document.querySelector('#deck > .fusion-slide.active')?.dataset.slideId || project.slides[0]?.slideId;
  }
  function addSlide() {
    const afterSlideId = activeSlideId();
    if (!window.__canEditDeck?.()) return;
    apply({ type: 'add-slide', afterSlideId });
    status('已新建空白页，可双击编辑标题或自由插入元素。');
  }
  function duplicateSlide(slideId) {
    const target = slideId || activeSlideId();
    if (!target || !window.__canEditDeck?.()) return;
    apply({ type: 'duplicate-slide', slideId: target, afterSlideId: target });
    status('已复制当前页面。');
  }

  const api = {
    isExporting: () => exportBusy,
    isPortable: portable,
    beginCrop,
    commitPendingEdits: () => cropEditor?.confirm(),
    ready: () => ready,
    flushDraft: async () => {
      await ready;
      syncInPlace();
      await persistDraft();
    },
    getProject: sync,
    activeSlideId,
    addSlide,
    duplicateSlide,
    apply,
    save: (options = {}) => (portable() && !options.fileHandle ? saveControls.run() : save(options)),
    undo: () => window.__deckUndo.undo(),
    redo,
    selectionMode: (value) => {
      if (value) selectionMode = value;
      return selectionMode;
    },
    refreshSelection,
    acceptRevision: (r) => {
      savedRevision = r;
      project.revision = r;
    },
  };
  window.__fusionEditor = api;

  const download = async (blob, name) => {
    const href = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.click();
    } finally {
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }
  };

  // Zero-clone segmented HTML serialization -> Blob (never clones documentElement or megabytes of fonts).
  async function portableHtmlParts(onSnapshot) {
    await ready;
    cropEditor?.confirm();
    const p = sync();
    if (portable()) p.revision = crypto.randomUUID();
    if (typeof onSnapshot === 'function') onSnapshot(saveKey(), p.revision);
    return serializePortablePartsFast({
      document,
      project: p,
      assetPool,
      baseRevision: savedRevision,
    });
  }

  async function portableHtml(onSnapshot) {
    const parts = await portableHtmlParts(onSnapshot);
    return parts.join('');
  }

  function htmlFilename() {
    if (location.protocol === 'file:') {
      try { return decodeURIComponent(location.pathname.split('/').pop()) || '报告.html'; }
      catch {}
    }
    return (project.requirements.title || '报告') + '.html';
  }

  async function downloadHtml(fileHandle) {
    let key, revision;
    const parts = await portableHtmlParts((k, r) => { key = k; revision = r; });
    const blob = new Blob(parts, { type: 'text/html;charset=utf-8' });
    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        try { await writable.abort(); } catch {}
        throw error;
      }
    } else {
      await download(blob, htmlFilename());
    }
    if (fileHandle) {
      if (portable()) {
        project.revision = revision;
        savedRevision = revision;
      }
      saveControls?.saved(key, '已保存到源文件：' + fileHandle.name);
      await persistDraft();
    }
    status(fileHandle ? '已保存到源文件：' + fileHandle.name : '已导出HTML副本；源文件的修改仍需点击保存。');
    return { ok: true, revision: project.revision };
  }

  api.serializeHtml = portableHtml;
  window.__exportDeckHtml = () => withSnapshot(downloadHtml);

  saveControls = mountSaveControls({
    portable: portable(),
    getKey: saveKey,
    save,
    validateSource: async (handle) => {
      const file = await handle.getFile();
      if (location.protocol === 'file:' && file.name !== htmlFilename()) throw Error('请选择当前打开的原HTML：' + htmlFilename());
      const source = extractPortableProject(await file.text());
      if (source.requirements.projectId !== project.requirements.projectId) throw Error('所选文件不属于当前演示稿，请重新关联原HTML');
    },
  });

  // Wire up free-editing insert tools (+ 文本 / + 色块 / + 图片 / + 新建页)
  document.getElementById('deck-add-slide')?.addEventListener('click', () => addSlide());
  document.getElementById('deck-add-text')?.addEventListener('click', () => {
    const slideId = activeSlideId();
    if (!slideId || !window.__canEditDeck?.()) return;
    apply({
      slideId,
      type: 'add-element',
      element: {
        type: 'text',
        text: '双击编辑文本',
        bounds: [710, 480, 500, 80],
        style: { fontFamily: 'Source Han Sans SC', fontSize: 32, fontWeight: 500, color: '#14213D', lineHeight: 1.35 },
      },
    });
    status('已插入文本框，双击即可输入内容。');
  });
  document.getElementById('deck-add-shape')?.addEventListener('click', () => {
    const slideId = activeSlideId();
    if (!slideId || !window.__canEditDeck?.()) return;
    const accent = project.designChoice?.appearance?.palette?.accent || '#1E40AF';
    apply({
      slideId,
      type: 'add-element',
      element: {
        type: 'shape',
        bounds: [760, 440, 400, 200],
        style: { fill: accent, opacity: 0.14, stroke: accent, strokeWidth: 2, radius: 14 },
      },
    });
    status('已插入色块，可拖拽缩放或在右侧修改颜色。');
  });
  document.getElementById('deck-add-image')?.addEventListener('click', () => {
    const slideId = activeSlideId();
    if (!slideId || !window.__canEditDeck?.()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
          const maxW = 680, maxH = 440;
          const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
          const w = Math.round(img.naturalWidth * ratio), h = Math.round(img.naturalHeight * ratio);
          apply({
            slideId,
            type: 'add-element',
            element: {
              type: 'image',
              src: assetPool.register(dataUrl),
              fit: 'cover',
              bounds: [Math.round((1920 - w) / 2), Math.round((1080 - h) / 2), w, h],
              style: { radius: 12 },
            },
          });
          status('已插入图片，可拖拽缩放或点击右侧裁切。');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  mountHistoryControls();
  refreshEmptyPanel();
  function mountHistoryControls() {
    const target = document.querySelector('#deck-topbar .deck-top-left') || document.querySelector('#deck-topbar .deck-actions');
    if (!target) return;
    document.getElementById('fusion-history-controls')?.remove();
    const divider = document.createElement('span');
    divider.className = 'deck-top-divider';
    divider.setAttribute('aria-hidden', 'true');
    const box = document.createElement('div');
    box.id = 'fusion-history-controls';
    const UNDO_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.5H10a3.5 3.5 0 1 1 0 7H7.5"/><path d="M6.8 4 4 6.5 6.8 9"/></svg>';
    const REDO_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 6.5H6a3.5 3.5 0 1 0 0 7h2.5"/><path d="M9.2 4 12 6.5 9.2 9"/></svg>';
    const make = (id, label, svg, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.id = id; b.innerHTML = svg; b.title = title; b.setAttribute('aria-label', label);
      b.className = 'deck-icon-btn';
      b.addEventListener('click', () => { if (!fn()) status(id === 'fusion-undo' ? '没有可撤销的操作' : '没有可重做的操作'); });
      box.append(b);
    };
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    make('fusion-undo', '撤销', UNDO_SVG, mac ? '撤销（⌘Z）' : '撤销（Ctrl+Z）', () => api.undo());
    make('fusion-redo', '重做', REDO_SVG, mac ? '重做（⇧⌘Z）' : '重做（Ctrl+Y）', () => api.redo());
    if (target.classList.contains('deck-top-left')) {
      target.append(divider, box);
    } else {
      target.prepend(box);
    }
  }

  document.addEventListener('keydown', (ev) => {
    const key = String(ev.key || '').toLowerCase();
    const isRedo = (ev.metaKey || ev.ctrlKey) && !ev.altKey && ((key === 'z' && ev.shiftKey) || (key === 'y' && ev.ctrlKey && !ev.shiftKey));
    if (!isRedo || ev.target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]')) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    redo();
  }, true);

  async function waitReady(id) {
    await fontsReady;
    const deadline = Date.now() + 10000;
    let state;
    do {
      state = inspectReadinessInDom(id);
      if (state.ready) return state;
      if (state.issues.some((i) => ['missing-image', 'font-unavailable'].includes(i.kind))) break;
      await new Promise((r) => setTimeout(r, 30));
    } while (Date.now() < deadline);
    throw Error('导出检查未通过：' + describeConflicts(state.issues));
  }

  async function withSnapshot(operation) {
    if (exportBusy) throw Error('导出正在进行');
    await ready;
    cropEditor?.confirm();
    syncInPlace();
    exportBusy = true;
    const index = window.__currentSlideIndex;
    const editables = [...document.querySelectorAll('#deck [contenteditable="true"]')];
    editables.forEach((e) => e.setAttribute('contenteditable', 'false'));
    try {
      return await operation();
    } finally {
      editables.forEach((e) => e.setAttribute('contenteditable', 'true'));
      exportBusy = false;
      window.go(index, { animate: false, force: true });
    }
  }

  // Direct IR -> Editable PPTX export in browser: zero slide switching, zero DOM scraping, sub-second speed.
  async function browserExport() {
    cropEditor?.confirm();
    const p = syncInPlace();
    const resolveSrc = async (raw) => {
      if (!raw) return raw;
      const fromPool = assetPool.resolveDataUrl(raw);
      if (fromPool.startsWith('data:')) return fromPool;
      const blob = await (await fetch(fromPool)).blob();
      return new Promise((resolve) => {
        const f = new FileReader();
        f.onload = () => resolve(f.result);
        f.readAsDataURL(blob);
      });
    };
    const collection = await collectProjectFromIr(p, { resolveSrc });
    window.pptxgen ||= window.PptxGenJS;
    if (!window.pptxgen) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'assets/vendor/pptxgen.bundle.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    window.pptxgen ||= window.PptxGenJS;
    const { pptx, report } = composeEditablePptx(window.pptxgen, collection, { title: p.requirements.title });
    return { blob: await writeEditablePackage(pptx, collection, { type: 'blob' }), report };
  }

  window.__dawangExport = {
    applyEditablePptxSnapshot: ({ state, currentIndex }) => applySnapshot(state, currentIndex),
    exportEditablePptxInBrowser: browserExport,
  };

  async function exportFile(pdf = false) {
    await save({ forExport: true });
    const response = await fetch(pdf ? '/api/export-pdf' : '/api/export-editable-pptx', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: savedRevision }),
    });
    const r = await response.json();
    if (!r.ok) {
      const reason = describeConflicts(r.issues);
      status('导出未完成：' + reason);
      throw new Error(reason);
    }
    window.__lastPptxExportResult = r;
    const a = document.createElement('a');
    a.href = r.downloadUrl;
    a.download = r.downloadName;
    document.body.append(a);
    a.click();
    a.remove();
    return r;
  }

  window.__exportDeckPptx = () => withSnapshot(() => (portable() ? window.__exportDeckPptxInBrowser() : exportFile()));
  window.__exportDeckPdf = () =>
    withSnapshot(async () => {
      if (!portable()) return exportFile(true);
      for (const [index, el] of window.__getVisibleSlides().entries()) {
        window.go(index, { animate: false, force: true });
        await waitReady(el.dataset.slideId);
      }
      return window.__exportDeckPdfInBrowser();
    });
  window.__exportDeckImage = () =>
    withSnapshot(async () => {
      const el = window.__getVisibleSlides()[window.__currentSlideIndex || 0];
      await waitReady(el.dataset.slideId);
      if (!window.htmlToImage) {
        const script = document.createElement('script');
        script.src = 'assets/vendor/html-to-image.js';
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.append(script);
        });
      }
      const root = el.querySelector('.fusion-root,.imported-theme-root') || el;
      const blob = await window.htmlToImage.toBlob(root, {
        width: 1920,
        height: 1080,
        pixelRatio: 1,
        style: { transform: 'none', left: '0', top: '0' },
        filter: (node) => !node.classList?.contains('fusion-selection') && !node.classList?.contains('fusion-guide') && !node.classList?.contains('fusion-crop-editor'),
      });
      await download(blob, (project.requirements.title || '报告') + '-' + (window.__currentSlideIndex + 1) + '.png');
      return { ok: true };
    });
  window.__exportDeckPptxInBrowser = async () => {
    const result = await browserExport();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.blob);
    a.download = (project.requirements.title || 'presentation') + '.pptx';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return { ok: true, report: result.report };
  };

  // Debounced input sync: typing never triggers full-deck cloning on every keystroke.
  document.addEventListener('input', (ev) => {
    if (!ev.target.closest?.('#deck [data-fusion-element]')) return;
    pendingTextSync = true;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      syncInPlace();
      const activeSection = document.querySelector('#deck > .fusion-slide.active');
      if (activeSection) runtime.refreshThumb(activeSection);
      scheduleDraft();
    }, 200);
  });

  addEventListener('pagehide', () => {
    if (pendingTextSync) syncInPlace();
    persistDraft().catch(() => {});
  });

  ready = (async () => {
    await fontsReady;
    try {
      draftStore = await openDraftStore();
      const record = await draftStore.get(projectId);
      const decision = draftDecision(record, project);
      if (decision === 'restore') {
        if (record.assets && typeof record.assets === 'object') {
          for (const [k, v] of Object.entries(record.assets)) {
            if (!assetPool.has(k) && typeof v === 'string') assetPool._byToken.set(k, v);
          }
        }
        restore(record.project);
        status('已恢复本地草稿；保存后同步到源项目。');
      } else if (decision === 'conflict') {
        status('本地草稿与磁盘版本不同，两个版本均已保留；请下载草稿对照后决定。');
        const button = document.createElement('button');
        button.textContent = '下载冲突草稿';
        button.onclick = () => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(new Blob([JSON.stringify(record.project, null, 2)], { type: 'application/json' }));
          link.download = 'conflicting-deck-project.json';
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        };
        document.getElementById('fusion-status').append(button);
        draftStore = null;
        api.conflictingDraft = record.project;
      } else {
        scheduleDraft();
      }
    } catch (error) {
      status('浏览器本地草稿存储不可用：' + error.message + '；请保持页面打开并使用保存。');
    }
  })();

  document.addEventListener('click', (ev) => {
    if (ev.target.closest?.('.fusion-crop-editor,.fusion-selection')) return;
    const el = ev.target.closest?.('#deck [data-fusion-element]');
    if (!el && selected && !ev.target.closest?.('#deck-panel,#deck-rail,#deck-topbar,[role="dialog"],[role="menu"]')) return clearSelection();
    if (!el || !window.__canEditDeck?.()) return;
    selected = { slideId: el.closest('.slide').dataset.slideId, elementId: el.dataset.fusionElement };
    refreshSelection();
  });

  // GPU-composited rAF drag & resize preview
  let drag = null, suppressClick = false, dragRaf = 0, latestDragEvent = null;
  const restorePreview = (d) => d.nodes.forEach(({ node, css }) => { node.style.cssText = css; });
  const clearGuides = () => document.querySelectorAll('#deck .fusion-guide,#deck .fusion-hud').forEach((e) => e.remove());
  const updateHud = (d) => {
    let hud = d.root.querySelector('.fusion-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'fusion-hud';
      hud.dataset.editableSkip = 'true';
      d.root.append(hud);
    }
    const [x, y, w, h] = d.next.map((v) => Math.round(v));
    hud.textContent = d.handle ? `${w} × ${h}` : `X ${x} · Y ${y}`;
    const inv = 1 / (d.scale > 0 ? d.scale : 1);
    hud.style.left = Math.max(8, Math.min(1820, x)) + 'px';
    hud.style.top = Math.max(8, y - 34 * inv) + 'px';
    hud.style.transform = `scale(${inv})`;
  };
  const cancelDrag = () => {
    if (!drag) return;
    if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
    latestDragEvent = null;
    const d = drag;
    drag = null;
    restorePreview(d);
    clearGuides();
    if (d.capture.hasPointerCapture?.(d.pointerId)) d.capture.releasePointerCapture(d.pointerId);
    refreshSelection();
  };
  const isEditingText = (node) => !!node && node.dataset.elementType === 'text' && node.contains(document.activeElement) && document.activeElement.isContentEditable;

  const selectionGeometry = (p, selection) => {
    const slide = p.slides.find((s) => s.slideId === selection.slideId);
    if (!slide) return null;
    const elements = materializeElements(slide, p);
    const element = elements.find((e) => e.id === selection.elementId);
    if (!element) return null;
    const object = slide.objects?.find((o) => o.objectId === element.parentId);
    const grouped = selectionMode === 'group' && object;
    return {
      slide,
      elements,
      element,
      object: grouped ? object : null,
      bounds: [...(grouped ? object.bounds : element.bounds)],
      ids: new Set((grouped ? elements.filter((e) => e.parentId === object.objectId) : [element]).map((e) => e.id)),
    };
  };

  document.addEventListener('click', (ev) => {
    if (!suppressClick) return;
    suppressClick = false;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointerdown', (ev) => {
    if (cropEditor) return;
    const target = ev.target.closest?.('#deck [data-fusion-element]');
    const resize = ev.target.closest?.('[data-fusion-resize]');
    if (ev.button !== 0 || !window.__canEditDeck?.() || (!resize && (!target || isEditingText(target)))) return;
    if (target && !resize) selected = { slideId: target.closest('.slide').dataset.slideId, elementId: target.dataset.fusionElement };
    if (!selected) return;
    const g = selectionGeometry(syncInPlace(), selected);
    if (!g) return;
    const root = sections().find((el) => el.dataset.slideId === selected.slideId).querySelector('.fusion-root');
    const scale = root.getBoundingClientRect().width / 1920;
    if (!Number.isFinite(scale) || scale <= 0) return;
    if (!resize) refreshSelection();
    const b = g.bounds;
    const nodes = [...root.querySelectorAll('[data-fusion-element]')]
      .filter((node) => g.ids.has(node.dataset.fusionElement))
      .map((node) => ({ node, css: node.style.cssText, b: g.elements.find((e) => e.id === node.dataset.fusionElement).bounds }));
    const overlay = root.querySelector('.fusion-selection');
    if (overlay) nodes.push({ node: overlay, css: overlay.style.cssText, b: [...b] });
    const others = [
      ...g.elements.filter((e) => !g.ids.has(e.id)).map((e) => e.bounds),
      ...(g.slide.objects || []).filter((o) => o.objectId !== g.object?.objectId).map((o) => o.bounds),
    ];
    drag = {
      x: ev.clientX,
      y: ev.clientY,
      b: [...b],
      next: [...b],
      scale,
      root,
      targets: snapTargets(others),
      objectId: g.object?.objectId ?? null,
      handle: resize?.dataset.fusionResize || null,
      nodes,
      selection: { ...selected },
      pointerId: ev.pointerId,
      capture: ev.target,
      moved: false,
    };
    ev.target.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
    ev.stopPropagation();
  }, true);

  const drawGuides = (d, guides) => {
    clearGuides();
    const w = Math.max(1, 1 / d.scale);
    for (const [axis, values] of Object.entries(guides)) {
      for (const v of values) {
        const line = document.createElement('div');
        line.className = 'fusion-guide';
        line.dataset.editableSkip = 'true';
        line.style.cssText =
          axis === 'x'
            ? `position:absolute;left:${v - w / 2}px;top:0;width:${w}px;height:1080px;background:#e5487a;pointer-events:none;z-index:10001`
            : `position:absolute;top:${v - w / 2}px;left:0;height:${w}px;width:1920px;background:#e5487a;pointer-events:none;z-index:10001`;
        d.root.append(line);
      }
    }
  };

  const applyDragFrame = (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const d = drag;
    const dx = (ev.clientX - d.x) / d.scale;
    const dy = (ev.clientY - d.y) / d.scale;
    if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 3) return;
    d.moved = true;
    let moveDx = dx, moveDy = dy;
    // Hold Shift while dragging to lock pure horizontal or vertical axis
    if (!d.handle && ev.shiftKey) {
      if (Math.abs(moveDx) >= Math.abs(moveDy)) moveDy = 0;
      else moveDx = 0;
    }
    let next = d.handle
      ? resizeBounds(d.b, d.handle, dx, dy, { keepRatio: ev.shiftKey })
      : [d.b[0] + moveDx, d.b[1] + moveDy, d.b[2], d.b[3]];
    let guides = { x: [], y: [] };
    if (!ev.altKey && !(d.handle && ev.shiftKey)) ({ bounds: next, guides } = snapBounds(next, d.targets, { handle: d.handle, threshold: 6 / d.scale }));
    d.next = next;
    drawGuides(d, guides);
    updateHud(d);
    if (!d.handle) {
      // Pure move: GPU transform avoids layout reflow on every pointermove frame.
      const tx = d.next[0] - d.b[0], ty = d.next[1] - d.b[1];
      const tr = `translate3d(${tx}px, ${ty}px, 0)`;
      for (const { node } of d.nodes) node.style.transform = tr;
    } else {
      const sx = d.next[2] / d.b[2], sy = d.next[3] / d.b[3];
      for (const { node, b } of d.nodes) {
        Object.assign(node.style, {
          left: d.next[0] + (b[0] - d.b[0]) * sx + 'px',
          top: d.next[1] + (b[1] - d.b[1]) * sy + 'px',
          width: b[2] * sx + 'px',
          height: b[3] * sy + 'px',
        });
      }
    }
  };

  document.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    ev.preventDefault();
    latestDragEvent = ev;
    if (!dragRaf) {
      dragRaf = requestAnimationFrame(() => {
        dragRaf = 0;
        if (latestDragEvent) {
          const e = latestDragEvent;
          latestDragEvent = null;
          applyDragFrame(e);
        }
      });
    }
  }, { passive: false });

  document.addEventListener('pointerup', (ev) => {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
    latestDragEvent = null;
    applyDragFrame(ev);
    const d = drag;
    drag = null;
    restorePreview(d);
    clearGuides();
    if (d.capture.hasPointerCapture?.(d.pointerId)) d.capture.releasePointerCapture(d.pointerId);
    if (!d.moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    apply({
      ...d.selection,
      type: d.objectId ? 'object-geometry' : 'geometry',
      objectId: d.objectId,
      bounds: d.next.map((v) => Math.round(v * 100) / 100),
    });
  });
  document.addEventListener('pointercancel', cancelDrag);

  document.addEventListener('dblclick', (ev) => {
    const node = ev.target.closest?.('#deck [data-fusion-element][data-element-type="text"]');
    if (!node || cropEditor || !window.__canEditDeck?.() || isEditingText(node)) return;
    const editable = node.isContentEditable ? node : node.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"]');
    if (!editable) return;
    editable.focus();
    const range = document.caretRangeFromPoint?.(ev.clientX, ev.clientY);
    if (range && editable.contains(range.startContainer)) {
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  const typing = (target) => target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]');
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && drag) {
      cancelDrag();
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || !selected || drag || cropEditor || ev.defaultPrevented) return;
    const editing = ev.target.closest?.('#deck [data-fusion-element]');
    if (editing && isEditingText(editing)) {
      document.activeElement.blur();
      ev.preventDefault();
      return;
    }
    if (typing(ev.target)) return;
    clearSelection();
  });

  // Delete / Backspace deletes selected element when not typing text
  document.addEventListener('keydown', (ev) => {
    if ((ev.key !== 'Delete' && ev.key !== 'Backspace') || !selected || drag || cropEditor || ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target) || !window.__canEditDeck?.()) return;
    const active = document.querySelector('#deck > .fusion-slide.active');
    if (active?.dataset.slideId !== selected.slideId) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const g = selectionGeometry(syncInPlace(), selected);
    apply({ ...selected, type: 'delete-element', objectId: g?.object?.objectId });
  }, true);

  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  document.addEventListener('keydown', (ev) => {
    const step = ARROWS[ev.key];
    if (!step || !selected || drag || cropEditor || ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target) || !window.__canEditDeck?.()) return;
    const active = document.querySelector('#deck > .fusion-slide.active');
    if (active?.dataset.slideId !== selected.slideId) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const g = selectionGeometry(syncInPlace(), selected);
    if (!g) return;
    const n = ev.shiftKey ? 10 : 1, b = g.bounds;
    apply(
      { ...selected, type: g.object ? 'object-geometry' : 'geometry', objectId: g.object?.objectId, bounds: [b[0] + step[0] * n, b[1] + step[1] * n, b[2], b[3]] },
      { mergeKey: 'nudge:' + selected.slideId + '/' + (g.object?.objectId || selected.elementId) }
    );
  }, true);

  // Duplicate (⌘D) & Copy/Paste (⌘C / ⌘V) selected elements across slides
  let clipboardElement = null;
  document.addEventListener('keydown', (ev) => {
    const key = String(ev.key || '').toLowerCase();
    if (!(ev.metaKey || ev.ctrlKey) || ev.altKey || ev.shiftKey || typing(ev.target) || !window.__canEditDeck?.()) return;
    if (key === 'd' && selected) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      apply({ ...selected, type: 'duplicate-element' });
      status('已复制对象');
    } else if (key === 'c' && selected) {
      const selText = String(window.getSelection?.() || '');
      if (selText) return;
      const g = selectionGeometry(syncInPlace(), selected);
      if (!g?.element) return;
      ev.preventDefault();
      const rawEl = g.slide.elements.find((x) => x.id === g.element.id) || g.element;
      clipboardElement = structuredClone(rawEl);
      delete clipboardElement.id;
      delete clipboardElement.parentId;
      delete clipboardElement.contentRef;
      delete clipboardElement.sourceContentRef;
      status('已复制对象，可按 ⌘V 粘贴到当前页或其他页');
    } else if (key === 'v' && clipboardElement) {
      const slideId = activeSlideId();
      if (!slideId) return;
      ev.preventDefault();
      const pasted = structuredClone(clipboardElement);
      pasted.bounds = [
        Math.min(1920 - pasted.bounds[2], Math.max(0, pasted.bounds[0] + 24)),
        Math.min(1080 - pasted.bounds[3], Math.max(0, pasted.bounds[1] + 24)),
        pasted.bounds[2],
        pasted.bounds[3],
      ];
      clipboardElement.bounds = [...pasted.bounds];
      apply({ slideId, type: 'add-element', element: pasted });
      status('已粘贴对象');
    }
  }, true);

  addEventListener('deck-zoom-change', () => {
    if (selected) refreshSelection();
  });
  addEventListener('blur', cancelDrag);
  addEventListener('deck-slide-change', () => {
    cropEditor?.cancel();
    cancelDrag();
    syncEditorMode();
    clearSelection();
  });

  function reorder(next) {
    if (exportBusy) return;
    const before = sync();
    runtime.applyOrder(next);
    syncInPlace();
    editVersion++;
    window.__deckUndo.push({ label: '页面顺序', undo: () => restore(before) });
    scheduleDraft();
  }
}
