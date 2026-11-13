import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root = "skills/dawang-ppt/project/";
test("the deck runtime carries no upstream template engine or proprietary exporter", () => {
  for (const gone of ["dist/theme-runtime", "src/components", "src/renderDeck.jsx", "assets/template-swiss.html", "packages/html-deck-to-pptx"]) assert(!fs.existsSync(root + gone), gone);
  assert(!fs.existsSync(root + "assets/vendor/editable-pptx-browser.js"));
});
test("baseline captures actual editor controls and representative pages", () => {
  const m = JSON.parse(fs.readFileSync("tests/fusion/fixtures/manifest.json"));
  assert.deepEqual(m.themeKeys, ["theme09", "theme13", "theme16", "theme17"]);
  for (const op of ["text", "image", "font", "props", "order", "duplicate", "delete", "skip", "undo", "save"]) assert(m.editorChecks.includes(op));
  assert.equal(m.previousRuntime, "historical-only");
});
