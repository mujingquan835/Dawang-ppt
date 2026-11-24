import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline.mjs';
import { normalizeAndLintOutline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-normalizer.mjs';
import { buildOutlineBaseline } from '../../skills/dawang-ppt/project/src/fusion/authoring/outline-baseline.mjs';
import { reviewVisualDecisions } from '../../skills/dawang-ppt/project/src/fusion/qa/visual-decisions.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const DAWANG = path.join(REPO, 'skills/dawang-ppt/scripts/dawang.mjs');

function runCli(args) {
  const res = spawnSync(process.execPath, [DAWANG, ...args], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

function createSampleAssets(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const py = `
from pathlib import Path
from PIL import Image
d = Path(${JSON.stringify(dir)})
# 1. Desktop dashboard screenshot (16:10, 1280x800)
Image.new("RGB", (1280, 800), (242, 246, 252)).save(d / "后台数据看板截图.png", format="PNG")
# 2. Vertical campaign poster (9:16, 720x1280)
Image.new("RGB", (720, 1280), (255, 245, 235)).save(d / "双11战报海报.png", format="PNG")
# 3. Ultra-tall screenshot without keyword (600x1400, ratio=0.43)
Image.new("RGB", (600, 1400), (235, 248, 240)).save(d / "detail_01.png", format="PNG")
# 4. Live event photo (3:2 landscape)
Image.new("RGB", (1200, 800), (80, 110, 160)).save(d / "活动现场合影.jpg", format="JPEG")
`;
  const res = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr || res.stdout);
}

test('ingest v2 detects screenshot and poster kindHint cleanly alongside regular photos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-ingest-kinds-'));
  try {
    const srcDir = path.join(dir, 'src');
    const outDir = path.join(dir, 'ingest');
    createSampleAssets(srcDir);
    const out = runCli(['ingest', srcDir, '--out', outDir]);
    assert.equal(out.ok, true);
    assert.equal(out.imageCount, 4);
    assert.ok(fs.existsSync(out.contactSheet));

    const byName = new Map(out.images.map((im) => [im.rel, im]));
    assert.equal(byName.get('后台数据看板截图.png').kindHint, 'screenshot');
    assert.equal(byName.get('双11战报海报.png').kindHint, 'poster');
    assert.equal(byName.get('detail_01.png').kindHint, 'poster');
    assert.equal(byName.get('活动现场合影.jpg').kindHint, 'photo');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('section & closing slides + screenshot/poster contain frame mode work end-to-end across HTML, variants, and PPTX', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-sec-cl-'));
  try {
    const srcDir = path.join(dir, 'src');
    const ingestDir = path.join(dir, 'ingest');
    const wsDir = path.join(dir, 'ws');
    createSampleAssets(srcDir);
    const packRes = runCli(['ingest', srcDir, '--out', ingestDir]);
    const byName = new Map(packRes.images.map((im) => [im.rel, im]));
    const shotId = byName.get('后台数据看板截图.png').id;
    const posterId = byName.get('双11战报海报.png').id;
    const liveId = byName.get('活动现场合影.jpg').id;

    const outlinePath = path.join(dir, 'outline.json');
    fs.writeFileSync(outlinePath, JSON.stringify({
      title: '2026 年度业务总结汇报',
      period: '2026 全年',
      audience: '管理层',
      palette: 'blue-gold',
      sources: [{ sourceId: 's1', kind: 'notes', title: '测试素材' }],
      pages: [
        {
          id: 'p1',
          role: 'cover',
          eyebrow: '2026 年度汇报',
          name: '多线突破 · 数智提效',
          keyLine: '全年达成 482 万元目标，完成率 118%',
          focus: '118%',
          note: '市场部 · 2026年终',
          data: [
            { label: '年度营收', value: '482', unit: '万元', highlight: true },
            { label: '目标完成率', value: '118', unit: '%' },
          ],
          photos: [{ id: shotId, caption: '全年看板封面' }],
        },
        {
          id: 'p2',
          role: 'section',
          part: 'PART 01',
          name: '核心成果与系统赋能',
          keyLine: '聚焦后台实时看板与双 11 标杆海报转化闭环',
          items: [
            { title: '看板实时监控', detail: 'T+0 同步各门店线索与带看漏斗数据' },
            { title: '战报标准化', detail: '模板复用与多渠道快速传播激活' },
            { title: '现场转化闭环', detail: '线下活动蓄水支撑核心节点冲刺' },
          ],
          data: [{ label: '看板覆盖率', value: '100', unit: '%' }],
        },
        {
          id: 'p3',
          role: 'results',
          eyebrow: '系统与传播证据',
          keyLine: '后台看板与战报海报完整呈现核心战果 482 万元',
          data: [
            { label: '年度营收', value: '482', unit: '万元', target: '410', highlight: true },
            { label: '双11战报曝光', value: '15.8', unit: '万次' },
          ],
          items: [
            { title: '看板全链路留痕', detail: '所有线索转化阶段在系统大屏透明可查。' },
            { title: '双11长图海报传播', detail: '战报海报完整展示区域排名与喜报激励。' },
          ],
          photos: [
            { id: shotId, caption: '后台实时数据看板截图' },
            { id: posterId, caption: '双11竖版战报海报' },
            { id: liveId, caption: '线下活动现场合影' },
          ],
        },
        {
          id: 'p4',
          role: 'section',
          name: '下阶段增长规划',
          keyLine: '以复盘促增长，面向 2027 冲刺更高规模',
          data: [{ label: '新增门店目标', value: '150', unit: '家' }],
        },
        {
          id: 'p5',
          role: 'closing',
          eyebrow: '2027 展望与致谢',
          name: '凝心聚力 · 感谢聆听',
          keyLine: '感谢各位领导指导，2027 冲刺 600 万元年度新目标',
          focus: '600 万元',
          data: [
            { label: '2027 目标', value: '600', unit: '万元', highlight: true },
            { label: '年度收官完成率', value: '118', unit: '%' },
          ],
          items: [
            { title: '抓手一：工具复制', detail: '将实时看板与极速出图模板推广至全域门店。' },
            { title: '抓手二：大促联动', detail: '提前 30 天启动节点蓄水与跨部门联合排期。' },
            { title: '抓手三：标准交付', detail: '建立周复盘闭环机制保障每场活动可量化。' },
          ],
          note: '汇报人 · 2026年12月 · Q&A 环节',
        },
      ],
    }));

    const outHtml = path.join(dir, 'report.html');
    const outPptx = path.join(dir, 'report.pptx');
    const previewPng = path.join(dir, 'preview.png');
    const res = runCli(['fast:build', outlinePath, outHtml, '--pack', packRes.packFile, '--pptx', outPptx, '--preview', previewPng, '--workspace', wsDir]);

    assert.equal(res.ok, true);
    assert.equal(res.slides, 5);
    assert.deepEqual(res.preview.overflows, []);
    assert.deepEqual(res.compose.sparse, []);
    assert.equal(res.pptx.zipOk, true);
    assert.ok(fs.existsSync(outHtml));
    assert.ok(fs.existsSync(outPptx));

    // Check section & closing scales + variants count >= 3
    assert.equal(res.compose.scales.p2, 'section');
    assert.equal(res.compose.scales.p4, 'section');
    assert.equal(res.compose.scales.p5, 'closing');
    for (const pid of ['p1', 'p2', 'p4', 'p5']) {
      const lv = res.compose.layoutVariants.find((v) => v.slideId === pid);
      assert.ok(lv && lv.count >= 4, `${pid} should have >=4 variants, got ${lv?.count}`);
    }

    const proj = JSON.parse(fs.readFileSync(path.join(wsDir, 'deck-project.json'), 'utf8'));
    // Verify second section slide renders watermark '02' automatically
    const s4 = proj.slides.find((s) => s.slideId === 'p4');
    assert.equal(s4.elements.find((e) => e.id === 'sec-watermark')?.text, '02');

    // Verify screenshot & poster on p3 rendered as fit: 'contain' preserving exact aspect ratios, while live photo stays fit: 'cover'
    const s3 = proj.slides.find((s) => s.slideId === 'p3');
    const imgs3 = s3.elements.filter((e) => e.type === 'image');
    const shotImg = imgs3.find((e) => e.alt === '后台实时数据看板截图');
    const posterImg = imgs3.find((e) => e.alt === '双11竖版战报海报');
    const liveImg = imgs3.find((e) => e.alt === '线下活动现场合影');
    assert.equal(shotImg.fit, 'contain');
    assert.equal(posterImg.fit, 'contain');
    assert.equal(liveImg.fit, 'cover');

    // Check natural vs rendered ratio tolerance (< 3%)
    const ratioErr = (img) => {
      const rr = img.bounds[2] / img.bounds[3];
      const nr = img.naturalSize[0] / img.naturalSize[1];
      return Math.abs(rr - nr) / nr;
    };
    assert.ok(ratioErr(shotImg) < 0.03, `screenshot ratio distortion: ${ratioErr(shotImg)}`);
    assert.ok(ratioErr(posterImg) < 0.03, `poster ratio distortion: ${ratioErr(posterImg)}`);

    // Desktop screenshot card has browser window chrome dots (ph1-dot-1)
    assert.ok(s3.elements.some((e) => e.id === 'ph1-dot-1'));
    // Poster card does NOT have window chrome dots (clean mat frame)
    assert.ok(!s3.elements.some((e) => e.id === 'ph2-dot-1'));
    assert.ok(s3.elements.some((e) => e.id === 'ph2-card'));

    // Cover screenshot also uses contain frame cleanly
    const s1 = proj.slides.find((s) => s.slideId === 'p1');
    const covImg = s1.elements.find((e) => e.type === 'image');
    assert.equal(covImg.fit, 'contain');
    assert.ok(ratioErr(covImg) < 0.03);

    // Composition & visual lint passes cleanly across deck (even when visualContract strict is enabled)
    const visualIssues = reviewVisualDecisions(proj);
    assert.equal(visualIssues.issues?.filter((i) => i.kind === 'image-group-gaps').length || 0, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('outline check, normalizer monotony reset, and baseline contracts support section & closing roles', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-roles-norm-'));
  try {
    const imgPath = path.join(dir, '现场照片.jpg');
    spawnSync('python3', ['-c', `from PIL import Image; Image.new("RGB", (900, 600), (120, 140, 160)).save(${JSON.stringify(imgPath)}, format="JPEG")`], { encoding: 'utf8' });

    const outline = {
      kind: 'report',
      scope: 'full',
      title: '测试合同汇报',
      period: '2026年',
      audience: '管理层',
      sources: [{ sourceId: 's1', kind: 'notes', title: '测试来源' }],
      pages: [
        { id: 'p1', role: 'cover', keyLine: { text: '全年完成 100 万元', source: 'quoted', from: '来源1' }, from: { locator: '封面', excerpt: '100万元' } },
        { id: 'p2', role: 'results', keyLine: { text: '营收 100 万元', source: 'quoted', from: 'p2' }, data: [{ label: '营收', value: '100', unit: '万元', target: '90', from: { locator: 'B1', excerpt: '100万元' } }] },
        { id: 'p3', role: 'issues', keyLine: { text: '复盘问题因为响应慢已建立措施', source: 'quoted', from: 'p3' }, statements: [{ id: 'st', label: '问题', text: '响应慢因为缺乏看板，已制定措施解决', from: { locator: 'B2', excerpt: '响应慢' } }] },
        { id: 'p4', role: 'actions', keyLine: { text: '动作一推进落地', source: 'quoted', from: 'p4' }, items: [{ title: '动作A', detail: '详情A', from: { locator: 'B3', excerpt: '动作A' } }] },
        { id: 'p5', role: 'section', name: '第二章：规划', keyLine: { text: '聚焦新一年指标', source: 'quoted', from: 'p5' } },
        { id: 'p6', role: 'plan', keyLine: { text: '12月底前落地，负责人张三', source: 'quoted', from: 'p6' }, items: [{ title: '动作B', detail: '12月底前，负责人张三', from: { locator: 'B4', excerpt: '动作B' } }] },
        { id: 'p7', role: 'actions', keyLine: { text: '落地 2 项动作', source: 'quoted', from: 'p7' }, items: [{ title: '动作C', detail: '详情C 2', from: { locator: 'B5', excerpt: '动作C' } }] },
        { id: 'p8', role: 'closing', name: '感谢聆听', keyLine: { text: '明年冲刺 100 万元目标，请各位领导指导', source: 'quoted', from: 'p8' }, photos: [{ src: imgPath, fit: 'contain', from: { locator: '附1', excerpt: '合影' } }] },
      ],
    };

    const chk = checkOutline(outline, { baseDir: dir });
    assert.equal(chk.ok, true);
    assert.deepEqual(chk.gaps, []);
    assert.equal(chk.warnings.some((w) => w.page === 'p5' && w.item === 'role'), false);
    assert.equal(chk.warnings.some((w) => w.page === 'p8' && w.item === 'role'), false);

    const { outline: norm, report } = normalizeAndLintOutline(outline, { baseDir: dir });
    assert.equal(norm.pages[4].role, 'section');
    assert.equal(norm.pages[7].role, 'closing');
    // section & closing are never flagged as sparse
    assert.equal(report.sparsePages.includes('p5'), false);
    assert.equal(report.sparsePages.includes('p8'), false);
    // section resets items-only streak so 2 items pages -> section -> 2 items pages does NOT false-warn monotony!
    assert.equal(report.warnings.some((w) => w.code === 'layout-monotony'), false);

    // Baseline scaffold validates cleanly for section & closing
    const baseRes = buildOutlineBaseline(norm, { baseDir: dir });
    assert.equal(baseRes.ok, true, JSON.stringify(baseRes.issues));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
