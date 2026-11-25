import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalizeAndLintOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-normalizer.mjs';

const REPO = path.resolve(new URL('../../', import.meta.url).pathname);
const CLI = path.join(REPO, 'skills/dawang-ppt/scripts/dawang.mjs');

export function buildComprehensiveOutline() {
  return {
    title: '星云平台 2027 全量现代 UI 与防空框综合验收',
    period: '2027 全量收官',
    palette: 'blue-gold',
    pages: [
      {
        id: 'p1',
        role: 'cover',
        eyebrow: 'v2 全量收官 · 防空框密度自适应',
        name: '星云平台 2027 战略立项与执行全景',
        keyLine: '11 套 v2 现代 UI 全部融合完毕，两级防空框算法覆盖单页与复杂多组件混排',
        focus: '两级防空框自适应',
        note: '纯公开虚构示例 · 100% 原生 PPTX 可编辑',
        data: [
          { label: '累计现代组件', value: '35', unit: '套', highlight: true },
          { label: '复杂混排实测', value: '0', unit: '溢出' },
        ],
      },
      {
        id: 'p2',
        role: 'summary',
        eyebrow: '01 防空框改造 · 高管一页纸',
        keyLine: '全年营收同比增长 38.4%，右侧 2×2 宽卡自动切左图标右特大号主数字',
        focus: '同比增长 38.4%',
        execBrief: {
          badge: 'EXECUTIVE SUMMARY',
          value: '+38.4',
          unit: '%',
          headline: '规模与人效双轮超预期增长',
          summary: '核心产品线连续 4 个季度保持双位数增速，标准化引擎带动交付成本下降 42%，整体毛利稳步抬升。',
          metrics: [
            { label: '签约标杆大客户', value: '126', unit: '家', delta: '↗ 新增 38 家', tone: 'primary' },
            { label: '年度净留存率', value: '114', unit: '%', delta: '↗ 超标 9pp', tone: 'ok' },
            { label: '平均交付周期', value: '-42', unit: '%', delta: '压降至 3.2 天', tone: 'pop' },
            { label: '客户综合满意度', value: '4.8', unit: '/5', delta: '连续 3 季提升', tone: 'primary' },
          ],
        },
        statements: [
          { id: 'verdict', label: '核心定调', text: '横卡自动切换左右排布后，右半边空洞彻底消失，视觉重心饱满。', tone: 'judgment' },
        ],
      },
      {
        id: 'p3',
        role: 'summary',
        eyebrow: '02 防空框改造 · 冰山与飞轮',
        keyLine: '冰山根因卡自动提取 24%/3套/90天 量化角标，矩形按内容高度收紧',
        focus: '自动提取量化角标',
        iceberg: {
          title: '线索转化放缓问题 · 冰山双层深度归因（防空框改造版）',
          waterlineLabel: '海平面 · 透过现象看本质（80% 根因在水下）',
          surface: {
            title: '水面之上 · 可见表象（20%）',
            badge: '外显症状',
            summary: 'Q3 线索转化周期拉长 18%，重点区域复购占比连续两月持平。',
          },
          deep: {
            items: [
              { tag: '根因 01', title: '跨部门交接机制断层', detail: '市场、销售与交付缺少统一 SLA，线索在交接窗口流失 24%。' },
              { tag: '根因 02', title: '工具链与数据口径割裂', detail: '客户档案分散在 3 套孤立系统，一线重复录入消耗精力。' },
              { tag: '根因 03', title: '考核激励与长期留存错配', detail: '仅考核前端获客数量，未与 90 天留存率和增购转化绑定。' },
            ],
          },
        },
        statements: [
          { id: 'verdict', label: '治理抓手', text: '优先打通统一数据底座与交接 SLA，从水下机制根治效率损耗。', tone: 'judgment' },
        ],
      },
      {
        id: 'p4',
        role: 'summary',
        eyebrow: '03 复杂多组件混排 · 立项档案 + 风险预案',
        keyLine: '同一页面纵向混排立项档案与风险预案，两级防空框算法自动紧凑协同零溢出',
        focus: '多组件纵向混排协同',
        specCard: {
          title: '专项立项档案 · 星云 2.0 升级计划',
          badge: '立项通过',
          items: [
            { label: '项目负责人', value: '张明 · 架构部' },
            { label: '实施周期', value: '2027.01 – 06' },
            { label: '核定预算', value: '120 万元', tone: 'primary', highlight: true },
            { label: '覆盖业务线', value: '全公司 12 条线' },
            { label: '核心验收 KPI', value: '提效 ≥ 60%', tone: 'pop' },
            { label: '当前风险等级', value: '低风险 · 可控', tone: 'ok' },
          ],
        },
        risks: {
          title: '关键风险分级预警与兜底预案',
          badge: '1 项高优关注',
          items: [
            { level: 'high', risk: '核心接口并发峰值承压', impact: '大促期流量预计翻 3 倍', mitigation: '提前 2 周完成压测与弹性扩容预案' },
            { level: 'medium', risk: '跨部门口径尚未完全统一', impact: '区域财务统计维度存在差异', mitigation: '4 月底发布统一数据字典并锁定字段' },
            { level: 'low', risk: '新成员上手周期略长', impact: '平均需 5 天熟悉模板规范', mitigation: '上线 15 分钟短视频教程与示例包' },
          ],
        },
      },
      {
        id: 'p5',
        role: 'summary',
        eyebrow: '04 目标拆解 · OKR 目标树',
        keyLine: '围绕标杆级汇报引擎核心目标，拆解 3 项可量化关键结果与实时进度',
        focus: '综合达成 86%',
        okr: {
          title: '2027 Q1 团队核心 OKR 目标与关键结果树',
          objective: { code: 'OBJECTIVE 01', title: '打造行业标杆级智能汇报与组件引擎', progress: 86 },
          keyResults: [
            { code: 'KR1', title: '单份汇报成稿耗时压降至 15 分钟内', detail: '已覆盖 90% 高频复盘与述职场景', progress: 100 },
            { code: 'KR2', title: '原生 PPTX 无损导出通过率 ≥ 99%', detail: '完成 35 套现代 UI 组件全量适配', progress: 92 },
            { code: 'KR3', title: '全公司活跃使用团队突破 50 个', detail: '当前已接入 34 个业务与职能团队', progress: 68 },
          ],
        },
        statements: [
          { id: 'verdict', label: '季度节奏', text: 'KR1 与 KR2 已提前锁胜，3 月重点聚焦 KR3 跨部门推广赋能。', tone: 'judgment' },
        ],
      },
      {
        id: 'p6',
        role: 'summary',
        eyebrow: '05 协同路线 · 双轨推进图',
        keyLine: '业务增长轨与技术支撑轨按 Q1–Q3 同步咬合，保障规模复制不掉链',
        focus: '业务与技术双轨咬合',
        dualTrack: {
          title: '2027 业务增长轨 × 技术支撑轨协同路线图',
          tracks: [
            {
              name: '业务增长轨 · 市场与运营动作',
              badge: 'Q1 → Q3 拓展',
              steps: [
                { stage: 'Q1', title: '标杆试点', detail: '华东 3 城跑通闭环与复盘模板' },
                { stage: 'Q2', title: '规模复制', detail: '拓展至 12 个重点城市与大区' },
                { stage: 'Q3', title: '生态变现', detail: '上线行业定制套餐与增值服务' },
              ],
            },
            {
              name: '技术支撑轨 · 平台与数据底座',
              badge: '同步咬合支撑',
              steps: [
                { stage: 'Q1', title: '引擎定型', detail: '全量 35 套组件与防空框内核' },
                { stage: 'Q2', title: '实时协同', detail: '上线多人批注与企业模板库' },
                { stage: 'Q3', title: '开放插件', detail: '开放自定义主题与数据源接入' },
              ],
            },
          ],
        },
        statements: [
          { id: 'verdict', label: '协同保障', text: '每个季度末设立双轨联合验收门禁，确保技术交付领先业务拓展半步。', tone: 'judgment' },
        ],
      },
    ],
  };
}

test('outline-normalizer recognizes specCard, okr, risks, dualTrack and multi-component page', () => {
  const res = normalizeAndLintOutline(buildComprehensiveOutline());
  const pages = res.report.pages;
  assert.equal(pages.length, 6);
  assert.ok(pages[3].activeZones.includes('specCard'));
  assert.ok(pages[3].activeZones.includes('risks'));
  assert.ok(pages[4].activeZones.includes('okr'));
  assert.ok(pages[5].activeZones.includes('dualTrack'));
});

test('fast:build builds comprehensive single + multi-component deck with zero DOM overflow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-ui-v2b3-'));
  const outlineFile = path.join(tmp, 'outline.json');
  const htmlFile = path.join(tmp, 'deck.html');
  const pptxFile = path.join(tmp, 'deck.pptx');
  const previewFile = path.join(tmp, 'preview.png');
  fs.writeFileSync(outlineFile, JSON.stringify(buildComprehensiveOutline(), null, 2));

  const out = execFileSync(process.execPath, [
    CLI, 'fast:build', outlineFile, htmlFile, '--pptx', pptxFile, '--preview', previewFile,
  ], { encoding: 'utf8', cwd: REPO });

  const summary = JSON.parse(out.trim());
  assert.equal(summary.slides, 6);
  assert.deepEqual(summary.preview?.overflows || [], [], `unexpected DOM overflows: ${JSON.stringify(summary.preview?.overflows)}`);
  assert.equal(summary.pptx?.zipOk, true);

  const html = fs.readFileSync(htmlFile, 'utf8');
  assert.ok(html.includes('焦点档案卡'), 'expected specCard variant 焦点档案卡');
  assert.ok(html.includes('顶栏目标树'), 'expected okr variant 顶栏目标树');
  assert.ok(html.includes('阶段咬合列'), 'expected dualTrack variant 阶段咬合列');
});
