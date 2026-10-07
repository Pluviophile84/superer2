// The Renaming Office rules. Pure and DOM-free; tested in tests/rename.test.mjs.
import { SITE } from "./config.js";
import { BLOCKLIST } from "./data/blocklist.js";

export const MAX_NAME_LENGTH = 20;
export const MAX_UPGRADES = 12;
const AI_LONG = "ARTIFICIAL INTELLIGENCE";

export const SUBLINES = {
  denied: "REQUEST DENIED. INSUFFICIENT ER.",
  canonical: "THERE IS ONLY ONE SUPERER. EVERYTHING AFTER THAT IS AN UPGRADE.",
  hadOne: "ALREADY HAD ONE ER. IT WAS NOT ENOUGH.",
  ai: "SKIPPED SI. SAVES TIME.",
  si: "SI WAS NOT ENOUGH.",
  default: (erAdded) => `INTELLIGENCE: UNCHANGED. ER: +${erAdded}.`,
};

// Letters A-Z incl. common accented Latin letters, digits, space, $ - & .
const DISALLOWED = /[^A-Z0-9À-ÖØ-ÞĀ-ſ $\-&.]/g;

/**
 * Uppercase, strip disallowed characters, collapse spaces, trim, max 20.
 * `live` keeps a trailing space so typing a second word is possible.
 */
export function normalizeName(input, { live = false } = {}) {
  let s = String(input ?? "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(DISALLOWED, "")
    .replace(/ {2,}/g, " ")
    .replace(/^ /, "");
  s = s.slice(0, MAX_NAME_LENGTH);
  return live ? s : s.trim();
}

const LEET = { 0: "O", 1: "I", 3: "E", 4: "A", 5: "S", $: "S" };
const deaccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const tokens = (s) => s.split(/[ .\-&]+/).filter(Boolean);

const BLOCKED = BLOCKLIST.map((term) => tokens(term));

function containsPhrase(words, phrase) {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    if (phrase.every((w, j) => words[i + j] === w)) return true;
  }
  return false;
}

const variants = (w) => [w, w.replace(/S$/, "")].filter(Boolean);

/** True if the normalized name contains a blocked slur or hate term. */
export function isBlocked(name) {
  const base = deaccent(normalizeName(name));
  const forms = new Set([base, base.replace(/[0134$5]/g, (c) => LEET[c])]);
  for (const form of forms) {
    const words = tokens(form);
    const compact = words.join("");
    for (const phrase of BLOCKED) {
      if (phrase.length === 1) {
        const [term] = phrase;
        if (compact === term || variants(compact).includes(term)) return true;
        if (words.some((w) => variants(w).includes(term))) return true;
      } else if (containsPhrase(words, phrase) || compact === phrase.join("")) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {string} input raw text from the form
 * @param {number} upgrades how many times UPGRADE AGAIN was pressed
 * @returns {{denied: boolean, from: string, to: string, erAdded: number, subline: string}}
 */
export function renameRequest(input, upgrades = 0, { bridge = SITE.showLaunchMetaBridge } = {}) {
  const from = normalizeName(input);
  const ups = Math.max(0, Math.min(MAX_UPGRADES, Math.floor(upgrades) || 0));
  const erAdded = 1 + ups;
  const more = "ER".repeat(ups);
  const upgraded = (rule) => (ups > 0 ? SUBLINES.default(erAdded) : rule);

  if (!from) return { denied: true, from, to: "", erAdded: 0, subline: "" };
  if (isBlocked(from)) return { denied: true, from, to: "", erAdded: 0, subline: SUBLINES.denied };

  if (from === "SUPERER") {
    return { denied: false, from, to: "SUPERER" + more, erAdded, subline: SUBLINES.canonical };
  }
  if (from === "SUPER") {
    return { denied: false, from, to: "SUPERER" + more, erAdded, subline: upgraded(SUBLINES.hadOne) };
  }
  // "ARTIFICIAL INTELLIGENCE" is 23 characters; the 20-character input
  // truncates it, so the truncated form also counts and the notice shows it in full.
  if (bridge && (from === "AI" || from === AI_LONG || from === normalizeName(AI_LONG))) {
    return { denied: false, from: from === "AI" ? from : AI_LONG, to: "SUPERER" + more, erAdded, subline: upgraded(SUBLINES.ai) };
  }
  if (bridge && (from === "SI" || from === "SUPER INTELLIGENCE")) {
    return { denied: false, from, to: "SUPERER" + more, erAdded, subline: upgraded(SUBLINES.si) };
  }

  // ER goes on the last word only.
  const words = from.split(" ");
  let last = words.pop();
  // Never output SIER: a trailing SI becomes SUPERER even with the bridge off.
  const endsInER = /ER$/.test(last);
  last = last === "SI" ? "SUPERER" : last + "ER";
  const to = [...words, last].join(" ") + more;
  const rule = endsInER ? SUBLINES.hadOne : SUBLINES.default(erAdded);
  return { denied: false, from, to, erAdded, subline: upgraded(rule) };
}

/** Lowercase file-name slug: "MONDAY MORNINGER" -> "monday-morninger". */
export const slugify = (s) =>
  deaccent(String(s))
    .toLowerCase()
    .replace(/\$/g, "s")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "name";
