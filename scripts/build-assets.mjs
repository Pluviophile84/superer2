// Renders the social images and PNG favicons in headless Chromium so they use
// the self-hosted fonts and the shared overload function exactly as the site.
// Output: site/assets/social/. Run with `npm run assets`; commit the results.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./browser.mjs";
import { overloadGlyphs, glyphTransform } from "../site/src/overload.js";
import { PATHS, INK, HOT_ER, WHITE, MASTER_LAYOUT, masterTransform } from "../site/src/glyphs.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const site = join(root, "site");
const out = join(site, "assets", "social");
const ORIGIN = "http://assets.local";

const stripMetadata = (s) => s.replace(/<metadata>[\s\S]*?<\/metadata>/, "");
const darkIcon = stripMetadata(readFileSync(join(root, "brand-originals", "SUPERER_icon_dark.svg"), "utf8"));

// favicon.svg is the dark stacked icon with only <metadata> removed.
writeFileSync(join(out, "favicon.svg"), darkIcon);

/** Master wordmark + overload as SVG path markup, in master units. */
function wordmarkMarkup({ superFill, extraERs, showER = true }) {
  const master = MASTER_LAYOUT.filter((g) => showER || !g.er).map(
    (g) => `<path d="${PATHS[g.glyph]}" fill="${g.er ? HOT_ER : superFill}" transform="${masterTransform(g.x)}"/>`,
  );
  const extra = overloadGlyphs(extraERs).map(
    (g) => `<path d="${PATHS[g.glyph]}" fill="${HOT_ER}" transform="${glyphTransform(g)}"/>`,
  );
  return master.concat(extra).join("");
}

const FONTS = `
@font-face { font-family: "IBM Plex Sans"; font-weight: 700; src: url("/assets/fonts/ibm-plex-sans-latin-700-normal.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 400; src: url("/assets/fonts/ibm-plex-mono-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 600; src: url("/assets/fonts/ibm-plex-mono-latin-600-normal.woff2") format("woff2"); }
html, body { margin: 0; padding: 0; overflow: hidden; }
svg { display: block; }
`;

const page = (w, h, bg, body, css = "") => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${FONTS}
body { width: ${w}px; height: ${h}px; background: ${bg}; position: relative; }
${css}
</style></head><body>${body}</body></html>`;

// og.png — paper, master wordmark + 4-ER overload bending off the right edge.
function ogTemplate() {
  const s = 0.66;
  return page(
    1200,
    630,
    WHITE,
    `<svg width="1200" height="630" viewBox="0 0 1200 630"><g transform="translate(40 70) scale(${s})">${wordmarkMarkup({ superFill: INK, extraERs: 4 })}</g></svg>
     <p class="claim">SUPER WASN'T ENOUGH.</p>
     <p class="ticker">$SUPERER</p>
     <p class="meta">RELEASE NOTE · CANONICAL BUILD</p>`,
    `svg { position: absolute; inset: 0; }
     .claim { position: absolute; left: 64px; top: 380px; margin: 0; font: 700 76px/1 "IBM Plex Sans"; letter-spacing: -0.02em; color: ${INK}; }
     .ticker { position: absolute; left: 64px; bottom: 48px; margin: 0; font: 600 24px/1 "IBM Plex Mono"; color: ${INK}; letter-spacing: 0.04em; }
     .meta { position: absolute; right: 64px; bottom: 50px; margin: 0; font: 400 16px/1 "IBM Plex Mono"; color: #6B6B6B; letter-spacing: 0.04em; }
     body::after { content: ""; position: absolute; left: 64px; right: 64px; bottom: 96px; height: 2px; background: ${INK}; }`,
  );
}

// x-banner.png — ink, white SUPER + Hot ER overload sweeping right and down.
// The bottom-left 400 x 200 stays empty for the X avatar.
function bannerTemplate() {
  const s = 0.62;
  return page(
    1500,
    500,
    INK,
    `<svg width="1500" height="500" viewBox="0 0 1500 500"><g transform="translate(70 40) scale(${s})">${wordmarkMarkup({ superFill: WHITE, extraERs: 8 })}</g></svg>`,
    `svg { position: absolute; inset: 0; }`,
  );
}

// Stacked ER icon at any size.
const iconTemplate = (size) =>
  page(size, size, INK, `<img src="/assets/brand/SUPERER_icon_dark.svg" width="${size}" height="${size}" alt="">`, "img { display: block; }");

// Single Hot ER "ER" on ink, for 16/32px favicons where two rows are illegible.
function faviconTemplate(size) {
  // E then R, advanced by the master spacing (871.937 - 740.198) / 0.107021.
  const advance = (871.937 - 740.198) / 0.107021;
  const minX = 169, maxX = advance + 1382, w = maxX - minX, h = 1493;
  const side = w * 1.12;
  const ox = (side - w) / 2 - minX;
  const oy = (side - h) / 2 + h;
  return page(
    size,
    size,
    INK,
    `<svg width="${size}" height="${size}" viewBox="0 0 ${side.toFixed(1)} ${side.toFixed(1)}">
      <g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(1 -1)">
        <path d="${PATHS.E}" fill="${HOT_ER}"/>
        <path d="${PATHS.R}" fill="${HOT_ER}" transform="translate(${advance.toFixed(1)} 0)"/>
      </g></svg>`,
  );
}

const JOBS = [
  ["og.png", 1200, 630, ogTemplate()],
  ["x-banner.png", 1500, 500, bannerTemplate()],
  ["avatar.png", 400, 400, iconTemplate(400)],
  ["token.png", 1000, 1000, iconTemplate(1000)],
  ["apple-touch-icon.png", 180, 180, iconTemplate(180)],
  ["favicon-32.png", 32, 32, faviconTemplate(32)],
  ["favicon-16.png", 16, 16, faviconTemplate(16)],
];

const TYPES = { ".svg": "image/svg+xml", ".woff2": "font/woff2" };

const browser = await launchChromium();
for (const [name, width, height, html] of JOBS) {
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await p.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/template.html") return route.fulfill({ contentType: "text/html", body: html });
    const file = join(site, path);
    if (!file.startsWith(site) || !existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ contentType: TYPES[extname(file)] || "application/octet-stream", body: readFileSync(file) });
  });
  await p.goto(`${ORIGIN}/template.html`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: join(out, name), clip: { x: 0, y: 0, width, height } });
  await p.close();
  console.log(`assets: ${name} (${width}x${height})`);
}
await browser.close();
