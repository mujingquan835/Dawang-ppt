import fs from 'node:fs';
import { createTheme, createGrid, noteBar } from '../project/src/fusion/authoring/layout-kit.mjs';
import { answerBlock, comparePair, contrastPair, periodBand } from '../project/src/fusion/authoring/report-kit.mjs';
import { pageHeader, targetVsActual, contrastColumns, periodColumns } from '../project/src/fusion/authoring/patterns.mjs';
import { reportPalette } from '../project/src/fusion/authoring/report-palettes.mjs';
// Synthetic report pages for the three report page types and the tag header, in the blue-gold report palette.
// Wording and numbers are invented test content. Any of the nine report palettes can replace it.
const theme = createTheme({ palette: reportPalette(process.env.REPORT_PALETTE || 'blue-gold') }), grid = createGrid();
const source = '示例材料：合成数据，仅用于展示页型';
const head = (page, tag, title, focus, subtitle) => pageHeader({ theme, grid, tag, title, focus, subtitle, page, total: 4, source });

// A freely composed summary page carried by report components; one value is words, not a figure.
function componentsPage() {
  const header = head(4, '整体结论 | 04', '客流超目标，下一阶段重点转向成交效率', '成交效率'), top = header.bottom + 40, [lx, lw] = grid.span(0, 5), [rx, rw] = grid.span(5, 7);
  const a = answerBlock({ id: 'answer', x: lx, y: top, width: lw, height: 330, label: '整体判断', value: '超额完成', note: '到店目标完成，成交转化仍偏低', theme });
  const c = comparePair({ id: 'visits', x: rx, y: top, width: rw, height: 330, before: { label: '目标到店', value: '10,000', unit: '人' }, after: { label: '实际到店', value: '12,860', unit: '人' }, note: '达成 128.6%', theme });
  const py = top + 330 + 72, band = periodBand({ id: 'next', x: lx, y: py, width: grid.width, periods: ['11 月', '12 月', '元旦'], theme });
  const steps = ['审批收银扩容预算', '完成设备采购与培训', '扩容与预约分流落地'];
  const notes = band.columns.map(([cx, cw], i) => ({ type: 'text', id: `next-step-${i + 1}`, text: steps[i], bounds: [cx + 28, py + band.height + 24, cw - 56, 40], style: theme.font(28, { fontWeight: 700 }) }));
  const nb = noteBar({ id: 'judge', x: lx, y: py + band.height + 100, width: grid.width, text: '客流增长已经验证，下一阶段把资源放在高峰收银与预约分流。', theme });
  const elements = [...header.elements, ...a.elements, ...c.elements, ...band.elements, ...notes, ...nb.elements];
  const zones = [['answer', 'focus', [lx, top, lw, 330]], ['compare', 'data', [rx, top, rw, 330 + 40]], ['next', 'flow', [0, py - 16, grid.right + 44, band.height + 100]], ['judge', 'note', [lx, py + band.height + 100, grid.width, nb.height]]];
  return { elements, visualDecision: { pattern: 'free：结论页按角色组合答案块、对照组与时期色带', focus: header.focus, layout: '左侧答案块给整体判断，右侧目标对实际，下方时期色带写下一阶段，底部结论条收尾', zones: zones.map(([id, role, b]) => ({ id, role, bounds: b })) } };
}

const pages = [
  targetVsActual({ theme, grid, header: head(1, '成果数据 | 01', '全年整体完成 106%，四项指标三项超额', '整体完成 106%'),
    period: '2026', overall: { label: '整体完成度', value: '106', unit: '%' },
    items: [
      { label: '销售额', target: { value: '1300', unit: '万' }, actual: { value: '1487', unit: '万' }, note: '达成目标 114%', rate: 114, detail: '下半年两场节点活动贡献 320 万' },
      { label: '客户满意度', target: { value: '92', unit: '%' }, actual: { value: '93.4', unit: '%' }, note: '高于目标 1.4 个点', rate: 102, detail: '售后响应时长缩短至 4 小时' },
      { label: '新增客户', target: { value: '400', unit: '家' }, actual: { value: '372', unit: '家' }, note: '完成目标 93%', rate: 93, detail: '三季度渠道调整，拓客节奏放缓' },
      { label: '团队人效', target: { value: '15', unit: '%' }, actual: { value: '18', unit: '%' }, note: '超额 3 个点', rate: 120, detail: '模板化交付减少重复工时' }],
    analysis: '销售额与人效超额，新增客户差 28 家未达标；缺口集中在三季度渠道调整期，下一年度把拓客目标拆到月度跟进。' }),
  contrastColumns({ theme, grid, header: head(2, '复盘 | 02', '上半年三项亮点可复制，三处短板需要补齐', '三处短板'),
    left: { title: '业务亮点', items: [
      { value: '1480', unit: '万', title: '业绩超额完成', points: ['月销售额超预期 15%', '新签客户贡献 30% 销售额'] },
      { value: '34', unit: '%', title: '复购率提升', points: ['大客户流失率下降 40%', '订单交付时效提升 15%'] },
      { value: '95', unit: '%', title: '客户满意度', points: ['问题平均解决时间小于 24 小时', '服务评分由 4.2 升至 4.8'] }] },
    right: { title: '待改进点', items: [
      { title: '市场响应滞后', points: ['未系统跟踪竞品动态，2 次定价失误', '新趋势响应延迟，错失 3 个合作机会'] },
      { title: '新客开发低效', points: ['首轮谈判成功率仅 35%', '仅参加 1 场行业展会'] },
      { title: '成本管控失守', points: ['3 个项目毛利低于 10% 底线', '项目成本超支率平均 12%'] }] } }),
  periodColumns({ theme, grid, header: head(3, '下一步 | 03', '四个季度各有一个主攻点，全年目标 128 项任务', '全年目标 128 项任务'),
    periods: [
      { label: '第一季度', title: '整体销售策略', rate: { value: '89', label: '指标达成率' }, points: ['制定月度销售计划', '线上推广带动新客转化'] },
      { label: '第二季度', title: '渠道策略调整', points: ['分析前 3 个月数据调整价格', '多渠道营销，客户数增长 15%'] },
      { label: '第三季度', title: '增长策略落地', rate: { value: '93', label: '指标达成率' }, points: ['加大市场调研力度', '夏季促销活动拉动销量'] },
      { label: '第四季度', title: '年度复盘与考核', points: ['全年目标达成情况复盘', '团队绩效考核与个人发展计划'] }],
    summary: { overall: { label: '整体完成度', value: '94.5', unit: '%' }, items: [{ value: '128', label: '总任务数' }, { value: '97', label: '完成任务' }, { value: '31', label: '进行中' }, { value: '14', label: '重点任务' }, { value: '92', unit: '%', label: '重点完成率' }] } }),
  componentsPage()
];

export const authored = {
  requirements: { projectId: 'report-patterns-example', title: '汇报页型示例', fixedPageCount: pages.length },
  sources: { entries: [{ sourceId: 'synthetic', kind: 'synthetic' }] }, media: { entries: [] },
  contentPlan: { nodes: {}, slides: pages.map((p, i) => ({ slideId: `r${i + 1}`, visualDecision: p.visualDecision })) },
  designChoice: { styleId: 'authored/custom', appearance: { palette: theme.palette } },
  slides: pages.map((p, i) => ({ slideId: `r${i + 1}`, elements: p.elements }))
};
if (process.argv[1] === import.meta.filename) fs.writeFileSync(process.argv[2] || '/tmp/dawang-report-patterns.json', JSON.stringify(authored, null, 2));
