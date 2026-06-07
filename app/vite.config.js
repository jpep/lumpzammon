import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

function git(cmd) {
  try {
    // Capture stderr (instead of inheriting it) so the expected-failure noise
    // below doesn't reach the console.
    return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    // git missing (not installed in the dev container) or no repo (.git isn't
    // mounted there) is expected — fall back silently. Surface anything else so
    // real failures aren't hidden.
    const stderr = (err.stderr || '').toString();
    const expected = err.code === 'ENOENT' || /not found|not a git repository/i.test(stderr);
    if (!expected) console.warn(`[vite] git ${cmd} failed:`, stderr.trim() || err.message);
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'devanture-index',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/lumpzammon/devanture' || req.url === '/lumpzammon/devanture/') {
            req.url = '/lumpzammon/devanture/index.html';
          }
          next();
        });
      },
    },
  ],
  base: '/lumpzammon/',
  define: {
    __BUILD_COMMIT__: JSON.stringify(git('rev-parse --short HEAD')),
    __BUILD_MESSAGE__: JSON.stringify(git('log -1 --format=%s')),
    __BUILD_AUTHOR__: JSON.stringify(git('log -1 --format=%an')),
    __BUILD_DATE__: JSON.stringify(git('log -1 --format=%ci')),
  },
});
