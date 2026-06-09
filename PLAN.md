# Backgammon Online - Implementation Plan

This document tracks the development roadmap. Each phase is designed to be worked on with Claude Code as a pair-programming session.

---

## Phase 1: Firebase Configuration (online mode) -- DONE

Firebase project `lumpzammon` configured with Realtime Database in test mode.

### What was done

- [x] **Create Firebase project** — `lumpzammon` on Spark (free) plan, Realtime Database in test mode
- [x] **Register web app** — config obtained from Firebase console
- [x] **Environment variables** — config read from `import.meta.env.VITE_FIREBASE_*` (not hardcoded)
  - Local dev: `app/.env` (gitignored)
  - GitHub Pages: injected via repository secrets at build time
  - Template: `app/.env.example` committed for reference
- [x] **Database rules** — open read/write (test mode), must be locked down later (see Phase 5)
- [ ] **Test online mode** — verify two-tab match sync on https://jpep.github.io/lumpzammon/

---

## Phase 2: UI/UX Polish

The board and screens are functional but visually basic. This phase brings them up to quality.

### Tasks

- [x] **Responsive layout** - Board scales down on narrow viewports, status bar is fluid
- [x] **Casino theme** - Old-style casino look: black/white, red buttons, gold accents, centralized in `theme.js`
- [x] **Landing title** - "Lumpzammon!" with exclamation mark on MenuScreen
- [x] **Alternating board direction** - Full 180° board rotation on each new game (top/bottom + left/right swap). In online mode each player sees their home on the bottom half
- [x] **Pip count** - Each player's total pip distance shown next to their name in the status bar
- [x] **Pass overlay** - Prominent centered overlay with player stone when no valid moves, replacing small text message
- [x] **Move hints** - Movable checkers glow gold, destination points highlighted after selection
- [x] **Dice selection** - Click dice to choose play order; first die auto-selected after rolling, remaining die auto-selected after move
- [ ] **Board aesthetics** - Wood textures, shadows, rounded triangles, point numbering
- [x] **Checker animations** - Smooth CSS transitions for moves, bar hits, bearing off
- [ ] **Dice roll animation** - Tumble/spin before revealing values
- [ ] **Sound effects** - Dice roll, checker place, hit, bear off, win
- [x] **Turn indicator** - Player names with stone icons, (you!) tag, action label next to active player
- [ ] **Move history sidebar** - Scrollable log of moves in standard notation
- [ ] **Undo button** - Allow undoing partial moves within a turn (before ending turn)
- [x] **User-based theme customization** - Nickname-driven themes: "jugo" gets sepia, "pepo" gets marine, "simon" gets rainbow with floating stars/flowers (via ThemeContext)
- [ ] **Dark/light theme** - Toggle between wood tones

---

## Phase 3: Game Logic Enhancements

### Tasks

- [x] **Opening roll rule** - Each player rolls one die; higher die wins and plays first using both dice as their opening move. Ties re-roll. No doubles possible on first move.
- [x] **Doubling cube** - Implemented in the devanture skin (offer/accept/decline modals, capped at ❹, refusal = simple win at current cube value). Pending: port back into the React app.
- [x] **Match play** - Session score `(N)` per player accumulates points across games; reset on new match via `[m]` or accepted invite. (Skin only for now.)
- [ ] **Crawford rule** - Disable doubling cube when one player is 1 point from winning
- [x] **Gammon/backgammon detection** - `classifyWin()` in `devanture/adapter.js` returns `simple|gammon|backgammon|resign`, multiplied by `cubeValue` for scoring.
- [ ] **Move validation edge cases** - Audit: must use both dice if possible, must use larger die if only one can be used
- [ ] **Auto-finish** - When a player has all checkers ahead of the opponent, auto bear-off option

---

## Phase 4: AI Improvements

The current AI is a single-step greedy evaluator. It works but is beatable.

### Tasks

- [x] **Smooth AI playback** - AI moves are applied one stone at a time with delays (750ms between moves, 800ms before auto-roll) so each action is visually clear
- [ ] **Difficulty levels** - Easy (random), Medium (current greedy), Hard (deeper eval)
- [ ] **1-ply lookahead** - For hard mode, evaluate opponent's best response before choosing
- [ ] **Opening book** - Hardcode known best opening moves
- [ ] **Positional concepts** - Add priming, anchor, and race-detection heuristics to evaluation
- [ ] **Bearoff database** - Pre-computed optimal bearoff strategy for endgame positions

---

## Phase 5: Online Mode Hardening

### Tasks

- [ ] **Firebase auth** - Anonymous authentication so each session has a UID
- [ ] **Security rules** - Only allow players to write to their own match, prevent spoofing
  ```json
  {
    "rules": {
      "bg:match:$matchId": {
        ".read": true,
        ".write": "auth != null && (data.child('players/1').val() == auth.uid || data.child('players/2').val() == auth.uid)"
      }
    }
  }
  ```
- [ ] **Match timeout/cleanup** - Auto-delete stale matches older than 1 hour
- [x] **Reconnection** - Detect disconnect and allow rejoining an in-progress match (localStorage saves nick + matchId + playerSlot; on load, auto-reconnects to Firebase match if still alive)
- [x] **Local/AI game persistence** - Game state and board direction saved to localStorage on every change; restored on page load if game is still in progress
- [x] **Multi-tab isolation** - Session and game storage scoped by nickname; nick stored in sessionStorage (per-tab) so two tabs with different nicks can test online mode without clashing
- [ ] **Spectator mode** - Read-only view for third-party observers
- [ ] **Chat** - Simple in-game messaging between opponents
- [ ] **Rate limiting** - Prevent spam/abuse of match creation

---

## Phase 6: Deployment & Infrastructure

### Tasks

- [x] **GitHub repo setup** - Initialize git, push to GitHub (`jpep/lumpzammon`)
- [x] **GitHub Pages deploy** - Live at https://jpep.github.io/lumpzammon/
- [x] **Devanture skin on Pages** - Deploy step copies `devanture/` into `app/dist/`; live at https://jpep.github.io/lumpzammon/devanture/
- [ ] **Custom domain** - Optional: configure CNAME for a custom domain
- [ ] **Firebase env separation** - Separate Firebase projects for dev vs prod
- [ ] **CI checks** - Add lint + test steps to the GitHub Actions workflow
- [x] **Build info overlay** - Info icon (bottom-left) shows commit hash, message, author, date
- [ ] **Docker prod optimization** - Minimize image size, add health checks

---

## Phase 7: Extras

### Nice-to-haves (lower priority)

- [ ] **Leaderboard** - Track wins/losses per nickname in Firebase
- [ ] **Replay system** - Save completed games and replay them move-by-move
- [ ] **Tournament bracket** - Multi-player elimination bracket
- [ ] **PWA support** - Offline capability, installable as app
- [ ] **Internationalization** - Multi-language support
- [ ] **Accessibility** - Keyboard navigation, screen reader support, ARIA labels

---

## Bug Fixes

- [x] **Fix duplicated checkers on bar (PR #9)** — Hit checkers appeared twice on the bar because `BarZone` was rendered in both board halves showing all players. Added `player` prop to `BarZone` so each half only shows the relevant player's checkers. Also restored `Board.jsx` to a valid component (PR had accidentally stripped the module wrapper).

---

## Phase 7.5: Devanture Skin — Firebase Wiring (in progress)

Avant l'intégration React de la Phase 8, on branche la skin standalone sur Firebase (projet `gmmn-afd53`, Realtime Database, Europe-west1) afin de remplacer les `PLAYER_PROFILES` mockés par des stats réelles persistées. La skin reste 100% standalone (chargement compat scripts, pas de bundler).

> **⚠️ Superseded by Phase 8 (2026-06-07).** The unification decision is to **consolidate on the `lumpzammon` Firebase project** (modular ESM SDK, env-based config), with the `/players` stats schema re-implemented on top of it (`storage/playerStats.js`) and any real data **migrated off `gmmn-afd53`**. The standalone `gmmn-afd53` wiring below was interim infrastructure for the standalone skin; treat it as throwaway. Anonymous-auth on `gmmn-afd53` will stop being used once `devanture/` is deleted (Phase 8.6).

### Tasks

- [x] **Infrastructure SDK** — chargement Firebase compat (app/auth/database) dans `devanture/index.html`, init dans `devanture/firebase.js`, config publique commitée dans `devanture/firebase-config.js` (template `firebase-config.example.js`).
- [x] **Auth anonyme** — `signInAnonymously()` au boot, UID stable persisté par le SDK. Migration vers email/password à la Phase 8 quand le sign-in UI sera remplacé par `MenuScreen`.
- [ ] **Stats writes** — brancher `recordGameToProfile()` (`devanture/adapter.js`) sur `Devanture.firebase.appendGame(nick, gameResult)` à chaque fin de partie (tous types : normale, resign, forfait timer, quit-to-room).
- [ ] **Profile reads** — au démarrage, charger `PLAYER_PROFILES[white]` depuis Firebase (`ensurePlayer(nick)`). Adversaire AI reste mock. Adversaire humain (online mode futur) lu pareil.
- [x] **Authorized domains** — `jpep.github.io` est déjà présent dans Firebase Auth → Settings → Authorized domains (vérifié le 2026-06-07 via l'API publique + auth anonyme live en prod). N.B. : la liste Authorized domains ne concerne que les flux OAuth redirect/popup et email-link, **pas** l'auth anonyme ni email/password (qui passent par l'API REST Identity Toolkit sans contrôle d'origine). À revisiter uniquement si la Phase 8 introduit un provider OAuth ou un sign-in par lien email.
- [ ] **Database Rules** — durcir les règles après stabilisation du schéma `/players/<nick>/*` (passer du test-mode ouvert à `auth != null` minimum).

---

## Phase 8: Game Unification — one codebase (`feat/unify-game`)

**Goal:** abolish the `/lumpzammon/` ("original") vs `/lumpzammon/devanture/` ("devanture") split and ship **one** game. Adopt **devanture's look-and-feel**, keep **original's core mechanics + online/storage**, fold in **devanture's intentional functional contributions**, with **zero code duplication**. The standalone `/devanture/` path is removed at the end.

This section is the architectural execution plan derived from a multi-agent analysis of both codebases (2026-06-07). The detailed skin features live in the **Feature inventory** subsection further down; the phases below are how they land.

### Decisions taken (2026-06-07)

1. **Rendering paradigm — embed the p5 canvas in React.** Wrap devanture's `sketch.js`/`dice.js` (the ~6000 lines that produce the GMMN look — `destination-out` knockout logo/frame, `'lighter'`+gradient glow sweep, per-pixel dominant-hue palette, ball-physics dice) in a single React `<BoardCanvas>` running p5 in **instance mode**. React owns app shell, routing, game + online state; it pushes an immutable `GameState` snapshot into the canvas each change, the canvas emits intents (click/drag/roll/cube/resign) back via callbacks. These effects have **no faithful CSS/SVG equivalent** (the logo uses a custom OTF PUA glyph at U+F8FF reachable only via p5 `loadFont`), so we reuse the proven visual code rather than reimplement it. End-state target: hybrid (canvas board + DOM HUD/screens), migrated incrementally — *not* up front.
2. **Single engine — adopt devanture's engine as canonical ES modules.** `logic_standalone.js`/`ai_standalone.js` are the original's code (verified identical bodies) **plus** real upgrades; re-home them into `app/src/game/` as the single source, re-adding the original-only `getBoardIndices`/`TOP_IDX`/`BOT_IDX`/`FLIP` exports that the standalone dropped. Keep cube/timers/stats **out** of the engine (React state); only pure rules live in `logic.js`/`rules.js`.
3. **Firebase — consolidate on the `lumpzammon` project.** One project, one modular-ESM SDK, env-based config (no committed keys), the existing real-time subscribe + range-list. Re-implement devanture's `/players/<nick>` stats API on top of it (`storage/playerStats.js`) and **migrate stats off `gmmn-afd53`** (this supersedes the interim Phase 7.5 location — see note there). Switch `appendGame` to a transaction; unify the two nick sanitizers into one.
4. **Sign-in — reuse the React `MenuScreen`, restyled to the GMMN look.** Drop the skin's `drawSignin`; keep the same `bg:nick` key and add Firebase nickname-uniqueness (per the existing Phase 8 sign-in task). Do **not** adopt devanture's 4-sub-mode sign-in shell.

### Architecture (supporting decisions)

- **Online ↔ canvas:** React stays authoritative — Firebase `matchData.state` is the single source of truth, `updateState`/`onUpdateMatch` the only write path; the canvas is a pure renderer + input surface. P2 perspective via the `direction` flag + `getBoardIndices`. Devanture's `setTimeout`-driven turn/opening/AI choreography is re-homed into React effects.
- **State shape:** extend the original's hooks/Context as the single owner; eliminate devanture's ~20 module-globals. Adopt a lightweight store (Zustand) **only** if profiling shows snapshot churn into the canvas is a problem.
- **Assets:** bring fonts/backgrounds into the Vite asset graph (hashed, cache-busted). CSS `@font-face` for fallback **and** p5 `loadFont` for the PUA glyph must point at the same bundled file; preload via `document.fonts.load`; compress the 1.6 MB `fond1.jpg` preserving mid-luma (the translucent palette depends on it).
- **Routing:** collapse to one React entry; fold devanture's screens into `App.jsx`'s state machine; delete the `/devanture/` path, the `deploy.yml` `cp -r devanture …` step, the `vite.config.js` devanture-index middleware, and the docker bind-mount. Optionally keep a dev-only canvas preview route.

### Devanture logic contributions to fold back (engine-level, pure)

| Contribution | Lands in | Rec |
|---|---|---|
| **Mandatory-move rule** (use max dice; force larger die) — fixes a documented rules gap | `logic.js`: `getValidMovesRaw` (= current `getValidMoves`) + new filtering `getValidMoves` + `maxDiceSequence` | adopt |
| **1-ply expectiminimax AI** (blot-aware; ~1000× more sims) | `ai.js`: new `aiPlay`; export `greedyPlay` + `evaluate`; **gate behind a difficulty toggle** | adopt |
| **Gammon/backgammon classification + scoring** (`classifyWin`/`winPoints`) | new `app/src/game/rules.js` (pure) | merge |
| **Resign with multiplier** (+ `isInitialPosition` guard) | `rules.js` helpers + React resign action | merge |
| **Bar-fully-blocked auto-pass** (`isBarThrowImpossible`) | `logic.js` pure helper, called from the React turn handler | adopt |
| **Doubling cube** (non-standard once-per-player cap-4 variant — *confirm ruleset; see Crawford TODO*) | new `app/src/game/cube.js` reducer + React state | merge |
| **Timers + forfeit** (wall-clock, throttle-immune) | `app/src/hooks/useGameTimers.js` | merge |
| **Combined multi-die / multi-pickup moves** | `app/src/game/moveResolution.js` (note: existing Phase 8 task says `logic.js` — reconcile) | merge |
| **Intermediate-hit detection for combined AI moves** | animation layer (renderer), not `logic.js` | merge |

⚠️ **`getValidMoves` changes semantics** (raw → rules-filtered) under the same name — every caller (`GameScreen` highlight, `ai.js`) must consume the filtered list, and `getValidMovesRaw` must be exported for genuinely-raw use. Avoid copying the dead `wV` branch at `adapter.js:865-873`.

### Migration phases (incremental, app stays shippable each phase)

- [x] **Phase 8.0 — Baseline & constants (no behaviour change).** ✅ vitest added (Docker, standalone `vitest.config.js`); `logic.test.js` pins the *original* raw move semantics; storage key-prefixes (`bg:match:`/`bg:lobby:`/`bg:session:`/`bg:localGame:`/`bg:nick`) extracted into `app/src/game/constants.js` and imported in `useOnlineMatch`/`useKickDetection`/`LobbyScreen`/`AdminPanel`/`storage/local.js`. (commit `ab6a05d`)
- [x] **Phase 8.1 — Unify the engine.** ✅ `logic.js`: `getValidMovesRaw` (original body) + `maxDiceSequence` + rules-filtering `getValidMoves` (must-use-max-dice + larger-die), flip exports kept. `ai.js`: 1-ply lookahead `aiPlay` (default; `difficulty:'easy'` = greedy), `greedyPlay`/`evaluate` exported. Pure `rules.js` (`classifyWin`/`winPoints`/`isInitialPosition`/`resignOutcome`), `cube.js`, `moveResolution.js` extracted from `adapter.js` — fully unit-tested, **not yet wired to UI** (tree-shaken from the build until 8.5). 60 tests green; build clean. Adversarial review (7 agents) verdict *faithful* — logic cross-checked 180k× + fuzzed against the standalone, 0 mismatches. **Fixed** a transitional UX regression: `getValidMoves` filtering could leave a pre-selected smaller die unplayable → board looked frozen; `GameScreen` now pre-selects a playable die (`firstPlayableDie`) with a render-level fallback. **Note:** AI strength/feel changed (1-ply default) — surface the difficulty toggle in the UI at 8.5; per-render `getValidMoves` calls `maxDiceSequence` (memoize if highlight lag appears on doubles).
- [x] **Phase 8.2 — Unify Firebase + stats on `lumpzammon`.** ✅ `app/src/storage/playerStats.js` re-homes the `/players/<nick>` API from `devanture/firebase.js`+`adapter.js` onto the single modular Firebase app: `getPlayer`/`ensurePlayer`/`appendGame` + pure helpers `getMultiplayerScore`/`rankFromGames`, one canonical `sanitizeNick`, schema unchanged. `appendGame` is **transactional** (`runTransaction` over a pure `applyGameToProfile` reducer) — fixes the racy read-modify-write. `firebaseAdapter.js` now exports `getDb()` so stats reuse the one app and use real nested `/players` paths (the facade flattens `/`→`_`). 16 unit tests added (76 total green); build clean; **not wired to any screen until 8.5** (tree-shaken). `database.rules.json` added at repo root as the rules source of truth (not auto-deployed; apply via console/`firebase deploy --only database`). **Auth model = NONE for now** (the client doesn't authenticate; requiring `auth != null` would break the live app → deferred to Phase 5); rules keep read/write open (root `.read` must stay `true` for the range-list query) + validate the `/players` shape. **Migration off `gmmn-afd53` = no-op**: `lumpzammon` `/players` is empty and the skin never wrote stats (`recordGameToProfile` only touched the in-memory mock; Phase 7.5 "Stats writes" was never wired) — export/import recipe documented in DOCS just in case.
- [x] **Phase 8.3 — Canvas spike (de-risk early).** ✅ `p5@^1.11.13` added (npm/Docker; CDN was 1.9.4, API-compatible). Devanture's renderer ported to pure ES modules under `app/src/canvas/` in **instance mode** with every module-global parameterized (geom object `{a,r,bx,by,diceOnSide}`, `buildPalette(p,hue)→C`, snapshot/font/image as closure locals): `geometry.js`, `palette.js`, `drawBoard.js`, `drawCheckers.js`, `drawFrame.js`, `snapshot.js`, `sketch.js` (`makeSketch` factory, `noLoop()` one-shot). `components/CanvasGame.jsx` mounts it with **StrictMode-safe teardown** (`inst.remove()` + `cancelled` guard → exactly one `<canvas>`), a `ResizeObserver`-driven `p.resize`, and the `nortechico` `@font-face` registered (FontFace API) so the Canvas-2D GMMN letters resolve before the one-shot draw. Assets (`nortechico-100.otf`, `fond2.jpg`) bundled via Vite `?url` (no 404); fond drawn **cover-fit into the canvas** (not `document.body`) so `destination-out` reveals it; retina backing store kept (verified 2×). **Verified in-browser (Playwright):** hue palette (monochrome, not the red fallback), 24 staircase triangles, ivory contour, opening-position checkers, the hollow frame + GMMN logo, resize (geometry recomputed), StrictMode (1 canvas), **zero console errors/warnings, no asset 404s**. **Findings:** (a) the frame/logo is a *pre-game overlay* readable only over the 86% veil — `showFrame` flag toggles the dimmed-frame composite vs the bright board; (b) the logo's catana slots are **empty** in the current `sketch.js` (`wK=0`) — the U+F8FF glyph lives in the checker `drawNortechicoMark` (`?canvas&mark` confirms the `loadFont` PUA path, no tofu). **Dev-only flag** (`?canvas` / `?canvas=board` / `&mark` / `&snap=stack`) with the `lazy()` import gated behind `import.meta.env.DEV`, so p5 + the fond/font assets are dropped from the production build — prod `dist` byte-identical to pre-spike (412.23 kB). Portrait-only (landscape title rotation deferred). 76 tests still green.
- [x] **Phase 8.4 — Drive the canvas from the live engine.** ✅ The canvas renders the live engine `GameState` and is **playable by drag-to-move** for a local game, behind `?canvas=live` (dev-only), React-authoritative. New modules: `canvas/adapter.js` (`toSnapshot` = verbatim `syncMockState`; all engine↔render↔pixel coord conversion centralized), `canvas/dice.js` (static two-die render + used-die 50% fade from `gs.dice`/`gs.moves`), `canvas/interaction.js` (inverse-geometry `hitTestPickup` bar-first + `resolveSnap` board/off + eased dragged ghost), `canvas/highlights.js` (source halos + target rings from `getValidMoves`/`collectTargets`). `geometry.js` +`cssH`/`ptNextY`/`ptTopY`. `sketch.js` is live-capable (mutable `view` via `inst.update()`, p5 mouse handlers → `onPickup`/`onMove`, redraw-on-change + `loop()` only while dragging; instance never recreated on state change). `CanvasGame.jsx` hosts a self-contained **local harness** (`freshLocalGame`/`rollFor`/`advance` over `logic.js`+`moveResolution.js`, off the production GameScreen/online/AI paths) + a DEV `window.__cg` hook. **Verified (Playwright):** a legal drag commits via `applyCombinedMove` (source/dest counts + `moves` update), drop-on-nothing is a no-op, dice + halos render (used die fades), 1 `<canvas>` (StrictMode), **0 console errors**. Build clean; prod `dist` still 412.23 kB (canvas dev-only). **Deferred to 8.5:** roll/flying-checker/board-fill animations, **online P2 perspective** (`getBoardIndices(dir=1)` mirror — 8.4 is single-orientation local), AI choreography, opening-roll UI, doubles multi-pickup drag, bear-off **tray rendering** (the off *drop* already commits), cube/timers, and embedding the canvas in `GameScreen` as the default board (A/B vs the DOM board).
- **Phase 8.5 — Flow/screens/canvas-default** (split into sub-phases):
  - [x] **8.5a — Canvas is the default game board.** ✅ The p5 canvas is the default board inside `GameScreen` (local/AI/online), **reusing GameScreen's existing flow** (opening/roll/no-move-pass/AI/online/persistence) rather than re-homing devanture's `setTimeout` chains. New controlled `components/CanvasBoard.jsx` (props `{gameState, direction, interactive, onMove, onReady, showFrame, showMark, showDice, embedded}`; emits engine `{f,t}`; commits nothing; p5 mounted once, state via `inst.update()`, `onMove` via ref so never recreated). Perspective = a **180° render rotation** (`engineToRenderPt(i,dir)=dir===1?((i+12)%24)+1:i+1`) confined to `canvas/adapter.js` + 3 owner-side flips (dice/off/bar) via `nearColor`. `geometry.js` gains an `embedded` (box-filling) mode. `GameScreen` adds `USE_CANVAS_BOARD`/`useCanvas` (`?dom` fallback), `finishMove`, `handleCanvasMove` (→ `applyCombinedMove` → reuse `updateState`). `CanvasGame.jsx` (the `?canvas=live` spike) is now a thin wrapper over `CanvasBoard`. **Verified (Playwright):** AI drag-move + AI response, online two-client sync, online P2 perspective (180° rotation), 1 `<canvas>`, **0 console errors**; 76 unit tests green; build clean. **Tradeoff:** prod main bundle 412 kB → ~1.49 MB (p5 eager).
  - [x] **8.5b — Stats wiring.** ✅ Game-end recording to the player's Firebase profile via `storage/playerStats.appendGame`, closing the loop on `rules.js` scoring. New pure `app/src/game/gameResult.js` (`gameEndResult` → `{youScore,oppScore,opponent,delta,didWin}` or null; identity vs-AI=P1 / online=playerSlot / local-2P=null; delta=±`winPoints(classifyWin)` gammon/backgammon-aware; cube/resign deferred to 8.5d) + 10 unit tests. `GameScreen` records once on the `0→winner` transition (`recordedWinnerRef` fire-once, reset on new game + reconnect-safe); online both clients record their own nick. **Verified:** 86 unit tests; live Firebase integration (fire-once + back-to-back `totalGames:2`); adversarial 2-agent review (its one critical-flagged finding proven already-handled by test). Test nicks cleaned up. **Scope:** app has no resign/forfeit/timer/cube yet → game-end = normal win only.
  - **8.5c — Screens** (split):
    - [x] **8.5c-1 — Player profile / stats overlay.** ✅ `screens/StatsScreen.jsx`: a modal opened by clicking a player's name in `GameScreen`, showing real Firebase stats via `playerStats` (`getPlayer`/`getMultiplayerScore`/`rankFromGames`) — name, `(±N)`/win%/total/`#RANK` line, "since" date, recent-games table (`↑+N`/`↓-N` colored, YOU(score), `P-O`, opponent(score), date). `GameScreen` adds `profileNick` + `profileNickFor(slot)` + clickable `PlayerTag` names. Modal `z-100` (above BuildInfo's z-50 icon), closes on backdrop/`×`. **Verified (Playwright):** seeded profile → overlay shows the exact stats line + 5 rows; backdrop + `×` close; 0 errors; 86 unit tests. Score polyline chart deferred.
    - [x] **8.5c-2 — GMMN screen identity + menu merge.** ✅ Decision: **"GMMN aesthetic + nick accent"** (fond backdrop + nortechico font on screens; per-nick palette tints accents) — the 3 nick palettes + rainbow easter egg **kept**. New `ui/gmmn.js` (`ensureNortechico`, `GMMN_FOND`, `NORTECHICO`, style helpers) + `components/GmmnScreen.jsx` shell (fond + veil). `MenuScreen` now merges nickname + mode select (`onStart(nick, mode)`); `ModeSelectScreen` deleted; `App` flow simplified (no `modeSelect` step). `LobbyScreen` restyled as a GMMN room over the real Firebase lobby. **Verified (Playwright):** menu/lobby render the GMMN look; merged flow reaches lobby + game; 0 errors; 86 tests; build clean. (`GameScreen` surround keeps the solid theme bg — fond surround is later polish.)
    - [x] **8.5c-3 — Profile polyline chart.** ✅ `ScoreChart` SVG in `StatsScreen` (ported from devanture `drawScorePolyline`): X = `scoreHistory` date span, Y auto-scaled with a dashed zero baseline, gold nick-accent line; renders with ≥2 history points. Verified (Playwright): 8-point history → 8-vertex polyline, 0 errors. **8.5c complete.**
  - **8.5d — Cube + timers (net-new features; original React app never had these)** (split):
    - [x] **8.5d-1 — Doubling cube.** ✅ Wired the existing `cube.js` reducer into the live game. Cube state (`cube` + `cubeModal`) now lives **inside the synced `GameState`** (added to `newGameState`; normalized in `GameScreen` for pre-cube reconnects), so online clients share it through the existing whole-object write. New `cube.js` helpers: `colorOf`/`playerOf` (engine 1/2 ↔ reducer white/black) + `nextCubeValue`. Flow (faithful to devanture's R7 once-per-player, cap-4 variant) **restricted to the doubler's own roll phase** so online never writes during the opponent's turn (sidesteps the racy whole-object write): click the GMMN cube → self-confirm **offer** modal → opponent **accept** modal → accept doubles the cube + transfers ownership / decline ends the game at the pre-double value (`endReason:'decline'`). AI auto-decides via `ai.evaluate` + `shouldAcceptDouble`. **Scoring multiplier** (the bit 8.5b deferred): `gameResult.gameEndResult` now does `winPoints(winType) × cube.value`, with a declined double forced to a simple win regardless of the board. Per-client modal gating via `iControl(color)` (online = your slot; vs-AI = white only, black auto; local = both). **Verified (Playwright, live):** vs-AI handshake + AI auto-accept → ×2 + ownership transfer + one-double-per-player lockout; ×2 multiplier actually recorded to Firebase (`delta:2`); local hot-seat decline → offerer wins at pre-double value + `endReason` set; online two-client sync + per-client gating (offerer sees offer / opponent sees waiting → accept). 0 console errors; 92 unit tests (+6); build clean.
    - [x] **8.5d-2 — Timers + forfeit.** ✅ New `hooks/useGameTimers.js`: a chess-clock with a **15s per-turn move allowance** + a **119s per-player game bank** (devanture's values, in `logic.js` `MOVE_ALLOWANCE`/`GAME_BANK`); exceeding the move allowance drains the bank, an empty bank **forfeits** (opponent wins simple × cube via `endReason:'forfeit'`, already handled by `gameResult`). Banks live in the synced `GameState` (`clock.game.{1,2}`; seeded in `newGameState`, normalized in `GameScreen`). **Design adversarially reviewed** (3-lens workflow → synthesis): **decoupled local measurement** (no shared wall-clock/server time), the **on-turn client is the sole authoritative writer** — it folds its drained bank into the same write that flips the turn and is the only one that commits a forfeit; the off-turn client shows the **static synced bank** (no live opponent countdown). The clock runs **only in roll+move** — opening / pass / done / the cube handshake / animations are paused (one combined pause boolean, accumulated so paused time never counts). UI: per-player `⏱M:SS` bank + a live `15→0`s move timer on the on-turn player (red under 5s / bank under 30s). **Verified (Playwright, live):** clock display (on-turn live timer vs off-turn static bank); move timer counts down; **forfeit** on bank-drain → opponent wins + `endReason` + bank folded to 0 + recorded to Firebase (loss −1 / online both clients ±1); clock **freezes during a cube modal** then resumes; online forfeit propagates to the off-turn client. 0 console errors; 94 unit tests (+2). **Accepted v1 limitation:** if the on-turn player disconnects, no forfeit fires (clock freezes until they return) — a server trigger would be needed.
  - [ ] **8.5e — Canvas polish.** **Dice ball-physics roll animation** (devanture `dice.js` `ROLLING`/`SETTLING` state machine — translucent dice with the pips bouncing then settling; 8.4 ported only the static settled faces); canvas-native flying-checker/board-fill animation; bear-off **tray** rendering; landscape off-zone refinement; opening-roll dice-tap affordance; optional bar-half perspective flip.
- [ ] **Phase 8.6 — Delete devanture & dead code.** Remove the DOM board (`Board`/`Point`/`Checker`/`BarZone`/`DiceFace`, the old responsive/animation code). Delete the entire `devanture/` dir, the vite middleware, the `deploy.yml` copy step, the docker bind-mount, the p5 CDN reliance. Update DOCS/PLAN. Full regression: local, vs-AI, online (two tabs) on the deployed Pages build.

### Duplications to eliminate (→ single home)

- Rules engine: `app/src/game/logic.js` + `devanture/game/logic_standalone.js` → **`app/src/game/logic.js`**
- AI: `app/src/game/ai.js` + `devanture/game/ai_standalone.js` → **`app/src/game/ai.js`**
- Dice render/state: `components/DiceFace.jsx` + `devanture/dice.js` → **`app/src/canvas/dice.js`**
- Firebase: `storage/firebaseAdapter.js` + `devanture/firebase.js`/`firebase-config.js` → **`storage/firebaseAdapter.js`** (one project) + **`storage/playerStats.js`**
- Stats data/API + mock `PLAYER_PROFILES` → **`storage/playerStats.js`** (mock retired)
- Turn flow/opening/pass/finalize: `GameScreen.jsx` inline + `adapter.js` → **`hooks/useGameFlow.js`**
- Win-type/scoring, cube, combined-move resolution (all in `adapter.js`) → **`rules.js`**, **`cube.js`**, **`moveResolution.js`**
- Board geometry constants (px in `Board.jsx`/`GameScreen.jsx` vs r/a in `sketch.js`) → **`app/src/canvas/geometry.js`**
- Storage-key literals duplicated across 5+ files → **`app/src/game/constants.js`**
- p5 CDN `<script>` → **npm dependency**

### Top risks

- **p5 global-mode → instance-mode** conversion (5642-line `sketch.js` + 964-line `adapter.js` on ~20 globals + nested `setTimeout`s) under React StrictMode — orphaned timers / double-fired opening & AI turns. The spike (8.3) de-risks *rendering*; the *flow* re-homing (8.5) is the larger correctness surface — give the `setTimeout`-chain conversion explicit timer-cleanup/guard patterns.
- **Stateful features over the racy whole-object write** (`useOnlineMatch.js:62-68` read-modify-write): online timers/forfeit need a single authoritative writer; the cube is a two-client handshake — both risk last-write-wins/split-brain. May make transactional writes a prerequisite, not optional hardening.
- **Mandatory-move filter under the old per-die UI (8.1, transitional):** if `selectedDie` is the smaller die and the larger-die rule forbids it first, the filtered list is empty and the die looks dead mid-turn; `getValidMoves` also now runs `maxDiceSequence` (recursive deep-clone) every render (`GameScreen.jsx:160`) → highlight lag on doubles. Moot once the canvas drag/combined model replaces per-die selection (8.4+).
- **Asset pipeline:** ~11 bare relative `loadFont`/`loadImage` paths in `sketch.js`/`dice.js` 404 under Vite — each call site must be rewritten to an imported hashed URL. The repo ships **19 font files** (7 nortechico OTF weights + 12 PIX-DOT TTF), not a subset — copy the full `fonts/` dir.
- **Behaviour ships before look:** Phase 8.1 changes gameplay (mandatory-move + stronger AI) while still on the DOM board — "shippable" means *renders*, not *gameplay unchanged*.
- **Score-recording coupling:** `finalizeMoveStep` increments `gameScore` *before* recording, and resign vs normal use slightly different point computations — preserve or deliberately reconcile when porting to `playerStats.appendGame`.

### Feature inventory

The skin features below are delivered across the phases above. Each maps a skin feature to the React components/hooks it needs.

### Tasks

- [ ] **Doubling cube state** - Add `cubeValue / cubePromised / modalState` to `useGameState` (or new `useDoublingCube` hook). Modal components for offer/accept. Score multiplied by cube on game over.
- [ ] **Move + game timers** - New `useTimers` hook: per-turn 15s move timer + per-player game timer. Pause during modals and animations. Forfeit on game-timer expiry.
- [ ] **Resign action** - Resign button + confirmation, scored as simple × cubeValue. Pin the resign flag to the loser on game-over screen.
- [ ] **Multi-pickup for doubles** - `applyMultipleMoves(from, to, count)` in `logic.js`, with `k = floor(diceLeft / count)` dice per piece. UI: detect click depth in stack, render the multi-checker drag.
- [ ] **Match score** - `(N)` after player name = session games won. Persist across reload.
- [ ] **Multiplayer ELO superscript** - `getMultiplayerScore(player)` reads from Firebase. Update with K-factor=32 ELO formula on game-over.
- [ ] **Random background per match** - Pool of `fond*.jpg`, randomised on `startMatch()`. Re-extract dominant hue and rebuild theme palette.
- [ ] **Mirror mode per match** - Toggle `direction` on each new match (already exists per game). Wire to skin's `mirrorMode` flag.
- [ ] **Empty-dice auto-pass** - When `getValidMoves` returns empty, render dice frames at 25% opacity for 1.2s, then pass.
- [ ] **Exit-to-room flow** - `→ ⁰` button anchored at canvas bottom (centred portrait, bottom-right landscape). Confirmation modal during game, direct on game-over, also visible in the lobby.
- [ ] **Player profile overlay** - Click a player's name → modal-like overlay over the board with: name, cumulative multiplayer score `(±N)` (= `sum(recentGames.delta)`, also shown as the in-game superscript), win %, total games, podium icon + `#RANK`, first-play date, and a recent-games table (`YOU (score)` / `OPPONENT (rank)` / `↑+N` blue-pastel or `↓-N` burgundy-petrol). Wire the mock `PLAYER_PROFILES` to real Firebase user data; compute the rank from total games via `rankFromGames` (7-tier ASCII-friendly scale: ROOKIE/NOVICE/AMATEUR/SKILLED/ADVANCED/EXPERT/MASTER).
- [ ] **Sign-in (nickname)** - The skin already gates first launch with a sign-in screen that writes/reads `localStorage['bg:nick']` — the **same key** as jpep's `MenuScreen` / `saveNick()` / `loadNick()`. On integration, drop the skin's `drawSignin` and reuse `MenuScreen` as-is; nickname propagation through `applyUserNick()` should map to `useGameState`'s nick prop. Add real uniqueness validation (Firebase) before the user can claim a nickname so stats stay attached to one identity.
- [ ] **Vertical centring (portrait)** - Geometry already centres the full content stack with equal top/bottom whitespace; mirror the same logic when the skin is wired to the React layout helpers.
- [ ] **Updated nortechico fonts** - The `PIX-260426` font set (sizes 20/40/60/80/100/140/200) ships with the skin. When integrating, copy the OTF files into the React app's font asset directory and update the loaders to use the same family for consistency.
- [ ] **Lobby UI** - Replace skin's mocked player list with the real Firebase lobby. Click → invite → opponent accept/decline → start game.

---

## Backgammon Game Modes — Tournament-Standard Rules (Deferred)

Notes after cross-checking the current implementation against
[backgammongalaxy.com/how-to-play-backgammon](https://www.backgammongalaxy.com/how-to-play-backgammon).
The core rules (setup, direction, opening roll, doubles, hitting, bar, bearing
off with overshoot, forced max moves + biggest die, gammon/backgammon scoring)
are already correct. The items below are the **simplified variants** in our
code that should converge to the tournament standard in a future iteration.

### Tasks

- [ ] **Doubling cube full range (1→2→4→8→16→32→64)** - Currently capped at
      `cubeValue >= 4`. Standard allows 64. Remove the cap and let the cube
      double indefinitely; refusal still ends the game and pays the current
      face value to the offerer.
- [ ] **Cube ownership via `cubeOwner` (no per-player cap)** - Current
      variant: each player can double at most once (`cubeUsed[player]`). The
      tournament rule is "only the cube owner can offer next", tracked by
      `cubeOwner`. Switch the guard from `cubeUsed` to "is current player the
      owner OR is the cube centered (no owner yet)?".
- [ ] **Explicit "before rolling" check on `clickCube()`** - Currently the
      click is accepted at any time and effect is deferred to next turn
      via `cubePromised`. Behaviourally equivalent in most cases but should
      be tightened to reject clicks during dice animation / mid-turn for
      clarity.
- [ ] **Match play with point target** - Predetermined target (1, 3, 5, 7,
      11, 17, 25…). Cumulative `gameScore` across games until someone hits
      the target; reset between matches. Show `score / target` in the UI.
- [ ] **Crawford rule** - When one player is exactly 1 point from victory,
      the doubling cube is disabled for the very next game only. Track
      `crawfordGameDone` per match.
- [ ] **Jacoby rule (money games)** - Gammons / backgammons count as
      ×2 / ×3 ONLY if the cube has been turned at least once during the
      game. If still at 1 (untouched cube), even a gammon scores 1 point.
      Track `cubeTurned` per game; multiply by 1 instead of `winPoints(type)`
      when Jacoby is on AND `cubeTurned` is false. Toggle per match settings.
- [ ] **Beaver / Raccoon (optional money-game variant)** - On a double
      offer, the receiver can not only accept/decline but also "beaver"
      (re-double immediately while keeping the cube). Raccoon = the original
      offerer re-doubles after a beaver. Niche; only relevant if we ship
      money games seriously.

---

## How to Use This Plan

When starting a session with Claude Code:

1. Pick a phase or specific task from the checklist
2. Say something like: *"Let's work on Phase 2 - responsive layout"*
3. Mark completed tasks with `[x]` as you go
4. Add new tasks or phases as the project evolves

The plan is a living document. Update it as priorities shift.
