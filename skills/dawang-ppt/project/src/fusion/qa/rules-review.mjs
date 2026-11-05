import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { materializeElements } from '../scene/model.mjs';
import { isRuleContract, isSectionChecklist } from './rule-checklist.mjs';

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
  { id: 'visual#images', rule: '照片先按版面画框、再裁切嵌入是用户确认的做法：照片填满框、与相邻内容上下对齐，比例未变形；裁切掉部分画面不算问题，只有人脸或页面依赖的关键文字被切掉才判 fail，修正写“调整 focal 或换图”，不得要求改成完整显示或缩小；照片缩小后框内留空、与相邻栏不对齐判 fail；图片与旁边的说明逐项对应；页面没有大块无意义空白' }
].map((c) => ({ ...c, status: 'visual' }));

// The user's confirmed house style. It takes precedence over original-rule clauses that forbid cards or rectangles
// (user requests outrank the rules), so the reviewer must not fail these components and the author must not strip them.
export const HOUSE_STYLE = [
  '用户确认的 Dawang 版式（优先于原规则中禁止用卡片/矩形建立层级、要求所有矩形统一圆角等条款）：',
  '- 数字色块：每个数字一个圆角色块，标签在上、数字在下，重点块带强调色竖条，空余处可加线性图标；',
  '- 数据页的“色块＋照片”：指标色块在一栏，照片铺满另一栏；',
  '- 深色侧栏：承载应用链或要点的整块深色区域；',
  '- 照片拼板：色块一侧写字、向照片渐隐过渡（仅用于数据少的页面）；',
  '- 编号方块、流程圆点等导航标记。',
  '这些组件出现时，不得仅因“使用了卡片/矩形/圆角”判 fail；清单中以 user-override 并注明“用户确认的 Dawang 版式”记录的条款，只要页面上的矩形确属上述组件，判 pass。用普通卡片包裹大段正文、或每页套同一卡片墙，仍按原规则判 fail。',
  '用户确认的配色来源：汇报稿以九组汇报配色（蓝金、蓝青、商务金、绿红金、翡翠金、紫金橙、红金、三原色、皓石金）为主选，场景文档自带的配色参考不作主选；配色参考章节以 user-override 并注明此理由时，不得因“未采用场景配色参考”判 fail，只看所选配色在页面上的主色/辅色/跳色分工与对比度是否成立。',
].join('\n');

// only: claim ids to judge this round (a follow-up round re-checks the previous fails).
export function buildReviewPacket({ project, rules, pages, only }) {
  const all = [...reviewClaims(project, rules), ...(isSectionChecklist(project) ? VISUAL_CLAIMS : [])];
  const claims = only ? all.filter((c) => only.has(c.id)) : all;
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
    '- status=visual：按给出的视觉标准逐页看图，任一页明显不符判 fail；reason 写出页码和具体问题（例如“第2页：流程说明与节点错位”）。',
    HOUSE_STYLE,
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
  const failed = record.items.filter((i) => i.verdict === 'fail');
  if (failed.length) report({ kind: 'rules-review-failed', count: failed.length, round: record.round ?? 1, items: failed.map(({ id, status, reason }) => ({ id, status, reason })), hint: '按 reason 改页面后重新 review:rules，同一轮内继续；3 轮仍失败再向用户说明' });
  return { issues, warnings, review: { reviewer: record.reviewer, at: record.at, passed: record.items.length - failed.length, failed: failed.length }, strict };
}
