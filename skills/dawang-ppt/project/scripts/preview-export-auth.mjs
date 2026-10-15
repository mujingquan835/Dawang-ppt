// 预览/导出服务器的导出请求鉴权(无副作用,便于单测)。
export function isLoopbackHost(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

// 导出端点会启动 headless Chromium 并写文件,需防跨站/局域网滥用:
// - 带 Origin:必须在允许列表(同源/显式允许的回环与 LAN 地址)。
// - 无 Origin 但带 Referer(浏览器顶层导航式下载,如下载 PDF/PPTX 触发的
//   `location.assign()` 不带 Origin 头):Referer 的 origin 必须在允许列表。
// - 都没有(curl/脚本):仅当服务器绑定在回环时放行;绑 LAN 时拒绝。
export function isExportRequestAllowed({ origin, referer, host, allowedOrigins }) {
  if (origin) return allowedOrigins.has(origin);
  const refererOrigin = safeOrigin(referer);
  if (refererOrigin) return allowedOrigins.has(refererOrigin);
  return isLoopbackHost(host);
}

function safeOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
