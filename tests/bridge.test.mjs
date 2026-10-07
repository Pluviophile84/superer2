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
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
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
  assert.match(text, /Same intelligence\. More ER\./);
  assert.match(text, /ADD ER\. IT IS ALWAYS AN UPGRADE\./);
  assert.match(text, /PREVIOUS NAMES\s+SUPER \(DEPRECATED: NOT ENOUGH\)/);
});

test("bridge on: bridge-only copy present, bridge-off copy absent", () => {
  const text = visibleText(build(true));
  assert.match(text, /AI was renamed SI\. We renamed it again\./);
  assert.match(text, /IT'S HOW UPGRADES WORK NOW\./);
  assert.match(text, /ARTIFICIAL \(DEPRECATED: SOUNDED FAKE\) · SUPER \(DEPRECATED: NOT ENOUGH\)/);
  assert.doesNotMatch(text, /Same intelligence\. More ER\./);
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

const heroOf = (html) => html.match(/<section class="sec sec--hero"[\s\S]*?<\/section>/)[0];
const h1Of = (html) => html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
/** Accessible name of the h1: its text, with role="img" SVGs read as their aria-label. */
const accessibleName = (h1) =>
  h1
    .replace(/<svg[^>]*aria-label="([^"]*)"[\s\S]*?<\/svg>/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

test("hero grid order: eyebrow, setup line, note, h1 (INTRODUCING. + wordmark), meta, data strip, base row", () => {
  const note = { true: "AI was renamed SI. We renamed it again.", false: "Same intelligence. More ER." };
  for (const bridge of [true, false]) {
    const hero = heroOf(build(bridge));
    const at = (needle) => {
      const i = hero.indexOf(needle);
      assert.ok(i >= 0, `${needle} missing (bridge ${bridge})`);
      return i;
    };
    const order = [
      'class="hero-eyebrow"',
      'class="hero-setup-line"',
      'class="hero-note"',
      "<h1",
      'class="hero-meta"',
      'class="hero-row hero-data"',
      'class="hero-row hero-base"',
    ].map(at);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `DOM order (bridge ${bridge})`);
    const text = visibleText(hero);
    assert.match(text, /RELEASE NOTE · CANONICAL BUILD/);
    assert.match(text, /THE FIX \/ v1\.0\.0/);
    assert.ok(text.includes(note[bridge]), `note (bridge ${bridge})`);
    assert.match(text, /Intelligence: unchanged\. ER: doubled\./);
    assert.match(text, /7 LETTERS · 2 ER · CANONICAL/);
    assert.match(text, /TOTAL ER 02 \+1 VS SUPER INTELLIGENCE 100 CHANGE: 0% STATUS CANONICAL THERE IS ONLY ONE SUPERER\./);
    assert.match(text, /INTELLIGENCE HELD CONSTANT\. UPGRADES ARE CONTENT, NOT TOKENS\./);
  }
});

test("h1 contains exactly INTRODUCING. + the wordmark; accessible name is INTRODUCING. SUPERER", () => {
  for (const bridge of [true, false]) {
    const h1 = h1Of(heroOf(build(bridge)));
    assert.match(h1, /^<span class="hero-intro">INTRODUCING\.<\/span>\s*<svg data-master[^>]*role="img" aria-label="SUPERER"[\s\S]*<\/svg>$/);
    assert.equal(accessibleName(h1), "INTRODUCING. SUPERER");
  }
});

test("hero wordmark uses the tight viewBox; paths untouched", () => {
  const svg = h1Of(source).match(/<svg[^>]*>/)[0];
  assert.match(svg, /viewBox="38 27 982 167"/);
});

test("the setup line is outside the h1 and before it", () => {
  const hero = heroOf(source);
  assert.ok(hero.indexOf("SUPER WASN’T ENOUGH.") < hero.indexOf("<h1"));
  assert.doesNotMatch(h1Of(hero), /WASN/);
});

test("WASN'T ENOUGH appears exactly once in the hero (no other NOT ENOUGH), in both bridge modes", () => {
  for (const bridge of [true, false]) {
    const hero = visibleText(heroOf(build(bridge)));
    assert.equal(hero.match(/WASN['’]T ENOUGH|NOT ENOUGH/gi)?.length, 1, `bridge ${bridge}`);
    assert.match(hero, /SUPER WASN’T ENOUGH\./, "typographic apostrophe");
  }
});

test("the deployment band follows the hero and the hero contains no contract address", () => {
  for (const bridge of [true, false]) {
    const html = build(bridge);
    const afterHero = html.slice(html.indexOf("</section>", html.indexOf('class="sec sec--hero"')) + "</section>".length);
    assert.match(afterHero, /^\s*<section class="sec sec--ink sec--deploy" id="deployment"/, `bridge ${bridge}`);
    const band = afterHero.match(/<section class="sec sec--ink sec--deploy"[\s\S]*?<\/section>/)[0];
    for (const needle of ["CONTRACT ADDRESS", "data-copy-ca", "CHAIN", "VERSION", "STATUS", "BUY $SUPERER", "FOLLOW ON X"]) {
      assert.ok(band.includes(needle), `deployment band has ${needle}`);
    }
    const hero = heroOf(html);
    assert.doesNotMatch(hero, /CONTRACT ADDRESS|data-copy-ca|SITE:ca-|NOT YET DEPLOYED|class="ca/);
  }
});

test("section rhythm: ink and paper sections in the specified order", () => {
  const html = build(true);
  const blocks = [...html.matchAll(/<(section|div) class="sec([^"]*)"(?: id="([^"]+)")?/g)].map((m) => [m[3] || m[2].trim(), /sec--ink/.test(m[2]) ? "ink" : "paper"]);
  assert.deepEqual(blocks, [
    ["announcement", "paper"],
    ["deployment", "ink"],
    ["naming-history", "paper"],
    ["benchmarks", "ink"],
    ["console", "paper"],
    ["renaming-office", "ink"],
    ["model-card", "paper"],
    ["changelog", "paper"],
    ["sec--ink sec--canon", "ink"],
    ["limitations", "paper"],
    ["faq", "paper"],
  ]);
});

test("FAQ: SUPER already had an ER. Why add another? For redundancy.", () => {
  assert.match(source, /<summary>SUPER already had an ER\. Why add another\?<\/summary>\s*<p>For redundancy\.<\/p>/);
});
