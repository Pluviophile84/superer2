import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { PATHS, MASTER_LAYOUT, masterTransform } from "../site/src/glyphs.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripMetadata = (s) => s.replace(/<metadata>[\s\S]*?<\/metadata>/, "");
const STACKED_ICONS = ["SUPERER_icon_dark.svg", "SUPERER_icon_light.svg"];
const SINGLE_ICONS = ["SUPERER_icon_single_dark.svg", "SUPERER_icon_single_light.svg"];

test("served master wordmark and overload reference are byte-identical to the originals", () => {
  for (const f of ["SUPERER_master_wordmark.svg", "SUPERER_overload_active.svg"]) {
    assert.equal(read(`site/assets/brand/${f}`), read(`brand-originals/${f}`), f);
  }
});

test("served icons differ from the originals only by the removed <metadata> block", () => {
  for (const f of [...STACKED_ICONS, ...SINGLE_ICONS]) {
    const original = read(`brand-originals/${f}`);
    const served = read(`site/assets/brand/${f}`);
    assert.ok(!served.includes("<metadata>"), `${f} served copy has no metadata`);
    assert.equal(served, stripMetadata(original), f);
  }
});

test("favicon.svg is the single-ER dark icon, metadata stripped", () => {
  assert.equal(
    read("site/assets/social/favicon.svg"),
    stripMetadata(read("brand-originals/SUPERER_icon_single_dark.svg")),
  );
});

test("single-ER icons use the brand E and R outlines", () => {
  for (const f of SINGLE_ICONS) {
    const d = [...read(`brand-originals/${f}`).matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(d, [PATHS.E, PATHS.R], f);
  }
});

test("glyph reference data matches the master wordmark file", () => {
  const svg = read("brand-originals/SUPERER_master_wordmark.svg");
  const paths = [...svg.matchAll(/<path d="([^"]+)" fill="(#[0-9A-F]{6})" transform="([^"]+)"\/>/g)];
  assert.equal(paths.length, MASTER_LAYOUT.length);
  paths.forEach((m, i) => {
    const { glyph, x, er } = MASTER_LAYOUT[i];
    assert.equal(m[1], PATHS[glyph], `glyph ${i} path`);
    assert.equal(m[2], er ? "#FF3B4D" : "#050505", `glyph ${i} fill`);
    assert.equal(m[3], masterTransform(x), `glyph ${i} transform`);
  });
});

test("brand originals are never served", () => {
  assert.ok(!existsSync(new URL("../site/brand-originals", import.meta.url)));
});
