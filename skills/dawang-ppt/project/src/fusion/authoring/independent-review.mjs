import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadProject } from '../project/store.mjs';
import { ruleItems } from '../rules/items.mjs';
import { buildReviewPacket, normalizeVerdict, writeReview, checklistHash, hasTieredReview, inspectReviewScope, REVIEW_FILE } from '../qa/rules-review.mjs';

const CODEX_CANDIDATES = ['/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex', '/Applications/Codex.app/Contents/Resources/codex'];
const onPath = (name) => (process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, name)).find((file) => fs.existsSync(file));

// DAWANG_REVIEWER_CMD runs any reviewer: it gets PACKET_DIR (prompt.txt, schema.json, claims.json, images/NN.png) and must write
// PACKET_DIR/verdict.json. Without it, a local Codex CLI is used in a fresh, read-only, ephemeral session;
// DAWANG_REVIEWER_MODEL and DAWANG_REVIEWER_EFFORT (minimal/low/medium/high) pick its model and reasoning effort.
export function resolveReviewer(env = process.env) {
  if (env.DAWANG_REVIEWER_CMD) return { kind: 'command', command: env.DAWANG_REVIEWER_CMD, name: 'command:' + env.DAWANG_REVIEWER_CMD.split(/\s+/)[0] };
  const codex = onPath('codex') || CODEX_CANDIDATES.find((file) => fs.existsSync(file));
  if (codex) return { kind: 'codex', command: codex, model: env.DAWANG_REVIEWER_MODEL, effort: env.DAWANG_REVIEWER_EFFORT, name: 'codex' + (env.DAWANG_REVIEWER_MODEL ? ':' + env.DAWANG_REVIEWER_MODEL : '') + (env.DAWANG_REVIEWER_EFFORT ? '/' + env.DAWANG_REVIEWER_EFFORT : '') };
  return null;
}

function runReviewer(reviewer, packetDir, packet) {
  const verdictFile = path.join(packetDir, 'verdict.json');
  const run = reviewer.kind === 'command'
    ? spawnSync(reviewer.command, { shell: true, cwd: packetDir, env: { ...process.env, PACKET_DIR: packetDir }, encoding: 'utf8', timeout: 900000 })
    : spawnSync(reviewer.command, ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', packetDir,
      ...(reviewer.model ? ['-m', reviewer.model] : []), ...(reviewer.effort ? ['-c', 'model_reasoning_effort=' + reviewer.effort] : []), '--output-schema', path.join(packetDir, 'schema.json'), '-o', verdictFile,
      ...packet.images.map((file) => '--image=' + file), '-'], { input: packet.prompt, encoding: 'utf8', timeout: 900000 });
  if (run.error) throw run.error;
  if (!fs.existsSync(verdictFile)) throw new Error('复核者未写出 verdict.json（退出码 ' + run.status + '）：' + String(run.stderr || '').slice(-600));
  return JSON.parse(fs.readFileSync(verdictFile, 'utf8'));
}

// The result says what to do next, so a failed review continues inside the same turn instead of being reported.
export const MAX_REVIEW_ROUNDS = 3;
export function nextStep(failed, round, { blockers = failed, advisories = 0, tiered = false } = {}) {
  if (!failed && !blockers) return '复核通过：运行 publish:html <workspaceDir> <交付.html>。';
  if (tiered && !blockers && advisories > 0) return '无阻断问题（仅含审美/可选建议）：可运行 publish:html <workspaceDir> <交付.html>，并在交付回复中单独说明建议项。';
  const missing = '若 fail 要的是原材料没有的信息（整体目标、达成率、差距、决策事项等）：不要改措辞重试，立即向用户说明缺哪几项，请用户选择补充材料或按现有材料生成（页面如实标注“材料未提供”，清单改 not-applicable 并写明用户的选择）；由用户决定，不自行判定。';
  if (round >= MAX_REVIEW_ROUNDS) {
    if (tiered && blockers > 0) {
      return `已复核 ${round} 轮仍有 ${blockers} 项阻断问题（needs-revision）：禁止覆盖正式交付文件，可输出 review-draft 供用户查看并请用户决定。` + missing;
    }
    return `已复核 ${round} 轮仍有 fail：向用户说明剩余 fail 理由，附截图与可选方案，请用户决定。` + missing;
  }
  return '本轮继续，不要向用户汇报未通过：按 failed[].reason 修改页面（patch:project）后再运行 review:rules。版式、精致度、结构图、视觉母题类 fail 要重新构图并更新 visualDecision.layout，只改措辞或行距不算修正。' + missing;
}

// A follow-up round re-judges only the previous fails (or page-invalidated claims under W4 tiered review)
// and carries the unaffected passes, which keeps later rounds short. full: true judges everything again.
export function previousRound(workspaceDir, project) {
  try {
    const record = JSON.parse(fs.readFileSync(path.join(workspaceDir, REVIEW_FILE), 'utf8'));
    if (record.checklistHash !== checklistHash(project)) return null;
    if (hasTieredReview(project)) {
      const scope = inspectReviewScope(project, record);
      if (scope.globalChanged || !scope.staleClaimIds.length) return null;
      return { ...record, scope };
    }
    if (!record.items?.some((i) => i.verdict === 'fail')) return null;
    return record;
  } catch { return null; }
}

export async function reviewRulesIndependently({ workspaceDir, reviewer = resolveReviewer(), keepPacket, full = false }) {
  if (!reviewer) throw new Error('未找到可用的独立复核者：安装 Codex CLI，或设置 DAWANG_REVIEWER_CMD（命令读取 $PACKET_DIR 并写出 verdict.json）');
  const project = loadProject(path.join(workspaceDir, 'deck-project.json'));
  const checklist = project.contentPlan?.ruleChecklist;
  if (!checklist) throw new Error('工程没有 contentPlan.ruleChecklist；先按 rules:checklist 填写');
  const rules = ruleItems(checklist.scenario);
  const packetDir = keepPacket ? (fs.mkdirSync(keepPacket, { recursive: true }), keepPacket) : fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-review-'));
  try {
    // Loaded lazily: the pipeline pulls in the JSX renderer, which plain node cannot import.
    const { checkProject } = await import('./pipeline.mjs');
    const shots = path.join(packetDir, 'images');
    const check = await checkProject({ workspaceDir, screenshots: shots });
    if (!check.qa?.pages?.length) throw new Error('无法截图复核：' + JSON.stringify(check.issues || []).slice(0, 400));
    const files = fs.readdirSync(shots).filter((f) => f.endsWith('.png')).sort();
    const pages = check.qa.pages.map((page, i) => ({ slideId: page.slideId, image: path.join(shots, files[i]) }));
    const previous = full ? null : previousRound(workspaceDir, project);
    const only = previous && new Set(
      previous.scope
        ? previous.scope.staleClaimIds
        : previous.items.filter((i) => i.verdict === 'fail').map((i) => i.id)
    );
    const packet = buildReviewPacket({ project, rules, pages, only });
    fs.writeFileSync(path.join(packetDir, 'prompt.txt'), packet.prompt);
    fs.writeFileSync(path.join(packetDir, 'schema.json'), JSON.stringify(packet.schema));
    fs.writeFileSync(path.join(packetDir, 'claims.json'), JSON.stringify(packet.claims, null, 2));
    const judged = normalizeVerdict(runReviewer(reviewer, packetDir, packet), packet.claims, project);
    const reusableIds = previous?.scope ? new Set(previous.scope.reusableClaimIds) : null;
    const carried = previous
      ? previous.items
          .filter((i) => (reusableIds ? reusableIds.has(i.id) : i.verdict === 'pass') && packet.all.some((c) => c.id === i.id))
          .map((i) => ({ ...i, carried: true }))
      : [];
    const items = [...carried, ...judged];
    const record = writeReview(workspaceDir, project, { reviewer: reviewer.name, items, claims: packet.all });
    const tiered = hasTieredReview(project);
    const failed = record.items.filter((i) => i.verdict === 'fail');
    const blockers = tiered ? failed.filter((i) => i.severity !== 'advisory') : failed;
    const advisories = tiered ? failed.filter((i) => i.severity === 'advisory') : [];
    const releaseStatus = blockers.length ? 'needs-revision' : 'ready';
    return {
      ok: !blockers.length,
      releaseStatus,
      reviewer: reviewer.name,
      revision: record.revision,
      round: record.round,
      judged: judged.length,
      carried: carried.length,
      passed: record.items.length - failed.length,
      failed,
      blockers,
      advisories,
      next: nextStep(failed.length, record.round, { blockers: blockers.length, advisories: advisories.length, tiered })
    };
  } finally {
    if (!keepPacket) fs.rmSync(packetDir, { recursive: true, force: true });
  }
}
