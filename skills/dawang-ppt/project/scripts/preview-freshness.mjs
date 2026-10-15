import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { npmCommand, npmCommandArgs, npmCommandOptions } from './command-paths.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DEFAULT_THEME_PREVIEW_ROOT = path.join(ROOT, 'output/theme-preview/ppt');

const DEFAULT_THEME_PREVIEW_INPUTS = [
  path.join(ROOT, 'assets/template-swiss.html'),
  path.join(ROOT, 'examples/component-decks/all-themes-showcase.jsx'),
  path.join(ROOT, 'src/renderDeck.jsx'),
  path.join(ROOT, 'src/options.jsx'),
  path.join(ROOT, 'src/view-model'),
  path.join(ROOT, 'src/components/themes'),
  path.join(ROOT, 'src/runtime'),
  path.join(ROOT, 'src/runtime-assets.mjs'),
];
const DEFAULT_RENDER_LOCK_FILE = path.join(os.tmpdir(), 'dashiai-ppt-theme-preview-render.lock');

export function isDefaultThemePreviewRoot(serveRoot, defaultThemePreviewRoot = DEFAULT_THEME_PREVIEW_ROOT) {
  return path.resolve(serveRoot) === path.resolve(defaultThemePreviewRoot);
}

export function isThemePreviewFresh({ serveRoot = DEFAULT_THEME_PREVIEW_ROOT, inputPaths = DEFAULT_THEME_PREVIEW_INPUTS } = {}) {
  const indexFile = path.join(path.resolve(serveRoot), 'index.html');
  if (!existsSync(indexFile)) return false;
  return statSync(indexFile).mtimeMs >= latestMtimeMs(inputPaths);
}

export function ensureThemePreviewFresh({
  serveRoot = DEFAULT_THEME_PREVIEW_ROOT,
  inputPaths = DEFAULT_THEME_PREVIEW_INPUTS,
  logger = console,
  renderLockFile = DEFAULT_RENDER_LOCK_FILE,
  defaultThemePreviewRoot = DEFAULT_THEME_PREVIEW_ROOT,
} = {}) {
  const resolvedServeRoot = path.resolve(serveRoot);
  if (!isDefaultThemePreviewRoot(resolvedServeRoot, defaultThemePreviewRoot)) return false;

  const lock = acquireRenderLock(renderLockFile);
  try {
    if (isThemePreviewFresh({ serveRoot: resolvedServeRoot, inputPaths })) return false;
    mkdirSync(resolvedServeRoot, { recursive: true });
    logger.log?.(`[preview] Theme preview is stale; rendering ${path.relative(ROOT, resolvedServeRoot)}.`);
    execFileSync(npmCommand(), npmCommandArgs(['run', 'render:themes']), npmCommandOptions({
      cwd: ROOT,
      stdio: 'inherit',
    }));
    return true;
  } finally {
    lock.release();
  }
}

function acquireRenderLock(renderLockFile) {
  const paths = renderLockPaths(renderLockFile);
  mkdirSync(path.dirname(renderLockFile), { recursive: true });
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (existsSync(renderLockFile)) {
      const current = readLegacyRenderLock(paths);
      if (isStaleRenderLock(current)) {
        tryRemoveStaleLegacyRenderLock(paths);
        continue;
      }
      wait(500);
      continue;
    }

    const lockId = randomUUID();
    try {
      mkdirSync(paths.dir);
      writeFileSync(paths.payloadFile, renderLockPayload(lockId));
      return renderLockHandle(lockId, paths);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const current = readDirectoryRenderLock(paths);
      if (isStaleRenderLock(current)) {
        tryRemoveStaleDirectoryRenderLock(paths);
        continue;
      }
      wait(500);
    }
  }
  throw new Error(`Timed out waiting for theme preview render lock: ${renderLockFile}`);
}

function renderLockPaths(renderLockFile) {
  const dir = `${renderLockFile}.dir`;
  return {
    file: renderLockFile,
    dir,
    payloadFile: path.join(dir, 'lock.json'),
    takeoverDir: `${renderLockFile}.takeover`,
  };
}

function tryRemoveStaleLegacyRenderLock(paths) {
  try {
    mkdirSync(paths.takeoverDir);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    return;
  }

  try {
    if (isStaleRenderLock(readLegacyRenderLock(paths))) rmSync(paths.file, { force: true });
  } finally {
    rmSync(paths.takeoverDir, { recursive: true, force: true });
  }
}

function tryRemoveStaleDirectoryRenderLock(paths) {
  if (!isStaleRenderLock(readDirectoryRenderLock(paths))) return false;
  const staleDir = `${paths.dir}.stale-${process.pid}-${randomUUID()}`;
  try {
    renameSync(paths.dir, staleDir);
    rmSync(staleDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function renderLockPayload(lockId) {
  return `${JSON.stringify({
    lockId,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  })}\n`;
}

function renderLockHandle(lockId, paths) {
  return {
    release() {
      const current = readDirectoryRenderLock(paths);
      if (current?.lockId === lockId) rmSync(paths.dir, { recursive: true, force: true });
    },
  };
}

function readDirectoryRenderLock(paths) {
  try {
    return JSON.parse(readFileSync(paths.payloadFile, 'utf8'));
  } catch {
    try {
      return {
        pending: true,
        startedAt: new Date(statSync(paths.dir).mtimeMs).toISOString(),
      };
    } catch {
      return true;
    }
  }
}

function readLegacyRenderLock(paths) {
  try {
    return JSON.parse(readFileSync(paths.file, 'utf8'));
  } catch {
    return true;
  }
}

function isStaleRenderLock(data) {
  if (data === true) return true;
  if (!data || typeof data !== 'object') return true;
  const startedAt = Date.parse(data.startedAt);
  if (data.pending === true) return Number.isFinite(startedAt) && Date.now() - startedAt > 10 * 60 * 1000;
  if (!isPidAlive(data.pid)) return true;
  return Number.isFinite(startedAt) && Date.now() - startedAt > 10 * 60 * 1000 && !isPidAlive(data.pid);
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function latestMtimeMs(inputPaths) {
  return inputPaths.reduce((latest, inputPath) => Math.max(latest, pathMtimeMs(inputPath)), 0);
}

function pathMtimeMs(inputPath) {
  if (!existsSync(inputPath)) return 0;
  const stats = statSync(inputPath);
  if (!stats.isDirectory()) return stats.mtimeMs;

  let latest = stats.mtimeMs;
  for (const entry of readdirSync(inputPath, { withFileTypes: true })) {
    latest = Math.max(latest, pathMtimeMs(path.join(inputPath, entry.name)));
  }
  return latest;
}
