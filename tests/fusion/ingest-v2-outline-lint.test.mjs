import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { imageSize } from '../../skills/dawang-ppt/project/src/fusion/authoring/layout-kit.mjs';

const REPO = path.resolve(import.meta.dirname, '../..');
const DAWANG = path.join(REPO, 'skills/dawang-ppt/scripts/dawang.mjs');

function makeFixtures(baseDir) {
  const py = `
import io, os, zipfile, struct
from pathlib import Path
from PIL import Image
import openpyxl

base = Path(${JSON.stringify(baseDir)})
raw = base / "raw"
raw.mkdir(parents=True, exist_ok=True)

# 1. WebP screenshot image (480x320)
webp_path = raw / "系统后台截图.webp"
Image.new("RGB", (480, 320), (30, 80, 160)).save(webp_path, format="WEBP")

# 2. JPEG with raw 400x300 pixels + EXIF Orientation = 6 (visual portrait 300x400)
jpg_path = raw / "竖拍活动照.jpg"
im_jpg = Image.new("RGB", (400, 300), (200, 120, 40))
exif = Image.Exif()
exif[0x0112] = 6
im_jpg.save(jpg_path, format="JPEG", exif=exif.tobytes())

# Helper PNG bytes
def png_bytes(w, h, color):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()

logo_bytes = png_bytes(200, 200, (10, 20, 30))
hist_bytes = png_bytes(320, 200, (180, 90, 90))
draft_chart_bytes = png_bytes(640, 360, (40, 140, 90))
docx_pic_bytes = png_bytes(400, 300, (120, 60, 180))

# 3. Historical PPTX (2 slides)
hist_pptx = base / "2025历史汇报.pptx"
with zipfile.ZipFile(hist_pptx, "w") as z:
    z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
    z.writestr("ppt/presentation.xml", '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>')
    z.writestr("ppt/_rels/presentation.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>')
    z.writestr("ppt/slides/slide1.xml", '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>2025年度历史成果总结</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>')
    z.writestr("ppt/slides/slide2.xml", '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>2025年线下大会现场</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:blipFill><a:blip r:embed="rId1"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>')
    z.writestr("ppt/slides/_rels/slide2.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="../media/hist1.png"/></Relationships>')
    z.writestr("ppt/media/hist1.png", hist_bytes)

# 4. Draft PPTX (4 slides, repeated master logo on all 4 slides + unique image + native table + speaker note)
draft_pptx = base / "Q3粗版草稿.pptx"
with zipfile.ZipFile(draft_pptx, "w") as z:
    z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
    sld_ids = "".join(f'<p:sldId id="{255+i}" r:id="rId{i}"/>' for i in range(1, 5))
    pres_rels = "".join(f'<Relationship Id="rId{i}" Target="slides/slide{i}.xml"/>' for i in range(1, 5))
    z.writestr("ppt/presentation.xml", f'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>{sld_ids}</p:sldIdLst></p:presentation>')
    z.writestr("ppt/_rels/presentation.xml.rels", f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{pres_rels}</Relationships>')
    z.writestr("ppt/media/logo.png", logo_bytes)
    z.writestr("ppt/media/chart.png", draft_chart_bytes)
    for i in range(1, 5):
        tbl_xml = ""
        if i == 3:
            tbl_xml = '<a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>区域</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>完成率</a:t></a:r></a:p></a:txBody></a:tc></a:tr><a:tr><a:tc><a:txBody><a:p><a:r><a:t>华东</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>112%</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl>'
        extra_blip = '<p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic>' if i == 2 else ""
        z.writestr(f"ppt/slides/slide{i}.xml", f'<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>粗版第{i}页标题</a:t></a:r></a:p></p:txBody></p:sp>{tbl_xml}<p:pic><p:blipFill><a:blip r:embed="rId1"/></p:blipFill></p:pic>{extra_blip}</p:spTree></p:cSld></p:sld>')
        rels = '<Relationship Id="rId1" Target="../media/logo.png"/>'
        if i == 2:
            rels += '<Relationship Id="rId2" Target="../media/chart.png"/>'
        if i == 1:
            rels += '<Relationship Id="rId3" Target="../notesSlides/notesSlide1.xml"/>'
            z.writestr("ppt/notesSlides/notesSlide1.xml", '<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>制作说明：首页数字仅作内部对齐，对外不放进PPT</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>')
        z.writestr(f"ppt/slides/_rels/slide{i}.xml.rels", f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rels}</Relationships>')

# 5. DOCX (> 130 paragraphs + heading + table + embedded image)
docx_path = raw / "Q3复盘长文.docx"
paras = ['<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>一、季度复盘总览</w:t></w:r></w:p>']
for k in range(1, 136):
    paras.append(f'<w:p><w:r><w:t>复盘要点段落编号-{k}</w:t></w:r></w:p>')
tbl_doc = '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>项目</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>进度</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>中台升级</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>100%</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
with zipfile.ZipFile(docx_path, "w") as z:
    z.writestr("word/document.xml", f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{"".join(paras)}{tbl_doc}</w:body></w:document>')
    z.writestr("word/media/docx_pic.png", docx_pic_bytes)

# 6. XLSX with explicit total row (2500 should not double-count to 5000)
xlsx_path = raw / "渠道业绩明细.xlsx"
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "渠道分布"
ws.append(["渠道", "成交额", "同比"])
ws.append(["线上渠道", "1,200 万", "+35%"])
ws.append(["直营门店", "800 万", "+18%"])
ws.append(["伙伴联营", "500 万", "+12%"])
ws.append(["合计", "2,500 万", "+24%"])
wb.save(xlsx_path)
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
}

test('layout-kit imageSize handles WebP and EXIF orientation=6 portrait JPEGs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-img-size-'));
  try {
    makeFixtures(tmp);
    const webpSz = imageSize(path.join(tmp, 'raw/系统后台截图.webp'));
    assert.deepEqual(webpSz, { width: 480, height: 320 });

    const jpgSz = imageSize(path.join(tmp, 'raw/竖拍活动照.jpg'));
    assert.deepEqual(jpgSz, { width: 300, height: 400 });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ingest v2 + outline:lint + fast:build end-to-end with multi-source role inputs, short IDs, WebP & EXIF JPEG', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-p0-e2e-'));
  try {
    makeFixtures(tmp);
    const ingestOut = path.join(tmp, 'ingested');

    // 1. Multi-source ingest with --draft, --history, --note, --out
    const ingestRes = spawnSync(
      process.execPath,
      [
        DAWANG,
        'ingest',
        path.join(tmp, 'raw'),
        '--draft',
        path.join(tmp, 'Q3粗版草稿.pptx'),
        '--history',
        path.join(tmp, '2025历史汇报.pptx'),
        '--note',
        '重点突出渠道增长；内部底价不放进PPT',
        '--out',
        ingestOut,
      ],
      { encoding: 'utf8' }
    );
    assert.equal(ingestRes.status, 0, ingestRes.stderr || ingestRes.stdout);
    const ingestReport = JSON.parse(ingestRes.stdout);
    assert.equal(ingestReport.ok, true);
    assert.ok(fs.existsSync(ingestReport.briefFile));
    assert.ok(fs.existsSync(ingestReport.packFile));
    assert.ok(fs.existsSync(ingestReport.contactSheet));
    assert.ok(ingestReport.skippedMasterImages >= 1, 'repeated master logo across 4 slides must be filtered');

    const pack = JSON.parse(fs.readFileSync(ingestReport.packFile, 'utf8'));
    const brief = fs.readFileSync(ingestReport.briefFile, 'utf8');

    // Verify oral directives extracted & topped
    assert.ok(pack.oralDirectives.some((d) => d.text.includes('内部底价不放进PPT')));
    assert.ok(brief.indexOf('口述要求与上屏禁令') < brief.indexOf('结构化表格资产'));

    // Verify DOCX had >120 paragraphs intact, plus table and embedded image
    assert.ok(brief.includes('复盘要点段落编号-135'), 'DOCX must not be truncated at 120 paragraphs');
    assert.ok(pack.tables.some((t) => t.source.includes('Q3复盘长文.docx')));
    assert.ok(pack.images.some((im) => im.rel.includes('docx_pic.png')));

    // Verify XLSX aggregation excluded total row and computed breakdown pct [48, 32, 20]
    const xlsxTbl = pack.tables.find((t) => t.source.includes('渠道业绩明细.xlsx'));
    assert.ok(xlsxTbl, 'XLSX table should be registered');
    assert.equal(xlsxTbl.excludedTotalRows, 1);
    const amtStat = xlsxTbl.stats.find((s) => s.column === '成交额');
    assert.equal(amtStat.sum, 2500);
    assert.deepEqual(
      xlsxTbl.breakdownHint.items.map((x) => x.pct),
      [48, 32, 20]
    );

    // Verify image metadata: history tag, screenshot kindHint, EXIF portrait dimensions
    const histImg = pack.images.find((im) => im.rel.includes('2025历史汇报.pptx'));
    assert.equal(histImg?.fromHistory, true);
    const webpImg = pack.images.find((im) => im.rel.includes('系统后台截图.webp'));
    assert.equal(webpImg?.kindHint, 'screenshot');
    const portraitImg = pack.images.find((im) => im.rel.includes('竖拍活动照.jpg'));
    assert.equal(portraitImg?.width, 300);
    assert.equal(portraitImg?.height, 400);
    assert.equal(portraitImg?.orientation, '竖图');
    assert.equal(portraitImg?.recommendedFocal, '50% 25%');

    // 2. outline:lint with short IDs, manual numberings, missing pct, history warning & overload page
    const lintOutlineFile = path.join(ingestOut, 'outline-lint-test.json');
    const mdPlanFile = path.join(ingestOut, 'outline-plan.md');
    fs.writeFileSync(
      lintOutlineFile,
      JSON.stringify(
        {
          title: 'Q3 渠道增长复盘',
          period: '2026年Q3',
          palette: 'blue-gold',
          pages: [
            {
              id: 'p1',
              role: 'cover',
              keyLine: '三季度渠道成交 2,500 万，超额完成目标',
              data: [{ label: '总成交额', value: '2,500', unit: '万' }],
              photos: [webpImg.id],
            },
            {
              id: 'p2',
              role: 'summary',
              keyLine: '线上渠道贡献 48%，驱动整体增长',
              breakdown: {
                title: '渠道构成',
                total: '2,500 万',
                items: [
                  { label: '线上渠道', value: '1,200 万' },
                  { label: '直营门店', value: '800 万' },
                  { label: '伙伴联营', value: '500 万' },
                ],
              },
              items: [
                { title: '01 线上拓客', detail: '投放ROI提升35%' },
                { title: '2. 门店提效', detail: '重点门店周转化翻倍' },
              ],
              photos: [portraitImg.id, histImg.id],
            },
            {
              id: 'p3',
              role: 'results',
              keyLine: '渠道明细与多维度超载测试页',
              data: [
                { label: '成交额', value: '2,500', unit: '万' },
                { label: '同比', value: '+24', unit: '%' },
              ],
              table: xlsxTbl.id,
              compare: {
                leftLabel: 'Q2',
                rightLabel: 'Q3',
                left: [{ title: '覆盖', detail: '10城' }],
                right: [{ title: '覆盖', detail: '18城' }],
              },
              periods: [
                { label: '7月', title: '蓄水', points: ['建库'] },
                { label: '8月', title: '放量', points: ['冲刺'] },
              ],
              items: [
                { title: '动作A', detail: '说明A' },
                { title: '动作B', detail: '说明B' },
                { title: '动作C', detail: '说明C' },
                { title: '动作D', detail: '说明D' },
              ],
            },
          ],
        },
        null,
        2
      )
    );

    const lintRes = spawnSync(
      process.execPath,
      [DAWANG, 'outline:lint', lintOutlineFile, '--md', mdPlanFile],
      { encoding: 'utf8' }
    );
    assert.equal(lintRes.status, 0, lintRes.stderr || lintRes.stdout);
    const lintReport = JSON.parse(lintRes.stdout);
    assert.equal(lintReport.ok, true);
    assert.equal(lintReport.resolvedPhotosCount, 3);
    assert.equal(lintReport.resolvedTablesCount, 1);
    assert.ok(lintReport.overloadPages.includes('p3'), 'p3 should be flagged as overload');
    assert.ok(lintReport.warnings.some((w) => w.code === 'history-image-used'));
    assert.ok(lintReport.autoFixes.some((f) => f.to === '线上拓客'));
    assert.ok(lintReport.autoFixes.some((f) => f.to === '门店提效'));
    assert.ok(lintReport.autoFixes.some((f) => f.field === 'breakdown.items[].pct' && f.to === '48/32/20'));
    assert.ok(fs.existsSync(mdPlanFile));
    assert.ok(fs.readFileSync(mdPlanFile, 'utf8').includes('版式解耦说明'));

    // 3. fast:build directly from short-ID outline with WebP + EXIF portrait JPEG + TBL short ID
    const buildOutlineFile = path.join(ingestOut, 'outline-build.json');
    fs.writeFileSync(
      buildOutlineFile,
      JSON.stringify(
        {
          title: 'Q3 渠道增长汇报',
          period: '2026年Q3',
          palette: 'blue-gold',
          pages: [
            {
              id: 'p1',
              role: 'cover',
              keyLine: '三季度渠道成交 2,500 万，线上贡献近半',
              data: [{ label: '渠道总成交', value: '2,500', unit: '万' }],
              photos: [{ id: webpImg.id, caption: '后台实时看板' }],
            },
            {
              id: 'p2',
              role: 'summary',
              keyLine: '线上渠道占比 48%，直营与联营协同放量',
              breakdown: {
                title: '渠道成交构成',
                total: '2,500 万',
                items: [
                  { label: '线上渠道', value: '1,200 万' },
                  { label: '直营门店', value: '800 万' },
                  { label: '伙伴联营', value: '500 万' },
                ],
              },
              photos: [{ id: portraitImg.id, caption: '活动现场执行' }],
            },
            {
              id: 'p3',
              role: 'results',
              keyLine: '各渠道同比保持两位数增长，Q3 总计 2,500 万',
              table: { id: xlsxTbl.id, highlight: [0] },
              items: [
                { title: '01 线上扩量', detail: '精准投放驱动新客线索增长 35%' },
                { title: '02 门店联动', detail: '重点门店实现线索次日 100% 跟进' },
              ],
            },
          ],
        },
        null,
        2
      )
    );

    const htmlOut = path.join(tmp, 'out.html');
    const pptxOut = path.join(tmp, 'out.pptx');
    const wsDir = path.join(tmp, 'ws');
    const buildRes = spawnSync(
      process.execPath,
      [DAWANG, 'fast:build', buildOutlineFile, htmlOut, '--pptx', pptxOut, '--workspace', wsDir],
      { encoding: 'utf8' }
    );
    assert.equal(buildRes.status, 0, buildRes.stderr || buildRes.stdout);
    const buildReport = JSON.parse(buildRes.stdout);
    assert.equal(buildReport.ok, true);
    assert.equal(buildReport.slides, 3);
    assert.equal(buildReport.pptx.zipOk, true);
    assert.equal(buildReport.outlineLint.resolvedPhotos, 2);
    assert.equal(buildReport.outlineLint.resolvedTables, 1);
    assert.ok(fs.existsSync(htmlOut) && fs.existsSync(pptxOut));
    // Portable HTML should have transcoded WebP to JPEG/PNG so no raw data:image/webp remains
    const htmlStr = fs.readFileSync(htmlOut, 'utf8');
    assert.equal(htmlStr.includes('data:image/webp;base64'), false, 'WebP must be transcoded for PPTX compatibility');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
