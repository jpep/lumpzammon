# Backgammon Online - Project Documentation

## Overview

A browser-based backgammon game built with **Vite + React**, supporting three game modes: local two-player, vs AI, and online multiplayer (via Firebase Realtime Database). The project is containerized with Docker for development.

## Tech Stack

| Layer       | Technology               |
|-------------|--------------------------|
| Framework   | React 18 + Vite 6        |
| Runtime     | Node 20 (Alpine)         |
| Backend     | Firebase Realtime DB     |
| Dev env     | Docker Compose           |
| Deployment  | GitHub Pages (Actions)   |

## Project Structure

```
lumpzammon/
├── docker-compose.yml            # Dev and prod services
├── claude_seed/                   # Original seed files from Claude Desktop
│   ├── chat.md
│   ├── project-scaffold.txt
│   ├── storage-layer.js
│   ├── firebase-guide.md
│   └── game-logic.js
└── app/                           # The application
    ├── Dockerfile                 # Multi-stage: build + nginx
    ├── docker-compose.yml         # (root level used instead)
    ├── nginx.conf                 # SPA fallback config
    ├── .dockerignore
    ├── index.html
    ├── package.json
    ├── vite.config.js             # base: /backgammon-online/
    ├── firebase-setup.md          # Firebase setup instructions
    ├── .github/workflows/
    │   └── deploy.yml             # GitHub Pages CI/CD
    └── src/
        ├── main.jsx               # React entry point
        ├── App.jsx                # Screen router + state management
        ├── ThemeContext.jsx       # React Context for dynamic theming
        ├── storage/               # Storage abstraction layer
        │   ├── index.js           # Auto-detects environment
        │   ├── artifactAdapter.js # Claude artifact sandbox adapter
        │   ├── firebaseAdapter.js # Firebase Realtime DB adapter
        │   └── local.js           # localStorage helpers (nick, session)
        ├── game/                  # Pure game logic (no React)
        │   ├── logic.js           # Board setup, rules, move validation
        │   └── ai.js              # AI evaluation + move selection
        ├── components/            # Reusable UI components
        │   ├── Board.jsx          # Full board layout
        │   ├── Point.jsx          # Single triangle/point
        │   ├── Checker.jsx        # Game piece (white/black)
        │   ├── DiceFace.jsx       # Die face with dot layout
        │   ├── BarZone.jsx        # Captured pieces area
        │   ├── RainbowDecorations.jsx # Animated stars/flowers overlay for rainbow theme
        │   ├── AdminPanel.jsx     # Match + lobby management overlay
        │   └── BuildInfo.jsx      # Deploy info (commit, author, date)
        ├── screens/               # Full-page views
        │   ├── MenuScreen.jsx     # Nickname entry
        │   ├── ModeSelectScreen.jsx # Mode picker
        │   ├── LobbyScreen.jsx    # Online match browser
        │   ├── GameScreen.jsx     # Main gameplay
        │   └── KickedScreen.jsx   # Disconnection notice
        └── hooks/                 # Custom React hooks
            ├── useOnlineMatch.js  # Match create/join/sync
            └── useKickDetection.js# Detect match deletion
```

## Architecture

### Screen Flow

```
MenuScreen (enter nickname, shows "Lumpzammon!" title)
    └─► ModeSelectScreen (local / ai / online)
            ├─► GameScreen (local or ai mode)
            └─► LobbyScreen (create or join)
                    └─► GameScreen (online mode)
                            └─► KickedScreen (on disconnect)
```

### Storage Abstraction

The storage layer (`src/storage/`) provides a unified API (`sGet`, `sSet`, `sDel`, `sList`, `sSubscribe`) that works in two environments:

- **Claude Artifact sandbox**: Uses `window.storage` API (the app's original runtime)
- **Hosted deployment**: Uses Firebase Realtime Database

Detection is automatic. The `sSubscribe` function uses Firebase's `onValue` for real-time sync, falling back to polling in the artifact environment.

### Game Persistence & Reconnection

All game modes persist across browser reloads. Online matches use Firebase + localStorage session. Local and AI games save state and board direction to `localStorage` on every change, and restore on page load (skipped if the game was already won). Clicking "Leave Game" clears the saved state. The local storage layer (`src/storage/local.js`) saves the player's nickname and active match session (matchId + playerSlot). Session and local game keys are scoped by nickname (e.g. `bg:session:pepo`) so multiple tabs with different nicks can coexist without clashing — useful for testing online mode against yourself. The nickname itself is stored in `sessionStorage` (per-tab) with a `localStorage` fallback for pre-filling on fresh tabs.

**How it works:**

1. When a player creates or joins a match, the session is saved to `localStorage` (scoped by nick)
2. The nickname is saved to both `sessionStorage` (per-tab isolation) and `localStorage` (pre-fill fallback)
3. On app load, if a saved session exists, the app attempts to reconnect to the match in Firebase
4. Reconnection verifies the match still exists and the player's nickname matches the stored slot
5. If reconnection succeeds, the player goes straight to the game screen
6. If the match no longer exists (opponent left, etc.), the saved session is cleared and the menu is shown

**Explicit leave vs. disconnect:**

- Clicking "Leave Game" deletes the match from Firebase and clears localStorage — the game is gone
- Closing the browser (or navigating away) keeps the match in Firebase — both players can reconnect later

### Game Logic

All game rules live in `src/game/logic.js` as pure functions with no dependencies on React or storage:

- `initialBoard()` / `newGameState()` - Board setup (standard backgammon layout)
- `rollDice()` - Random dice with doubles support (returns 4 dice on doubles)
- `rollSingleDie()` / `resolveOpening()` - Opening roll: each player rolls one die, higher goes first using both dice as their first move (no doubles possible on first move)
- `getValidMovesRaw(state, player)` - All legal single-die moves (the original generator), no mandatory-move rule. Used by the AI's sequence enumeration and by `maxDiceSequence`.
- `maxDiceSequence(state, player)` - Deepest chain of playable dice reachable (drives the must-use-maximum-dice rule).
- `getValidMoves(state, player)` - Legal moves **with the mandatory-move rule** applied: must play the maximum number of dice, and if only one of two distinct dice is playable it must be the larger. This is what the UI/highlighting and the AI consume. (Folded in from the devanture engine, Phase 8.1.)
- `applyMove(state, player, move)` - Returns new immutable state after a move
- `checkWin(state)` - Checks if either player has borne off all 15 checkers

Pure scoring/flow helpers extracted from the devanture skin (Phase 8.1, tested but **not yet wired into the UI** — pending Phase 8.5):
- `src/game/rules.js` - `classifyWin` (simple/gammon/backgammon), `winPoints`, `isInitialPosition`, `resignOutcome`.
- `src/game/cube.js` - pure doubling-cube state machine (non-standard once-per-player, cap-4 variant; see "Tournament-Standard Rules" in PLAN.md for the standard cube).
- `src/game/moveResolution.js` - combined multi-die move resolution + multi-pickup (`findMoveSequence`/`collectTargets`/`applyCombinedMove`/`applyMultiPickup`), engine coordinates.

### AI

`src/game/ai.js` (Phase 8.1: adopted the devanture engine — a 1-ply expectiminimax by default):

- `evaluate(state, player)` - Static position score: borne-off, opponent-on-bar, own-on-bar, made points, blots (worse in the opponent's home), pip advancement.
- `greedyPlay(state, player)` - The original greedy: highest immediate `evaluate` at each step, no lookahead. Kept as the cheap difficulty level and reused as the opponent reply model.
- `aiPlay(state, player, difficulty='normal')` - `'normal'` = 1-ply lookahead (enumerate my turn sequences, pick the one maximizing `evaluate(me)` minus the probability-weighted best greedy opponent reply); `'easy'` = greedy. Returns `{ seq, state }`. The difficulty toggle will be surfaced in the UI in Phase 8.5; lookahead is heavier (~up to 60 sequences × 21 opponent rollouts) so use `'easy'` on low-power devices.
- Moves are applied one at a time with delays between each so the player can follow each stone movement. The AI auto-rolls after 800ms.

### Move Animation

When a piece moves (player or AI), instead of teleporting, a **flying checker** smoothly translates from the source to the destination using CSS transitions (300ms ease-in-out). The system works by:

1. Computing screen coordinates of source and destination elements via `data-point-id` / `data-bar-player` DOM attributes and `getBoundingClientRect()`
2. Hiding the top checker at the source point (opacity: 0)
3. Rendering a `position: fixed` Checker overlay that transitions from source to destination coordinates
4. After the animation completes, removing the overlay and applying the actual game state update

This applies to all move types: point-to-point, bar-to-point, and point-to-off, for both human and AI players. An `isAnimatingRef` prevents input during animation.

### Game Modes

| Mode    | How it works                                                    |
|---------|-----------------------------------------------------------------|
| Local   | Two players share one screen, alternating turns                 |
| vs AI   | Player is white (P1), AI is black (P2), auto-rolls and moves   |
| Online  | Two players via Firebase: one creates, one joins from lobby     |

### Theme

All colors are centralized in `src/theme.js`. The active theme is provided to components via React Context (`src/ThemeContext.jsx`), allowing dynamic theme switching at runtime.

Three theme variants are available:

| Theme   | Trigger           | Aesthetic                                  |
|---------|-------------------|--------------------------------------------|
| Default | Any other name    | Casino — black, white, red, gold           |
| Sepia   | Nickname "jugo"   | Warm browns, tans, parchment tones         |
| Marine  | Nickname "pepo"   | Deep blues, teals, ocean tones             |
| Rainbow | Nickname "simon"  | Vibrant rainbow colors, floating stars & flowers, gradient text |

The theme is selected automatically based on the player's nickname (case-insensitive, exact match). The `getTheme(nick)` function in `theme.js` handles the mapping. All components consume the theme via the `useTheme()` hook from `ThemeContext.jsx`.

The Rainbow theme includes a special `decorations` property that triggers the `RainbowDecorations` component (`src/components/RainbowDecorations.jsx`), which renders animated floating stars (✦⭐), flowers (✿❀), and rainbows (🌈) as a fixed overlay. The title text also gets a rainbow gradient effect.

### Status Bar

Each player is shown with a rendered stone icon (white/black gradient) and their nickname. In online and AI modes, a green **(you!)** tag marks the local player. The active player's name highlights in yellow with an action label ("Roll dice" or "Move") inline towards the center.

## Development

### Running locally (Docker)

```bash
# Start dev server with hot reload on port 5173
docker compose --profile dev up -d dev

# Access at: http://localhost:5173/lumpzammon/
```

### Production build (Docker)

```bash
# Build and serve via nginx on port 3000
docker compose up app --build

# Access at: http://localhost:3000/
```

### Deployment (GitHub Pages)

The app auto-deploys to GitHub Pages on every push to `main` via `.github/workflows/deploy.yml`.

```bash
# Manual deploy (without pushing a commit)
gh workflow run deploy.yml

# Check deploy status
gh run list --limit 1
```

Live URL: https://jpep.github.io/lumpzammon/

### Key configuration

- **Vite base path**: Set in `vite.config.js` (`/lumpzammon/`). Change this if deploying under a different path.
- **Firebase config**: Read from environment variables (`import.meta.env.VITE_FIREBASE_*`).
  - **Local dev**: set values in `app/.env` (gitignored, see `app/.env.example` for template)
  - **GitHub Pages**: injected via repository secrets during the Actions build step
  - Firebase project: `lumpzammon` (Spark/free plan, Realtime Database)

### Browser verification (Playwright)

How to drive the **running** app in a real browser to confirm a UI/gameplay change (local/AI or online) — and the gotchas that cost time the first time, so the next run starts clean. (The `.claude/skills/verifier-browser` skill mirrors this so `/verify` auto-uses it; this section is the human-readable copy.)

**Run recipe** — Playwright in the official Docker image (no host `npm` per project rules); the dev server must be up (`docker compose --profile dev up -d dev`):

```bash
mkdir -p .verify && cd .verify        # throwaway scratch; clean up after
# write your driver, e.g. verify.mjs (import { chromium } from 'playwright')
docker run --rm --network host \
  -v "$(pwd)":/work -w /work \
  mcr.microsoft.com/playwright:v1.49.0-jammy \
  bash -lc "npm init -y >/dev/null 2>&1 && npm i playwright@1.49.0 --no-save --silent && node verify.mjs"
```

- The **image tag must match the `playwright@` version** (`v1.49.0-jammy` ↔ `playwright@1.49.0`); browsers are prebundled in the image.
- **Clean up the scratch via Docker** (npm ran as root → host `rm` hits permission denied):
  `docker run --rm -v "$(pwd)":/w -w /w node:20-alpine rm -rf .verify`

**Gotchas (with the fix):**

1. **Vite blocks non-`localhost` Host headers** (`server.allowedHosts`). Reaching the dev container as `http://dev:5173` shows *"Blocked request. This host (dev) is not allowed."* → run the container with `--network host` and use `http://localhost:5173/lumpzammon/` (Host `localhost` is allowed). Alternatively add the host to `server.allowedHosts` in `vite.config.js`.
2. **Every top checker has `cursor:pointer`** (the click handler is always wired), so cursor is *not* a "movable" signal. Detect **movable** checkers by their glow box-shadow: `getComputedStyle(c).boxShadow.includes('0px 0px')` (normal checkers are `0px 2px …`).
3. **Checkers sit at the point's edge, not its center** (points are 42×200, checkers stack from the top/bottom edge). A default center-click misses them → click the checker by its **bounding-box coords** (`el.getBoundingClientRect()` → `page.mouse.click(cx, cy)`), not the `[data-point-id]` element.
4. **Move targets** are detectable on the point div: `[data-point-id]`'s own `cursor` is `pointer` only when it's a highlighted destination, so clicking the point-div center is fine for targets. A checker with exactly **one** legal move executes on the checker click; with several it sets `selectedFrom` and targets highlight (then click one).
5. **Online has no optimistic local update** — moves round-trip through Firebase (`updateMatch` write → `sSubscribe` echo). Don't expect the acting client's board to change instantly; **poll both clients (~up to 8s)** for the change.
6. **Two-client online test**: two separate `browser.newContext()` (separate storage = two nicks). Host → Online → **Create Match** → "Waiting"; joiner → Online → lobby lists *"host's game"* → **Join** (target the Join button **by role**, not brittle XPath). Cleanup = click **Leave Game** on each (calls `leaveMatch` → deletes the `bg:match:`/`bg:lobby:` entries from the live Firebase DB). Opening: each client clicks **"Roll for first move"**, handle ties (buttons reappear), then proceed once both roll buttons are gone and one side has movable checkers.

**Handy selectors / signals:** menu `input[placeholder="Enter your nickname"]` + `button:has-text("Play")`; modes `button:has-text("Local (2 Players)"|"vs Computer"|"Online")`; board points `[data-point-id="0".."23"]`, bear-off `[data-point-id="off-1"|"off-2"]`; **board signature** to detect any move = count of `36px` `border-radius:50%` divs per `[data-point-id]`; storage keys `bg:nick` / `bg:session:<nick>` / `bg:localGame:<nick>` / `bg:match:<id>` / `bg:lobby:<id>` (all from `app/src/game/constants.js`).

## Alternating Board Direction

The board direction alternates each new game, like flipping seats at a real backgammon table. A `direction` state (0 or 1) in `GameScreen.jsx` toggles on "New Game". `getBoardIndices(dir)` in `logic.js` returns flipped index arrays, and `Board.jsx` conditionally places bear-off zones on the left or right side accordingly. Game logic is unchanged — only the visual mapping of indices to screen positions changes. The flip is a full 180° rotation: top/bottom halves swap, left/right swap, and each player's bar and bear-off zone move to the correct half. Bear-off zones display a "home" label highlighted for the current player. In online mode, direction is derived from `playerSlot` — each player sees their own home on the bottom half of the screen, like sitting across a real table.

## Pip Count

Each player's pip count (total distance remaining to bear off all checkers) is displayed next to their name in the status bar. Calculated by `calcPipCount(s, pl)` in `logic.js` — sums `pipDist * checkerCount` for all board points plus `bar[pl] * 25` for bar checkers.

## Pass Overlay

When a player rolls and has no valid moves, a prominent overlay appears centered on the board with a semi-transparent backdrop, the player's stone icon, and bold "No valid moves — Pass!" text. The overlay auto-clears after 2 seconds. Replaces the previous small text message.

## Move Hints and Dice Selection

When it's a player's turn to move:

- **Movable checkers** are highlighted with a gold glow, showing which pieces can legally move with the currently selected die.
- **Destination highlights** appear after selecting a checker, showing valid landing points.
- **Dice selection** — after rolling, the first die is auto-selected (gold border glow). Click the other die to switch which die value you're playing first. Moves are filtered to only show options for the selected die. After playing a die, the remaining one auto-selects.

Components involved: `GameScreen.jsx` (state management), `DiceFace.jsx` (selected glow), `Checker.jsx` (movable glow), `Point.jsx` / `BarZone.jsx` (pass movable state), `Board.jsx` (movableSources set).

## Bug Fixes

### Fix duplicated checkers on the bar (2026-04-06)

PR #9 identified a bug where hit checkers appeared duplicated on the bar — `Board` rendered `<BarZone>` twice (once per half) and each instance rendered both players. The fix passes a `player` prop to `BarZone` (`player={2}` in the top half, `player={1}` in the bottom half) so each instance only renders one player's hit checkers. PR #9's Board.jsx was also restored to a valid component (it had been accidentally reduced to a JSX fragment).

## Origin

This project was scaffolded from a conversation with Claude Desktop. The seed files in `claude_seed/` contain the original artifacts: project structure, storage layer design, Firebase setup guide, and game logic. The React components, screens, hooks, Docker setup, and App router were built from these blueprints.

---

## Game Unification (`feat/unify-game`, in progress)

The project currently ships **two** implementations: the React app at `/lumpzammon/` ("original") and the p5.js skin at `/lumpzammon/devanture/` ("devanture"). They are being merged into **one** game — devanture's look-and-feel, original's mechanics + online/storage, with devanture's functional upgrades folded in and no duplication. Full roadmap (phases, fold-in list, duplications, risks) lives in **PLAN.md → Phase 8**. Key architectural facts:

- **The two engines are nearly identical.** `devanture/game/logic_standalone.js` is `app/src/game/logic.js`'s code (verified) re-wrapped as `window.Logic`, plus rule upgrades; the AI `evaluate()` is byte-identical. The real divergence is **rendering**: original = React DOM/CSS components; devanture = a single p5 canvas (`sketch.js`, 5642 lines).
- **Target rendering:** embed devanture's p5 canvas inside React in **instance mode** as `<BoardCanvas>`, driven by an immutable `GameState` snapshot, emitting intents back via callbacks. Devanture's look relies on canvas-only primitives (`destination-out` knockout logo/frame, `'lighter'`+gradient glow, per-pixel dominant-hue palette, ball-physics dice, OTF PUA glyph U+F8FF) with no faithful CSS/SVG equivalent, so the canvas code is reused, not rewritten. End-state: hybrid (canvas board + DOM HUD), migrated incrementally.
- **Single engine** in `app/src/game/` (adopt devanture's superset; re-add the original's `getBoardIndices`/flip exports). Pure rules only — cube/timers/stats become React state. `getValidMoves` gains rules-filtering (mandatory max-dice + larger-die); the old raw generator is preserved as `getValidMovesRaw`.
- **Single Firebase project: `lumpzammon`** (modular ESM SDK, env config). Devanture's `/players` stats API is re-implemented as `storage/playerStats.js` and migrated off `gmmn-afd53` (see Phase 7.5 supersede note).
- **Online stays React-authoritative** (`matchData.state` is the single source of truth); the canvas is a pure renderer + input surface.
- **Sign-in:** reuse the React `MenuScreen` restyled to the GMMN look (not devanture's `drawSignin`).
- **End state:** the `/devanture/` path, the `deploy.yml` copy step, the vite devanture-index middleware, the docker bind-mount, the DOM board components, and the p5 CDN script are all removed.

### Phase 8.2 — Firebase + stats unified on `lumpzammon` (done)

- **`app/src/storage/playerStats.js`** — the `/players/<nick>` stats API re-homed from `devanture/firebase.js`+`adapter.js` onto the project's single modular-ESM Firebase app. `getPlayer` / `ensurePlayer` / `appendGame` plus the pure display helpers `getMultiplayerScore` / `rankFromGames` (7 tiers). The schema is unchanged from the skin (`firstPlay`, `totalGames`, `wins`, `winPercent`, `recentGames` capped 50, `scoreHistory` cumulative-per-day). One canonical `sanitizeNick` replaces the skin's. **Not wired to any screen until Phase 8.5** (infrastructure only; tree-shaken from the build).
- **`appendGame` is transactional** (`runTransaction`) — atomic read-modify-write, unlike the skin's `once`+`set`, so concurrent finishes can't clobber each other. The pure reducer `applyGameToProfile(profile, gameResult, nowIso)` is what the transaction applies and what `storage/__tests__/playerStats.test.js` (16 tests) exercises.
- **One Firebase app:** `firebaseAdapter.js` now `export`s its memoized `getDb()`; `playerStats.js` imports it and uses real nested `/players/<nick>` paths (the key/value facade's `sanitizeKey` flattens `/`→`_`, which would break the namespace) + transactions.
- **`database.rules.json`** added at the repo root as the rules source of truth. **It is not auto-deployed** (Pages ships static files only; apply via console or `firebase deploy --only database`). **Auth model decision: NONE for now** — the web client doesn't authenticate and online play runs on open read/write; requiring `auth != null` would break the live app until anonymous auth is added to the adapter, so that is deferred to Phase 5. The rules keep read/write open (test-mode parity; root `.read` must stay `true` for the `orderByKey` range list of `bg:match:`/`bg:lobby:` keys) and add shape validation on the `/players` namespace.
- **Migration off `gmmn-afd53`: no-op.** Probing showed `lumpzammon` `/players` is empty (clean destination) and the skin **never wrote any stats** — `firebase.js` boots + signs in anonymously, but nothing in the skin calls `appendGame`/`ensurePlayer` (Phase 7.5 "Stats writes" was never wired; `recordGameToProfile` only mutates the in-memory mock `PLAYER_PROFILES`). So there is no real data to move. Recipe if any ever appears: export `players` from `gmmn-afd53` (`firebase database:get /players --project gmmn-afd53 > players.json`, owner auth) and import to `lumpzammon` (`firebase database:set /players players.json --project lumpzammon`).

### Phase 8.3 — Canvas spike (done)

De-risk the hardest part of the unification — embedding devanture's p5 canvas in React/Vite — with a **static, dev-only** slice rendering board + staircase triangles + checkers + the hollow GMMN frame/logo over a hardcoded snapshot. Verified in a real browser (Playwright); zero console errors.

- **p5 as an npm dep** (`p5@^1.11.13`, installed via Docker), replacing the skin's CDN `<script>`. The CDN was 1.9.4 — 1.11.x is API-compatible.
- **Instance mode, not global.** `app/src/canvas/` holds pure ES modules ported from `sketch.js` with every former module-global parameterized: `geometry.js` (`computeGeometry` → a geom object `{a,r,bx,by,diceOnSide}` + `ptCenterX`/`stackCY`/`barPieceCY`), `palette.js` (`extractDominantHue` + `buildPalette(p,hue)` returning the `C` colour object — flips to HSB then **restores RGB**), `drawBoard.js` (board + 24 staircase triangles), `drawCheckers.js` (stacks + bar + `+N` overflow + the optional U+F8FF `drawNortechicoMark`), `drawFrame.js` (`destination-out` hollow frame + GMMN title), `snapshot.js` (hardcoded mockState-shape positions), and `sketch.js` (the `makeSketch({width,height,showFrame,showMark,snapshot})` factory — `bgImage`/`fontLarge`/`C`/`geom` are closure locals, so two instances can't bleed; `noLoop()` one-shot render, `redraw()` on resize).
- **`components/CanvasGame.jsx`** mounts the instance in `useEffect`, registers the `nortechico` **`@font-face`** (FontFace API, so the Canvas-2D GMMN title letters resolve before the one-shot draw, not the Noto fallback), and drives resize via a `ResizeObserver` + a custom `p.resize(w,h)` (we don't bind `p.windowResized`, which would survive teardown). **StrictMode-safe teardown:** the instance is a local const captured by the cleanup closure; cleanup disconnects the observer and calls `inst.remove()` (removes the `<canvas>`, cancels p5's RAF, unbinds listeners); a `cancelled` flag guards the async font-load race. Verified: exactly **one** `<canvas>` after the dev double-mount.
- **Assets via the Vite graph** (`app/src/assets/` — `nortechico-100.otf`, `fond2.jpg`): imported as `?url` so Vite hashes them and there's no 404 (the skin's bare relative `fonts/…`/`fondN.jpg?v=3` paths would 404 under Vite). The fond is drawn **cover-fit into the canvas** so `destination-out` reveals it in-canvas — we do **not** write `document.body.style.backgroundImage` (it would leak the image behind the whole React app). p5 default `pixelDensity` (retina) is kept; backing store verified at 2× on a 2×-DPR context.
- **Veil/frame finding:** the hollow GMMN frame/logo is a **pre-game overlay** — it only reads over an 86% dark veil (`drawMessageVeil(0.86)`) that the knockout carves through; you cannot show a bright board *and* the carved frame at once. So the spike exposes a `showFrame` flag and verifies both: the dimmed frame composite and the bright board.
- **PUA glyph:** the logo's catana slots are **empty in the current `sketch.js`** (`wK=0`, adjacent G/MM/N) — the U+F8FF glyph the architecture flagged actually lives in `NORTECHICO_GLYPH` (the checker mark). The `?canvas&mark` path renders it via the `p5.Font` to confirm the `loadFont` PUA path works (no tofu).
- **Reached via a dev-only flag** (zero production impact): `?canvas` = frame composite, `?canvas=board` = bright board, `&mark` = NORTECHICO glyph, `&snap=stack` = bar pieces + `+N` overflow. The `lazy(() => import('./components/CanvasGame'))` is itself gated behind `import.meta.env.DEV`, so Rollup drops the p5 chunk **and** the fond/font assets from the production build — the prod `dist` is byte-identical to before the spike (412.23 kB main bundle). Portrait-only for now (the landscape 90° title rotation is deferred).
### Phase 8.4 — Canvas driven by the live engine (done)

The canvas now renders the **live engine `GameState`** and is **playable by drag-to-move** for a local game, behind `?canvas=live` (dev-only). React stays authoritative: it owns the state, the canvas is a pure renderer + input surface. Verified in-browser (Playwright): a legal drag commits through the engine, a drop on nothing is a no-op, one `<canvas>`, zero console errors.

- **`canvas/adapter.js`** — the single engine↔render bridge. `toSnapshot(gs)` (verbatim `syncMockState`: engine index `i` → render point `i+1`, P1=white=+n / P2=black=−n, bar/off keyed 1/2→white/black) plus all coordinate conversion (`renderToEngineFrom/To`, `engineToRenderPt`, `countAt`). All `+1/−1` lives here — nowhere else (3 coord systems: engine 0..23 / render 1..24 / pixel).
- **`canvas/dice.js`** — static two-die renderer (`PIP_LAYOUTS`/`getDiePos`/`drawStaticPips` ported from the skin). `diceFromGameState(gs)` reads `gs.dice` (the full roll) + `gs.moves` to fade a **used die** to 50% (doubles via a played count). The ball-physics roll animation is deferred to 8.5.
- **`canvas/interaction.js`** — pure inverse-geometry hit-test (`hitTestPickup`: bar-first, then topmost checker of the active player's point) + `resolveSnap` (board point snaps within an `a`-wide X band, Y ignored; off snaps in the bear-off zone) + the eased dragged-checker ghost (`updateDragDisplay`/`drawDraggedChecker`, with a bear-off morph).
- **`canvas/highlights.js`** — ivory **source halos** on movable points (always) + **target rings** while dragging (brighter on the snapped one), driven entirely by `getValidMoves`/`collectTargets` arrays passed down.
- **`geometry.js`** — threads `cssH` into `g` (the bear-off zone needs canvas height — not `window.innerHeight`); adds `ptNextY` (landing slot) / `ptTopY` (halo).
- **`sketch.js`** — now live-capable: a mutable `view` updated via `inst.update()`; p5 mouse handlers (live mode only) wired to the interaction layer → `onPickup`/`onMove` callbacks; renders dice + halos + target rings + ghost. **redraw-on-change**, with `p.loop()` only while dragging (for ghost/snap easing), `p.noLoop()` on release. State flows in via `update()` — the p5 instance is **never recreated** on a state change.
- **`CanvasGame.jsx`** — the live host. A self-contained **local two-player harness** (`useState(freshLocalGame())`, `rollFor`/`advance` using `logic.js` + `moveResolution.js`) kept off the production GameScreen/online/AI paths. `onPickup` → `collectTargets`; `onMove` → `applyCombinedMove` (resolves a flat from→to into a 1..N-die sequence, handling intermediate hops + hits) → `advance` (win / continue / end-turn + auto-roll). A DEV-only `window.__cg` hook (`getState`/`validMoves`/`geom`) backs the verifier.
- **Flag:** `?canvas=live` (bright interactive board, no veil so pointer events reach p5). The `?canvas` / `?canvas=board` static spikes are unchanged; prod build still excludes everything (412 kB).
- **Deferred to Phase 8.5:** roll/flying-checker/board-fill animations; **online P2 perspective** (the `getBoardIndices(dir=1)` mirror — 8.4 is local, single orientation); AI choreography; opening-roll UI; doubles multi-pickup drag; bear-off **tray rendering** (the off *drop* already commits); cube/timers; and embedding the canvas inside `GameScreen` as the default board (A/B with the DOM board).

### Phase 8.5a — Canvas is the default game board (done)

The p5 canvas is now the **default board inside `GameScreen`** (local, AI, and online), reusing GameScreen's existing React flow (opening / roll / no-move pass / AI / online / persistence) — devanture's `setTimeout` choreography is **not** re-homed. React stays authoritative; the canvas is a controlled renderer + drag-input surface. Verified in-browser (Playwright): AI drag-move + AI response, online two-client sync, online P2 perspective, one `<canvas>`, zero console errors. Append `?dom` (dev only) to fall back to the legacy DOM `<Board>`.

- **Perspective = a 180° render-point rotation.** Online P2 (`direction=1`) sees their home at the bottom. The DOM board does this via `getBoardIndices` (`TOP_IDX_FLIP`/`BOT_IDX_FLIP`); the canvas reproduces it as `engineToRenderPt(i, dir) = dir===1 ? ((i+12)%24)+1 : i+1` (and the inverse `renderPtToEngine`), **confined to `canvas/adapter.js`**. Sign/colour are perspective-invariant (white=+n, black=−n) — only position rotates. Three owner-side flips follow `nearColor = dir===1 ? 'black' : 'white'`: dice side (`dice.getDiePos`), bear-off snap zone (`interaction.resolveSnap`), and (deferred, cosmetic) the bar half.
- **`components/CanvasBoard.jsx`** (new) — the controlled board. Props `{gameState, direction, interactive, onMove, onReady, showFrame, showMark, showDice, embedded}`. It converts render→engine internally and emits `onMove({f, t})` in **engine coords**; it commits nothing. p5 is mounted once (StrictMode-safe teardown), live state pushed via `inst.update()`, and `onMove` is routed through a ref so the instance is never recreated on re-render.
- **Embedded geometry** — `computeGeometry(w, h, embedded)` adds a compact mode that fills GameScreen's sized board box (small vertical margin for the bear-off drop), since GameScreen owns the dice/title/names in DOM. The fullscreen `?canvas=*` spike still uses the non-embedded geometry.
- **`GameScreen.jsx` wiring** — `USE_CANVAS_BOARD` + `useCanvas` (the `?dom` override), `finishMove(newGs, player)` (the post-move recipe extracted from `executeMove`, snap — no DOM tween), and `handleCanvasMove({f, t})` → `applyCombinedMove` (resolves a flat drag into 1..N dice incl. hits) → `updateState(finishMove(...))`. Reuses the one `updateState` write path, so AI / online / persistence / opening all keep working unchanged. A DEV-only `window.__gs` hook (state/geom/direction/validMoves) backs the verifier.
- **`CanvasGame.jsx`** (the `?canvas=live` dev spike) is now a thin wrapper over `CanvasBoard`.
- **Known tradeoff:** the production main bundle grew 412 kB → ~1.49 MB (gzip ~387 kB) because p5 is now eagerly loaded (the canvas is the default board). Acceptable for 8.5a; a later option is to lazy-load `CanvasBoard` behind a Suspense fallback.
- **Deferred to later 8.5 sub-phases:** flying-checker/board-fill animation (moves snap; AI moves snap because the DOM `animateAndExecute` finds no `[data-point-id]` and fires its callback immediately); ~~`StatsScreen` + `LobbyScreen` restyle + menu/About merge~~ (8.5c, done); ~~doubling cube~~ (8.5d-1, done); timers (8.5d-2); bear-off **tray** rendering; landscape off-zone refinement.

### Phase 8.5b — Game-end stats recording (done)

On a game's end the finished game is recorded to the player's Firebase profile via `storage/playerStats.appendGame` (built in 8.2), closing the loop on the previously-unwired `rules.js` scoring (8.1).

- **`app/src/game/gameResult.js`** — pure `gameEndResult({ gs, winner, isOnline, isAI, playerSlot, opponentName })` → `{ youScore, oppScore, opponent, delta, didWin }` or `null`. Identity: vs-AI the human is P1; online it's `playerSlot`; **local two-player returns `null`** (no single identity to attribute on one device). `delta = ±winPoints(winType) × cube.value` — **gammon/backgammon aware** (simple 1 / gammon 2 / backgammon 3) and **cube-multiplied** as of 8.5d-1 (`winType` is `classifyWin(...)`, except a declined double — `endReason:'decline'` — is forced to a simple win at the pre-double value). 14 unit tests.
- **`GameScreen.jsx`** — a `useEffect([gs.winner])` records once on the `0→winner` transition. `recordedWinnerRef` (seeded with the current winner) prevents re-recording on reconnect-to-finished, resets to 0 on the `winner→0` transition **and** explicitly in `handleNewGame` (belt-and-suspenders) so back-to-back wins by the same player both record. Online: both clients fire, each recording for **its own** nick (no per-nick duplicate). A DEV-only `window.__gs.forceWin(player)` backs the integration test.
- **Verified:** 86 unit tests green; a live Firebase integration test (vs-AI: a forced win wrote `totalGames:1, wins:1, delta:1, opponent:'AI'`; a second `forceWin` kept `totalGames:1` — fire-once; New Game + a second win recorded `totalGames:2` — back-to-back). 0 console errors. An adversarial review (2 agents) surfaced one critical-flagged finding (the back-to-back case) which the test proved already handled. Throwaway test nicks were deleted afterward so real `/players` stats stay clean.
- **Scope note:** the React app currently has no resign/forfeit/timer/cube, so game-end = a normal bear-off win only; those other end types arrive with later sub-phases.

### Phase 8.5c-1 — Player profile / stats overlay (done)

Clicking a player's name in `GameScreen` opens **`screens/StatsScreen.jsx`** — a modal overlay showing that player's real Firebase stats (now populated by 8.5b). It reads `storage/playerStats` (`getPlayer` / `getMultiplayerScore` / `rankFromGames`) and follows devanture's `drawPlayerProfile` layout: name; a `(±N)` cumulative-score / `win%` / total-games / `#RANK` line; a "since `<firstPlay>`" date; and a recent-games table with `↑+N`/`↓-N` deltas (pastel-blue wins / burgundy losses), `YOU(score)`, the `P - O` result, opponent(score), and a date (`HH:MM` if <24h else `YY/MM/DD`). The score polyline chart is deferred (a later polish).

- **Wiring:** `GameScreen` gets a `profileNick` state + `profileNickFor(slot)` (online → `matchData.players[slot]`; local/AI → the human's nick for P1; the AI/local-2P second seat → `null`, so its name isn't clickable). `PlayerTag` names become clickable (dotted underline) when a profile nick exists.
- **Modal layering:** the overlay is `z-index: 100` so it sits above `BuildInfo`'s permanent `z-50` info icon (which otherwise pokes through the veil). Closes via backdrop click or the `×`; `data-testid="stats-overlay"` backs the verifier.
- **Verified (Playwright):** seeded a Firebase profile → opened the overlay and read back the exact line (`(+3) 59% 87 games #NOVICE since 2025-09-01`) + 5 correctly-formatted rows; close via backdrop and `×` both work; 0 console errors. 86 unit tests green. Seeded test profile deleted afterward.
- **8.5c-3 (done):** the profile now includes a **score-over-time polyline** — a responsive SVG (`ScoreChart` in `StatsScreen.jsx`) ported from devanture's `drawScorePolyline`: X = the `scoreHistory` date span, Y auto-scaled to the data with the zero baseline shown (dashed), drawn in the nick's gold accent. Renders only with ≥2 history points. Verified (Playwright): an 8-point history rendered an 8-vertex polyline; 0 errors.

### Phase 8.5c-2 — GMMN screen identity + menu merge (done)

The menu and lobby now share the canvas board's look: the **fond photo backdrop + a dark veil + the nortechico pixel font**, with the **per-nick palette tinting the accents** (the "GMMN aesthetic + nick accent" choice). The 3 per-nick palettes and the rainbow easter egg (`RainbowDecorations` for nick `simon`) are **kept**.

- **`app/src/ui/gmmn.js`** — shared primitives: `ensureNortechico()` (idempotent `@font-face` registration), `GMMN_FOND` (the bundled `fond2.jpg`), `NORTECHICO` family string, and style helpers `gmmnTitle`/`gmmnDivider`/`gmmnButton`/`gmmnButtonSmall`/`gmmnInput` (all take the nick `theme` so accents stay per-nick; `gmmnTitle` keeps the rainbow gradient for `simon`).
- **`components/GmmnScreen.jsx`** — the shell: full-screen fond backdrop + `rgba(0,0,0,0.62)` veil + centred content; registers the font on mount.
- **Menu + ModeSelect merged** — `MenuScreen` now does nickname **and** mode selection in one GMMN screen; `onStart(nick, mode)` goes straight to the game (local/ai) or lobby (online). `ModeSelectScreen.jsx` deleted; `App.jsx`'s `modeSelect` screen state + `handleSelectMode` removed; `handleBack` returns to `menu`.
- **`LobbyScreen`** restyled on the shell as a GMMN "room" (board-outline frame over the real Firebase lobby; functionality unchanged).
- **Verified (Playwright):** menu renders the fond + nortechico title + 3 mode buttons; the merged flow reaches the lobby (Online) and the game (vs Computer); lobby shows the framed room; 0 console errors; 86 unit tests green; build clean.
- **Note:** `CanvasBoard` still registers the font inline (its verified mount left untouched); both paths use the same `nortechico` family. `GameScreen`'s own surround keeps the solid theme background for now (the board draws its own fond) — giving the in-game surround the fond too is a later polish.

### Phase 8.5d-1 — Doubling cube (done)

The doubling cube is now live, wiring the pure `game/cube.js` reducer (built in 8.1, until now unused) into the React game. It ports devanture's **R7 variant: 1 → 2 → 4, each player may double at most once, cube capped at 4.**

- **State lives in the synced `GameState`.** `newGameState()` now seeds `cube: newCube()` (`{value, owner, promised, used:{white,black}}`) and `cubeModal: null`. Because the online path already round-trips the whole state object, the cube and the in-flight offer/accept handshake sync for free. `GameScreen` normalizes both fields (`rawGs.cube || newCube()`) so pre-cube matches and reconnects don't crash.
- **Colour bridge.** The engine speaks players `1`/`2`; the reducer speaks `'white'`/`'black'`. New `cube.js` helpers `colorOf(player)` / `playerOf(color)` cross that boundary, plus `nextCubeValue(cube)` for the modals.
- **Flow (restricted to the doubler's own roll phase).** You may double only at the start of your own turn, before rolling — which also means a client only ever writes the shared cube state during *its own* turn, sidestepping the racy whole-object Firebase write. Clicking the cube raises a self-confirm **offer** modal (`promiseDouble` + `cubeModal {type:'offer'}`); confirming hands the opponent an **accept** modal (`{type:'accept', offerer}`); **accept** → `acceptDouble` (value ×2 capped, ownership → accepter, offerer's double spent) and the offerer rolls on; **decline** → `declineDouble`, the game ends immediately with the offerer winning and `endReason:'decline'`.
- **AI decision.** vs-AI, an offered double is auto-resolved by an effect that reads the live state via `gsRef` and calls `evaluate(gs,P2) − evaluate(gs,P1)` → `shouldAcceptDouble` (threshold −25). The AI never *initiates* a double (matches devanture).
- **Per-client modal gating.** `iControl(color)` decides who sees which modal: online → only your `playerSlot`; vs-AI → white (human) only, black is auto; local hot-seat → both. The non-deciding online client shows a "Waiting for opponent…" veil.
- **Scoring multiplier (the bit 8.5b deferred).** `game/gameResult.js` now computes `winPoints(winType) × cube.value`, where `winType` is `classifyWin(...)` normally but **forced to `'simple'` when `endReason === 'decline'`** (a refused double is always a single at the pre-double value, irrespective of the board). Falls back to ×1 when no cube is present.
- **UI.** A GMMN `CubeControl` (a `×N` square that glows + is clickable only when you may double, edge-tinted by the owner's checker colour) sits in the controls row; the offer/accept/waiting modals are dark-veil cards matching `StatsScreen`. The roll button is suppressed while a `cubeModal` is open.
- **DEV hooks.** `window.__gs` gained `cube()`, `cubeModal()`, `offerDouble()`, `respondOffer(yes)`, `respondAccept(yes)`, and a `rollPhase(player)` test affordance (alongside `forceWin`) so the verifier can reach the handshake deterministically without canvas-drag plumbing.
- **Verified (Playwright, live):** vs-AI handshake → AI auto-accept → cube ×2 + ownership to black + one-double-per-player lockout; the ×2 multiplier **actually recorded to Firebase** (`recentGames[0].delta == 2` on a simple win); local hot-seat **decline** → offerer wins at the pre-double value with `endReason` set; online **two-client** sync + per-client gating (offerer sees the offer modal, opponent sees "waiting", then the accept modal). 0 console errors throughout; **92 unit tests** (+6: cube helpers, cube/decline scoring); production build clean.

### Phase 8.5d-2 — Timers + forfeit (done)

A chess-clock: each turn gets a **15s move allowance** (`MOVE_ALLOWANCE`); time spent beyond that drains the player's **119s game bank** (`GAME_BANK`, both in `game/logic.js`); an empty bank **forfeits** — the opponent wins a simple game × the cube value. The design was **adversarially reviewed** before implementation (a 3-lens design-review workflow — online-race / time-accounting / forfeit-endgame — synthesised into a corrected spec). The review confirmed the concurrency model is sound (only the on-turn client writes turn-advancing state; turns are mutually exclusive) and rejected the heavier proposals (Firebase transactions, server timestamps, Cloud-Function forfeit) as solving non-existent races / out of scope.

- **`hooks/useGameTimers.js`** — owns the clock. **Decoupled local measurement:** each device measures its own turn elapsed from a `turnObservedAt` ref (no shared wall-clock, no server time; cross-client drift is bounded by subscription lag and accepted). Returns `{ moveRemaining, gameRemaining, expired, foldClock(gs, me), reset() }` and re-renders at 1 Hz only while this device owns the live clock.
- **Banks in the synced state.** `newGameState()` seeds `clock: { game: { 1: 119, 2: 119 } }`; `GameScreen` normalizes it (reconnect / pre-clock matches). The banks therefore sync over the existing whole-object write.
- **Single authoritative writer = the on-turn client.** It alone (a) **folds** its drained bank into the *same* `newGs` that flips the turn — `foldClock(newGs, me)` at every turn-end site (`finishMove`, `executeMove`, the `handleRoll` pass branch, the AI turn-end / no-move branches), keeping clock + turn atomic; and (b) **commits the forfeit** via an effect guarded by `expired && !winner && !endReason && phase∈{roll,move}`. The off-turn client never writes the clock and shows the **static synced bank** (no live opponent countdown) — eliminating the "cosmetic countdown lies / false forfeit on the peer" class.
- **Pause.** The clock runs **only in `roll`+`move`**; `opening`, `pass`, `done`, the cube handshake (`cubeModal`) and animations (`isAnimatingRef`) are paused via one combined boolean, accumulated through a `pauseStartedAt`/`pausedAccum` pair so paused time never counts (and never jumps when a modal closes).
- **UI.** Each `PlayerTag` shows a `⏱M:SS` bank; the on-turn player additionally shows a live `15→0`s move timer (red ≤5s; the bank turns red ≤30s). Hidden during the opening.
- **Scoring.** `gameResult.gameEndResult` maps `endReason==='forfeit'` (like `'decline'`) to a **simple win × cube value**.
- **DEV hooks.** `window.__gs` gained `clock()` and `ageClock(secs)` (backdates the turn baseline so the verifier drives the bank to expiry without waiting real seconds).
- **Accepted v1 limitation.** If the on-turn player **disconnects**, no forfeit fires (their clock freezes; the game stalls until they return) — auto-forfeiting a vanished player needs a server trigger, which is out of scope.
- **Verified (Playwright, live):** on-turn live move timer vs off-turn static bank; the move timer counts down; **forfeit on bank-drain** → opponent wins + `endReason:'forfeit'` + bank folded to 0 + recorded to Firebase (vs-AI loss −1; online both clients ±1); the clock **freezes during a cube modal** (14s→14s over 2.6s) then **resumes** on close; the online forfeit **propagates** to the off-turn client. 0 console errors; **94 unit tests** (+2: forfeit scoring); build clean.

---

## Devanture Skin (p5.js standalone preview)

A self-contained skin preview lives in `devanture/`. It runs without Vite/React (just `index.html` + p5.js from a CDN) and is intended as a visual prototype to be merged back into the React app once stable. A small Python dev server (`serve.py`) serves it with `Cache-Control: no-store` to avoid stale assets during iteration. **Note:** per Phase 8 (`feat/unify-game`) this standalone is being absorbed into the React app and will be removed once the canvas reaches parity.

### Run locally

The dev container serves it via Vite alongside the React app:

```
http://localhost:5173/lumpzammon/devanture/
```

`docker-compose.yml` bind-mounts `./devanture` into `/app/public/devanture`, and a small middleware in `vite.config.js` rewrites the bare directory request to `index.html`.

Standalone alternative (no Vite, with no-cache headers — useful when iterating without HMR noise):

```bash
python serve.py 3132 devanture
# Open http://localhost:3132
```

The launch config is in `.claude/launch.json` (gitignored) for the Claude Code preview.

### Public URL

Also deployed to GitHub Pages at https://jpep.github.io/lumpzammon/devanture/ — the deploy workflow copies `devanture/` into `app/dist/` after the Vite build so it sits alongside the React app under the same Pages site.

### File layout

```
devanture/
├── index.html                  # script loader (p5 CDN + local modules)
├── sketch.js                   # main p5 sketch: rendering + input + UI states
├── adapter.js                  # bridge between Logic state and rendered mockState
├── dice.js                     # dice animation + fade states
├── mockState.js                # static scenarios for visual tests ([1]-[4])
├── game/
│   ├── logic_standalone.js     # plain-JS port of src/game/logic.js
│   └── ai_standalone.js        # placeholder AI (not used yet)
├── fonts/                      # nortechico OTF (heading + small)
├── fond.jpg / fond0…fond6.jpg  # background pool, randomised per match
├── firebase.js                 # init + signInAnonymously + getPlayer/appendGame helpers
├── firebase-config.js          # FIREBASE_CONFIG (committed, web API key is public)
├── firebase-config.example.js  # template for replicating the skin elsewhere
└── serve.py                    # dev server with no-cache headers (one level up)
```

### Firebase wiring (Phase 7.5 — in progress)

> **⚠️ Superseded by Phase 8 (2026-06-07):** the unified app consolidates on the **`lumpzammon`** project and re-implements `/players` stats as `storage/playerStats.js` (modular SDK, env config). The `gmmn-afd53` wiring described below is interim, standalone-only infrastructure and is removed when `devanture/` is deleted.

The skin uses Firebase Realtime Database (project `gmmn-afd53`, region `europe-west1`) for player stats. Because the skin is served as static files (no Vite/Webpack build step), Firebase is loaded via compat CDN scripts and the config is committed directly in `devanture/firebase-config.js` (Firebase web API keys are public by design — the React app's prod bundle exposes them too, and real security lives in Database Rules + Auth).

Anonymous Auth is enabled at startup; the resulting UID is a stable per-browser identity. The schema lives under `/players/<sanitized_nick>` :

```
/players/<nick>
  firstPlay:    ISO timestamp
  totalGames:   number
  wins:         number
  winPercent:   number (0..1)
  recentGames:  [ { youScore, oppScore, opponent, delta, playedAt }, … ]   # capped at 50
  scoreHistory: [ { date: YYYY-MM-DD, score: cumulative }, … ]
```

API exposed on `window.Devanture.firebase`:
- `init()` — call once at boot (idempotent)
- `getPlayer(nick)` — read profile or `null`
- `ensurePlayer(nick)` — read profile, create empty one if missing
- `appendGame(nick, gameResult)` — atomic-ish update on game end

For local dev, `localhost` is whitelisted by Firebase Auth out of the box. For the GitHub Pages deploy at `https://jpep.github.io/lumpzammon/devanture/`, the domain `jpep.github.io` must be added to Firebase Auth → Settings → Authorized domains.

#### Firebase Console setup (status — verified 2026-06-07)

Checked against the live project config (`gmmn-afd53`):

- [x] Realtime Database created (`gmmn-afd53`, europe-west1)
- [x] Anonymous Auth provider enabled
- [x] **Authorized domains** already include `jpep.github.io` (alongside `localhost`, `gmmn-afd53.firebaseapp.com`, `gmmn-afd53.web.app`). Prod anon auth was verified live: `signInAnonymously()` returns a uid from `https://jpep.github.io/lumpzammon/devanture/`.

> **When do Authorized domains actually matter?** This list only gates OAuth
> redirect/popup providers (Google, etc.) and email-link (passwordless)
> sign-in — flows that bounce through `authDomain`. Per Firebase's documented
> behaviour it does **not** affect `signInAnonymously()` or plain
> email/password sign-in, which call the Identity Toolkit REST API directly
> regardless of origin. So no domain entry is required for the current
> anonymous path (and `jpep.github.io` is present anyway). Only revisit this if
> Phase 8 adds an OAuth provider or email-link sign-in.
>
> You can read the current list with the public web API key (no auth):
> `curl "https://identitytoolkit.googleapis.com/v1/projects?key=<apiKey>"`.

### Keyboard

| Key | Action |
|-----|--------|
| `1`-`4` | Load a static scenario from `mockState.js` |
| `5` | Start a new game (real Logic, doubling cube enabled) |
| `b` | Bar-entry test scenario |
| `m` | Start a new **match**: random background + flips `mirrorMode` |

### Game UI features

- **Doubling cube** (`❶ ❷ ❹`) — per-player marker on the same line as the timer (just before the resign flag). **Variant rule: each player can only double once per game.** The cube indicator never blinks; it shows the current shared value at full opacity if the player hasn't used their double yet, at 50 % opacity once they have. Click to promise a double for next turn; an "Offer double?" modal opens at the start of that turn (YES/NO), then an "Accept?" modal on the opponent side (✓/⚐). Refusing gives the offerer the cube value as a simple win. Each click on the cube (initial **or** subsequent reminder) resets the "YOU WILL BE ABLE TO DOUBLE BEFORE YOU ROLL." notice timer.
- **Move + game timers** — `(15)` move timer (resets each turn) and `(M:SS)` game timer (per-player, only ticks for the active player). The active timer is at full opacity, the other at 50%. When the move timer hits 0 the game timer takes over; when the game timer hits 0 the player forfeits.
- **Resign flag** — `⚐ → ⚑` on the same line as the timer, just after `(M:SS)`. **Single click** opens the resign confirmation modal directly; the flag stays full (`⚑`) while the modal is up. Resign always counts as a simple loss × `cubeValue`. The flag stays pinned to the resigner after game over.
- **Game-over overlay** — black veil + `GAME OVER`, winner name, win type (`SIMPLE / GAMMON / BACKGAMMON / RESIGN`), and points added (`× cubeValue`). Lines are evenly spaced (`2.7r` between centres) so the overlay reads cleanly even on small screens. Press `5` for a new game (score persists across the match).
- **Session score** — `(N)` after the player name = games won this match. Multiplayer score is shown in superscript `⁽elo⁾` (placeholder = 0 until wired to Firebase).
- **Player profile overlay** — click a player's **name** to open a profile overlay (everything outside the board darkens, board frame stays). Shows: name (large), `(±N)` cumulative multiplayer score + `XX% 🥧 totalGames 📊 #RANK` line, `since YYYY-MM-DD`, a smoothed score-vs-time polyline (Y from 0 to 1000, X from `firstPlay` to today, no axes), then a recent-games table with five columns: `↑+N` (delta colored, blue-pastel/burgundy-petrol) | `YOU(N)` (with the score in superscript at ×1.5) | `P − O` (game result, monospaced; winner is rendered in `nortechico-80` weight, no colour) | `OPPONENT(N)` (opponent name + score in superscript) | date `AA/MM/JJ` (or `HH:MM` if the game is < 24h old). The table scrolls vertically (mousewheel/trackpad on desktop, touch swipe on mobile) and is clipped to the area between the chart and the SIGN OUT button. Hover/touch on the chart shows a `(score) AAAA/MM/DD` tooltip placed just above the curve at the hovered point (offset to the right or left depending on space). On mobile the touch mode is locked at touch-start: graphic-zone touches drive the tooltip, table-zone touches drive the scroll — never both at once. Click anywhere or the EXIT button to close. Mock data lives in `PLAYER_PROFILES` in `adapter.js` (with `recentGames` including `playedAt` ISO timestamps and `oppScore`, plus a `scoreHistory` array for the chart). Ranks (7-tier ASCII-friendly): `ROOKIE` ≤ 50, `NOVICE` ≤ 150, `AMATEUR` ≤ 400, `SKILLED` ≤ 1000, `ADVANCED` ≤ 2500, `EXPERT` ≤ 5000, `MASTER` 5001+ (computed in `rankFromGames`).
- **`nortechico` user theme** — when the signed-in nickname is `NORTECHICO`, every checker on the board (white *and* black) gets a translucent chakana glyph etched on it (U+F8FF in the nortechico font). The glyph's tint is the underlying triangle/bar colour at 20 % opacity for white pieces (lets you "see" 20 % of the board through the symbol), and an inverted light tint at 20 % opacity for black pieces (so the symbol stays visible on dark pieces). The mark is preserved during drag (it follows the piece) and is suppressed on stacks that show a `+N` overflow label.
- **Multi-pickup for doubles** — clicking a piece below the top of a stack picks up that piece + all the ones above. With doubles, each piece can use multiple dice (`k = floor(diceLeft / N)`), so a `1-1` lets you move 2 pieces from `5` directly to `3`.
- **Auto-pass with empty dice** — when the current player has no legal moves, the dice are shown as empty frames at 25% opacity for 1.2s, then the turn passes automatically.
- **Exit to room** — `→ ⁰ → → ⁰` (right arrow + door, both glyphs from `nortechico-100`, door scaled to ~82.5% and bottom-aligned). Single button anchored at the canvas bottom: **centred** in portrait, **bottom-right** at `r/2` from edges in landscape. Visible during play, in the lobby and during game-over. Click closes the profile overlay if open, opens `Quit current game?` during play, or goes straight to room after game over.
- **Room (lobby)** — black veil with the board outline as a frame, mocked player list with status (available/busy/offline). Clicking an available player opens a `Waiting for X` modal that auto-accepts after 1.5s and starts a fresh game. The EXIT button is also visible here (returns to game state). To be wired to the real Firebase lobby on integration.
- **Random background per match** — pressing `m` (or auto-accepted invitation) tires a new background from `fond.jpg / fond0…fond6.jpg`, re-extracts the dominant hue and rebuilds the palette. `mirrorMode` toggles for each new match (visual flag for now; full mirroring will use the real `getBoardIndices(dir)` from `src/game/logic.js` once integrated).

### Geometry

**Landscape**: the board is centred horizontally in the window. Side margins are `max(3.5a, NAMES_W_A)` (currently `NAMES_W_A = 7`) so the right-hand info column always has room for the longest hovered label. Vertical margins reserve `~1.2a` for the point numbers (rendered with the updated `nortechico-60`).

**Portrait**: the full content stack (top dice + board + bottom dice/text + bottom EXIT) is **vertically centred** in the window so the empty space above black equals the empty space below white. Player info block (name + PIP line) is sized to exactly `dieSize = 3.5r` so its top and bottom edges align with the dice. The "double promise" notice is positioned **between** the bottom of the white player block and the top of the EXIT button to avoid any overlap.

**Fonts**: the `PIX-260426` family (`nortechico-20/40/60/80/100/140/200`) is used for all in-game typography. Pictograms that exist in `nortechico-100` (right arrow `→`, door `⁰`) are drawn in that font; pictograms that don't (flag `⚐⚑`, doubling-cube ❶❷❹, accept `✓`, player dot `⬤`, superscript parens `⁽⁾`) fall back to Arial.

### Multiplayer hook

`getMultiplayerScore(player)` is referenced from `drawNameLeft` but not implemented yet — when wired, it should return the player's ELO from Firebase. The `LOCAL_PLAYER` constant (default `'white'`) controls which side shows the resign flag and exit button; this will become dynamic per session on integration.

### Sign-in (nickname)

A minimal sign-in step gates the skin on first launch:

- `appState = 'signin'` is entered when no nickname is found in `localStorage`.
- The key is `'bg:nick'` — **the same key used by jpep's `MenuScreen` / `saveNick()` / `loadNick()`** (`app/src/storage/local.js`). On integration the user won't need to re-enter their nickname.
- The overlay shows the board frame with `CHOOSE YOUR NICKNAME` and an HTML `<input>` overlay (so the native mobile keyboard appears). Submission via `Enter`, click anywhere or tap the `[ENTER] OR TAP HERE` hint.
- Submitted value is uppercased, trimmed, length-capped at 16, written to `localStorage`, and propagated everywhere via `applyUserNick(nick)`:
  - `mockState.players.white = nick`
  - `mockState.players.black = aiMode ? 'COMPUTER' : 'OPPONENT'`
  - `PLAYER_PROFILES.white.name = nick`
- **No identity verification yet** — uniqueness of the nickname (so each player has consistent stats) is by convention only. When wired to Firebase this should become a server-side check before `saveNick()`.
- **Sign out** — the local player's profile overlay (click on your own name) shows a `[ SIGN OUT ]` button centred at the bottom of the board frame. Tapping it removes `localStorage['bg:nick']`, clears `userNick`, and switches back to the sign-in overlay so a new nickname can be entered.
