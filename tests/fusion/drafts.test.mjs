import test from "node:test";
import assert from "node:assert/strict";
import { draftDecision } from "../../skills/dawang-ppt/project/src/fusion/editor/drafts.mjs";
test("a stale canonical draft requires a decision and cannot replace the saved revision", () => {
  assert.equal(draftDecision(null, { revision: "new" }), "none");
  assert.equal(draftDecision({ baseRevision: "new" }, { revision: "new" }), "restore");
  assert.equal(draftDecision({ baseRevision: "old" }, { revision: "new" }), "conflict");
});
