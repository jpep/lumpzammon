# CLAUDE.md

## Project

Lumpzammon — browser-based backgammon game (React + Vite, Firebase Realtime DB for online mode).

## Structure

- `app/` — Vite + React application
- `claude_seed/` — original seed files from Claude Desktop conversation
- `DOCS.md` — architecture and project documentation
- `PLAN.md` — implementation roadmap with task checklists

## Development

```bash
# Dev server (Docker, hot reload)
docker compose --profile dev up dev
# http://localhost:5173/lumpzammon/

# Manual deploy to GitHub Pages
gh workflow run deploy.yml
```

Firebase config is read from env vars (`VITE_FIREBASE_*`). Local dev uses `app/.env` (gitignored). GitHub Pages uses repo secrets.

## Rules

- **Every commit must include updates to DOCS.md and PLAN.md** reflecting what changed. Do not commit code-only changes without updating documentation and marking relevant plan tasks as complete.
- Keep commits focused and well-described.
- Do not hardcode secrets or API keys — use environment variables.
- Do not install npm packages directly on the host — use Docker.
