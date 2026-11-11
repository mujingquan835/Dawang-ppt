import { pageDesignClaims } from '../authoring/page-plan.mjs';
import { hasPageDesignContract, hasSemanticContract } from '../authoring/content-model.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { materializeElements } from '../scene/model.mjs';
import { isRuleContract, isSectionChecklist } from './rule-checklist.mjs';
import { readDecisions, decisionFor } from './user-decisions.mjs';
import { houseStylePrompt } from './house-style.mjs';

// After this many consecutive rounds, legacy findings stop blocking, whereas tiered-review (W4) keeps blockers active
// as needs-revision and only allows advisories to pass with disclosure.
export const MAX_REVIEW_ROUNDS = 3;
export const hasTieredReview = (project) => Boolean(
  hasPageDesignContract(project) ||
  hasSemanticContract(project) ||
  project?.requirements?.reviewContract === 'tiered-review-v1'
);

// Independent review of the production rule checklist. The author fills the checklist; a reviewer with a fresh context
// sees only the page screenshots, an element map, the rule text and the claims, and judges each claim. Publishing
// a new deck needs a review of the current revision with no failed claim. The reviewer never sees the author's
// reasoning, so a stretched mapping (a bar chart offered as a structural diagram) has to survive on the pages alone.
export const REVIEW_FILE = 'rules-review.json';
const VERDICTS = new Set(['pass', 'fail', 'needs-verification']);
const CATEGORIES = new Set(['content', 'render', 'design']);
const SEVERITIES = new Set(['blocker', 'advisory', 'needs-verification']);
const sha256 = (value) => createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
export const checklistHash = (project) => sha256(project.contentPlan?.ruleChecklist ?? null);

export function globalDependencyHash(project) {
  return sha256({
    checklistHash: checklistHash(project),
    designChoice: project?.designChoice ?? null,
    scope: project?.requirements?.scope ?? null,
    slideOrder: project?.editorState?.slideOrder ?? (project?.slides || []).map((s) => s.slideId),
    skippedSlides: project?.editorState?.skippedSlides ?? [],
    deletedSlides: project?.editorState?.deletedSlides ?? []
  });
}

export function pageDependencyHash(project, slideId) {
  const slide = (project?.slides || []).find((s) => s.slideId === slideId);
  if (!slide) return sha256(null);
  const elements = materializeElements(slide, project);
  const pagePlan = (project?.contentPlan?.slides || []).find((p) => p?.slideId === slideId) || null;
  const refs = new Set([
    ...(pagePlan?.requiredRefs || []),
    ...((pagePlan?.regions || []).flatMap((r) => [...(r?.contentRefs || []), ...(r?.relationRefs || [])])),
    ...elements.map((e) => e.contentRef).filter(Boolean)
  ]);
  const nodes = {};
  for (const ref of [...refs].sort()) {
    if (project?.contentPlan?.nodes?.[ref]) nodes[ref] = project.contentPlan.nodes[ref];
  }
  const relations = (project?.contentPlan?.relations || []).filter((r) => refs.has(r?.id));
  const mediaRefs = new Set(elements.map((e) => e.mediaRef || e.src).filter(Boolean));
  const media = (project?.media?.entries || []).filter((m) => mediaRefs.has(m?.mediaId) || mediaRefs.has(m?.src));
  return sha256({
    slideId,
    appearance: slide.appearance ?? null,
    semanticDirtyRefs: slide.semanticDirtyRefs ?? [],
    elements,
    pagePlan,
    nodes,
    relations,
    media
  });
}

export function allPageHashes(project) {
  return Object.fromEntries((project?.slides || []).map((s) => [s.slideId, pageDependencyHash(project, s.slideId)]));
}

export function claimPageIds(claim, project) {
  if (Array.isArray(claim?.pageIds) && claim.pageIds.length) return [...new Set(claim.pageIds)];
  if (typeof claim?.slideId === 'string' && claim.slideId) return [claim.slideId];
  if (typeof claim?.id === 'string' && claim.id.startsWith('page-design#')) {
    const raw = claim.id.slice('page-design#'.length).split('/')[0];
    if (raw) return [decodeURIComponent(raw)];
  }
  if (Array.isArray(claim?.evidence) && claim.evidence.length) {
    const ids = [...new Set(claim.evidence.map((e) => e?.slideId).filter(Boolean))];
    if (ids.length) return ids;
  }
  if (claim?.status === 'not-applicable' || claim?.status === 'user-override') return [];
  return (project?.slides || []).map((s) => s.slideId);
}

export function classifyFinding(item, claim, project) {
  const pageIds = Array.isArray(item?.pageIds) && item.pageIds.length ? [...new Set(item.pageIds)] : claimPageIds(claim, project);
  const regionIds = Array.isArray(item?.regionIds) && item.regionIds.length
    ? [...new Set(item.regionIds)]
    : (claim?.zoneId ? [claim.zoneId] : []);
  const refs = Array.isArray(item?.refs) && item.refs.length
    ? [...new Set(item.refs)]
    : [...new Set([...(claim?.contentRefs || []), ...(claim?.relationRefs || [])])];
  const reason = String(item?.reason ?? '');
  let category = CATEGORIES.has(item?.category) ? item.category : null;
  if (!category) {
    if (/事实|数据|数值|口径|单位|来源|遗漏|缺失|预估|实绩|待确认|关系|返回|闭环|分支|成员/.test(reason)) category = 'content';
    else if (claim?.id === 'visual#alignment' || claim?.id === 'visual#images' || /裁切|溢出|遮挡|重叠|出界|看不清|变形|对比度/.test(reason)) category = 'render';
    else category = 'design';
  }
  let severity = SEVERITIES.has(item?.severity) ? item.severity : null;
  if (item?.verdict === 'pass') severity = 'none';
  else if (item?.verdict === 'needs-verification' || severity === 'needs-verification') severity = 'needs-verification';
  else if (!severity) {
    if (category === 'content' || category === 'render') severity = 'blocker';
    else if (
      (String(claim?.id || '').startsWith('scenario#Directions') || /可选|建议|偏好|装饰|润色|更精致|微调/.test(reason)) &&
      !/阅读任务|看不出|主次不清|勉强对应|缺乏结构/.test(reason)
    ) severity = 'advisory';
    else severity = 'blocker';
  }
  const suggestedAction = item?.suggestedAction || (
    item?.verdict === 'pass' ? 'none'
      : category === 'content' ? 'return-to-content-model'
      : category === 'render' ? 'return-to-capacity-layout'
      : severity === 'advisory' ? 'local-polish-or-user-decision'
      : 'return-to-page-design'
  );
  return {
    id: item.id,
    verdict: item.verdict === 'needs-verification' ? 'fail' : item.verdict,
    status: claim?.status ?? item?.status,
    category,
    severity,
    pageIds,
    regionIds,
    refs,
    reason,
    suggestedAction
  };
}

// Strict structured output needs every property listed in `required`, so optional fields are nullable; normalizeVerdict fills nulls in.
const nullableStrings = { type: ['array', 'null'], items: { type: 'string' } };
export const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: { items: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['id', 'verdict', 'reason', 'category', 'severity', 'pageIds', 'regionIds', 'refs', 'suggestedAction'],
    properties: {
      id: { type: 'string' },
      verdict: { type: 'string', enum: ['pass', 'fail', 'needs-verification'] },
      reason: { type: 'string' },
      category: { type: ['string', 'null'], enum: ['content', 'render', 'design', null] },
      severity: { type: ['string', 'null'], enum: ['blocker', 'advisory', 'needs-verification', null] },
      pageIds: nullableStrings,
      regionIds: nullableStrings,
      refs: nullableStrings,
      suggestedAction: { type: ['string', 'null'] }
    }
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
  { id: 'visual#takeaways', rule: '重点被提出来：只看标题、模块标签和加粗文字，能说出本页的逻辑（问题、动作、结果、判断等）；不是整页同一字号的句子，也不是没有标签的段落堆叠。封面、目录等过渡页不适用' },
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
    '- 原材料本身没有提供的信息（如统计时间、口径、来源）不能要求制作者补造：页面不必标注“待补/未提供”，以“材料未提供”记为 not-applicable 即判 pass，不要求用户确认字样；只有页面把缺失信息写成确定事实，或明明材料里有却没用，才判 fail。\n- 来源写“用户授权补写”、status 为 estimated 的内容是用户允许先写上、之后自己修改的，不判事实漂移，页面也不必标注“建议”。数字写成 XX 是留给用户填写的占位，不判内容缺失或数字错误。\n- 来源写“制作者展开”的用途或效果说明，以及从原句提炼的短标签、模块名，不判事实漂移；但其中出现材料没有的数字、案例、人名判 fail。',
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
export function normalizeVerdict(verdict, claims, project = null) {
  const items = Array.isArray(verdict?.items) ? verdict.items : [];
  const byId = new Map(items.filter((i) => VERDICTS.has(i?.verdict)).map((i) => [i.id, i]));
  const missing = claims.filter((c) => !byId.has(c.id)).map((c) => c.id);
  if (missing.length) throw new Error('复核结果缺少条目：' + missing.join('，'));
  return claims.map((c) => {
    const raw = byId.get(c.id);
    if (!project || !hasTieredReview(project)) {
      return { id: raw.id, verdict: raw.verdict === 'needs-verification' ? 'fail' : raw.verdict, reason: String(raw.reason ?? ''), status: c.status };
    }
    return classifyFinding(raw, c, project);
  });
}

export function inspectReviewScope(project, record) {
  const slideIds = (project?.slides || []).map((s) => s.slideId);
  const currentGlobal = globalDependencyHash(project);
  const currentPages = allPageHashes(project);
  const globalChanged = record?.globalHash
    ? record.globalHash !== currentGlobal
    : record?.checklistHash !== checklistHash(project);
  const invalidatedSlideIds = globalChanged || !record?.pageHashes
    ? [...slideIds]
    : slideIds.filter((id) => record.pageHashes[id] !== currentPages[id]);
  const invalidatedSet = new Set(invalidatedSlideIds);
  const reusableSlideIds = slideIds.filter((id) => !invalidatedSet.has(id));
  const items = Array.isArray(record?.items) ? record.items : [];
  const reusableItems = [];
  const staleItems = [];
  for (const item of items) {
    const itemPages = Array.isArray(item?.pageIds) ? item.pageIds : slideIds;
    const touchesInvalidSlide = itemPages.some((id) => invalidatedSet.has(id));
    if (!globalChanged && item?.verdict === 'pass' && item?.severity !== 'needs-verification' && !touchesInvalidSlide) {
      reusableItems.push(item);
    } else {
      staleItems.push(item);
    }
  }
  return {
    globalChanged,
    invalidatedSlideIds,
    reusableSlideIds,
    reusableClaimIds: reusableItems.map((i) => i.id),
    staleClaimIds: staleItems.map((i) => i.id),
    reusableItems,
    staleItems
  };
}

export function writeReview(workspaceDir, project, { reviewer, items, claims = [] }) {
  const file = path.join(workspaceDir, REVIEW_FILE);
  // Rounds count consecutive reviews of this workspace; a pass resets the count for later edits.
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first review */ }
  const tiered = hasTieredReview(project);
  const claimById = new Map((claims || []).map((c) => [c.id, c]));
  const normalizedItems = items.map((item) => {
    if (!tiered && !item.category && !item.severity && !item.pageIds) return item;
    return classifyFinding(item, claimById.get(item.id) || item, project);
  });
  const passedBefore = previous && previous.items?.every((i) => i.verdict === 'pass' || i.severity === 'advisory');
  const round = previous && !passedBefore ? (previous.round || 1) + 1 : 1;
  const record = {
    revision: project.revision,
    checklistHash: checklistHash(project),
    globalHash: globalDependencyHash(project),
    pageHashes: allPageHashes(project),
    reviewer,
    at: new Date().toISOString(),
    round,
    items: normalizedItems
  };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return record;
}

export function reviewGate(project, workspaceDir) {
  const strict = isRuleContract(project) || hasTieredReview(project), issues = [], warnings = [];
  const tiered = hasTieredReview(project);
  const report = (record) => (strict ? issues : warnings).push(record);
  if (!project.contentPlan?.ruleChecklist) return { issues, warnings, review: null, strict, releaseStatus: 'ready' };
  const file = workspaceDir && path.join(workspaceDir, REVIEW_FILE);
  const hint = '正常步骤，不是失败：同一轮内运行 review:rules <工程目录>，通过后 publish:html，不要先向用户汇报';
  if (!file || !fs.existsSync(file)) {
    report({ kind: 'rules-review-missing', hint });
    return { issues, warnings, review: null, strict, releaseStatus: 'validating' };
  }
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scope = inspectReviewScope(project, record);
  if (record.revision !== project.revision || record.checklistHash !== checklistHash(project) || scope.globalChanged || scope.invalidatedSlideIds.length > 0) {
    report({
      kind: 'rules-review-stale',
      reviewedRevision: record.revision,
      revision: project.revision,
      globalChanged: scope.globalChanged,
      invalidatedSlideIds: scope.invalidatedSlideIds,
      reusableSlideIds: scope.reusableSlideIds,
      staleClaimIds: scope.staleClaimIds,
      reusableClaimIds: scope.reusableClaimIds,
      hint
    });
    return { issues, warnings, review: null, strict, scope, releaseStatus: 'validating' };
  }
  if (!tiered) {
    // Legacy behavior: after MAX_REVIEW_ROUNDS, remaining fails become rules-review-open warnings.
    const decided = [], failed = [];
    for (const i of record.items.filter((x) => x.verdict === 'fail')) {
      const d = decisionFor(project, { id: i.id });
      (d ? decided : failed).push(d ? { ...i, decidedBy: d.id, quote: d.quote } : i);
    }
    const round = record.round ?? 1, open = failed.length && round >= MAX_REVIEW_ROUNDS;
    if (open) warnings.push({ kind: 'rules-review-open', round, items: failed.map(({ id, status, reason }) => ({ id, status, reason })), hint: `已复核 ${round} 轮仍有意见：可以发布，但交付回复里必须逐条列出这些意见，请用户决定是否修改；用户明确接受的，写入 requirements.userDecisions` });
    if (failed.length && !open) report({ kind: 'rules-review-failed', count: failed.length, round: record.round ?? 1, items: failed.map(({ id, status, reason }) => ({ id, status, reason })), hint: '按 reason 改页面后重新 review:rules，同一轮内继续；3 轮仍失败再向用户说明' });
    return {
      issues,
      warnings,
      review: {
        reviewer: record.reviewer,
        at: record.at,
        round,
        passed: record.items.length - failed.length - decided.length,
        decided: decided.map(({ id, decidedBy, quote }) => ({ id, decidedBy, quote })),
        failed: failed.length,
        openFindings: open ? failed.map(({ id, reason }) => ({ id, reason })) : []
      },
      strict,
      releaseStatus: failed.length && !open ? 'needs-revision' : 'ready'
    };
  }

  // W4 Tiered Review: classify findings into blockers (content/render/core design or needs-verification) vs advisories.
  // Blockers NEVER auto-pass after MAX_REVIEW_ROUNDS; advisories warn and allow publishing as ready.
  const decided = [], blockers = [], advisories = [];
  for (const raw of record.items.filter((x) => x.verdict === 'fail' || x.verdict === 'needs-verification')) {
    const item = raw.category && raw.severity ? raw : classifyFinding(raw, raw, project);
    const d = decisionFor(project, { id: item.id });
    if (d) decided.push({ ...item, decidedBy: d.id, quote: d.quote });
    else if (item.severity === 'advisory') advisories.push(item);
    else blockers.push(item);
  }
  const round = record.round ?? 1;
  const exhausted = round >= MAX_REVIEW_ROUNDS;
  if (advisories.length) {
    warnings.push({
      kind: 'rules-review-advisory',
      round,
      items: advisories.map(({ id, status, category, severity, pageIds, reason, suggestedAction }) => ({ id, status, category, severity, pageIds, reason, suggestedAction })),
      hint: '纯审美或可选精致度建议不阻断发布，但交付回复中应单独列出供用户参考'
    });
  }
  if (blockers.length) {
    report({
      kind: exhausted ? 'rules-review-blocker-unresolved' : 'rules-review-failed',
      count: blockers.length,
      round,
      releaseStatus: 'needs-revision',
      items: blockers.map(({ id, status, category, severity, pageIds, regionIds, refs, reason, suggestedAction }) => ({
        id, status, category, severity, pageIds, regionIds, refs, reason, suggestedAction
      })),
      hint: exhausted
        ? `已复核 ${round} 轮仍有 ${blockers.length} 项阻断问题（内容/关系/渲染裁切/阅读任务），状态保持 needs-revision，禁止覆盖正式交付文件；可输出 review-draft 供用户查看`
        : '按 reason 与 suggestedAction 返工后重新 review:rules'
    });
  }
  const releaseStatus = blockers.length ? 'needs-revision' : 'ready';
  return {
    issues,
    warnings,
    review: {
      reviewer: record.reviewer,
      at: record.at,
      round,
      releaseStatus,
      passed: record.items.length - blockers.length - advisories.length - decided.length,
      decided: decided.map(({ id, decidedBy, quote }) => ({ id, decidedBy, quote })),
      failed: blockers.length,
      blockers: blockers.map(({ id, category, severity, pageIds, reason, suggestedAction }) => ({ id, category, severity, pageIds, reason, suggestedAction })),
      advisories: advisories.map(({ id, category, severity, pageIds, reason, suggestedAction }) => ({ id, category, severity, pageIds, reason, suggestedAction })),
      openFindings: []
    },
    strict,
    scope,
    releaseStatus
  };
}
