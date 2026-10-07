// SEC.04 console: + ER, RESET, SHARE.
import { overloadGlyphs, versionName, extraERs } from "./overload.js";
import { overloadSpecs, syncGlyphs } from "./svg.js";
import { HOT_ER, MASTER_LAYOUT, masterTransform } from "./glyphs.js";
import { copyText } from "./copy.js";

// Desktop keeps a scrollable history; touch/narrow screens keep only the
// last few lines because the terminal grows instead of scrolling there.
const MAX_LINES_DESKTOP = 60;
const MAX_LINES_TOUCH = 8;
const DESKTOP_TERMINAL = "(min-width: 768px) and (pointer: fine)";
// Glyphs past this many extra ERs are far outside the clipped stage.
const MAX_RENDERED_EXTRA = 30;
// Above this ER count the readout uses the short form.
const SHORT_FORM_ABOVE = 9;
const DOTS = (label) => `  ${label} ${".".repeat(Math.max(3, 38 - label.length))} `;

// One entry per press. `add` is how many ERs that press adds; every ER in
// the word counts, so SUPER starts at 1 and the canonical SUPERER is 2.
export const SCRIPT = [
  {
    add: 1,
    lines: (n) => [
      "> upgrade --target superer",
      DOTS("allocating ER") + "done",
      DOTS("intelligence") + "unchanged (100)",
      DOTS("ER") + n,
      "  status: CANONICAL. there is only one SUPERER.",
    ],
  },
  {
    add: 1,
    lines: (n) => ["> upgrade --target supererer", DOTS("ER") + n, "  note: everything after SUPERER is an upgrade."],
  },
  {
    add: 1,
    lines: (n) => ["> upgrade --target superererer", DOTS("ER") + n, "  scientists warned us not to add another ER."],
  },
  {
    add: 2,
    lines: (n) => ["> upgrade --ignore-warnings", DOTS("ER") + n + "  (+2)", "  we added two."],
  },
  {
    add: 1,
    lines: (n) => ["> upgrade", DOTS("ER") + n, "  warning: ER exceeds container. this is a feature."],
  },
];
const FINAL = {
  add: 1,
  lines: (n) => ["> upgrade", DOTS("ER") + n, DOTS("intelligence") + "unchanged (100)"],
};

export const START_COUNT = 1;

/** Pure console state: press() returns the terminal block it printed. */
export function createConsoleState() {
  let presses = 0;
  let count = START_COUNT;
  return {
    get count() {
      return count;
    },
    get presses() {
      return presses;
    },
    press() {
      const step = SCRIPT[presses] || FINAL;
      presses += 1;
      count += step.add;
      return { added: step.add, count, lines: step.lines(count) };
    },
    reset() {
      presses = 0;
      count = START_COUNT;
    },
  };
}

export const consoleVersion = (count) =>
  count > SHORT_FORM_ABOVE ? `SUP(ER)×${count}` : versionName(count);

export const readoutText = (count) => `VERSION: ${consoleVersion(count)} · ER: ${count} · INTELLIGENCE: 100`;

// The canonical ER sits at the master positions; everything after overloads.
const CANONICAL_ER = MASTER_LAYOUT.filter((g) => g.er).map((g) => ({
  glyph: g.glyph,
  transform: masterTransform(g.x),
}));

export function initConsole({ root, siteUrl, reducedMotion }) {
  const stage = root.querySelector("[data-stage]");
  const group = root.querySelector("[data-stage-er]");
  const readout = root.querySelector("[data-readout]");
  const terminal = root.querySelector("[data-terminal]");
  const controls = root.querySelector("[data-console-controls]");
  const addBtn = root.querySelector("[data-add-er]");
  const resetBtn = root.querySelector("[data-reset]");
  const shareBtn = root.querySelector("[data-share]");
  const shareStatus = root.querySelector("[data-share-status]");
  const prompt = terminal.querySelector(".term-prompt");

  const state = createConsoleState();
  const desktop = window.matchMedia(DESKTOP_TERMINAL);
  let shareTimer = 0;

  // Remove the oldest output lines beyond the limit, then any spacer left
  // dangling at the top. Older lines are removed, not scrolled.
  function trim() {
    const max = desktop.matches ? MAX_LINES_DESKTOP : MAX_LINES_TOUCH;
    const output = terminal.querySelectorAll(".term-line:not(.term-gap)");
    for (let i = 0; i < output.length - max; i++) {
      const line = output[i];
      while (line.previousElementSibling && line.previousElementSibling.classList.contains("term-gap")) {
        line.previousElementSibling.remove();
      }
      line.remove();
    }
    const first = terminal.firstElementChild;
    if (first && first.classList.contains("term-gap")) first.remove();
    if (desktop.matches) terminal.scrollTop = terminal.scrollHeight;
  }
  desktop.addEventListener("change", trim);

  function renderStage(animate) {
    const n = state.count;
    const extra = Math.min(extraERs(n), MAX_RENDERED_EXTRA);
    const specs = n >= 2 ? [...CANONICAL_ER, ...overloadSpecs(overloadGlyphs(extra))] : [];
    syncGlyphs(group, specs, HOT_ER, animate && !reducedMotion.matches);
    stage.setAttribute("aria-label", consoleVersion(n));
    readout.textContent = readoutText(n);
  }

  function print(lines) {
    const frag = document.createDocumentFragment();
    if (terminal.querySelector(".term-line")) {
      const gap = document.createElement("p");
      gap.className = "term-line term-gap";
      gap.setAttribute("aria-hidden", "true");
      frag.appendChild(gap);
    }
    lines.forEach((text, i) => {
      const p = document.createElement("p");
      p.className = i === 0 ? "term-line term-cmd" : "term-line";
      p.textContent = text;
      frag.appendChild(p);
    });
    terminal.insertBefore(frag, prompt);
    trim();
  }

  addBtn.addEventListener("click", () => {
    const { lines } = state.press();
    renderStage(true);
    print(lines);
  });

  resetBtn.addEventListener("click", () => {
    state.reset();
    renderStage(false);
    terminal.querySelectorAll(".term-line").forEach((el) => el.remove());
    terminal.scrollTop = 0;
    shareStatus.textContent = "";
  });

  shareBtn.addEventListener("click", async () => {
    const url = siteUrl || location.href.split("#")[0];
    const text = `${consoleVersion(state.count)} — SUPER WASN'T ENOUGH. ADD ER. ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    const ok = await copyText(text);
    shareStatus.textContent = ok ? "COPIED." : "";
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => (shareStatus.textContent = ""), 2000);
  });

  controls.hidden = false;
  renderStage(false);
}
