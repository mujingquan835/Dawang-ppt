#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const THEMES = Array.from({ length: 12 }, (_, index) => `theme${String(index + 1).padStart(2, '0')}`);
const THEME_SET = new Set(THEMES);

function usage(message = '') {
  if (message) console.error(message);
  console.error('Usage: node build-theme-style-grid.mjs --themes theme01,theme07,... --out /absolute/path/theme-style-grid.png');
  process.exit(1);
}

function parseArgs(argv) {
  let themes = [];
  let out = '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--themes') {
      themes = String(argv[index + 1] || '').split(',').map((value) => value.trim()).filter(Boolean);
      index += 1;
    } else if (arg === '--out') {
      out = String(argv[index + 1] || '').trim();
      index += 1;
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }

  if (themes.length !== 9) usage('--themes must contain exactly 9 theme IDs.');
  if (new Set(themes).size !== themes.length) usage('--themes must not contain duplicates.');
  const invalid = themes.filter((theme) => !THEME_SET.has(theme));
  if (invalid.length) usage(`Unknown theme IDs: ${invalid.join(', ')}`);
  if (!out) usage('--out is required.');

  return { themes, out: path.resolve(out) };
}

function copyTile(source, target, sourceIndex, targetIndex, tileWidth, tileHeight) {
  const sourceColumn = sourceIndex % 3;
  const sourceRow = Math.floor(sourceIndex / 3);
  const targetColumn = targetIndex % 3;
  const targetRow = Math.floor(targetIndex / 3);
  const sourceX = Math.round((sourceColumn * source.width) / 3);
  const sourceY = Math.round((sourceRow * source.height) / 4);
  const targetX = targetColumn * tileWidth;
  const targetY = targetRow * tileHeight;

  for (let row = 0; row < tileHeight; row += 1) {
    const sourceStart = ((sourceY + row) * source.width + sourceX) * 4;
    const targetStart = ((targetY + row) * target.width + targetX) * 4;
    source.data.copy(target.data, targetStart, sourceStart, sourceStart + tileWidth * 4);
  }
}

const { themes, out } = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourcePath = path.resolve(scriptDir, '../../assets/skill/theme-style-grid.png');
const require = createRequire(import.meta.url);

function loadPng() {
  try {
    return require('pngjs').PNG;
  } catch {
    const npmrc = path.join(projectRoot, '.npmrc');
    const npmrcTemplate = path.join(projectRoot, 'npmrc.template');
    if (!fs.existsSync(npmrc) && fs.existsSync(npmrcTemplate)) {
      fs.copyFileSync(npmrcTemplate, npmrc);
    }

    console.error('Installing the DashiAI PPT runtime dependencies required for the style grid...');
    spawnSync(process.execPath, [path.join(scriptDir, 'ensure-registry.mjs')], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const install = spawnSync(npmCommand, ['install'], { cwd: projectRoot, stdio: 'inherit' });
    if (install.status !== 0) usage('Unable to install the DashiAI PPT runtime dependencies.');

    try {
      return require('pngjs').PNG;
    } catch {
      usage('pngjs is unavailable after npm install.');
    }
  }
}

if (!fs.existsSync(sourcePath)) usage(`Source style grid not found: ${sourcePath}`);

const PNG = loadPng();
const source = PNG.sync.read(fs.readFileSync(sourcePath));
const tileWidth = Math.floor(source.width / 3);
const tileHeight = Math.floor(source.height / 4);
const target = new PNG({ width: tileWidth * 3, height: tileHeight * 3 });

themes.forEach((theme, targetIndex) => {
  copyTile(source, target, THEMES.indexOf(theme), targetIndex, tileWidth, tileHeight);
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(target));
console.log(out);
