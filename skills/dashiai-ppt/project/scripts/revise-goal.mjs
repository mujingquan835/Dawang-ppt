#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateGoalSpec } from './validate-goal-spec.mjs';

// npm --prefix 会把脚本 cwd 切到内置 project；INIT_CWD 才是用户发起命令的目录。
// 这样 --goal output/foo/goal.json 等相对路径仍按当前任务工作区解析。
const CALLER_CWD = process.env.INIT_CWD || process.cwd();

function usage(message = '') {
  if (message) console.error(message);
  console.error('Usage: node revise-goal.mjs --goal <goal.json> --patch <patch.json> [--allow-structure] [--dry-run]');
  process.exit(1);
}

function parseArgs(argv) {
  const args = { goal: '', patch: '', allowStructure: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--goal' || arg === '--patch') {
      const value = String(argv[index + 1] || '').trim();
      if (!value) usage(`${arg} requires a value.`);
      args[arg.slice(2)] = path.resolve(CALLER_CWD, value);
      index += 1;
    } else if (arg === '--allow-structure') {
      args.allowStructure = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else {
      usage(`Unknown argument: ${arg}`);
    }
  }
  if (!args.goal) usage('--goal is required.');
  if (!args.patch) usage('--patch is required.');
  return args;
}

function readJson(file, label) {
  if (!fs.existsSync(file)) usage(`${label} does not exist: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    usage(`${label} is not valid JSON: ${error.message}`);
  }
}

function decodePointer(pointer) {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) usage(`JSON Pointer must start with "/": ${pointer}`);
  const tokens = pointer.slice(1).split('/').map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (tokens.some((token) => ['__proto__', 'prototype', 'constructor'].includes(token))) {
    usage(`Unsafe JSON Pointer token in: ${pointer}`);
  }
  return tokens;
}

function isProtectedStructure(tokens) {
  if (!tokens.length) return true;
  if (['themePack', 'pageCount'].includes(tokens[0])) return true;
  if (tokens[0] !== 'slides') return false;
  if (tokens.length <= 2) return true;
  return ['layout', 'role'].includes(tokens[2]);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function resolveParent(document, tokens, pointer) {
  if (!tokens.length) usage('Replacing the whole goal document is not allowed.');
  let current = document;
  for (const token of tokens.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) usage(`Array index not found in ${pointer}: ${token}`);
      current = current[index];
    } else if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, token)) {
      current = current[token];
    } else {
      usage(`Path not found: ${pointer}`);
    }
  }
  if (!current || typeof current !== 'object') usage(`Path parent is not an object or array: ${pointer}`);
  return { parent: current, key: tokens.at(-1) };
}

function applyChange(document, change, allowStructure) {
  if (!change || typeof change !== 'object' || Array.isArray(change)) usage('Each patch change must be an object.');
  const op = String(change.op || '').trim();
  const pointer = String(change.path || '').trim();
  if (!['add', 'replace', 'remove'].includes(op)) usage(`Unsupported patch operation: ${op || '(empty)'}`);
  const tokens = decodePointer(pointer);
  if (!allowStructure && isProtectedStructure(tokens)) {
    usage(`Structural path is locked in revision mode: ${pointer}. Use --allow-structure only after explicit user approval.`);
  }
  const { parent, key } = resolveParent(document, tokens, pointer);
  let before;

  if (Array.isArray(parent)) {
    if (op === 'add') {
      const index = key === '-' ? parent.length : Number(key);
      if (!Number.isInteger(index) || index < 0 || index > parent.length) usage(`Invalid array add index in ${pointer}: ${key}`);
      parent.splice(index, 0, clone(change.value));
      return { op, path: pointer, before: undefined, after: clone(change.value) };
    }
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= parent.length) usage(`Array index not found in ${pointer}: ${key}`);
    before = clone(parent[index]);
    if (op === 'replace') parent[index] = clone(change.value);
    else parent.splice(index, 1);
  } else {
    const exists = Object.prototype.hasOwnProperty.call(parent, key);
    if (op !== 'add' && !exists) usage(`Path not found for ${op}: ${pointer}`);
    before = exists ? clone(parent[key]) : undefined;
    if (op === 'remove') delete parent[key];
    else parent[key] = clone(change.value);
  }

  return {
    op,
    path: pointer,
    before,
    after: op === 'remove' ? undefined : clone(change.value),
  };
}

function hashJson(value) {
  return crypto.createHash('sha256').update(`${JSON.stringify(value)}\n`).digest('hex');
}

function validateRevisionInvariants(goal) {
  const errors = [];
  const themePack = String(goal?.themePack || '').trim();
  if (!themePack || !Array.isArray(goal?.slides)) return errors;
  goal.slides.forEach((slide, index) => {
    const layout = String(slide?.layout || '').trim();
    if (layout && !layout.startsWith(`${themePack}_`)) {
      errors.push(`slides[${index}].layout (${layout}) does not belong to themePack ${themePack}`);
    }
  });
  return errors;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

const args = parseArgs(process.argv.slice(2));
const original = readJson(args.goal, 'Goal file');
const patchDocument = readJson(args.patch, 'Patch file');
const changes = Array.isArray(patchDocument) ? patchDocument : patchDocument.changes;
const note = Array.isArray(patchDocument) ? '' : String(patchDocument.note || '').trim();

if (!Array.isArray(changes) || !changes.length) usage('Patch file must contain a non-empty changes array.');

const revised = clone(original);
const applied = changes.map((change) => applyChange(revised, change, args.allowStructure));
const validationErrors = [
  ...validateGoalSpec(revised),
  ...validateRevisionInvariants(revised),
];
if (validationErrors.length) {
  usage(`Revised goal failed validation:\n- ${validationErrors.join('\n- ')}`);
}
const originalHash = hashJson(original);
const revisedHash = hashJson(revised);
if (originalHash === revisedHash) usage('Patch produced no changes.');

const stamp = timestamp();
const revisionDir = path.join(path.dirname(args.goal), 'revisions');
const snapshotPath = path.join(revisionDir, `goal.before.${stamp}.json`);
const reportPath = path.join(revisionDir, `revision.${stamp}.json`);
const report = {
  createdAt: new Date().toISOString(),
  goal: args.goal,
  note,
  dryRun: args.dryRun,
  structuralChangesAllowed: args.allowStructure,
  originalSha256: originalHash,
  revisedSha256: revisedHash,
  changedPaths: applied.map((item) => item.path),
  changes: applied,
};

if (!args.dryRun) {
  fs.mkdirSync(revisionDir, { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(original, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const tempGoal = `${args.goal}.tmp-${process.pid}`;
  fs.writeFileSync(tempGoal, `${JSON.stringify(revised, null, 2)}\n`);
  fs.renameSync(tempGoal, args.goal);
}

console.log(JSON.stringify({
  goal: args.goal,
  dryRun: args.dryRun,
  snapshot: args.dryRun ? null : snapshotPath,
  report: args.dryRun ? null : reportPath,
  changedPaths: report.changedPaths,
  structuralChangesAllowed: args.allowStructure,
}, null, 2));
