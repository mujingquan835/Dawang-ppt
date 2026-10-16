import { clone, revision } from "../project/schema.mjs";
import { layoutObject, deriveSlideElements } from "../objects/index.mjs";
import { resolveStyle, resolveSlideStyle } from "../styles/registry.mjs";
import { syncCompositionTextState } from "../scene/model.mjs";
import { changeSlideAppearance } from "../styles/appearance.mjs";
const boundsValid = (b) => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[2] > 0 && b[3] > 0;
function applyEditCommand(project, command) {
  const p = clone(project);
  const s = p.slides.find((s2) => s2.slideId === command.slideId);
  if (!s) return { ok: false, conflicts: [{ kind: "missing-slide" }] };
  if (s.mode !== "composition") return { ok: false, conflicts: [{ kind: "use-original-template-controls" }] };
  const style = resolveSlideStyle(s);
  const o = s.objects?.find((o2) => o2.objectId === command.objectId) || s.objects?.find((o2) => command.elementId?.startsWith(o2.objectId + "/"));
  const e = deriveSlideElements(s, style).find((e2) => e2.id === command.elementId);
  const beforeSlide = clone(s), beforeNodes = clone(p.contentPlan.nodes), beforeEdits = p.sources.userEdits.length;
  try {
    if (command.type === "appearance") {
      Object.assign(s, changeSlideAppearance(s, style, resolveStyle(command.styleId)));
    } else if (command.type === "semantic") {
      if (!o) throw new Error("Object missing");
      const candidate = { ...o, ...command.relationships !== void 0 ? { relationshipPolicy: "explicit" } : {}, data: clone(command.data), relationships: clone(command.relationships ?? o.relationships) };
      const nextElements = layoutObject(candidate, style), ids = new Set(nextElements.map((e2) => e2.id));
      const orphan = Object.keys(o.overrides || {}).filter((id) => !ids.has(id));
      if (orphan.length && !command.confirmDiscardOverrides) return { ok: false, conflicts: orphan.map((id) => ({ kind: "override-orphan", elementId: id, message: "结构修改将移除已手工调整的元素；需要明确取舍。" })) };
      for (const id of orphan) delete candidate.overrides[id];
      Object.assign(o, candidate);
      o.nodeIds = (o.data.nodes || []).map((n) => n.nodeId);
    } else if (command.type === "object-geometry") {
      if (!o || !boundsValid(command.bounds)) throw new Error("Invalid object bounds");
      const old = o.bounds, next = command.bounds;
      for (const over of Object.values(o.overrides || {})) if (over.bounds) {
        const b = over.bounds;
        over.bounds = [next[0] + (b[0] - old[0]) * next[2] / old[2], next[1] + (b[1] - old[1]) * next[3] / old[3], b[2] * next[2] / old[2], b[3] * next[3] / old[3]];
      }
      o.bounds = clone(next);
    } else if (command.type === "layer") {
      const targets = [...(s.elements || []).filter((e2) => !e2.parentId), ...s.objects || []];
      const target = o || s.elements.find((e2) => e2.id === command.elementId);
      if (!target) throw new Error("Layer target missing");
      target.layer = command.direction === "front" ? Math.max(0, ...targets.map((t) => t.layer || 0)) + 1 : Math.min(0, ...targets.map((t) => t.layer || 0)) - 1;
    } else {
      if (!e) return { ok: false, conflicts: [{ kind: "missing-element" }] };
      const base = s.elements.find((x) => x.id === e.id);
      const target = base || (o.overrides[e.id] = o.overrides[e.id] || {});
      if (command.type === "text") {
        if (e.contentRef) {
          const old = p.contentPlan.nodes[e.contentRef];
          const id = command.global ? e.contentRef : `edit:${s.slideId}:${e.id}`;
          p.contentPlan.nodes[id] = { ...clone(old || {}), text: String(command.text), kind: "user-edit", sourceRef: old?.sourceRef || e.contentRef };
          target.sourceContentRef = e.sourceContentRef || e.contentRef;
          target.contentRef = id;
        } else if (e.dataPath && o) {
          let node = o.data;
          for (const key of e.dataPath.slice(0, -1)) node = node[key];
          node[e.dataPath.at(-1)] = String(command.text);
        } else target.text = String(command.text);
      } else if (command.type === "image") {
        if (!command.src) throw new Error("Image source required");
        let media = p.media.entries.find((m) => m.src === command.src);
        if (!media) {
          media = { mediaId: "upload/" + revision(), src: command.src, kind: "user-image" };
          p.media.entries.push(media);
        }
        target.sourceMediaRef = e.sourceMediaRef || e.mediaRef;
        target.src = void 0;
        target.mediaRef = media.mediaId;
        if (command.fit) target.fit = command.fit;
        if (command.focal) target.focal = command.focal;
      } else if (command.type === "geometry") {
        if (e.relationshipId) throw new Error("连接线位置由端点决定；请移动节点或整个关系组，避免连接脱离");
        if (!boundsValid(command.bounds)) throw new Error("Invalid element bounds");
        target.bounds = clone(command.bounds);
      } else if (command.type === "style") {
        target.style = { ...target.style || e.style, ...command.style };
        if (base) target.manualStyle = { ...target.manualStyle, ...command.style };
      }
      else throw new Error("Unsupported command " + command.type);
    }
    const result = deriveSlideElements(s, resolveSlideStyle(s));
    if (result.some((e2) => !e2.bounds.every(Number.isFinite))) throw new Error("Invalid derived bounds");
    p.sources.userEdits.push({ slideId: s.slideId, elementId: command.elementId, objectId: o?.objectId, type: command.type });
    const changedNodes = Object.keys({ ...beforeNodes, ...p.contentPlan.nodes }).filter((id) => JSON.stringify(beforeNodes[id]) !== JSON.stringify(p.contentPlan.nodes[id]));
    p.editorState.history.push({ kind: "edit-patch-v1", slideId: s.slideId, before: { slide: beforeSlide, nodes: Object.fromEntries(changedNodes.map((id) => [id, beforeNodes[id] ?? null])), editCount: beforeEdits }, after: { slide: clone(s), nodes: Object.fromEntries(changedNodes.map((id) => [id, p.contentPlan.nodes[id] ?? null])), editCount: p.sources.userEdits.length }, userEdit: clone(p.sources.userEdits.at(-1)) });
    if (p.editorState.history.length > 80) p.editorState.history.shift();
    p.editorState.redo = [];
    p.revision = revision();
    syncCompositionTextState(p);
    return { ok: true, project: p };
  } catch (error) {
    return { ok: false, conflicts: [{ kind: "layout", message: error.message }] };
  }
}
function restorePatch(p, record, direction) {
  const value = record[direction];
  p.slides[p.slides.findIndex((s) => s.slideId === record.slideId)] = clone(value.slide);
  for (const [id, node] of Object.entries(value.nodes)) {
    if (node === null) delete p.contentPlan.nodes[id];
    else p.contentPlan.nodes[id] = clone(node);
  }
  if (direction === "before") p.sources.userEdits.length = value.editCount;
  else {
    p.sources.userEdits.length = record.before.editCount;
    p.sources.userEdits.push(clone(record.userEdit));
  }
  p.revision = revision();
  return syncCompositionTextState(p);
}
function undoProject(project) {
  const p = clone(project), record = p.editorState.history.pop();
  if (!record) return { ok: false, conflicts: [{ kind: "no-history" }] };
  if (record.kind === "edit-patch-v1") {
    p.editorState.redo.push(record);
    return { ok: true, project: restorePatch(p, record, "before") };
  }
  const current = clone(p);
  delete current.editorState.history;
  delete current.editorState.redo;
  record.editorState.history = p.editorState.history;
  record.editorState.redo = [...p.editorState.redo, current];
  record.revision = revision();
  return { ok: true, project: syncCompositionTextState(record) };
}
function redoProject(project) {
  const p = clone(project), record = p.editorState.redo.pop();
  if (!record) return { ok: false, conflicts: [{ kind: "no-redo" }] };
  if (record.kind === "edit-patch-v1") {
    p.editorState.history.push(record);
    return { ok: true, project: restorePatch(p, record, "after") };
  }
  const current = clone(p);
  delete current.editorState.history;
  delete current.editorState.redo;
  record.editorState.history = [...p.editorState.history, current];
  record.editorState.redo = p.editorState.redo;
  record.revision = revision();
  return { ok: true, project: syncCompositionTextState(record) };
}
export {
  applyEditCommand,
  redoProject,
  undoProject
};
