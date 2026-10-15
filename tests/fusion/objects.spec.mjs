import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
test("three original style adapters edit, undo, reopen, and export all semantic content", () => {
  execFileSync("skills/dawang-ppt/project/node_modules/.bin/tsx", ["tests/fusion/helpers/objects-run.jsx"], { stdio: "pipe", timeout: 15e4 });
  const qa = JSON.parse(fs.readFileSync("output/fusion-v1/objects-test/qa.json"));
  assert.equal(qa.pages.length, 27);
  assert(qa.ok);
});
