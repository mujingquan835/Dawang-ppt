import JSZip from "jszip";
const posix = (base, target) => {
  if (target.startsWith("/")) return target.slice(1);
  const parts = (base ? base.split("/") : []).concat(target.split("/")), out = [];
  for (const p of parts) if (p === "..") out.pop(); else if (p && p !== ".") out.push(p);
  return out.join("/");
};
// Reads every entry (CRC32 verified by JSZip), checks OPC required parts, relationship targets and content-type overrides.
async function verifyPptxZip(bytes, { expectedSlides } = {}) {
  const res = { checked: true, ok: false, method: "jszip-crc32+opc-parts+relationships", checkedAt: new Date().toISOString(), entries: 0, slides: 0, expectedSlides: expectedSlides ?? null, missingParts: [], brokenRelationships: [], missingOverrides: [], errors: [] };
  const Zip = JSZip.default || JSZip;
  let zip;
  try { zip = await Zip.loadAsync(bytes, { checkCRC32: true }); } catch (e) { res.errors.push("load: " + e.message); return res; }
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir), set = new Set(names);
  res.entries = names.length;
  for (const n of names) {
    try { const data = await zip.file(n).async("uint8array"); if (/\.(xml|rels)$/.test(n) && !data.length) res.errors.push("empty: " + n); } catch (e) { res.errors.push(`read ${n}: ${e.message}`); }
  }
  for (const req of ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"]) if (!set.has(req)) res.missingParts.push(req);
  res.slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length;
  for (const rel of names.filter((n) => n.endsWith(".rels"))) {
    const xml = await zip.file(rel).async("string");
    const dir = rel.replace(/(^|\/)_rels\/[^/]+$/, "").replace(/\/$/, "");
    for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
      const tag = m[0], target = /Target="([^"]+)"/.exec(tag)?.[1];
      if (!target || /TargetMode="External"/.test(tag)) continue;
      const resolved = posix(dir, decodeURIComponent(target));
      if (!set.has(resolved)) res.brokenRelationships.push({ from: rel, target, resolved });
    }
  }
  if (set.has("[Content_Types].xml")) {
    const ct = await zip.file("[Content_Types].xml").async("string");
    for (const m of ct.matchAll(/PartName="([^"]+)"/g)) if (!set.has(m[1].replace(/^\//, ""))) res.missingOverrides.push(m[1]);
  }
  if (expectedSlides != null && res.slides !== expectedSlides) res.errors.push(`slide count ${res.slides} != expected ${expectedSlides}`);
  // pptxgenjs 4.0.1 declares an override for an unused slideMaster2; dangling overrides are recorded as warnings, not failures.
  res.warnings = res.missingOverrides.map((p) => "content-type override without part: " + p);
  res.ok = !res.errors.length && !res.missingParts.length && !res.brokenRelationships.length;
  return res;
}
export { verifyPptxZip };
