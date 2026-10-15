// Deck 界面语言层的纯函数部分:语言归一化、词典加载、元数据中文文案收集。
// 本文件不得 import 任何 .jsx——scripts/build/extract-i18n-strings.mjs 等纯 node
// 工具直接跑它;需要主题注册表的裁剪逻辑住 src/i18n.mjs。
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DICT_FILE = path.join(ROOT, 'i18n/zh-en.json');

export const DECK_LANGUAGES = ['zh', 'en'];

export function normalizeDeckLanguage(value) {
  const lang = String(value ?? '').trim().toLowerCase();
  if (lang === 'en' || lang === 'english' || lang.startsWith('en-')) return 'en';
  return 'zh';
}

let cachedDict = null;
export function loadI18nDictionary() {
  cachedDict ??= existsSync(DICT_FILE) ? JSON.parse(readFileSync(DICT_FILE, 'utf8')) : {};
  return cachedDict;
}

const hasCJK = (value) => /[一-鿿]/.test(String(value ?? ''));

// 收集页面/主题包元数据里全部用户可见中文文案(控件 label/desc/unit/选项、页面名、
// 主题名/场景)。运行时按 deck 裁剪词典用它,scripts/build/extract-i18n-strings.mjs
// 的全量提取/覆盖率检查也复用它——共享实现必须住 src/(安装版 project/ 只带 src 与
// 白名单 scripts,运行时代码不得 import scripts/build/)。
export function collectMetadataStrings(pages, packs) {
  const entries = new Map(); // 中文 → Set<kind>
  const add = (text, kind) => {
    const s = typeof text === 'string' ? text.trim() : '';
    if (!s || !hasCJK(s)) return;
    if (!entries.has(s)) entries.set(s, new Set());
    entries.get(s).add(kind);
  };

  for (const pack of packs ?? []) {
    add(pack.displayName ?? pack.label ?? pack.name, 'theme');
    add(pack.scenario, 'theme');
    add(pack.audience, 'theme');
  }
  for (const page of pages ?? []) {
    add(page.label, 'page');
    for (const control of page.controls ?? []) {
      add(control.label, 'control');
      add(control.desc ?? control.description, 'desc');
      add(control.unit, 'unit');
      const options = Array.isArray(control.options) ? control.options : [];
      for (const option of options) {
        add(Array.isArray(option) ? option[1] : (option?.label ?? option), 'option');
      }
    }
  }
  return entries;
}
