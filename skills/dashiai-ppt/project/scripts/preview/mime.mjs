// MIME 表单一实现:此前 6 个文件各持一份且已漂移(预览服务的副本缺 .mp4/.gif,
// 而自动保存会把视频落盘成 assets/user-media/*.mp4 —— 服务端回 octet-stream
// 会让严格环境下的 <video> 拒播)。新增媒体类型只改这里。
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.mjs': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain;charset=utf-8',
  '.pdf': 'application/pdf',
};

export function contentType(file) {
  return MIME_TYPES[path.extname(String(file)).toLowerCase()] || 'application/octet-stream';
}
