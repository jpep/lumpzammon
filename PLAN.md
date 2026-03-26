# Backgammon Online - Implementation Plan

This document tracks the development roadmap. Each phase is designed to be worked on with Claude Code as a pair-programming session.

---

## Phase 1: Firebase Configuration (online mode)

Online mode is wired up but needs a real Firebase project. The storage layer auto-detects the environment — once the config is set, online play will just work.

### Steps

1. **Create Firebase project**
   - Go to [console.firebase.google.com](https://console.firebase.google.com)
   - Add project (e.g. `backgammon-online`), disable Analytics
   - Enable **Realtime Database** (Build > Realtime Database > Create Database)
   - Choose region, start in **test mode**

2. **Register a web app**
   - Project settings > Your apps > Web (`</>`)
   - Register with any nickname
   - Copy the `firebaseConfig` object

3. **Paste config into the app**
   - Open `app/src/storage/firebaseAdapter.js`
   - Replace the placeholder block:
     ```js
     const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT.firebaseapp.com",
       databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
       projectId: "YOUR_PROJECT",
       storageBucket: "YOUR_PROJECT.appspot.com",
       messagingSenderId: "000000000000",
       appId: "YOUR_APP_ID"
     };
     ```

4. **Set database rules** (for development)
   - Realtime Database > Rules:
     ```json
     { "rules": { ".read": true, ".write": true } }
     ```
   - This is open access — fine for prototyping, must be locked down later (see Phase 5)

5. **Test online mode**
   - Open two browser tabs at `http://localhost:5173/backgammon-online/`
   - Tab 1: enter nick, Online > Create Match
   - Tab 2: enter nick, Online > join the match
   - Verify moves sync between tabs

### Environment variable approach (optional improvement)
Instead of hardcoding the config, move it to a `.env` file:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```
Then read via `import.meta.env.VITE_FIREBASE_*` in `firebaseAdapter.js`.

---

## Phase 2: UI/UX Polish

The board and screens are functional but visually basic. This phase brings them up to quality.

### Tasks

- [ ] **Responsive layout** - Scale the board to fit mobile and tablet screens
- [ ] **Board aesthetics** - Wood textures, shadows, rounded triangles, point numbering
- [ ] **Checker animations** - Smooth CSS transitions for moves, bar hits, bearing off
- [ ] **Dice roll animation** - Tumble/spin before revealing values
- [ ] **Sound effects** - Dice roll, checker place, hit, bear off, win
- [ ] **Turn indicator** - Clear visual showing whose turn it is and what action is expected
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
