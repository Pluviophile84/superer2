// Launch Chromium for build-assets / check-layout. Uses Playwright's own
// browser if installed (`npx playwright install chromium`), otherwise the
// executable named by PLAYWRIGHT_CHROMIUM_PATH.
import { chromium } from "playwright";
import { existsSync } from "node:fs";

export async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (err) {
    const fallback = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
    if (existsSync(fallback)) return chromium.launch({ executablePath: fallback });
    throw new Error(
      "No Chromium found. Run `npx playwright install chromium` or set PLAYWRIGHT_CHROMIUM_PATH.\n" + err.message,
    );
  }
}
