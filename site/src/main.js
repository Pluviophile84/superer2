// Entry point. All content is in the HTML; this only adds behaviour.
import { SITE, isPlaceholder } from "./config.js";
import { initHeader } from "./header.js";
import { initConsole } from "./console.js";
import { initCopyButtons } from "./copy.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel) => document.querySelector(sel);

initCopyButtons({
  address: isPlaceholder(SITE.contractAddress) ? "" : String(SITE.contractAddress).trim(),
  status: $("[data-copy-status]"),
});

initHeader({
  header: $("[data-site-header]"),
  mark: $("[data-header-mark]"),
  group: $("[data-er-overload]"),
  sections: [...document.querySelectorAll("[data-upgrade-section]")],
  toast: $("[data-toast]"),
  reducedMotion,
});

initConsole({
  root: $("[data-console]"),
  siteUrl: isPlaceholder(SITE.siteUrl) ? "" : String(SITE.siteUrl).trim(),
  reducedMotion,
});

// The Renaming Office (rules, blocklist, card renderer) is not needed for the
// first paint: load it when the section approaches the viewport.
const office = $("[data-office]");
if (office) {
  const loadOffice = () =>
    import("./office.js").then(({ initOffice }) =>
      initOffice({ root: office, siteUrl: isPlaceholder(SITE.siteUrl) ? "" : String(SITE.siteUrl).trim() }),
    );
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          loadOffice();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(office);
  } else {
    loadOffice();
  }
}

// Benchmark bars grow once on first view; reduced motion shows them at once.
const chart = $("[data-chart]");
if (chart && !reducedMotion.matches && "IntersectionObserver" in window) {
  chart.classList.add("is-armed");
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        // Next frame so the collapsed state is painted before the transition.
        requestAnimationFrame(() => requestAnimationFrame(() => chart.classList.add("is-in")));
        io.disconnect();
      }
    },
    { threshold: 0.25 },
  );
  io.observe(chart);
}
