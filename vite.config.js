import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import devApi from './scripts/vite-dev-api.mjs';

/** dist/deploy.json: which commit is live, so Dev Mode can tell when a publish has deployed. */
function deployInfo() {
  return {
    name: 'portfolio-deploy-info',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'deploy.json',
        source: JSON.stringify({ sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null, builtAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi(), deployInfo()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
      '@config': fileURLToPath(new URL('./portfolio.config.js', import.meta.url)),
    },
  },
  server: {
    // Files Dev Mode writes locally shouldn't trigger a full reload mid-publish.
    watch: { ignored: ['**/.devmode-staging/**'] },
  },
});
