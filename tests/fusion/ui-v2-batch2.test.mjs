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
    title: '星云业务 2027 增长飞轮与组织能力深度复盘',
    period: '2027 战略复盘',
    palette: 'blue-gold',
    pages: [
      {
        id: 'p1',
        role: 'cover',
        eyebrow: 'UI 灵感 v2 · 第二批验收',
        name: '战略信息图三大核心模块',
        keyLine: '环形增长飞轮、冰山归因模型与五维能力雷达图全量落地',
        focus: '三大战略信息图模块',
        note: '纯公开虚构示例 · 100% 原生 PPTX 可编辑',
        data: [
          { label: 'v2 第二批', value: '3', unit: '大信息图', highlight: true },
          { label: '一键切换版式', value: '12', unit: '套' },
        ],
      },
      {
        id: 'p2',
        role: 'summary',
        eyebrow: '01 生态闭环 · 环形增长飞轮',
        keyLine: '以优质内容供给驱动精准流量、高效转化与口碑裂变的正循环飞轮',
        focus: '四步正循环增长飞轮',
        orbit: {
          title: '内容—流量—转化—复购四步增长飞轮',
          center: { badge: 'CORE', title: '增长飞轮', sub: '持续正循环' },
          nodes: [
            { title: '优质内容供给', detail: '沉淀行业标准化模板与真实复盘案例，建立专业信任度。' },
            { title: '口碑裂变回流', detail: '高满意度老客主动分享，持续带动低成本自然流量回流。' },
            { title: '精准流量承接', detail: '多渠道线索统一接入并自动打标分流，缩短响应时长。' },
            { title: '高效交付转化', detail: '秒级成稿体验显著提升客户付费意愿与年度续约率。' },
          ],
        },
        statements: [
          { id: 'verdict', label: '飞轮判断', text: '把交付体验做成口碑起点后，自然获客占比已由 18% 提升至 41%。', tone: 'judgment' },
        ],
      },
      {
        id: 'p3',
        role: 'summary',
        eyebrow: '02 深度复盘 · 冰山归因模型',
        keyLine: '穿透转化放缓与复购持平的表象，直击机制、工具与激励三大深层根因',
        focus: '三大水下深层根因',
        iceberg: {
          title: '线索转化放缓问题 · 冰山双层深度归因',
          waterlineLabel: '海平面 · 透过现象看本质（80% 根因在水下）',
          surface: {
            title: '水面之上 · 可见表象（20%）',
            badge: '外显症状',
            summary: 'Q3 线索转化周期拉长 18%，重点区域复购占比连续两月持平，前端团队加班频次上升但产出未同步放大。',
          },
          deep: {
            items: [
              { tag: '根因 01', title: '跨部门交接机制断层', detail: '市场、销售与交付三段缺少统一 SLA 响应标准，线索在交接窗口流失 24%。' },
              { tag: '根因 02', title: '工具链与数据口径割裂', detail: '客户档案与跟进记录分散在 3 套孤立系统，一线重复录入消耗大量精力。' },
              { tag: '根因 03', title: '考核激励与长期留存错配', detail: '现有绩效仅考核前端获客数量，未与 90 天留存率和增购转化绑定。' },
            ],
          },
        },
        statements: [
          { id: 'verdict', label: '治理抓手', text: 'Q4 优先打通统一数据底座与交接 SLA，从水下机制根治效率损耗。', tone: 'judgment' },
        ],
      },
      {
        id: 'p4',
        role: 'summary',
        eyebrow: '03 能力盘点 · 多维雷达评估',
        keyLine: '产品力与交付效率领先行业基准，跨区协同与成本控制为下阶段补强重点',
        focus: '产品力 9.4 分领跑',
        radar: {
          title: '2026 核心团队五维组织能力评估（满分 10 分）',
          max: 10,
          badge: '综合均分 8.5 / 10',
          items: [
            { label: '产品力', value: 9.4, detail: '核心引擎与组件体系领先' },
            { label: '交付效率', value: 8.9, detail: '标准化成稿提效显著' },
            { label: '创新突破', value: 8.6, detail: 'AI 自动化管道落地快' },
            { label: '跨区协同', value: 7.9, detail: '多区域复制节奏待提速' },
            { label: '成本控制', value: 7.7, detail: '外采与算力成本可优化' },
          ],
        },
        statements: [
          { id: 'verdict', label: '补强方向', text: '保持产品力与交付优势，上半年专项补齐跨区协同工具与成本精细化管控。', tone: 'judgment' },
        ],
      },
    ],
  };
}

test('outline-normalizer recognizes orbit, iceberg and radar', () => {
  const res = normalizeAndLintOutline(sampleOutline());
  const pages = res.report.pages;
  assert.equal(pages.length, 4);
  assert.ok(pages[1].activeZones.includes('orbit'));
  assert.ok(pages[2].activeZones.includes('iceberg'));
  assert.ok(pages[3].activeZones.includes('radar'));
});

test('fast:build builds HTML + PPTX with 4 variants per v2 batch2 module and zero DOM overflow', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-ui-v2b2-'));
  const outlineFile = path.join(tmp, 'outline.json');
  const htmlFile = path.join(tmp, 'deck.html');
  const pptxFile = path.join(tmp, 'deck.pptx');
  const previewFile = path.join(tmp, 'preview.png');
  fs.writeFileSync(outlineFile, JSON.stringify(sampleOutline(), null, 2));

  const out = execFileSync(process.execPath, [
    CLI, 'fast:build', outlineFile, htmlFile, '--pptx', pptxFile, '--preview', previewFile,
  ], { encoding: 'utf8', cwd: REPO });

  const summary = JSON.parse(out.trim());
  assert.equal(summary.slides, 4);
  assert.deepEqual(summary.preview?.overflows || [], [], `unexpected DOM overflows: ${JSON.stringify(summary.preview?.overflows)}`);
  assert.equal(summary.pptx?.zipOk, true);

  const html = fs.readFileSync(htmlFile, 'utf8');
  assert.ok(html.includes('闭环卡片流'), 'expected orbit variant 闭环卡片流');
  assert.ok(html.includes('深海强对比'), 'expected iceberg variant 深海强对比');
  assert.ok(html.includes('能力评测条'), 'expected radar variant 能力评测条');
});
