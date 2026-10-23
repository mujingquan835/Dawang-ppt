import {createHash} from 'node:crypto';
// Paths and metadata only. Reference text stays in the user's local installation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DISPOSITION_LEGEND, dispositionFor } from "./rule-dispositions.mjs";
const LOCAL_REFERENCE_DIR = path.join(os.homedir(), ".dawang-ppt/kimi-reference");
const SCENARIOS = Object.freeze([
  { id: "analysis-decision", zh: "分析决策", doc: "analysis-decision.md", presetCategories: ["consulting", "finance", "01_strategy"] },
  { id: "business-plan", zh: "商业提案", doc: "business-plan.md", presetCategories: ["promotion", "consulting", "02_business"] },
  { id: "management-report", zh: "管理汇报", doc: "management-report.md", presetCategories: ["work", "consulting", "finance", "03_work"] },
  { id: "academic-research", zh: "学术研究", doc: "academic-research.md", presetCategories: ["academic", "05_academic"] },
  { id: "education-training", zh: "教育培训", doc: "education-training.md", presetCategories: ["academic", "05_academic"] },
  { id: "tech-engineering", zh: "技术工程", doc: "tech-engineering.md", presetCategories: ["work", "academic", "01_strategy"] },
  { id: "brand-creative", zh: "品牌创意", doc: "brand-creative.md", presetCategories: ["promotion", "work", "04_promotion"] }
]);
// The Kimi desktop copy is last: it is only used when it is the pinned version or nothing else is installed.
const CANDIDATE_DIRS = () => [process.env.KIMI_PPT_SKILL_DIR, LOCAL_REFERENCE_DIR, path.join(os.homedir(), ".codex/skills/open-kimi-ppt"), path.join(os.homedir(), ".agents/skills/open-kimi-ppt"), path.join(os.homedir(), "Library/Application Support/kimi-desktop/daimon-share/daimon/skills/kimi-slides")].filter(Boolean);
function locateKimiSkill(dirs = CANDIDATE_DIRS()) {
  for (const d of dirs) if (fs.existsSync(path.join(d, "reference/slides_categories.md")) || fs.existsSync(path.join(d, "slides_categories.md"))) return d;
  return null;
}
// Local references may be a reference directory or a skill with a nested reference/.
const refDir = (root) => fs.existsSync(path.join(root, "reference/slides_categories.md")) ? path.join(root, "reference") : root;
function scenarioDocs(scenarioId, root = locateKimiSkill()) {
  const s = SCENARIOS.find((x) => x.id === scenarioId);
  if (!s) throw new Error("Unknown scenario " + scenarioId + ". Valid scenarios: " + SCENARIOS.map(s=>s.id).join(", "));
  if (!root) return { available: false, generalRules: null, scenarioDoc: null, reason: "未找到本机 open-kimi-ppt 安装；请设置 KIMI_PPT_SKILL_DIR" };
  const generalRules = path.join(refDir(root), "slides_categories.md"), scenarioDoc = path.join(refDir(root), "slides_categories", s.doc);
  const missing = [generalRules, scenarioDoc].filter((p) => !fs.existsSync(p));
  return { available: missing.length === 0, generalRules, scenarioDoc, missing };
}
// Presets: reference/design_system/<category>/<name>/design.md (named) or <NN_group>/<NN>/... (numbered variants).
function listPresets(root = locateKimiSkill()) {
  if (!root) return [];
  const base = path.join(refDir(root), "design_system"), out = [];
  if (!fs.existsSync(base)) return out;
  for (const category of fs.readdirSync(base).sort()) {
    const cdir = path.join(base, category);
    if (!fs.statSync(cdir).isDirectory()) continue;
    for (const name of fs.readdirSync(cdir).sort()) {
      const pdir = path.join(cdir, name);
      if (!fs.statSync(pdir).isDirectory()) continue;
      const files = fs.readdirSync(pdir, { recursive: true }).filter((f) => String(f).endsWith(".md"));
      const doc = files.find((f) => path.basename(String(f)) === "design.md") || files[0];
      if (!doc) continue;
      out.push({ presetId: `kimi-preset:${category}/${name}`, category, name, numbered: /^\d/.test(category), doc: path.join(pdir, String(doc)) });
    }
  }
  return out;
}
// Palette swatches for a preview tile (hex values read from the local doc; nothing stored in the repo).
function presetPalette(docPath, max = 5) {
  try {
    const hex = [...fs.readFileSync(docPath, "utf8").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase());
    return [...new Set(hex)].slice(0, max);
  } catch { return []; }
}
export { LOCAL_REFERENCE_DIR, SCENARIOS, locateKimiSkill, scenarioDocs, listPresets, presetPalette };

// New authoring path: locate original documents without selecting old presets.
// Missing requested paths remain in the list so rule-manifest can report them.
export function authoringRuleSources({ scenarioId, root = locateKimiSkill(), designDoc, formatDocs = [] }) {
  if (!SCENARIOS.some((scenario) => scenario.id === scenarioId)) throw new Error('Unknown scenario ' + scenarioId + '. Valid scenarios: ' + SCENARIOS.map(s=>s.id).join(', '));
  if (!root) throw new Error('未找到本机 open-kimi-ppt 安装；请设置 KIMI_PPT_SKILL_DIR');
  const reference = refDir(root);
  const docs = scenarioDocs(scenarioId, root);
  const sources = [
    { id: 'workflow', path: path.join(root, 'SKILL.md'), section: '制作步骤' },
    { id: 'general', path: docs.generalRules, section: '通用场景规则' },
    { id: `scenario:${scenarioId}`, path: docs.scenarioDoc, section: '主场景' }
  ];
  if (designDoc) sources.push({ id: 'design', path: path.resolve(reference, designDoc), section: '用户指定设计系统或风格参考' });
  for (const doc of formatDocs) sources.push({ id: `format:${doc}`, path: path.resolve(reference, doc), section: '表达格式' });
  return sources;
}

// Version pin: the lock records relative paths and SHA-256 of every local rule file, never their text.
export const RULES_LOCK_FILE = path.resolve(import.meta.dirname, '../../../../references/kimi-rules.lock.json');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const relativeRulePath = (root, file) => {
  const rel = path.relative(root, file).split(path.sep).join('/');
  return refDir(root) === root && rel !== 'SKILL.md' ? 'reference/' + rel : rel;
};
export function fingerprintKimiRules(root) {
  const files = {}, add = (file) => { if (fs.existsSync(file)) files[relativeRulePath(root, file)] = sha(fs.readFileSync(file)); };
  add(path.join(root, 'SKILL.md'));
  const reference = refDir(root);
  for (const file of fs.readdirSync(reference, { recursive: true }).map(String).filter((f) => f.endsWith('.md'))) add(path.join(reference, file));
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { files: sorted, bundleSha256: sha(Object.entries(sorted).map(([file, hash]) => file + '\0' + hash).join('\n')) };
}
export function readRulesLock(file = RULES_LOCK_FILE) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
export function compareToLock(fingerprint, lock) {
  if (!lock) return { status: 'unpinned', changed: [], added: [], removed: [] };
  const locked = lock.files || {}, current = fingerprint.files;
  const changed = Object.keys(current).filter((f) => f in locked && locked[f] !== current[f]);
  const added = Object.keys(current).filter((f) => !(f in locked)), removed = Object.keys(locked).filter((f) => !(f in current));
  return { status: fingerprint.bundleSha256 === lock.bundleSha256 ? 'pinned' : 'drift', changed, added, removed };
}
// Prefer the installation that matches the lock, so a second Kimi copy cannot silently become the source.
// An explicit KIMI_PPT_SKILL_DIR is always used; a mismatch then surfaces as drift instead of being skipped.
export function locatePinnedKimiSkill(lock = readRulesLock(), dirs = CANDIDATE_DIRS()) {
  const explicit = process.env.KIMI_PPT_SKILL_DIR;
  if (explicit && dirs.includes(explicit) && locateKimiSkill([explicit])) return explicit;
  const found = dirs.filter((dir) => locateKimiSkill([dir]));
  return found.find((dir) => lock && fingerprintKimiRules(dir).bundleSha256 === lock.bundleSha256) || found[0] || null;
}
export function writeRulesLock({ root = locatePinnedKimiSkill(), file = RULES_LOCK_FILE, label } = {}) {
  if (!root) throw new Error('未找到本机 open-kimi-ppt 安装；请设置 KIMI_PPT_SKILL_DIR');
  const previous = readRulesLock(file), fingerprint = fingerprintKimiRules(root);
  const lock = { version: 1, label: label || previous?.label || path.basename(root), pinnedAt: new Date().toISOString(), bundleSha256: fingerprint.bundleSha256, files: fingerprint.files };
  fs.writeFileSync(file, JSON.stringify(lock, null, 2) + '\n');
  return { file, root, label: lock.label, bundleSha256: lock.bundleSha256, files: Object.keys(lock.files).length, changes: compareToLock(fingerprint, previous) };
}

// Flat sections: every line belongs to the nearest heading above it; headings inside code fences are text.
export function splitRuleSections(text) {
  const sections = [];
  let fence = null, current = { heading: '(preamble)', level: 0, start: 1, lines: [] };
  text.split('\n').forEach((line, index) => {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker) fence = fence === marker ? null : fence ?? marker;
    const heading = !fence && !marker && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      if (current.level || current.lines.some((l) => l.trim())) sections.push(current);
      current = { heading: heading[2], level: heading[1].length, start: index + 1, lines: [] };
    }
    current.lines.push(line);
  });
  sections.push(current);
  return sections.map((s) => ({ heading: s.heading, level: s.level, lines: [s.start, s.start + s.lines.length - 1], text: s.lines.join('\n') }));
}

// Sections carry apply/adapt/replaced labels. Replaced text is omitted unless includeReplaced; a file that differs
// from the lock stops the read unless allowDrift, and then its sections are reported as unreviewed.
export function readAuthoringRules({ lock = readRulesLock(), allowDrift = false, includeReplaced = false, ...options }) {
  const root = options.root === undefined ? locatePinnedKimiSkill(lock) : options.root;
  const sources = authoringRuleSources({ ...options, root });
  const pin = { ...compareToLock(fingerprintKimiRules(root), lock), label: lock?.label ?? null, lockedBundleSha256: lock?.bundleSha256 ?? null, root };
  if (pin.status === 'drift' && !allowDrift) {
    const error = new Error('Kimi 原规则与锁定版本不一致（改动 ' + pin.changed.length + '、新增 ' + pin.added.length + '、缺失 ' + pin.removed.length + '）：' + [...pin.changed, ...pin.added, ...pin.removed].slice(0, 8).join('，') + '。核对差异后运行 rules:lock 重新锁定，或本次加 --allow-drift。');
    error.pin = pin;
    throw error;
  }
  const drifted = new Set([...pin.changed, ...pin.added]);
  const documents = sources.map((source) => {
    const bytes = fs.readFileSync(source.path), relativePath = relativeRulePath(root, source.path), stale = drifted.has(relativePath);
    const sections = splitRuleSections(bytes.toString('utf8')).map((section, index) => {
      const label = dispositionFor(relativePath, section.heading);
      const shown = stale ? { disposition: 'unreviewed', note: '文件与锁定版本不同；锁定版本中此标题标注为 ' + label.disposition } : label;
      const { text, ...rest } = section;
      return { id: source.id + '#' + String(index + 1).padStart(2, '0'), ...rest, ...shown, ...(shown.disposition === 'replaced' && !includeReplaced ? { textOmitted: true } : { text }) };
    });
    return { ...source, relativePath, sha256: sha(bytes), sections };
  });
  const summary = {};
  for (const section of documents.flatMap((d) => d.sections)) summary[section.disposition] = (summary[section.disposition] || 0) + 1;
  return { version: 1, legend: DISPOSITION_LEGEND, pin, summary, documents };
}
