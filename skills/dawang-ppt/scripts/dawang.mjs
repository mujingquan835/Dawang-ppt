import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
const skill = path.resolve(import.meta.dirname, ".."), project = path.join(skill, "project"), args = process.argv.slice(2);
// build is the new authoring contract. Historical inputs require explicit routes;
// never infer a legacy fallback from a malformed or incomplete authored project.
const aliases = { build: "render:authored", preview: "preview:start", serve: "preview:start", export: "export:pptx", qa: "qa:project" };
if (args[0] === "build" && args[1]) {
  const file = path.resolve(process.env.INIT_CWD || process.cwd(), args[1]);
  const input = JSON.parse(fs.readFileSync(file, "utf8"));
  if (input.version === 2 && input.editorState) {
    console.error("已保存ProjectV2必须使用 render:project 重渲染，以保留人工覆盖、历史与revision；build不会重新导入保存工程。");
    process.exit(1);
  }
  if (Array.isArray(input.contentSlides) || (Array.isArray(input.slides) && input.slides.some(s => s.layout && !s.elements))) {
    console.error("build 现接收智能体直接制作的 authored 工程。历史 contentSlides brief 请显式使用 render:brief；原样模板 goal 使用 render:goal；已保存工程使用 render:project。未创建或覆盖输出。");
    process.exit(1);
  }
}
if (aliases[args[0]]) args[0] = aliases[args[0]];
if (args[0] === "doctor") {
  const ok = fs.existsSync(path.join(project, "node_modules/.bin/tsx"));
  // Hosts are checked independently: a host without an entry is "not-installed", not an error.
  const hosts = [["codex", path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills/dawang-ppt")], ["workbuddy", path.join(os.homedir(), ".workbuddy/skills/dawang-ppt")], ["agents", path.join(os.homedir(), ".agents/skills/dawang-ppt")]];
  const installations = hosts.map(([host, file]) => {
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) { return { host, path: file, usesThisSkill: false, status: error.code === "ENOENT" ? "not-installed" : "unreadable" }; }
    const link = stat.isSymbolicLink() ? fs.readlinkSync(file) : null;
    try { const resolved = fs.realpathSync(file); return { host, path: file, link, resolved, usesThisSkill: resolved === fs.realpathSync(skill), status: link ? "linked" : "directory" }; }
    catch { return { host, path: file, link, usesThisSkill: false, status: "broken-link" }; }
  });
  let rules;
  try {
    const provider = await import(path.join(project, "src/fusion/rules/index.mjs"));
    rules = provider.ruleStatus();
  } catch (error) { rules = { provider: "dawang-ppt", status: "error", message: error.message }; }
  console.log(JSON.stringify({ node: process.version, skill, project, defaultBuild: "render:authored", defaultAuthoringCommand:"make", defaultDeliverable:"html", legacyBuild: "render:brief", installations, runtime: ok, ready: ok && rules.status === "pinned", rules, install: "npm ci --prefix skills/dawang-ppt/project" }));
  process.exitCode = ok ? 0 : 1;
} else {
  const command = path.join(project, "node_modules/.bin/tsx");
  if (!fs.existsSync(command)) throw new Error("Run npm ci --prefix skills/dawang-ppt/project first");
  const result = spawnSync(command, [path.join(project, "scripts/fusion-cli.jsx"), ...args], { stdio: "inherit", env: { ...process.env, INIT_CWD: process.env.INIT_CWD || process.cwd() } });
  process.exitCode = result.status ?? 1;
}
