import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
if (args[0] === "doctor") {
  const ok =
    fs.existsSync(path.join(root, "runtime/cli.mjs")) &&
    fs.existsSync(path.join(root, "node_modules/pptxgenjs"));
  console.log(
    JSON.stringify({
      root,
      node: process.version,
      runtime: ok,
      install: "Run npm ci at repository root",
    }),
  );
  if (!ok) process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "runtime/cli.mjs"), ...args],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
}
