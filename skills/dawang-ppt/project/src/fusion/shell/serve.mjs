// Small helpers for the local preview server: content types, safe file resolution and moving pasted data-URL media
// out of a saved project into files.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TYPES = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.mjs': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8', '.txt': 'text/plain;charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.pdf': 'application/pdf', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
export const contentType = (file) => TYPES[path.extname(String(file)).toLowerCase()] || 'application/octet-stream';

const inside = (root, file) => { const rel = path.relative(root, file); return !rel || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

// The file a URL path names inside root, or null. Symlinks may not lead outside root; dot segments are refused.
export function resolveInside(root, urlPath) {
  const parts = decodeURIComponent(String(urlPath || '/')).split(/[\\/]+/).filter(Boolean);
  if (parts.some((p) => p.startsWith('.'))) return null;
  const realRoot = fs.realpathSync(root);
  let file = path.resolve(root, ...parts);
  try {
    file = fs.realpathSync(file);
    if (!inside(realRoot, file)) return null;
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    return fs.statSync(file).isFile() ? file : null;
  } catch { return null; }
}

const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };
// Images pasted in the editor arrive as data URLs. Each distinct one is written once to assets/user-media/<hash>
// and every string that held it is replaced by the file path.
export function extractDataUrlMedia(value, deckDir) {
  const mediaMap = {}, written = [];
  const swap = (raw) => {
    if (mediaMap[raw]) return mediaMap[raw];
    const m = /^data:([\w/+.-]+);base64,(.*)$/s.exec(raw);
    if (!m || !EXT[m[1]]) return raw;
    const bytes = Buffer.from(m[2], 'base64'), name = createHash('sha256').update(bytes).digest('hex').slice(0, 24) + EXT[m[1]];
    const target = path.join(deckDir, 'assets/user-media', name);
    if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); written.push(name); }
    return (mediaMap[raw] = 'assets/user-media/' + name);
  };
  const walk = (v) => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : typeof v === 'string' && v.startsWith('data:') ? swap(v) : v;
  return { state: walk(value), written, mediaMap };
}
