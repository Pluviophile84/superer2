// SEC.04 console: + ER, RESET, SHARE.
import { overloadGlyphs, versionName, extraERs } from "./overload.js";
import { overloadSpecs, syncGlyphs } from "./svg.js";
import { HOT_ER, MASTER_LAYOUT, masterTransform } from "./glyphs.js";
import { copyText } from "./copy.js";

// Glyphs past this many extra ERs are far outside the clipped stage.
const MAX_RENDERED_EXTRA = 30;
// Above this ER count the readout uses the short form.
const SHORT_FORM_ABOVE = 9;

// Terminal lines are data: a command, a "key ..... value" row (the dotted
// leader is drawn by CSS and stretches with the terminal), or plain text.
const cmd = (text) => ({ kind: "cmd", text });
const kv = (key, value) => ({ kind: "kv", key, value: String(value) });
const text = (t) => ({ kind: "text", text: t });

/** Plain-text form of a line, e.g. for announcements and tests. */
export const lineText = (line) =>
  line.kind === "kv" ? `${line.key} ${line.value}` : line.text;

// One entry per press. `add` is how many ERs that press adds; every ER in
// the word counts, so SUPER starts at 1 and the canonical SUPERER is 2.
// The last line of each block is the one announced to screen readers.
export const SCRIPT = [
  {
    add: 1,
    lines: (n) => [
      cmd("> upgrade --target superer"),
      kv("allocating ER", "done"),
      kv("intelligence", "unchanged (100)"),
      kv("ER", n),
      text("status: CANONICAL. there is only one SUPERER."),
      text("scientists warned us not to add another ER."),
    ],
  },
  {
    add: 2,
    lines: (n) => [cmd("> upgrade --ignore-warnings"), kv("ER", `${n}  (+2)`), text("we added two.")],
  },
  {
    add: 1,
    lines: (n) => [cmd("> upgrade"), kv("ER", n), text("note: everything after SUPERER is an upgrade.")],
  },
  {
    add: 1,
    lines: (n) => [cmd("> upgrade"), kv("ER", n), text("warning: ER exceeds container. this is a feature.")],
  },
];
const FINAL = {
  add: 1,
  lines: (n) => [cmd("> upgrade"), kv("ER", n), kv("intelligence", "unchanged (100)")],
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

function lineElement(line) {
  const p = document.createElement("p");
  p.className = `term-line term-${line.kind}`;
  if (line.kind === "kv") {
    const key = document.createElement("span");
    key.className = "term-key";
    key.textContent = line.key;
    const dots = document.createElement("span");
    dots.className = "term-dots";
    dots.setAttribute("aria-hidden", "true");
    const value = document.createElement("span");
    value.className = "term-val";
    value.textContent = line.value;
    p.append(key, dots, value);
  } else {
    p.textContent = line.text;
  }
  return p;
}

export function initConsole({ root, siteUrl, reducedMotion }) {
  const stage = root.querySelector("[data-stage]");
  const group = root.querySelector("[data-stage-er]");
  const readout = root.querySelector("[data-readout]");
  const terminal = root.querySelector("[data-terminal]");
  const announce = root.querySelector("[data-console-status]");
  const controls = root.querySelector("[data-console-controls]");
  const addBtn = root.querySelector("[data-add-er]");
  const resetBtn = root.querySelector("[data-reset]");
  const shareBtn = root.querySelector("[data-share]");
  const shareStatus = root.querySelector("[data-share-status]");
  const prompt = terminal.querySelector(".term-prompt");

  const state = createConsoleState();
  let shareTimer = 0;

  // Keep only the lines that fit: remove whole lines from the top (oldest
  // first) so no line is ever shown cut off. Nothing scrolls.
  function fit() {
    const cs = getComputedStyle(terminal);
    const available = terminal.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const height = () => [...terminal.children].reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
    while (terminal.firstElementChild !== prompt && height() > available + 0.5) {
      terminal.firstElementChild.remove();
    }
    while (terminal.firstElementChild && terminal.firstElementChild.classList.contains("term-gap")) {
      terminal.firstElementChild.remove();
    }
  }
  // Re-fit when the terminal's size changes (breakpoints, font size).
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(terminal);

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
      gap.className = "term-gap";
      gap.setAttribute("aria-hidden", "true");
      frag.appendChild(gap);
    }
    for (const line of lines) frag.appendChild(lineElement(line));
    terminal.insertBefore(frag, prompt);
    fit();
  }

  addBtn.addEventListener("click", () => {
    const { count, lines } = state.press();
    renderStage(true);
    print(lines);
    // Announce one summary, not every added or removed terminal line.
    announce.textContent = `${readoutText(count)}. ${lineText(lines[lines.length - 1])}`;
  });

  resetBtn.addEventListener("click", () => {
    state.reset();
    renderStage(false);
    terminal.querySelectorAll(".term-line, .term-gap").forEach((el) => el.remove());
    announce.textContent = readoutText(state.count);
    shareStatus.textContent = "";
  });

  shareBtn.addEventListener("click", async () => {
    const url = siteUrl || location.href.split("#")[0];
    const shareText = `${consoleVersion(state.count)} — SUPER WASN'T ENOUGH. ADD ER. ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    const ok = await copyText(shareText);
    shareStatus.textContent = ok ? "COPIED." : "";
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => (shareStatus.textContent = ""), 2000);
  });

  controls.hidden = false;
  renderStage(false);
}
