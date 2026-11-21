// Browser runtime of a Dawang-PPT deck page: scaling, navigation, page list, presenting, text editing, undo stack,
// export menu and the in-browser PDF. The editor (editor/browser.jsx) builds on the hooks this exposes:
//   window.go(index, {animate, force})  index into the visible (not skipped) slides
//   window.__getVisibleSlides()         visible slide sections in order
//   window.__currentSlideIndex          index of the shown slide among them (-1 for a skipped slide being edited)
//   window.__canEditDeck()              false while presenting or exporting
//   window.__deckUndo                   { push({label, undo}), undo() }
//   'deck-slide-change' event           after the shown slide changes
const $ = (id) => document.getElementById(id);
const typing = (t) => t?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"]');
const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[data-portable-vendor="${src}"]`) && !document.querySelector(`script[data-portable-vendor="${src}"][src]`)) return resolve();
  const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('无法加载 ' + src)); document.head.append(s);
});

export function mountDeckRuntime({ onOrderChange, status = () => {} } = {}) {
  const deck = $('deck'), viewport = $('deck-viewport'), list = $('deck-rail-list');
  let presenting = false, busy = false, active = null;
  const slides = () => [...deck.querySelectorAll(':scope > .slide')];
  const visible = () => slides().filter((s) => s.dataset.skipped !== 'true');
  const orderState = () => ({
    slideOrder: slides().map((s) => s.dataset.slideId),
    skippedSlides: slides().filter((s) => s.dataset.skipped === 'true').map((s) => s.dataset.slideId),
    deletedSlides: [...deleted]
  });
  const deleted = new Set(JSON.parse($('fusion-project')?.textContent || '{}')?.editorState?.deletedSlides || []);

  // Scale: the shown slide fits the viewport; thumbnails carry their own scale on their frame.
  function fit() {
    const box = viewport.getBoundingClientRect(), pad = presenting ? 0 : 48, pager = presenting ? 0 : 44;
    const scale = Math.max(0.1, Math.min((box.width - pad) / 1920, (box.height - pad - pager) / 1080));
    document.documentElement.style.setProperty('--deck-scale', String(scale));
  }
  new ResizeObserver(fit).observe(viewport);
  addEventListener('resize', fit);

  function show(section, { force = false } = {}) {
    if (!section || (section === active && !force)) return;
    for (const s of slides()) s.classList.toggle('active', s === section);
    active = section;
    window.__currentSlideIndex = visible().indexOf(section);
    const all = slides(), n = all.indexOf(section) + 1;
    $('deck-page') && ($('deck-page').textContent = `${n} / ${all.length}`);
    for (const item of list?.children || []) item.classList.toggle('active', item.dataset.slideId === section.dataset.slideId);
    list?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
    dispatchEvent(new CustomEvent('deck-slide-change', { detail: { slideId: section.dataset.slideId } }));
  }
  function go(index, options = {}) {
    const v = visible();
    if (!v.length) return;
    show(v[Math.max(0, Math.min(v.length - 1, index))], options);
  }
  const step = (d) => {
    if (presenting) return go(Math.max(0, window.__currentSlideIndex) + d);
    const all = slides(), i = all.indexOf(active);
    show(all[Math.max(0, Math.min(all.length - 1, i + d))]);
  };
  window.go = go;
  window.__getVisibleSlides = visible;
  window.__canEditDeck = () => !presenting && !busy;

  // Page list.
  function thumb(section) {
    const item = document.createElement('li');
    item.className = 'deck-thumb'; item.dataset.slideId = section.dataset.slideId;
    item.classList.toggle('skipped', section.dataset.skipped === 'true');
    item.classList.toggle('active', section === active);
    const no = document.createElement('span'); no.className = 'deck-thumb-no';
    const frame = document.createElement('div'); frame.className = 'deck-thumb-frame';
    frame._section = section;
    lazy.observe(frame);
    const menu = document.createElement('div'); menu.className = 'deck-thumb-menu';
    const action = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); }); menu.append(b); };
    action('↑', '上移', () => move(section, -1));
    action('↓', '下移', () => move(section, 1));
    action(section.dataset.skipped === 'true' ? '显' : '隐', section.dataset.skipped === 'true' ? '放映时显示' : '放映时跳过', () => toggleSkip(section));
    action('×', '删除本页', () => remove(section));
    item.append(no, frame, menu);
    item.addEventListener('click', () => show(section));
    return item;
  }
  // Thumbnails are copies of the slide, so they are only built while their frame is in view.
  function fill(frame) {
    if (frame._filled || !frame._section) return;
    const root = frame._section.querySelector('.fusion-root')?.cloneNode(true);
    if (!root) return;
    root.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    root.querySelectorAll('.fusion-selection,.fusion-guide,.fusion-crop-editor').forEach((n) => n.remove());
    frame.replaceChildren(root); frame._filled = true;
    frame.style.setProperty('--deck-scale', String(frame.clientWidth / 1920 || 0.08));
  }
  const lazy = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { fill(e.target); lazy.unobserve(e.target); } }, { root: list, rootMargin: '200px 0px' });
  function renderRail() {
    if (!list) return;
    lazy.disconnect();
    list.replaceChildren(...slides().map(thumb));
    numberRail();
    requestAnimationFrame(scaleThumbs);
  }
  function numberRail() {
    [...list.children].forEach((item, i) => { item.querySelector('.deck-thumb-no').textContent = String(i + 1); });
    $('deck-rail-count') && ($('deck-rail-count').textContent = String(slides().length));
  }
  function scaleThumbs() { for (const frame of list.querySelectorAll('.deck-thumb-frame')) frame.style.setProperty('--deck-scale', String(frame.clientWidth / 1920 || 0.08)); }
  new ResizeObserver(scaleThumbs).observe(list || document.body);
  const dirty = new Set(); let dirtyTimer = null;
  function refreshThumb(section) {
    dirty.add(section); clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(() => { for (const s of dirty) { const old = [...list.children].find((i) => i.dataset.slideId === s.dataset.slideId); if (old) old.replaceWith(thumb(s)); } dirty.clear(); numberRail(); scaleThumbs(); }, 280);
  }

  // Order changes go through the editor so they are undoable and saved.
  const commit = (next) => (onOrderChange ? onOrderChange(next) : applyOrder(next));
  function move(section, d) {
    const order = orderState(), i = order.slideOrder.indexOf(section.dataset.slideId), j = i + d;
    if (j < 0 || j >= order.slideOrder.length) return;
    [order.slideOrder[i], order.slideOrder[j]] = [order.slideOrder[j], order.slideOrder[i]];
    commit(order);
  }
  function toggleSkip(section) {
    const order = orderState(), id = section.dataset.slideId;
    order.skippedSlides = order.skippedSlides.includes(id) ? order.skippedSlides.filter((x) => x !== id) : [...order.skippedSlides, id];
    commit(order);
  }
  function remove(section) {
    if (slides().length <= 1) return status('至少保留一页。');
    const order = orderState(), id = section.dataset.slideId;
    order.slideOrder = order.slideOrder.filter((x) => x !== id); order.deletedSlides = [...order.deletedSlides, id];
    commit(order);
  }
  // Deleted sections are kept detached so undo can bring them back.
  const parked = new Map();
  function applyOrder({ slideOrder = [], skippedSlides = [], deletedSlides = [] }) {
    const keep = active?.dataset.slideId;
    for (const s of slides()) if (deletedSlides.includes(s.dataset.slideId)) { parked.set(s.dataset.slideId, s); s.remove(); }
    for (const id of slideOrder) { const s = slides().find((x) => x.dataset.slideId === id) || (!deletedSlides.includes(id) && parked.get(id)); if (s) { deck.append(s); parked.delete(id); } }
    for (const s of slides()) { if (skippedSlides.includes(s.dataset.slideId)) s.dataset.skipped = 'true'; else delete s.dataset.skipped; }
    deleted.clear(); deletedSlides.forEach((id) => deleted.add(id));
    renderRail();
    show(slides().find((s) => s.dataset.slideId === keep) || slides()[0], { force: true });
  }

  // Text editing: a text box becomes editable when it is double-clicked and locks again when it loses focus, so a
  // single click or Tab never puts a caret in it. Pasting keeps plain text only.
  const TEXT = '[data-fusion-element][data-element-type="text"]';
  function initEditable(scope = deck) {
    for (const el of scope.querySelectorAll(TEXT)) if (el !== document.activeElement || presenting || busy) el.removeAttribute('contenteditable');
  }
  document.addEventListener('dblclick', (ev) => {
    const node = ev.target.closest?.('#deck ' + TEXT);
    if (node && !presenting && !busy) node.setAttribute('contenteditable', 'true');
  }, true);
  deck.addEventListener('focusout', (ev) => { if (ev.target.matches?.(TEXT)) ev.target.removeAttribute('contenteditable'); });
  deck.addEventListener('paste', (ev) => {
    if (!ev.target.closest?.('[contenteditable="true"]')) return;
    ev.preventDefault();
    document.execCommand('insertText', false, ev.clipboardData.getData('text/plain'));
  });

  // Undo stack. Text typed inside a text box keeps the browser's own undo.
  const stack = [];
  const undo = { push(action) { stack.push(action); if (stack.length > 200) stack.shift(); }, undo() { const a = stack.pop(); if (!a) return false; a.undo(); return true; } };
  window.__deckUndo = undo;
  document.addEventListener('keydown', (ev) => {
    const key = String(ev.key || '').toLowerCase();
    if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && !ev.shiftKey && key === 'z' && !typing(ev.target)) { ev.preventDefault(); window.__deckUndo.undo(); return; }
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target)) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(ev.key)) { ev.preventDefault(); step(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(ev.key)) { ev.preventDefault(); step(-1); }
    else if (ev.key === 'Home') { ev.preventDefault(); show(presenting ? visible()[0] : slides()[0]); }
    else if (ev.key === 'End') { ev.preventDefault(); const v = presenting ? visible() : slides(); show(v[v.length - 1]); }
    else if (ev.key === 'Escape' && presenting) exitPresent();
  });
  $('deck-pager')?.addEventListener('click', (ev) => { const b = ev.target.closest('[data-step]'); if (b) step(Number(b.dataset.step)); });

  // Presenting.
  function present() {
    presenting = true; document.body.classList.add('deck-presenting'); document.body.classList.remove('deck-editing');
    document.activeElement?.blur?.(); initEditable();
    document.documentElement.requestFullscreen?.().catch(() => {});
    if (active?.dataset.skipped === 'true') go(0, { force: true }); else show(active, { force: true });
    fit();
  }
  function exitPresent() {
    presenting = false; document.body.classList.remove('deck-presenting'); document.body.classList.add('deck-editing');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    initEditable(); fit();
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presenting) exitPresent(); });
  $('deck-present')?.addEventListener('click', present);
  window.__enterPresentMode = present;
  window.__exitPresentMode = exitPresent;
  deck.addEventListener('click', (ev) => { if (presenting) step(ev.clientX < innerWidth / 3 ? -1 : 1); });

  // Export menu: each item calls the editor's export function and reports failures.
  const menu = $('deck-export-menu'), main = $('deck-export-main');
  const closeMenu = () => { if (menu) menu.hidden = true; main?.setAttribute('aria-expanded', 'false'); };
  main?.addEventListener('click', (ev) => { ev.stopPropagation(); menu.hidden = !menu.hidden; main.setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', (ev) => { if (!ev.target.closest?.('#deck-export')) closeMenu(); });
  const EXPORTS = { pptx: '__exportDeckPptx', pdf: '__exportDeckPdf', image: '__exportDeckImage', html: '__exportDeckHtml' };
  menu?.addEventListener('click', async (ev) => {
    const kind = ev.target.closest('[data-export]')?.dataset.export;
    if (!kind) return;
    closeMenu();
    const overlay = document.createElement('div'); overlay.className = 'deck-busy'; overlay.textContent = '正在导出…';
    document.body.append(overlay);
    try { await window[EXPORTS[kind]]?.(); } catch (error) { status('导出未完成：' + error.message); } finally { overlay.remove(); }
  });

  // PDF in the browser: one full-page picture per visible slide.
  window.__exportDeckPdfInBrowser = async () => {
    await loadScript('assets/vendor/html-to-image.js'); await loadScript('assets/vendor/pdf-lib.min.js');
    const pdf = await window.PDFLib.PDFDocument.create(), keep = active;
    try {
      for (const [i, s] of visible().entries()) {
        go(i, { force: true });
        await document.fonts.ready;
        const root = s.querySelector('.fusion-root');
        const png = await window.htmlToImage.toPng(root, { width: 1920, height: 1080, pixelRatio: 1, style: { transform: 'none' }, filter: (n) => !n.classList?.contains('fusion-selection') && !n.classList?.contains('fusion-guide') });
        const image = await pdf.embedPng(png), page = pdf.addPage([960, 540]);
        page.drawImage(image, { x: 0, y: 0, width: 960, height: 540 });
      }
    } finally { show(keep, { force: true }); }
    const blob = new Blob([await pdf.save()], { type: 'application/pdf' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = (document.title || '演示文稿') + '.pdf'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return { ok: true };
  };

  const setBusy = (value) => { busy = value; initEditable(); };
  renderRail();
  show(visible()[0] || slides()[0], { force: true });
  initEditable();
  fit();
  const api = { go, show, slides, visible, orderState, applyOrder, initEditable, refreshThumb, setBusy, isPresenting: () => presenting };
  window.__deck = api;
  return api;
}
