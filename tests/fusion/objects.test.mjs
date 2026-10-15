import test from "node:test";
import assert from "node:assert/strict";
import { layoutObject } from "../../skills/dawang-ppt/project/src/fusion/objects/index.mjs";
import { resolveStyle } from "../../skills/dawang-ppt/project/src/fusion/styles/registry.mjs";
const style = resolveStyle("legacy/theme13");
const make = (kind, data, n = 5) => ({ objectId: kind, kind, bounds: [112, 240, 1696, 760], data, nodeIds: (data.nodes || []).map((n2) => n2.nodeId), relationships: [], overrides: {} });
test("2/5/9 timelines differ in geometry, retain stable ids, and proportional dates", () => {
  for (const count of [2, 5, 9]) for (const direction of ["horizontal", "vertical", "alternating"]) {
    const nodes = Array.from({ length: count }, (_, i) => ({ nodeId: "n" + i, label: "里程碑" + i, date: `2026-10-${String(i + 1).padStart(2, "0")}`, detail: "合成结构测试" }));
    const es2 = layoutObject(make("timeline", { nodes, direction }), style);
    assert.equal(es2.filter((e) => e.id.endsWith("/label")).length, count);
    assert(es2.every((e) => e.bounds.every(Number.isFinite)));
  }
  const es = layoutObject(make("timeline", { distribution: "date", nodes: [{ nodeId: "a", label: "A", date: "2026-01-01" }, { nodeId: "b", label: "B", date: "2026-01-02" }, { nodeId: "c", label: "C", date: "2026-01-11" }] }), style);
  const labels = es.filter((e) => e.id.endsWith("/label"));
  assert(labels[1].bounds[0] - labels[0].bounds[0] < labels[2].bounds[0] - labels[1].bounds[0]);
});
test("8/12 row tables preserve every cell and merged-cell semantics", () => {
  for (const n of [8, 12]) {
    const columns = [{ columnId: "a", label: "事项" }, { columnId: "b", label: "证据" }, { columnId: "c", label: "状态" }];
    const rows = Array.from({ length: n }, (_, i) => ({ rowId: "r" + i, cells: { a: "事项" + i, b: "可核对的合成结构测试文字", c: "待核对" } }));
    const es2 = layoutObject(make("table", { columns, rows }), style);
    assert.equal(es2.filter((e) => e.type === "text").length, (n + 1) * 3);
    assert(es2.some((e) => e.text === "事项" + (n - 1)));
  }
  const es = layoutObject(make("table", { columns: [{ columnId: "a", label: "A" }, { columnId: "b", label: "B" }], rows: [{ rowId: "r", cells: { a: "合并内容", b: "" } }], merges: [{ rowIds: ["r"], columnIds: ["a", "b"] }] }), style);
  assert.equal(es.filter((e) => e.type === "text").length, 3);
});
test("semantic connectors follow manually moved nodes and do not dangle", () => {
  for (const kind of ["process", "hierarchy", "cycle", "matrix", "comparison", "causal"]) {
    const o2 = make(kind, { nodes: [{ nodeId: "a", label: "A" }, { nodeId: "b", label: "B" }, { nodeId: "c", label: "C" }], rows: 2, columns: 2 });
    o2.relationships = [{ relationshipId: "ab", from: "a", to: "b" }];
    const es2 = layoutObject(o2, style);
    assert(es2.filter((e) => e.id.endsWith("/label")).length === 3);
  }
  const o = make("process", { nodes: [{ nodeId: "a", label: "A" }, { nodeId: "b", label: "B" }] });
  o.relationships = [{ relationshipId: "ab", from: "a", to: "b" }];
  o.overrides = { "process/node/a/shape": { bounds: [180, 300, 400, 170] } };
  const es = layoutObject(o, style);
  const line = es.find((e) => e.relationshipId === "ab");
  assert(line);
  assert(line.fromNodeId === "a");
  const invalid = structuredClone(o);
  invalid.relationships[0].to = "missing";
  assert.throws(() => layoutObject(invalid, style), /dangling/);
});
test("bar/line preserve positive, negative, zero, and missing measurements", () => {
  const data = { unit: "合成单位", period: "合成时期", series: [{ nodeId: "a", label: "正", value: 10 }, { nodeId: "b", label: "负", value: -5 }, { nodeId: "c", label: "零", value: 0 }, { nodeId: "d", label: "空", value: null }] };
  for (const kind of ["bar", "line"]) {
    const es = layoutObject(make(kind, data), style);
    assert(es.some((e) => e.text === "—"));
    assert(es.some((e) => e.text === "-5"));
    assert(es.some((e) => e.text === "0"));
    assert(!es.some((e) => !e.bounds.every(Number.isFinite)));
  }
});
