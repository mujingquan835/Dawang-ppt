import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadProject } from '../project/store.mjs';
import { kimiRuleItems } from '../kimi/rule-items.mjs';
import { buildReviewPacket, normalizeVerdict, writeReview } from '../qa/kimi-review.mjs';

const CODEX_CANDIDATES = ['/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex', '/Applications/Codex.app/Contents/Resources/codex'];
const onPath = (name) => (process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, name)).find((file) => fs.existsSync(file));

// DAWANG_REVIEWER_CMD runs any reviewer: it gets PACKET_DIR (prompt.txt, schema.json, claims.json, images/NN.png) and must write
// PACKET_DIR/verdict.json. Without it, a local Codex CLI is used in a fresh, read-only, ephemeral session.
export function resolveReviewer(env = process.env) {
  if (env.DAWANG_REVIEWER_CMD) return { kind: 'command', command: env.DAWANG_REVIEWER_CMD, name: 'command:' + env.DAWANG_REVIEWER_CMD.split(/\s+/)[0] };
  const codex = onPath('codex') || CODEX_CANDIDATES.find((file) => fs.existsSync(file));
  if (codex) return { kind: 'codex', command: codex, model: env.DAWANG_REVIEWER_MODEL, name: 'codex' + (env.DAWANG_REVIEWER_MODEL ? ':' + env.DAWANG_REVIEWER_MODEL : '') };
  return null;
}

function runReviewer(reviewer, packetDir, packet) {
  const verdictFile = path.join(packetDir, 'verdict.json');
  const run = reviewer.kind === 'command'
    ? spawnSync(reviewer.command, { shell: true, cwd: packetDir, env: { ...process.env, PACKET_DIR: packetDir }, encoding: 'utf8', timeout: 900000 })
    : spawnSync(reviewer.command, ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', packetDir,
      ...(reviewer.model ? ['-m', reviewer.model] : []), '--output-schema', path.join(packetDir, 'schema.json'), '-o', verdictFile,
      ...packet.images.map((file) => '--image=' + file), '-'], { input: packet.prompt, encoding: 'utf8', timeout: 900000 });
  if (run.error) throw run.error;
  if (!fs.existsSync(verdictFile)) throw new Error('复核者未写出 verdict.json（退出码 ' + run.status + '）：' + String(run.stderr || '').slice(-600));
  return JSON.parse(fs.readFileSync(verdictFile, 'utf8'));
}

export async function reviewKimiChecklist({ workspaceDir, reviewer = resolveReviewer(), keepPacket }) {
  if (!reviewer) throw new Error('未找到可用的独立复核者：安装 Codex CLI，或设置 DAWANG_REVIEWER_CMD（命令读取 $PACKET_DIR 并写出 verdict.json）');
  const project = loadProject(path.join(workspaceDir, 'deck-project.json'));
  const checklist = project.contentPlan?.ruleChecklist;
  if (!checklist) throw new Error('工程没有 contentPlan.ruleChecklist；先按 rules:checklist 填写');
  const rules = kimiRuleItems(checklist.scenario);
  const packetDir = keepPacket ? (fs.mkdirSync(keepPacket, { recursive: true }), keepPacket) : fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-review-'));
  try {
    // Loaded lazily: the pipeline pulls in the JSX renderer, which plain node cannot import.
    const { checkProject } = await import('./pipeline.mjs');
    const shots = path.join(packetDir, 'images');
    const check = await checkProject({ workspaceDir, screenshots: shots });
    if (!check.qa?.pages?.length) throw new Error('无法截图复核：' + JSON.stringify(check.issues || []).slice(0, 400));
    const files = fs.readdirSync(shots).filter((f) => f.endsWith('.png')).sort();
    const pages = check.qa.pages.map((page, i) => ({ slideId: page.slideId, image: path.join(shots, files[i]) }));
    const packet = buildReviewPacket({ project, rules, pages });
    fs.writeFileSync(path.join(packetDir, 'prompt.txt'), packet.prompt);
    fs.writeFileSync(path.join(packetDir, 'schema.json'), JSON.stringify(packet.schema));
    fs.writeFileSync(path.join(packetDir, 'claims.json'), JSON.stringify(packet.claims, null, 2));
    const items = normalizeVerdict(runReviewer(reviewer, packetDir, packet), packet.claims);
    const record = writeReview(workspaceDir, project, { reviewer: reviewer.name, items });
    const failed = items.filter((i) => i.verdict === 'fail');
    return { ok: !failed.length, reviewer: reviewer.name, revision: record.revision, passed: items.length - failed.length, failed };
  } finally {
    if (!keepPacket) fs.rmSync(packetDir, { recursive: true, force: true });
  }
}
