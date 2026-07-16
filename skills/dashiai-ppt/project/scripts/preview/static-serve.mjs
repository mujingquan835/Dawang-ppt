// 静态文件解析/边界检查/MIME 判定。从 scripts/serve-preview-https.mjs 拆出,逻辑逐字节保留。
import { contentType } from './mime.mjs';
export { contentType };
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export function createFileResolver({ lexicalServeRoot, realServeRoot }) {
  return function resolveFile(file) {
    const resolved = path.resolve(file);
    if (!isPathInside(lexicalServeRoot, resolved) && !isPathInside(realServeRoot, resolved)) return null;
    try {
      const real = realpathSync(resolved);
      if (!isPathInside(realServeRoot, real)) return null;
      const stat = statSync(real);
      if (stat.isDirectory()) return resolveFile(path.join(real, 'index.html'));
      if (stat.isFile()) return real;
    } catch {}
    return null;
  };
}

export function hasBlockedDotSegment(pathname, internalPreviewFiles) {
  return String(pathname || '')
    .split(/[\\/]+/)
    .filter(Boolean)
    .some(segment => segment.startsWith('.') || internalPreviewFiles.has(segment.toLowerCase()));
}

export function isPathInside(root, file) {
  const relative = path.relative(root, file);
  return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

