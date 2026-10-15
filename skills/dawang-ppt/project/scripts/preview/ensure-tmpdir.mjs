// tmpdir 保险丝:沙箱型 Agent App(如豆包)带来的两类临时目录故障,都在这里兜住。
//
// 事故一(0.1.25):宿主在自己的沙箱里启动常驻预览服务,进程继承了指向宿主沙箱临时
// 目录的 TMPDIR;宿主会话结束后该目录被清理而服务还活着——之后导出时 Playwright
// launch 内部的 mkdtemp 直接 ENOENT。处理:检测到 os.tmpdir() 不存在就摘掉
// TMPDIR/TMP/TEMP,回退系统默认位置。
//
// 事故二(0.1.27):宿主的 macOS seatbelt 沙箱会被 daemonize 的服务进程继承。进程
// 没有 TMPDIR 时,Chrome 内部的 NSTemporaryDirectory() 走 confstr 的
// /var/folders/.../T/ 路径去建 ProcessSingleton 的 socket 目录——该位置被沙箱拒绝,
// Chrome 报 "Failed to create socket directory / Failed to create a ProcessSingleton"
// 后主动退出(exitCode=21),而同一沙箱对 /tmp 或 deck 输出目录是放行的。处理:导出
// 前实测探活一个真正可写的临时目录(候选:当前 os.tmpdir() → 显式 /tmp → 调用方给的
// 兜底目录,如导出目录),并把它显式设置为浏览器子进程的 TMPDIR,让 Chrome 的内部
// 临时路径一并改道到可写位置。
//
// 不重建宿主的沙箱目录——那随时会再被清理。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function ensureUsableTmpdir(log = () => {}) {
  const current = os.tmpdir();
  if (fs.existsSync(current)) return current;
  for (const key of ['TMPDIR', 'TMP', 'TEMP']) delete process.env[key];
  const fallback = os.tmpdir();
  try {
    fs.mkdirSync(fallback, { recursive: true });
  } catch {
    // 系统默认临时目录建不出来的话,后续消费方会用原始错误暴露问题,这里不吞。
  }
  log(`[tmpdir] ${current} 不存在(宿主沙箱已清理),已回退到 ${fallback}`);
  return fallback;
}

// 实测目录可写:真实 mkdtemp 一次再删掉。仅 existsSync 不够——沙箱下目录"存在但不可写"
// 与"可写"无法从元数据区分。
function probeWritable(dir) {
  try {
    const probe = fs.mkdtempSync(path.join(dir, '.tmp-probe-'));
    fs.rmSync(probe, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

// 返回一个实测可写的临时目录,供浏览器子进程用作 TMPDIR。extraFallbacks 里传服务
// 自身必然可写的位置(比如导出目录),作为沙箱连 /tmp 都拒绝时的最后兜底。
export function resolveBrowserTmpdir(extraFallbacks = [], log = () => {}) {
  ensureUsableTmpdir(log);
  const candidates = [os.tmpdir(), '/tmp', ...extraFallbacks];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      fs.mkdirSync(candidate, { recursive: true });
    } catch {
      continue;
    }
    if (probeWritable(candidate)) {
      if (candidate !== candidates[0]) {
        log(`[tmpdir] ${candidates[0]} 不可写(宿主沙箱限制),临时目录改用 ${candidate}`);
        // 同时修正本进程的 TMPDIR:Playwright 在 node 侧也会 mkdtemp(playwright-artifacts),
        // 只给浏览器子进程改道不够,宿主进程自己的 os.tmpdir() 消费方也必须落到可写位置。
        process.env.TMPDIR = candidate;
        delete process.env.TMP;
        delete process.env.TEMP;
      }
      return candidate;
    }
  }
  // 全部不可写:返回默认位置,让浏览器用原始错误暴露问题。
  return os.tmpdir();
}
