// Scroll-upgrading header: one extra ER per content section whose top edge
// has passed under the header. Plus the "e" + "r" easter egg.
import { overloadGlyphs, versionName } from "./overload.js";
import { overloadSpecs, syncGlyphs } from "./svg.js";
import { HOT_ER } from "./glyphs.js";

const TITLE_SUFFIX = " — Super wasn't enough.";
const MAX_EXTRA = 6;
const MAX_EXTRA_NARROW = 3;
const EGG_WINDOW_MS = 1000;
const EGG_DURATION_MS = 3000;

export function initHeader({ header, mark, group, sections, toast, reducedMotion }) {
  const narrow = window.matchMedia("(max-width: 399.98px)");
  const desktop = window.matchMedia("(min-width: 1024px)");
  const passed = new Map(sections.map((s) => [s, false]));
  let egg = 0;
  let eggTimer = 0;
  let rendered = -1;

  const cap = () => (narrow.matches ? MAX_EXTRA_NARROW : MAX_EXTRA);

  function render() {
    let scrolled = 0;
    passed.forEach((v) => (scrolled += v ? 1 : 0));
    const extra = Math.min(scrolled + egg, cap());
    if (extra === rendered) return;
    const grow = extra > rendered && rendered !== -1;
    rendered = extra;
    syncGlyphs(group, overloadSpecs(overloadGlyphs(extra)), HOT_ER, grow && !reducedMotion.matches);
    const name = versionName(2 + extra);
    mark.setAttribute("aria-label", name);
    document.title = name + TITLE_SUFFIX;
  }

  // A 1px detection line sits just under the header. Every page block is
  // observed against it; whichever block crosses the line is "current", and
  // every counted section up to and including it has passed under the header.
  // Blocks are contiguous, so even a jump scroll changes which one crosses.
  const blocks = [...document.querySelectorAll("main > *, body > footer")];
  const counted = new Set(sections);

  function setCurrent(block) {
    let reached = true;
    for (const b of blocks) {
      if (counted.has(b)) passed.set(b, reached);
      if (b === block) reached = false;
    }
    render();
  }

  let observer = null;
  function observe() {
    if (observer) observer.disconnect();
    const h = Math.round(header.getBoundingClientRect().height);
    const below = Math.max(0, window.innerHeight - h - 1);
    observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).pop();
        if (hit) setCurrent(hit.target);
      },
      { rootMargin: `-${h}px 0px -${below}px 0px`, threshold: 0 },
    );
    blocks.forEach((b) => observer.observe(b));
  }

  observe();
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(observe, 150);
  });
  desktop.addEventListener("change", observe);
  narrow.addEventListener("change", render);
  render();

  // Easter egg: "e" then "r" within 1s, outside editable fields.
  let lastE = 0;
  let toastTimer = 0;
  document.addEventListener("keydown", (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    const t = ev.target;
    if (
      t instanceof Element &&
      (t.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"))
    ) {
      return;
    }
    const key = ev.key.toLowerCase();
    if (key === "e") {
      lastE = ev.timeStamp;
      return;
    }
    if (key === "r" && lastE && ev.timeStamp - lastE <= EGG_WINDOW_MS) {
      lastE = 0;
      egg = 1;
      render();
      clearTimeout(eggTimer);
      eggTimer = setTimeout(() => {
        egg = 0;
        render();
      }, EGG_DURATION_MS);
      toast.textContent = "ER ADDED.";
      toast.classList.add("is-visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove("is-visible");
        toastTimer = setTimeout(() => (toast.textContent = ""), 200);
      }, 1600);
      return;
    }
    lastE = 0;
  });
}
