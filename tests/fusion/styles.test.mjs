import test from "node:test";
import assert from "node:assert/strict";
import { resolveStyle } from "../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs";
import { composeContentSlide } from "../../skills/dawang-ppt/project/src/fusion/styles/compose.mjs";
test("three families use different evidence, image, and relationship layouts", () => {
  const content = { slideId: "s", title: "同材料结论", scope: "来源可核对", readerTask: "理解关系", kind: "process", data: { nodes: [{ nodeId: "a", label: "材料" }, { nodeId: "b", label: "结论" }] }, judgments: ["保留材料事实", "关系形成结构"], source: "测试材料" };
  const definitions = ["kimi/consulting/indigo-due-diligence", "kimi/work/moon-white-imagery", "kimi/academic/blue-line-courseware"].map((id) => resolveStyle(id));
  const slides = definitions.map((s) => composeContentSlide(content, s));
  assert.equal(new Set(slides.map((s) => JSON.stringify(s.objects[0].bounds))).size, 3);
  assert(slides[0].elements.some((e) => e.id === "judgment-panel"));
  assert(slides[2].elements.some((e) => e.id === "blue-top-rule"));
  const pic = { ...content, kind: "images", data: { images: [{ mediaId: "real-photo", src: "real.jpg", kind: "photo" }] } };
  const images = definitions.map((s) => composeContentSlide(pic, s));
  assert(images[0].sourceAdaptation === "photo-evidence-extension");
  assert(images[1].objects[0].bounds[2] > images[1].objects[0].bounds[0]);
  assert(images[2].objects[0].data.images[0].clipShape === "ellipse");
});
