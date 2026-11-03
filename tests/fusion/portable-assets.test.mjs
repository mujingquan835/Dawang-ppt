import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { poolProjectMedia, inflatePortableAssets, extractPortableProject } from '../../skills/dawang-ppt/project/src/fusion/portable/html.mjs';

// A synthetic image repeated across many undo steps must be stored once, not once per step.
const image = 'data:image/png;base64,' + 'A'.repeat(4000);
function project(steps) {
  const p = createAuthoredProject({
    requirements: { projectId: 'portable-assets-test', title: '合成测试' },
    sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }] }, media: { entries: [] },
    designChoice: { styleId: 'authored/custom' }, contentPlan: { nodes: {} },
    slides: [{ slideId: 's', elements: [{ id: 'hero', type: 'image', src: image, bounds: [0, 0, 960, 540] }] }]
  });
  const slide = structuredClone(p.slides[0]);
  p.editorState.history = Array.from({ length: steps }, () => ({ kind: 'edit-patch-v1', slideId: 's', before: { slide }, after: { slide } }));
  p.editorState.redo = [{ kind: 'edit-patch-v1', slideId: 's', before: { slide }, after: { slide } }];
  return p;
}
const html = (p, pool) => `<html><head>
<script id="portable-project-meta" type="application/json">${JSON.stringify({ version: 1, projectId: p.requirements.projectId, baseRevision: p.revision, snapshotRevision: p.revision, runtimeFingerprint: 'x' })}</script>
${pool ? `<script id="portable-assets" type="application/json">${JSON.stringify(pool)}</script>` : ''}
<script id="fusion-project" type="application/json">${JSON.stringify(p)}</script></head></html>`;
const copies = (text) => text.split(image).length - 1;

test('the embedded project keeps one pooled copy of each image however many edits there are', () => {
  const original = project(17), { project: pooled, pool } = poolProjectMedia(original);
  assert.deepEqual(Object.values(pool), [image]);
  assert.equal(copies(JSON.stringify(pooled)), 0);
  assert.equal(original.slides[0].elements[0].src, image, 'the live project is not modified');
  assert.deepEqual(inflatePortableAssets(pooled, pool), original);
});

test('a portable file reads back to the full project, and files without a pool still load', () => {
  const original = project(5), { project: pooled, pool } = poolProjectMedia(original);
  const text = html(pooled, pool);
  assert.equal(copies(text), 1);
  assert.deepEqual(extractPortableProject(text), original);
  assert.deepEqual(extractPortableProject(html(original)), original);
});
