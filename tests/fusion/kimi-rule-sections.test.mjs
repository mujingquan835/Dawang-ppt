import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as rules from '../../skills/dawang-ppt/project/src/fusion/kimi/reference-index.mjs';

// Synthetic rule texts only; the real upstream documents are never copied into tests.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-rules-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'reference/slides_categories'), { recursive: true });
  const write = (file, text) => fs.writeFileSync(path.join(root, file), text);
  write('SKILL.md', '---\nname: x\n---\n\n# Definition\nformat\n\n## PPT production workflow\n### step1. Read the context thoroughly\nread all\n```md\n# not a heading\n```\n### step5. PPT output and delivery\nexport pptx\n### Brand new upstream step\nnew\n');
  write('reference/slides_categories.md', '# PPT category guide\n## step1. General rules\n### Requirements\nimages\n### Strictly forbidden\nno cards\n');
  write('reference/slides_categories/business-plan.md', '# Business Proposal\n## Tell a more complete story through SmartArt structural diagrams\nsmartart\n## Key Requirements\nkeep\n');
  const lockFile = path.join(root, 'lock.json');
  return { root, lockFile, write };
}

test('sections split by heading, ignore fenced headings and keep line ranges', () => {
  const sections = rules.splitRuleSections('intro\n# A\none\n```\n# fenced\n```\n## B\ntwo');
  assert.deepEqual(sections.map((s) => s.heading), ['(preamble)', 'A', 'B']);
  assert.deepEqual(sections[1].lines, [2, 6]);
  assert.match(sections[1].text, /# fenced/);
});

test('pinned read labels sections, omits replaced text and reports unknown headings', (t) => {
  const { root, lockFile } = fixture(t);
  rules.writeRulesLock({ root, file: lockFile, label: 'fixture' });
  const result = rules.readAuthoringRules({ scenarioId: 'business-plan', root, lock: rules.readRulesLock(lockFile) });
  assert.equal(result.pin.status, 'pinned');
  const byHeading = Object.fromEntries(result.documents.flatMap((d) => d.sections).map((s) => [s.heading, s]));
  assert.equal(byHeading['step1. Read the context thoroughly'].disposition, 'apply');
  assert.match(byHeading['step1. Read the context thoroughly'].text, /# not a heading/);
  assert.equal(byHeading['step5. PPT output and delivery'].disposition, 'replaced');
  assert.equal(byHeading['step5. PPT output and delivery'].textOmitted, true);
  assert.equal(byHeading['step5. PPT output and delivery'].text, undefined);
  assert.match(byHeading['step5. PPT output and delivery'].by, /SKILL\.md/);
  assert.equal(byHeading['Requirements'].disposition, 'adapt');
  assert.equal(byHeading['Tell a more complete story through SmartArt structural diagrams'].disposition, 'adapt');
  assert.equal(byHeading['Key Requirements'].disposition, 'apply');
  assert.equal(byHeading['Brand new upstream step'].disposition, 'unreviewed');
  const full = rules.readAuthoringRules({ scenarioId: 'business-plan', root, lock: rules.readRulesLock(lockFile), includeReplaced: true });
  assert.match(full.documents[0].sections.find((s) => s.heading === 'step5. PPT output and delivery').text, /export pptx/);
});

test('drift blocks the read unless allowed, then marks changed files unreviewed', (t) => {
  const { root, lockFile, write } = fixture(t);
  rules.writeRulesLock({ root, file: lockFile });
  write('reference/slides_categories.md', '# PPT category guide\n### Requirements\nchanged upstream\n');
  write('reference/extra.md', '# Extra\n');
  const lock = rules.readRulesLock(lockFile);
  assert.throws(() => rules.readAuthoringRules({ scenarioId: 'business-plan', root, lock }), (error) => {
    assert.equal(error.pin.status, 'drift');
    assert.deepEqual(error.pin.changed, ['reference/slides_categories.md']);
    assert.deepEqual(error.pin.added, ['reference/extra.md']);
    return /rules:lock/.test(error.message);
  });
  const result = rules.readAuthoringRules({ scenarioId: 'business-plan', root, lock, allowDrift: true });
  const general = result.documents.find((d) => d.relativePath === 'reference/slides_categories.md');
  assert(general.sections.every((s) => s.disposition === 'unreviewed'));
  assert.equal(result.documents.find((d) => d.id === 'workflow').sections.find((s) => s.heading === 'step1. Read the context thoroughly').disposition, 'apply');
  const relock = rules.writeRulesLock({ root, file: lockFile });
  assert.deepEqual(relock.changes.changed, ['reference/slides_categories.md']);
  assert.equal(rules.readAuthoringRules({ scenarioId: 'business-plan', root, lock: rules.readRulesLock(lockFile) }).pin.status, 'pinned');
});

test('without a lock the read is reported unpinned', (t) => {
  const { root } = fixture(t);
  assert.equal(rules.readAuthoringRules({ scenarioId: 'business-plan', root, lock: null }).pin.status, 'unpinned');
});

test('pinned installation wins over another Kimi copy unless one is named explicitly', (t) => {
  const first = fixture(t), second = fixture(t);
  second.write('SKILL.md', '# Definition\nother copy\n');
  rules.writeRulesLock({ root: second.root, file: second.lockFile });
  const lock = rules.readRulesLock(second.lockFile);
  assert.equal(rules.locatePinnedKimiSkill(lock, [first.root, second.root]), second.root);
  const previous = process.env.KIMI_PPT_SKILL_DIR;
  process.env.KIMI_PPT_SKILL_DIR = first.root;
  t.after(() => { if (previous === undefined) delete process.env.KIMI_PPT_SKILL_DIR; else process.env.KIMI_PPT_SKILL_DIR = previous; });
  assert.equal(rules.locatePinnedKimiSkill(lock, [first.root, second.root]), first.root);
});
