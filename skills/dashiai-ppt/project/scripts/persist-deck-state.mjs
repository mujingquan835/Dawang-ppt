// 预览服务"编辑自动回写"的核心逻辑:纯函数 + 少量文件系统副作用,便于不起 HTTP 服务单测。
// 调用方(scripts/serve-preview-https.mjs)只负责鉴权/HTTP 收发,这里只管三件事:
//   1) 校验运行时上报的 state 形状(拒绝畸形请求)。
//   2) 把 state.props 里的 data: 媒体解码落盘到 assets/user-media/,state 里替换成相对路径。
//   3) 把新 state 原子写回 index.html 既有的 `#deck-view-model` script 块,不改其余字段。
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { generateVideoPoster } from './stage-media.mjs';

const DECK_VIEW_MODEL_BLOCK = /<script id="deck-view-model" type="application\/json">([\s\S]*?)<\/script>/;

const MIME_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

// 运行时上报的 state 只允许这几个已知字段,形状必须匹配;其余一律视为畸形请求直接拒绝,
// 不做"尽量兼容"的静默丢弃——写坏 index.html 比拒绝一次自动保存代价更大。
export function isValidDeckState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const arrayFields = ['slideOrder', 'skippedSlides', 'deletedSlides', 'duplicatedSlides'];
  for (const field of arrayFields) {
    if (state[field] !== undefined && !Array.isArray(state[field])) return false;
  }
  const objectFields = ['text', 'props', 'typography', 'textFonts', 'mediaSlotStyles'];
  for (const field of objectFields) {
    if (state[field] !== undefined && !isPlainObject(state[field])) return false;
  }
  return true;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// data:<mime>;base64,<payload> 解码;非 image/* 或 video/* 一律返回 null(不落盘、原样保留)。
function decodeDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) return null;
  const commaIndex = value.indexOf(',');
  if (commaIndex === -1) return null;
  const header = value.slice('data:'.length, commaIndex);
  if (!/;base64$/i.test(header)) return null;
  const mime = header.slice(0, header.length - ';base64'.length).split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('image/') && !mime.startsWith('video/')) return null;
  try {
    return { mime, buffer: Buffer.from(value.slice(commaIndex + 1), 'base64') };
  } catch {
    return null;
  }
}

function extensionForMime(mime) {
  if (MIME_EXTENSIONS[mime]) return MIME_EXTENSIONS[mime];
  return mime.startsWith('video/') ? '.mp4' : '.png';
}

// 深度遍历 state,把每个 data: 字符串交给 transform;非字符串/非 data: 值原样保留。
function replaceDataUrlStrings(value, transform) {
  if (Array.isArray(value)) return value.map(item => replaceDataUrlStrings(item, transform));
  if (isPlainObject(value)) {
    const next = {};
    for (const [key, item] of Object.entries(value)) next[key] = replaceDataUrlStrings(item, transform);
    return next;
  }
  if (typeof value === 'string' && value.startsWith('data:')) return transform(value);
  return value;
}

// state 里所有 data: 媒体 → 落盘到 `<deckDir>/assets/user-media/<hash>.<ext>`,内容相同的
// data URL 按哈希去重(同一媒体反复编辑不会重复写盘)。返回替换后的 state、本次新写入的文件名,
// 以及 `mediaMap`(原始 data: URL → 相对路径,只含真正转换成功的条目)。
//
// mediaMap 存在的理由:这次请求发出后、响应回来前,用户可能已经继续编辑(输入了更多文字、
// 换了别的图)。调用方不能拿这里返回的整份 state 直接覆盖客户端当下的 vm.state——那会把等待
// 期里发生的新编辑悄悄冲掉。正确做法是客户端只用 mediaMap 做"精确字符串替换"(把当下 state
// 里仍等于某个原始 data: URL 的位置换成对应相对路径),不动其余字段;见 template-swiss.html 的
// applyMediaMapReconciliation。
export function extractDataUrlMedia(state, deckDir) {
  const mediaDir = path.join(deckDir, 'assets/user-media');
  const written = [];
  const cache = new Map();
  const mediaMap = {};
  const transform = raw => {
    if (cache.has(raw)) return cache.get(raw);
    const decoded = decodeDataUrl(raw);
    if (!decoded) {
      cache.set(raw, raw);
      return raw;
    }
    fs.mkdirSync(mediaDir, { recursive: true });
    const hash = createHash('sha256').update(decoded.buffer).digest('hex').slice(0, 24);
    const filename = `${hash}${extensionForMime(decoded.mime)}`;
    const target = path.join(mediaDir, filename);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, decoded.buffer);
      written.push(filename);
      if (decoded.mime.startsWith('video/')) {
        try { generateVideoPoster(target); } catch { /* 海报生成尽力而为,不阻塞保存 */ }
      }
    }
    const relative = `assets/user-media/${filename}`;
    cache.set(raw, relative);
    mediaMap[raw] = relative;
    return relative;
  };
  return { state: replaceDataUrlStrings(state, transform), written, mediaMap };
}

// 把新 state 写回既有 index.html 的 `#deck-view-model` script 块,只替换 `.state` 字段,
// model/slides/options 等其余字段原样保留——这些字段的生成/维护职责在 renderDeck.jsx。
export function mergeStateIntoIndexHtml(html, nextState) {
  const match = DECK_VIEW_MODEL_BLOCK.exec(html);
  if (!match) throw new Error('index.html is missing the #deck-view-model script block.');
  let viewModel;
  try {
    viewModel = JSON.parse(match[1] || '{}');
  } catch (error) {
    throw new Error(`#deck-view-model block is not valid JSON: ${error.message}`);
  }
  viewModel.state = nextState;
  const nextBlock = `<script id="deck-view-model" type="application/json">${escapeScriptJson(JSON.stringify(viewModel))}</script>`;
  return html.slice(0, match.index) + nextBlock + html.slice(match.index + match[0].length);
}

function escapeScriptJson(value) {
  return value
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

// 同目录临时文件 + rename:rename 在同一文件系统内是原子的,并发写以最后一次 rename 为准,
// 不会让读者看到半份文件。
export function atomicWriteFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}
