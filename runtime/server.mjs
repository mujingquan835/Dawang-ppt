import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { load, save, hash, applyEdits, checkMedia } from "./project.mjs";
import { build } from "./build.mjs";
import { exportPptx } from "./export.mjs";
export async function serve(dir, port = 0) {
  dir = fs.realpathSync(dir);
  build(dir);
  let mutating = false;
  const server = http.createServer(async (req, res) => {
    const respond = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (
        ![
          "127.0.0.1:" + server.address().port,
          "localhost:" + server.address().port,
        ].includes(req.headers.host)
      ) {
        respond(403, { error: "Invalid host" });
        return;
      }
      if (req.method === "POST") {
        if (req.headers.origin !== `http://${req.headers.host}`) {
          respond(403, { error: "Same-origin editor required" });
          return;
        }
        if (mutating) {
          respond(409, { error: "Another save is in progress" });
          return;
        }
        mutating = true;
        try {
          let size = 0,
            chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 12 * 1024 * 1024) throw Error("Upload limit 12 MB");
            chunks.push(chunk);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (url.pathname === "/api/save") {
            const p = load(dir);
            if (body.revision !== hash(p)) {
              respond(409, {
                error: "Project changed; reload before retrying",
              });
              return;
            }
            const next = applyEdits(p, body.patch);
            checkMedia(dir, next);
            const backup = path.join(
              dir,
              "revisions",
              new Date().toISOString().replaceAll(":", "-"),
            );
            save(backup, p);
            save(dir, next);
            build(dir);
            respond(200, { revision: hash(next) });
            return;
          }
          if (url.pathname === "/api/media") {
            const match =
              /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
                body.data || "",
              );
            if (!match) throw Error("Only PNG/JPEG images supported");
            const bytes = Buffer.from(match[2], "base64");
            if (
              (match[1] === "png" &&
                !bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
              (match[1] === "jpeg" && (bytes[0] !== 255 || bytes[1] !== 216))
            )
              throw Error("Invalid image bytes");
            const src = `assets/${hash(bytes.toString("base64")).slice(0, 20)}.${match[1] === "jpeg" ? "jpg" : "png"}`;
            fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
            fs.writeFileSync(path.join(dir, src), bytes);
            respond(200, { src });
            return;
          }
          respond(404, { error: "Unknown operation" });
          return;
        } finally {
          mutating = false;
        }
      }
      if (url.pathname === "/api/export") {
        if (mutating) {
          respond(409, { error: "Save in progress" });
          return;
        }
        mutating = true;
        try {
          const out = path.join(dir, "Dawang-PPT.pptx");
          await exportPptx(dir, out);
          res.writeHead(200, {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "Content-Disposition": 'attachment; filename="Dawang-PPT.pptx"',
          });
          res.end(fs.readFileSync(out));
        } finally {
          mutating = false;
        }
        return;
      }
      const file = path.resolve(
        dir,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (
        !file.startsWith(dir + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile() ||
        !fs.realpathSync(file).startsWith(dir + path.sep)
      ) {
        respond(404, { error: "Not found" });
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".json": "application/json",
            ".svg": "image/svg+xml",
          }[ext] || "application/octet-stream",
      });
      res.end(fs.readFileSync(file));
    } catch (e) {
      respond(400, { error: e.message });
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return server;
}
