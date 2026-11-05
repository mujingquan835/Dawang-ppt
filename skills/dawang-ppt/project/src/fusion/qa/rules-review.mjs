import { pageDesignClaims } from '../authoring/page-plan.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { materializeElements } from '../scene/model.mjs';
import { isRuleContract, isSectionChecklist } from './rule-checklist.mjs';
import { readDecisions, decisionFor } from './user-decisions.mjs';
import { houseStylePrompt } from './house-style.mjs';

// After this many consecutive rounds, findings the author could not resolve stop blocking: they are delivered with the
// deck and listed to the user, who decides. Objective program checks keep blocking regardless.
export const MAX_REVIEW_ROUNDS = 3;

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

// Concrete visual criteria judged with the rules on new decks. Their fails name a page and a defect the author can fix,
// unlike a general "not polished enough".
export const VISUAL_CLAIMS = [
  { id: 'visual#alignment', rule: '同组元素共用对齐线；流程节点与下方说明逐一对应；同一行图片等高；数字与单位成组，不被拉开' },
  { id: 'visual#hierarchy', rule: '每页第一眼读到的是本页重点；主次在实际尺寸上看得出，不是等大文字堆叠，也不是每页同一个结构' },
  { id: 'visual#images', rule: '照片先按版面画框、再裁切嵌入是用户确认的做法：照片填满框、与相邻内容上下对齐，比例未变形；裁切掉部分画面不算问题，只有人脸或页面依赖的关键文字被切掉才判 fail，修正写“调整 focal 或换图”，不得要求改成完整显示或缩小；照片缩小后框内留空判 fail。对应看位置：照片排在事项旁边或下方时，第 n 张与第 n 项在位置上对齐；照片数量与事项不同而成组排列时，不要求逐项对应。图片画面内容是否与说明一致，只在照片作为证据时判断；页面或用户决定标明“示意”的照片不判断画面内容。页面没有大块无意义空白' }
].map((c) => ({ ...c, status: 'visual' }));

// The user's confirmed house style, one replaced clause at a time (see house-style.mjs, the single source).
export const HOUSE_STYLE = houseStylePrompt();

// only: claim ids to judge this round (a follow-up round re-checks the previous fails).
export function buildReviewPacket({ project, rules, pages, only }) {
  const all = [...reviewClaims(project, rules), ...pageDesignClaims(project), ...(isSectionChecklist(project) ? VISUAL_CLAIMS : [])];
  // Claims a user decision settles carry the user's words, so the reviewer judges against them, not against the rule.
  const decided = all.map((c) => { const d = decisionFor(project, { id: c.id }); return d ? { ...c, userDecision: { quote: d.quote, decision: d.decision, pages: d.pages || '全稿' } } : c; });
  const claims = only ? decided.filter((c) => only.has(c.id)) : decided;
  const decisions = readDecisions(project);
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
    '- id 以 page-design# 开头时：按声明中的页面任务、事实和关系检查截图；绑定只用于定位，不代表表达已正确。检查每个条件、返回路径、成员对应和数据限定；不能因为有色块或箭头就判 pass。',
    '- status=visual：按给出的视觉标准逐页看图，任一页明显不符判 fail；reason 写出页码和具体问题（例如“第2页：流程说明与节点错位”）。',
    HOUSE_STYLE,
    decisions.length ? '用户决定（用户原话，优先于规则、视觉标准和你的个人判断）：带 userDecision 的声明，只要页面做法与用户决定一致就判 pass；不得因用户已明确接受的做法判 fail（例如用户说“图片仅作示意”，就不得要求图片内容与说明对应）。决定之外的问题照常判断。' : '',
    // A partial job is judged on its own pages: deck-level demands do not apply to a section someone asked AI to make.
    project.requirements?.scope === 'full'
      ? '本稿是完整的汇报/述职：整体结论、问题差距、下一步等整稿要求适用。'
      : '本稿只是汇报中的一部分页面（requirements.scope 不是 full）：整体结论、问题差距、下一步计划、需决策事项等整稿要求不适用，不要因页面缺少这些而判 fail；只按这些页面本身的内容与规则判断。',
    '- 原材料本身没有提供的信息（如统计时间、口径、来源）不能要求制作者补造：页面如实标注“待补/未提供”，或以“材料未提供”记为 not-applicable（尤其理由写明“用户确认按现有材料生成”时），均判 pass；只有页面把缺失信息写成确定事实，或明明材料里有却没用，才判 fail。',
    'reason 用中文一句话，写出你在截图上看到的依据；fail 时写明缺什么。必须对每条声明各给一条结果，id 原样返回，只输出符合 schema 的 JSON。',
    '',
    '## 页面元素表',
    JSON.stringify(slides),
    '',
    '## 规则与声明',
    JSON.stringify(claims)
  ].join('\n');
  return { prompt, claims, all, images: pages.map((p) => p.image), schema: VERDICT_SCHEMA };
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
  const file = path.join(workspaceDir, REVIEW_FILE);
  // Rounds count consecutive reviews of this workspace; a pass resets the count for later edits.
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first review */ }
  const passedBefore = previous && previous.items?.every((i) => i.verdict === 'pass');
  const round = previous && !passedBefore ? (previous.round || 1) + 1 : 1;
  const record = { revision: project.revision, checklistHash: checklistHash(project), reviewer, at: new Date().toISOString(), round, items };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return record;
}

export function reviewGate(project, workspaceDir) {
  const strict = isRuleContract(project), issues = [], warnings = [];
  const report = (record) => (strict ? issues : warnings).push(record);
  if (!project.contentPlan?.ruleChecklist) return { issues, warnings, review: null, strict };
  const file = workspaceDir && path.join(workspaceDir, REVIEW_FILE);
  const hint = '正常步骤，不是失败：同一轮内运行 review:rules <工程目录>，通过后 publish:html，不要先向用户汇报';
  if (!file || !fs.existsSync(file)) { report({ kind: 'rules-review-missing', hint }); return { issues, warnings, review: null, strict }; }
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.revision !== project.revision || record.checklistHash !== checklistHash(project)) {
    report({ kind: 'rules-review-stale', reviewedRevision: record.revision, revision: project.revision, hint });
    return { issues, warnings, review: null, strict };
  }
  // A fail the user has decided is settled; the rest block until the author has had MAX_REVIEW_ROUNDS attempts, then
  // they are delivered as open findings for the user to see (never hidden, never edited out of rules-review.json).
  const decided = [], failed = [];
  for (const i of record.items.filter((x) => x.verdict === 'fail')) { const d = decisionFor(project, { id: i.id }); (d ? decided : failed).push(d ? { ...i, decidedBy: d.id, quote: d.quote } : i); }
  const round = record.round ?? 1, open = failed.length && round >= MAX_REVIEW_ROUNDS;
  if (open) warnings.push({ kind: 'rules-review-open', round, items: failed.map(({ id, status, reason }) => ({ id, status, reason })), hint: `已复核 ${round} 轮仍有意见：可以发布，但交付回复里必须逐条列出这些意见，请用户决定是否修改；用户明确接受的，写入 requirements.userDecisions` });
  if (failed.length && !open) report({ kind: 'rules-review-failed', count: failed.length, round: record.round ?? 1, items: failed.map(({ id, status, reason }) => ({ id, status, reason })), hint: '按 reason 改页面后重新 review:rules，同一轮内继续；3 轮仍失败再向用户说明' });
  return { issues, warnings, review: { reviewer: record.reviewer, at: record.at, round, passed: record.items.length - failed.length - decided.length, decided: decided.map(({ id, decidedBy, quote }) => ({ id, decidedBy, quote })), failed: failed.length, openFindings: open ? failed.map(({ id, reason }) => ({ id, reason })) : [] }, strict };
}
