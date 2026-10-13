import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { exportPptx } from "../runtime/export.mjs";
const root = path.resolve(import.meta.dirname, "..");
for (const name of fs.readdirSync(path.join(root, "output/matrix"))) {
  const dir = path.join(root, "output/matrix", name);
  await exportPptx(dir);
  const r = spawnSync(
    process.execPath,
    [
      path.join(root, "runtime/verify-pptx.mjs"),
      path.join(dir, "Dawang-PPT.pptx"),
    ],
    { encoding: "utf8" },
  );
  if (r.status) throw Error(r.stdout + r.stderr);
  console.log(name, r.stdout.trim());
}
