// Renaming Office flicker QA. Files COFFEE, then clicks UPGRADE AGAIN 10
// times rapidly while recording every composited frame (CDP screencast), and
// asserts no frame shows a blank or partial card in the preview.
// Run `npm run build` first.
import { launchChromium } from "./browser.mjs";
import { startServer } from "./serve.mjs";

const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
  { name: "mobile", viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
];

// Optional: --dir <path> to check another build (used to bisect the cause).
const dirArg = process.argv.indexOf("--dir");
const server = await startServer(dirArg > 0 ? { dir: process.argv[dirArg + 1] } : {});
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchChromium();
// Frames are decoded and measured on a blank analysis page (no site CSP).
const analyzer = await browser.newPage();
const failures = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext(vp);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("#renaming-office").scrollIntoViewIfNeeded();
  await page.locator("[data-office-form]:not([hidden])").waitFor();
  await page.fill("[data-office-input]", "coffee");
  await page.keyboard.press("Enter");
  await page.locator("[data-office-preview]:not([hidden])").waitFor();
  await page.locator("[data-office-preview]").evaluate((img) => img.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(400);
  const rect = await page.locator("[data-office-preview]").evaluate((img) => {
    const r = img.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: Math.min(r.height, window.innerHeight - r.y) };
  });

  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    frames.push(f.data);
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", everyNthFrame: 1 });
  await page.waitForTimeout(300);
  for (let i = 0; i < 10; i++) await page.locator("[data-office-upgrade]").click({ delay: 0, noWaitAfter: true });
  await page.waitForTimeout(1500);
  await cdp.send("Page.stopScreencast");

  // Ink coverage of the preview area (inset 2px to skip its border) per frame.
  const coverage = await analyzer.evaluate(
    async ({ frames, rect }) => {
      const out = [];
      for (const b64 of frames) {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        const scale = bmp.width / Math.round(rect.vw);
        const x = Math.round((rect.x + 2) * scale), y = Math.round((rect.y + 2) * scale);
        const w = Math.round((rect.w - 4) * scale), h = Math.round((rect.h - 4) * scale);
        const d = ctx.getImageData(x, y, w, h).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 384) ink++;
        out.push(ink / (w * h));
      }
      return out;
    },
    { frames, rect: { ...rect, vw: vp.viewport.width } },
  );
  const baseline = coverage[0];
  const bad = coverage.map((c, i) => [i, c]).filter(([, c]) => c < baseline * 0.6);
  console.log(
    `${bad.length ? "FAIL" : "ok  "} ${vp.name}: ${frames.length} frames, ink ${(Math.min(...coverage) * 100).toFixed(2)}–${(Math.max(...coverage) * 100).toFixed(2)}% (baseline ${(baseline * 100).toFixed(2)}%)` +
      (bad.length ? `, ${bad.length} blank/partial frame(s): ${bad.map(([i, c]) => `#${i}=${(c * 100).toFixed(2)}%`).join(" ")}` : ""),
  );
  if (bad.length) failures.push(`${vp.name}: ${bad.length} blank/partial preview frame(s)`);
  // The screencast only emits a frame when the screen changes, so a blank
  // preview frame, being a change, is always captured; just make sure the
  // recording worked at all.
  if (frames.length < 2) failures.push(`${vp.name}: only ${frames.length} frames captured`);
  const label = (await page.locator("[data-office-upgrade]").textContent()).trim();
  if (label !== "UPGRADE AGAIN") failures.push(`${vp.name}: button reads "${label}" after 10 upgrades`);
  const alt = await page.locator("[data-office-preview]").getAttribute("alt");
  if (!alt.endsWith("COFFEE" + "ER".repeat(11) + ".")) failures.push(`${vp.name}: final card is "${alt}"`);
  for (const e of errors) failures.push(`${vp.name}: ${e}`);
  await context.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error("\n" + failures.join("\n"));
  process.exit(1);
}
console.log("\ncheck-flicker: no blank or partial preview frames.");
