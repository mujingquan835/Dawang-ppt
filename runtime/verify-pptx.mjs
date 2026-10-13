import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
const [fileArg] = process.argv.slice(2);
if (!fileArg) throw Error("Usage: node runtime/verify-pptx.mjs <file.pptx>");
const file = path.resolve(fileArg),
  dir = path.dirname(file);
const zip = await JSZip.loadAsync(fs.readFileSync(file));
const names = Object.keys(zip.files).filter((k) =>
  /^ppt\/slides\/slide\d+\.xml$/.test(k),
);
let textRuns = 0,
  images = 0,
  tables = 0,
  connections = 0;
for (const name of names) {
  const xml = await zip.file(name).async("string");
  textRuns += (xml.match(/<a:t>/g) || []).length;
  images += (xml.match(/<p:pic>/g) || []).length;
  tables += (xml.match(/<a:tbl>/g) || []).length;
  connections += (xml.match(/<a:tailEnd[^>]*type="triangle"/g) || []).length;
}
const out = path.join(dir, "independent");
fs.mkdirSync(out, { recursive: true });
const lo =
  process.env.DAWANG_LIBREOFFICE ||
  "/Applications/LibreOffice.app/Contents/MacOS/soffice";
const version = spawnSync(lo, ["--version"], { encoding: "utf8" });
const r = spawnSync(
  lo,
  [
    "-env:UserInstallation=file:///tmp/dawang-lo-verification",
    "--headless",
    "--convert-to",
    "pdf",
    "--outdir",
    out,
    file,
  ],
  { encoding: "utf8", timeout: 60000 },
);
const pdf = path.join(out, path.basename(file, ".pptx") + ".pdf");
const report = {
  file: path.basename(file),
  slides: names.length,
  textRuns,
  images,
  nativeTables: tables,
  arrowConnections: connections,
  independentRenderer: version.stdout.trim(),
  independentPdf: r.status === 0 && fs.existsSync(pdf),
  clientVisualReview: "pending",
  userVisualReview: "pending",
};
if (report.independentPdf) {
  const png = spawnSync(
    "pdftoppm",
    ["-scale-to", "960", "-png", pdf, path.join(out, "page")],
    { encoding: "utf8", timeout: 60000 },
  );
  report.independentScreenshots = png.status === 0;
} else report.error = r.stderr;
fs.writeFileSync(
  path.join(dir, "independent-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
if (!report.independentPdf) process.exitCode = 1;
