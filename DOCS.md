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

Online matches persist in Firebase across browser sessions. The local storage layer (`src/storage/local.js`) saves the player's nickname and active match session (matchId + playerSlot) to `localStorage`.

**How it works:**

1. When a player creates or joins a match, the session is saved to `localStorage`
2. The nickname is also saved, so the menu screen pre-fills it on return
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
- `getValidMoves(state, player)` - Computes all legal moves considering bar, bearing off, etc.
- `applyMove(state, player, move)` - Returns new immutable state after a move
- `checkWin(state)` - Checks if either player has borne off all 15 checkers

### AI

`src/game/ai.js` implements a greedy evaluation AI:

- Scores board positions based on: borne-off pieces, bar pieces, blots, coverage, pip distance
- Picks the highest-scoring move at each step (no lookahead)
- Plays all available dice sequentially
- Moves are applied one at a time with 750ms delays between each, so the player can follow each individual stone movement. The AI auto-rolls after 800ms.

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

The theme is selected automatically based on the player's nickname (case-insensitive, exact match). The `getTheme(nick)` function in `theme.js` handles the mapping. All components consume the theme via the `useTheme()` hook from `ThemeContext.jsx`.

### Status Bar

Each player is shown with a rendered stone icon (white/black gradient) and their nickname. In online and AI modes, a green **(you!)** tag marks the local player. The active player's name highlights in yellow with an action label ("Roll dice" or "Move") inline towards the center.

## Development

### Running locally (Docker)

```bash
# Start dev server with hot reload on port 5173
docker compose --profile dev up dev

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

## Origin

This project was scaffolded from a conversation with Claude Desktop. The seed files in `claude_seed/` contain the original artifacts: project structure, storage layer design, Firebase setup guide, and game logic. The React components, screens, hooks, Docker setup, and App router were built from these blueprints.
