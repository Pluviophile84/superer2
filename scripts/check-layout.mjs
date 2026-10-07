// Layout QA against /dist served with the vercel.json headers (incl. CSP).
// Run `npm run build` first. Screenshots go to qa-output/ (git-ignored).
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";
import { startServer } from "./serve.mjs";

const OUT = fileURLToPath(new URL("../qa-output/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]
  .map((width) => ({ width, height: 800 }))
  .concat([{ width: 844, height: 390, landscape: true }]);
const SHOT_WIDTHS = new Set([375, 1440]);

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
const failures = [];
const fail = (vp, msg) => failures.push(`[${vp.width}x${vp.height}] ${msg}`);

const noHScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const rectsOverlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`console ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  const tag = `${vp.width}${vp.landscape ? "-landscape" : ""}`;

  if (!(await noHScroll(page))) fail(vp, "horizontal scroll on load");

  // Header must not take more than 20% of a landscape phone screen.
  const headerH = await page.evaluate(() => document.querySelector("[data-site-header]").getBoundingClientRect().height);
  if (vp.landscape && headerH > vp.height * 0.2) fail(vp, `header is ${headerH}px of ${vp.height}px`);

  if (SHOT_WIDTHS.has(vp.width) && !vp.landscape) {
    await page.locator("#announcement").screenshot({ path: `${OUT}hero-${tag}.png` });
    await page.locator("#benchmarks").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.locator("#benchmarks").screenshot({ path: `${OUT}benchmarks-${tag}.png` });
  }

  // Console: 12 presses, still no horizontal scroll.
  const add = page.locator("[data-add-er]");
  await add.scrollIntoViewIfNeeded();
  for (let i = 0; i < 12; i++) {
    await add.click();
    if (i === 5 && SHOT_WIDTHS.has(vp.width) && !vp.landscape) {
      await page.waitForTimeout(300);
      await page.locator("#console").screenshot({ path: `${OUT}console-6-${tag}.png` });
    }
  }
  if (!(await noHScroll(page))) fail(vp, "horizontal scroll after 12 x + ER");
  const readout = await page.locator("[data-readout]").textContent();
  if (!readout.includes("SUPER(ER)×12") || !readout.includes("ER: 12")) fail(vp, `readout: ${readout}`);
  const lines = await page.locator("[data-terminal] .term-line").count();
  if (lines > 60) fail(vp, `terminal keeps ${lines} lines`);

  if (SHOT_WIDTHS.has(vp.width) && !vp.landscape) {
    await page.locator("#model-card").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.locator("#model-card").screenshot({ path: `${OUT}model-card-${tag}.png` });
  }

  // Header: capped extra ERs at the bottom, tab title follows.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(500);
  const cap = vp.width < 400 ? 3 : 6;
  const glyphs = await page.locator("[data-er-overload] path").count();
  if (glyphs !== cap * 2) fail(vp, `header shows ${glyphs / 2} extra ERs, expected ${cap}`);
  const expectedTitle = "SUPER" + "ER".repeat(1 + cap) + " — Super wasn't enough.";
  const title = await page.title();
  if (title !== expectedTitle) fail(vp, `title "${title}", expected "${expectedTitle}"`);

  // Header ERs never cover the BUY button.
  const buy = await page.locator(".header-nav > :first-child").boundingBox();
  const glyphBoxes = await page.$$eval("[data-er-overload] path", (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
  if (glyphBoxes.some((g) => rectsOverlap(g, buy))) fail(vp, "header ERs overlap the BUY button");
  if (!(await noHScroll(page))) fail(vp, "horizontal scroll at page bottom");

  // Scrolling back up removes them again.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const glyphsTop = await page.locator("[data-er-overload] path").count();
  if (glyphsTop !== 0) fail(vp, `header keeps ${glyphsTop / 2} extra ERs at the top`);

  for (const p of problems) fail(vp, p);
  await page.close();
  console.log(`${failures.some((f) => f.startsWith(`[${vp.width}x${vp.height}]`)) ? "FAIL" : "ok  "} ${vp.width}x${vp.height}`);
}

await browser.close();
server.close();

if (failures.length) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log(`\ncheck-layout: all ${VIEWPORTS.length} viewports passed. Screenshots in qa-output/.`);
