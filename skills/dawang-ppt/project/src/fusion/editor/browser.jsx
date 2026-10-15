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
  let scheduleDraft = function() {
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
          const r = applyEditCommand(project, { slideId: slide.slideId, elementId: e.id, type: "text", text: el.innerText });
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
    restoring = true;
    try {
      project = structuredClone(snapshot);
      project.revision = savedRevision;
      applySnapshot(project.editorState.legacy);
      for (const s of project.slides) if (s.mode === "composition") redraw(s.slideId);
      window.__deckViewModel?.persist();
      scheduleDraft();
    } finally {
      restoring = false;
    }
  }, redo = function() {
    const next = redoSnapshots.pop();
    if (!next) return false;
    const before = sync();
    restore(next);
    stockPush({ label: "重做", undo: () => restore(before) });
    return true;
  }, apply = function(command) {
    sync();
    const before = structuredClone(project), r = applyEditCommand(project, command);
    if (!r.ok) {
      status("修改未应用，当前草稿保留：" + JSON.stringify(r.conflicts));
      return r;
    }
    project = r.project;
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
    overlay.append(handle);
    el.querySelector(".fusion-root").append(overlay);
    const field = document.getElementById("preview-props-field");
    field.classList.remove("is-hidden");
    mountInspector(document.getElementById("preview-props"), selected, api);
  };
  let project = JSON.parse(seed.textContent), savedRevision = project.revision, selected = null, selectionMode = "group", redoSnapshots = [], restoring = false, saveQueue = Promise.resolve();
  const roots = /* @__PURE__ */ new Map();
  let draftStore = null, draftTimer = null, draftQueue = Promise.resolve(), ready = Promise.resolve();
  const projectId = project.requirements.projectId || "legacy:" + project.sources.entries.map((s) => s.sha256 || s.sourceId).join(":") + ":" + project.slides.map((s) => s.slideId).join(":");
  async function persistDraft() {
    if (!draftStore) return;
    const record = { projectId, baseRevision: savedRevision, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), project: structuredClone(project) };
    draftQueue = draftQueue.catch(() => {
    }).then(() => draftStore.put(record));
    await draftQueue;
  }
  const stockUndo = window.__dashiUndo.undo.bind(window.__dashiUndo), stockPush = window.__dashiUndo.push.bind(window.__dashiUndo);
  const sections = () => [...document.querySelectorAll("#deck > .fusion-slide")];
  window.__dashiUndo.push = (action) => {
    if (!restoring) redoSnapshots = [];
    stockPush(action);
  };
  window.__dashiUndo.undo = () => {
    const after = sync();
    const ok = stockUndo();
    if (ok) {
      sync();
      redoSnapshots.push(after);
      refreshSelection();
    }
    return ok;
  };
  async function saveNow() {
    await ready;
    const current = sync();
    await persistDraft();
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
    status(result.previewError ? "内容已保存，预览更新失败：" + result.previewError : "已保存");
    return result;
  }
  const save = () => {
    const task = saveQueue.catch(() => {
    }).then(saveNow);
    saveQueue = task;
    return task;
  };
  const api = { ready: () => ready, flushDraft: async () => {
    await ready;
    sync();
    await persistDraft();
  }, getProject: sync, apply, save, undo: () => window.__dashiUndo.undo(), redo, selectionMode: (value) => {
    if (value) selectionMode = value;
    return selectionMode;
  }, refreshSelection, acceptRevision: (r) => {
    savedRevision = r;
    project.revision = r;
  } };
  window.__fusionEditor = api;
  async function browserExport() {
    const p = sync(), collection = { revision: p.revision, width: 1920, height: 1080, slides: [] };
    const oldIndex = window.__currentSlideIndex;
    try {
      for (const el of window.__getVisibleSlides()) {
        window.go(window.__getVisibleSlides().indexOf(el), { animate: false, force: true });
        await document.fonts.ready;
        await Promise.all([...el.querySelectorAll("img")].map((img) => img.decode().catch(() => {
        })));
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
      if (!window.pptxgen) await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "assets/vendor/pptxgen.bundle.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
      const { pptx, report } = composeEditablePptx(window.pptxgen, collection, { title: p.requirements.title });
      return { blob: await writeEditablePackage(pptx, collection, { type: "blob" }), report };
    } finally {
      window.go(oldIndex, { animate: false, force: true });
    }
  }
  window.__dawangExport = { applyEditablePptxSnapshot: ({ state, currentIndex }) => applySnapshot(state, currentIndex), exportEditablePptxInBrowser: browserExport };
  async function exportFile(pdf = false) {
    await save();
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
  window.__exportDeckPptx = () => exportFile();
  window.__exportDeckPdf = () => exportFile(true);
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
    const el = ev.target.closest?.("#deck [data-fusion-element]");
    if (!el || !window.__canEditDeck?.()) return;
    selected = { slideId: el.closest(".slide").dataset.vmSlideId, elementId: el.dataset.fusionElement };
    refreshSelection();
  });
  let drag = null;
  document.addEventListener("pointerdown", (ev) => {
    const target = ev.target.closest?.("#deck [data-fusion-element]"), resize = ev.target.closest?.("[data-fusion-resize]");
    if (!window.__canEditDeck?.() || !resize && (!ev.altKey || !target)) return;
    if (target) selected = { slideId: target.closest(".slide").dataset.vmSlideId, elementId: target.dataset.fusionElement };
    const p = sync(), s = p.slides.find((s2) => s2.slideId === selected.slideId), e = materializeElements(s, p).find((e2) => e2.id === selected.elementId), o = s.objects.find((o2) => o2.objectId === e.parentId);
    const b = selectionMode === "group" && o ? o.bounds : e.bounds;
    const root = sections().find((el) => el.dataset.vmSlideId === selected.slideId).querySelector(".fusion-root");
    drag = { x: ev.clientX, y: ev.clientY, b: [...b], scale: root.getBoundingClientRect().width / 1920, objectId: selectionMode === "group" ? o?.objectId : null, resize: !!resize };
    ev.preventDefault();
    ev.stopPropagation();
  }, true);
  document.addEventListener("pointerup", (ev) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const dx = (ev.clientX - d.x) / d.scale, dy = (ev.clientY - d.y) / d.scale;
    const b = d.resize ? [d.b[0], d.b[1], Math.max(20, d.b[2] + dx), Math.max(20, d.b[3] + dy)] : [d.b[0] + dx, d.b[1] + dy, d.b[2], d.b[3]];
    apply({ ...selected, type: d.objectId ? "object-geometry" : "geometry", objectId: d.objectId, bounds: b });
  });
  addEventListener("swiss-slide-change", () => {
    selected = null;
    document.querySelectorAll("#deck .fusion-selection").forEach((e) => e.remove());
  });
}
