# SUPERER

The launch site for SUPERER ($SUPERER). Super wasn't enough.

Plain HTML, CSS and vanilla ES modules. No framework, no runtime dependencies, no third-party requests.

```
site/             source of the static site (never modified by the build)
dist/             build output (git-ignored)
brand-originals/  untouched brand files (never served)
scripts/          build, build-assets, check-layout, local server
tests/            node:test suites (overload geometry, brand integrity)
```

## Local development

```sh
npm ci
npm run build      # runs the tests, then writes dist/
npx serve dist     # or: npm run serve (sends the same headers as vercel.json, incl. CSP)
```

`npm run build` fails if any test fails.

## Deploying on Vercel

Import the `superer2` repo in Vercel. Framework preset: Other. The settings are read from `vercel.json` (install `npm ci`, build `npm run build`, output `dist`). No environment variables are required.

If `siteUrl` is still a placeholder, the build uses Vercel's `VERCEL_PROJECT_PRODUCTION_URL` for the absolute Open Graph / Twitter image URLs. If neither is available it prints a warning and uses relative paths.

## Launch values

All launch values live in `site/src/config.js`:

| Key | Meaning |
|---|---|
| `contractAddress` | Full contract address. While it is `"REPLACE_ME"` the site shows `NOT YET DEPLOYED`, status `PRE-RELEASE`, and COPY / BUY are disabled. |
| `buyUrl` | Buy link (e.g. pump.fun or a DEX). BUY stays disabled until both this and the contract address are set. |
| `xUrl` | X profile URL. |
| `siteUrl` | Canonical site URL (e.g. `https://superer.example`). Used for canonical, `og:url`, absolute social images and SHARE. |
| `chain` | Shown in the deployment panel. |
| `showLaunchMetaBridge` | `true` shows the `AI → SI → SUPERER` strip above the hero; `false` removes it from the build. |

A value counts as a placeholder if it equals `"REPLACE_ME"` or is empty. URLs must start with `http://` or `https://`; the build rejects anything else.

Edit the file, commit, and push to `main`. Vercel rebuilds automatically.

## Social assets

```sh
npx playwright install chromium   # once, if no Chromium is available
npm run assets                    # regenerates site/assets/social/*.png and favicon.svg
```

Commit the regenerated files. The build adds a content hash to every file in `assets/social/` because `/assets/*` is served with an immutable cache header.

## QA

```sh
npm run build
npm run check      # Playwright layout check at 320–1920px + landscape; screenshots in qa-output/
npm run validate   # html-validate dist/index.html
npm test           # node:test only
```

Playwright is only used by `npm run assets` and `npm run check`. `.npmrc` skips the browser download during `npm ci`, so the Vercel build never fetches a browser. The scripts use Playwright's own Chromium if installed, otherwise the executable in `PLAYWRIGHT_CHROMIUM_PATH`.
