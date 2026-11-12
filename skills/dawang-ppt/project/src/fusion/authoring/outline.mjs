import { validateContentModel } from './content-model.mjs';
import { outlineBaselineIssues } from './outline-baseline.mjs';
import { ICONS } from './icons.mjs';
import { wordingWarnings } from './wording.mjs';
import { periodRange } from './report-kit.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Content outline for work reports and performance reviews (工作汇报、述职、复盘、阶段总结). The agent writes it from the
// user's raw material before any layout. outline:check never stops the first version: it lists the relations the
// material leaves open (is this number good, which action produced this result, who owns this step), so the agent can
// draft them when the user allowed it and explain the rest in plain words at delivery.
// scope: 'part' (default) is a section or a few pages someone asked AI to make; only page-level relations count.
// 'full' is a complete report or review deck; only then are deck-level pieces (overall verdict, issues, next steps) listed.
//
// {
//   kind: 'report' | 'review',            // 工作汇报/复盘 | 述职
//   scope: 'part' | 'full',               // 一部分页面（默认） | 完整汇报/述职
//   title, audience, period, owner,
//   pages: [{ id, role, keyLine: { text, source: 'quoted'|'distilled'|'created' },
//             data: [{ label, value, unit, period?, note?, target?, icon? }], items: [{ title, detail }],
//             statements: [{ id, label, text }] (labelled sentences: 业务问题、复盘判断),
//             compare: { leftLabel, rightLabel, left: [{ title, detail }], right: [...], current?: 'left' | 'right', paired?: false, badge? } (rows pair up when the counts match; the same titles with figures on both sides read as before → after), periods: [{ label, title, points, lane?, span? }] (lane: 并行的项目或负责方；span: label 不是日期时写日期，如 8月上旬—9月中旬),
//             flows: [{ title, steps: [] }] (process steps), chains: [{ title, steps: [] }] (application paths),
//             table: { columns: [], rows: [[]] }, tables: [{ title, columns, rows, highlight, from }], photos: [{ src, caption }] }]
// }
// role: summary 整体结论 | results 成果数据 | actions 关键动作 | resources 资源/支持 | issues 问题差距 | causes 原因复盘
//       | plan 下一步 | asks 需支持/决策 | duties 职责定位（述职） | other

export const ROLES = ['cover', 'summary', 'results', 'actions', 'resources', 'issues', 'causes', 'plan', 'asks', 'duties', 'other'];

// What a reader of each kind of deck needs. Each entry is the relation the reader cannot follow without it, in the
// reader's words. draftable: 'text' can be written outright when the user allows drafting; 'number' goes in as XX.
const ABSENT = '按现有内容排版，不下没有依据的判断，交付时说明';
const NEEDS = {
  report: [
    { role: 'summary', relation: '多页事实→总判断', question: '这一期整体算完成得怎样？', whyItMatters: '各页只是分别列事实，领导要自己归纳整体状态', ask: '一句话整体判断，最好带完成度。例如：三季度签约 48 单，完成目标的 96%', afterFill: '首页先给结论，再列支撑数字', draftable: 'text' },
    { role: 'results', relation: '动作→成果', question: '这些工作最后做成了多少？', whyItMatters: '成果只能用文字描述，缺少可比较的证据', ask: '带单位和时期的关键数字。例如：新签 20 单、续费 12 万元（2026 年 Q3）', afterFill: '增加成果页，用指标色块呈现', draftable: 'number' },
    { role: 'issues', relation: '成果↔差距', question: '哪里没做到，风险在哪？', whyItMatters: '只有成绩没有问题，领导无法判断风险', ask: '未达成项、风险或不足。例如：差 2 单未达标，问题集中在新客转化', afterFill: '增加问题差距页，和成果形成对照', draftable: 'text' },
    { role: 'plan', relation: '问题→下一步', question: '接下来打算怎么做？', whyItMatters: '结尾落不到行动，汇报停在回顾', ask: '时间、动作和负责人。例如：10 月底前建立 48 小时回访，负责人张三', afterFill: '增加下一步页，按时间展开', draftable: 'text' },
    { role: 'asks', ask: '需要的支持或待决策事项', impact: '无法提出需要领导拍板或协调的事项', optional: true }
  ],
  review: [
    { role: 'duties', relation: '职责→业绩', question: '这些业绩对应你负责的什么？', whyItMatters: '评委不清楚业绩对应的职责范围', ask: '岗位职责与定位。例如：负责天津二手房线市场支持，服务 100 家门店', afterFill: '增加职责定位页，让业绩有参照', draftable: 'text' },
    { role: 'results', relation: '职责→业绩', question: '你这一期做成了多少？', whyItMatters: '业绩只能泛泛描述，无法证明个人贡献', ask: '带单位、时期和个人贡献的数字。例如：主导活动带来新签 20 单', afterFill: '增加业绩页，用指标色块呈现', draftable: 'number' },
    { role: 'issues', relation: '业绩↔不足', question: '哪里还做得不够？', whyItMatters: '缺少自我认知，述职显得只报喜不报忧', ask: '不足与反思。例如：数据复盘偏慢，下季度改为周复盘', afterFill: '增加反思页，和业绩形成对照', draftable: 'text' },
    { role: 'plan', relation: '不足→下一步', question: '下一阶段要达成什么？', whyItMatters: '缺少对未来的承诺，述职收尾无力', ask: '下一阶段目标与计划。例如：Q4 目标签约 55 单', afterFill: '增加计划页，收在目标上', draftable: 'text' },
    { role: 'summary', ask: '整体自评：一句话总结本期表现', impact: '开头缺少定调，评委需要自己归纳', optional: true }
  ]
};

const ACTION_ONLY = /^(?:[^\d%，。；：]*?(?:梳理|推进|开展|完成|落实|组织|负责|协助|配合|做好|加强|持续)[^\d%]*)$/;
// XX is the visible placeholder for a figure the user will fill in, so it counts as a number.
const hasNumber = (s) => /\d|XX/.test(s || '');
const pageText = (p) => [p.keyLine?.text, ...(p.statements || []).flatMap((st) => [st.label, st.text]), ...(p.data || []).flatMap((d) => [d.label, d.note, d.period]), ...(p.items || []).flatMap((it) => [it.title, it.detail]), ...(p.periods || []).flatMap((x) => [x.label, x.title, ...(x.points || [])]), ...(p.table?.columns || []), ...(p.table?.rows || []).flat(), ...['left', 'right'].flatMap((side) => (p.compare?.[side] || []).flatMap((it) => [it.title, it.detail]))].filter(Boolean).join(' ');
const pageHas = (p) => {
  const data = (p.data || []).slice(0, 3).map((d) => `${d.label} ${d.value}${d.unit ? ' ' + d.unit : ''}`), items = (p.items || []).slice(0, 3).map((it) => it.title);
  return [...data, ...items].filter(Boolean).join('、') || p.keyLine?.text || '本页内容';
};

// Candidates only: structure can show a relation is absent from the outline, but whether the material really lacks it
// is the agent's call after reading it. Wording-level relations the structure cannot see are the agent's to add.
function pageRelationGaps(p, where, { kind, roles }) {
  if (!['report', 'review'].includes(kind)) return [];
  const out = [], said = pageText(p), have = pageHas(p), hasData = (p.data || []).length > 0;
  const add = (gap) => out.push({ ...where, have, fallback: ABSENT, ...gap });
  if (p.role === 'results' && !hasData) add({ item: 'data', relation: '动作→成果', question: '这一页的成果有多大？', whyItMatters: '成果页没有数字，读者比较不了', ask: '这一页成果对应的数字。例如：收集喜报 150 份', afterFill: '成果用指标色块呈现', draftable: 'number' });
  if (['results', 'summary'].includes(p.role) && hasData && !p.compare && !p.table?.rows?.length && !(p.data || []).some((d) => d.target != null) && !TARGET.test(said) && !BEFORE_AFTER.test(said)) add({ item: 'target', relation: '实际↔目标', question: `${p.data[0].label} ${p.data[0].value}${p.data[0].unit ? ' ' + p.data[0].unit : ''}算好还是差？`, whyItMatters: '只有实际数，没有目标或上期作比较，领导没法判断', ask: `目标值或上期数。例如：目标 XX ${p.data[0].unit || ''}`.trim(), afterFill: '改成目标与实际同列对照，并给出完成度', draftable: 'number' });
  if (p.role === 'actions' && !hasData && !hasNumber(said)) add({ item: 'result', relation: '动作→结果', question: '这些动作带来了什么结果？', whyItMatters: '只看得到做了什么，看不到做成了什么', ask: '动作对应的结果或数字。例如：案例传播带来新签 20 单', afterFill: '每个动作和它的结果同行对应', draftable: 'number' });
  if (p.role === 'issues' && !p.compare) {
    if (!roles.has('causes') && !/因为|由于|原因|导致|源于|归因/.test(said)) add({ item: 'cause', relation: '问题→原因', question: '这些问题为什么会发生？', whyItMatters: '只列现象，领导不知道是偶发还是结构性问题', ask: '每个问题的主要原因。例如：新客转化低是因为回访超过 72 小时', afterFill: '改成问题与原因左右对照', draftable: 'text' });
    if (!roles.has('plan') && !/改进|措施|解决|下一步/.test(said)) add({ item: 'measure', relation: '问题→措施', question: '这些问题打算怎么解决？', whyItMatters: '问题提出来却没有回应，汇报停在暴露问题', ask: '对应的改进措施。例如：建立 48 小时回访机制', afterFill: '每个问题对应一条措施', draftable: 'text' });
  }
  if (p.role === 'plan') {
    const noTime = !(p.periods || []).length && !TIME.test(said), noOwner = !/负责人|责任人|牵头|负责/.test(said);
    if (noTime || noOwner) add({ item: 'owner-time', relation: '措施→负责人与时间', question: noTime && noOwner ? '这些事由谁在什么时候完成？' : noTime ? '这些事什么时候完成？' : '这些事由谁负责？', whyItMatters: '计划落不到人和时间，领导无法跟进', ask: '时间节点和负责人。例如：10 月底前，负责人张三', afterFill: '按时间展开，每项标明负责人', draftable: 'number' });
  }
  if (kind === 'review' && p.role === 'results' && !/主导|牵头|独立|本人|个人|我负责/.test(said)) add({ item: 'contribution', relation: '业绩→个人贡献', question: '这些业绩里哪些是你本人的贡献？', whyItMatters: '评委分不清团队成绩和个人贡献', ask: '你在其中做了什么。例如：主导活动策划，带来新签 20 单', afterFill: '业绩旁写明个人角色', draftable: 'text' });
  return out;
}



export function checkOutline(outline, { baseDir = process.cwd() } = {}) {
  const gaps = [], relationGaps = [], warnings = [], suggestions = [];
  const kind = ['proposal','report','review','training','other'].includes(outline.kind) ? outline.kind : 'report', full = outline.scope === 'full';
  const pages = Array.isArray(outline.pages) ? outline.pages : [];
  if (!pages.length) gaps.push({ level: 'deck', item: 'pages', ask: '至少一页内容', impact: '无法制作' });
  const hasData = pages.some((p) => (p.data || []).length);
  if (hasData && !outline.period && !pages.some((p) => (p.data || []).some((d) => d.period))) {
    // Only a complete deck lists the period as a relation; a partial job just notes it.
    if (full) relationGaps.push({ level: 'deck', item: 'period', relation: '数字→统计时期', have: '各页已有数字', question: '这些数字是哪个时期的？', whyItMatters: '时间口径不明，领导无法判断是哪个周期的成绩', ask: '统计时期。例如：2026 年第三季度', afterFill: '页头和指标统一标明时期', draftable: 'number', fallback: ABSENT });
    else warnings.push({ level: 'deck', item: 'period', ask: '统计时期（年份、季度或起止日期）', impact: '数字的时间口径不明' });
  }
  const roles = new Set(pages.map((p) => p.role));
  for (const need of full ? (NEEDS[kind] || []) : []) {
    if (roles.has(need.role)) continue;
    // A summary may live in the first page's key line instead of its own page.
    if (need.role === 'summary' && pages[0]?.keyLine?.text && hasNumber(pages[0].keyLine.text)) continue;
    if (need.optional) { warnings.push({ level: 'deck', item: need.role, ask: need.ask, impact: need.impact }); continue; }
    const { role, ...gap } = need;
    relationGaps.push({ level: 'deck', item: role, have: `大纲已有 ${pages.length} 页内容`, fallback: ABSENT, ...gap });
  }
  pages.forEach((p, i) => {
    const where = { level: 'page', page: p.id || `p${i + 1}` };
    if (!ROLES.includes(p.role)) warnings.push({ ...where, item: 'role', ask: `role 取 ${ROLES.join(' / ')}` });
    const key = p.keyLine?.text?.trim();
    if (!key) warnings.push({ ...where, item: 'keyLine', ask: '制作智能体从本页内容提炼重点句（source: created），交付时请用户确认', impact: '页面没有重点，只能平铺信息' });
    else if (['report','review'].includes(kind) && !hasNumber(key) && ACTION_ONLY.test(key)) warnings.push({ ...where, item: 'keyLine', ask: '重点句只是动作罗列，改成结果或状态（最好带数字）', impact: '标题看不出做成了什么' });
    for (const d of p.data || []) {
      if (!d.unit && !/[%％]/.test(String(d.value))) warnings.push({ ...where, item: 'unit', ask: `「${d.label}」的单位`, impact: '数字无法读懂' });
      if (d.icon && !ICONS[d.icon]) warnings.push({ ...where, item: 'icon', ask: `「${d.label}」的 icon 取 ${Object.keys(ICONS).join(' / ')}`, impact: '名称不存在，会显示默认图标' });
    }
    // A cover is optional and comes first; its figures should not repeat another page's figure group one for one.
    if (p.role === 'cover') {
      if (i > 0 || pages.filter((q) => q.role === 'cover').length > 1) warnings.push({ ...where, item: 'cover', ask: '封面只能有一页，放在最前面；中间的页面改成内容页角色', impact: '封面不在开头，整稿顺序混乱' });
      const sig = (list) => (list || []).map((d) => `${d.label}|${d.value}`).sort().join(';'), mine = sig(p.data);
      const twin = mine && pages.find((q) => q !== p && q.role !== 'cover' && sig(q.data) === mine);
      if (twin) warnings.push({ ...where, item: 'cover-data', ask: `封面的数字和 ${twin.id || `第 ${pages.indexOf(twin) + 1} 页`} 的数字组完全一样：封面去掉 data，或只留一个最能说明整体状态的数字`, impact: '同一组数字连着出现两次，像套模板' });
    }
    relationGaps.push(...pageRelationGaps(p, where, { kind, roles }));
    if ((p.periods || []).some((pd) => pd.lane) && (p.periods || []).some((pd) => !periodRange(pd.span || pd.label))) warnings.push({ ...where, item: 'periods', ask: '写了 lane 但有 label 不是日期：补 span，如 8月上旬—9月中旬', impact: '无法按时间排，只能退回等宽色带' });
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
  // Wording that must hold across the deck: the same thing counted one way, the same figure with the same target, a title keeping its scope.
  if (['report', 'review'].includes(kind)) warnings.push(...wordingWarnings(outline));
  const contentIssues = validateContentModel(outline);
  const blocking = gaps.length > 0 || contentIssues.length > 0;
  // Source locations are the agent's to fill in; they never become a question for the user.
  const baselineIssues = outlineBaselineIssues(outline, { baseDir });
  // The delivery reply was repeatedly squeezed into "page N lacks X"; the wording is written here so it stays whole.
  const pageNo = new Map(pages.map((p, i) => [p.id || `p${i + 1}`, i + 1]));
  const deliveryNote = relationGaps.length ? { lead: `第一版已做完。有 ${Math.min(relationGaps.length, 5)} 处关系材料里没写，我没有编：`, gaps: relationGaps.slice(0, 5).map((g) => `${g.page ? `第 ${pageNo.get(g.page)} 页` : '整稿'}，${g.question}材料里有：${g.have}。${g.whyItMatters}。给我${g.ask}。补上后：${g.afterFill}。`), closing: '这些我可以先按常见逻辑补上，你再改。' } : null;
  return { ok: !blocking, kind, scope: full ? 'full' : 'part', gaps, relationGaps, deliveryNote, warnings, suggestions, contentIssues, baselineIssues,
    next: baselineIssues.length ? '制作智能体补全 baselineIssues（来源位置与摘录）后运行 outline:baseline' : '运行 outline:baseline <outline.json> <新目录> 生成事实基线与工程骨架',
    decision: contentIssues.length ? '内容契约不完整：制作智能体先修正 contentIssues，不把内部结构缺失当作用户材料缺口。'
      : gaps.length ? '没有可上屏的内容：向用户要材料。'
      : relationGaps.length ? '继续做第一版，不为这些关系缺口停下。relationGaps 是候选，读材料确认后取舍，也可补充程序看不出的关系。用户授权补写时直接写上（文字写全，数字用 XX 占位）；未授权时按现有内容排版。交付回复用读者的问题逐条说明，不出现字段名。'
      : '没有发现关系缺口：直接做第一版。' };
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
  if ((p.statements || []).length) add('labelBand', '带标签的一句话各成模块，复盘判断用暖色 tone:judgment');
  if (['results', 'actions'].includes(p.role) && (p.items || []).length >= 2) add('actionPanel', '动作按先后编号，配短标签和概括小标题');
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
