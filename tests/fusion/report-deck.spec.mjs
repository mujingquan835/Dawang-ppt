import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { periodRange, periodTimeline } from '../../skills/dawang-ppt/project/src/fusion/authoring/report-kit.mjs';
import { ICONS } from '../../skills/dawang-ppt/project/src/fusion/authoring/icons.mjs';
import { defaultLayout, draftDeckClaims, figureForm, layoutCandidates } from '../../skills/dawang-ppt/project/src/fusion/authoring/report-deck.mjs';
import { REPORT_ROLES, REPORT_ROLES_HERO, REPORT_ROLES_ROOMY, actionPanel, createTheme, metricTiles } from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';

const run = (dir, palette) => {
  const built = spawnSync('node', ['tests/fusion/helpers/report-deck-matrix.mjs', dir, palette], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr + built.stdout);
  const made = spawnSync('node', ['skills/dawang-ppt/scripts/dawang.mjs', 'make', path.join(dir, 'authored.json'), path.join(dir, 'o.html'), '--workspace', path.join(dir, 'ws'), '--summary'], { encoding: 'utf8' });
  return { composed: JSON.parse(built.stdout.trim().split('\n').at(-1)), result: JSON.parse(made.stdout) };
};

// Pages differ in role, density, photos, tables, flows, comparison and periods; a pale and a deep palette cover the colour extremes.
for (const palette of ['blue-gold', 'primary-colors']) {
  test(`a varied deck composes without page problems in ${palette}`, { timeout: 170000 }, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-deck-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const { composed, result } = run(dir, palette);
    assert.deepEqual(result.issues.map((i) => i.kind), ['rules-review-missing'], JSON.stringify(result.issues));
    assert(composed.sparse.some((s) => s.page === 'p7'), 'a nearly empty page is reported');
    assert(composed.loose.some((s) => s.page === 'p7'), 'content floating in the body is reported');
    assert(result.warnings.some((w) => w.kind === 'page-body-loose' && w.slideId === 'p7'), 'make reports the same page');
    const slides = JSON.parse(fs.readFileSync(path.join(dir, 'authored.json'), 'utf8')).slides, el = (page, id) => slides.find((s) => s.slideId === page).elements.find((e) => e.id === id);
    assert.match(el('p11', 'm-cp-before-value').text, /36,000/);
    assert.match(el('p11', 'm-cp-after-value').text, /41,280/);
    assert.equal(el('p12', 'm-note-1').text, '目标 2,800 台');
    assert.equal(el('p12', 'm-note-2'), undefined);
    // Overlapping work sits on a shared axis: same start, different lanes, widths by duration.
    const seg = (n) => el('p14', `pd-seg-${n}`).bounds;
    assert.equal(seg(3)[0], seg(4)[0]);
    assert.notEqual(seg(3)[1], seg(4)[1]);
    assert.equal(el('p14', 'pd-lane-2').text, '乙项目');
    // Lanes that would leave their rows half empty fall back to the band, which still says whose period it is.
    assert.equal(el('p16', 'pd-lane-1'), undefined);
    assert.match(el('p16', 'pd-title-1').text, /甲项目/);
    // A lone figure is a tight tile with the sentence following it on the same line.
    const tile = el('p15', 'm-tile-1').bounds, sentence = el('p15', 'st-r-bar').bounds;
    assert(tile[2] <= 500 && sentence[0] > tile[0] + tile[2] - 1, 'the sentence follows the figure');
    assert.equal(sentence[1], tile[1]);
    assert.equal(el('p15', 'metrics-panel'), undefined, 'one rectangle, not a panel around a tile');
    assert.equal(sentence[3], tile[3], 'the sentence is no taller than the figure');
    assert(tile[3] <= 240, `the figure stays compact: ${tile[3]}`);
    // A row of figures hugs its content: beside a sentence when one is next to it, otherwise centred on the line, and never with icons on only some tiles.
    const group = el('p13', 'metrics-panel').bounds, beside = el('p13', 'st-w-bar').bounds, lone = el('p10', 'metrics-panel').bounds, iconsOn = (page) => slides.find((s) => s.slideId === page).elements.filter((e) => /^m-tile-\d+-icon$/.test(e.id)).length;
    assert(group[2] < 900 && beside[0] > group[0] + group[2] - 1, 'the sentence follows the figures');
    // A one-sentence label keeps its own height beside the figures and sits in the middle of the row (user decision 2026-11-10).
    assert(beside[3] < group[3] && Math.abs((beside[1] + beside[3] / 2) - (group[1] + group[3] / 2)) <= 1, `the short label is centred, not stretched: ${beside} ${group}`);
    assert(lone[2] < 1200 && Math.abs((lone[0] - 96) - (1824 - lone[0] - lone[2])) <= 2, `a lone tight row is centred: ${lone}`);
    // Text starts on one line: a table with a highlighted row hangs its rules and fill 12px out so the first column stays
    // level with the panel's text, and each period column starts at its band segment's edge.
    for (const slide of slides) {
      const find = (id) => slide.elements.find((e) => e.id === id), c0 = find('t-head-c0'), rule = find('t-header-rule');
      if (c0 && rule && slide.elements.some((e) => /^t-bg-/.test(e.id)) && rule.bounds[2] > 1600) assert(c0.bounds[0] === 120 && rule.bounds[0] === 108, `${slide.slideId} table column starts at the text line: ${c0.bounds} ${rule.bounds}`);
      const seg = find('pd-seg-1'), title = find('pd-title-1');
      if (seg && title) assert.equal(title.bounds[0], seg.bounds[0], `${slide.slideId} period text starts at its band`);
    }
    assert(slides.some((s) => s.elements.some((e) => /^t-bg-/.test(e.id))) && slides.some((s) => s.elements.some((e) => e.id === 'pd-title-1')), 'the matrix has a highlighted table and periods');
    // Wide tiles alone on a line that would leave much of it empty become one long strip across the line: the leading
    // figure takes the widest tile with a larger figure, the rest sit beside it in the same row (user decision 2026-11-11).
    const wide = el('p19', 'metrics-panel').bounds, heroSize = el('p19', 'm-value-1').style.fontSize, restSize = el('p19', 'm-value-2').style.fontSize;
    assert(heroSize === restSize && heroSize >= 80 && el('p19', 'm-tile-1').bounds[2] > el('p19', 'm-tile-2').bounds[2], `one large figure size across the strip: ${heroSize} vs ${restSize}`);
    assert(wide[2] >= 1700 && el('p19', 'm-tile-2').bounds[1] === el('p19', 'm-tile-1').bounds[1] && el('p19', 'm-tile-1').bounds[3] < 260, `one low strip across the line: ${wide}`);
    for (const page of ['p10', 'p12', 'p13']) assert.equal(iconsOn(page), 0, `${page} has no filler icons`);
    // Figure pages in a row do not repeat a form (user decision 2026-11-11): after p19's tiles, p20's group is an anchored
    // strip across the line, its title figure in the solid block, every figure one size.
    const strip = slides.find((s) => s.slideId === 'p20').elements, sizes = new Set(strip.filter((e) => /^m-value-\d$/.test(e.id)).map((e) => Math.max(e.style?.fontSize || 0, ...(e.runs || []).map((r) => r.style.fontSize))));
    assert(el('p20', 'm-anchor') && !el('p20', 'm-tile-1') && sizes.size === 1 && el('p20', 'metrics-panel').bounds[2] === 1728, `p20 is a strip: ${[...sizes]}`);
    assert(el('p20', 'm-anchor').bounds[0] < el('p20', 'm-value-2').bounds[0], 'the named figure is anchored at the left');
    assert(composed.forms.some((f) => f.page === 'p20' && f.form === 'strip'));
    // Items of about one length with a sentence each, alone on their line, are equal cards; items with no sentence stay a list.
    const cards = [1, 2, 3, 4].map((n) => el('p21', `acts-card-${n}`).bounds);
    assert(new Set(cards.map((b) => b[2])).size === 1 && new Set(cards.map((b) => b[3])).size === 1, `cards share one size: ${cards}`);
    assert(el('p21', 'acts-num-1').text === '01' && el('p21', 'acts-detail-4') && !el('p8', 'acts-card-1'), 'numbered cards on p21, a list on p8');
    for (const n of [1, 2, 3, 4]) { const t = el('p10', `m-tile-${n}`).bounds, v = el('p10', `m-value-${n}`); assert(t[2] <= 420, `tile ${n} hugs its figure: ${t[2]}`); }
    // Figures that fill their tiles keep the whole line; a long label does not stop a short figure from growing while the label keeps its size.
    assert(el('p12', 'metrics-panel').bounds[2] === 1728 && el('p12', 'm-value-1').style.fontSize > 88, 'the figure grows to fill an equal split');
    // 问题 → 改进 answer each other: arrows tie the rows, no VS badge, and the way forward takes the primary colour.
    const fillOf = (page, id) => el(page, id).style.fill, capNow = fillOf('p5', 'cmp-cap-2');
    assert(el('p5', 'cmp-arrow-1') && !el('p5', 'cmp-vs') && !el('p5', 'cmp-no-1'), 'arrows, not numbers or VS');
    assert.equal(capNow, fillOf('p17', 'cmp-cap-1'), 'the primary cap sits on 改进 in one page and on 亮点 in the other');
    assert.notEqual(fillOf('p5', 'cmp-cap-1'), capNow);
    // Sides that do not pair row by row carry no marks between them.
    assert(!el('p17', 'cmp-arrow-1') && !el('p17', 'cmp-no-1') && el('p17', 'cmp-l-3') && !el('p17', 'cmp-r-3'), 'unpaired sides keep their own rows');
    // The same measures on both sides become change tiles: before → after on one line with the later figure large, and the tile the title names is solid.
    const change = el('p18', 'cmp-value-3'), sizesIn = change.runs.map((r) => r.style.fontSize);
    assert.equal(change.text, '260 → 96 元');
    assert(sizesIn[1] > sizesIn[0] * 1.4, `the later figure is emphasised: ${sizesIn}`);
    assert.equal(el('p18', 'cmp-head').text, '2026 上半年 → 2026 下半年');
    assert.equal(el('p18', 'cmp-tile-3').component, 'highlightTile');
    assert.equal(el('p18', 'cmp-side-1'), undefined);
    // A page that cannot fill the body has equal space above and below.
    const zones = JSON.parse(fs.readFileSync(path.join(dir, 'authored.json'), 'utf8')).contentPlan.slides.find((s) => s.slideId === 'p7').visualDecision.zones, top = Math.min(...zones.map((z) => z.bounds[1])) - 146, bottom = 1010 - Math.max(...zones.map((z) => z.bounds[1] + z.bounds[3]));
    assert(Math.abs(top - bottom) <= 2, `centred: ${top} above, ${bottom} below`);
    // A step panel with room to spare is filled by cards and larger type, not by empty panel.
    const page = slides.find((s) => s.slideId === 'p13').elements, card = page.find((e) => e.id === 'fflow1-card-s1'), inCard = page.filter((e) => e.type === 'text' && e.bounds[0] >= card.bounds[0] && e.bounds[0] < card.bounds[0] + card.bounds[2] && e.bounds[1] >= card.bounds[1] && e.bounds[1] < card.bounds[1] + card.bounds[3]);
    assert(card, 'the flow became cards');
    assert(card.bounds[1] + card.bounds[3] - Math.max(...inCard.map((e) => e.bounds[1] + e.bounds[3])) <= 64, 'no hollow space under the text in a card');
    assert.equal(composed.scales.p2, 'dense');
    assert.equal(composed.scales.p7, 'hero');
  });
}

test('a long panel heading wraps instead of overflowing, at every type scale', () => {
  for (const roles of [REPORT_ROLES, REPORT_ROLES_ROOMY, REPORT_ROLES_HERO]) {
    const theme = createTheme({ roles }), items = [{ title: '甲', detail: '说明' }, { title: '乙', detail: '说明' }];
    const heading = '关键动作（收集凭证 → 组合传播 → 销售承接 → 复盘沉淀 → 下一轮投放 → 再次验证）';
    const made = actionPanel({ id: 'a', x: 0, y: 0, width: 520, heading, items, theme }), box = made.elements.find((e) => e.id === 'a-heading');
    const line = Math.ceil(box.style.fontSize * 1.3);
    assert(box.bounds[3] >= line * 2 - 1, `heading box ${box.bounds[3]} holds two lines of ${line}`);
    const first = made.elements.find((e) => e.id === 'a-title-1');
    assert(first.bounds[1] >= box.bounds[1] + box.bounds[3], 'the first row starts below the heading');
  }
});

test('a stretched tile enlarges its figure, keeps the icon small and honours the chosen icon', () => {
  const theme = createTheme({ roles: REPORT_ROLES }), items = [{ label: '留资', value: '86', unit: '场', icon: 'coin', note: '目标 80 场' }], base = { id: 'm', x: 0, y: 0, width: 620, items, theme, size: 44, tileHeight: 300 };
  const grown = metricTiles({ ...base, growValue: true, iconCap: 96 }), plain = metricTiles(base), disc = (m) => m.elements.find((e) => e.id === 'm-tile-1-disc');
  assert(grown.valueSize > 44 && plain.valueSize === 44);
  assert(disc(grown).bounds[2] <= 96 && disc(plain).bounds[2] > 96);
  assert.equal(grown.elements.find((e) => e.id === 'm-tile-1-icon').path, ICONS.coin);
  assert.equal(grown.elements.find((e) => e.id === 'm-note-1').text, '目标 80 场');
});

test('the drafted checklist describes only what the deck has', () => {
  const deck = { requirements: {}, contentPlan: { slides: [{ slideId: 'p1', typographyRoles: { sectionTitle: { fontSize: 24 } } }] }, slides: [{ slideId: 'p1', elements: [{ id: 'title' }] }] };
  const { items } = draftDeckClaims({ deck, outline: { pages: [{ keyLine: { text: 'x', source: 'quoted' } }] }, palette: 'blue-gold' }), text = JSON.stringify(Object.values(items).map((i) => i.how));
  for (const absent of ['对照', '页脚', '来源放', '判断类', 'HS-02', '取档', '数字沿用']) assert(!text.includes(absent), absent);
});

test('period labels become a time axis only when lanes are named', () => {
  assert.deepEqual(periodRange('8月中下旬'), [25, 27]);
  assert.deepEqual(periodRange('9月全月'), [27, 30]);
  assert.deepEqual(periodRange('7—9月'), [21, 30]);
  assert.deepEqual(periodRange('Q3'), [21, 30]);
  assert.equal(periodRange('启动期'), null);
  assert.equal(periodTimeline([{ label: '8月' }, { label: '9月' }]), null);
  assert.equal(periodTimeline([{ label: '启动期', lane: '甲' }]), null);
  assert.equal(periodTimeline([{ label: '9月上旬' }, { label: '9月全月' }]), null);
  assert.deepEqual(periodTimeline([{ label: '9月上旬', lane: '甲' }, { label: '9月全月', lane: '乙' }]), { ranges: [[27, 28], [27, 30]], start: 27, end: 30 });
});

test('the default layout follows the page: photos to the right, closing sentences at the bottom', () => {
  const page = { role: 'results', statements: [{ id: 'q', label: '业务问题' }, { id: 'v', label: '复盘判断' }, { id: 'm', label: '方式', asMetric: true }] };
  assert.deepEqual(defaultLayout(page, ['q', 'v', 'm', 'items', 'metrics', 'photos']), [{ left: ['q', 'items', 'metrics', 'm'], right: 'photos' }, 'v']);
  assert.deepEqual(defaultLayout({ role: 'actions' }, ['items', 'metrics']), [['items', 'metrics']]);
  assert.deepEqual(defaultLayout({ role: 'other' }, ['table', 'chain-1', 'chain-2', 'flow-3']), ['table', ['chain-1', 'chain-2'], 'flow-3']);
});

test('other arrangements keep every module and exclude the default', () => {
  const page = { role: 'results', statements: [{ id: 'a', label: '背景' }, { id: 'b', label: '趋势' }, { id: 'c', label: '诉求' }, { id: 'd', label: '主题' }, { id: 'v', label: '复盘判断' }], tables: [{}, {}] };
  const zones = ['a', 'b', 'c', 'd', 'v', 'items', 'metrics', 'table-1', 'table-2', 'flow-1', 'photos'];
  const options = layoutCandidates(page, zones);
  assert(options.length > 10 && options.length <= 48);
  const base = JSON.stringify(defaultLayout(page, zones));
  for (const rows of options) {
    assert.notEqual(JSON.stringify(rows), base);
    const placed = rows.flatMap((r) => (typeof r === 'string' ? [r] : Array.isArray(r) ? r : [...r.left, r.right]));
    assert.deepEqual([...placed].sort(), [...zones].sort());
  }
});

test('the drafted checklist cites elements that exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-claims-'));
  try {
    const run = spawnSync('node', ['skills/dawang-ppt/examples/report-modules.mjs', path.join(dir, 'x')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const deck = JSON.parse(fs.readFileSync(path.join(dir, 'x', 'authored.json'), 'utf8'));
    const items = Object.values(deck.contentPlan.ruleChecklist.items);
    assert.equal(items.length, 6);
    for (const item of items) for (const { slideId, elementIds } of item.evidence) for (const id of elementIds) assert(deck.slides.find((s) => s.slideId === slideId).elements.some((e) => e.id === id), `${slideId}/${id}`);
    assert(deck.contentPlan.throughLine.placements.length);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('page.order sets the reading order: sentences before the first module open the page, later ones close it', () => {
  const page = { role: 'results', order: ['lead', 'flow-1', 'table', 'note'], statements: [{ id: 'lead', label: '导语' }, { id: 'note', label: '说明' }] };
  assert.deepEqual(defaultLayout(page, ['lead', 'note', 'table', 'flow-1']), ['lead', 'flow-1', 'table', 'note']);
});

test('make runs again while nothing was edited, and refuses once the project has been changed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remake-'));
  try {
    const cli = 'skills/dawang-ppt/scripts/dawang.mjs', ex = path.join(dir, 'x'), ws = path.join(dir, 'ws');
    assert.equal(spawnSync('node', ['skills/dawang-ppt/examples/report-modules.mjs', ex], { encoding: 'utf8' }).status, 0);
    const make = () => spawnSync('node', [cli, 'make', path.join(ex, 'authored.json'), path.join(dir, 'o.html'), '--workspace', ws, '--summary'], { encoding: 'utf8' });
    const first = JSON.parse(make().stdout);
    assert.equal(first.outFile, undefined, 'no file was written, so no path is reported');
    assert.deepEqual(JSON.parse(make().stdout).issues.map((i) => i.kind), ['rules-review-missing']);
    const file = path.join(ws, 'deck-project.json'), project = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...project, revision: 'edited-by-hand' }));
    const again = make();
    assert.notEqual(again.status, 0);
    assert.match(again.stderr + again.stdout, /工程已存在/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a comparison knows which side is this period and whether one side leads to the other', async () => {
  const { compareSides } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/report-deck.mjs');
  assert.deepEqual(compareSides({ leftLabel: '2026 上半年', rightLabel: '2026 下半年' }), { now: 'right', onward: true });
  assert.deepEqual(compareSides({ leftLabel: '本期', rightLabel: '上期' }), { now: 'left', onward: true });
  assert.deepEqual(compareSides({ leftLabel: '2026 年', rightLabel: '2025 年' }), { now: 'left', onward: true });
  assert.deepEqual(compareSides({ leftLabel: '问题', rightLabel: '改进' }), { now: 'right', onward: true });
  assert.deepEqual(compareSides({ leftLabel: '线上', rightLabel: '线下' }), { now: 'left', onward: false });
  assert.deepEqual(compareSides({ leftLabel: '线上', rightLabel: '线下', current: 'right' }), { now: 'right', onward: true });
});

test('in a tile the figure can be sized on its own while the label keeps its size', () => {
  const theme = createTheme({ roles: REPORT_ROLES }), base = { id: 'm', x: 0, y: 0, width: 900, columns: 2, theme, size: 40, iconCap: 0, items: [{ label: '露营后 30 天成交', value: '73', unit: '台' }, { label: '现场锁定转介绍意向', value: '214', unit: '组' }] };
  const plain = metricTiles(base), grown = metricTiles({ ...base, figureSize: 60 }), size = (m, id) => m.elements.find((e) => e.id === id).style.fontSize;
  assert.equal(size(grown, 'm-value-1'), 60);
  assert.equal(size(grown, 'm-label-1'), size(plain, 'm-label-1'));
  assert(grown.height > plain.height, 'the tile grows with its figure');
});

test('the cover shows each figure’s target, as the content pages do', { timeout: 120000 }, async () => {
  const S = '../../skills/dawang-ppt/project/src/fusion/';
  const { buildOutlineBaseline } = await import(S + 'authoring/outline-baseline.mjs');
  const { composeReportDeck } = await import(S + 'authoring/report-deck.mjs');
  const { createLayoutMeasurer } = await import(S + 'planning/measure-layout.mjs');
  const from = { locator: '合成材料', excerpt: '合成' }, figure = (label, value, unit, target) => ({ label, value, unit, target, from });
  const outline = { kind: 'report', scope: 'part', title: '封面', audience: '管理层', sources: [{ sourceId: 'x', kind: 'synthetic', title: '合成' }], pages: [
    { id: 'cover', role: 'cover', readerTask: '合成', keyLine: { text: '全年留资 41,280 条，超过目标', source: 'quoted' }, data: [figure('留资量', '41,280', '条', '36,000'), figure('线索成本', '142', '元/条', '≤180')] },
    { id: 'p1', role: 'results', readerTask: '合成', keyLine: { text: '留资 41,280 条', source: 'quoted' }, data: [figure('留资量', '41,280', '条', '36,000'), figure('线索成本', '142', '元/条', '≤180')] }
  ] };
  const built = buildOutlineBaseline(outline, { baseDir: os.tmpdir() });
  assert(built.ok, JSON.stringify(built.issues));
  const measurer = await createLayoutMeasurer();
  try { await composeReportDeck({ outline, deck: built.scaffold, palette: 'blue-gold', measurer, footer: '合成' }); } finally { await measurer.close(); }
  const cover = built.scaffold.slides.find((s) => s.slideId === 'cover').elements;
  assert.equal(cover.find((e) => e.id === 'm-note-2')?.text, '目标 ≤180 元/条');
  assert.equal(cover.find((e) => e.id === 'm-note-1')?.text, '目标 36,000 条');
  // Cover tiles hug their figures, which grow up to the status sentence's size, with no filler icons.
  const tile = cover.find((e) => e.id === 'm-tile-1').bounds, value = cover.find((e) => e.id === 'm-value-1'), status = cover.find((e) => e.id === 'title');
  assert(tile[2] < 500, `the tile hugs its figure: ${tile}`);
  assert.equal(value.style.fontSize, status.style.fontSize);
  assert(!cover.some((e) => /^m-tile-\d+-icon/.test(e.id)), 'no filler icons on the cover');
});

test('modules of different kinds side by side split by rank; a second group of figures steps down', { timeout: 120000 }, async () => {
  const S = '../../skills/dawang-ppt/project/src/fusion/';
  const { buildOutlineBaseline } = await import(S + 'authoring/outline-baseline.mjs');
  const { composeReportDeck } = await import(S + 'authoring/report-deck.mjs');
  const { createLayoutMeasurer } = await import(S + 'planning/measure-layout.mjs');
  const from = { locator: '合成材料', excerpt: '合成' }, fig = (label, value, unit) => ({ label, value, unit, from }), it = (title, detail) => ({ title, detail, from });
  const outline = { kind: 'report', scope: 'part', title: '主次', audience: '管理层', sources: [{ sourceId: 'x', kind: 'synthetic', title: '合成' }], pages: [
    { id: 'pa', role: 'plan', readerTask: '合成', keyLine: { text: '明年留资目标 52,000 条，需要三项支持', source: 'quoted' }, focus: '52,000 条',
      items: [it('主播编制', '每店 0.5 个编制'), it('老带新补贴', '厂家承担一半'), it('品牌基金', '申请 50 万')], itemsHeading: '需要支持',
      data: [fig('留资量', '52,000', '条'), fig('销量', '3,800', '台'), fig('直播占比', '55', '%'), fig('转介绍率', '15', '%')] },
    { id: 'pb', role: 'other', readerTask: '合成', keyLine: { text: '两张表逐项对照', source: 'quoted' }, focus: '逐项对照',
      tables: [{ title: '甲', columns: ['项', '值'], rows: [['一', '1'], ['二', '2']], from }, { title: '乙', columns: ['项', '值'], rows: [['三', '3'], ['四', '4']], from }] },
    { id: 'pc', role: 'results', readerTask: '合成', keyLine: { text: '线索成本降到 96 元', source: 'quoted' }, focus: '96 元',
      data: [fig('场次', '572', '场'), fig('观看', '1,636', '万人次'), fig('留资', '18,000', '条')],
      compare: { leftLabel: '2026 上半年', rightLabel: '2026 下半年', left: [it('留资', '4,200 条'), it('成本', '260 元')], right: [it('留资', '13,800 条'), it('成本', '96 元')], from } },
    { id: 'pd', role: 'resources', readerTask: '合成', keyLine: { text: '预算 100 万元分三块', source: 'quoted' }, focus: '分三块',
      table: { columns: ['板块', '预算（万元）', '占比', '用途'], rows: [['品牌', '50', '50%', '联名'], ['门店', '30', '30%', '静展'], ['社群', '20', '20%', '露营'], ['合计', '100', '100%', '——']], from } }
  ] };
  const built = buildOutlineBaseline(outline, { baseDir: os.tmpdir() });
  assert(built.ok, JSON.stringify(built.issues));
  const measurer = await createLayoutMeasurer();
  try { await composeReportDeck({ outline, deck: built.scaffold, palette: 'blue-gold', measurer, footer: '合成', layouts: { pa: [['items', 'metrics']], pb: [['table-1', 'table-2']] } }); } finally { await measurer.close(); }
  const el = (page, id) => built.scaffold.slides.find((s) => s.slideId === page).elements.find((e) => e.id === id);
  // The figures the title states take the wider column; two tables are peers and stay equal (HS-02).
  assert(el('pa', 'metrics-panel').bounds[2] > el('pa', 'acts-panel').bounds[2] * 1.15, `figures lead: ${el('pa', 'metrics-panel').bounds} ${el('pa', 'acts-panel').bounds}`);
  assert(Math.abs(el('pb', 'table-1-panel').bounds[2] - el('pb', 'table-2-panel').bounds[2]) <= 1, 'peer tables stay equal');
  // The title states 96 元, so the before → after row leads and the results row steps down.
  const lead = Math.max(...el('pc', 'cmp-value-1').runs.map((r) => r.style.fontSize)), second = el('pc', 'm-value-1').style.fontSize;
  assert(second <= lead * 0.8, `the second group steps down: ${second} vs ${lead}`);
  // A share column becomes bars in place, longest for the largest share; the total row keeps its figure without a bar.
  const bar = (i) => el('pd', `t-share-${i}`)?.bounds;
  assert(bar(1) && bar(2) && bar(3) && !bar(4), 'bars for the parts, none for the total');
  assert(Math.abs(bar(2)[2] / bar(1)[2] - 0.6) < 0.05 && Math.abs(bar(3)[2] / bar(1)[2] - 0.4) < 0.05, `bars follow the shares: ${bar(1)} ${bar(2)} ${bar(3)}`);
});

// User decision 2026-11-11: the data picks a figure group's form first, then the deck keeps neighbours apart.
test('a figure group takes tiles or an anchored strip by its data and by the page before it', () => {
  const page = (title, extra = {}) => ({ keyLine: { text: title }, data: [{ label: '留资', value: '52,000', unit: '条' }, { label: '销量', value: '3,800', unit: '台' }, { label: '占比', value: '55', unit: '%' }], ...extra });
  assert.equal(figureForm(page('留资 52,000 条'), null), 'strip', 'a figure the title names has an answer to anchor');
  assert.equal(figureForm(page('三项目标同步推进'), null), 'tiles');
  assert.equal(figureForm(page('留资 52,000 条'), 'strip'), 'tiles', 'never the same form twice in a row');
  assert.equal(figureForm(page('三项目标同步推进'), 'tiles'), 'strip');
  assert.equal(figureForm({ ...page('x'), data: page('x').data.slice(0, 2) }, 'tiles'), 'tiles', 'two figures stay tiles');
  assert.equal(figureForm(page('留资 52,000 条', { data: [{ label: '留资', value: '52,000', unit: '条', target: '50,000' }, ...page('x').data.slice(1)] }), null), 'tiles', 'targets keep their own forms');
  assert.equal(figureForm(page('留资 52,000 条', { figureStyle: 'tiles' }), null), 'tiles', 'the outline can fix the form');
  assert.equal(figureForm(page('三项', { figureStyle: 'strip' }), 'strip'), 'strip');
});

// User decision 2026-11-11 (widen the figure group's second form): long labels wrap inside a strip, and a group that
// shares its row with another module stands the strip upright.
test('a strip wraps long labels, and stands upright beside another module', { timeout: 120000 }, async () => {
  const S = '../../skills/dawang-ppt/project/src/fusion/';
  const { buildOutlineBaseline } = await import(S + 'authoring/outline-baseline.mjs');
  const { composeReportDeck } = await import(S + 'authoring/report-deck.mjs');
  const { createLayoutMeasurer } = await import(S + 'planning/measure-layout.mjs');
  const from = { locator: '合成材料', excerpt: '合成' }, fig = (label, value, unit) => ({ label, value, unit, from }), it = (title, detail) => ({ title, detail, from });
  const outline = { kind: 'report', scope: 'part', title: '指标带', audience: '管理层', sources: [{ sourceId: 'x', kind: 'synthetic', title: '合成' }], pages: [
    { id: 'pa', role: 'results', readerTask: '合成', keyLine: { text: '蓟州露营单台营销成本仅 380 元', source: 'quoted' }, figureStyle: 'strip',
      data: [fig('一杯曜途话题曝光', '2,300', '万'), fig('天河城五一车展五天成交', '58', '台'), fig('答谢会现场锁定转介绍意向', '214', '组'), fig('蓟州露营单场单台营销成本', '380', '元'), fig('露营后三十天朋友带朋友成交', '73', '台')] },
    { id: 'pb', role: 'plan', readerTask: '合成', keyLine: { text: '明年留资目标 52,000 条，需要三项支持', source: 'quoted' }, figureStyle: 'strip',
      items: [it('主播编制', '每店 0.5 个编制'), it('老带新补贴', '厂家承担一半'), it('品牌基金', '申请 50 万')], itemsHeading: '需要支持',
      data: [fig('区域留资量', '52,000', '条'), fig('营销带动销量', '3,800', '台'), fig('直播留资占比', '55', '%'), fig('老车主转介绍率', '15', '%')] }
  ] };
  const built = buildOutlineBaseline(outline, { baseDir: os.tmpdir() });
  assert(built.ok, JSON.stringify(built.issues));
  const measurer = await createLayoutMeasurer();
  let r;
  try { r = await composeReportDeck({ outline, deck: built.scaffold, palette: 'blue-gold', measurer, footer: '合成', layouts: { pb: [['items', 'metrics']] } }); } finally { await measurer.close(); }
  const el = (page, id) => built.scaffold.slides.find((s) => s.slideId === page).elements.find((e) => e.id === id);
  // pa: five long labels; the strip holds them on two lines and every figure starts on the same line.
  assert(el('pa', 'm-anchor'), 'pa is a strip');
  const tops = [1, 2, 3, 4, 5].map((n) => el('pa', `m-value-${n}`).bounds[1]), labelBottoms = [1, 2, 3, 4, 5].map((n) => { const b = el('pa', `m-label-${n}`).bounds; return b[1] + b[3]; });
  assert.equal(new Set(tops).size, 1, `figures share a line: ${tops}`);
  assert.equal(new Set(labelBottoms).size, 1, `labels end on one line, right above their figures: ${labelBottoms}`);
  // pb: beside the items the group stands upright: the named figure in a block on top, the rest in rows divided by rules.
  const anchor = el('pb', 'm-anchor').bounds, row = el('pb', 'm-value-2').bounds, label = el('pb', 'm-label-2').bounds;
  assert(el('pb', 'm-rule-1') && !el('pb', 'm-tile-1'), 'rows, not tiles');
  assert(row[1] > anchor[1] + anchor[3] - 1 && row[0] > label[0] + label[2], `figure right of its label, under the block: ${row} ${label}`);
  assert.equal(el('pb', 'm-value-1').bounds[1] < anchor[1] + anchor[3], true, 'the title figure is in the block');
  assert.deepEqual(r.forms.filter((f) => f.form).map((f) => f.form), ['strip', 'strip']);
});

// User decision 2026-11-11: item lists get a second form the same way: data first, then neighbours.
test('an item list takes a list or equal cards by its items and by the page before it', async () => {
  const { itemForm } = await import('../../skills/dawang-ppt/project/src/fusion/authoring/report-deck.mjs');
  const it = (title, detail) => ({ title, detail });
  const even = { items: [it('水平不均', '门店间水平差异大'), it('主播流失', '主播流动性高，培训成本高'), it('切片不足', '切片产出不足，长尾流量没接住')] };
  const uneven = { items: [it('甲', '短'), it('乙', '这一条明显长很多，要讲清楚背景、动作和结果'), it('丙', '中等长度的一句话')] };
  assert.equal(itemForm(even, null), 'cards', 'peers of about one length sit side by side');
  assert.equal(itemForm(uneven, null), 'list');
  assert.equal(itemForm(even, 'cards'), 'list', 'never the same form twice in a row');
  assert.equal(itemForm(uneven, 'list'), 'cards');
  assert.equal(itemForm({ items: even.items.slice(0, 2) }, 'list'), 'list', 'two items stay a list');
  assert.equal(itemForm({ items: [...even.items, it('长', '一'.repeat(80))] }, 'list'), 'list', 'a long item keeps the list');
  assert.equal(itemForm({ items: [it('甲'), it('乙'), it('丙')] }, 'list'), 'list', 'items with no sentence stay a list');
  assert.equal(itemForm({ ...even, itemStyle: 'list' }, null), 'list');
  assert.equal(itemForm({ ...uneven, itemStyle: 'cards' }, 'cards'), 'cards');
});
