import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
test("original templates retain navy background, blueprint rules and loaded OPPO font on first export", () => {
  execFileSync("skills/dawang-ppt/project/node_modules/.bin/tsx", ["tests/fusion/helpers/legacy-run.jsx"], { stdio: "pipe", timeout: 18e4, env: { ...process.env, DAWANG_EXPORT_FOCUS: "1" } });
  const collection = JSON.parse(fs.readFileSync("output/fusion-v1/legacy-appearance/collection.json"));
  const navy = collection.slides.find((s) => s.slideId === "theme09_page001"), cobalt = collection.slides.find((s) => s.slideId === "theme13_page001"), blueprint = collection.slides.find((s) => s.slideId === "theme16_page001");
  assert(navy.objects.some((o) => o.type === "decoration" && o.svg.includes("rgb(3,7,26)")), "navy CSS background must be exported");
  assert(navy.objects.find((o) => o.text === "美国大额融资").style.textGradient, "gradient headline remains editable text with visible fill");
  assert(cobalt.objects.filter((o) => o.type === "text").every((o) => o.style.fontFamily === "OPPO Sans 4.0"), "first lazily rendered cover must load its font");
  assert(blueprint.objects.some((o) => o.type === "decoration" && o.svg.includes("<pattern ")), "blueprint pseudo-element grid must be exported");
  assert(blueprint.objects.some((o) => o.type === "decoration" && o.svg.includes("rgb(181,57,42)")), "diagonal stripe must be editable geometry");
  assert(collection.slides.every((s) => s.issues.length === 0));
});
