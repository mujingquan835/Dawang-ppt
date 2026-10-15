import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { validateProject, clone, revision } from "./schema.mjs";
function loadProject(file) {
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const issues = validateProject(p);
  if (issues.length) throw new Error(issues.join("\n"));
  return p;
}
const hashFile = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
function saveProject(file, project, expectedRevision) {
  const issues = validateProject(project);
  if (issues.length) return { ok: false, issues };
  const existing = fs.existsSync(file) ? loadProject(file) : null;
  if ((existing?.revision || null) !== expectedRevision) return { ok: false, conflicts: [{ kind: "revision", expected: expectedRevision, actual: existing?.revision || null }] };
  const p = clone(project);
  p.revision = revision();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = file + ".lock";
  let fd;
  try {
    fd = fs.openSync(lock, "wx");
  } catch {
    return { ok: false, conflicts: [{ kind: "save-in-progress" }] };
  }
  try {
    const latest = fs.existsSync(file) ? loadProject(file) : null;
    if ((latest?.revision || null) !== expectedRevision) return { ok: false, conflicts: [{ kind: "revision" }] };
    if (existing) {
      const dir = path.join(path.dirname(file), ".revisions");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, existing.revision + ".json"), JSON.stringify(existing));
    }
    const tmp = file + "." + process.pid + ".tmp";
    const out = fs.openSync(tmp, "w");
    try {
      fs.writeFileSync(out, JSON.stringify(p, null, 2) + "\n");
      fs.fsyncSync(out);
    } finally {
      fs.closeSync(out);
    }
    fs.renameSync(tmp, file);
    return { ok: true, project: p, revision: p.revision };
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}
export {
  hashFile,
  loadProject,
  saveProject
};
