// URL -> 相对路径 的无副作用 helper(供预览服务器用)。
// 单独成模块以便单测,且不触发服务器监听。
export function safePathname(url) {
  let parsed;
  try {
    parsed = new URL(url, 'https://local.invalid');
  } catch {
    return null;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(parsed.pathname);
  } catch {
    // 畸形百分号编码(如 /%、/%zz):返回 null 让调用方回 400,而非抛错崩溃进程。
    return null;
  }
  return decoded.split('/').filter((part) => part && part !== '..').join('/');
}
