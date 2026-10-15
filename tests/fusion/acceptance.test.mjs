import test from "node:test";
import assert from "node:assert/strict";
import { importGoal } from "../../skills/dawang-ppt/project/src/fusion/project/import-goal.mjs";
import { checkCoverage } from "../../skills/dawang-ppt/project/src/fusion/qa/coverage.mjs";
import { validateProject } from "../../skills/dawang-ppt/project/src/fusion/project/schema.mjs";
test("missing mandatory content/media and fixed page count fail instead of being omitted", () => {
  const p = importGoal({ slides: [{ slideId: "a", mode: "composition", styleId: "legacy/theme13", elements: [], objects: [], requiredContentRefs: ["fact"] }] });
  p.contentPlan.nodes.fact = { text: "全部保留" };
  p.requirements.requiredMedia = ["photo"];
  p.requirements.fixedPageCount = 2;
  assert.deepEqual(checkCoverage(p).map((i) => i.kind), ["page-count", "unrendered-required-content", "required-media-not-rendered"]);
  p.slides[0].elements.push({ id: "fact", type: "text", contentRef: "fact", bounds: [100, 100, 500, 80] }, { id: "photo", type: "image", mediaRef: "photo", bounds: [100, 300, 500, 300] });
  assert(checkCoverage(p).some((i) => i.kind === "missing-media-reference"));
  p.media.entries.push({ mediaId: "photo", src: "assets/user-media/photo.png" });
  p.requirements.fixedPageCount = 1;
  assert.deepEqual(checkCoverage(p), []);
  p.slides[0].elements[0].type = "icon";
  assert(validateProject(p).some((i) => i.includes("unsupported core")));
});
