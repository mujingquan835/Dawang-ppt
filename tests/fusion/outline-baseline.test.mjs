import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildOutlineBaseline, missingContracts, draftedContent, DRAFT_LOCATOR } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-baseline.mjs';
import { checkOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';
import { draftedShownBy, slideNotes } from '../../skills/dawang-ppt/project/src/fusion/authoring/drafted.mjs';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { composeEditablePptx } from '../../skills/dawang-ppt/project/src/fusion/export/pptx-core.mjs';
import { validateContentBaseline } from '../../skills/dawang-ppt/project/src/fusion/authoring/content-baseline.mjs';

const from = (locator) => ({ locator, excerpt: `${locator} 的原文` });
const outline = () => ({
  kind: 'report', scope: 'part', title: '合成汇报', audience: '管理层',
  sources: [{ sourceId: 'md', kind: 'markdown', title: '合成材料' }],
  pages: [{
    id: 'p1', role: 'results', keyLine: { text: '新签 20 单', source: 'distilled' },
    data: [{ label: '新签', value: '20', unit: '单', from: from('L1') }, { label: '完成率', value: '96%', from: from('L2') }],
    items: [{ title: '案例传播', detail: '每周两次', from: from('L3') }],
    flows: [{ title: '流程', steps: ['收集', '审核', '传播'], from: from('L4') }],
    compare: { left: [{ title: '去年' }], right: [{ title: '今年' }], from: from('L5') },
    table: { columns: ['线', '定位'], rows: [['二手房', '重点'], ['爱房', '持续']], from: from('L6') }
  }]
});

test('an outline becomes an independent baseline and a scaffold with every contract declared', () => {
  const r = buildOutlineBaseline(outline());
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  const { nodes, relations } = r.baseline.snapshot;
  assert.equal(r.baseline.origin, 'source-before-layout');
  assert.equal(nodes['p1:data-1'].facts.display, '20 单');
  assert.equal(nodes['p1:data-2'].facts.display, '96%');
  assert.equal(nodes['p1:data-2'].facts.unit, '%');
  assert.deepEqual(relations.map((x) => [x.id, x.kind]), [['p1:flow-1', 'sequence'], ['p1:compare', 'comparison'], ['p1:table', 'classification']]);
  assert.deepEqual(relations[0].edges.map((e) => [e.from, e.to]), [['p1:flow-1-1', 'p1:flow-1-2'], ['p1:flow-1-2', 'p1:flow-1-3']]);
  assert.deepEqual(missingContracts(r.scaffold), []);
  assert.deepEqual(r.scaffold.contentPlan.slides[0].requiredRefs.filter((x) => x === 'p1:flow-1'), ['p1:flow-1']);
  assert.deepEqual(validateContentBaseline(r.scaffold, r.baseline), []);
});

test('the scaffold lays out each page region with its content and an empty binding per fact, edge and row', () => {
  const page = buildOutlineBaseline(outline()).scaffold.contentPlan.slides[0];
  assert.deepEqual(page.regions.map((r) => r.zoneId), ['metrics', 'items', 'flow-1', 'compare', 'table']);
  assert.deepEqual(page.visualDecision.zones.map((z) => z.id), page.regions.map((r) => r.zoneId));
  assert.deepEqual(page.regions.filter((r) => r.hierarchy === 'primary').map((r) => r.zoneId), ['metrics']);
  const flow = page.regions.find((r) => r.zoneId === 'flow-1');
  assert.deepEqual(flow.relationRefs, ['p1:flow-1']);
  assert.deepEqual(flow.bindings.filter((b) => b.edgeId).map((b) => b.edgeId), ['e1', 'e2']);
  assert.deepEqual(page.regions.find((r) => r.zoneId === 'table').bindings.filter((b) => b.rowId).map((b) => b.rowId), ['row-1', 'row-2']);
  assert(page.regions.every((r) => r.bindings.every((b) => Array.isArray(b.elementIds) && !b.elementIds.length)));
});

test('a relation spanning regions gets its own region so all its members can be bound together', () => {
  const o = outline();
  o.relations = [{ id: 'p1:why', kind: 'support', members: ['p1:item-1', 'p1:data-1'], rows: [{ id: 'r', members: ['p1:item-1', 'p1:data-1'] }], from: from('L9'), page: 'p1' }];
  const own = buildOutlineBaseline(o).scaffold.contentPlan.slides[0].regions.at(-1);
  assert.deepEqual(own.relationRefs, ['p1:why']);
  assert.deepEqual(own.contentRefs, ['p1:item-1', 'p1:data-1']);
});

test('every relation gap says what the reader cannot follow, what to give and what changes', () => {
  const { relationGaps } = checkOutline({ kind: 'report', scope: 'full', pages: [{ id: 'p1', role: 'results', keyLine: { text: '完成' }, data: [{ label: '完成', value: '1', unit: '项' }] }] });
  assert(relationGaps.length > 0);
  for (const g of relationGaps) assert(g.question && g.ask && /例如/.test(g.ask) && g.afterFill && g.fallback, g.item);
});

test('the shipped contract example passes make and stops only at the independent review', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-example-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const deck = path.join(dir, 'deck');
  const built = spawnSync('node', ['skills/dawang-ppt/examples/report-contract.mjs', deck], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr + built.stdout);
  const made = spawnSync('node', ['skills/dawang-ppt/scripts/dawang.mjs', 'make', path.join(deck, 'authored.json'), path.join(dir, 'o.html'), '--workspace', path.join(dir, 'ws'), '--summary'], { encoding: 'utf8' });
  const result = JSON.parse(made.stdout);
  assert.deepEqual(result.issues.map((i) => i.kind), ['rules-review-missing'], JSON.stringify(result.issues));
});

test('facts without a source location stop the baseline and are not put to the user', () => {
  const o = outline();
  delete o.pages[0].data[0].from;
  const built = buildOutlineBaseline(o);
  assert.equal(built.ok, false);
  assert.deepEqual(built.issues.map((i) => [i.kind, i.item]), [['outline-source-location-missing', 'p1:data-1']]);
  const check = checkOutline(o);
  assert.equal(check.ok, true);
  assert.deepEqual(check.gaps, []);
  assert.equal(check.baselineIssues.length, 1);
  assert.match(check.next, /baselineIssues/);
});

test('relations the agent identified are carried over, and only those', () => {
  const o = outline();
  o.relations = [{ id: 'p1:why', kind: 'support', members: ['p1:item-1', 'p1:data-1'], rows: [{ id: 'r', members: ['p1:item-1', 'p1:data-1'] }], from: from('L9'), page: 'p1' }];
  const r = buildOutlineBaseline(o);
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.baseline.snapshot.relations.at(-1).id, 'p1:why');
  assert.equal(r.baseline.snapshot.relations.at(-1).from, undefined);
  assert(r.scaffold.contentPlan.slides[0].requiredRefs.includes('p1:why'));
  o.relations[0].members = ['p1:item-1', 'p1:nothing'];
  o.relations[0].rows = [{ id: 'r', members: ['p1:item-1'] }];
  assert(buildOutlineBaseline(o).issues.some((i) => i.kind === 'content-relation-invalid'));
});

test('make refuses a new deck without contracts and creates no workspace', () => {
  const r = spawnSync('skills/dawang-ppt/project/node_modules/.bin/tsx', ['tests/fusion/helpers/new-deck-gate-run.jsx'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

test('outline:baseline writes both files and will not overwrite an existing baseline', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outline-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'outline.json'), out = path.join(dir, 'deck');
  fs.writeFileSync(input, JSON.stringify(outline()));
  const run = () => spawnSync('node', ['skills/dawang-ppt/scripts/dawang.mjs', 'outline:baseline', input, out], { encoding: 'utf8' });
  const first = run();
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.deepEqual(fs.readdirSync(out).sort(), ['authored-scaffold.json', 'content-baseline.json']);
  const second = run();
  assert.notEqual(second.status, 0);
  assert.match(second.stderr + second.stdout, /基线已存在/);
});

test('content written on the user\'s say-so is listed per page, with XX placeholders flagged', () => {
  const from = { locator: DRAFT_LOCATOR, excerpt: '可以适当撰写' };
  const project = { contentPlan: { slides: [{ slideId: 'p1', requiredRefs: ['p1:data-1', 'p1:item-1', 'p1:item-2'] }], nodes: {
    'p1:data-1': { text: '预算 XX 万元', status: 'estimated', sourceLocations: [from] },
    'p1:item-1': { text: '建立回访机制', status: 'estimated', sourceLocations: [from] },
    'p1:item-2': { text: '材料原文', status: 'confirmed', sourceLocations: [{ locator: '第 1 段', excerpt: 'x' }] }
  } } };
  assert.deepEqual(draftedContent(project), [
    { page: 'p1', ref: 'p1:data-1', text: '预算 XX 万元', kind: 'drafted', placeholder: true, elementIds: [] },
    { page: 'p1', ref: 'p1:item-1', text: '建立回访机制', kind: 'drafted', placeholder: false, elementIds: [] }
  ]);
  assert.deepEqual(draftedContent({}), []);
});

test('content expanded by the maker is listed apart from what the user asked to have drafted', () => {
  const project = { contentPlan: { slides: [{ slideId: 'p1', requiredRefs: ['p1:item-1'] }], nodes: { 'p1:item-1': { text: '用于门店破冰，提升客情', status: 'estimated', sourceLocations: [{ locator: '制作者展开', excerpt: '用于门店破冰' }] } } } };
  assert.equal(draftedContent(project)[0].kind, 'expanded');
});

// User decision 2026-11-11: drafted content is marked in the editor and the speaker notes, never on the page.
test('drafted content goes to the speaker notes and the editor, page by page', async () => {
  const drafted = (text, locator = DRAFT_LOCATOR) => ({ text, status: 'estimated', sourceLocations: [{ locator, excerpt: '可以适当撰写' }] });
  const project = {
    slides: [{ slideId: 'p1', notes: '先讲预算' }, { slideId: 'p2' }],
    contentPlan: {
      slides: [
        { slideId: 'p1', requiredRefs: ['p1:data-1', 'p1:item-1'], regions: [{ bindings: [{ ref: 'p1:data-1', elementIds: ['m-value-1'] }, { ref: 'p1:item-1', elementIds: ['list-1'] }] }] },
        { slideId: 'p2', requiredRefs: ['p2:item-1'], regions: [{ bindings: [{ ref: 'p2:item-1', elementIds: ['list-1'] }] }] }
      ],
      nodes: { 'p1:data-1': drafted('预算 XX 万元'), 'p1:item-1': drafted('用于门店破冰', '制作者展开'), 'p2:item-1': { text: '原文', status: 'confirmed', sourceLocations: [{ locator: 'L1' }] } }
    }
  };
  assert.equal(slideNotes(project, 'p1'), '先讲预算\n\n【模型补写，请核对】\n· 预算 XX 万元（XX 处填实际数字）\n【制作时展开，请核对】\n· 用于门店破冰');
  assert.equal(slideNotes(project, 'p2'), '');
  assert.deepEqual(draftedShownBy(project, 'p1', 'm-value-1').map((d) => d.text), ['预算 XX 万元']);
  assert.deepEqual(draftedShownBy(project, 'p2', 'list-1'), []);
  // The PPTX carries them as notes; a page without any gets none.
  const { pptx } = composeEditablePptx(PptxGenJS, { revision: 1, slides: [{ slideId: 'p1', objects: [], notes: slideNotes(project, 'p1') }, { slideId: 'p2', objects: [] }] });
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  const notes = await Promise.all(Object.keys(zip.files).filter((f) => /notesSlides\/notesSlide\d+\.xml$/.test(f)).sort().map((f) => zip.file(f).async('string')));
  assert(notes[0].includes('模型补写') && notes[0].includes('预算 XX 万元') && !notes.slice(1).some((x) => x.includes('模型补写')));
});

test('each labelled statement becomes its own node and zone', () => {
  const from = { locator: '第 1 段', excerpt: '客户需要看到效果' };
  const built = buildOutlineBaseline({ kind: 'report', title: 't', audience: 'a', sources: [{ sourceId: 's', kind: 'x', title: 't' }], pages: [{ id: 'p1', role: 'results', keyLine: { text: 'k', source: 'quoted' }, statements: [{ id: 'problem', label: '业务问题', text: '客户需要看到效果', from }] }] });
  assert.equal(built.ok, true, JSON.stringify(built.issues));
  assert.equal(built.baseline.snapshot.nodes['p1:problem'].text, '客户需要看到效果');
  const region = built.scaffold.contentPlan.slides[0].regions.find((r) => r.zoneId === 'problem');
  assert.equal(region.module.name, 'labelBand');
  assert.deepEqual(region.contentRefs, ['p1:problem']);
});

test('the report-modules example passes make and stops only at the independent review', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modules-example-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const deck = path.join(dir, 'deck');
  const built = spawnSync('node', ['skills/dawang-ppt/examples/report-modules.mjs', deck], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr + built.stdout);
  const made = spawnSync('node', ['skills/dawang-ppt/scripts/dawang.mjs', 'make', path.join(deck, 'authored.json'), path.join(dir, 'o.html'), '--workspace', path.join(dir, 'ws'), '--summary'], { encoding: 'utf8' });
  const result = JSON.parse(made.stdout);
  assert.deepEqual(result.issues.map((i) => i.kind), ['rules-review-missing'], JSON.stringify(result.issues));
});

test('a page with two tables gets a zone and row facts for each', () => {
  const from = { locator: '材料', excerpt: '摘录' }, table = (title) => ({ title, columns: ['项', '值'], rows: [['甲', '1'], ['乙', '2']], from });
  const r = buildOutlineBaseline({ kind: 'report', title: '合成', audience: '管理层', sources: [{ sourceId: 'x', kind: 'synthetic', title: '合成' }], pages: [{ id: 'p1', role: 'other', readerTask: '看预算', keyLine: { text: '预算两张表', source: 'quoted' }, tables: [table('预算'), table('效果')] }] }, { baseDir: '.' });
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  const zones = r.scaffold.contentPlan.slides[0].visualDecision.zones.map((z) => z.id);
  assert(zones.includes('table-1') && zones.includes('table-2'), zones.join());
});
