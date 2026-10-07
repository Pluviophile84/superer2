import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("every inlined master wordmark in index.html carries the master paths unchanged", () => {
  const html = read("site/index.html");
  const master = read("brand-originals/SUPERER_master_wordmark.svg");
  const masterPaths = master.match(/<path [^>]+\/>/g);
  const blocks = [...html.matchAll(/<svg[^>]*data-master[^>]*>([\s\S]*?)<\/svg>/g)];
  assert.ok(blocks.length >= 3, "hero, header and footer inline the master");
  for (const b of blocks) {
    const inner = b[1].match(/<path [^>]+\/>/g);
    assert.deepEqual(inner.slice(0, 7), masterPaths);
  }
});


test("modulepreload lists exactly the statically imported module graph of main.js", () => {
  const html = read("site/index.html");
  const preloaded = [...html.matchAll(/<link rel="modulepreload" href="\.\/src\/([a-z/]+\.js)">/g)].map((m) => m[1]).sort();
  const seen = new Set();
  const walk = (file) => {
    // Static imports only; dynamic import() is loaded lazily on purpose.
    for (const m of read(`site/src/${file}`).matchAll(/^import [^;]*? from "\.\/([a-z/]+\.js)";/gm)) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        walk(m[1]);
      }
    }
  };
  walk("main.js");
  assert.deepEqual(preloaded, [...seen].sort());
});
