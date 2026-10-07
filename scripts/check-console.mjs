// Console QA (run `npm run build` first):
// - The terminal's height is identical empty, after 10 presses and after
//   RESET, at 375px (iPhone 13, touch) and at 1440px.
// - After press 2 the terminal fully shows both "scientists warned us not to
//   add another ER." and "we added two.".
// - Scrolling over the console scrolls the page: touch swipes on the terminal
//   (empty and after 6 presses) and on the stage, and the mouse wheel over
//   the terminal and stage on desktop.
import { devices } from "playwright";
import { launchChromium } from "./browser.mjs";
import { startServer } from "./serve.mjs";

const server = await startServer();
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
const failures = [];

const SETUPS = [
  { name: "375 iPhone 13 (touch)", options: { ...devices["iPhone 13"], hasTouch: true }, touch: true },
  { name: "1440 desktop", options: { viewport: { width: 1440, height: 900 } }, touch: false },
];

for (const setup of SETUPS) {
  const context = await browser.newContext(setup.options);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const fail = (msg) => failures.push(`[${setup.name}] ${msg}`);
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && fail(`console ${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => fail(`page error: ${e.message}`));
  await page.goto(url, { waitUntil: "networkidle" });
  console.log(`\n${setup.name}`);

  const add = page.locator("[data-add-er]");
  const reset = page.locator("[data-reset]");
  const press = async (n) => {
    for (let i = 0; i < n; i++) await (setup.touch ? add.tap() : add.click());
  };
  const termHeight = () => page.locator("[data-terminal]").evaluate((el) => el.getBoundingClientRect().height);

  // Fixed size: empty, after 10 presses, after RESET.
  await add.scrollIntoViewIfNeeded();
  const hEmpty = await termHeight();
  await press(10);
  const h10 = await termHeight();
  await reset.click();
  const hReset = await termHeight();
  const same = hEmpty === h10 && h10 === hReset;
  console.log(`${same ? "ok  " : "FAIL"} terminal height empty ${hEmpty} / after 10 presses ${h10} / after RESET ${hReset}`);
  if (!same) fail(`terminal height changed: ${hEmpty} / ${h10} / ${hReset}`);

  // After press 2 both jokes are fully visible (inside the box, not truncated).
  await press(2);
  const visible = await page.locator("[data-terminal]").evaluate((el) => {
    const box = el.getBoundingClientRect();
    const show = (needle) => {
      const line = [...el.querySelectorAll(".term-line")].find((l) => l.textContent === needle);
      if (!line) return "missing";
      const r = line.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) return "outside the terminal";
      if (line.scrollWidth > line.clientWidth) return "truncated";
      return "visible";
    };
    return {
      scientists: show("scientists warned us not to add another ER."),
      two: show("we added two."),
    };
  });
  const bothVisible = visible.scientists === "visible" && visible.two === "visible";
  console.log(`${bothVisible ? "ok  " : "FAIL"} after press 2: "scientists warned…" ${visible.scientists}, "we added two." ${visible.two}`);
  if (!bothVisible) fail(`after press 2: ${JSON.stringify(visible)}`);
  const readout = await page.locator("[data-readout]").textContent();
  if (readout !== "VERSION: SUPERERERER · ER: 4 · INTELLIGENCE: 100") fail(`readout after press 2: ${readout}`);
  await reset.click();

  // Scrolling over the console scrolls the page.
  async function scrollOver(selector, label) {
    const el = page.locator(selector);
    await el.scrollIntoViewIfNeeded();
    await page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      window.scrollBy(0, r.top + Math.min(r.height, 200) / 2 - window.innerHeight / 2);
    }, selector);
    await page.waitForTimeout(150);
    const box = await el.boundingBox();
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(Math.max(box.y, 0) + Math.min(box.height, 200) / 2);
    const before = await page.evaluate(() => window.scrollY);
    if (setup.touch) {
      // Raw touch sequence through Chrome's input pipeline: drag up 300px.
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 15; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 20 }] });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, 300);
    }
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => window.scrollY);
    const how = setup.touch ? "swipe" : "wheel";
    console.log(`${after !== before ? "ok  " : "FAIL"} ${how} on ${label}: window.scrollY ${Math.round(before)} -> ${Math.round(after)}`);
    if (after === before) fail(`${how} on ${label} did not scroll the page`);
  }

  await scrollOver("#model-card .spec", "control: model card");
  await scrollOver("[data-terminal]", "terminal (empty)");
  await scrollOver(".stage", "stage (SUPER)");
  await add.scrollIntoViewIfNeeded();
  await press(6);
  await scrollOver("[data-terminal]", "terminal (after 6 presses)");
  await scrollOver(".stage", "stage (after 6 presses)");

  const styles = await page.evaluate(() => {
    const t = getComputedStyle(document.querySelector("[data-terminal]"));
    const s = getComputedStyle(document.querySelector(".stage"));
    return { terminal: [t.overflowY, t.overscrollBehaviorY, t.touchAction], stage: [s.overflowY, s.overscrollBehaviorY, s.touchAction] };
  });
  console.log(`terminal overflow/overscroll/touch-action: ${styles.terminal.join(" / ")}; stage: ${styles.stage.join(" / ")}`);
  if (styles.terminal.join() !== "hidden,auto,auto") fail(`terminal styles: ${styles.terminal}`);
  if (styles.stage.join() !== "clip,auto,auto") fail(`stage styles: ${styles.stage}`);
  await context.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\ncheck-console: fixed size, scrolling and script visibility all pass.");
