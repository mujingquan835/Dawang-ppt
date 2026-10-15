import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportEditablePptx } from '../../skills/dawang-ppt/project/src/fusion/export/pptx.mjs';

test('editable export reports integrity of the file delivered on disk', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawang-opc-'));
  try {
    const fileName = path.join(dir, 'editable.pptx');
    const collection = { revision: 'fixture', slides: [{ slideId: 's', objects: [
      { id: 't', type: 'text', text: '合成校验夹具', bounds: [100, 100, 800, 120], style: { fontSize: 60 } }
    ] }] };
    const report = await exportEditablePptx(collection, { fileName });
    assert.equal(report.zipIntegrity?.ok, true, 'export must validate actual package bytes');
    assert.equal(report.zipIntegrity.slides, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(fileName + '.report.json')).zipIntegrity, report.zipIntegrity);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
