import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

// Turns a .pptx into Markdown plus image files, page by page, so prepare can read it like any other material.
// Text, tables, speaker notes and pictures are kept in slide order; layout is not, because the deck is rebuilt from its content.
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const paragraphs = (xml) => [...xml.matchAll(/<a:p[ >][\s\S]*?<\/a:p>/g)].map((p) => [...p[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => decode(t[1])).join('').trim()).filter(Boolean);
const relsOf = (xml) => Object.fromEntries([...(xml || '').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/\bId="([^"]+)"/.exec(m[0])?.[1], /\bTarget="([^"]+)"/.exec(m[0])?.[1]]));
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;

export async function pptxToMarkdown(file, dir) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file)), read = (name) => zip.file(name)?.async('string');
  const rels = relsOf(await read('ppt/_rels/presentation.xml.rels')), order = [...(await read('ppt/presentation.xml')).matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => rels[m[1]]);
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  const out = [], skipped = new Set();
  let images = 0;
  for (const [index, target] of order.entries()) {
    const name = path.posix.join('ppt', target.replace(/^\/?ppt\//, '')), base = path.posix.basename(name), xml = await read(name), slideRels = relsOf(await read(`ppt/slides/_rels/${base}.rels`)), n = index + 1;
    const tables = [...xml.matchAll(/<a:tbl>[\s\S]*?<\/a:tbl>/g)].map((t) => [...t[0].matchAll(/<a:tr[ >][\s\S]*?<\/a:tr>/g)].map((r) => [...r[0].matchAll(/<a:tc[ >/][\s\S]*?<\/a:tc>/g)].map((c) => paragraphs(c[0]).join(' ').replace(/\|/g, '／'))));
    const lines = paragraphs(xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, ''));
    out.push(`# 第 ${n} 页${/\bshow="0"/.test(xml.slice(0, 600)) ? '（隐藏）' : ''}`, '', ...lines.map((l) => `- ${l}`), '');
    for (const rows of tables) if (rows.length) out.push(`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map((r) => `| ${r.join(' | ')} |`), '');
    const seen = new Set();
    for (const m of xml.matchAll(/<a:blip\b[^>]*r:embed="([^"]+)"/g)) {
      const ref = slideRels[m[1]]; if (!ref || seen.has(ref)) continue; seen.add(ref);
      const entry = zip.file(path.posix.normalize(path.posix.join('ppt/slides', ref)));
      if (!entry) continue;
      if (!IMAGE.test(ref)) { skipped.add(path.posix.basename(ref)); continue; }
      const local = `media/s${String(n).padStart(2, '0')}-${seen.size}${path.posix.extname(ref).toLowerCase()}`;
      fs.writeFileSync(path.join(dir, local), await entry.async('nodebuffer')); images++;
      out.push(`![第 ${n} 页图 ${seen.size}](${local})`, '');
    }
    const notes = Object.values(slideRels).find((t) => /notesSlide/.test(t));
    if (notes) { const noteXml = await read(path.posix.normalize(path.posix.join('ppt/slides', notes))), said = noteXml ? paragraphs(noteXml).filter((l) => !/^\d+$/.test(l)) : []; if (said.length) out.push('备注：', ...said.map((l) => `> ${l}`), ''); }
  }
  const markdown = path.join(dir, `${path.basename(file, path.extname(file))}.md`);
  fs.writeFileSync(markdown, out.join('\n'));
  return { markdown, slides: order.length, images, skippedImages: [...skipped] };
}
