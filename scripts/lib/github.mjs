/**
 * GitHub → data/github.snapshot.json (section 11C step 1-2).
 *
 * REST for repos, languages, README and .portfolio.json; GraphQL (token only)
 * for pinned repos, custom social preview images and the contribution graph.
 * Repos whose pushed_at hasn't changed reuse the previous snapshot, so a daily
 * sync costs a handful of requests.
 */
import { PortfolioRepoOverrides, GithubSnapshot } from '../../src/data/schemas/github.js';
import { formatZodError } from '../../src/data/validate.js';

const API = 'https://api.github.com';

export class GithubError extends Error {}

function client(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portfolio-sync',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let calls = 0;
  let remaining = null;

  async function request(path, { raw = false, allow404 = false } = {}) {
    calls++;
    const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
      headers: raw ? { ...headers, Accept: 'application/vnd.github.raw' } : headers,
    });
    remaining = res.headers.get('x-ratelimit-remaining') ?? remaining;
    if (res.status === 404 && allow404) return null;
    if (res.status === 403 || res.status === 429) {
      const reset = res.headers.get('x-ratelimit-reset');
      throw new GithubError(
        remaining === '0'
          ? `GitHub rate limit reached${reset ? `; resets at ${new Date(Number(reset) * 1000).toISOString()}` : ''}${token ? '' : ' (set GITHUB_TOKEN for 5000 requests/hour)'}`
          : `GitHub refused ${path} (HTTP ${res.status})`,
      );
    }
    if (!res.ok) throw new GithubError(`GitHub ${path} failed: HTTP ${res.status}`);
    return raw ? res.text() : res.json();
  }

  async function graphql(query, variables) {
    if (!token) return null;
    calls++;
    const res = await fetch(`${API}/graphql`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.errors?.length) throw new GithubError(`GitHub GraphQL failed: ${json.errors?.map((e) => e.message).join('; ') ?? `HTTP ${res.status}`}`);
    return json.data;
  }

  return { request, graphql, stats: () => ({ calls, remaining }) };
}

/** First real prose paragraph of a README (skips headings, badges, images, HTML, code, lists, nav rows). */
export function readmeExcerpt(markdown, maxChars = 400) {
  if (!markdown) return null;
  const paragraphs = markdown
    .replace(/\r/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n/);
  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p || /^(#|!\[|\[!\[|<|\||---|>\s*\[!|[-*+]\s|\d+\.\s)/.test(p)) continue;
    const text = p
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>?/g, ' ')
      .replace(/[*_`>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 40 || (text.match(/[•|]/g) ?? []).length >= 2) continue;
    return text.length > maxChars ? `${text.slice(0, maxChars - 1).replace(/\s+\S*$/, '')}…` : text;
  }
  return null;
}

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const GRAPH_QUERY = `query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { nameWithOwner } } }
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes { nameWithOwner openGraphImageUrl usesCustomOpenGraphImage }
    }
    contributionsCollection {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
    }
  }
}`;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

/**
 * @param {{ user: string, token?: string, config: object, previous?: object|null, log?: (msg: string) => void }} opts
 */
export async function fetchGithubSnapshot({ user, token, config, previous = null, log = () => {} }) {
  const gh = client(token);
  const prevByName = new Map((previous?.repos ?? []).map((r) => [r.fullName, r]));

  const profile = await gh.request(`/users/${encodeURIComponent(user)}`);
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh.request(`/users/${encodeURIComponent(user)}/repos?per_page=100&type=owner&sort=pushed&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  let graph = null;
  try {
    graph = await gh.graphql(GRAPH_QUERY, { login: user });
  } catch (err) {
    log(`⚠ ${err.message} (pinned repos, social images and contributions skipped)`);
  }
  const pinned = new Set(graph?.user?.pinnedItems?.nodes?.map((n) => n.nameWithOwner) ?? []);
  const social = new Map((graph?.user?.repositories?.nodes ?? []).filter((n) => n.usesCustomOpenGraphImage).map((n) => [n.nameWithOwner, n.openGraphImageUrl]));

  let reused = 0;
  const out = await mapLimit(repos, 4, async (r) => {
    const prev = prevByName.get(r.full_name);
    const base = {
      name: r.name,
      fullName: r.full_name,
      url: r.html_url,
      description: r.description,
      fork: r.fork,
      archived: r.archived,
      stars: r.stargazers_count,
      forks: r.forks_count,
      topics: r.topics ?? [],
      homepage: r.homepage || null,
      primaryLanguage: r.language,
      pushedAt: r.pushed_at,
      createdAt: r.created_at,
      socialImage: social.get(r.full_name) ?? (graph ? null : prev?.socialImage ?? null),
      pinned: graph ? pinned.has(r.full_name) : prev?.pinned ?? false,
    };
    // Unchanged since the last snapshot: keep the expensive per-repo data.
    if (prev && prev.pushedAt === r.pushed_at) {
      reused++;
      return { ...base, languages: prev.languages, readmeExcerpt: prev.readmeExcerpt, overrides: prev.overrides };
    }
    if (r.fork) return { ...base, languages: {}, readmeExcerpt: null, overrides: null };

    const [languages, readme, overridesRaw] = await Promise.all([
      gh.request(`/repos/${r.full_name}/languages`),
      gh.request(`/repos/${r.full_name}/readme`, { raw: true, allow404: true }),
      gh.request(`/repos/${r.full_name}/contents/.portfolio.json`, { raw: true, allow404: true }),
    ]);
    let overrides = null;
    if (overridesRaw) {
      try {
        const parsed = PortfolioRepoOverrides.safeParse(JSON.parse(overridesRaw));
        if (parsed.success) overrides = parsed.data;
        else log(`⚠ ${r.full_name}/.portfolio.json ignored:\n${formatZodError(parsed.error)}`);
      } catch {
        log(`⚠ ${r.full_name}/.portfolio.json is not valid JSON; ignored`);
      }
    }
    return { ...base, languages, readmeExcerpt: readmeExcerpt(readme, config.sync.readmeExcerptChars), overrides };
  });

  const calendar = graph?.user?.contributionsCollection?.contributionCalendar;
  const contributions = calendar
    ? {
        total: calendar.totalContributions,
        days: calendar.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0 }))),
      }
    : previous?.contributions ?? null;

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    user: {
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      url: profile.html_url,
      bio: profile.bio,
      publicRepos: profile.public_repos,
      followers: profile.followers,
    },
    repos: out,
    contributions,
  };
  const result = GithubSnapshot.safeParse(snapshot);
  if (!result.success) throw new GithubError(`GitHub snapshot failed validation:\n${formatZodError(result.error)}`);
  const { calls, remaining } = gh.stats();
  log(`GitHub: ${out.length} repos (${reused} unchanged, reused), ${calls} API calls${remaining != null ? `, ${remaining} left this hour` : ''}${graph ? '' : ', no GraphQL (no token)'}`);
  return result.data;
}

/** Same snapshot apart from fetch time? (Avoids committing a new file every day.) */
export const sameSnapshot = (a, b) => !!a && !!b && JSON.stringify({ ...a, fetchedAt: null }) === JSON.stringify({ ...b, fetchedAt: null });
