import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyFragments } from "../scripts/render.mjs";
import { SITE } from "../site/src/config.js";

const source = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const build = (bridge) => applyFragments(source, { ...SITE, showLaunchMetaBridge: bridge });
const visibleText = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ");
const labels = (html) => [...html.matchAll(/<p class="sec-label"[^>]*>(SEC\.\d\d) \/ ([A-Z ]+)</g)].map((m) => `${m[1]} ${m[2]}`);
const coords = (html) => [...html.matchAll(/<span class="sec-coord" aria-hidden="true">(ER\.\d\d)</g)].map((m) => m[1]);

test("bridge on: section order and labels", () => {
  assert.deepEqual(labels(build(true)), [
    "SEC.01 ANNOUNCEMENT",
    "SEC.02 NAMING HISTORY",
    "SEC.03 BENCHMARKS",
    "SEC.04 CONSOLE",
    "SEC.05 RENAMING OFFICE",
    "SEC.06 MODEL CARD",
    "SEC.07 CHANGELOG",
    "SEC.08 KNOWN LIMITATIONS",
    "SEC.09 FAQ",
  ]);
  assert.deepEqual(coords(build(true)), ["ER.01", "ER.02", "ER.03", "ER.04", "ER.05", "ER.06", "ER.07", "ER.08", "ER.09"]);
});

test("bridge off: labels and rail renumbered without a gap", () => {
  const html = build(false);
  assert.deepEqual(labels(html), [
    "SEC.01 ANNOUNCEMENT",
    "SEC.02 BENCHMARKS",
    "SEC.03 CONSOLE",
    "SEC.04 RENAMING OFFICE",
    "SEC.05 MODEL CARD",
    "SEC.06 CHANGELOG",
    "SEC.07 KNOWN LIMITATIONS",
    "SEC.08 FAQ",
  ]);
  assert.deepEqual(coords(html), ["ER.01", "ER.02", "ER.03", "ER.04", "ER.05", "ER.06", "ER.07", "ER.08"]);
});

test("bridge off: no SI / naming-history references remain", () => {
  const text = visibleText(build(false));
  assert.doesNotMatch(text, /\bSI\b/);
  assert.doesNotMatch(text, /INTELLIGENCE IMPROVED|NAMING POLL|ARTIFICIAL|EXECUTIVE ORDER|NAME LENGTH|Letters measured|Who approved/i);
  assert.match(text, /SAME INTELLIGENCE\. MORE ER\./);
  assert.match(text, /ADD ER\. IT IS ALWAYS AN UPGRADE\./);
  assert.match(text, /PREVIOUS NAMES\s+SUPER \(DEPRECATED: NOT ENOUGH\)/);
});

test("bridge on: bridge-only copy present, bridge-off copy absent", () => {
  const text = visibleText(build(true));
  assert.match(text, /AI WAS RENAMED SI\. SI WAS NOT ENOUGH\./);
  assert.match(text, /IT'S HOW UPGRADES WORK NOW\./);
  assert.match(text, /ARTIFICIAL \(DEPRECATED: SOUNDED FAKE\) · SUPER \(DEPRECATED: NOT ENOUGH\)/);
  assert.doesNotMatch(text, /SAME INTELLIGENCE\. MORE ER\./);
});

test("hero heading is INTRODUCING. + the wordmark, no duplicated name", () => {
  const h1 = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  assert.match(h1, /<span class="hero-intro">INTRODUCING\.<\/span>/);
  assert.match(h1, /<svg data-master[^>]*role="img" aria-label="SUPERER"/);
  assert.doesNotMatch(visibleText(h1), /SUPERER/);
});

test("ER counts in the static copy are the corrected ones", () => {
  const text = visibleText(source);
  assert.match(text, /VERSION: SUPER · ER: 1 · INTELLIGENCE: 100/);
  assert.match(text, /ER\s+2 \(CANONICAL\)/);
  assert.match(text, /2 \(\+100% VS SUPER\)/);
  assert.doesNotMatch(text, /ER: 0|\+∞%|1 \(CANONICAL\)/);
});

test("the SEC.00 bridge strip is gone; the AI → SI line appears once, as the hero eyebrow", () => {
  assert.doesNotMatch(source, /SEC\.00|class="bridge|bridge-line/);
  const on = visibleText(build(true));
  assert.equal(on.match(/AI → SI → SUPERER/g)?.length, 1);
  assert.match(build(true), /<p class="eyebrow"><!-- SITE:bridge -->AI → SI → SUPERER<!-- \/SITE:bridge -->/);
  const off = visibleText(build(false));
  assert.doesNotMatch(off, /AI → SI/);
  assert.match(off, /RELEASE NOTE · CANONICAL BUILD/);
});
