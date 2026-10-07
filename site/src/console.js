// SEC.03 console: + ER, RESET, SHARE.
import { overloadGlyphs, versionName } from "./overload.js";
import { overloadSpecs, syncGlyphs } from "./svg.js";
import { HOT_ER, MASTER_LAYOUT, masterTransform } from "./glyphs.js";
import { copyText } from "./copy.js";

const MAX_LINES = 60;
// Glyphs past this many extra ERs are far outside the clipped stage.
const MAX_RENDERED_EXTRA = 30;
const DOTS = (label) => `  ${label} ${".".repeat(Math.max(3, 38 - label.length))} `;

const BLOCKS = [
  [
    "> upgrade --target superer",
    DOTS("allocating ER") + "done",
    DOTS("intelligence") + "unchanged (100)",
    DOTS("ER") + "1",
    "  status: CANONICAL. there is only one SUPERER.",
  ],
  ["> upgrade --target supererer", DOTS("ER") + "2", "  note: everything after SUPERER is an upgrade."],
  ["> upgrade --target superererer", DOTS("ER") + "3", "  scientists warned us not to add another ER."],
  ["> upgrade --target supererererer", DOTS("ER") + "4", "  we added two."],
  ["> upgrade --target superererererer", DOTS("ER") + "5", "  warning: ER exceeds container. this is a feature."],
];
const FINAL_BLOCK = (n) => ["> upgrade", DOTS("ER") + n, DOTS("intelligence") + "unchanged (100)"];

// The canonical ER sits at the master positions; everything after overloads.
const CANONICAL_ER = MASTER_LAYOUT.filter((g) => g.er).map((g) => ({
  glyph: g.glyph,
  transform: masterTransform(g.x),
}));

export const consoleVersion = (n) => (n > 8 ? `SUPER(ER)×${n}` : versionName(n));

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

  let n = 0;
  let shareTimer = 0;

  function renderStage(animate) {
    const extra = Math.min(Math.max(n - 1, 0), MAX_RENDERED_EXTRA);
    const specs = n >= 1 ? [...CANONICAL_ER, ...overloadSpecs(overloadGlyphs(extra))] : [];
    syncGlyphs(group, specs, HOT_ER, animate && !reducedMotion.matches);
    const name = consoleVersion(n);
    stage.setAttribute("aria-label", name);
    readout.textContent = `VERSION: ${name} · ER: ${n} · INTELLIGENCE: 100`;
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
    const all = terminal.querySelectorAll(".term-line");
    for (let i = 0; i < all.length - (MAX_LINES - 1); i++) all[i].remove();
    terminal.scrollTop = terminal.scrollHeight;
  }

  addBtn.addEventListener("click", () => {
    n += 1;
    renderStage(true);
    print(n <= BLOCKS.length ? BLOCKS[n - 1] : FINAL_BLOCK(n));
  });

  resetBtn.addEventListener("click", () => {
    n = 0;
    renderStage(false);
    terminal.querySelectorAll(".term-line").forEach((el) => el.remove());
    terminal.scrollTop = 0;
    shareStatus.textContent = "";
  });

  shareBtn.addEventListener("click", async () => {
    const url = siteUrl || location.href.split("#")[0];
    const text = `${consoleVersion(n)} — SUPER WASN'T ENOUGH. ADD ER. ${url}`;
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
