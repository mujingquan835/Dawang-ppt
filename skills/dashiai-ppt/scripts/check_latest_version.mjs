#!/usr/bin/env node
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIR, '..');
const INSTALLED_PACKAGE = path.join(SKILL_ROOT, 'project/package.json');
const SOURCE_PACKAGE = path.join(SKILL_ROOT, 'package.json');
// 只检查本公开仓库中的版本，避免把增强版误更新回上游 npm 包。
const REMOTE_VERSION_ENDPOINTS = [
  { url: 'https://raw.githubusercontent.com/mujingquan835/dashiai-ppt-skill/main/skills/dashiai-ppt/project/package.json', pick: (json) => json.version },
];
const REQUEST_TIMEOUT_MS = 5000;

main().catch(() => {});

async function main() {
  const localVersion = readLocalVersion();
  if (!localVersion) return;
  const remoteVersion = await readRemoteVersion();
  if (!remoteVersion) return;
  if (compareVersions(remoteVersion, localVersion) <= 0) return;
  process.stdout.write(
    `发现 DashiAI PPT 新版本 ${remoteVersion}（当前 ${localVersion}）。更新方式：npx skills add https://github.com/mujingquan835/dashiai-ppt-skill --skill dashiai-ppt。\n`
  );
}

function readLocalVersion() {
  const packagePath = fs.existsSync(INSTALLED_PACKAGE) ? INSTALLED_PACKAGE : SOURCE_PACKAGE;
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || '';
  } catch {
    return '';
  }
}

async function readRemoteVersion() {
  for (const endpoint of REMOTE_VERSION_ENDPOINTS) {
    const version = await fetchVersion(endpoint);
    if (version) return version;
  }
  return '';
}

function fetchVersion({ url, pick }) {
  return new Promise(resolve => {
    const request = https.get(url, { timeout: REQUEST_TIMEOUT_MS }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        resolve('');
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(pick(JSON.parse(body)) || '');
        } catch {
          resolve('');
        }
      });
    });
    request.on('timeout', () => {
      request.destroy();
      resolve('');
    });
    request.on('error', () => resolve(''));
  });
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function parseVersion(version) {
  return String(version)
    .replace(/^v/i, '')
    .split(/[.-]/)
    .map(part => Number.parseInt(part, 10))
    .filter(Number.isFinite);
}
