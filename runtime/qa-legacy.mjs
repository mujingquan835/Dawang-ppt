import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
const [dir] = process.argv.slice(2);
const root = path.resolve(dir),
  runtime = path.resolve(import.meta.dirname, "../skills/dashiai-ppt/project");
const server = spawn(
  process.execPath,
  [
    path.join(runtime, "scripts/serve-preview-https.mjs"),
    path.join(root, "ppt"),
    "5791",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
try {
  await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(Error("Preview startup timeout")),
      20000,
    );
    server.stdout.on("data", (data) => {
      output += data;
      if (output.includes("5791")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", (code) => reject(Error(`Preview exited ${code}`)));
  });
  const browser = await chromium.launch({
    executablePath:
      process.env.DAWANG_CHROME ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    await page.goto("http://127.0.0.1:5791/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => typeof window.go === "function");
    await page.evaluate(() => window.go(0, { animate: false, force: true }));
    await page.waitForTimeout(300);
    const out = path.join(root, "qa");
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, "page.png") });
    const report = await page.evaluate(() => {
      const slide = document.querySelector("#deck > .slide:not([hidden])");
      const errors = [],
        expectedDecorations = [];
      for (const image of slide.querySelectorAll("img"))
        if (!image.complete || !image.naturalWidth)
          errors.push("Image missing");
      const leaves = [...slide.querySelectorAll("*")].filter(
        (el) => el.children.length === 0 && el.textContent.trim(),
      );
      const box = slide.getBoundingClientRect();
      for (const el of leaves) {
        const cs = getComputedStyle(el);
        if (
          cs.color === "rgba(0, 0, 0, 0)" &&
          parseFloat(cs.webkitTextStrokeWidth) > 0
        ) {
          expectedDecorations.push(el.textContent.slice(0, 30));
          continue;
        }
        const r = document.createRange();
        r.selectNodeContents(el);
        for (const t of r.getClientRects())
          if (
            t.left < box.left - 2 ||
            t.top < box.top - 2 ||
            t.right > box.right + 2 ||
            t.bottom > box.bottom + 2
          )
            errors.push(
              `Outside slide: ${el.textContent.slice(0, 30)} [${el.className}; color=${getComputedStyle(el).color}; stroke=${getComputedStyle(el).webkitTextStrokeWidth}]`,
            );
      }
      return {
        errors,
        expectedDecorations,
        text: slide.innerText,
        coverage:
          "Leaf text bounds and image loading only; screenshot review required",
        visualReview: "pending",
      };
    });
    report.theme = path.basename(root);
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify({ theme: report.theme, errors: report.errors }));
  } finally {
    await browser.close();
  }
} finally {
  server.kill("SIGTERM");
}
