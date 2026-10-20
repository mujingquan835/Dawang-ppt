import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as manifestApi from '../../skills/dawang-ppt/project/src/fusion/kimi/rule-manifest.mjs';
import * as references from '../../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-rules-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'rule.md');
  fs.writeFileSync(file, 'abc');
  return { dir, file };
}
const decision = (status = 'applicable', extra = {}) => ({ ruleId: 'readability', sourceId: 'general', status, reason: '', slideIds: ['cover'], evidencePaths: [], ...extra });
const create = (file, decisions = [decision()]) => manifestApi.createRuleManifest({ sourceFiles: [{ id: 'general', path: file, section: 'layout' }], decisions });
const codes = (manifest) => manifestApi.validateRuleManifest(manifest).map((i) => i.code);

test('source bytes are fingerprinted without copying upstream text', (t) => {
  const { file } = fixture(t);
  const manifest = create(file);
  assert.deepEqual(manifest.sources, [{ id: 'general', path: file, section: 'layout', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }]);
  assert.deepEqual(manifestApi.validateRuleManifest(JSON.parse(JSON.stringify(manifest))), []);
  assert.equal(JSON.stringify(manifest).includes('abc'), false);
});

test('missing sources are recorded and cannot silently pass', (t) => {
  const { dir } = fixture(t);
  const manifest = create(path.join(dir, 'missing.md'));
  assert.equal(manifest.sources[0].sha256, null);
  assert(codes(manifest).includes('source-missing'));
});

test('changed or removed source is detected after manifest creation', (t) => {
  const { file } = fixture(t);
  const manifest = create(file);
  fs.writeFileSync(file, 'changed');
  assert(codes(manifest).includes('source-hash-changed'));
  fs.unlinkSync(file);
  assert(codes(manifest).includes('source-missing'));
});

test('not-applicable and user-overridden require a nonempty reason', (t) => {
  const { file } = fixture(t);
  for (const status of ['not-applicable', 'user-overridden']) {
    assert(codes(create(file, [decision(status, { reason: '  ' })])).includes('decision-reason-required'));
    assert.deepEqual(codes(create(file, [decision(status, { reason: 'User requested no charts.' })])), []);
  }
});

test('unsupported remains an explicit issue even with reason and evidence', (t) => {
  const { file } = fixture(t);
  assert(codes(create(file, [decision('unsupported', { reason: 'Not implemented', evidencePaths: ['review.md'] })])).includes('rule-unsupported'));
  assert(codes(create(file, [decision('passed')])).includes('decision-status-invalid'));
});

test('unknown references and duplicate identifiers cannot pass', (t) => {
  const { file } = fixture(t);
  assert(codes(create(file, [decision('applicable', { sourceId: 'unknown' })])).includes('decision-source-unknown'));
  const manifest = create(file);
  manifest.sources.push({ ...manifest.sources[0] });
  manifest.decisions.push({ ...manifest.decisions[0] });
  assert(codes(manifest).includes('source-id-duplicate'));
  assert(codes(manifest).includes('rule-id-duplicate'));
});

test('malformed or empty manifests produce issues rather than false success', (t) => {
  const { file } = fixture(t);
  for (const value of [null, {}, { sources: [], decisions: [] }, { sources: [null], decisions: [null] }]) {
    assert(manifestApi.validateRuleManifest(value).length > 0);
  }
  const manifest = create(file);
  manifest.sources[0].sha256 = 'invalid';
  manifest.decisions[0].slideIds = 'cover';
  manifest.decisions[0].evidencePaths = null;
  assert(codes(manifest).includes('source-hash-invalid'));
  assert(codes(manifest).includes('decision-slide-ids-invalid'));
  assert(codes(manifest).includes('decision-evidence-paths-invalid'));
});

test('authoring references include original workflow and only requested documents', (t) => {
  const { dir } = fixture(t);
  fs.mkdirSync(path.join(dir, 'reference/slides_categories'), { recursive: true });
  for (const file of ['SKILL.md', 'reference/slides_categories.md', 'reference/slides_categories/business-plan.md', 'reference/pptd.md']) {
    fs.writeFileSync(path.join(dir, file), 'synthetic rules');
  }
  const sourceFiles = references.authoringRuleSources({ root: dir, scenarioId: 'business-plan', formatDocs: ['pptd.md'] });
  assert.deepEqual(sourceFiles.map((s) => s.id), ['workflow', 'general', 'scenario:business-plan', 'format:pptd.md']);
  const manifest = manifestApi.createRuleManifest({ sourceFiles, decisions: [decision()] });
  assert.deepEqual(codes(manifest), []);
  fs.unlinkSync(path.join(dir, 'SKILL.md'));
  assert(codes(manifestApi.createRuleManifest({ sourceFiles, decisions: [decision()] })).includes('source-missing'));
  assert.throws(() => references.authoringRuleSources({ root: dir, scenarioId: 'invented' }), /Unknown scenario/);
  assert.throws(() => references.authoringRuleSources({ root: null, scenarioId: 'business-plan' }), /KIMI_PPT_SKILL_DIR/);
});
