---
name: verifier-browser
description: Evidence-capture recipe for verifying the Lumpzammon React app in a real browser (Playwright-in-Docker against the running dev server). Use when verifying UI/gameplay changes end-to-end — local/AI play or two-client online multiplayer.
---

# verifier-browser (Lumpzammon)

Drive the **running** app in a headless browser and capture screenshots + console/page
errors. Full recipe, selectors, and the time-costing gotchas live in **DOCS.md →
Development → "Browser verification (Playwright)"** (the human-readable copy); this
skill is the version `/verify` auto-discovers.

## Quick start

1. Dev server up: `docker compose --profile dev up -d dev` → http://localhost:5173/lumpzammon/
2. Write a driver in a throwaway `.verify/verify.mjs` (`import { chromium } from 'playwright'`).
3. Run it (image tag must match the playwright npm version; `--network host` so Vite's
   allowedHosts accepts `localhost`):

   ```bash
   cd .verify
   docker run --rm --network host -v "$(pwd)":/work -w /work \
     mcr.microsoft.com/playwright:v1.49.0-jammy \
     bash -lc "npm init -y >/dev/null 2>&1 && npm i playwright@1.49.0 --no-save --silent && node verify.mjs"
   ```
4. Read the `*.png` screenshots as evidence. Clean up scratch via Docker (root-owned):
   `docker run --rm -v "$(pwd)":/w -w /w node:20-alpine rm -rf .verify`

## The gotchas (see DOCS.md for the full why/fix)

- `--network host` + `localhost:5173` — Vite blocks other Host headers (e.g. `dev`).
- Movable checkers = glow box-shadow `0px 0px …`, NOT `cursor:pointer` (all checkers are pointer).
- Click checkers by bounding-box coords (they sit at the point edge, not center).
- Move targets: the `[data-point-id]` div's own cursor is `pointer` only when highlighted.
- Online updates round-trip through Firebase (no optimistic local update) — poll ~8s.
- Online two-client: two `browser.newContext()`; Create Match / Join (Join by role);
  cleanup = "Leave Game" (deletes `bg:match:`/`bg:lobby:` from the live DB).
