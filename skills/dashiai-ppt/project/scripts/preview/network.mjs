// 预览服务器的主机名/局域网 IP 探测。从 scripts/serve-preview-https.mjs 拆出,逻辑逐字节保留。
import { execFileSync } from 'node:child_process';
import os from 'node:os';

export function getLocalHostname() {
  if (process.env.DASHI_PPT_PREVIEW_NAME) return process.env.DASHI_PPT_PREVIEW_NAME;
  try {
    return execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8' }).trim() || os.hostname().split('.')[0];
  } catch {
    return os.hostname().split('.')[0] || 'localhost';
  }
}

export function getLanIps() {
  const ips = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) ips.push(entry.address);
    }
  }
  return [...new Set(ips)];
}
