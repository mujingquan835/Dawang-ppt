import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeAndLintOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-normalizer.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const DAWANG = path.join(REPO, 'skills/dawang-ppt/scripts/dawang.mjs');

function runFastBuild(outlinePath, outHtml, { previewPng, workspaceDir } = {}) {
  const args = [DAWANG, 'fast:build', outlinePath, outHtml];
  if (previewPng) args.push('--preview', previewPng);
  if (workspaceDir) args.push('--workspace', workspaceDir);
  const res = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

function createTestImages(dir, count = 3) {
  fs.mkdirSync(dir, { recursive: true });
  const py = `
import os
from pathlib import Path
from PIL import Image
out = Path(${JSON.stringify(dir)})
for i in range(1, ${count} + 1):
    w = 960 if i % 3 else 720
    h = 640 if i % 3 else 960
    Image.new("RGB", (w, h), ((i * 37) % 250, (i * 73) % 250, (i * 113) % 250)).save(out / f"pic_{i:03d}.png", format="PNG")
`;
  const res = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  return Array.from({ length: count }, (_, i) => path.join(dir, `pic_${String(i + 1).padStart(3, '0')}.png`));
}

test('resilience 1: cover accepts 4 metrics (window + plain) and lint trims 5 metrics to 4', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-cover4-'));
  try {
    const imgs = createTestImages(path.join(dir, 'imgs'), 1);
    const fiveMetrics = [
      { label: '核心战役', value: '6', unit: '项', highlight: true },
      { label: '异业资源', value: '8', unit: '类' },
      { label: 'AI 工具', value: '3', unit: '套' },
      { label: '覆盖门店', value: '100', unit: '家' },
      { label: '额外冗余', value: '99', unit: '个' },
    ];
    const { outline: linted, report } = normalizeAndLintOutline({
      title: '2026 年度汇报',
      pages: [
        { id: 'p1', role: 'cover', eyebrow: '2026 年度复盘', keyLine: '全年业务与 AI 提效全面落地', data: fiveMetrics, photos: [{ src: imgs[0] }] },
      ],
    });
    assert.equal(linted.pages[0].data.length, 4);
    assert.ok(report.warnings.some((w) => w.code === 'cover-data-trimmed'));

    const outlinePath = path.join(dir, 'outline.json');
    fs.writeFileSync(outlinePath, JSON.stringify({
      title: '2026 年度市场复盘',
      period: '2026 全年',
      pages: [
        { id: 'p1', role: 'cover', eyebrow: '2026 年度复盘', keyLine: '一人多线承接核心业务，节点资源与 AI 双轮提效', data: fiveMetrics.slice(0, 4), photos: [{ src: imgs[0], caption: '右图封面' }] },
        { id: 'p2', role: 'cover', eyebrow: '无图版封面', keyLine: '全宽 4 指标无图封面验证', data: fiveMetrics.slice(0, 4) },
      ],
    }));

    const outHtml = path.join(dir, 'out.html');
    const previewPng = path.join(dir, 'preview.png');
    const res = runFastBuild(outlinePath, outHtml, { previewPng, workspaceDir: path.join(dir, 'ws') });
    assert.equal(res.ok, true);
    assert.equal(res.slides, 2);
    assert.deepEqual(res.preview.overflows, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resilience 2 & 3: high-density table + dual flows without photos succeeds and 48-char keyLine wraps cleanly to 2 lines', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-dense-'));
  try {
    const longHeadline = '面对全年多线并行并发业务压力与高频调整需求，通过八大异业合作资源模块化复用及双链路标准化调度全面实现高效转化增长闭环';
    assert.ok(longHeadline.length >= 58);
    const outlinePath = path.join(dir, 'outline.json');
    fs.writeFileSync(outlinePath, JSON.stringify({
      title: '高密度弹性与双行标题验证',
      pages: [
        {
          id: 'p10',
          role: 'analysis',
          eyebrow: '09 · 资源与调度',
          keyLine: longHeadline,
          statements: [
            { id: 'intro', label: '背景说明', text: '围绕多线节点需求与线下异业场景沉淀八类可复用外部资源池。' },
            { id: 'verdict', label: '运营判断', text: '模块化打包资源比零散配权更易被一线顾问理解与高频转化。', tone: 'judgment' },
          ],
          table: {
            title: '八类异业合作资源清单',
            columns: ['序号', '合作资源方', '核心合作形式', '业务赋能效果'],
            rows: [
              ['1', '京东 MALL 广大厅', '车展大屏+中厅阵地', '品牌曝光与客情联动'],
              ['2', '滨海京东 MALL', '商圈中厅线下承接', '驻场邀约与试驾引流'],
              ['3', '汽车车展门票', '五一与国庆节点置换', '百家门店破冰维护'],
              ['4', '百岁山饮品', '活动赞助联名派发', '门店与市集降温补给'],
              ['5', '康师傅饮品', '清凉季物资共建支持', '服务触达与形象露出'],
              ['6', '海河乳品', '联名伴手礼品定制', '续费促销抽奖奖品'],
              ['7', '蔚来汽车', '主题直播与展车联动', '提升到访体验与留资'],
              ['8', '乐刻运动', '品牌互推与体验券包', '多频客情促单消耗'],
            ],
            highlight: [0, 1],
          },
          flows: [
            { title: '应用链 A · 商圈驱动门店', steps: [{ title: '资源置换', detail: '门票与大屏' }, { title: '门店破冰', detail: '重点门店客情' }, { title: '大促转化', detail: '蓄水双十一' }] },
            { title: '应用链 B · 联名反哺直播', steps: [{ title: '品牌赞助', detail: '饮品与试驾' }, { title: '直播市集', detail: '场域互动激活' }, { title: '促单复购', detail: '三线业务转化' }] },
          ],
        },
      ],
    }));

    const outHtml = path.join(dir, 'out.html');
    const wsDir = path.join(dir, 'ws');
    const previewPng = path.join(dir, 'preview.png');
    const res = runFastBuild(outlinePath, outHtml, { previewPng, workspaceDir: wsDir });
    assert.equal(res.ok, true);
    assert.deepEqual(res.preview.overflows, []);

    const proj = JSON.parse(fs.readFileSync(path.join(wsDir, 'deck-project.json'), 'utf8'));
    const slide = proj.slides[0];
    const titleEl = slide.elements.find((e) => e.id === 'title');
    const hdrRule = slide.elements.find((e) => e.id === 'hdr-rule');
    assert.ok(titleEl.bounds[3] >= 72, `expected 2-line title height >= 72, got ${titleEl.bounds[3]}`);
    assert.ok(titleEl.bounds[1] + titleEl.bounds[3] <= hdrRule.bounds[1] + 2);
    const bodyEls = slide.elements.filter((e) => !['hdr-tag', 'hdr-dot', 'eyebrow', 'title', 'hdr-rule', 'hdr-progress', 'hdr-progress-tip', 'ftr-rule', 'src', 'no'].includes(e.id));
    assert.ok(bodyEls.every((e) => !Array.isArray(e.bounds) || (e.bounds[1] >= hdrRule.bounds[1] + 8 && e.bounds[1] + e.bounds[3] <= 1012)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resilience 4: data + breakdown + items + photos coexist cleanly with target unit dedup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-combo-'));
  try {
    const imgs = createTestImages(path.join(dir, 'imgs'), 3);
    const outlinePath = path.join(dir, 'outline.json');
    fs.writeFileSync(outlinePath, JSON.stringify({
      title: '活动多模块复合验证',
      pages: [
        {
          id: 'p6',
          role: 'case',
          eyebrow: '05 · 活动案例 03',
          keyLine: '喜报后台出图降至 15 秒并收集 150 份喜报，六区共拉动 60 单成交',
          statements: [
            { id: 'verdict', label: '复盘结论', text: '真实喜报建立信任、抽奖提供抓手、后台直出缩短制作周期，形成多线标准动作。', tone: 'judgment' },
          ],
          data: [
            { label: '单张喜报耗时', value: '15', unit: '秒', target: '原 30–60 分', highlight: true },
            { label: '收集喜报总数', value: '150', unit: '份' },
            { label: '辅助签约成交', value: '60', unit: '单' },
            { label: '爱房带看 GTV', value: '600', unit: '万元' },
          ],
          breakdown: {
            title: '六大板块成交拆解',
            total: '444 份',
            items: [
              { label: '二区四部', value: '137 份', pct: 31 },
              { label: '二区五部', value: '122 份', pct: 27 },
              { label: '一区三部', value: '56 份', pct: 13 },
              { label: '一区二部', value: '47 份', pct: 11 },
              { label: '一区一部', value: '42 份', pct: 9 },
              { label: '二区六部', value: '40 份', pct: 9 },
            ],
          },
          itemsHeading: '核心执行动作',
          items: [
            { title: '凭证滚屏传播', detail: '80 家公司每日滚屏转发喜报与活动海报。' },
            { title: '联合直播激励', detail: '联合 20 家开发商开展专项带看直播激发成交。' },
            { title: '脱敏极速直出', detail: '自动识别隐私字段并统一合规海报样式模板。' },
          ],
          photos: imgs.map((src, i) => ({ src, caption: `实景物料 ${i + 1}` })),
        },
      ],
    }));

    const wsDir = path.join(dir, 'ws');
    const res = runFastBuild(outlinePath, path.join(dir, 'out.html'), {
      previewPng: path.join(dir, 'preview.png'),
      workspaceDir: wsDir,
    });
    assert.equal(res.ok, true);
    assert.deepEqual(res.preview.overflows, []);

    const proj = JSON.parse(fs.readFileSync(path.join(wsDir, 'deck-project.json'), 'utf8'));
    const slide = proj.slides[0];
    assert.equal(slide.elements.filter((e) => e.type === 'image').length, 3);
    assert.equal(slide.elements.filter((e) => /^bd-sub-\d+$/.test(e.id)).length, 6);
    const beforeVal = slide.elements.find((e) => e.id === 'm-cp-before-value');
    assert.ok(beforeVal, 'expected comparePair before value');
    assert.equal(beforeVal.text, '原 30–60 分', 'should not double-append 秒 onto 原 30–60 分');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resilience 5: ingest > 80 images generates multi-volume contact sheets and keeps compatibility', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-sheets-'));
  try {
    const imgDir = path.join(dir, 'raw');
    createTestImages(imgDir, 85);
    const outDir = path.join(dir, 'ingest-out');
    const run = spawnSync('node', [DAWANG, 'ingest', imgDir, '--out', outDir], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const report = JSON.parse(run.stdout);
    assert.equal(report.imageCount, 85);
    assert.equal(report.contactSheets.length, 2);
    assert.equal(fs.realpathSync(report.contactSheet), fs.realpathSync(path.join(outDir, 'contact-sheet.png')));
    assert.ok(fs.existsSync(path.join(outDir, 'contact-sheet.png')));
    assert.ok(fs.existsSync(path.join(outDir, 'contact-sheet-2.png')));

    const brief = fs.readFileSync(report.briefFile, 'utf8');
    assert.match(brief, /IMG-01 ~ IMG-80/);
    assert.match(brief, /IMG-81 ~ IMG-85/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resilience 6: repeated fastBuildDeck on same workspaceDir updates smoothly without revision conflict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-wsrev-'));
  try {
    const outlinePath = path.join(dir, 'outline.json');
    const wsDir = path.join(dir, 'ws');
    const outHtml = path.join(dir, 'out.html');

    fs.writeFileSync(outlinePath, JSON.stringify({
      title: '反复微调工作区验证',
      pages: [{ id: 'p1', role: 'summary', keyLine: '首轮测试标题达到 120% 目标', data: [{ label: '达成率', value: '120', unit: '%' }] }],
    }));
    const r1 = runFastBuild(outlinePath, outHtml, { workspaceDir: wsDir });
    assert.equal(r1.ok, true);

    fs.writeFileSync(outlinePath, JSON.stringify({
      title: '反复微调工作区验证',
      pages: [{ id: 'p1', role: 'summary', keyLine: '第二轮微调达到 135% 目标', data: [{ label: '达成率', value: '135', unit: '%' }] }],
    }));
    const r2 = runFastBuild(outlinePath, outHtml, { workspaceDir: wsDir });
    assert.equal(r2.ok, true);
    assert.equal(r2.projectId, r1.projectId);
    assert.notEqual(r2.revision, r1.revision);
    assert.ok(fs.existsSync(path.join(wsDir, '.revisions', `${r1.revision}.json`)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
