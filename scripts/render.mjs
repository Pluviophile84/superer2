// Build-time HTML fragments driven by site/src/config.js.
// The source site/index.html ships with the placeholder rendering of every
// fragment; scripts/build.mjs swaps in the configured values between the
// <!-- SITE:name --> ... <!-- /SITE:name --> markers in dist/index.html.

import { isPlaceholder } from "../site/src/config.js";

export { isPlaceholder };

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isHttpUrl = (s) => /^https?:\/\/[^\s"'<>]+$/i.test(String(s).trim());

export function validateConfig(SITE) {
  const errors = [];
  for (const key of ["buyUrl", "xUrl", "siteUrl"]) {
    if (!isPlaceholder(SITE[key]) && !isHttpUrl(SITE[key])) {
      errors.push(`SITE.${key} must be an http(s) URL or "REPLACE_ME" (got ${JSON.stringify(SITE[key])})`);
    }
  }
  if (!isPlaceholder(SITE.contractAddress) && !/^[A-Za-z0-9]{16,128}$/.test(String(SITE.contractAddress).trim())) {
    errors.push(`SITE.contractAddress must be alphanumeric (got ${JSON.stringify(SITE.contractAddress)})`);
  }
  if (isPlaceholder(SITE.chain)) errors.push("SITE.chain must be set");
  return errors;
}

export const shortCa = (ca) => (ca.length > 12 ? `${ca.slice(0, 4)}…${ca.slice(-4)}` : ca);

export function caFragment(SITE) {
  if (isPlaceholder(SITE.contractAddress)) {
    return '<span class="ca ca--placeholder">NOT YET DEPLOYED</span><button type="button" class="btn btn--sm" data-copy-ca disabled>COPY</button>';
  }
  const ca = escapeHtml(String(SITE.contractAddress).trim());
  return `<code class="ca"><span class="ca-full">${ca}</span><span class="ca-short" aria-hidden="true">${escapeHtml(shortCa(String(SITE.contractAddress).trim()))}</span></code><button type="button" class="btn btn--sm" data-copy-ca>COPY</button>`;
}

export const statusFragment = (SITE) =>
  isPlaceholder(SITE.contractAddress) ? "PRE-RELEASE" : "LIVE";

const buyLive = (SITE) => !isPlaceholder(SITE.contractAddress) && !isPlaceholder(SITE.buyUrl);

function linkOrDisabled(live, url, label, cls) {
  if (live) {
    return `<a class="${cls}" href="${escapeHtml(String(url).trim())}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }
  return `<button type="button" class="${cls}" disabled>${label}</button>`;
}

export const buyFragment = (SITE, label, cls) => linkOrDisabled(buyLive(SITE), SITE.buyUrl, label, cls);
export const xFragment = (SITE, label, cls) => linkOrDisabled(!isPlaceholder(SITE.xUrl), SITE.xUrl, label, cls);

export function resolveBaseUrl(SITE, env = process.env) {
  if (!isPlaceholder(SITE.siteUrl)) return String(SITE.siteUrl).trim().replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel && vercel.trim()) return `https://${vercel.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return null;
}

export function metaFragment(base, ogImagePath) {
  const img = base ? `${base}/${ogImagePath.replace(/^\.\//, "")}` : ogImagePath;
  const lines = [];
  if (base) {
    lines.push(`<link rel="canonical" href="${escapeHtml(base)}/">`);
    lines.push(`<meta property="og:url" content="${escapeHtml(base)}/">`);
  }
  lines.push(
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="SUPERER">',
    '<meta property="og:title" content="SUPERER — Super wasn\'t enough.">',
    '<meta property="og:description" content="SUPER wasn\'t enough. ADD ER.">',
    `<meta property="og:image" content="${escapeHtml(img)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="SUPERER wordmark. SUPER WASN\'T ENOUGH.">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="SUPERER — Super wasn\'t enough.">',
    '<meta name="twitter:description" content="SUPER wasn\'t enough. ADD ER.">',
    `<meta name="twitter:image" content="${escapeHtml(img)}">`,
  );
  return "\n" + lines.join("\n") + "\n";
}

/** Every marker fragment for a config. Keys match <!-- SITE:key --> markers. */
export function fragments(SITE, { base = null, ogImage = "./assets/social/og.png" } = {}) {
  return {
    meta: metaFragment(base, ogImage),
    "ca-hero": caFragment(SITE),
    "ca-footer": caFragment(SITE),
    chain: escapeHtml(String(SITE.chain).trim()),
    status: statusFragment(SITE),
    "buy-header": buyFragment(SITE, "BUY", "btn btn--primary btn--header"),
    "x-header": xFragment(SITE, "X", "btn btn--secondary btn--header btn--square"),
    "buy-hero": buyFragment(SITE, "BUY $SUPERER", "btn btn--primary btn--lg"),
    "x-hero": xFragment(SITE, "FOLLOW ON X", "btn btn--secondary btn--lg"),
    "buy-footer": buyFragment(SITE, "BUY $SUPERER", "btn btn--primary"),
    "x-footer": xFragment(SITE, "X", "btn btn--secondary btn--square"),
  };
}

const MARKER = /<!-- SITE:([a-z-]+) -->([\s\S]*?)<!-- \/SITE:\1 -->/g;

/** Replace marker contents; drops the bridge block entirely when disabled. */
export function applyFragments(html, SITE, opts) {
  const frags = fragments(SITE, opts);
  let out = html.replace(MARKER, (whole, name, inner) => {
    if (name === "bridge") return SITE.showLaunchMetaBridge ? whole : "";
    if (!(name in frags)) throw new Error(`Unknown SITE marker: ${name}`);
    return `<!-- SITE:${name} -->${frags[name]}<!-- /SITE:${name} -->`;
  });
  return out;
}

export function markerNames(html) {
  return [...html.matchAll(MARKER)].map((m) => m[1]);
}
