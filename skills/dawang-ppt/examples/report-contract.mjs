import fs from 'node:fs';
import path from 'node:path';
import { buildOutlineBaseline } from '../project/src/fusion/authoring/outline-baseline.mjs';
import { createTheme, metricTiles } from '../project/src/fusion/authoring/layout-kit.mjs';
import { capacityFlow, capacityTable, flowEdgeBindings, measureModule } from '../project/src/fusion/authoring/capacity-kit.mjs';
import { createLayoutMeasurer } from '../project/src/fusion/planning/measure-layout.mjs';

// A complete new-deck example that passes make: outline → baseline and scaffold → page design → authored.json.
// Usage: node <skill>/examples/report-contract.mjs <new-directory>, then make <new-directory>/authored.json <output.html>.
// Synthetic content. Copy the steps, not the layout: panels take their height from their content.
const outline = {
  kind: 'report', scope: 'part', title: '三季度客户运营汇报（合成示例）', audience: '业务管理层', period: '2026年第三季度',
  sources: [{ sourceId: 'note', kind: 'synthetic', title: '合成材料' }],
  pages: [{
    id: 'p1', role: 'results', readerTask: '看懂案例传播带来了什么结果，以及三条业务线如何分工',
    keyLine: { text: '案例传播带来 20 单新签', source: 'distilled' },
    data: [
      { label: '辅助新签', value: '20', unit: '单', from: { locator: '第 1 段', excerpt: '辅助新签 20 单' } },
      { label: '辅助续费', value: '30', unit: '单', from: { locator: '第 1 段', excerpt: '辅助续费 30 单' } }
    ],
    flows: [{ title: '传播流程', steps: ['收集案例', '审核凭证', '组合传播'], from: { locator: '第 2 段', excerpt: '先收集案例，再审核凭证，最后组合传播' } }],
    table: { columns: ['业务线', '定位'], rows: [['二手房', '重点支持'], ['爱房', '持续支持']], from: { locator: '第 3 段表格', excerpt: '二手房重点支持，爱房持续支持' } }
  }]
};

const dir = path.resolve(process.argv[2] || '');
if (!process.argv[2] || fs.existsSync(path.join(dir, 'content-baseline.json'))) throw new Error('usage: report-contract.mjs <new-directory>');

// In a real deck this step is the outline:baseline command; the files it writes are the same.
const built = buildOutlineBaseline(outline);
if (!built.ok) throw new Error(JSON.stringify(built.issues));
const { baseline, scaffold: deck } = built;

const theme = createTheme({ palette: { accent: '#23338B', pale: '#F3F5FA', gold: '#B58A42', highlightBg: '#F7F0E3' } });
const left = 96, width = 1728, pad = 20;
const measurer = await createLayoutMeasurer();
let flow, table;
try {
  const panelOf = (id) => ({ id, type: 'shape', style: { fill: theme.palette.pale, radius: 10 } });
  const tiles = metricTiles({ id: 'm', x: left + pad, y: 200 + pad, width: width - pad * 2, size: 52, columns: 2, gap: 20, highlight: 0, fill: '#FFFFFF', theme, items: [{ label: '辅助新签', value: '20', unit: '单' }, { label: '辅助续费', value: '30', unit: '单' }] });
  const metricsBox = [left, 200, width, tiles.height + pad * 2];

  const flowY = metricsBox[1] + metricsBox[3] + 20;
  const stepIds = ['s1', 's2', 's3'];
  flow = await measureModule(capacityFlow, { id: 'f', bounds: [left + pad, flowY + pad, width - pad * 2, 300], theme, titleSize: 24, detailSize: 20, steps: stepIds.map((id, i) => ({ id, title: outline.pages[0].flows[0].steps[i], ref: `p1:flow-1-${i + 1}` })) }, measurer);
  const flowBox = [left, flowY, width, flow.height + pad * 2];

  const tableY = flowBox[1] + flowBox[3] + 20;
  table = await measureModule(capacityTable, { id: 't', bounds: [left + pad, tableY + pad, width - pad * 2, 300], theme, padY: 10, headSize: 20, relationRef: 'p1:table', columns: [{ key: 'line', label: '业务线', width: 400, emphasize: true }, { key: 'role', label: '定位', width: width - pad * 2 - 400 }], rows: [{ id: 'row-1', line: '二手房', role: '重点支持', highlight: true, ref: 'p1:row-1' }, { id: 'row-2', line: '爱房', role: '持续支持', ref: 'p1:row-2' }] }, measurer);
  const tableBox = [left, tableY, width, table.height + pad * 2];

  const page = deck.contentPlan.slides[0];
  const region = (id) => page.regions.find((r) => r.zoneId === id);
  const zone = (id, bounds) => { page.visualDecision.zones.find((z) => z.id === id).bounds = bounds; };
  const design = (id, frameElementId, fields) => Object.assign(region(id), { frameElementId, ...fields });

  // Each region's zone is exactly its panel, and the panel is exactly as tall as its content.
  zone('metrics', metricsBox); zone('flow-1', flowBox); zone('table', tableBox);
  design('metrics', 'metrics-panel', { typography: { title: 52, body: 20 }, module: { name: 'metricTiles', variant: 'two-results' }, designReference: { source: '原创', principle: '结果数字先读' }, representation: 'metric-tiles', reason: '先给管理层看结果', bindings: [{ ref: 'p1:data-1', elementIds: ['m-value-1'] }, { ref: 'p1:data-2', elementIds: ['m-value-2'] }] });
  design('flow-1', 'flow-panel', { typography: { title: 24, body: 20 }, module: { name: 'capacityFlow', variant: 'three-steps' }, designReference: { source: '原创', principle: '箭头表达先后' }, representation: 'sequence-flow', reason: '解释结果从哪里来', bindings: [...flow.bindings, ...flowEdgeBindings('f', 'p1:flow-1', stepIds)] });
  design('table', 'table-panel', { typography: { title: 26, body: 26 }, module: { name: 'capacityTable', variant: 'two-lines' }, designReference: { source: '原创', principle: '重点行高亮' }, representation: 'classification-table', reason: '说明业务线分工', bindings: table.bindings });

  page.typographyRoles = theme.roles;
  page.keyLine.support = ['第 1 段'];
  Object.assign(page.visualDecision, { pattern: 'free：结果在上，流程与分工在下', focus: { elementId: 'title', text: '20 单新签' }, layout: '数字色块先给结果，流程解释来源，表格说明分工；面板按内容取高，下方留白' });
  page.composition = { alignments: [{ edge: 'left', zones: ['metrics', 'flow-1', 'table'] }], gaps: [{ axis: 'vertical', from: 'metrics', to: 'flow-1', min: 16 }, { axis: 'vertical', from: 'flow-1', to: 'table', min: 16 }] };

  deck.requirements.projectId = 'report-contract-example';
  deck.contentPlan.throughLine = { placements: [{ slideId: 'p1', elementId: 'title' }], source: 'distilled', support: ['第 1 段'] };

  const evidence = (...elementIds) => [{ slideId: 'p1', elementIds }];
  const applied = (how, ...elementIds) => ({ status: 'applied', how, evidence: evidence(...elementIds) });
  deck.contentPlan.ruleChecklist = { scenario: 'management-report', items: {
    'general#Requirements': applied('readerTask 写明读者任务；只用合成材料，无外部事实，无图片', 'title', 'metrics-panel'),
    'scenario#Clear and direct content; no empty talk': applied('标题陈述结果，数字取自材料', 'title', 'm-value-1'),
    'scenario#Visualize information with structural diagrams': applied('流程用箭头表达先后，分工用表格表达分类', 'f-link-s1-s2', 't-header-rule'),
    'scenario#Key Requirements': applied('标题用重点色分层；数字色块按 HS-01，并列指标等宽按 HS-02', 'title', 'm-tile-1'),
    'scenario#Visual References': applied('单一字族靠字号和字重分层，结论固定在页头，圆角统一（HS-03），编号圆点作为母题', 'title', 'f-node-s1'),
    'scenario#Color Palette Reference': applied('白底深蓝强调配暖金重点行（HS-04）', 'metrics-panel', 't-bg-row-1')
  } };

  deck.slides = [{ slideId: 'p1', mode: 'composition', elements: [
    { id: 'title', type: 'text', text: '案例传播带来 20 单新签', bounds: [left, 96, 1500, 64], style: theme.roleStyle('pageTitle', { fontSize: 44 }), runs: [{ text: '案例传播带来 ', style: { fontWeight: 600, color: theme.palette.ink } }, { text: '20 单新签', style: { fontWeight: 700, color: theme.palette.accent } }] },
    { ...panelOf('metrics-panel'), bounds: metricsBox }, ...tiles.elements,
    { ...panelOf('flow-panel'), bounds: flowBox }, ...flow.elements,
    { ...panelOf('table-panel'), bounds: tableBox }, ...table.elements
  ] }];
} finally {
  await measurer.close();
}

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'content-baseline.json'), JSON.stringify(baseline, null, 2));
fs.writeFileSync(path.join(dir, 'authored.json'), JSON.stringify(deck, null, 2));
console.log(path.join(dir, 'authored.json'));
