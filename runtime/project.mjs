import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { compile } from "./compiler.mjs";
export const files = {
  contentPlan: "content-plan.json",
  sources: "sources.json",
  media: "media.json",
  designBrief: "design-brief.json",
  editState: "edit-state.json",
};
export const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export function load(dir) {
  const result = {};
  for (const [key, file] of Object.entries(files)) {
    const p = path.join(dir, file);
    result[key] = fs.existsSync(p)
      ? JSON.parse(fs.readFileSync(p, "utf8"))
      : key === "editState"
        ? { overrides: {} }
        : null;
  }
  return result;
}
export function save(dir, project) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [key, file] of Object.entries(files)) {
    const tmp = path.join(dir, `${file}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(project[key], null, 2) + "\n");
    fs.renameSync(tmp, path.join(dir, file));
  }
}
export function applyEdits(project, patch) {
  const next = structuredClone(project);
  const nodes = new Map(next.sources.nodes.map((n) => [n.id, n]));
  for (const [id, value] of Object.entries(patch.texts || {})) {
    const n = nodes.get(id);
    if (!n || n.kind !== "text" || typeof value !== "string")
      throw new Error(`Cannot edit text: ${id}`);
    n.text = value;
  }
  for (const [id, value] of Object.entries(patch.media || {})) {
    const m = next.media.items.find((m) => m.id === id);
    if (!m || typeof value !== "string")
      throw new Error(`Cannot edit media: ${id}`);
    m.src = value;
  }
  next.editState.overrides = {
    ...next.editState.overrides,
    ...patch.overrides,
  };
  compile(next);
  return next;
}
export function checkMedia(dir, project) {
  for (const m of project.media.items) {
    const full = path.resolve(dir, m.src);
    const real = fs.realpathSync(full);
    if (!real.startsWith(fs.realpathSync(dir) + path.sep))
      throw new Error(`Media escapes project: ${m.id}`);
    if (!fs.statSync(real).isFile())
      throw new Error(`Media is not a file: ${m.id}`);
  }
}
