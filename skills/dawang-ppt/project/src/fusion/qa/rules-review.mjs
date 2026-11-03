import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { materializeElements } from '../scene/model.mjs';
import { isRuleContract } from './rule-checklist.mjs';

// Independent review of the production rule checklist. The author fills the checklist; a reviewer with a fresh context
// sees only the page screenshots, an element map, the rule text and the claims, and judges each claim. Publishing
// a new deck needs a review of the current revision with no failed claim. The reviewer never sees the author's
// reasoning, so a stretched mapping (a bar chart offered as a structural diagram) has to survive on the pages alone.
export const REVIEW_FILE = 'rules-review.json';
const VERDICTS = new Set(['pass', 'fail']);
export const checklistHash = (project) => createHash('sha256').update(JSON.stringify(project.contentPlan?.ruleChecklist ?? null)).digest('hex');

export const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['id', 'verdict', 'reason'],
    properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'fail'] }, reason: { type: 'string' } }
  } } }
};

// Claims to judge: every recorded entry, applied ones with their evidence, dismissals with their reason.
export function reviewClaims(project, rules) {
  const entries = project.contentPlan?.ruleChecklist?.items || {}, byId = new Map(rules.items.map((i) => [i.id, i]));
  return Object.entries(entries).filter(([id]) => byId.has(id) || rules.sections.some((s) => s.id === id)).map(([id, entry]) => {
    const item = byId.get(id), text = item ? item.text : rules.items.filter((i) => i.section === id).map((i) => i.text).join('\n');
    return { id, status: entry.status, rule: text, ...(entry.status === 'applied' ? { how: entry.how, evidence: entry.evidence } : { reason: entry.reason }) };
  });
}

export function buildReviewPacket({ project, rules, pages }) {
  const claims = reviewClaims(project, rules);
  const slides = pages.map(({ slideId }, index) => {
    const slide = project.slides.find((s) => s.slideId === slideId);
    const elements = materializeElements(slide, project).map((e) => ({ id: e.id, type: e.type, ...(e.text ? { text: String(e.text).slice(0, 80) } : {}), bounds: (e.bounds || []).map(Math.round) }));
    return { image: index + 1, slideId, elements };
  });
  const prompt = [
    '你是独立复核者，没有参与这份演示文稿的制作，也看不到制作者的思考过程。',
    `随附 ${pages.length} 张页面截图（按顺序为第 1…${pages.length} 页，画布 1920×1080）。下面给出每页元素表、完整制作规则（场景：${rules.scenario}）以及制作者对每条规则的声明。`,
    '逐条判断声明是否成立，只以截图上实际看得到的效果为准：',
    '- status=applied：证据页面是否真正满足这条规则的原意。勉强对应判 fail，例如用普通条形图或表格充当“结构图”、用页脚细线或页码充当“视觉母题”、用一句泛泛的工作描述充当封面“关键状态句”、标题只是动作罗列却声称“标题陈述状态或结论”。规则要求的效果在页面上看不出来，也判 fail。',
    '- status=not-applicable 或 user-override：理由是否成立。规则明显适用于本稿内容却被跳过，判 fail。',
    'reason 用中文一句话，写出你在截图上看到的依据；fail 时写明缺什么。必须对每条声明各给一条结果，id 原样返回，只输出符合 schema 的 JSON。',
    '',
    '## 页面元素表',
    JSON.stringify(slides),
    '',
    '## 规则与声明',
    JSON.stringify(claims)
  ].join('\n');
  return { prompt, claims, images: pages.map((p) => p.image), schema: VERDICT_SCHEMA };
}

// Missing or duplicated verdicts make the review unusable rather than silently passing those claims.
export function normalizeVerdict(verdict, claims) {
  const items = Array.isArray(verdict?.items) ? verdict.items : [];
  const byId = new Map(items.filter((i) => VERDICTS.has(i?.verdict)).map((i) => [i.id, { id: i.id, verdict: i.verdict, reason: String(i.reason ?? '') }]));
  const missing = claims.filter((c) => !byId.has(c.id)).map((c) => c.id);
  if (missing.length) throw new Error('复核结果缺少条目：' + missing.join('，'));
  return claims.map((c) => ({ ...byId.get(c.id), status: c.status }));
}

export function writeReview(workspaceDir, project, { reviewer, items }) {
  const record = { revision: project.revision, checklistHash: checklistHash(project), reviewer, at: new Date().toISOString(), items };
  fs.writeFileSync(path.join(workspaceDir, REVIEW_FILE), JSON.stringify(record, null, 2));
  return record;
}

export function reviewGate(project, workspaceDir) {
  const strict = isRuleContract(project), issues = [], warnings = [];
  const report = (record) => (strict ? issues : warnings).push(record);
  if (!project.contentPlan?.ruleChecklist) return { issues, warnings, review: null, strict };
  const file = workspaceDir && path.join(workspaceDir, REVIEW_FILE);
  const hint = 'review:rules <工程目录> 运行独立复核后再 publish:html';
  if (!file || !fs.existsSync(file)) { report({ kind: 'rules-review-missing', hint }); return { issues, warnings, review: null, strict }; }
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.revision !== project.revision || record.checklistHash !== checklistHash(project)) {
    report({ kind: 'rules-review-stale', reviewedRevision: record.revision, revision: project.revision, hint });
    return { issues, warnings, review: null, strict };
  }
  const failed = record.items.filter((i) => i.verdict === 'fail');
  if (failed.length) report({ kind: 'rules-review-failed', count: failed.length, items: failed.map(({ id, status, reason }) => ({ id, status, reason })) });
  return { issues, warnings, review: { reviewer: record.reviewer, at: record.at, passed: record.items.length - failed.length, failed: failed.length }, strict };
}
