// Local static server for /dist that sends the same headers as vercel.json
// (including the Content-Security-Policy), with gzip. Used by QA scripts.
import { createServer } from "node:http";
import { readFileSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".svg", ".txt", ".json"]);

const rules = vercel.headers.map((h) => ({
  re: new RegExp("^" + h.source.replace(/\(\.\*\)/g, "(.*)") + "$"),
  headers: h.headers,
}));

export function startServer({ dir = join(root, "dist"), port = 0 } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(dir, path));
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    for (const rule of rules) {
      if (rule.re.test(url.pathname)) for (const h of rule.headers) res.setHeader(h.key, h.value);
    }
    const ext = extname(file);
    let body = readFileSync(file);
    res.setHeader("content-type", TYPES[ext] || "application/octet-stream");
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      body = gzipSync(body);
      res.setHeader("content-encoding", "gzip");
    }
    res.setHeader("content-length", body.length);
    res.end(body);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  startServer({ port }).then(() => console.log(`serving dist/ with vercel.json headers on http://127.0.0.1:${port}`));
}
