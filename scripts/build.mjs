// Copies /site to /dist and injects config values into dist/index.html.
// /site is never modified.
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../site/src/config.js";
import { applyFragments, markerNames, resolveBaseUrl, validateConfig } from "./render.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const site = join(root, "site");
const dist = join(root, "dist");

const errors = validateConfig(SITE);
if (errors.length) {
  for (const e of errors) console.error(`build: ${e}`);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
cpSync(site, dist, { recursive: true });

let html = readFileSync(join(dist, "index.html"), "utf8");

// Social assets are served from /assets/* with an immutable cache header,
// so give each one a content hash and rewrite its references.
const socialDir = join(dist, "assets", "social");
const renamed = {};
if (existsSync(socialDir)) {
  for (const file of readdirSync(socialDir)) {
    const ext = extname(file);
    const hash = createHash("sha256").update(readFileSync(join(socialDir, file))).digest("hex").slice(0, 10);
    const hashed = `${basename(file, ext)}.${hash}${ext}`;
    renameSync(join(socialDir, file), join(socialDir, hashed));
    renamed[`./assets/social/${file}`] = `./assets/social/${hashed}`;
  }
}

const ogImage = renamed["./assets/social/og.png"] || "./assets/social/og.png";
const base = resolveBaseUrl(SITE);
if (!base) {
  console.warn(
    "build: WARNING SITE.siteUrl is a placeholder and VERCEL_PROJECT_PRODUCTION_URL is not set; " +
      "omitting og:url and canonical, using relative social image paths.",
  );
}

const expected = ["meta", "ca-hero", "ca-footer", "chain", "status", "buy-header", "x-header", "buy-hero", "x-hero", "buy-footer", "x-footer", "bridge"];
const found = markerNames(html);
for (const name of expected) {
  if (!found.includes(name)) throw new Error(`build: marker SITE:${name} missing from index.html`);
}

html = applyFragments(html, SITE, { base, ogImage });
for (const [from, to] of Object.entries(renamed)) html = html.replaceAll(from, to);

writeFileSync(join(dist, "index.html"), html);
console.log(
  `build: dist/ written (CA ${SITE.contractAddress === "REPLACE_ME" ? "placeholder" : "set"}, ` +
    `base URL ${base || "none"}, bridge ${SITE.showLaunchMetaBridge ? "on" : "off"}).`,
);
