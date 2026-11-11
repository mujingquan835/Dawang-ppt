// Wording that has to hold across a deck (文字口径). Two blind tests in a row failed only here: a title figure the page
// never showed (380 元), a scope that grew in the retelling (蓟州那一场 → 露营单台), a streak the page could not
// prove (连续两年下降 with one year on the page), and one thing counted two ways (三条线 / 四线).
// keyLineFigureIssues is mechanical and stops outline:baseline; the rest are candidates for the author to confirm.

const asList = (value) => (Array.isArray(value) ? value : []);

// Figures in a sentence, as plain numbers ("41,280" → "41280", "-23%" → "23"). Dates and ordinals are not figures:
// 2026 年、3 月、Q3、H1、第 2 期.
const FIGURE = /(?<![\dA-Za-z.])([QqHh第])?\s*[+\-−±≤≥<>约]?(\d[\d,]*(?:\.\d+)?)(?![\d.])\s*(年|月|日|号|季度|周年)?/g;
export function figuresIn(text) {
  const out = [];
  for (const m of String(text || '').matchAll(FIGURE)) {
    const [raw, lead, digits, time] = m, plain = digits.replace(/,/g, '');
    if (lead || time || (/^(19|20)\d\d$/.test(plain) && !digits.includes(','))) continue;
    out.push({ raw: raw.trim(), value: plain.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') });
  }
  return out;
}

// Everything a page puts on screen besides its title.
export function pageBody(page) {
  const steps = (groups) => asList(groups).flatMap((g) => [g.title, ...asList(g.steps).flatMap((s) => (typeof s === 'string' ? [s] : [s?.title, s?.detail]))]);
  const table = (t) => (t ? [t.title, ...asList(t.columns).map((c) => (typeof c === 'string' ? c : c?.label)), ...asList(t.rows).flat()] : []);
  return [
    ...asList(page.data).flatMap((d) => [d.label, `${d.value ?? ''}${d.unit ? ' ' + d.unit : ''}`, d.note, d.period, d.target != null ? `目标 ${d.target}` : '']),
    ...asList(page.statements).flatMap((st) => [st.label, st.text]),
    ...asList(page.items).flatMap((it) => [it.title, it.detail]),
    page.compare?.leftLabel, page.compare?.rightLabel, ...['left', 'right'].flatMap((side) => asList(page.compare?.[side]).flatMap((it) => [it.title, it.detail])),
    ...asList(page.periods).flatMap((pd) => [pd.label, pd.span, pd.title, ...asList(pd.points)]),
    ...steps(page.flows), ...steps(page.chains), ...table(page.table), ...asList(page.tables).flatMap(table),
    ...asList(page.photos).map((ph) => ph.caption)
  ].filter((t) => t != null && t !== '').map(String).join('\n');
}

// A figure in a page's title must be on that page (the cover's on some page of the deck): the title states what the page shows.
export function keyLineFigureIssues(outline) {
  const pages = asList(outline.pages), deck = new Set(pages.flatMap((p) => figuresIn(pageBody(p)).map((f) => f.value)));
  const issues = [];
  pages.forEach((page, i) => {
    const pageId = page.id || `p${i + 1}`, cover = page.role === 'cover', shown = cover ? deck : new Set(figuresIn(pageBody(page)).map((f) => f.value));
    const missing = figuresIn(page.keyLine?.text).filter((f) => !shown.has(f.value));
    if (missing.length) issues.push({
      kind: 'outline-keyline-figure-missing', page: pageId, item: `${pageId}:keyLine`, figures: missing.map((f) => f.raw),
      need: cover
        ? `封面状态句里的 ${missing.map((f) => f.raw).join('、')} 在整稿各页都找不到：放进某一页的数据、表格或句子，或改用页面上有的数字`
        : `标题里的 ${missing.map((f) => f.raw).join('、')} 本页没有出现：放进本页的数据、表格或句子（标签带上原文的限定，如哪一场、哪个店、哪个月），或改用本页已有的数字`
    });
  });
  return issues;
}

const CN = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const count = (word) => CN[word] ?? (Number(word) || 0);

// Words that name the whole period rather than narrow it: dropping them from a title loses no scope.
const GENERIC = /^(?:活动|全年|年度|累计|合计|整体|总|本期|当期|全部|区域|实际|全网)+$/;

// Candidates for the author: each one is checked against the material, then fixed or left as written.
export function wordingWarnings(outline) {
  const pages = asList(outline.pages), out = [], idOf = (p, i) => p.id || `p${i + 1}`;
  const textOf = (p) => [p.keyLine?.text, pageBody(p)].filter(Boolean).join('\n');

  // One thing counted two ways across the deck: 三条线 on one page, 四线 on another.
  const counted = new Map();
  pages.forEach((p, i) => {
    for (const m of textOf(p).matchAll(/([一二两三四五六七八九十]|\d+)\s*(?:条|大|个)?(线|主线|打法|板块|方向|战役|抓手|模块|阶段|渠道)/g)) {
      const noun = m[2] === '主线' ? '线' : m[2], seen = counted.get(noun) || new Map(), n = count(m[1]);
      if (!seen.has(n)) seen.set(n, { said: m[0], page: idOf(p, i) });
      counted.set(noun, seen);
    }
  });
  for (const [noun, seen] of counted) if (seen.size > 1) out.push({ level: 'deck', item: 'wording-count', ask: `「${noun}」的数量说法不一致：${[...seen.values()].map((s) => `${s.page}「${s.said}」`).join('、')}。同一件事全稿用原文的同一个说法`, impact: '读者会以为是两件事，或认为数字有误' });

  // The same measure on two pages must read the same, target included: 142 元/条 with its ≤180 on one page and bare on the cover.
  const metrics = pages.flatMap((p, i) => asList(p.data).map((d) => ({ page: idOf(p, i), d, key: `${String(d.value).replace(/,/g, '')}|${d.unit || ''}` })));
  const reported = new Set();
  for (const a of metrics) for (const b of metrics) {
    // A label that already says how it did against the goal (完成 114.7%、优于目标 21%) carries the target in words.
    if (a.page === b.page || a.key !== b.key || a.d.target == null || b.d.target != null || /目标|完成|达成/.test(`${b.d.label}${b.d.note || ''}`) || reported.has(b.page + b.key)) continue;
    reported.add(b.page + b.key);
    out.push({ level: 'page', page: b.page, item: 'wording-target', ask: `「${b.d.label} ${b.d.value}${b.d.unit ? ' ' + b.d.unit : ''}」在 ${a.page} 带目标 ${a.d.target}，这里没带：补上 data[].target，让同一个数字在全稿口径一致`, impact: '只看这一页的读者判断不了这个数字算好还是差' });
  }
  const byLabel = new Map();
  for (const m of metrics) { const k = `${m.d.label}|${m.d.unit || ''}`, list = byLabel.get(k) || []; list.push(m); byLabel.set(k, list); }
  for (const [key, list] of byLabel) {
    const label = key.split('|')[0];
    const values = [...new Set(list.map((m) => m.key))];
    if (values.length > 1 && new Set(list.map((m) => m.page)).size > 1) out.push({ level: 'deck', item: 'wording-metric', ask: `「${label}」在不同页数值不同：${list.map((m) => `${m.page} ${m.d.value}${m.d.unit ? ' ' + m.d.unit : ''}`).join('、')}。核对是不是同一口径，不是就把时期或范围写进标签`, impact: '读者会以为数字前后矛盾' });
  }

  // A title figure keeps the scope its own tile gives it: the tile says 蓟州露营单台营销成本, so the title cannot say 露营单台营销成本.
  pages.forEach((p, i) => {
    const title = String(p.keyLine?.text || '').replace(/\s/g, ''), values = new Set(figuresIn(title).map((f) => f.value));
    const tiles = (p.role === 'cover' ? pages : [p]).flatMap((q) => asList(q.data)).filter((d) => values.has(figuresIn(String(d.value))[0]?.value));
    for (const d of tiles) {
      const label = String(d.label || '').split(/[·|｜：:（(]/)[0].replace(/\s/g, '');
      const k = [...label].findIndex((_, at) => at > 0 && label.length - at >= 4 && title.includes(label.slice(at)));
      if (k > 0 && !title.includes(label.slice(0, k)) && !GENERIC.test(label.slice(0, k))) out.push({ level: 'page', page: idOf(p, i), item: 'wording-scope', ask: `标题里的 ${d.value}${d.unit ? ' ' + d.unit : ''} 丢了限定「${label.slice(0, k)}」（色块写的是「${d.label}」）：标题保留原文的范围，不把一场、一店、一月的数说成整体`, impact: '读者会把局部数字当成整体结论，复核判阻断' });
    }
  });

  // A streak in a title needs every period on the page: 连续两年下降 needs three years (or two year-on-year figures) shown.
  pages.forEach((p, i) => {
    const m = /连续\s*([一二两三四五六七八九十]|\d+)\s*(?:个)?(年|季度|季|月|期|周)/.exec(p.keyLine?.text || '');
    if (!m) return;
    const n = count(m[1]), body = p.role === 'cover' ? pages.map(pageBody).join('\n') : pageBody(p), years = new Set(body.match(/20\d\d/g) || []), yoy = (body.match(/同比|环比|较上/g) || []).length;
    const proven = m[2] === '年' ? years.size >= n + 1 || (years.size >= n && yoy >= n) : false;
    if (!proven) out.push({ level: 'page', page: idOf(p, i), item: 'wording-streak', ask: `标题说「${m[0]}」，本页要放出每一期的数（${m[2] === '年' ? `至少 ${n + 1} 个年份，或 ${n} 个同比` : `连续 ${n} 期各自的数`}）；材料没有就改成本页能证明的说法，如“同比下降 23%”`, impact: '复核会判标题结论没有证据（阻断）' });
  });
  return out;
}
