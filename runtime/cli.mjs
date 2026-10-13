import path from "node:path";
import { build } from "./build.mjs";
import { serve } from "./server.mjs";
import { exportPptx } from "./export.mjs";
import { qa } from "./qa.mjs";
const [command, dirArg, outArg] = process.argv.slice(2);
if (!dirArg)
  throw Error(
    "Usage: node runtime/cli.mjs build|serve|export|qa <project-dir> [output.pptx|port]",
  );
const dir = path.resolve(dirArg);
if (command === "build")
  console.log(JSON.stringify({ slides: build(dir).plan.slides.length }));
else if (command === "serve") {
  const server = await serve(dir, Number(outArg || 0));
  console.log(`http://127.0.0.1:${server.address().port}/`);
} else if (command === "export")
  console.log(await exportPptx(dir, outArg && path.resolve(outArg)));
else if (command === "qa") {
  const report = await qa(dir);
  console.log(JSON.stringify(report));
  if (!report.geometryPassed) process.exitCode = 1;
} else throw Error("Unknown command");
