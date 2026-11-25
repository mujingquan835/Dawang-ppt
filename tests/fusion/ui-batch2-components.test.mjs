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
    title: '星云平台 2026 年度能力升级与复盘演示',
    period: '2026 年度',
    palette: 'blue-gold',
    pages: [
      {
        id: 'p1',
        role: 'cover',
        eyebrow: 'UI 组件清旧账 · 第一批验收',
        name: '星云平台年度复盘与规划',
        keyLine: '四大现代 UI 模块全量接入自动组版与一键四版式切换',
        focus: '四大现代 UI 模块',
        note: '纯公开虚构示例 · 100% 原生 PPTX 可编辑',
        data: [
          { label: '新增组件', value: '4', unit: '大类', highlight: true },
          { label: '一键切换版式', value: '16', unit: '套' },
        ],
      },
      {
        id: 'p2',
        role: 'summary',
        eyebrow: '01 战略优先级 · 四象限',
        keyLine: '聚焦高价值低阻力速赢项，同步推进平台化长期攻坚',
        focus: '高价值低阻力速赢项',
        matrix: {
          title: '2027 重点需求价值 × 实施复杂度四象限矩阵',
          xLabel: '实施复杂度（低 → 高）',
          yLabel: '业务价值',
          quadrants: [
            { title: '优先速赢区', tag: 'P0 立即落地', highlight: true, items: ['自动化日报一键生成', '模板库 11 套主题热切换', '高频表格原位占比条'] },
            { title: '战略攻坚区', tag: 'P1 重点投入', tone: 'pop', items: ['跨端实时协同编辑内核', '企业级多源知识库直连', '智能图表自动推荐引擎'] },
            { title: '稳步优化区', tag: 'P2 常规迭代', tone: 'ok', items: ['快捷键与批量对齐增强', '历史旧模板一键无损迁移'] },
            { title: '低优观察区', tag: 'P3 暂缓排期', tone: 'muted', items: ['3D 炫酷转场特效', '非标准异形画布尺寸'] },
          ],
        },
        statements: [
          { id: 'verdict', label: '核心判断', text: 'Q1 集中 70% 研发资源打穿 P0 速赢区，Q2 起双线推进跨端协同与智能推荐。', tone: 'judgment' },
        ],
      },
      {
        id: 'p3',
        role: 'summary',
        eyebrow: '02 复盘诊断 · 问题到解法',
        keyLine: '定位交付耗时长与风格割裂两大症结，以确定性引擎闭环提效',
        focus: '确定性引擎闭环提效',
        diagnosis: {
          title: '传统汇报制作链路三联复盘诊断',
          items: [
            { tag: '01 现状问题', title: '手工排版耗时且返工率高', detail: '业务团队平均耗费 1.5 天调整字号、边距与对齐，临时改数往往引发整页错位。', metric: '单份耗时 12 小时', tone: 'err' },
            { tag: '02 根因定位', title: '内容与版式强耦合', detail: '旧流程在写大纲阶段就写死固定框位，换数据或换审美风格只能推倒重画。', metric: '返工率 64%', tone: 'warn' },
            { tag: '03 优化解法', title: '语义解耦 + 原生多版式引擎', detail: '大纲只描述信息关系，引擎 2 秒内自动产出精修主版与 4 套零丢内容切换版式。', metric: '耗时压降至 15 分钟', tone: 'primary' },
          ],
        },
        statements: [
          { id: 'verdict', label: '复盘结论', text: '把排版规则沉淀进确定性组件后，交付效率提升 8 倍以上，审美下限稳定可控。', tone: 'judgment' },
        ],
      },
      {
        id: 'p4',
        role: 'summary',
        eyebrow: '03 年度达标追踪 · Tracker',
        keyLine: '全年 12 个月中有 9 个月超额达标，Q3 波动已于 10 月快速修复',
        focus: '9 个月超额达标',
        tracker: {
          title: '2026 核心服务 SLA 与月度目标达成追踪',
          summary: '按月度目标线 100% 考核，全年综合达成率 104.2%',
          badge: '达标 9/12',
          items: [
            { label: '1月', status: 'ok', value: '104%' },
            { label: '2月', status: 'warn', value: '95%', note: '节假日排期缩短' },
            { label: '3月', status: 'ok', value: '108%' },
            { label: '4月', status: 'ok', value: '112%' },
            { label: '5月', status: 'ok', value: '106%' },
            { label: '6月', status: 'ok', value: '115%' },
            { label: '7月', status: 'warn', value: '96%' },
            { label: '8月', status: 'miss', value: '84%', note: '架构迁移窗口承压' },
            { label: '9月', status: 'ok', value: '103%' },
            { label: '10月', status: 'ok', value: '109%' },
            { label: '11月', status: 'ok', value: '114%' },
            { label: '12月', status: 'ok', value: '118%' },
          ],
        },
        statements: [
          { id: 'verdict', label: '稳定性结论', text: '8 月完成底层切换后连续 4 个月稳定超 103%，全年高可用目标顺利收官。', tone: 'judgment' },
        ],
      },
      {
        id: 'p5',
        role: 'summary',
        eyebrow: '04 方案选型 · 能力勾选矩阵',
        keyLine: '新一代纯 Node 组版方案在离线编辑、导出保真与切换效率全面领先',
        focus: '纯 Node 组版方案',
        featureMatrix: {
          title: '三类汇报生产方案核心能力对比矩阵',
          columns: [
            { name: '传统手工 PPT' },
            { name: 'Dawang-PPT 引擎', badge: '推荐方案', highlight: true },
            { name: '纯图片 AI 工具' },
          ],
          rows: [
            { feature: '原生可编辑 PPTX 导出', values: [true, true, false] },
            { feature: '单文件离线精修工作台', values: [false, true, false] },
            { feature: '一键 4 套零丢内容换版式', values: [false, true, 'partial'] },
            { feature: '11 套浅/深色全稿秒换肤', values: ['partial', true, 'partial'] },
            { feature: '平均成稿耗时', values: ['1–2 天', '< 2 秒渲染', '3–5 分钟'] },
            { feature: '数据保真与零幻觉', values: [true, true, 'partial'] },
          ],
        },
        statements: [
          { id: 'verdict', label: '选型建议', text: '面向高频工作汇报与高管评审场景，推荐全面切换至 Dawang-PPT 确定性引擎。', tone: 'judgment' },
        ],
      },
    ],
  };
}

test('outline-normalizer recognizes matrix, diagnosis, tracker and featureMatrix', () => {
  const res = normalizeAndLintOutline(sampleOutline());
  const pages = res.report.pages;
  assert.equal(pages.length, 5);
  assert.ok(pages[1].activeZones.includes('matrix'));
  assert.ok(pages[2].activeZones.includes('diagnosis'));
  assert.ok(pages[3].activeZones.includes('tracker'));
  assert.ok(pages[4].activeZones.includes('featureMatrix'));
  assert.equal(res.report.warnings.length, 0);
});

test('fast:build builds HTML + PPTX with 4 layout variants per new UI module and zero DOM overflow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-ui-batch2-'));
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
  assert.ok(fs.existsSync(htmlFile));
  assert.ok(fs.existsSync(pptxFile));
  assert.ok(fs.existsSync(previewFile));

  // Verify embedded variants in HTML for p2..p5
  const html = fs.readFileSync(htmlFile, 'utf8');
  assert.ok(html.includes('四格Bento'), 'expected matrix variant 四格Bento');
  assert.ok(html.includes('解法聚光灯'), 'expected diagnosis variant 解法聚光灯');
  assert.ok(html.includes('柱状追踪'), 'expected tracker variant 柱状追踪');
  assert.ok(html.includes('方案分栏卡'), 'expected featureMatrix variant 方案分栏卡');
});
