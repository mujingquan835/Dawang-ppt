// A source handle is granted by the user; Save never falls back to a download.
async function handleStore(operation, handle) {
  const db = await new Promise((resolve,reject) => {
    const request=indexedDB.open('dawang-html-source-files',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('handles');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('handles',operation==='get'?'readonly':'readwrite');
      const store=tx.objectStore('handles'), key=location.href.split('#')[0];
      const request=operation==='get'?store.get(key):store.put(handle,key);
      tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  } finally {db.close();}
}
export function mountSaveControls({portable, getKey, save, validateSource}) {
  const actions = document.querySelector('#deck-topbar .pp-topbar-actions');
  if (!actions) return null;
  document.getElementById('fusion-save-controls')?.remove();
  const box = document.createElement('div');
  box.id = 'fusion-save-controls';
  box.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0';
  const button = document.createElement('button');
  button.id = 'fusion-save-html';
  button.type = 'button';
  button.className = 'pp-present';
  button.style.cssText = 'height:34px;padding:0 14px;border:0;border-radius:6px;cursor:pointer;background:var(--pp-blue);color:#fff;font:600 13px/1 var(--sans-zh);white-space:nowrap';
  button.textContent = portable ? '保存' : '保存工程';
  button.title = portable ? '保存回源文件（⌘S / Ctrl+S）；首次需要选择当前打开的原HTML授权' : '保存工程（⌘S / Ctrl+S）';
  const state = document.createElement('span');
  state.id = 'fusion-save-state';
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');
  state.style.cssText = 'font-size:12px;line-height:1.4;max-width:210px;white-space:normal';
  box.append(button, state);
  let fileButton;
  if (portable && typeof window.showOpenFilePicker === 'function') {
    fileButton = document.createElement('button');
    fileButton.id = 'fusion-save-as';
    fileButton.type = 'button';
    fileButton.className = 'pp-reset';
    fileButton.style.cssText = 'height:34px;padding:0 12px;border:1px solid var(--pp-border);border-radius:6px;cursor:pointer;background:var(--pp-chip);color:var(--pp-fg);font:500 13px/1 var(--sans-zh);white-space:nowrap';
    fileButton.textContent = '关联源文件';
    fileButton.title = '选择已经存在的原HTML；以后保存都覆盖该文件，不创建副本';
    box.append(fileButton);
  }
  actions.prepend(box);
  let baseline = getKey(), busy = false, chosenFile = null, restoringHandle = false;
  const dirty = () => getKey() !== baseline;
  const show = (text, kind) => {
    state.textContent = text;
    state.dataset.state = kind;
    state.style.color = kind === 'dirty' || kind === 'error' ? '#a75223' : 'inherit';
  };
  const changed = () => {
    if (busy) return;
    if (dirty()) show('有未保存修改', 'dirty');
    else if (state.dataset.state === 'dirty') show('无未保存修改', 'clean');
  };
  const begin = () => {
    busy = true; button.disabled = true;
    if (fileButton) fileButton.disabled = true;
    show('正在保存…', 'saving');
  };
  const finish = () => { busy = false; button.disabled = false; if (fileButton) fileButton.disabled = false; };
  const saved = (key, label) => {
    baseline = key; finish();
    show(dirty() ? '有未保存修改' : label, dirty() ? 'dirty' : 'saved');
  };
  const failed = error => {
    finish();
    show(error?.name === 'AbortError' ? (dirty() ? '已取消；修改尚未保存' : '已取消保存') : '保存失败：'+error.message, 'error');
  };
  const run = async (selectFile = false) => {
    if (busy || restoringHandle) return {ok:false};
    let handle = chosenFile;
    try {
      if (portable && typeof window.showOpenFilePicker !== 'function' && !handle) {
        show('此浏览器不支持写回源文件；请用Chrome或Edge打开', 'error');
        return {ok:false};
      }
      if (portable && (selectFile || !handle)) {
        // An OPEN picker can only select an existing file, never create a second HTML.
        const picker = window.showOpenFilePicker({multiple:false,
          types:[{description:'选择当前打开的原HTML',accept:{'text/html':['.html']}}]
        });
        begin();
        [handle] = await picker;
      }
      if (!busy) begin();
      if (portable) {
        if (!handle) throw Error('尚未关联源文件');
        const permission = handle.queryPermission ? await handle.queryPermission({mode:'readwrite'}) : 'granted';
        if (permission !== 'granted' && (!handle.requestPermission || await handle.requestPermission({mode:'readwrite'}) !== 'granted')) {
          throw Error('尚未获得源文件写入授权，修改仍保留在页面中');
        }
        await validateSource?.(handle);
      }
      const result = await save({fileHandle:handle});
      if (portable) {
        chosenFile = handle;
        if (fileButton) fileButton.textContent = '重新关联';
        try { await handleStore('put',handle); }
        catch { if(!dirty())show('已保存；重开需重新关联', 'saved'); }
      }
      return result;
    } catch (error) { failed(error); return {ok:false,error:error.message}; }
  };
  button.addEventListener('click', () => run());
  fileButton?.addEventListener('click', () => run(true));
  document.addEventListener('keydown', event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 's') return;
    event.preventDefault(); event.stopImmediatePropagation(); run();
  }, true);
  window.addEventListener('dashi-deck-change', () => queueMicrotask(changed));
  show(portable ? '首次保存需关联原HTML' : '工程已打开', 'clean');
  if (portable) {
    restoringHandle=true;button.disabled=true;
    handleStore('get').then(handle=>{
      if(handle){chosenFile=handle;if(fileButton)fileButton.textContent='重新关联';show('已关联：'+handle.name,'clean');}
    }).catch(()=>{}).finally(()=>{restoringHandle=false;button.disabled=false;changed();});
  }
  return {changed, begin, saved, failed, run, getFileHandle:()=>chosenFile};
}
