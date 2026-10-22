import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {hashFile} from "../project/store.mjs";
export function stageMedia(project, sourceDir, targetDir) {
  const media = [];
  const transform = (value, key = "") => {
    if (Array.isArray(value)) return value.map((v) => transform(v, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, transform(v, k)]));
    if (typeof value === "string" && value.trim() && /^(src|image|images|imageSrc|imageUrl|heroImage|coverImage)$/.test(key) && !value.startsWith("data:") && !/^https?:/.test(value)) {
      const candidates = value.startsWith("file:") ? [fileURLToPath(value)] : [path.resolve(sourceDir, value), path.resolve(sourceDir, "ppt", value)];
      const found = candidates.filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
      if (found.length > 1 && new Set(found.map(hashFile)).size > 1) throw new Error("Ambiguous local image: " + value);
      const file = found[0] || candidates[0];
      const existing = path.resolve(targetDir, value);
      if (!fs.existsSync(file)) {
        if (fs.existsSync(existing)) return value;
        throw new Error("Required local image not found: " + value);
      }
      const hash = hashFile(file), name = hash.slice(0, 20) + path.extname(file), rel = "assets/user-media/" + name;
      fs.mkdirSync(path.join(targetDir, "assets/user-media"), { recursive: true });
      if (path.resolve(file) !== path.resolve(targetDir, rel)) fs.copyFileSync(file, path.join(targetDir, rel));
      media.push({ mediaId: hash, sha256: hash, source: file, src: rel });
      return rel;
    }
    return value;
  };
  const p = transform(project);
  p.media.entries = [...p.media.entries, ...media.filter((m) => !p.media.entries.some((e) => e.mediaId === m.mediaId))];
  return p;
}
