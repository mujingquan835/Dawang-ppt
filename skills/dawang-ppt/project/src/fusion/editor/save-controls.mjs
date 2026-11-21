// Compact Studio save controls: clean secondary Save button with live dot + compact link icon.
// A source handle is granted by the user; Save never falls back to a download.
async function handleStore(operation, handle) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('dawang-html-source-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('handles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', operation === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('handles'), key = location.href.split('#')[0];
      const request = operation === 'get' ? store.get(key) : store.put(handle, key);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const LINK_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.8 9.2a3.2 3.2 0 0 0 4.5 0l1.7-1.7a3.2 3.2 0 0 0-4.5-4.5L7.5 4"/><path d="M9.2 6.8a3.2 3.2 0 0 0-4.5 0L3 8.5A3.2 3.2 0 0 0 7.5 13l1-1"/></svg>';
const SAVE_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2.5h8.2L13.5 4.8V13a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8Z"/><path d="M5.2 2.5v3.3h5.2V2.5"/><path d="M5 13.8V9.5h6v4.3"/></svg>';

export function mountSaveControls({ portable, getKey, save, validateSource }) {
  const actions = document.querySelector('#deck-topbar .deck-actions');
  if (!actions) return null;
  document.getElementById('fusion-save-controls')?.remove();

  const box = document.createElement('div');
  box.id = 'fusion-save-controls';

  const state = document.createElement('span');
  state.id = 'fusion-save-state';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');

  const button = document.createElement('button');
  button.id = 'fusion-save-html';
  button.type = 'button';
  button.className = 'deck-button fusion-save-pill';
  button.title = portable ? '保存回源文件（⌘S / Ctrl+S）；首次将提示选择当前打开的原HTML' : '保存工程（⌘S / Ctrl+S）';
  const dot = document.createElement('span');
  dot.className = 'fusion-save-dot';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = portable ? '保存' : '保存工程';
  button.innerHTML = SAVE_SVG;
  button.append(labelSpan, dot);

  box.append(state, button);

  let fileButton;
  if (portable && typeof window.showOpenFilePicker === 'function') {
    fileButton = document.createElement('button');
    fileButton.id = 'fusion-save-as';
    fileButton.type = 'button';
    fileButton.className = 'deck-button';
    fileButton.innerHTML = LINK_SVG;
    fileButton.setAttribute('aria-label', '关联源文件');
    fileButton.title = '关联原 HTML 源文件（保存时直接覆盖，不产生副本）';
    box.append(fileButton);
  }
  actions.prepend(box);

  let baseline = getKey(), busy = false, chosenFile = null, restoringHandle = false;
  const dirty = () => getKey() !== baseline;
  const show = (text, kind) => {
    state.textContent = text;
    state.dataset.state = kind;
    dot.dataset.state = kind;
    state.title = text;
  };
  const changed = () => {
    if (busy) return;
    if (dirty()) show('未保存', 'dirty');
    else if (state.dataset.state === 'dirty') show(chosenFile ? '已保存' : '未修改', 'clean');
  };
  const begin = () => {
    busy = true; button.disabled = true;
    if (fileButton) fileButton.disabled = true;
    show('保存中…', 'saving');
  };
  const finish = () => { busy = false; button.disabled = false; if (fileButton) fileButton.disabled = false; };
  const saved = (key, label) => {
    baseline = key; finish();
    show(dirty() ? '未保存' : '已保存', dirty() ? 'dirty' : 'saved');
    state.title = label || '已保存';
  };
  const failed = (error) => {
    finish();
    show(error?.name === 'AbortError' ? (dirty() ? '已取消' : '未修改') : '保存失败', 'error');
    state.title = error?.message || '保存失败';
  };
  const run = async (selectFile = false) => {
    if (busy || restoringHandle) return { ok: false };
    let handle = chosenFile;
    try {
      if (portable && typeof window.showOpenFilePicker !== 'function' && !handle) {
        show('需 Chrome/Edge', 'error');
        return { ok: false };
      }
      if (portable && (selectFile || !handle)) {
        const picker = window.showOpenFilePicker({
          multiple: false,
          types: [{ description: '选择当前打开的原HTML', accept: { 'text/html': ['.html'] } }],
        });
        begin();
        [handle] = await picker;
      }
      if (!busy) begin();
      if (portable) {
        if (!handle) throw Error('尚未关联源文件');
        const permission = handle.queryPermission ? await handle.queryPermission({ mode: 'readwrite' }) : 'granted';
        if (permission !== 'granted' && (!handle.requestPermission || (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted')) {
          throw Error('尚未获得源文件写入授权，修改仍保留在页面中');
        }
        await validateSource?.(handle);
      }
      const result = await save({ fileHandle: handle });
      if (portable) {
        chosenFile = handle;
        if (fileButton) fileButton.title = '已关联：' + handle.name + '（点击重新关联）';
        try { await handleStore('put', handle); }
        catch { if (!dirty()) show('已保存', 'saved'); }
      }
      return result;
    } catch (error) { failed(error); return { ok: false, error: error.message }; }
  };
  button.addEventListener('click', () => run());
  fileButton?.addEventListener('click', () => run(true));
  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 's') return;
    event.preventDefault(); event.stopImmediatePropagation(); run();
  }, true);
  window.addEventListener('deck-change', () => queueMicrotask(changed));
  show(portable ? '未关联' : '已就绪', 'clean');
  if (portable) {
    restoringHandle = true; button.disabled = true;
    handleStore('get').then((handle) => {
      if (handle) {
        chosenFile = handle;
        if (fileButton) fileButton.title = '已关联：' + handle.name + '（点击重新关联）';
        show('已关联', 'clean');
      }
    }).catch(() => {}).finally(() => { restoringHandle = false; button.disabled = false; changed(); });
  }
  return { changed, begin, saved, failed, run, getFileHandle: () => chosenFile };
}
