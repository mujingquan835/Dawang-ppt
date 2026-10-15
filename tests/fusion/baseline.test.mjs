import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root = "skills/dawang-ppt/project/";
test("local 18 extensions and 17 themes are fixed with hashes", () => {
  const manifest = JSON.parse(fs.readFileSync("docs/fusion-source-manifest.json"));
  assert.equal(manifest.localExtensions.length, 18);
  assert(manifest.localExtensions.every((x) => x.matchesRecorded));
  for (let n = 1; n <= 17; n++) assert(fs.existsSync(root + `dist/theme-runtime/theme${String(n).padStart(2, "0")}.module.mjs`));
  assert(!fs.existsSync(root + "packages/html-deck-to-pptx"));
  assert(!fs.existsSync(root + "assets/vendor/editable-pptx-browser.js"));
  assert.equal(manifest.baselineCommit, "2bb1c7167d125ba7ebb9a635c2427ede3b19eb27");
});
test("baseline captures actual editor controls and representative pages", () => {
  const m = JSON.parse(fs.readFileSync("tests/fusion/fixtures/manifest.json"));
  assert.deepEqual(m.themeKeys, ["theme09", "theme13", "theme16", "theme17"]);
  for (const op of ["text", "image", "font", "props", "order", "duplicate", "delete", "skip", "undo", "save"]) assert(m.editorChecks.includes(op));
  assert.equal(m.previousRuntime, "historical-only");
});
