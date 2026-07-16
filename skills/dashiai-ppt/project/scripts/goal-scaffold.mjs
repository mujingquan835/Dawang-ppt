#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {

  compactJson,
  isCoverCandidate,
  isCoverLikeLayout,
  inspectLayout,
  listLayouts,
  parseArgs,
} from './skill-workflow-utils.mjs';
import { hashSeed } from './workflow/layout-query.mjs';
import { validateGoalSpec } from './validate-goal-spec.mjs';

// 相对路径按调用方目录解析:npm run(含 --prefix)会把脚本 cwd 切到项目根,INIT_CWD 才是用户所在目录。
const CALLER_CWD = process.env.INIT_CWD || process.cwd();

const DEFAULT_BODY_ROLES = [
  'statement',
  'breakdown',
  'context',
  'metrics',
  'comparison',
  'distribution',
  'relationship',
  'case',
  'image',
  'trend',
  'process',
  'risks',
  'actions',
  'result',
];

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printUsage();
  process.exit(0);
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function run() {
  const title = String(args.title || '').trim() || 'PPT';
  const goal = String(args.goal || '').trim() || title;
  const themePack = String(args.theme || args.themePack || '').trim();
  const pageCount = Math.max(1, Math.min(50, Number(args.pages || args.pageCount || args['page-count']) || 0));
  const chunkSize = Number(args.chunkSize || args['chunk-size']) || 0;
  const out = String(args.out || '').trim();
  const mediaIntent = parseMediaIntent(args);

  if (!themePack) throw new Error('Missing --theme <themePack>');
  if (!pageCount) throw new Error('Missing --pages <n>');
  if (!out) throw new Error('Missing --out <goal.json>');

  const roles = parseRoles(args.roles);
  // 选页 seed:同分候选随机打散,让不同用户/不同次 scaffold 的骨架不再成片雷同;
  // --seed 显式传入时可复现同一份骨架。
  const seed = args.seed !== undefined && args.seed !== true ? String(args.seed) : String(Math.floor(Math.random() * 0xffffffff));
  const slides = buildSlides({ themePack, pageCount, roles, mediaIntent, seed });
  const spec = {
    title,
    goal,
    themePack,
    pageCount,
    slides,
  };
  const errors = validateGoalSpec(spec, { allowUnfilledMediaIntent: true });
  if (errors.length) throw new Error(`Scaffold failed goal spec validation:\n- ${errors.join('\n- ')}`);

  writeJson(out, spec);
  const fillPlanOut = writeFillPlan(out, spec);
  writeChunks(out, spec, chunkSize);
  process.stdout.write(compactJson({
    out: path.resolve(CALLER_CWD, out),
    fillPlanOut,
    themePack,
    pageCount,
    slideCount: slides.length,
    chunkSize: chunkSize || null,
  }));
}

function buildSlides({ themePack, pageCount, roles, mediaIntent, seed = null }) {
  const used = new Set();
  let mediaAssigned = false;
  const slides = Array.from({ length: pageCount }, (_, index) => {
    const role = index === 0
      ? 'cover'
      : index === pageCount - 1 && pageCount > 2
        ? 'closing'
        : roles[(index - 1) % roles.length];
    const useMediaIntent = Boolean(mediaIntent && !mediaAssigned && index > 0);
    const layout = pickLayout({
      themePack,
      role: useMediaIntent ? 'image' : role,
      used,
      body: index > 0,
      mediaIntent: useMediaIntent ? mediaIntent : null,
      seed,
    });
    used.add(layout);
    const slide = { layout, props: {} };
    if (useMediaIntent) {
      slide[mediaIntent.field] = mediaIntent.value;
      mediaAssigned = true;
    }
    return slide;
  });
  if (mediaIntent && !mediaAssigned) {
    throw new Error(`No body slide available for ${mediaIntent.field}; use --pages 2 or more`);
  }
  return slides;
}

function pickLayout({ themePack, role, used, body, mediaIntent = null, seed = null }) {
  const mediaQuery = mediaIntent ? mediaIntentQuery(mediaIntent) : {};
  const roleCandidates = listLayouts({ theme: themePack, role, ...mediaQuery, limit: 80, seed });
  const fallbackCandidates = listLayouts({ theme: themePack, ...mediaQuery, limit: 200, seed });
  const seen = new Set();
  const candidates = [...roleCandidates, ...fallbackCandidates]
    .map(item => item.layout)
    .filter(Boolean)
    .filter(layout => {
      if (seen.has(layout)) return false;
      seen.add(layout);
      return true;
    })
    .filter(layout => !used.has(layout))
    .filter(layout => !body || (!isCoverCandidate(layout) && !isCoverLikeLayout(layout)));
  if (!candidates.length) throw new Error(`No unused ${body ? 'body' : 'cover'} layout available for role "${role}" in ${themePack}`);
  // 从前 5 名合格候选里 seeded 随机挑:打分只有一两个精确命中时,永远取第一会让
  // 不同用户的骨架在这些 role 上完全一致;候选都已通过过滤(均"符合"),前几名之间
  // 的分差只是相关性排序,随机采样是多样性与相关性的折衷。
  const pool = candidates.slice(0, 5);
  const layout = pool[hashSeed(`${seed}:${role}:${used.size}`) % pool.length];
  return layout;
}

function parseMediaIntent(args) {
  const plannedImages = mediaIntentCount(args['planned-images'] ?? args.plannedImages);
  if (plannedImages) return { field: 'plannedImages', value: plannedImages, count: plannedImages };
  if (args['image-gen'] === true || args.imageGen === true) return { field: 'imageGen', value: true, count: 1 };
  if (args['needs-visual'] === true || args.needsVisual === true) return { field: 'needsVisual', value: true, count: 1 };
  return null;
}

function mediaIntentQuery(intent) {
  if (!intent) return {};
  if (intent.field === 'plannedImages') return { plannedImages: intent.count, mediaCount: intent.count };
  if (intent.field === 'imageGen') return { imageGen: true, mediaCount: intent.count };
  if (intent.field === 'needsVisual') return { needsVisual: true, mediaCount: intent.count };
  return {};
}

function mediaIntentCount(value) {
  if (value === true) return 1;
  const count = Number(value);
  if (Number.isFinite(count) && count > 0) return Math.round(count);
  return 0;
}

function parseRoles(value) {
  const roles = String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(role => role !== 'cover');
  return roles.length ? roles : DEFAULT_BODY_ROLES;
}

function writeChunks(out, spec, chunkSize) {
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) return;
  const size = Math.max(1, Math.round(chunkSize));
  const total = Math.ceil(spec.slides.length / size);
  const parsed = path.parse(out);
  for (let index = 0; index < total; index += 1) {
    const start = index * size;
    const end = Math.min(spec.slides.length, start + size);
    const chunkPath = path.join(parsed.dir, `${parsed.name}.part-${String(index + 1).padStart(2, '0')}.json`);
    const chunkSpec = {
      title: spec.title,
      goal: spec.goal,
      themePack: spec.themePack,
      pageCount: spec.pageCount,
      part: {
        index: index + 1,
        total,
        startSlide: start + 1,
        endSlide: end,
      },
      slides: spec.slides.slice(start, end),
    };
    writeJson(chunkPath, chunkSpec);
    writeFillPlan(chunkPath, chunkSpec);
  }
}

function writeJson(file, value) {
  const target = path.resolve(CALLER_CWD, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, compactJson(value));
}

function writeFillPlan(goalPath, spec) {
  const out = fillPlanPath(goalPath);
  writeJson(out, {
    goal: path.resolve(CALLER_CWD, goalPath),
    themePack: spec.themePack,
    slideCount: spec.slides.length,
    ...(spec.part ? { part: spec.part } : {}),
    slides: spec.slides.map((slide, index) => {
      const inspected = inspectLayout(slide.layout, { compact: true });
      return {
        slide: (spec.part?.startSlide || 1) + index,
        layout: slide.layout,
        label: inspected?.label || null,
        roles: inspected?.roles || [],
        fillPlan: inspected?.fillPlan || null,
      };
    }),
  });
  return path.resolve(CALLER_CWD, out);
}

function fillPlanPath(goalPath) {
  const parsed = path.parse(goalPath);
  return path.join(parsed.dir, `${parsed.name}.fill-plan.json`);
}

function printUsage() {
  console.error('Usage: node scripts/goal-scaffold.mjs --title <title> --goal <goal> --theme <themeXX> --pages <n> --out output/<deck>/goal.json [--roles statement,metrics,case] [--chunk-size 5]');
}
