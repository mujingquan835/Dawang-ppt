import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("all 60 Kimi sources have unique IDs/hashes and explicit migration destination", () => {
  const rows = JSON.parse(fs.readFileSync("docs/style-migration-v2.json")).sources;
  assert.equal(rows.length, 60);
  assert.equal(new Set(rows.map((r) => r.sourceId)).size, 60);
  assert.equal(new Set(rows.map((r) => r.sha256)).size, 60);
  assert(rows.every((r) => r.destination && r.status));
  assert.equal(rows.filter((r) => r.status === "implemented-unverified").length, 3);
  assert(rows.filter((r) => r.status === "source-collected").every((r) => r.batch > 1));
});
