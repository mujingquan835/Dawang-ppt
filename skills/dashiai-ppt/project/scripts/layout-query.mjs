#!/usr/bin/env node
import {
  ROLE_KEYWORDS,
  compactJson,
  getThemePackMetadata,
  listLayouts,
  parseArgs,
} from './skill-workflow-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const mediaIntent = getMediaIntent(args);
const mediaCount = getMediaCount(args);
const mediaKind = getMediaKind(args);
const requireInitialMedia = args['require-initial-media'] === true || args.requireInitialMedia === true || Boolean(args['provided-images'] || args['provided-media']);
const result = {
  theme: args.theme || null,
  role: args.role || args.use || null,
  keyword: args.keyword || args.q || null,
  needsMedia: args['needs-media'] === true || args.media === true || Boolean(mediaIntent) || Boolean(mediaCount) || Boolean(mediaKind) || requireInitialMedia,
  mediaIntent,
  mediaCount,
  mediaKind,
  requireInitialMedia,
  limit: Number(args.limit || 12),
  // 候选同分随机:未显式给 --seed 时每次调用生成新 seed(输出里回显,便于复现)。
  seed: args.seed !== undefined && args.seed !== true ? String(args.seed) : String(Math.floor(Math.random() * 0xffffffff)),
};
const themeMetadata = result.theme ? getThemePackMetadata(result.theme) : null;

const layouts = listLayouts({
  theme: result.theme,
  role: result.role,
  keyword: result.keyword,
  needsMedia: result.needsMedia,
  plannedImages: args['planned-images'],
  providedImages: args['provided-images'],
  providedMedia: args['provided-media'],
  imageGen: args['image-gen'] === true || args.imageGen === true,
  needsVisual: args['needs-visual'] === true || args.needsVisual === true,
  mediaCount: args['media-count'] || args.mediaCount,
  mediaKind: result.mediaKind,
  requireInitialMedia: result.requireInitialMedia,
  limit: result.limit,
  seed: result.seed,
});

process.stdout.write(compactJson({
  ...result,
  themeDisplayName: themeDisplayName(themeMetadata, result.theme),
  themeScenario: themeMetadata?.scenario || null,
  themeAudience: themeMetadata?.audience || null,
  count: layouts.length,
  layouts,
  // 零结果时给可行动提示:列出可用 role,避免调用方退化为全量翻页。
  ...(layouts.length === 0 ? {
    hint: result.role
      ? `role "${result.role}" 在该条件下无候选;可用 role 见 availableRoles,或去掉 --role 用 --keyword 搜索`
      : '无候选;试试更换 --keyword 或去掉媒体条件',
    availableRoles: Object.keys(ROLE_KEYWORDS),
  } : {}),
}));

function themeDisplayName(theme, fallback) {
  return theme?.displayName || theme?.label || theme?.name || fallback || null;
}

function getMediaIntent(args) {
  if (args['provided-images']) return 'provided-images';
  if (args['provided-media']) return 'provided-media';
  if (args['planned-images']) return 'planned-images';
  if (args['image-gen'] === true || args.imageGen === true) return 'image-gen';
  if (args['needs-visual'] === true || args.needsVisual === true) return 'needs-visual';
  return null;
}

function getMediaKind(args) {
  const value = args['media-kind'] || args.mediaKind || null;
  if (value) return String(value);
  if (args['provided-media']) return 'mixed';
  return null;
}

function getMediaCount(args) {
  const explicit = Number(args['media-count'] || args.mediaCount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  for (const key of ['provided-images', 'provided-media', 'planned-images']) {
    const count = Number(args[key]);
    if (Number.isFinite(count) && count > 0) return Math.round(count);
  }
  return null;
}
