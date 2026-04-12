# Lumpzammon

Browser-based backgammon game built with React + Vite. Play locally, against an AI, or online via Firebase.

**Live:** https://jpep.github.io/lumpzammon/

## Quick Start

```bash
# Dev server (Docker, hot reload)
docker compose --profile dev up -d dev
# Open http://localhost:5173/lumpzammon/
```

## Game Modes

- **Local** - Two players, one screen
- **vs AI** - Play against the computer
- **Online** - Create/join matches via Firebase (requires config, see [firebase-setup](app/firebase-setup.md))

## Deploy

Auto-deploys to GitHub Pages on push to `main`. Manual trigger:

```bash
gh workflow run deploy.yml
```

## Docs

- [DOCS.md](DOCS.md) - Architecture, project structure, storage layer
- [PLAN.md](PLAN.md) - Implementation roadmap and next steps
