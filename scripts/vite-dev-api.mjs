/**
 * Serves the /api serverless functions inside `npm run dev`, so Dev Mode works
 * locally without the Vercel CLI. Env vars come from .env.local (never bundled
 * into the client: none of them use the VITE_ prefix).
 *
 * Without GITHUB_WRITE_TOKEN, "Publish" writes straight into this working tree
 * (DEVMODE_LOCAL_WRITE=1), which you then commit yourself.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

export default function devApi() {
  return {
    name: 'portfolio-dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
      if (!process.env.GITHUB_WRITE_TOKEN) process.env.DEVMODE_LOCAL_WRITE ??= '1';
      // Browsers don't all keep Secure cookies on plain http://localhost.
      if (!server.config.server.https) process.env.DEVMODE_INSECURE_COOKIE ??= '1';

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        const rel = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
        if (!/^api\/[a-z0-9/_-]+$/.test(rel) || rel.split('/').some((s) => s.startsWith('_'))) return next();
        const file = resolve(server.config.root, `${rel}.js`);
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Not found' }));
        }
        try {
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[api] ${rel}: ${err.stack ?? err}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Server error' }));
          }
        }
      });
    },
  };
}
