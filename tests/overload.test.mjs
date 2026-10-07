import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  overloadGlyphs,
  ADVANCE_AFTER_E,
  ADVANCE_AFTER_R,
} from "../site/src/overload.js";

const TABLE = [
  ["E", 1020.8, 190.0, 0.0],
  ["R", 1152.454, 194.098, 3.563],
  ["E", 1300.587, 208.51, 7.537],
  ["R", 1430.59, 229.706, 10.967],
  ["E", 1575.699, 262.806, 14.704],
  ["R", 1702.131, 299.763, 17.859],
  ["E", 1842.38, 349.602, 21.232],
  ["R", 1963.947, 400.328, 24.037],
];

const close = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

test("overloadGlyphs(4) matches the k = 0-7 reference table", () => {
  const g = overloadGlyphs(4);
  assert.equal(g.length, 8);
  TABLE.forEach(([glyph, x, y, r], k) => {
    assert.equal(g[k].glyph, glyph, `k=${k} glyph`);
    close(g[k].x, x, 0.01, `k=${k} x`);
    close(g[k].y, y, 0.01, `k=${k} y`);
    close(g[k].rotation, r, 0.01, `k=${k} rotation`);
  });
});

test("overloadGlyphs(4) matches the transforms in SUPERER_overload_active.svg", () => {
  const svg = readFileSync(
    new URL("../brand-originals/SUPERER_overload_active.svg", import.meta.url),
    "utf8",
  );
  const re =
    /<path d="([^"]+)" fill="#FF3B4D" transform="translate\(([\d.]+),([\d.]+)\) rotate\(([\d.]+)\) scale\(0\.107021,-0\.107021\)"\/>/g;
  const parsed = [...svg.matchAll(re)].map((m) => ({
    glyph: m[1].startsWith("M169 1493H1104") ? "E" : "R",
    x: +m[2],
    y: +m[3],
    rotation: +m[4],
  }));
  assert.equal(parsed.length, 8, "the reference file holds 8 overload glyphs");
  const g = overloadGlyphs(4);
  parsed.forEach((p, k) => {
    assert.equal(g[k].glyph, p.glyph, `k=${k} glyph`);
    close(g[k].x, p.x, 0.01, `k=${k} x`);
    close(g[k].y, p.y, 0.01, `k=${k} y`);
    close(g[k].rotation, p.rotation, 0.01, `k=${k} rotation`);
  });
});

test("continuation sanity values", () => {
  const g = overloadGlyphs(13);
  for (const [k, x, y, r] of [
    [8, 2098.0, 465.0, 27.47],
    [11, 2444.9, 686.9, 37.76],
    [25, 3362.4, 2363.8, 80.0],
  ]) {
    close(g[k].x, x, 1, `k=${k} x`);
    close(g[k].y, y, 1, `k=${k} y`);
    close(g[k].rotation, r, 0.05, `k=${k} rotation`);
  }
});

test("continuation spacing is 131.72 / 148.84 and rotation never decreases", () => {
  const g = overloadGlyphs(40);
  for (let k = 1; k < g.length; k++) {
    assert.ok(g[k].rotation >= g[k - 1].rotation, `rotation decreased at k=${k}`);
    assert.ok(g[k].rotation <= 80, `rotation above 80 at k=${k}`);
    assert.equal(g[k].glyph, k % 2 === 0 ? "E" : "R");
    if (k < 8) continue;
    const d = Math.hypot(g[k].x - g[k - 1].x, g[k].y - g[k - 1].y);
    const expected = g[k - 1].glyph === "E" ? ADVANCE_AFTER_E : ADVANCE_AFTER_R;
    assert.ok([131.72, 148.84].includes(expected));
    close(d, expected, 0.5, `spacing k=${k - 1}->${k}`);
  }
});

test("overloadGlyphs(0) returns an empty array", () => {
  assert.deepEqual(overloadGlyphs(0), []);
});
