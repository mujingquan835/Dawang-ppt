import {mountSaveControls} from './save-controls.mjs';
import {inspectReadinessInDom} from '../qa/readiness.mjs';
import {serializePortableHtml,collectUsedFontFamilies,extractPortableProject} from '../portable/html.mjs';
import {mountImageCrop} from './image-crop.jsx';
import { readRunsFromDom, runsToHtml } from '../authoring/text-runs.mjs';
import { openDraftStore, draftDecision } from "./drafts.mjs";
import { writeEditablePackage } from "../export/write.mjs";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SceneRoot } from "../scene/render.jsx";
import { materializeElements, syncCompositionTextState } from "../scene/model.mjs";
import { mergeEditorState } from "../project/import-goal.mjs";
import { applyEditCommand } from "./commands.mjs";
import { mountInspector } from "./inspector.jsx";
import { collectSlideInDom } from "../export/collect.mjs";
import { composeEditablePptx } from "../export/pptx-core.mjs";
const seed = document.getElementById("fusion-project");
if (seed) {
  let saveControls = null;
  const saveKey = () => { const p = sync(); return JSON.stringify([p.slides,p.contentPlan,p.media,p.editorState]); };
  document.body.classList.add('fusion-editor');
  const syncEditorMode = () => document.body.classList.toggle('fusion-composition-active',!!document.querySelector('#deck > .fusion-slide.active'));
  syncEditorMode();
  // Selected element properties precede the optional full-deck font controls.
  const propsField = document.getElementById('preview-props-field');
  document.getElementById('preview-typography')?.before(propsField);
  let scheduleDraft = function() {
    saveControls?.changed();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => persistDraft().catch((error) => status("本地草稿保存失败，当前内容仍在页面中：" + error.message)), 100);
  }, sync = function() {
    const state = window.__deckViewModel?.getState();
    if (state) project = mergeEditorState(project, state, { bump: false });
    for (const section of sections()) {
      if (!section.classList.contains("active")) continue;
      const slide = project.slides.find((s) => s.slideId === section.dataset.vmSlideId);
      if (!slide) continue;
      for (const e of materializeElements(slide, project)) {
        if (e.type !== "text") continue;
        const el = [...section.querySelectorAll("[data-fusion-element]")].find((el2) => el2.dataset.fusionElement === e.id);
        if (!el) continue;
        if (el.innerText !== String(e.text ?? "")) {
          const runs = e.runs ? readRunsFromDom(el,e.runs) : null;
          if(e.runs && !runs){
            el.innerHTML=runsToHtml(e.runs);
            status('整段替换会清除句内样式；请在侧栏逐段编辑，或明确转为纯文本。');
            continue;
          }
          const r = applyEditCommand(project, { slideId: slide.slideId, elementId: e.id, ...(e.runs ? {type:'text-runs',runs} : {type:'text',text:el.innerText}) });
          if (r.ok) project = r.project;
        }
      }
    }
    project.revision = savedRevision;
    return structuredClone(project);
  }, status = function(text) {
    let el = document.getElementById("fusion-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "fusion-status";
      document.getElementById("preview-panel")?.append(el);
    }
    el.textContent = text;
  }, redraw = function(id) {
    const slide = project.slides.find((s) => s.slideId === id), el = sections().find((el2) => el2.dataset.vmSlideId === id);
    if (!slide || !el) return;
    let root = roots.get(el);
    if (!root) {
      root = createRoot(el);
      roots.set(el, root);
    }
    flushSync(() => root.render(<SceneRoot slide={slide} project={project} />));
    syncCompositionTextState(project);
    window.__replaceEditableTextState?.(project.editorState.legacy.text);
    window.__initEditableText?.(el);
    window.__markOverviewThumbDirty?.(el);
    refreshSelection();
  }, restore = function(snapshot) {
    if(exportBusy)return false;
    cropEditor?.cancel();
    restoring = true;
    try {
      const previousSelection = selected;
      project = structuredClone(snapshot);
      project.revision = savedRevision;
      applySnapshot(project.editorState.legacy);
      selected = previousSelection;
      for (const s of project.slides) if (s.mode === "composition") redraw(s.slideId);
      window.__deckViewModel?.persist();
      scheduleDraft();
    } finally {
      restoring = false;
    }
  }, redo = function() {
    if(exportBusy)return false;
    const next = redoSnapshots.pop();
    if (!next) return false;
    const before = sync();
    restore(next);
    stockPush({ label: "重做", undo: () => restore(before) });
    return true;
  }, apply = function(command) {
    if(exportBusy)return {ok:false,conflicts:[{kind:'export-in-progress'}]};
    cropEditor?.cancel();
    sync();
    const before = structuredClone(project), r = applyEditCommand(project, command);
    if (!r.ok) {
      status("修改未应用，当前草稿保留：" + JSON.stringify(r.conflicts));
      return r;
    }
    if (JSON.stringify([before.slides,before.contentPlan.nodes,before.media.entries]) === JSON.stringify([r.project.slides,r.project.contentPlan.nodes,r.project.media.entries])) return {...r,project};
    project = r.project;
    if (command.type === 'style' && 'fontFamily' in (command.style || {})) {
      window.__deckViewModel?.setTypography?.({mode:'individual'});
      project.editorState.legacy = window.__deckViewModel.getState();
    }
    redraw(command.slideId);
    window.__dashiUndo.push({ label: "组合对象修改", undo: () => restore(before) });
    window.__deckViewModel?.persist();
    scheduleDraft();
    return r;
  }, applySnapshot = function(state, currentIndex) {
    const vm = window.__deckViewModel;
    Object.assign(vm.model.state, state);
    window.__replaceEditableTextState?.(state.text || {});
    for (const [id, props] of Object.entries(state.props || {})) {
      vm.setProps(id, props);
      const el = [...document.querySelectorAll("#deck > .slide")].find((e) => e.dataset.vmSlideId === id);
      if (el) window.__renderRuntimeSlide?.(el, props, { trusted: true });
    }
    vm.setTypography?.(state.typography || {});
    vm.setSlideOrder(state.slideOrder || []);
    vm.setSkippedSlides(state.skippedSlides || []);
    vm.setDeletedSlides(state.deletedSlides || []);
    for (const id of state.slideOrder || []) {
      const el = [...document.querySelectorAll("#deck > .slide")].find((e) => e.dataset.vmSlideId === id);
      if (el) document.getElementById("deck").append(el);
    }
    window.__refreshFusionCatalog?.();
    window.__initEditableText?.(document.getElementById("deck"));
    if (currentIndex !== void 0) window.go(currentIndex, { animate: false, force: true });
  }, refreshSelection = function() {
    document.querySelectorAll("#deck .fusion-selection").forEach((e) => e.remove());
    if (!selected) return;
    const slide = project.slides.find((s) => s.slideId === selected.slideId), el = sections().find((s) => s.dataset.vmSlideId === selected.slideId);
    if (!slide || !el) return;
    const element = materializeElements(slide, project).find((e) => e.id === selected.elementId), object = slide.objects?.find((o) => o.objectId === element?.parentId);
    if (!element) return;
    const b = selectionMode === "group" && object ? object.bounds : element.bounds;
    const overlay = document.createElement("div");
    overlay.className = "fusion-selection";
    overlay.dataset.editableSkip = "true";
    overlay.style.cssText = `position:absolute;left:${b[0]}px;top:${b[1]}px;width:${b[2]}px;height:${b[3]}px;border:2px solid #1db477;pointer-events:none;z-index:10000`;
    const handle = document.createElement("button");
    handle.type = "button";
    handle.setAttribute("aria-label", "缩放选中对象");
    handle.dataset.fusionResize = "true";
    handle.style.cssText = "position:absolute;right:-8px;bottom:-8px;width:16px;height:16px;cursor:nwse-resize;pointer-events:auto;background:#1db477;border:1px solid white";
    const move = document.createElement('button');
    move.type='button';move.dataset.fusionMove='true';move.setAttribute('aria-label','移动选中对象');
    move.textContent='移动';move.style.cssText='position:absolute;left:0;top:-28px;height:24px;padding:2px 8px;border:0;border-radius:4px;background:#1db477;color:white;cursor:move;pointer-events:auto;font:12px sans-serif';
    overlay.append(move,handle);
    el.querySelector(".fusion-root").append(overlay);
    const field = document.getElementById("preview-props-field");
    field.classList.remove("is-hidden");
    mountInspector(document.getElementById("preview-props"), selected, api);
  };
  let cropEditor = null, exportBusy=false;
  let project = JSON.parse(seed.textContent), savedRevision = project.revision, selected = null, selectionMode = "group", redoSnapshots = [], restoring = false, saveQueue = Promise.resolve();
  const roots = /* @__PURE__ */ new Map();
  let draftStore = null, draftTimer = null, draftQueue = Promise.resolve(), ready = Promise.resolve();
  const projectId = project.requirements.projectId || "legacy:" + project.sources.entries.map((s) => s.sha256 || s.sourceId).join(":") + ":" + project.slides.map((s) => s.slideId).join(":");
  async function persistDraft() {
    if (!draftStore) return;
    const record = { projectId, baseRevision: savedRevision, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), project: structuredClone(project) };
    draftQueue = draftQueue.catch(() => {
    }).then(() => draftStore.put(record));
    try{await draftQueue;}catch(error){draftStore=null;status("本地草稿不可用，仍可下载HTML："+error.message);}
  }
  const stockUndo = window.__dashiUndo.undo.bind(window.__dashiUndo), stockPush = window.__dashiUndo.push.bind(window.__dashiUndo);
  const sections = () => [...document.querySelectorAll("#deck > .fusion-slide")];
  window.__dashiUndo.push = (action) => {
    if (!restoring) redoSnapshots = [];
    stockPush(action);
  };
  window.__dashiUndo.undo = () => {
    if(exportBusy)return false;
    const after = sync();
    const ok = stockUndo();
    if (ok) {
      sync();
      redoSnapshots.push(after);
      refreshSelection();
    }
    return ok;
  };
  async function saveNow(options = {}) {
    await ready;
    cropEditor?.confirm();
    const current = sync(), currentKey = saveKey();
    if(location.protocol==='file:'||document.getElementById('portable-project-meta')){
      if(!options.fileHandle)throw Error('请先关联源文件；保存不会自动下载副本');
      return downloadHtml(options.fileHandle);
    }
    await persistDraft().catch(error=>status('草稿不可用：'+error.message));
    const response = await fetch("/api/save-deck-state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: current.editorState.legacy, project: current, expectedRevision: savedRevision }) });
    const result = await response.json();
    if (!result.ok) {
      status("保存冲突，草稿已保留：" + JSON.stringify(result.conflicts || result.issues));
      throw new Error("Save conflict");
    }
    if (result.mediaMap) {
      const reconcile = (value) => typeof value === "string" ? result.mediaMap[value] || value : Array.isArray(value) ? value.map(reconcile) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reconcile(v)])) : value;
      project = reconcile(project);
      window.__deckViewModel.model.state = reconcile(window.__deckViewModel.model.state);
    }
    savedRevision = result.revision;
    project.revision = savedRevision;
    await persistDraft();
    saveControls?.saved(currentKey, '已保存工程');
    status(result.previewError ? "内容已保存，预览更新失败：" + result.previewError : "已保存");
    return result;
  }
  const save = (options={}) => {
    if(exportBusy&&!options.forExport)return Promise.reject(new Error('导出期间请等待当前操作完成'));
    const task = saveQueue.catch(() => {}).then(async () => {
      saveControls?.begin();
      try { return await saveNow({...options,fileHandle:options.fileHandle || saveControls?.getFileHandle()}); }
      catch (error) { saveControls?.failed(error); throw error; }
    });
    saveQueue = task;
    return task;
  };
  const beginCrop = selection => {
    cropEditor?.cancel();
    if(!window.__canEditDeck?.())return;
    const p=sync(),slide=p.slides.find(s=>s.slideId===selection.slideId);
    const element=slide&&materializeElements(slide,p).find(e=>e.id===selection.elementId);
    const root=sections().find(s=>s.dataset.vmSlideId===selection.slideId)?.querySelector('.fusion-root');
    const node=root&&[...root.querySelectorAll('[data-fusion-element]')].find(e=>e.dataset.fusionElement===selection.elementId);
    const image=node?.tagName==='IMG'?node:node?.querySelector('img');
    if(element?.type!=='image'||!image?.complete||!image.naturalWidth){status('图片尚未加载完成，请稍后重试。');return;}
    document.querySelectorAll('#deck .fusion-selection').forEach(e=>e.remove());
    cropEditor=mountImageCrop({root,element,image,onClose:()=>{cropEditor=null;refreshSelection();},onApply:({crop,bounds})=>apply({...selection,type:'image',src:element.src,fit:'cover',crop,bounds})});
  };
  const api = { isExporting:()=>exportBusy, isPortable:()=>location.protocol==='file:'||!!document.getElementById('portable-project-meta'), beginCrop, commitPendingEdits: () => cropEditor?.confirm(), ready: () => ready, flushDraft: async () => {
    await ready;
    sync();
    await persistDraft();
  }, getProject: sync, apply, save: (options={}) => (location.protocol==='file:'||document.getElementById('portable-project-meta'))&&!options.fileHandle ? saveControls.run() : save(options), undo: () => window.__dashiUndo.undo(), redo, selectionMode: (value) => {
    if (value) selectionMode = value;
    return selectionMode;
  }, refreshSelection, acceptRevision: (r) => {
    savedRevision = r;
    project.revision = r;
  } };
  window.__fusionEditor = api;
  const portable=()=>location.protocol==='file:'||!!document.getElementById('portable-project-meta');
  const download=async(blob,name)=>{const href=URL.createObjectURL(blob);try{const a=document.createElement('a');a.href=href;a.download=name;a.click();}finally{setTimeout(()=>URL.revokeObjectURL(href),1000);}};
  async function portableHtml(onSnapshot){
    await ready;cropEditor?.confirm();const p=sync();
    if(portable())p.revision=crypto.randomUUID();
    if(typeof onSnapshot === 'function')onSnapshot(saveKey(),p.revision);
    const usedFontFamilies=collectUsedFontFamilies(document,p);
    const clone=document.documentElement.cloneNode(true);
    await window.__preparePortableClone?.(clone);
    const html=await serializePortableHtml({document:clone,project:p,baseRevision:savedRevision,usedFontFamilies});
    return html;
  }
  function htmlFilename(){
    if(location.protocol==='file:')try{return decodeURIComponent(location.pathname.split('/').pop()) || '报告.html';}catch{}
    return (project.requirements.title||'报告')+'.html';
  }
  async function downloadHtml(fileHandle){
    let key,revision;
    const html=await portableHtml((k,r)=>{key=k;revision=r;});
    if(fileHandle){
      const writable=await fileHandle.createWritable();
      try{await writable.write(html);await writable.close();}
      catch(error){try{await writable.abort();}catch{}throw error;}
    }else await download(new Blob([html],{type:'text/html;charset=utf-8'}),htmlFilename());
    if(fileHandle){
      if(portable()){project.revision=revision;savedRevision=revision;}
      saveControls?.saved(key,'已保存到源文件：'+fileHandle.name);
      await persistDraft();
    }
    status(fileHandle?'已保存到源文件：'+fileHandle.name:'已导出HTML副本；源文件的修改仍需点击保存。');
    return {ok:true,revision:project.revision};
  }
  api.serializeHtml=portableHtml;
  window.__exportDeckHtml=()=>withSnapshot(downloadHtml);
  document.getElementById('preview-export-image')?.addEventListener('click',()=>window.__exportDeckImage());
  saveControls=mountSaveControls({portable:portable(),getKey:saveKey,save,validateSource:async handle=>{
    const file=await handle.getFile();
    if(location.protocol==='file:' && file.name!==htmlFilename())throw Error('请选择当前打开的原HTML：'+htmlFilename());
    const source=extractPortableProject(await file.text());
    if(source.requirements.projectId!==project.requirements.projectId)throw Error('所选文件不属于当前演示稿，请重新关联原HTML');
  }});

  async function waitReady(id){
    const deadline=Date.now()+10000;let state;
    do{state=inspectReadinessInDom(id);if(state.ready)return state;if(state.issues.some(i=>['missing-image','font-unavailable'].includes(i.kind)))break;await new Promise(r=>setTimeout(r,30));}while(Date.now()<deadline);
    throw Error('导出检查未通过：'+JSON.stringify(state.issues));
  }
  async function withSnapshot(operation){
    if(exportBusy)throw Error('导出正在进行');await ready;cropEditor?.confirm();sync();
    exportBusy=true;const index=window.__currentSlideIndex,editables=[...document.querySelectorAll('#deck [contenteditable="true"]')];
    editables.forEach(e=>e.setAttribute('contenteditable','false'));
    try{return await operation();}finally{editables.forEach(e=>e.setAttribute('contenteditable','true'));exportBusy=false;window.go(index,{animate:false,force:true});}
  }
  async function browserExport() {
    cropEditor?.confirm();
    const p = sync(), collection = { revision: p.revision, width: 1920, height: 1080, slides: [] };
    const oldIndex = window.__currentSlideIndex;
    try {
      for (const el of window.__getVisibleSlides()) {
        window.go(window.__getVisibleSlides().indexOf(el), { animate: false, force: true });
        await document.fonts.ready;
        await Promise.all([...el.querySelectorAll("img")].map((img) => img.decode().catch(() => {
        })));
        await waitReady(el.dataset.vmSlideId);
        const collected = collectSlideInDom(el.dataset.vmSlideId);
        for (const o of collected.objects) if (o.type === "image" && !o.src.startsWith("data:")) {
          const blob = await (await fetch(o.src)).blob();
          o.src = await new Promise((resolve) => {
            const f = new FileReader();
            f.onload = () => resolve(f.result);
            f.readAsDataURL(blob);
          });
        }
        collection.slides.push(collected);
      }
      window.pptxgen ||= window.PptxGenJS;
      if (!window.pptxgen) await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "assets/vendor/pptxgen.bundle.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      window.pptxgen ||= window.PptxGenJS;
      const { pptx, report } = composeEditablePptx(window.pptxgen, collection, { title: p.requirements.title });
      return { blob: await writeEditablePackage(pptx, collection, { type: "blob" }), report };
    } finally {
      window.go(oldIndex, { animate: false, force: true });
    }
  }
  window.__dawangExport = { applyEditablePptxSnapshot: ({ state, currentIndex }) => applySnapshot(state, currentIndex), exportEditablePptxInBrowser: browserExport };
  async function exportFile(pdf = false) {
    await save({forExport:true});
    const response = await fetch(pdf ? "/api/export-pdf" : "/api/export-editable-pptx", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: savedRevision }) });
    const r = await response.json();
    if (!r.ok) {
      status("导出未完成：" + JSON.stringify(r.issues));
      throw new Error(JSON.stringify(r.issues));
    }
    window.__lastPptxExportResult = r;
    const a = document.createElement("a");
    a.href = r.downloadUrl;
    a.download = r.downloadName;
    document.body.append(a);
    a.click();
    a.remove();
    return r;
  }
  window.__exportDeckPptx = () => withSnapshot(()=>portable()?window.__exportDeckPptxInBrowser():exportFile());
  window.__exportDeckPdf = () => withSnapshot(async()=>{
    if(!portable())return exportFile(true);
    for(const [index,el] of window.__getVisibleSlides().entries()){window.go(index,{animate:false,force:true});await waitReady(el.dataset.vmSlideId);}
    return window.__exportDeckPdfInBrowser();
  });
  window.__exportDeckImage = () => withSnapshot(async()=>{
    const el=window.__getVisibleSlides()[window.__currentSlideIndex||0];await waitReady(el.dataset.vmSlideId);
    if(!window.htmlToImage){const script=document.createElement('script');script.src='assets/vendor/html-to-image.js';await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;document.head.append(script);});}
    const root=el.querySelector('.fusion-root,.imported-theme-root')||el;
    const blob=await window.htmlToImage.toBlob(root,{width:1920,height:1080,pixelRatio:1,style:{transform:'none',left:'0',top:'0'},filter:node=>!node.classList?.contains('fusion-selection')&&!node.classList?.contains('fusion-crop-editor')});
    await download(blob,(project.requirements.title||'报告')+'-'+(window.__currentSlideIndex+1)+'.png');return {ok:true};
  });
  window.__exportDeckPptxInBrowser = async () => {
    const result = await browserExport();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(result.blob);
    a.download = "presentation.pptx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
    return { ok: true, report: result.report };
  };
  document.addEventListener("input", (ev) => {
    if (ev.target.closest?.("#deck [data-fusion-element]")) sync();
    scheduleDraft();
  });
  addEventListener("pagehide", () => {
    sync();
    persistDraft().catch(() => {
    });
  });
  ready = (async () => {
    try {
      draftStore = await openDraftStore();
      const record = await draftStore.get(projectId), decision = draftDecision(record, project);
      if (decision === "restore") {
        restore(record.project);
        status("已恢复本地草稿；保存后同步到源项目。");
      } else if (decision === "conflict") {
        status("本地草稿与磁盘版本不同，两个版本均已保留；请下载草稿对照后决定。");
        const button = document.createElement("button");
        button.textContent = "下载冲突草稿";
        button.onclick = () => {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(new Blob([JSON.stringify(record.project, null, 2)], { type: "application/json" }));
          link.download = "conflicting-deck-project.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
        };
        document.getElementById("fusion-status").append(button);
        draftStore = null;
        api.conflictingDraft = record.project;
      } else scheduleDraft();
    } catch (error) {
      status("浏览器本地草稿存储不可用：" + error.message + "；请保持页面打开并使用保存。");
    }
  })();
  document.addEventListener("click", (ev) => {
    if(ev.target.closest?.('.fusion-crop-editor'))return;
    const el = ev.target.closest?.("#deck [data-fusion-element]");
    if (!el || !window.__canEditDeck?.()) return;
    selected = { slideId: el.closest(".slide").dataset.vmSlideId, elementId: el.dataset.fusionElement };
    refreshSelection();
  });
  let drag = null, suppressClick = false;
  const restorePreview = d => d.nodes.forEach(({node,css}) => {node.style.cssText=css;});
  const cancelDrag = () => {
    if (!drag) return;
    const d=drag;drag=null;restorePreview(d);
    if(d.capture.hasPointerCapture?.(d.pointerId))d.capture.releasePointerCapture(d.pointerId);
    refreshSelection();
  };
  document.addEventListener('click',ev=>{
    if(!suppressClick)return;
    suppressClick=false;ev.preventDefault();ev.stopImmediatePropagation();
  },true);
  document.addEventListener('pointerdown', ev => {
    if(cropEditor)return;
    const target=ev.target.closest?.('#deck [data-fusion-element]');
    const resize=ev.target.closest?.('[data-fusion-resize]'),move=ev.target.closest?.('[data-fusion-move]');
    if(ev.button!==0 || !window.__canEditDeck?.() || (!resize&&!move&&(!target || (target.dataset.elementType==='text'&&!ev.altKey))))return;
    if(target)selected={slideId:target.closest('.slide').dataset.vmSlideId,elementId:target.dataset.fusionElement};
    if(!selected)return;
    const p=sync(),slide=p.slides.find(s=>s.slideId===selected.slideId);
    if(!slide)return;
    const elements=materializeElements(slide,p),element=elements.find(e=>e.id===selected.elementId);
    if(!element)return;
    const object=slide.objects?.find(o=>o.objectId===element.parentId);
    const grouped=selectionMode==='group'&&object;
    const b=grouped?object.bounds:element.bounds;
    const root=sections().find(el=>el.dataset.vmSlideId===selected.slideId).querySelector('.fusion-root');
    const scale=root.getBoundingClientRect().width/1920;
    if(!Number.isFinite(scale)||scale<=0)return;
    if(!resize&&!move)refreshSelection();
    const ids=new Set((grouped?elements.filter(e=>e.parentId===object.objectId):[element]).map(e=>e.id));
    const nodes=[...root.querySelectorAll('[data-fusion-element]')].filter(node=>ids.has(node.dataset.fusionElement)).map(node=>({node,css:node.style.cssText,b:elements.find(e=>e.id===node.dataset.fusionElement).bounds}));
    const overlay=root.querySelector('.fusion-selection');
    if(overlay)nodes.push({node:overlay,css:overlay.style.cssText,b:[...b]});
    drag={x:ev.clientX,y:ev.clientY,b:[...b],next:[...b],scale,objectId:grouped?object.objectId:null,resize:!!resize,nodes,selection:{...selected},pointerId:ev.pointerId,capture:ev.target,moved:false};
    ev.target.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();ev.stopPropagation();
  },true);
  const previewDrag = ev => {
    if(!drag || ev.pointerId!==drag.pointerId)return;
    const d=drag,dx=(ev.clientX-d.x)/d.scale,dy=(ev.clientY-d.y)/d.scale;
    if(!d.moved && Math.hypot(ev.clientX-d.x,ev.clientY-d.y)<3)return;
    d.moved=true;
    d.next=d.resize?[d.b[0],d.b[1],Math.max(20,d.b[2]+dx),Math.max(20,d.b[3]+dy)]:[d.b[0]+dx,d.b[1]+dy,d.b[2],d.b[3]];
    for(const {node,b} of d.nodes){
      const sx=d.next[2]/d.b[2],sy=d.next[3]/d.b[3];
      Object.assign(node.style,{left:(d.next[0]+(b[0]-d.b[0])*sx)+'px',top:(d.next[1]+(b[1]-d.b[1])*sy)+'px',width:b[2]*sx+'px',height:b[3]*sy+'px'});
    }
    ev.preventDefault();
  };
  document.addEventListener('pointermove',previewDrag,{passive:false});
  document.addEventListener('pointerup',ev=>{
    if(!drag || ev.pointerId!==drag.pointerId)return;
    previewDrag(ev);
    const d=drag;drag=null;restorePreview(d);
    if(d.capture.hasPointerCapture?.(d.pointerId))d.capture.releasePointerCapture(d.pointerId);
    if(!d.moved)return;
    suppressClick=true;
    setTimeout(()=>{suppressClick=false;},0);
    apply({...d.selection,type:d.objectId?'object-geometry':'geometry',objectId:d.objectId,bounds:d.next});
  });
  document.addEventListener('pointercancel',cancelDrag);
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&drag){cancelDrag();ev.preventDefault();ev.stopImmediatePropagation();}},true);
  addEventListener('blur',cancelDrag);
  addEventListener("swiss-slide-change", () => {
    cropEditor?.cancel();
    cancelDrag();
    syncEditorMode();
    selected = null;
    document.querySelectorAll("#deck .fusion-selection").forEach((e) => e.remove());
  });
}
