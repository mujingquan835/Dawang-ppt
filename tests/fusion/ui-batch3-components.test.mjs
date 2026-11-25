import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalizeAndLintOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-normalizer.mjs';

const REPO = path.resolve(new URL('../../', import.meta.url).pathname);
const CLI = path.join(REPO, 'skills/dawang-ppt/scripts/dawang.mjs');

function sampleOutline() {
  return {
    title: '星云平台 2027 战略全景与研发路线图',
    period: '2027 年度规划',
    palette: 'blue-gold',
    pages: [
      {
        id: 'p1',
        role: 'cover',
        eyebrow: 'UI 组件清旧账 · 收官全量验收',
        name: '星云平台战略与路线全景',
        keyLine: '环形仪表、金字塔架构、甘特看板、证言卡与顶部章节导航全量落地',
        focus: '全量现代 UI 组件收官',
        note: '纯公开虚构示例 · 100% 原生 PPTX 可编辑',
        data: [
          { label: '收官新组件', value: '5', unit: '大类', highlight: true },
          { label: '累计现代模块', value: '24', unit: '套' },
        ],
      },
      {
        id: 'p2',
        role: 'section',
        part: 'PART 01',
        name: '目标达成与战略分层',
        keyLine: '通过环形仪表与多层金字塔架构对齐核心指标与技术底座',
        items: [
          { title: '达成仪表盘', detail: '多维核心指标完成度可视化' },
          { title: '战略架构栈', detail: '愿景、能力中台与底座三层联动' },
        ],
      },
      {
        id: 'p3',
        role: 'summary',
        eyebrow: '01 核心指标 · 环形仪表盘',
        keyLine: '年度营收达成 118% 超额收官，项目按期率与客户满意度稳居高位',
        focus: '年度营收达成 118%',
        gauges: {
          title: '2026 核心经营指标达成率仪表盘',
          items: [
            { label: '年度营收达成', pct: 118, value: '4,820 万', target: '目标 4,080 万', highlight: true },
            { label: '重点项目按期率', pct: 94, value: '47 / 50 项', target: '目标 90%', tone: 'ok' },
            { label: '客户满意度', pct: 88, value: '4.4 / 5.0', target: '目标 85%', tone: 'pop' },
            { label: '自动化覆盖率', pct: 76, value: '38 / 50 链路', target: '目标 75%', tone: 'secondary' },
          ],
        },
        statements: [
          { id: 'verdict', label: '核心判断', text: '四项核心指标全部越过年度基准线，营收与交付质量实现双超预期。', tone: 'judgment' },
        ],
      },
      {
        id: 'p4',
        role: 'summary',
        eyebrow: '02 战略架构 · 金字塔分层',
        keyLine: '构建“数据底座—组件中台—智能门户”四层协同架构，支撑规模化复用',
        focus: '四层协同架构',
        pyramid: {
          title: '星云平台四层业务与技术战略金字塔',
          layers: [
            { level: 'L1 愿景层', title: '智能决策驾驶舱', detail: '面向高管与业务线的一站式指标洞察、自动复盘与行动建议', badge: '顶层目标' },
            { level: 'L2 应用层', title: '多场景演示与报告生成', detail: '覆盖述职、复盘、路演与项目排期，支持 4 套零丢内容版式秒切', badge: '核心场景' },
            { level: 'L3 中台层', title: '确定性排版与 UI 组件引擎', detail: '沉淀 24 套现代网页级组件、11 套浅深配色与无损原生 PPTX 导出' },
            { level: 'L4 底座层', title: '多源资产摄取与事实校核', detail: '统一解析文档、表格、截图与历史沉淀，确保 100% 忠于真实数据' },
          ],
        },
        statements: [
          { id: 'verdict', label: '架构价值', text: '底座保事实、中台保审美、应用保效率，单次迭代即可全业务线共享红利。', tone: 'judgment' },
        ],
      },
      {
        id: 'p5',
        role: 'section',
        part: 'PART 02',
        name: '并行排期与一线反馈',
        keyLine: '跨团队多泳道甘特排期推进落地，一线证言验证真实提效价值',
        items: [
          { title: '上半年排期', detail: '四大团队并行甘特与看板视图' },
          { title: '一线证言', detail: '业务负责人真实反馈与分工' },
        ],
      },
      {
        id: 'p6',
        role: 'summary',
        eyebrow: '03 研发路线 · 多泳道甘特',
        keyLine: '四大团队上半年并行推进，Q1 完成内核收官、Q2 全面开放生态能力',
        focus: '四大团队并行推进',
        gantt: {
          title: '2027 上半年多团队并行研发路线图（支持一键切换阶段看板列）',
          columns: ['1月', '2月', '3月', '4月', '5月', '6月'],
          lanes: [
            { name: '排版引擎组', task: '全量 UI 组件与多版式内核', start: 1, end: 2, status: 'done', owner: '架构团队' },
            { name: '摄取校核组', task: '多源角色摄取与大纲预检', start: 1, end: 3, status: 'done', owner: '数据团队' },
            { name: '工作台体验组', task: '离线精修与实时换肤增强', start: 2, end: 4, status: 'active', owner: '前端团队' },
            { name: '图表可视化组', task: '环形仪表与动态数据联动', start: 3, end: 5, status: 'active', owner: '可视化团队' },
            { name: '开放生态组', task: '主题插件规范与公开文档', start: 4, end: 6, status: 'todo', owner: '社区团队' },
          ],
        },
        statements: [
          { id: 'verdict', label: '节奏把控', text: '前两项底座工程已按期收官，3–5 月聚焦体验与可视化深水区冲刺。', tone: 'judgment' },
        ],
      },
      {
        id: 'p7',
        role: 'summary',
        eyebrow: '04 一线声音 · 证言与负责人',
        keyLine: '一线业务与运营团队实测效率提升 8 倍，原生可编辑获得一致认可',
        focus: '实测效率提升 8 倍',
        quotes: {
          title: '核心试点负责人与一线业务真实反馈',
          items: [
            { quote: '过去准备季度复盘需要通宵改排版，现在 10 分钟就能出高管级成品，现场切版式和换深色主题非常顺手。', author: '张明', role: '华东区域负责人', tag: '效率提升 8×', highlight: true },
            { quote: '导出到 PowerPoint 后所有图表、圆环和字重都能直接二次编辑，彻底解决了 AI 做图只能当死图看的痛点。', author: '李思琪', role: '战略运营总监', tag: '100% 原生可编辑' },
            { quote: '新版四象限、12 月追踪条和甘特图把项目进度讲得一清二楚，评审会上 5 分钟就拍板了 Q2 预算。', author: '陈远', role: '产品研发负责人', tag: '高管一致好评' },
          ],
        },
        statements: [
          { id: 'verdict', label: '推广结论', text: '试点满意度达 96%，下月起向全公司 12 个业务条线全面开放推广。', tone: 'judgment' },
        ],
      },
    ],
  };
}

test('outline-normalizer recognizes gauges, pyramid, gantt and quotes', () => {
  const res = normalizeAndLintOutline(sampleOutline());
  const pages = res.report.pages;
  assert.equal(pages.length, 7);
  assert.ok(pages[2].activeZones.includes('gauges'));
  assert.ok(pages[3].activeZones.includes('pyramid'));
  assert.ok(pages[5].activeZones.includes('gantt'));
  assert.ok(pages[6].activeZones.includes('quotes'));
});

test('fast:build builds HTML + PPTX with 4 variants per batch3 module, auto section nav tabs, and zero DOM overflow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-ui-batch3-'));
  const outlineFile = path.join(tmp, 'outline.json');
  const htmlFile = path.join(tmp, 'deck.html');
  const pptxFile = path.join(tmp, 'deck.pptx');
  const previewFile = path.join(tmp, 'preview.png');
  fs.writeFileSync(outlineFile, JSON.stringify(sampleOutline(), null, 2));

  const out = execFileSync(process.execPath, [
    CLI, 'fast:build', outlineFile, htmlFile, '--pptx', pptxFile, '--preview', previewFile,
  ], { encoding: 'utf8', cwd: REPO });

  const summary = JSON.parse(out.trim());
  assert.equal(summary.slides, 7);
  assert.deepEqual(summary.preview?.overflows || [], [], `unexpected DOM overflows: ${JSON.stringify(summary.preview?.overflows)}`);
  assert.equal(summary.pptx?.zipOk, true);
  assert.ok(fs.existsSync(htmlFile));
  assert.ok(fs.existsSync(pptxFile));

  const html = fs.readFileSync(htmlFile, 'utf8');
  assert.ok(html.includes('刻度仪表盘'), 'expected gauges variant 刻度仪表盘');
  assert.ok(html.includes('等宽分层栈'), 'expected pyramid variant 等宽分层栈');
  assert.ok(html.includes('阶段看板列'), 'expected gantt variant 阶段看板列');
  assert.ok(html.includes('金句聚光灯'), 'expected quotes variant 金句聚光灯');
  assert.ok(html.includes('hdr-nav-bg'), 'expected auto top segmented section nav tabs (PILL-02)');
});
