// Touch-scroll QA: on an emulated iPhone 13, a vertical swipe that starts on
// the console terminal (empty, and after 6 presses) or on the wordmark stage
// must scroll the page. Run `npm run build` first.
import { devices } from "playwright";
import { launchChromium } from "./browser.mjs";
import { startServer } from "./serve.mjs";

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
const context = await browser.newContext({ ...devices["iPhone 13"], hasTouch: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const failures = [];
const problems = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && problems.push(`console ${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));

await page.goto(url, { waitUntil: "networkidle" });

/** Real compositor touch-scroll gesture (finger moves up => page scrolls down). */
async function swipeOn(selector, label) {
  const el = page.locator(selector);
  await el.scrollIntoViewIfNeeded();
  // Put the element mid-screen so the swipe has room in both directions.
  await page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    window.scrollBy(0, r.top + Math.min(r.height, 200) / 2 - window.innerHeight / 2);
  }, selector);
  await page.waitForTimeout(150);
  const box = await el.boundingBox();
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(Math.max(box.y, 0) + Math.min(box.height, 200) / 2);
  const before = await page.evaluate(() => window.scrollY);
  // Raw touch sequence through Chrome's input pipeline: finger down, drag
  // up 300px in steps, lift. Non-cancelable moves let the compositor scroll.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 15; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 20 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.scrollY);
  const moved = Math.round(after - before);
  console.log(`${moved !== 0 ? "ok  " : "FAIL"} swipe on ${label}: window.scrollY ${Math.round(before)} -> ${Math.round(after)}`);
  if (moved === 0) failures.push(`swipe on ${label} did not scroll the page`);
}

// Control: plain content must scroll, or the harness itself is broken.
await swipeOn("#model-card .spec", "control: model card");
await swipeOn("[data-terminal]", "terminal (empty)");
await swipeOn(".stage", "stage (SUPER)");
const add = page.locator("[data-add-er]");
await add.scrollIntoViewIfNeeded();
for (let i = 0; i < 6; i++) await add.tap();
await swipeOn("[data-terminal]", "terminal (after 6 presses)");
await swipeOn(".stage", "stage (after 6 presses)");

const layout = await page.evaluate(() => {
  const t = document.querySelector("[data-terminal]");
  const cs = getComputedStyle(t);
  return { overflowY: cs.overflowY, overscroll: cs.overscrollBehaviorY, touchAction: cs.touchAction, lines: t.querySelectorAll(".term-line:not(.term-gap)").length, scrollable: t.scrollHeight > t.clientHeight };
});
console.log("terminal on touch:", JSON.stringify(layout));
if (layout.overflowY !== "visible") failures.push(`terminal is a scroll container on touch (overflow-y: ${layout.overflowY})`);
if (layout.overscroll !== "auto") failures.push(`terminal overscroll-behavior is ${layout.overscroll}`);
if (layout.touchAction === "none") failures.push("terminal has touch-action: none");
if (layout.lines > 8) failures.push(`terminal keeps ${layout.lines} output lines on touch (max 8)`);
const stage = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector(".stage"));
  return { overflowX: cs.overflowX, overflowY: cs.overflowY, touchAction: cs.touchAction };
});
console.log("stage on touch:", JSON.stringify(stage));
if (stage.overflowY !== "clip" || stage.touchAction === "none") failures.push(`stage could capture gestures: ${JSON.stringify(stage)}`);

failures.push(...problems);
await browser.close();
server.close();
if (failures.length) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\ncheck-touch: all swipes scrolled the page.");
