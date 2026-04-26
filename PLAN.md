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

## Phase 8: Devanture Skin → React Integration (next PR)

The `devanture/` p5.js skin is a visual prototype that's now feature-complete enough to merge back into the React app. Each item below maps a skin feature to the React components/hooks that will need to be added or modified.

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
- [ ] **Exit-to-room flow** - `↪▯` button next to player info. Confirmation modal during game, direct on game-over.
- [ ] **Lobby UI** - Replace skin's mocked player list with the real Firebase lobby. Click → invite → opponent accept/decline → start game.

---

## How to Use This Plan

When starting a session with Claude Code:

1. Pick a phase or specific task from the checklist
2. Say something like: *"Let's work on Phase 2 - responsive layout"*
3. Mark completed tasks with `[x]` as you go
4. Add new tasks or phases as the project evolves

The plan is a living document. Update it as priorities shift.
