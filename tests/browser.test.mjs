import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { create } from "../examples/matrix.mjs";
import { serve } from "../runtime/server.mjs";
import { load, hash } from "../runtime/project.mjs";
import { compile } from "../runtime/compiler.mjs";
import { qa } from "../runtime/qa.mjs";
import JSZip from "jszip";
test("browser text/image editing survives save/reopen/export; conflict preserves draft", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dawang-browser-"));
  create(dir, "moon-white-imagery", "training");
  const before = compile(load(dir)),
    server = await serve(dir);
  let browser;
  try {
    browser = await chromium.launch({
      executablePath:
        process.env.DAWANG_CHROME ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    });
    const page = await browser.newPage();
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);
    await page.locator('[data-element-id="s3.title"]').click();
    await page.locator("#text").fill("第三页已由浏览器修改");
    await page.locator("#apply").click();
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.locator("#save").click(),
    ]);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-element-id="s3.title"]').textContent ===
        "第三页已由浏览器修改",
    );
    assert.equal(
      load(dir).sources.nodes.find((n) => n.id === "title.2").text,
      "第三页已由浏览器修改",
    );
    await page.locator('[data-media-ref="demo.image"]').click();
    await page
      .locator("#image")
      .setInputFiles(path.join(dir, "assets/demo.png"));
    await page.waitForFunction(
      () =>
        document.querySelector("#status").textContent === "图片草稿尚未保存",
    );
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.locator("#save").click(),
    ]);
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-media-ref]")
          .getAttribute("src")
          .includes(".png") &&
        !document
          .querySelector("[data-media-ref]")
          .getAttribute("src")
          .includes("demo.png"),
    );
    await page.reload();
    assert.equal(
      await page.locator('[data-element-id="s3.title"]').innerText(),
      "第三页已由浏览器修改",
    );
    const after = compile(load(dir));
    for (let i = 0; i < 6; i++)
      if (![1, 2].includes(i))
        assert.deepEqual(after.slides[i], before.slides[i]);
    const response = await page.request.get(url + "api/export");
    assert.equal(response.status(), 200);
    const zip = await JSZip.loadAsync(await response.body());
    const xml = await zip.file("ppt/slides/slide3.xml").async("string");
    assert.match(xml, /第三页已由浏览器修改/);
    assert.ok(
      zip.file("ppt/media/image-2-1.png") ||
        Object.keys(zip.files).some(
          (k) => k.startsWith("ppt/media/") && k.endsWith(".png"),
        ),
    );
    const stale = await page.evaluate(async () => {
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: "stale",
          patch: { texts: { "title.2": "冲突文字" } },
        }),
      });
      return r.status;
    });
    assert.equal(stale, 409);
    assert.equal(
      load(dir).sources.nodes.find((n) => n.id === "title.2").text,
      "第三页已由浏览器修改",
    );
    const denied = await page.request.post(url + "api/save", {
      data: { revision: hash(load(dir)), patch: {} },
    });
    assert.equal(denied.status(), 403);
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("actual long Chinese text triggers geometry failure", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dawang-overflow-"));
  create(dir, "blue-line-courseware", "training");
  const p = load(dir);
  p.sources.nodes[0].text = "长中文标题混合MixedEnglish与100单位".repeat(30);
  fs.writeFileSync(path.join(dir, "sources.json"), JSON.stringify(p.sources));
  try {
    const report = await qa(dir);
    assert.equal(report.geometryPassed, false);
    assert.ok(report.pages[0].errors.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("unavailable configured font fails QA rather than using stale font metrics", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dawang-font-"));
  create(dir, "indigo-due-diligence", "analysis");
  const p = load(dir);
  p.designBrief.tokens.titleFont = "DawangFontThatDoesNotExist";
  fs.writeFileSync(
    path.join(dir, "design-brief.json"),
    JSON.stringify(p.designBrief),
  );
  try {
    const r = await qa(dir);
    assert.equal(r.geometryPassed, false);
    assert.ok(r.pages[0].errors.some((e) => e.includes("Font fallback")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
