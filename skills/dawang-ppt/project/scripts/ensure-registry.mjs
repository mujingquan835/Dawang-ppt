// 首装前的 npm registry 探测选源(安装版 skill 的 project/scripts/ 随包分发):
// 官方源可达 → 移除项目级 registry 锁定,走 npm 默认(尊重外网用户与其全局镜像配置);
// 官方源不可达且 npmmirror 可达 → 锁定 npmmirror(国内环境)。
// 结果持久化进 project/.npmrc 并打标,只探测一次;缺省 .npmrc 已是 npmmirror,
// 本脚本没跑到/没跑成时任何网络仍保底可装。约定:绝不抛错阻塞安装。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPMRC = path.join(PROJECT_ROOT, '.npmrc');
const OFFICIAL = 'https://registry.npmjs.org';
const MIRROR = 'https://registry.npmmirror.com';
const PROBED_MARK = '# dashi-registry-probed';

async function reachable(base, timeoutMs = 3000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${base}/-/ping`, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    // 必须 2xx 才算可达:403/5xx(企业代理拦截页、镜像故障)下 npm install
    // 实际会失败,不能据此选源。
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const content = existsSync(NPMRC) ? readFileSync(NPMRC, 'utf8') : '';
  if (content.includes(PROBED_MARK)) return;
  const kept = content
    .split('\n')
    .filter((line) => line.trim() && !line.trim().startsWith('registry=') && !line.includes(PROBED_MARK));

  if (await reachable(OFFICIAL)) {
    // 官方可达:去掉项目级 registry 锁定(npm 走默认或用户全局配置)。
  } else if (await reachable(MIRROR)) {
    kept.push(`registry=${MIRROR}`);
  } else {
    // 两个源都探不到:保持现状不打标(下次安装再探),失败信息交给 npm 呈现。
    return;
  }
  kept.push(PROBED_MARK);
  writeFileSync(NPMRC, `${kept.join('\n')}\n`);
}

await main().catch(() => {});
