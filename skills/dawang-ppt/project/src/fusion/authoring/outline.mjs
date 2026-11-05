import { validateContentModel } from './content-model.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Content outline for work reports and performance reviews (工作汇报、述职、复盘、阶段总结). The agent writes it from the
// user's raw material before any layout; outline:check lists what is missing and what each gap costs, so the user
// decides whether to supply it or generate with what exists. It never decides that for the user.
// scope: 'part' (default) is a section or a few pages someone asked AI to make; only page-level gaps count, and a
// clean check means no question at all. 'full' is a complete report or review deck the user asked for; only then are
// deck-level pieces (overall verdict, issues, next steps) required.
//
// {
//   kind: 'report' | 'review',            // 工作汇报/复盘 | 述职
//   scope: 'part' | 'full',               // 一部分页面（默认） | 完整汇报/述职
//   title, audience, period, owner,
//   pages: [{ id, role, keyLine: { text, source: 'quoted'|'distilled'|'created' },
//             data: [{ label, value, unit, period?, note?, target? }], items: [{ title, detail }],
//             compare: { left: [{ title, detail }], right: [...] } (rows pair up), periods: [{ label, title, points }],
//             flows: [{ title, steps: [] }] (process steps), chains: [{ title, steps: [] }] (application paths),
//             table: { columns: [], rows: [[]] }, photos: [{ src, caption }] }]
// }
// role: summary 整体结论 | results 成果数据 | actions 关键动作 | resources 资源/支持 | issues 问题差距 | causes 原因复盘
//       | plan 下一步 | asks 需支持/决策 | duties 职责定位（述职） | other

export const ROLES = ['summary', 'results', 'actions', 'resources', 'issues', 'causes', 'plan', 'asks', 'duties', 'other'];

// What a reader of each kind of deck needs, and what a missing piece costs. Kept short and specific to reports.
const NEEDS = {
  report: [
    { role: 'summary', ask: '整体结论：本期整体状态、核心成果或与目标的差距（一句话）', impact: '首页只能罗列工作安排，领导看不出整体完成得怎样' },
    { role: 'results', ask: '成果数据：带单位和统计时期的关键数字', impact: '成果只能用文字描述，缺少可比较的证据' },
    { role: 'issues', ask: '问题与差距：未达成项、风险或不足', impact: '只有成绩没有问题，汇报显得不客观，领导无法判断风险' },
    { role: 'plan', ask: '下一步计划：时间、动作和负责人', impact: '结尾落不到行动，汇报停在回顾' },
    { role: 'asks', ask: '需要的支持或待决策事项', impact: '无法提出需要领导拍板或协调的事项', optional: true }
  ],
  review: [
    { role: 'duties', ask: '岗位职责与定位：负责什么、服务谁', impact: '评委不清楚业绩对应的职责范围' },
    { role: 'results', ask: '个人业绩数据：带单位、时期和个人贡献说明的数字', impact: '业绩只能泛泛描述，无法证明个人贡献' },
    { role: 'issues', ask: '不足与反思', impact: '缺少自我认知，述职显得只报喜不报忧' },
    { role: 'plan', ask: '下一阶段目标与计划', impact: '缺少对未来的承诺，述职收尾无力' },
    { role: 'summary', ask: '整体自评：一句话总结本期表现', impact: '开头缺少定调，评委需要自己归纳', optional: true }
  ]
};

const ACTION_ONLY = /^(?:[^\d%，。；：]*?(?:梳理|推进|开展|完成|落实|组织|负责|协助|配合|做好|加强|持续)[^\d%]*)$/;
const hasNumber = (s) => /\d/.test(s || '');

export function checkOutline(outline, { baseDir = process.cwd() } = {}) {
  const gaps = [], warnings = [], suggestions = [];
  const kind = ['proposal','report','review','training','other'].includes(outline.kind) ? outline.kind : 'report', full = outline.scope === 'full';
  const pages = Array.isArray(outline.pages) ? outline.pages : [];
  if (!pages.length) gaps.push({ level: 'deck', item: 'pages', ask: '至少一页内容', impact: '无法制作' });
  const hasData = pages.some((p) => (p.data || []).length);
  if (hasData && !outline.period && !pages.some((p) => (p.data || []).some((d) => d.period))) {
    // Only a complete deck asks for the period; a partial job notes it on the page instead of asking.
    (full ? gaps : warnings).push({ level: 'deck', item: 'period', ask: '统计时期（年份、季度或起止日期）', impact: '数字的时间口径不明，领导无法判断是哪个周期的成绩' });
  }
  const roles = new Set(pages.map((p) => p.role));
  for (const need of full ? (NEEDS[kind] || []) : []) {
    if (roles.has(need.role)) continue;
    // A summary may live in the first page's key line instead of its own page.
    if (need.role === 'summary' && pages[0]?.keyLine?.text && hasNumber(pages[0].keyLine.text)) continue;
    (need.optional ? warnings : gaps).push({ level: 'deck', item: need.role, ask: need.ask, impact: need.impact });
  }
  pages.forEach((p, i) => {
    const where = { level: 'page', page: p.id || `p${i + 1}` };
    if (!ROLES.includes(p.role)) warnings.push({ ...where, item: 'role', ask: `role 取 ${ROLES.join(' / ')}` });
    const key = p.keyLine?.text?.trim();
    if (!key) gaps.push({ ...where, item: 'keyLine', ask: '这一页要让读者记住的结论', impact: '页面没有重点，只能平铺信息' });
    else if (['report','review'].includes(kind) && !hasNumber(key) && ACTION_ONLY.test(key)) warnings.push({ ...where, item: 'keyLine', ask: '重点句只是动作罗列，改成结果或状态（最好带数字）', impact: '标题看不出做成了什么' });
    for (const d of p.data || []) {
      if (!d.unit && !/[%％]/.test(String(d.value))) warnings.push({ ...where, item: 'unit', ask: `「${d.label}」的单位`, impact: '数字无法读懂' });
    }
    if (p.role === 'results' && !(p.data || []).length) gaps.push({ ...where, item: 'data', ask: '这一页成果对应的数字', impact: '成果页没有数据支撑' });
    for (const ph of p.photos || []) {
      const file = path.resolve(baseDir, ph.src || '');
      if (!ph.src || !fs.existsSync(file)) warnings.push({ ...where, item: 'photo', ask: `照片文件不存在：${ph.src}` });
    }
    // Report structure hiding in labels: targets and year-on-year pairs belong in their own fields, so the
    // report page types (target vs actual, side-by-side comparison) can be suggested.
    const said = [p.keyLine?.text, ...(p.data || []).flatMap((d) => [d.label, d.note]), ...(p.items || []).flatMap((it) => [it.title, it.detail])].filter(Boolean).join(' ');
    if (p.role !== 'plan' && /目标|计划(值|完成|指标)|预期/.test(said) && !(p.data || []).some((d) => d.target != null)) warnings.push({ ...where, item: 'target', ask: '材料提到目标/计划：把目标值写进 data[].target（与实际值成对），可用 targetVsActual 页型', impact: '目标与实际分散在文字里，读者要自己对比' });
    if (/去年|上期|同比|环比|上半年|对比/.test(said) && !p.compare && !p.table?.rows?.length && !(p.data || []).some((d) => d.target != null)) warnings.push({ ...where, item: 'compare', ask: '材料有今年/去年或前后对照：成对内容写进 compare:{left,right}，数字对比写进 data[].target 或表格', impact: '对照关系没有结构，页面只能平铺' });
    if ((p.photos || []).length >= 2 && !(p.items || []).length) warnings.push({ ...where, item: 'items', ask: '这页有多张照片但没写事项：把每张照片对应的动作/资源写进 items（与 photos 同序、同数量），页型会把照片放在对应事项下', impact: '照片和内容对不上，读者分不清哪张图说明哪件事' });
    suggestions.push({ ...where, pattern: suggestPattern(p), why: suggestReason(p), components: suggestComponents(p) });
  });
  const contentIssues = validateContentModel(outline);
  const blocking = gaps.length > 0 || contentIssues.length > 0;
  return { ok: !blocking, kind, scope: full ? 'full' : 'part', gaps, warnings, suggestions, contentIssues,
    decision: contentIssues.length ? '内容契约不完整：制作智能体先修正 contentIssues，不把内部结构缺失当作用户材料缺口。' : blocking ? '只问一次：在同一条回复里列出 gaps（缺什么、为什么需要、缺了会怎样），请用户选择补充材料或按现有材料生成（页面标注“材料未提供”）。由用户决定。'
      : '没有需要用户决定的缺口：不要为内容再提问，直接进入配色与制作；warnings 在页面上如实处理即可。' };
}

// Data comes before pictures: several figures go into metric tiles even when photos exist.
export function suggestPattern(p) {
  const nData = (p.data || []).length, nPhotos = (p.photos || []).length, nItems = (p.items || []).length;
  if (p.table?.rows?.length) return (p.flows || []).length ? 'tableWithFlows' : (p.chains || []).length ? 'tableWithPanel' : 'free';
  // Report shapes: targets beside results, two sides that pair row by row, work laid out by period.
  if (nData >= 2 && (p.data || []).filter((d) => d.target != null).length >= 2) return 'targetVsActual';
  if (p.compare?.left?.length && p.compare.left.length === p.compare.right?.length) return 'contrastColumns';
  if ((p.periods || []).length >= 3) return 'periodColumns';
  // Photos that each belong to one item go under that item, so the reader matches 1, 2, 3 to their pictures.
  // A figure per item (or photos that do not match the items one to one) go in rows: each item's figure beside it,
  // photos aligned to the rows.
  if (nItems >= 2 && nItems <= 5 && (nData === nItems || (nPhotos >= 2 && nPhotos !== nItems))) return 'itemRows';
  // Little text and almost no data keeps the confirmed photo panels; items with details or figures get a column each.
  const brief = (p.items || []).every((it) => String(it.detail || '').length <= 30 && !/\d/.test(String(it.detail || '')));
  if (nPhotos >= 2 && nItems === nPhotos) return nData <= 1 && brief ? 'photoPanels' : 'itemsWithPhotos';
  if (nData >= 2 && nPhotos >= 2) return 'listWithPhotos';
  if (nData >= 2 && nPhotos === 1) return 'metricsWithEvidence';
  if (nData >= 2) return 'metricTiles';
  if (nPhotos >= 2 && nData <= 1 && nItems <= 4) return 'photoPanels';
  if ((p.flows || []).length >= 2) return 'twoLaneFlow';
  return 'free';
}
function suggestReason(p) {
  const nData = (p.data || []).length, nPhotos = (p.photos || []).length;
  if (suggestPattern(p) === 'targetVsActual') return '有目标值：计划与实际同列对照，深色块给出整体完成度';
  if (suggestPattern(p) === 'contrastColumns') return '两侧逐项成对（亮点/待改进、问题/改进）：左右对照、中间编号连起每一对';
  if (suggestPattern(p) === 'itemRows') return '每项一行：该项数据放在同一行右端的色块，照片与各行对齐；照片对不上时成组排列，不暗示逐项对应';
  if (suggestPattern(p) === 'itemsWithPhotos') return '每项一张对应照片：每项一栏，照片在该项正下方，编号与照片一一对应';
  if (suggestPattern(p) === 'periodColumns') return '按时期展开：箭头色带分段，每期一栏，底部汇总';
  if (nData >= 2 && nPhotos) return `${nData} 个数字优先进色块，${nPhotos} 张照片作证据`;
  if (nData >= 2) return `${nData} 个数字用色块并列`;
  if (nPhotos >= 2) return '数据少、照片多，可用色块与照片渐隐拼板';
  if (p.table?.rows?.length && (p.flows || []).length) return '分工表加流程色带';
  if (p.table?.rows?.length && (p.chains || []).length) return '明细表加深色侧栏应用链';
  if (p.table?.rows?.length) return '逐行明细用表格';
  return '按内容自由组合排版工具';
}

// Report components by page role and the relationships the words describe (target vs actual, before vs after, a time
// sequence), never by how many figures there are: the template these come from only shows layout logic, its numbers
// are placeholders. Each page should be carried by at least one of them; see references/fusion/report-layout-logic.md.
const TIME = /[0-9一二三四五六七八九十]+月|季度|Q[1-4]|阶段|周[一二三四五六日]?|上半年|下半年|节点|前后|之前|之后|启动|落地/;
const BEFORE_AFTER = /去年|上期|上年|同比|环比|对比|此前|之前|提升|下降|增长|降至|升至|→/;
const TARGET = /目标|计划(值|完成|指标)|预期|达成|完成率/;
export function suggestComponents(p) {
  const said = [p.keyLine?.text, ...(p.data || []).flatMap((d) => [d.label, d.note, d.period]), ...(p.items || []).flatMap((it) => [it.title, it.detail]), ...(p.periods || []).map((x) => x.label)].filter(Boolean).join(' ');
  const out = [], add = (name, why) => { if (!out.some((c) => c.name === name)) out.push({ name, why }); };
  const photos = (p.photos || []).length, timeline = TIME.test(said) || (p.periods || []).length > 0;
  switch (p.role) {
    case 'summary':
      add('answerBlock', '整体结论页用一块实心主色装本页答案');
      if (TARGET.test(said) || (p.data || []).some((d) => d.target != null)) add('comparePair', '目标 → 实际，放在答案块旁');
      else if (BEFORE_AFTER.test(said)) add('comparePair', '去年/之前 → 今年/之后');
      break;
    case 'results':
      add('kpiStrip', '成果指标带：整体数字进左端实心块，其余指标并排');
      if (TARGET.test(said) || (p.data || []).some((d) => d.target != null)) add('targetVsActual', '目标与实际同列对照');
      if (BEFORE_AFTER.test(said)) add('comparePair', '本期对上期');
      break;
    case 'actions': case 'resources':
      if (photos >= 2) add('itemsWithPhotos', '每项一栏，照片在该项正下方');
      if (timeline) add('periodBand', '按时间推进：时期色带分段，每段下写动作');
      add('highlightTile', '并列几项时，只把最关键的一项整块反白（metricTiles highlightStyle:solid）');
      break;
    case 'issues': case 'causes':
      add('contrastPair', p.role === 'causes' ? '问题 vs 原因（或做法 vs 结果）左右对照' : '现状/问题 vs 改进左右对照');
      break;
    case 'plan':
      add(timeline ? 'periodColumns' : 'answerBlock', timeline ? '按时期展开：箭头色带，每期一栏' : '下一阶段的核心目标放进答案块');
      break;
    case 'asks':
      add('sidePanel', '需审批/支持事项放深色侧栏：关键数字＋编号事项');
      break;
    case 'duties':
      add('answerBlock', '岗位定位放答案块，职责用编号列表');
      break;
    default:
      add('answerBlock', '用一块实心主色装本页答案');
  }
  return out;
}
