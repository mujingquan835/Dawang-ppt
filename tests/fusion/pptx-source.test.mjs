import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from '../../skills/dawang-ppt/project/node_modules/jszip/lib/index.js';
import { pptxToMarkdown } from '../../skills/dawang-ppt/project/src/fusion/authoring/pptx-source.mjs';

test('a pptx becomes page-by-page markdown with its tables, notes and pictures', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-')), zip = new JSZip(), R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  try {
    zip.file('ppt/presentation.xml', `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>`);
    zip.file('ppt/_rels/presentation.xml.rels', `<Relationships><Relationship Id="rId1" Type="${R}/slide" Target="slides/slide1.xml"/></Relationships>`);
    zip.file('ppt/slides/slide1.xml', `<p:sld><a:p><a:r><a:t>新签 48 单</a:t></a:r></a:p><a:tbl><a:tr h="1"><a:tc><a:txBody><a:p><a:r><a:t>项</a:t></a:r></a:p></a:txBody></a:tc></a:tr><a:tr h="1"><a:tc><a:txBody><a:p><a:r><a:t>甲</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl><a:blip r:embed="rId2"/></p:sld>`);
    zip.file('ppt/slides/_rels/slide1.xml.rels', `<Relationships><Relationship Id="rId2" Type="${R}/image" Target="../media/image1.png"/><Relationship Id="rId3" Type="${R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`);
    zip.file('ppt/media/image1.png', Buffer.from([137, 80, 78, 71]));
    zip.file('ppt/notesSlides/notesSlide1.xml', `<p:notes><a:p><a:r><a:t>讲稿备注</a:t></a:r></a:p></p:notes>`);
    const file = path.join(dir, 'a.pptx'); fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
    const r = await pptxToMarkdown(file, path.join(dir, 'out')), md = fs.readFileSync(r.markdown, 'utf8');
    assert.equal(r.slides, 1); assert.equal(r.images, 1);
    for (const piece of ['# 第 1 页', '- 新签 48 单', '| 项 |', '| 甲 |', '![第 1 页图 1](media/s01-1.png)', '> 讲稿备注']) assert(md.includes(piece), piece);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
