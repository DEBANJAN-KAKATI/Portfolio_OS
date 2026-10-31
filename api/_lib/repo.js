/**
 * Where Dev Mode writes go.
 *  - github: the portfolio repo via the Git Data API (one commit, or a branch + PR),
 *            authenticated with GITHUB_WRITE_TOKEN (serverless env var only)
 *  - local:  `npm run dev` without a GitHub token writes straight into this
 *            working tree (never available on Vercel)
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import config from '../../portfolio.config.js';
import { HttpError } from './http.js';

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const isLocalMode = () => process.env.DEVMODE_LOCAL_WRITE === '1' && !process.env.VERCEL;

function repoInfo() {
  const [owner, name] = (process.env.PORTFOLIO_REPO || `${config.repo.owner}/${config.repo.name}`).split('/');
  return { owner, name, branch: process.env.PORTFOLIO_BRANCH || config.repo.branch };
}

// ------------------------------------------------------------------ GitHub
function githubRepo() {
  const token = process.env.GITHUB_WRITE_TOKEN;
  if (!token) throw new HttpError(503, 'Publishing is not configured (GITHUB_WRITE_TOKEN).');
  const { owner, name, branch } = repoInfo();
  const base = `https://api.github.com/repos/${owner}/${name}`;

  async function gh(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'portfolio-devmode',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404 && method === 'GET') return null;
    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(502, `GitHub ${method} ${path.split('?')[0]} failed (HTTP ${res.status}).`, { detail: text.slice(0, 300) });
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    mode: 'github',
    async readText(path, ref = branch) {
      const file = await gh('GET', `/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`);
      return file ? Buffer.from(file.content, 'base64').toString('utf8') : null;
    },
    async putBlob(bytes) {
      const blob = await gh('POST', '/git/blobs', { content: bytes.toString('base64'), encoding: 'base64' });
      return `sha:${blob.sha}`;
    },
    async commit({ texts, blobs, deletes, message, mode }) {
      const ref = await gh('GET', `/git/ref/heads/${branch}`);
      if (!ref) throw new HttpError(502, `Branch ${branch} not found in ${owner}/${name}.`);
      const parent = ref.object.sha;
      const parentCommit = await gh('GET', `/git/commits/${parent}`);
      const tree = [
        ...Object.entries(texts).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
        ...Object.entries(blobs).map(([path, refId]) => ({ path, mode: '100644', type: 'blob', sha: refId.replace(/^sha:/, '') })),
        ...deletes.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
      ];
      const newTree = await gh('POST', '/git/trees', { base_tree: parentCommit.tree.sha, tree });
      const commit = await gh('POST', '/git/commits', { message, tree: newTree.sha, parents: [parent] });
      if (mode === 'pr') {
        const head = `devmode/${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
        await gh('POST', '/git/refs', { ref: `refs/heads/${head}`, sha: commit.sha });
        const pr = await gh('POST', '/pulls', { title: message.split('\n')[0], head, base: branch, body: `${message}\n\nPublished from Dev Mode.` });
        return { sha: commit.sha, prUrl: pr.html_url, commitUrl: commit.html_url };
      }
      try {
        await gh('PATCH', `/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
      } catch (err) {
        throw new HttpError(409, 'The branch changed while publishing (maybe a sync just merged). Publish again.', { detail: err.extra?.detail });
      }
      return { sha: commit.sha, commitUrl: commit.html_url, prUrl: null };
    },
    async history(path) {
      const list = (await gh('GET', `/commits?path=${encodeURIComponent(path)}&sha=${branch}&per_page=20`)) ?? [];
      return list.map((c) => ({ sha: c.sha, date: c.commit.author.date, message: c.commit.message.split('\n')[0], author: c.commit.author.name, url: c.html_url }));
    },
    async readAt(path, sha) {
      return this.readText(path, sha);
    },
    async dispatchSync() {
      await gh('POST', '/actions/workflows/sync.yml/dispatches', { ref: branch });
    },
  };
}

// ------------------------------------------------------------------ local (dev)
const STAGING = resolve(ROOT, '.devmode-staging');

function inside(path) {
  const full = resolve(ROOT, path);
  if (!full.startsWith(ROOT + sep)) throw new HttpError(400, 'Path escapes the project.');
  return full;
}

function localRepo() {
  return {
    mode: 'local',
    async readText(path) {
      try {
        return await readFile(inside(path), 'utf8');
      } catch {
        return null;
      }
    },
    async putBlob(bytes) {
      const id = createHash('sha256').update(bytes).digest('hex');
      await mkdir(STAGING, { recursive: true });
      await writeFile(resolve(STAGING, id), bytes);
      return `local:${id}`;
    },
    async commit({ texts, blobs, deletes }) {
      for (const [path, content] of Object.entries(texts)) {
        await mkdir(dirname(inside(path)), { recursive: true });
        await writeFile(inside(path), content);
      }
      for (const [path, refId] of Object.entries(blobs)) {
        const id = refId.replace(/^local:/, '');
        if (!/^[a-f0-9]{64}$/.test(id)) throw new HttpError(400, 'Unknown upload reference.');
        await mkdir(dirname(inside(path)), { recursive: true });
        await copyFile(resolve(STAGING, id), inside(path));
      }
      for (const path of deletes) await rm(inside(path), { force: true });
      return { sha: null, commitUrl: null, prUrl: null, local: true };
    },
    async history(path) {
      try {
        const { stdout } = await run('git', ['log', '-n', '20', '--format=%H%x1f%aI%x1f%s%x1f%an', '--', path], { cwd: ROOT });
        return stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((l) => {
            const [sha, date, message, author] = l.split('\x1f');
            return { sha, date, message, author, url: null };
          });
      } catch {
        return [];
      }
    },
    async readAt(path, sha) {
      if (!/^[a-f0-9]{7,40}$/.test(sha)) throw new HttpError(400, 'Bad commit id.');
      try {
        const { stdout } = await run('git', ['show', `${sha}:${path}`], { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 });
        return stdout;
      } catch {
        return null;
      }
    },
    async dispatchSync() {
      throw new HttpError(400, 'Run `npm run sync` locally instead.');
    },
  };
}

export function getRepo() {
  return isLocalMode() ? localRepo() : githubRepo();
}
