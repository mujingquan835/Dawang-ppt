import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const project = path.resolve(import.meta.dirname, "../project"), args = process.argv.slice(2);
const aliases = { build: "render:goal", preview: "preview:start", serve: "preview:start", export: "export:pptx", qa: "qa:project" };
if (aliases[args[0]]) args[0] = aliases[args[0]];
if (args[0] === "doctor") {
  const ok = fs.existsSync(path.join(project, "node_modules/.bin/tsx"));
  console.log(JSON.stringify({ node: process.version, project, runtime: ok, install: "npm ci --prefix skills/dawang-ppt/project" }));
  process.exitCode = ok ? 0 : 1;
} else {
  const command = path.join(project, "node_modules/.bin/tsx");
  if (!fs.existsSync(command)) throw new Error("Run npm ci --prefix skills/dawang-ppt/project first");
  const result = spawnSync(command, [path.join(project, "scripts/fusion-cli.jsx"), ...args], { stdio: "inherit", env: { ...process.env, INIT_CWD: process.env.INIT_CWD || process.cwd() } });
  process.exitCode = result.status ?? 1;
}
