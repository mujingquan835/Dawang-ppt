import fs from "node:fs";
import path from "node:path";
import { load, hash, checkMedia } from "./project.mjs";
import { compile } from "./compiler.mjs";
import { html } from "./html.mjs";
export function build(dir) {
  const p = load(dir);
  checkMedia(dir, p);
  const plan = compile(p);
  const revision = hash(p);
  const previousFile = path.join(dir, "build-manifest.json");
  const previous = fs.existsSync(previousFile)
    ? JSON.parse(fs.readFileSync(previousFile, "utf8"))
    : null;
  fs.writeFileSync(
    path.join(dir, "render-plan.json"),
    JSON.stringify(plan, null, 2) + "\n",
  );
  fs.writeFileSync(path.join(dir, "index.html"), html(plan, p, revision));
  fs.writeFileSync(
    path.join(dir, "build-manifest.json"),
    JSON.stringify(
      {
        version: "0.1.0",
        revision,
        inputs: hash(p),
        builtAt: new Date().toISOString(),
        slides: plan.slides.length,
      },
      null,
      2,
    ) + "\n",
  );
  if (previous?.revision !== revision) {
    fs.rmSync(path.join(dir, "qa/report.json"), { force: true });
    fs.rmSync(path.join(dir, "export-report.json"), { force: true });
  }
  return { plan, project: p, revision };
}
