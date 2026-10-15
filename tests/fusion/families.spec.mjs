import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
test("all declared first-batch family page types render and export in original editor shell", () => {
  execFileSync("skills/dawang-ppt/project/node_modules/.bin/tsx", ["tests/fusion/helpers/families-run.jsx"], { stdio: "pipe", timeout: 18e4 });
  const rows = JSON.parse(fs.readFileSync("output/fusion-v1/family-variants/evidence.json"));
  assert.deepEqual(rows.map((r) => r.pages), [7, 7, 5]);
  assert(rows.every((r) => !r.issues.length && r.export.ok));
});
