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
    title: '星云业务 2026 年度经营业绩与高管总览',
    period: '2026 年度',
    palette: 'blue-gold',
    pages: [
      {
        id: 'p1',
        role: 'cover',
        eyebrow: 'UI 灵感 v2 · 第一批验收',
        name: '星云业务年度经营总览',
        keyLine: '分组柱状图、平滑折线图、TOP 排行榜与高管一页纸 Bento 全量落地',
        focus: '四大图表与高管总览模块',
        note: '纯公开虚构示例 · 100% 原生 PPTX 可编辑',
        data: [
          { label: 'v2 第一批', value: '4', unit: '大模块', highlight: true },
          { label: '切换版式', value: '16', unit: '套' },
        ],
      },
      {
        id: 'p2',
        role: 'summary',
        eyebrow: '01 高管一页纸 · Executive Brief',
        keyLine: '全年营收同比增长 38.4%，大客户留存与交付效率同步创三年新高',
        focus: '同比增长 38.4%',
        execBrief: {
          badge: 'EXECUTIVE SUMMARY',
          value: '+38.4',
          unit: '%',
          headline: '规模与人效双轮超预期增长',
          summary: '核心产品线连续 4 个季度保持双位数增速，标准化引擎带动交付成本下降 42%，整体毛利稳步抬升。',
          metrics: [
            { label: '签约标杆大客户', value: '126', unit: '家', delta: '↗ 新增 38 家', tone: 'primary' },
            { label: '年度净留存率 (NDR)', value: '114', unit: '%', delta: '↗ 超标 9pp', tone: 'ok' },
            { label: '平均交付周期', value: '-42', unit: '%', delta: '压降至 3.2 天', tone: 'pop' },
            { label: '客户综合满意度', value: '4.8', unit: '/5', delta: '连续 3 季提升', tone: 'primary' },
          ],
        },
        statements: [
          { id: 'verdict', label: '核心定调', text: '全年各项核心经营指标全面达标，2027 年正式进入规模化复制阶段。', tone: 'judgment' },
        ],
      },
      {
        id: 'p3',
        role: 'summary',
        eyebrow: '02 同比对比 · 分组柱状图',
        keyLine: '四个季度核心营收全面跑赢去年同期，Q4 冲刺至 805 万年度峰值',
        focus: 'Q4 冲刺至 805 万',
        barChart: {
          title: '2026 各季度核心营收同比双柱对比',
          unit: '万元',
          badge: '全年同比 +24.8%',
          categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: '2025 同期', values: [420, 490, 560, 610], tone: 'muted' },
            { name: '2026 实绩', values: [530, 615, 690, 805], tone: 'primary' },
          ],
        },
        statements: [
          { id: 'verdict', label: '增长判断', text: '单季增量逐季扩大，Q4 同比大增 32.0%，奠定来年高基数开局。', tone: 'judgment' },
        ],
      },
      {
        id: 'p4',
        role: 'summary',
        eyebrow: '03 趋势走势 · 多序列折线图',
        keyLine: '上半年活跃团队数连续 6 个月攀升，4 月起大幅甩开目标基准线',
        focus: '6 月突破 1,420 个',
        lineChart: {
          title: '上半年活跃团队数月度增长曲线（实绩 vs 目标）',
          unit: '个',
          badge: '6 月峰值 1,420',
          categories: ['1月', '2月', '3月', '4月', '5月', '6月'],
          series: [
            { name: '实际活跃团队', values: [680, 790, 880, 1060, 1240, 1420], tone: 'primary' },
            { name: '月度目标基线', values: [720, 780, 850, 920, 1020, 1120], dashed: true, tone: 'muted' },
          ],
        },
        statements: [
          { id: 'verdict', label: '趋势复盘', text: '3 月底新版工作台上线后斜率明显抬升，6 月超目标线 26.8%。', tone: 'judgment' },
        ],
      },
      {
        id: 'p5',
        role: 'summary',
        eyebrow: '04 区域贡献 · TOP 排行榜',
        keyLine: '华东大区以 1,280 万蝉联榜首，前三强合计贡献全国 75% 业绩',
        focus: '华东大区 1,280 万',
        rankList: {
          title: '全国五大重点大区年度业绩贡献 TOP 榜',
          unit: '万元',
          badge: 'TOP3 占比 75%',
          items: [
            { label: '华东大区', value: '1,280 万', delta: '+34%' },
            { label: '华北大区', value: '998 万', delta: '+26%' },
            { label: '华南大区', value: '832 万', delta: '+21%' },
            { label: '西南大区', value: '588 万', delta: '+18%' },
            { label: '华中大区', value: '435 万', delta: '+15%' },
          ],
        },
        statements: [
          { id: 'verdict', label: '区域策略', text: '稳固华东、华北基本盘，下半年重点向西南与华中复制标杆打法。', tone: 'judgment' },
        ],
      },
    ],
  };
}

test('outline-normalizer recognizes barChart, lineChart, rankList and execBrief', () => {
  const res = normalizeAndLintOutline(sampleOutline());
  const pages = res.report.pages;
  assert.equal(pages.length, 5);
  assert.ok(pages[1].activeZones.includes('execBrief'));
  assert.ok(pages[2].activeZones.includes('barChart'));
  assert.ok(pages[3].activeZones.includes('lineChart'));
  assert.ok(pages[4].activeZones.includes('rankList'));
});

test('fast:build builds HTML + PPTX with 4 variants per v2 batch1 module and zero DOM overflow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-ui-v2b1-'));
  const outlineFile = path.join(tmp, 'outline.json');
  const htmlFile = path.join(tmp, 'deck.html');
  const pptxFile = path.join(tmp, 'deck.pptx');
  const previewFile = path.join(tmp, 'preview.png');
  fs.writeFileSync(outlineFile, JSON.stringify(sampleOutline(), null, 2));

  const out = execFileSync(process.execPath, [
    CLI, 'fast:build', outlineFile, htmlFile, '--pptx', pptxFile, '--preview', previewFile,
  ], { encoding: 'utf8', cwd: REPO });

  const summary = JSON.parse(out.trim());
  assert.equal(summary.slides, 5);
  assert.deepEqual(summary.preview?.overflows || [], [], `unexpected DOM overflows: ${JSON.stringify(summary.preview?.overflows)}`);
  assert.equal(summary.pptx?.zipOk, true);

  const html = fs.readFileSync(htmlFile, 'utf8');
  assert.ok(html.includes('通栏主视觉'), 'expected execBrief variant 通栏主视觉');
  assert.ok(html.includes('堆叠柱图'), 'expected barChart variant 堆叠柱图');
  assert.ok(html.includes('柔光面积图'), 'expected lineChart variant 柔光面积图');
  assert.ok(html.includes('TOP3领奖台'), 'expected rankList variant TOP3领奖台');
});
