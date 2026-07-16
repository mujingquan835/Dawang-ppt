#!/usr/bin/env node
// Headless PPTX/PDF export for a rendered deck — no manually-started preview
// server, no browser session, no export-endpoint auth to fight with.
//
// The browser-facing export flow (preview UI -> POST /api/export-editable-pptx)
// requires a same-origin Origin/Referer header (see preview-export-auth.mjs),
// which a bare `curl`/script call can't produce. This CLI sidesteps that by
// driving the same export engine (packages/html-deck-to-pptx) directly:
// it spins up scripts/serve-preview-https.mjs on a random loopback port purely
// to serve the deck's static files, exports, then tears the server down.
//
// Usage:
//   node scripts/export-pptx.mjs <deck-ppt-dir> [out-file.pptx] [--pdf] [--title <text>]
//   npm run export:pptx -- <deck-ppt-dir> [out-file.pptx]
//   npm run export:pdf  -- <deck-ppt-dir> [out-file.pdf]
//
// <deck-ppt-dir> is the directory that contains the rendered deck's index.html
// (e.g. output/<deck>/ppt). Relative paths resolve against the caller's cwd.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { launchExportBrowser } from './preview/launch-export-browser.mjs';
import { exportEditablePptxFromUrl } from '../packages/html-deck-to-pptx/src/editable.mjs';
import { exportScreenshotPdfFromUrl } from '../packages/html-deck-to-pptx/src/screenshot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
// 相对路径按调用方目录解析:npm run(含 --prefix)会把脚本 cwd 切到项目根,INIT_CWD 才是用户所在目录。
const CALLER_CWD = process.env.INIT_CWD || process.cwd();
const SERVER_READY_TIMEOUT_MS = 20000;

main().catch(error => {
  console.error(`Export failed: ${error?.message || error}`);
  process.exit(1);
});

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(argv.includes('--help') || argv.includes('-h') ? 0 : 2);
  }

  const pdfMode = argv.includes('--pdf');
  const titleIndex = argv.indexOf('--title');
  const title = titleIndex >= 0 ? argv[titleIndex + 1] : (pdfMode ? 'Deck PDF Export' : 'Editable Deck Export');
  const positional = argv.filter((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--title');

  const [deckDirArg, outFileArg] = positional;
  if (!deckDirArg) {
    printUsage();
    process.exit(2);
  }

  const deckDir = path.resolve(CALLER_CWD, deckDirArg);
  const indexHtml = path.join(deckDir, 'index.html');
  if (!existsSync(indexHtml)) {
    console.error(`Deck index.html not found: ${indexHtml}`);
    console.error('Pass the deck\'s rendered ppt/ directory (the one containing index.html), e.g. output/<deck-name>/ppt');
    process.exit(1);
  }

  const ext = pdfMode ? '.pdf' : '.pptx';
  const outFile = path.resolve(CALLER_CWD, outFileArg || defaultOutFile(deckDir, ext));
  mkdirSync(path.dirname(outFile), { recursive: true });

  const port = await getFreePort();
  const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve-preview-https.mjs'), deckDir, String(port)], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let browser = null;
  try {
    await waitForServerReady(server);
    browser = await launchExportBrowser(chromium, {
      fallbackTmpDirs: [path.join(path.dirname(outFile), '.browser-tmp')],
      log: message => console.warn(message),
    });
    const url = `http://127.0.0.1:${port}/`;
    if (pdfMode) {
      const result = await exportScreenshotPdfFromUrl(browser, url, { outFile, title });
      console.log(`PDF exported: ${path.relative(CALLER_CWD, outFile)} (${result.pages} page(s))`);
    } else {
      const result = await exportEditablePptxFromUrl(browser, url, { outFile, title });
      console.log(`PPTX exported: ${path.relative(CALLER_CWD, outFile)} (${result.slideCount} slide(s), ${result.textObjects} editable text object(s))`);
      if (result.warnings?.length) {
        console.log(`${result.warnings.length} export warning(s); see report for detail if one was requested.`);
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }
}

function defaultOutFile(deckDir, ext) {
  const deckName = path.basename(path.dirname(deckDir)) || path.basename(deckDir) || 'presentation';
  return path.join(deckDir, `${deckName}${ext}`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stderrBuf = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Preview server did not become ready within ${SERVER_READY_TIMEOUT_MS}ms.\n${stderrBuf}`));
    }, SERVER_READY_TIMEOUT_MS);

    const onStdout = chunk => {
      if (settled) return;
      if (/HTTP\/HTTPS preview serving/.test(chunk.toString())) {
        settled = true;
        cleanup();
        resolve();
      }
    };
    const onStderr = chunk => { stderrBuf += chunk.toString(); };
    const onExit = code => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Preview server exited before it became ready (code ${code}).\n${stderrBuf}`));
    };
    const onError = error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    function cleanup() {
      clearTimeout(timer);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
      child.off('error', onError);
    }

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.on('exit', onExit);
    child.on('error', onError);
  });
}

function printUsage() {
  console.error('Usage:');
  console.error('  node scripts/export-pptx.mjs <deck-ppt-dir> [out-file.pptx] [--pdf] [--title <text>]');
  console.error('  npm run export:pptx -- <deck-ppt-dir> [out-file.pptx]');
  console.error('  npm run export:pdf  -- <deck-ppt-dir> [out-file.pdf]');
}
