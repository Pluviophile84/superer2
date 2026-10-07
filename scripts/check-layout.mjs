// Layout QA against /dist served with the vercel.json headers (incl. CSP).
// Run `npm run build` first. Also builds a variant with showLaunchMetaBridge
// flipped into a temp folder and checks it too. Screenshots go to qa-output/
// (git-ignored).
import { mkdirSync, mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";
import { startServer } from "./serve.mjs";
import { buildSite } from "./build.mjs";
import { SITE } from "../site/src/config.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(root, "qa-output");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]
  .map((width) => ({ width, height: 800 }))
  .concat([{ width: 844, height: 390, landscape: true }]);
const SHOT_WIDTHS = new Set([375, 1440]);

// Variant B: the same site with the bridge flag flipped, built into a temp dir.
const tmp = mkdtempSync(join(tmpdir(), "superer-check-"));
cpSync(join(root, "site"), join(tmp, "site"), { recursive: true });
const cfgPath = join(tmp, "site", "src", "config.js");
const flipped = !SITE.showLaunchMetaBridge;
writeFileSync(
  cfgPath,
  readFileSync(cfgPath, "utf8").replace(/showLaunchMetaBridge:\s*(true|false)/, `showLaunchMetaBridge: ${flipped}`),
);
await buildSite({ siteDir: join(tmp, "site"), distDir: join(tmp, "dist"), quiet: true });

const VARIANTS = [
  { name: `bridge-${SITE.showLaunchMetaBridge ? "on" : "off"}`, dir: join(root, "dist"), bridge: SITE.showLaunchMetaBridge, shots: true },
  { name: `bridge-${flipped ? "on" : "off"}`, dir: join(tmp, "dist"), bridge: flipped, shots: false },
];

const browser = await launchChromium();
const failures = [];

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const rectsOverlap = (a, b) =>
  a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const versionName = (count) => "SUP" + "ER".repeat(count);

for (const variant of VARIANTS) {
  const server = await startServer({ dir: variant.dir });
  const url = `http://127.0.0.1:${server.address().port}/`;
  console.log(`\n${variant.name}`);

  for (const vp of VIEWPORTS) {
    const id = `${variant.name} ${vp.width}x${vp.height}`;
    const fail = (msg) => failures.push(`[${id}] ${msg}`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const problems = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(`console ${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    await page.goto(url, { waitUntil: "networkidle" });
    const shots = variant.shots && SHOT_WIDTHS.has(vp.width) && !vp.landscape;
    const tag = `${vp.width}`;
    // Element screenshots taller than the viewport would also capture the
    // off-screen skip link; hide it with the hidden attribute (no inline
    // style, which the CSP would rightly block) and restore it after.
    const skipLink = (hide) => page.evaluate((h) => (document.querySelector(".skip-link").hidden = h), hide);
    const shot = async (selector, name) => {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForTimeout(450);
      await skipLink(true);
      await page.locator(selector).screenshot({ path: join(OUT, `${name}-${tag}.png`) });
      await skipLink(false);
    };

    if (!(await noHScroll(page))) fail("horizontal scroll on load");

    const hasNaming = (await page.locator("#naming-history").count()) > 0;
    if (hasNaming !== variant.bridge) fail(`naming history ${hasNaming ? "present" : "missing"}`);

    const headerH = await page.evaluate(() => document.querySelector("[data-site-header]").getBoundingClientRect().height);
    if (vp.landscape && headerH > vp.height * 0.2) fail(`header is ${headerH}px of ${vp.height}px`);

    if (shots) {
      await shot("#announcement", "hero");
      if (hasNaming) await shot("#naming-history", "naming-history");
      await shot("#benchmarks", "benchmarks");
    }

    // Console: ER 6 after 4 presses, then 12 presses in total.
    const add = page.locator("[data-add-er]");
    await add.scrollIntoViewIfNeeded();
    for (let i = 0; i < 4; i++) await add.click();
    const after4 = await page.locator("[data-readout]").textContent();
    if (!after4.includes("ER: 6") || !after4.includes("VERSION: SUPERERERERERER ")) fail(`after 4 presses: ${after4}`);
    if (shots) {
      await page.waitForTimeout(300);
      await skipLink(true);
      await page.locator("#console").screenshot({ path: join(OUT, `console-4-${tag}.png`) });
      await skipLink(false);
    }
    for (let i = 4; i < 12; i++) await add.click();
    if (!(await noHScroll(page))) fail("horizontal scroll after 12 x + ER");
    const readout = await page.locator("[data-readout]").textContent();
    if (!readout.includes("SUP(ER)×14") || !readout.includes("ER: 14")) fail(`readout after 12: ${readout}`);
    const lines = await page.locator("[data-terminal] .term-line").count();
    if (lines > 60) fail(`terminal keeps ${lines} lines`);

    // Renaming office: COFFEE, then UPGRADE AGAIN x 12.
    // The office module loads lazily as its section approaches the viewport.
    await page.locator("#renaming-office").scrollIntoViewIfNeeded();
    await page.locator("[data-office-form]:not([hidden])").waitFor();
    const input = page.locator("[data-office-input]");
    await input.fill("coffee");
    await page.keyboard.press("Enter");
    await page.locator("[data-office-preview]:not([hidden])").waitFor();
    const alt = await page.locator("[data-office-preview]").getAttribute("alt");
    if (alt !== "Renaming notice: COFFEE shall be known as COFFEEER.") fail(`card alt: ${alt}`);
    if (shots) await shot("#renaming-office", "renaming-office");
    const upgrade = page.locator("[data-office-upgrade]");
    for (let i = 0; i < 12; i++) {
      const before = await page.locator("[data-office-preview]").getAttribute("src");
      await upgrade.click();
      await page.waitForFunction(
        (prev) => document.querySelector("[data-office-preview]").getAttribute("src") !== prev,
        before,
      );
    }
    const label = (await upgrade.textContent()).trim();
    if (label !== "CONTAINER EXCEEDED" || !(await upgrade.isDisabled())) fail(`upgrade button ends as "${label}"`);
    if (!(await noHScroll(page))) fail("horizontal scroll after 12 x UPGRADE AGAIN");

    if (shots) await shot("#model-card", "model-card");

    // Header: capped extra ERs at the bottom, tab title follows.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    const cap = vp.width < 400 ? 3 : 6;
    const glyphs = await page.locator("[data-er-overload] path").count();
    if (glyphs !== cap * 2) fail(`header shows ${glyphs / 2} extra ERs, expected ${cap}`);
    const expectedTitle = versionName(2 + cap) + " — Super wasn't enough.";
    const title = await page.title();
    if (title !== expectedTitle) fail(`title "${title}", expected "${expectedTitle}"`);

    // Header ERs never cover the BUY button.
    const buy = await page.locator(".header-nav > :first-child").boundingBox();
    const glyphBoxes = await page.$$eval("[data-er-overload] path", (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    if (glyphBoxes.some((g) => rectsOverlap(g, buy))) fail("header ERs overlap the BUY button");
    if (!(await noHScroll(page))) fail("horizontal scroll at page bottom");

    // Scrolling back up removes them again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const glyphsTop = await page.locator("[data-er-overload] path").count();
    if (glyphsTop !== 0) fail(`header keeps ${glyphsTop / 2} extra ERs at the top`);

    for (const p of problems) fail(p);
    await page.close();
    console.log(`${failures.some((f) => f.startsWith(`[${id}]`)) ? "FAIL" : "ok  "} ${vp.width}x${vp.height}`);
  }
  server.close();
}

await browser.close();
rmSync(tmp, { recursive: true, force: true });

if (failures.length) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log(`\ncheck-layout: ${VARIANTS.length} variants x ${VIEWPORTS.length} viewports passed. Screenshots in qa-output/.`);
