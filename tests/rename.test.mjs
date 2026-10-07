import { test } from "node:test";
import assert from "node:assert/strict";
import { renameRequest, normalizeName, isBlocked, slugify, SUBLINES } from "../site/src/rename.js";
import { BLOCKLIST } from "../site/src/data/blocklist.js";

const on = { bridge: true };
const off = { bridge: false };
const r = (input, ups = 0, opts = on) => renameRequest(input, ups, opts);

// A sample slur, kept encoded so the test source stays clean.
const SLUR = atob("S0lLRQ==");

test("normalization: trim, collapse spaces, uppercase", () => {
  assert.equal(normalizeName("  monday    morning  "), "MONDAY MORNING");
  assert.equal(normalizeName("coffee"), "COFFEE");
  assert.equal(normalizeName("café crème"), "CAFÉ CRÈME");
});

test("normalization: strips anything outside letters, digits, space, $ - & .", () => {
  assert.equal(normalizeName("A!B@C#D%E^F*G(H)_+=?/<>\"'"), "ABCDEFGH");
  assert.equal(normalizeName("$SUPERER & co.-op"), "$SUPERER & CO.-OP");
  assert.equal(normalizeName("emoji 🙂 x"), "EMOJI X");
  assert.equal(normalizeName("!!!"), "");
});

test("normalization: max 20 characters", () => {
  assert.equal(normalizeName("abcdefghijklmnopqrstuvwxyz"), "ABCDEFGHIJKLMNOPQRST");
  assert.equal(normalizeName("abcdefghijklmnopqrs tuv").length, 19, "trailing space after the cut is trimmed");
  assert.equal(normalizeName("monday ", { live: true }), "MONDAY ", "live mode keeps a trailing space");
});

test("row: blocked term is denied", () => {
  const res = r(SLUR.toLowerCase());
  assert.equal(res.denied, true);
  assert.equal(res.subline, "REQUEST DENIED. INSUFFICIENT ER.");
  assert.equal(r(SLUR, 3).denied, true);
});

test("row: SUPERER stays SUPERER (+ upgrades)", () => {
  assert.deepEqual(r("superer"), { denied: false, from: "SUPERER", to: "SUPERER", erAdded: 1, subline: SUBLINES.canonical });
  const up = r("SUPERER", 2);
  assert.equal(up.to, "SUPERERERER");
  assert.equal(up.subline, SUBLINES.canonical, "SUPERER keeps its subline after upgrades");
});

test("row: SUPER becomes SUPERER", () => {
  assert.deepEqual(r("super"), { denied: false, from: "SUPER", to: "SUPERER", erAdded: 1, subline: "ALREADY HAD ONE ER. IT WAS NOT ENOUGH." });
});

test("row: AI / ARTIFICIAL INTELLIGENCE (bridge only)", () => {
  for (const input of ["AI", "artificial intelligence", "ARTIFICIAL INTELLIGE"]) {
    const res = r(input);
    assert.equal(res.to, "SUPERER");
    assert.equal(res.subline, "SKIPPED SI. SAVES TIME.");
  }
  assert.equal(r("artificial intelligence").from, "ARTIFICIAL INTELLIGENCE", "notice shows the full phrase");
});

test("row: SI / SUPER INTELLIGENCE (bridge only), never SIER", () => {
  for (const input of ["si", "Super Intelligence"]) {
    const res = r(input);
    assert.equal(res.to, "SUPERER");
    assert.equal(res.subline, "SI WAS NOT ENOUGH.");
  }
  assert.ok(!r("SI", 0, off).to.includes("SIER"));
  assert.ok(!r("MR SI", 0, on).to.includes("SIER"));
});

test("bridge off: AI / SI fall through to the default rule", () => {
  assert.deepEqual(r("AI", 0, off), { denied: false, from: "AI", to: "AIER", erAdded: 1, subline: "INTELLIGENCE: UNCHANGED. ER: +1." });
  assert.equal(r("ARTIFICIAL INTELLIGENCE", 0, off).to, "ARTIFICIAL INTELLIGEER", "20-character limit applies");
  assert.equal(r("SUPER INTELLIGENCE", 0, off).to, "SUPER INTELLIGENCEER");
  assert.equal(r("SI", 0, off).to, "SUPERER");
  assert.equal(r("SI", 0, off).subline, "INTELLIGENCE: UNCHANGED. ER: +1.");
});

test("row: word ending in ER", () => {
  assert.deepEqual(r("burger"), { denied: false, from: "BURGER", to: "BURGERER", erAdded: 1, subline: "ALREADY HAD ONE ER. IT WAS NOT ENOUGH." });
});

test("row: anything else", () => {
  assert.deepEqual(r("coffee"), { denied: false, from: "COFFEE", to: "COFFEEER", erAdded: 1, subline: "INTELLIGENCE: UNCHANGED. ER: +1." });
});

test("last-word rule", () => {
  assert.equal(r("monday morning").to, "MONDAY MORNINGER");
  assert.equal(r("the office manager").subline, SUBLINES.hadOne);
});

test("upgrades add ERs to the end and switch the subline", () => {
  assert.equal(r("coffee", 1).to, "COFFEEERER");
  assert.equal(r("MONDAY", 3).to, "MONDAYERERERER");
  assert.equal(r("MONDAY", 3).erAdded, 4);
  assert.equal(r("MONDAY", 3).subline, "INTELLIGENCE: UNCHANGED. ER: +4.");
  assert.equal(r("burger", 1).subline, "INTELLIGENCE: UNCHANGED. ER: +2.");
  assert.equal(r("super", 1).subline, "INTELLIGENCE: UNCHANGED. ER: +2.");
  assert.equal(r("ai", 2).to, "SUPERERERER");
});

test("blocklist: denies a slur, allows normal words, catches leetspeak and plurals", () => {
  assert.ok(isBlocked(SLUR));
  assert.ok(isBlocked(SLUR + "S"), "plural");
  assert.ok(isBlocked("K1K3"), "leetspeak 1->I, 3->E");
  assert.ok(isBlocked("my " + SLUR.toLowerCase() + " friend"), "whole word inside a phrase");
  for (const ok of ["COFFEE", "MONDAY MORNING", "SPICES", "SCUNTHORPE", "SUPER", "$SUPERER", "SKIKER", "BIG 5"]) {
    assert.equal(isBlocked(ok), false, ok);
  }
});

test("blocklist covers every stored term", () => {
  for (const term of BLOCKLIST) assert.ok(isBlocked(term), "term is blocked");
});

test("empty input is denied without a subline", () => {
  assert.equal(r("   ").denied, true);
  assert.equal(r("   ").subline, "");
});

test("slugify for the download name", () => {
  assert.equal(slugify("MONDAY MORNINGER"), "monday-morninger");
  assert.equal(slugify("CAFÉ & $COIN."), "cafe-and-scoin");
});
