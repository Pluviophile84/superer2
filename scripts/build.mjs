// Copies /site to /dist and injects config values into dist/index.html.
// /site is never modified.
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyFragments, markerNames, resolveBaseUrl, validateConfig } from "./render.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const EXPECTED_MARKERS = [
  "meta", "ca-hero", "ca-footer", "chain", "status",
  "buy-header", "x-header", "buy-hero", "x-hero", "buy-footer", "x-footer",
  "bridge", "nobridge",
];

/**
 * Build `siteDir` into `distDir` using the config in `siteDir/src/config.js`.
 * scripts/check-layout.mjs also uses this to build a bridge-off variant.
 */
export async function buildSite({ siteDir = join(root, "site"), distDir = join(root, "dist"), quiet = false } = {}) {
  const { SITE } = await import(pathToFileURL(join(siteDir, "src", "config.js")).href);

  const errors = validateConfig(SITE);
  if (errors.length) throw new Error(errors.map((e) => `build: ${e}`).join("\n"));

  rmSync(distDir, { recursive: true, force: true });
  cpSync(siteDir, distDir, { recursive: true });

  let html = readFileSync(join(distDir, "index.html"), "utf8");

  // Social assets are served from /assets/* with an immutable cache header,
  // so give each one a content hash and rewrite its references.
  const socialDir = join(distDir, "assets", "social");
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
  if (!base && !quiet) {
    console.warn(
      "build: WARNING SITE.siteUrl is a placeholder and VERCEL_PROJECT_PRODUCTION_URL is not set; " +
        "omitting og:url and canonical, using relative social image paths.",
    );
  }

  const found = markerNames(html);
  for (const name of EXPECTED_MARKERS) {
    if (!found.includes(name)) throw new Error(`build: marker SITE:${name} missing from index.html`);
  }

  html = applyFragments(html, SITE, { base, ogImage });
  for (const [from, to] of Object.entries(renamed)) html = html.replaceAll(from, to);

  writeFileSync(join(distDir, "index.html"), html);
  if (!quiet) {
    console.log(
      `build: ${distDir} written (CA ${SITE.contractAddress === "REPLACE_ME" ? "placeholder" : "set"}, ` +
        `base URL ${base || "none"}, bridge ${SITE.showLaunchMetaBridge ? "on" : "off"}).`,
    );
  }
  return { SITE, distDir };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildSite().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
