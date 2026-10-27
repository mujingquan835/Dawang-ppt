import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createAuthoredProject } from '../../skills/dawang-ppt/project/src/fusion/authoring/create-project.mjs';
import { validateProject } from '../../skills/dawang-ppt/project/src/fusion/project/schema.mjs';
import { saveProject, loadProject } from '../../skills/dawang-ppt/project/src/fusion/project/store.mjs';
import { materializeElements } from '../../skills/dawang-ppt/project/src/fusion/scene/model.mjs';
import { applyEditCommand } from '../../skills/dawang-ppt/project/src/fusion/editor/commands.mjs';

const cli = path.resolve('skills/dawang-ppt/scripts/dawang.mjs');
function input() {
  const text = '这一段很长的中文标题需要按照设计者给定的文本框换行并保留画面中的大面积空白';
  return {
    requirements: { title: '合成直接制作测试', audience: '测试读者', purpose: '核对构图' },
    sources: { entries: [{ sourceId: 'fixture', kind: 'synthetic' }], userEdits: [] },
    media: { entries: [{ mediaId: 'hero', src: 'pixel.png' }] },
    contentPlan: { nodes: { title: { text } }, slides: [{ slideId: 'cover', readerTask: '定位' }, { slideId: 'feature', readerTask: '看关系' }] },
    designChoice: { styleId: 'legacy/theme09', direction: '自主设计' },
    slides: [
      { slideId: 'cover', appearance: { palette: { bg: '#102A24', ink: '#EEEAE0', accent: '#D37552' } }, elements: [
        { id: 'heading', type: 'text', text, bounds: [88, 80, 1480, 240], style: { fontSize: 88, color: '#EEEAE0', fontFamily: 'sans-serif' } },
        { id: 'hero', type: 'image', mediaRef: 'hero', bounds: [88, 650, 1720, 300], fit: 'cover', focal: '40% 62%' }
      ] },
      { slideId: 'feature', appearance: { palette: { bg: '#F7F3E8', ink: '#102A24' } }, elements: [
        { id: 'heading', type: 'text', text, bounds: [80, 90, 700, 400], style: { fontSize: 58, color: '#102A24' } },
        { id: 'hero', type: 'image', mediaRef: 'hero', bounds: [1050, 220, 760, 680], fit: 'contain', focal: '50% 50%' },
        { id: 'rule', type: 'line', bounds: [80, 570, 700, 2], y1: 0, y2: 0, style: { stroke: '#D37552', strokeWidth: 2 } }
      ] }
    ]
  };
}
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kimi-authored-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('same content retains two distinct authored compositions and stable IDs without mutating input', () => {
  const source = input(), before = structuredClone(source);
  const p = createAuthoredProject(source);
  assert.deepEqual(source, before);
  assert.deepEqual(validateProject(p), []);
  for (let i = 0; i < 2; i++) {
    assert.equal(p.slides[i].mode, 'composition');
    assert.equal(p.slides[i].authoring.engine, 'dawang-authored-v1');
    assert.deepEqual(p.slides[i].elements, source.slides[i].elements);
    assert.deepEqual(p.slides[i].appearance, source.slides[i].appearance);
    assert.deepEqual(materializeElements(p.slides[i], p).map(e => e.bounds), source.slides[i].elements.map(e => e.bounds));
  }
  assert.equal(p.slides[0].elements[1].focal, '40% 62%');
  assert.deepEqual(p.editorState.slideOrder, ['cover', 'feature']);
  assert.equal(p.planningReport, undefined);
  p.slides[0].elements[0].style.fontSize = 12;
  assert.equal(source.slides[0].elements[0].style.fontSize, 88);
});

test('invalid or unimplemented authored content fails explicitly instead of disappearing', () => {
  for (const mutate of [
    x => x.slides[0].elements[0].type = 'custom-html',
    x => x.slides[0].elements[0].runs = [],
    x => x.slides[0].elements[0].parentId = 'not-rendered',
    x => x.slides[0].objects = [{ objectId: 'old-planner', kind: 'process' }],
    x => x.slides[0].elements[1].id = 'heading',
    x => x.slides[0].elements[0].bounds[2] = NaN,
    x => x.slides[0].elements[1].bounds[2] = -1,
    x => x.slides[0].elements[0].contentRef = 'missing',
    x => x.slides[0].elements[1].mediaRef = 'missing',
    x => x.slides[1].slideId = 'cover',
    x => x.slides[0].mode = 'template',
    x => x.slides[0].authoring = { engine: 'unknown' },
    x => x.slides = []
  ]) {
    const source = input(); mutate(source);
    assert.throws(() => createAuthoredProject(source), /authored|element|bounds|reference|slideId|composition|engine|slides|runs|objects|parentId/i);
  }
});

test('saved authored projects are validated too, while legacy projects remain compatible', () => {
  const p = createAuthoredProject(input());
  p.slides[0].elements[1].id = 'heading';
  assert(validateProject(p).some(issue => /Duplicate.*element/i.test(issue)));
  const legacy = { ...p, slides: [{ slideId: 'legacy', mode: 'template', layout: 'theme09_page001' }] };
  assert.deepEqual(validateProject(legacy), []);
});

test('manual geometry and text survive save/reopen without returning to initial authoring', (t) => {
  const p = createAuthoredProject(input()), dir = temp(t);
  const edited = applyEditCommand(p, { type: 'geometry', slideId: 'cover', elementId: 'heading', bounds: [100, 120, 1300, 260] });
  assert.equal(edited.ok, true);
  const file = path.join(dir, 'deck-project.json');
  assert.equal(saveProject(file, edited.project, null).ok, true);
  const loaded = loadProject(file);
  assert.deepEqual(loaded.slides[0].elements[0].bounds, [100, 120, 1300, 260]);
  assert.equal(loaded.slides[0].authoring.engine, 'dawang-authored-v1');
  assert.equal(loaded.slides[0].elements[0].text, p.slides[0].elements[0].text);
});

test('render:authored stages local media, preserves sources, rerenders saved project and refuses overwrite', (t) => {
  const dir = temp(t), file = path.join(dir, 'input.json'), html = path.join(dir, 'deck/index.html');
  fs.writeFileSync(file, JSON.stringify(input()));
  fs.writeFileSync(path.join(dir, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const first = run('render:authored', file, html);
  assert.equal(first.status, 0, first.stderr);
  const projectFile = path.join(dir, 'deck/deck-project.json'), p = loadProject(projectFile);
  assert.equal(p.sources.entries[0].sourceId, 'fixture');
  assert(p.sources.entries.some(e => e.kind === 'authored-input' && e.sha256));
  assert(fs.existsSync(path.join(dir, 'deck', p.media.entries.find(e => e.mediaId === 'hero').src)));
  assert.equal(p.slides[0].elements[1].fit, 'cover');
  assert.match(fs.readFileSync(html, 'utf8'), /fusion-composition/);
  const before = fs.readFileSync(projectFile, 'utf8');
  const second = run('render:authored', file, html);
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /already exists/i);
  assert.equal(fs.readFileSync(projectFile, 'utf8'), before);
  const again = run('render:project', projectFile, html);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(fs.readFileSync(projectFile, 'utf8'), before);
});

test('malformed saved authored element lists return validation issues without throwing', () => {
  for (const value of [null, {}, [null], [42]]) {
    const p = createAuthoredProject(input());
    p.slides[0].elements = value;
    assert(validateProject(p).length > 0);
  }
});

// The existing SVG renderer has no drawable viewport at zero height.
test('zero-area authored lines are rejected rather than disappearing in rendering', () => {
  const source = input();
  source.slides[1].elements[2].bounds[3] = 0;
  assert.throws(() => createAuthoredProject(source), /bounds/);
});
