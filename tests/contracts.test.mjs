import test from "node:test";
import assert from "node:assert/strict";
import { sample } from "../examples/matrix.mjs";
import { compile } from "../runtime/compiler.mjs";
import { validate } from "../runtime/contracts.mjs";
import { applyEdits } from "../runtime/project.mjs";
import { compileLegacy } from "../runtime/legacy.mjs";
test("same facts and refs survive all three styles with different geometry", () => {
  const p = sample();
  const first = JSON.stringify(p.contentPlan),
    source = JSON.stringify(p.sources);
  const plans = [
    "indigo-due-diligence",
    "moon-white-imagery",
    "blue-line-courseware",
  ].map((styleId) => {
    p.designBrief.styleId = styleId;
    return compile(p);
  });
  assert.equal(JSON.stringify(p.contentPlan), first);
  assert.equal(JSON.stringify(p.sources), source);
  const refs = (plan) =>
    plan.slides
      .flatMap((s) =>
        s.elements.map((e) => e.contentRef || e.mediaRef).filter(Boolean),
      )
      .sort();
  assert.deepEqual(refs(plans[0]), refs(plans[1]));
  assert.notDeepEqual(plans[0].slides[0].elements, plans[1].slides[0].elements);
});
test("eight rows become one native table plan without dropped cells", () => {
  const table = compile(sample()).slides[4].elements.find(
    (e) => e.type === "table",
  );
  assert.equal(table.rows.length, 8);
  assert.equal(table.rows[7][1], "导出");
});
test("positive negative zero and null have distinct representation", () => {
  const elements = compile(sample()).slides[2].elements;
  assert.equal(
    elements.find((e) => e.id.endsWith("series.value.3")).text,
    "缺失",
  );
  assert.equal(
    elements.find((e) => e.id.endsWith("series.value.2")).text,
    "0 项",
  );
  assert.ok(
    elements.find((e) => e.id.endsWith("series.bar.1")).x <
      elements.find((e) => e.id.endsWith("axis")).x,
  );
  assert.equal(elements.filter((e) => e.id.includes("series.bar")).length, 2);
});
test("required refs cannot disappear", () => {
  const p = sample();
  p.contentPlan.slides[0].requiredContentRefs.push("unmapped");
  assert.match(validate(p).join(), /Uncovered/);
});
test("native chart request is refused", () => {
  const p = sample();
  p.contentPlan.slides[2].constraints.nativeChart = true;
  assert.throws(() => compile(p), /unsupported/);
});
test("missing fact stays missing and raw source reference is required", () => {
  const p = sample();
  delete p.sources.nodes[0].sourceId;
  assert.match(validate(p).join(), /Missing source/);
});
test("forbidden crop and absolute media path are refused", () => {
  const p = sample();
  p.media.items[0].fit = "cover";
  assert.match(validate(p).join(), /Forbidden cropping/);
  p.media.items[0].src = "/tmp/secret.png";
  assert.match(validate(p).join(), /Invalid local media/);
});
test("local change preserves five other pages and semantic plan", () => {
  const p = sample(),
    before = compile(p);
  const next = applyEdits(p, { texts: { "title.2": "修改后的第三页标题" } }),
    after = compile(next);
  assert.deepEqual(next.contentPlan, p.contentPlan);
  for (let i = 0; i < 6; i++)
    if (i !== 2) assert.deepEqual(after.slides[i], before.slides[i]);
  assert.equal(after.slides[2].elements[0].text, "修改后的第三页标题");
});
test("stale or illegal layout overrides fail explicitly", () => {
  const p = sample();
  assert.throws(
    () => applyEdits(p, { overrides: { missing: { x: 10 } } }),
    /Stale/,
  );
  assert.throws(
    () => applyEdits(p, { overrides: { "s1.title": { fontSize: 8 } } }),
    /Unreadable/,
  );
  assert.throws(
    () => applyEdits(p, { overrides: { "s1.title": { x: 940 } } }),
    /outside canvas/,
  );
});
test("table dimensional mismatch fails", () => {
  const p = sample();
  p.sources.nodes.find((n) => n.kind === "table").rows[0].pop();
  assert.throws(() => compile(p), /Invalid table/);
});
test("case media intent cannot be silently omitted", () => {
  const p = sample();
  p.contentPlan.slides[1].mediaRefs = [];
  assert.throws(() => compile(p), /media|Case requires/);
});
test("process preserves all before and after steps and connections", () => {
  const p = compile(sample()).slides[3];
  assert.equal(p.elements.filter((e) => e.arrow).length, 5);
  for (const id of [
    "before.0",
    "before.1",
    "before.2",
    "after.0",
    "after.1",
    "after.2",
    "after.3",
  ])
    assert.ok(p.elements.some((e) => e.contentRef === id));
});
test("legacy adapter keeps required refs in explicit props bindings", () => {
  const p = sample();
  p.contentPlan.slides = [p.contentPlan.slides[0]];
  p.contentPlan.pageCount = 1;
  p.designBrief.legacyTheme = "theme01";
  p.contentPlan.slides[0].legacy = {
    layout: "theme01_page006",
    props: {},
    bindings: { title: "title.0" },
  };
  assert.throws(() => compileLegacy(p), /omitted/);
  p.contentPlan.slides[0].legacy.bindings = {
    title: "title.0",
    sub: "body.0.0",
    value: "body.0.1",
    unit: "body.0.2",
  };
  assert.equal(
    compileLegacy(p).slides[0].props.sub,
    p.sources.nodes.find((n) => n.id === "body.0.0").text,
  );
});
