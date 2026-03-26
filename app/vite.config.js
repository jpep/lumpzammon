import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

function git(cmd) {
  try { return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim(); }
  catch { return 'unknown'; }
}

export default defineConfig({
  plugins: [react()],
  base: '/lumpzammon/',
  define: {
    __BUILD_COMMIT__: JSON.stringify(git('rev-parse --short HEAD')),
    __BUILD_MESSAGE__: JSON.stringify(git('log -1 --format=%s')),
    __BUILD_AUTHOR__: JSON.stringify(git('log -1 --format=%an')),
    __BUILD_DATE__: JSON.stringify(git('log -1 --format=%ci')),
  },
});
