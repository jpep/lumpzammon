import { defineConfig } from 'vitest/config';

// Standalone test config (takes precedence over vite.config.js so the dev-server
// React plugin + devanture middleware aren't loaded for the pure-logic suite).
// The game engine is plain JS with no DOM, so the default node environment is enough.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
