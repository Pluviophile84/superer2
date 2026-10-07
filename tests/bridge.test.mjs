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
  assert.match(text, /AI WAS RENAMED SI\. WE RENAMED IT AGAIN\./);
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

test("no SEC.00 bridge strip and no AI → SI → SUPERER eyebrow anywhere", () => {
  assert.doesNotMatch(source, /SEC\.00|class="bridge|bridge-line|class="eyebrow/);
  for (const bridge of [true, false]) {
    assert.doesNotMatch(visibleText(build(bridge)), /AI → SI → SUPERER/, `bridge ${bridge}`);
  }
});

test("hero order: setup line, h1 (INTRODUCING. + wordmark), support line, in both bridge modes", () => {
  const support = { true: "AI WAS RENAMED SI. WE RENAMED IT AGAIN.", false: "SAME INTELLIGENCE. MORE ER." };
  for (const bridge of [true, false]) {
    const hero = build(bridge).match(/<section class="sec sec--hero"[\s\S]*?<div class="deploy"/)[0];
    // Top-level elements of the hero copy block, in DOM order.
    const blocks = [...hero.matchAll(/^    <(p|h1)\b[^>]*>([\s\S]*?)<\/\1>$/gm)].map((m) => [m[1], visibleText(m[2]).replace(/\s+/g, " ").trim()]);
    assert.deepEqual(blocks, [
      ["p", "SEC.01 / ANNOUNCEMENT"],
      ["p", "SUPER WASN'T ENOUGH."],
      ["h1", "INTRODUCING."],
      ["p", support[bridge]],
    ], `bridge ${bridge}`);
    const h1 = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
    assert.match(h1, /^<span class="hero-intro">INTRODUCING\.<\/span>\s*<svg data-master[^>]*role="img" aria-label="SUPERER"[\s\S]*<\/svg>$/);
    assert.doesNotMatch(h1, /WASN'T ENOUGH/);
  }
});

test("hero says WASN'T ENOUGH / NOT ENOUGH exactly once, in both bridge modes", () => {
  for (const bridge of [true, false]) {
    const html = build(bridge);
    const hero = visibleText(html.match(/<section class="sec sec--hero"[\s\S]*?<\/section>/)[0]);
    assert.equal(hero.match(/WASN'T ENOUGH|NOT ENOUGH/gi)?.length, 1, `bridge ${bridge}`);
    assert.match(hero, /SUPER WASN'T ENOUGH\./);
    assert.doesNotMatch(hero, /SUPER ALREADY HAD ONE ER/);
  }
  assert.match(visibleText(build(true)), /AI WAS RENAMED SI\. WE RENAMED IT AGAIN\./);
});

test("FAQ: SUPER already had an ER. Why add another? For redundancy.", () => {
  assert.match(source, /<summary>SUPER already had an ER\. Why add another\?<\/summary>\s*<p>For redundancy\.<\/p>/);
});
