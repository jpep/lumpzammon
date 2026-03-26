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
- [ ] **Board aesthetics** - Wood textures, shadows, rounded triangles, point numbering
- [ ] **Checker animations** - Smooth CSS transitions for moves, bar hits, bearing off
- [ ] **Dice roll animation** - Tumble/spin before revealing values
- [ ] **Sound effects** - Dice roll, checker place, hit, bear off, win
- [x] **Turn indicator** - Player names with stone icons, (you!) tag, action label next to active player
- [ ] **Move history sidebar** - Scrollable log of moves in standard notation
- [ ] **Undo button** - Allow undoing partial moves within a turn (before ending turn)
- [ ] **Dark/light theme** - Toggle between wood tones

---

## Phase 3: Game Logic Enhancements

### Tasks

- [ ] **Doubling cube** - Implement the doubling cube with proper accept/decline flow
- [ ] **Match play** - Play to N points (not just single games), track scores
- [ ] **Crawford rule** - Disable doubling cube when one player is 1 point from winning
- [ ] **Gammon/backgammon detection** - Score 2x or 3x when opponent hasn't borne off / still has pieces in winner's home
- [ ] **Move validation edge cases** - Audit: must use both dice if possible, must use larger die if only one can be used
- [ ] **Auto-finish** - When a player has all checkers ahead of the opponent, auto bear-off option

---

## Phase 4: AI Improvements

The current AI is a single-step greedy evaluator. It works but is beatable.

### Tasks

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
- [ ] **Reconnection** - Detect disconnect and allow rejoining an in-progress match
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

## How to Use This Plan

When starting a session with Claude Code:

1. Pick a phase or specific task from the checklist
2. Say something like: *"Let's work on Phase 2 - responsive layout"*
3. Mark completed tasks with `[x]` as you go
4. Add new tasks or phases as the project evolves

The plan is a living document. Update it as priorities shift.
