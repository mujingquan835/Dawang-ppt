import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assertValid } from "./contracts.mjs";
import { hash } from "./project.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  legacy = path.join(root, "skills/dashiai-ppt/project");
export function compileLegacy(project) {
  assertValid(project);
  const nodes = new Map(project.sources.nodes.map((n) => [n.id, n]));
  const goal = {
    title: project.contentPlan.purpose,
    goal: project.contentPlan.purpose,
    audience: project.contentPlan.audience,
    owner: "Dawang-PPT",
    themePack: project.designBrief.legacyTheme,
    randomSeed: "dawang-legacy-fixed",
    pageCount: project.contentPlan.pageCount,
    slides: [],
  };
  for (const slide of project.contentPlan.slides) {
    const a = slide.legacy;
    if (!a?.layout || !a.bindings)
      throw Error(`Legacy bindings required: ${slide.slideId}`);
    const props = { ...a.props };
    const used = [];
    for (const [field, ref] of Object.entries(a.bindings)) {
      if (!nodes.has(ref)) throw Error(`Missing content: ${ref}`);
      props[field] = nodes.get(ref).text;
      used.push(ref);
    }
    for (const ref of slide.requiredContentRefs || [])
      if (!used.includes(ref)) throw Error(`Legacy omitted content: ${ref}`);
    if (slide.requiredMediaRefs?.length)
      throw Error(
        "Legacy media mapping must be implemented before promising media support",
      );
    goal.slides.push({ layout: a.layout, props });
  }
  return goal;
}
export function buildLegacy(dir, project) {
  const goal = compileLegacy(project);
  fs.mkdirSync(dir, { recursive: true });
  const input = path.join(dir, "goal.json");
  fs.writeFileSync(input, JSON.stringify(goal, null, 2));
  const result = spawnSync(
    path.join(legacy, "node_modules/.bin/tsx"),
    [
      path.join(legacy, "scripts/render-goal-deck.jsx"),
      input,
      path.join(dir, "ppt/index.html"),
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) throw Error(result.stdout + result.stderr);
  fs.writeFileSync(
    path.join(dir, "legacy-manifest.json"),
    JSON.stringify(
      {
        version: "0.1.0",
        revision: hash(project),
        theme: goal.themePack,
        coverage:
          "Explicit props bindings, original renderer and exporter. Legacy adaptive geometry is not claimed.",
      },
      null,
      2,
    ),
  );
  return goal;
}
