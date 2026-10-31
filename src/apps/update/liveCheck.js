/**
 * "Check for updates": one unauthenticated GitHub request, cached in
 * localStorage with its ETag. Conditional requests answered 304 don't count
 * against the 60 requests/hour limit, and within `cacheMinutes` no request is
 * made at all.
 */
import config from '@config';
import { isEligibleRepo } from '@/data/merge.js';
import { load, save } from '@/os/lib/storage.js';

const KEY = 'os.updateCheck';

async function fetchRepos(force) {
  const cached = load(KEY, null);
  const fresh = cached && Date.now() - cached.checkedAt < config.liveUpdateCheck.cacheMinutes * 60_000;
  if (cached && fresh && !force) return { repos: cached.repos, checkedAt: cached.checkedAt, source: 'cache', remaining: cached.remaining };

  const res = await fetch(`https://api.github.com/users/${config.owner.githubUser}/repos?per_page=100&type=owner&sort=pushed`, {
    headers: { Accept: 'application/vnd.github+json', ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}) },
  });
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (res.status === 304 && cached) {
    const next = { ...cached, checkedAt: Date.now(), remaining: remaining ?? cached.remaining };
    save(KEY, next);
    return { repos: cached.repos, checkedAt: next.checkedAt, source: 'not-modified', remaining: next.remaining };
  }
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const when = reset ? new Date(Number(reset) * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'later';
    throw new Error(`GitHub's hourly limit for this network is used up. Try again after ${when}.`);
  }
  if (!res.ok) throw new Error(`GitHub answered HTTP ${res.status}.`);
  const repos = (await res.json()).map((r) => ({
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    description: r.description,
    fork: r.fork,
    archived: r.archived,
    topics: r.topics ?? [],
    pushedAt: r.pushed_at,
    size: r.size,
  }));
  const entry = { etag: res.headers.get('etag'), repos, checkedAt: Date.now(), remaining };
  save(KEY, entry);
  return { repos, checkedAt: entry.checkedAt, source: 'network', remaining };
}

/**
 * Compare GitHub right now with what the last build knows.
 * @returns {Promise<{ newRepos: object[], updatedRepos: object[], checkedAt: number, source: string, remaining: string|null }>}
 */
export async function checkForUpdates(portfolio, { force = false } = {}) {
  const { repos, ...meta } = await fetchRepos(force);
  const known = new Set(portfolio.github?.knownRepos ?? []);
  const builtAt = portfolio.meta.sources.github.at ?? portfolio.meta.generatedAt;
  const login = config.owner.githubUser;
  const newRepos = repos.filter(
    (r) => !known.has(r.fullName) && isEligibleRepo({ ...r, languages: r.size > 0 ? { any: 1 } : {}, readmeExcerpt: null, overrides: null }, login, config.sync),
  );
  const updatedRepos = repos.filter((r) => known.has(r.fullName) && !r.fork && r.pushedAt > builtAt);
  return { newRepos, updatedRepos, ...meta };
}
