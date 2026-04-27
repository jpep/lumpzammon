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
- `getValidMoves(state, player)` - Computes all legal moves considering bar, bearing off, etc.
- `applyMove(state, player, move)` - Returns new immutable state after a move
- `checkWin(state)` - Checks if either player has borne off all 15 checkers

### AI

`src/game/ai.js` implements a greedy evaluation AI:

- Scores board positions based on: borne-off pieces, bar pieces, blots, coverage, pip distance
- Picks the highest-scoring move at each step (no lookahead)
- Plays all available dice sequentially
- Moves are applied one at a time with 750ms delays between each, so the player can follow each individual stone movement. The AI auto-rolls after 800ms.

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

## Devanture Skin (p5.js standalone preview)

A self-contained skin preview lives in `devanture/`. It runs without Vite/React (just `index.html` + p5.js from a CDN) and is intended as a visual prototype to be merged back into the React app once stable. A small Python dev server (`serve.py`) serves it with `Cache-Control: no-store` to avoid stale assets during iteration.

### Run locally

```bash
python serve.py 3132 devanture
# Open http://localhost:3132
```

The launch config is in `.claude/launch.json` (gitignored) for the Claude Code preview.

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
└── serve.py                    # dev server with no-cache headers (one level up)
```

### Keyboard

| Key | Action |
|-----|--------|
| `1`-`4` | Load a static scenario from `mockState.js` |
| `5` | Start a new game (real Logic, doubling cube enabled) |
| `b` | Bar-entry test scenario |
| `m` | Start a new **match**: random background + flips `mirrorMode` |

### Game UI features

- **Doubling cube** (`❶ ❷ ❹`) — per-player marker right of the name, pulses during own turn, click to promise a double for next turn. At the start of the next turn an "Offer double?" modal opens (YES/NO), then an "Accept?" modal on the opponent side (✓/⚐). Refusing gives the offerer the cube value as a simple win. Capped at ❹. Each click on the cube (initial **or** subsequent) resets the "YOU WILL BE ABLE TO DOUBLE BEFORE YOU ROLL." notice timer to remind the player to wait.
- **Move + game timers** — `(15)` move timer (resets each turn) and `(M:SS)` game timer (per-player, only ticks for the active player). The active timer is at full opacity, the other at 50%. When the move timer hits 0 the game timer takes over; when the game timer hits 0 the player forfeits.
- **Resign flag** — `⚐ → ⚑` on the same line as the timer, just after `(M:SS)`. **Single click** opens the resign confirmation modal directly; the flag stays full (`⚑`) while the modal is up. Resign always counts as a simple loss × `cubeValue`. The flag stays pinned to the resigner after game over.
- **Game-over overlay** — black veil + `GAME OVER`, winner name, win type (`SIMPLE / GAMMON / BACKGAMMON / RESIGN`), and points added (`× cubeValue`). Lines are evenly spaced (`2.7r` between centres) so the overlay reads cleanly even on small screens. Press `5` for a new game (score persists across the match).
- **Session score** — `(N)` after the player name = games won this match. Multiplayer score is shown in superscript `⁽elo⁾` (placeholder = 0 until wired to Firebase).
- **Player profile overlay** — click a player's **name** to open a profile overlay (everything outside the board darkens, board frame stays). Shows: name (large), `(±N)` cumulative multiplayer score + `XX% 🥧 totalGames 📊 #RANK` line, `since YYYY-MM-DD`, then a recent-games table with three columns (`YOU (score)` / `OPPONENT (rank)` / `↑+N` blue-pastel or `↓-N` burgundy-petrol). The cumulative score in parens is **derived from the recent-games table** via `getMultiplayerScore(player) = sum(recentGames.delta)` so it always matches what the user can see in the table; this same value is shown as the in-game superscript next to the player name. Click anywhere or the EXIT button to close. Mock data lives in `PLAYER_PROFILES` in `adapter.js`. Ranks (7-tier ASCII-friendly): `ROOKIE` ≤ 50, `NOVICE` ≤ 150, `AMATEUR` ≤ 400, `SKILLED` ≤ 1000, `ADVANCED` ≤ 2500, `EXPERT` ≤ 5000, `MASTER` 5001+ (computed in `rankFromGames`).
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
