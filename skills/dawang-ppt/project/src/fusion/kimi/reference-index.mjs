// Paths and metadata only. Reference text stays in the user's local installation.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
const CANDIDATE_DIRS = () => [process.env.KIMI_PPT_SKILL_DIR, LOCAL_REFERENCE_DIR, path.join(os.homedir(), ".codex/skills/open-kimi-ppt"), path.join(os.homedir(), ".agents/skills/open-kimi-ppt")].filter(Boolean);
function locateKimiSkill(dirs = CANDIDATE_DIRS()) {
  for (const d of dirs) if (fs.existsSync(path.join(d, "reference/slides_categories.md")) || fs.existsSync(path.join(d, "slides_categories.md"))) return d;
  return null;
}
// Local references may be a reference directory or a skill with a nested reference/.
const refDir = (root) => fs.existsSync(path.join(root, "reference/slides_categories.md")) ? path.join(root, "reference") : root;
function scenarioDocs(scenarioId, root = locateKimiSkill()) {
  const s = SCENARIOS.find((x) => x.id === scenarioId);
  if (!s) throw new Error("Unknown scenario " + scenarioId);
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
  if (!SCENARIOS.some((scenario) => scenario.id === scenarioId)) throw new Error('Unknown scenario ' + scenarioId);
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
