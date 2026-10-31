/**
 * mergePortfolio(): vault + GitHub snapshot + Dev Mode inbox -> Portfolio.
 * Pure (no fs / network), shared by scripts/build-data.mjs, scripts/sync.mjs
 * and Dev Mode's live preview.
 *
 * Rules (section 11C):
 *  - match projects to repos by github_url, then by normalized repo name
 *  - the vault wins for text (title, bullets, tags, dates), GitHub wins for stats
 *  - new eligible repos become "draft" projects using only the repo description
 *    and README excerpt (never invented metrics)
 *  - data/vault.inbox.json is applied on top and marked "pending"
 */
import { parseVault, toPublicVault, normalizeVault, slugify } from './adapters/jstmyrb.js';
import { sanitizeInline } from './sanitize.js';
import { Portfolio } from './schemas/portfolio.js';
import { GithubSnapshot } from './schemas/github.js';
import { VaultInbox } from './schemas/vault.js';
import { validateOrThrow } from './validate.js';

export const normalizeRepoUrl = (url) =>
  String(url ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
    .replace(/^http:\/\//, 'https://')
    .replace('://www.', '://');

// "https://github.com/u/repo/tree/main/Sub_Project" -> "https://github.com/u/repo"
const repoRoot = (url) => normalizeRepoUrl(url).replace(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/(?:tree|blob)\/.*$/, '$1');
const isSubfolderUrl = (url) => repoRoot(url) !== normalizeRepoUrl(url);

export const normalizeName = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/^proj_gh_/, '')
    .replace(/[^a-z0-9]/g, '');

/** "Furo---TravelSwipe" -> "Furo — TravelSwipe", "advanced-rag-system" -> "Advanced Rag System" */
export function prettifyRepoName(name) {
  return name
    .split(/-{2,}/)
    .map((part) =>
      part
        .split(/[-_]+/)
        .filter(Boolean)
        .map((w) => (w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' '),
    )
    .join(' — ');
}

// Applies Dev Mode edits to the (public) raw vault so they normalize like everything else.
export function applyInbox(vault, inbox) {
  const next = structuredClone(vault);
  for (const entry of inbox.items) {
    if (entry.section === 'skills') {
      // skills is a { category: [skill] } map; data = { category, skills }
      if (entry.op === 'delete') delete next.skills[entry.id];
      else next.skills[entry.data.category ?? entry.id] = entry.data.skills ?? [];
      continue;
    }
    const list = next[entry.section] ?? (next[entry.section] = []);
    const idx = list.findIndex((it) => (it.id ?? slugify(it.title ?? it.institution)) === entry.id);
    if (entry.op === 'delete') {
      if (idx >= 0) list.splice(idx, 1);
    } else if (entry.op === 'edit' && idx >= 0) {
      list[idx] = { ...list[idx], ...entry.data, id: entry.id, __status: 'pending' };
    } else {
      // "add", or an "edit" whose vault item no longer exists
      list.push({ ...entry.data, id: entry.id, __status: 'pending', __source: 'inbox' });
    }
  }
  return next;
}

/** Whether a repo not in the vault becomes a draft project (also used by the live update check). */
export function isEligibleRepo(repo, login, sync) {
  if (repo.fork || repo.archived) return false;
  if (repo.overrides?.hidden) return false;
  // Nothing to say about it: no code, no description, no README.
  if (!Object.keys(repo.languages).length && !repo.description && !repo.readmeExcerpt) return false;
  if (repo.topics.includes(sync.includeTopic)) return true;
  if (repo.name.toLowerCase() === login.toLowerCase()) return false; // profile README repo
  return !sync.excludeRepos.map((r) => r.toLowerCase()).includes(repo.name.toLowerCase());
}

const githubBlock = (repo) => ({
  url: repo.url,
  fullName: repo.fullName,
  stars: repo.stars,
  forks: repo.forks,
  languages: repo.languages,
  primaryLanguage: repo.primaryLanguage,
  topics: repo.topics,
  homepage: repo.homepage || null,
  pushedAt: repo.pushedAt,
  readmeExcerpt: repo.readmeExcerpt,
  socialImage: repo.socialImage || null,
  pinned: repo.pinned,
});

// Build/config files GitHub reports as languages; not worth a tech chip.
const NOISE_LANGUAGES = new Set(['Batchfile', 'PowerShell', 'Dockerfile', 'Makefile', 'Mako', 'Procfile', 'CMake', 'Shell']);

const sortedLanguages = (languages) =>
  Object.entries(languages)
    .filter(([lang]) => !NOISE_LANGUAGES.has(lang))
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

/** Bullet-highlighted tech first, then the repo's main languages, deduped. */
const mergeTech = (tech, languages, max = 8) => {
  const key = (t) => t.toLowerCase().replace(/ notebook$/, ''); // "Jupyter Notebook" == "Jupyter"
  const out = new Map(tech.map((t) => [key(t), t]));
  for (const lang of sortedLanguages(languages).slice(0, 4)) if (!out.has(key(lang))) out.set(key(lang), lang);
  return [...out.values()].slice(0, max);
};

function draftFromRepo(repo) {
  const o = repo.overrides ?? {};
  const description = o.description ?? repo.description ?? null;
  const lines = [description, repo.readmeExcerpt].filter(Boolean).map(sanitizeInline);
  return {
    id: `proj_gh_${repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    title: o.title ?? prettifyRepoName(repo.name),
    context: 'GitHub repository',
    description,
    tags: [...new Set([...(o.category ? [o.category] : []), ...repo.topics])],
    category: o.category ?? null,
    bullets: { 1: lines.slice(0, 1), 2: lines.slice(0, 2), 3: lines },
    tech: sortedLanguages(repo.languages).slice(0, 6),
    github: githubBlock(repo),
    thumbnail: o.thumbnail ?? repo.socialImage ?? null,
    images: [],
    demoUrl: repo.homepage || null,
    videoUrl: o.demoVideo ?? null,
    modelUrl: o.model ?? null,
    startDate: repo.createdAt?.slice(0, 7) ?? null,
    endDate: null,
    updatedAt: repo.pushedAt,
    isNew: false,
    status: 'draft',
    source: 'github',
    featured: Boolean(o.featured),
    hidden: false,
  };
}

// GitHub language names that differ from how skills are usually written in the vault.
const LANGUAGE_ALIASES = {
  'c++': 'C++',
  cpp: 'C++',
  js: 'JavaScript',
  ts: 'TypeScript',
  jupyter: 'Jupyter Notebook',
  notebook: 'Jupyter Notebook',
  shell: 'Shell',
  bash: 'Shell',
  html5: 'HTML',
  css3: 'CSS',
  simulink: 'MATLAB',
};

function computeSkills(skillLists, languageTotals, repoLanguages) {
  const byLower = new Map(Object.entries(languageTotals).map(([k, v]) => [k.toLowerCase(), [k, v]]));
  const max = Math.max(1, ...Object.values(languageTotals));
  return skillLists.map(({ category, label, skills }) => ({
    category,
    label,
    skills: skills.map((name, i) => {
      // "Python (NumPy, Pandas)" -> Python; "JavaScript/TypeScript" -> both, bytes summed
      const parts = name.replace(/\(.*?\)/g, '').split('/').map((s) => s.trim()).filter(Boolean);
      const hits = parts
        .map((part) => byLower.get((LANGUAGE_ALIASES[part.toLowerCase()] ?? part).toLowerCase()))
        .filter(Boolean);
      if (hits.length) {
        const langs = hits.map(([lang]) => lang);
        const bytes = hits.reduce((sum, [, b]) => sum + b, 0);
        return {
          name,
          // sqrt keeps a 20 KB language visible next to a 1 MB one
          usage: Math.min(100, Math.max(5, Math.round(Math.sqrt(bytes / max) * 100))),
          usageSource: 'github',
          bytes,
          repos: repoLanguages.filter((repoLangs) => langs.some((l) => l in repoLangs)).length,
        };
      }
      // No GitHub bytes (non-code skill, or code kept private): the vault's ordering is the
      // signal, in a lower band so measured skills always lead.
      return { name, usage: Math.max(20, 70 - i * 6), usageSource: 'vault', bytes: null, repos: 0 };
    }),
  }));
}

function projectSortKey(p) {
  return p.updatedAt ?? p.github?.pushedAt ?? p.endDate ?? p.startDate ?? '';
}

/** Stable comparison ignoring fields that are derived per build. */
const fingerprint = (item) => JSON.stringify({ ...item, isNew: undefined });

export function diffPortfolios(prev, next) {
  const sections = [
    ['projects', (x) => x.title],
    ['experiences', (x) => `${x.role} @ ${x.company}`],
    ['education', (x) => x.institution],
    ['achievements', (x) => x.title],
  ];
  const added = [];
  const updated = [];
  const removed = [];
  for (const [section, titleOf] of sections) {
    const before = new Map((prev?.[section] ?? []).map((x) => [x.id, x]));
    const after = new Map(next[section].map((x) => [x.id, x]));
    for (const [id, item] of after) {
      if (!before.has(id)) added.push({ id, title: titleOf(item), section });
      else if (fingerprint(before.get(id)) !== fingerprint(item)) updated.push({ id, title: titleOf(item), section });
    }
    for (const [id, item] of before) if (!after.has(id)) removed.push({ id, title: titleOf(item), section });
  }
  return { added, updated, removed };
}

/**
 * @param {object} args
 * @param {unknown} args.vault        raw vault JSON (public export or profile_store.json)
 * @param {unknown} [args.github]     raw data/github.snapshot.json, or null if unavailable
 * @param {unknown} [args.inbox]      raw data/vault.inbox.json
 * @param {object}  args.config       portfolio.config.js default export
 * @param {object}  [args.previous]   last generated portfolio.json (for NEW badges and diffs)
 * @param {object}  [args.sources]    per-source status overrides, e.g. { github: { status: 'error', ... } }
 * @param {string}  [args.now]        ISO timestamp (injectable for tests)
 */
export function mergePortfolio({ vault, github = null, inbox = null, config, previous = null, sources = {}, now }) {
  const generatedAt = now ?? new Date().toISOString();
  const parsedVault = parseVault(vault);
  const publicVault = toPublicVault(parsedVault, config.privacy);
  const parsedInbox = inbox ? validateOrThrow(VaultInbox, inbox, 'data/vault.inbox.json') : { version: 1, items: [] };
  const snapshot = github ? validateOrThrow(GithubSnapshot, github, 'data/github.snapshot.json') : null;

  // Inbox edits may re-add fields toPublicVault removed, so filter again afterwards.
  const withInbox = toPublicVault(parseVault(applyInbox(publicVault, parsedInbox)), config.privacy);
  const base = normalizeVault(withInbox);

  // ---- GitHub merge ----
  const repos = snapshot?.repos ?? [];
  const byUrl = new Map(repos.map((r) => [normalizeRepoUrl(r.url), r]));
  const byName = new Map(repos.map((r) => [normalizeName(r.name), r]));
  const matched = new Set();

  const merged = base.projects.map(({ githubUrl, ...p }) => {
    const repo =
      (githubUrl && byUrl.get(repoRoot(githubUrl))) ||
      (p.plannedRepo && byName.get(normalizeName(p.plannedRepo))) ||
      byName.get(normalizeName(p.title)) ||
      byName.get(normalizeName(p.id));
    if (!repo) return p.bullets[3].length ? p : null; // nothing real to show
    const subfolder = githubUrl && isSubfolderUrl(githubUrl);
    const o = subfolder ? {} : (repo.overrides ?? {});
    // Vault text wins, but a project whose only bullets were template filler is
    // described by its own repo (description + README), like a GitHub draft.
    const ownText = p.bullets[3].length > 0;
    return {
      ...p,
      plannedRepo: null,
      bullets: ownText ? p.bullets : draftFromRepo(repo).bullets,
      // for de-duplication below: hand-written bullets beat repo-derived text
      dedupe: subfolder ? null : { repo: repo.fullName, score: ownText ? p.bullets[3].length : 0 },
      hidden: p.hidden || Boolean(o.hidden),
      description: subfolder ? null : (repo.description ?? o.description ?? null),
      category: o.category ?? null,
      featured: p.featured || Boolean(o.featured),
      github: { ...githubBlock(repo), url: subfolder ? githubUrl : repo.url },
      tech: mergeTech(p.tech, subfolder ? {} : repo.languages),
      thumbnail: p.thumbnail ?? o.thumbnail ?? (subfolder ? null : repo.socialImage) ?? null,
      demoUrl: p.demoUrl ?? (subfolder ? null : repo.homepage || null),
      videoUrl: p.videoUrl ?? o.demoVideo ?? null,
      modelUrl: p.modelUrl ?? o.model ?? null,
      updatedAt: p.updatedAt ?? repo.pushedAt,
    };
  });

  // Several vault entries can describe the same repo (e.g. an auto-imported
  // "Advanced Rag System" and a hand-written "Advanced Local RAG Knowledge
  // Engine"). Keep the one with the most real bullets. Sub-folder projects
  // (one repo holding several projects) are never merged.
  const best = new Map();
  for (const p of merged) {
    if (!p?.dedupe) continue;
    const cur = best.get(p.dedupe.repo);
    if (!cur || p.dedupe.score > cur.dedupe.score) best.set(p.dedupe.repo, p);
  }
  const projects = merged
    .filter((p) => p && !p.hidden && (!p.dedupe || best.get(p.dedupe.repo) === p))
    .map(({ dedupe, ...p }) => p);
  for (const p of merged) if (p?.github) matched.add(p.github.fullName); // hidden ones still block drafts

  const login = snapshot?.user.login ?? config.owner.githubUser;
  for (const repo of repos) {
    if (matched.has(repo.fullName) || !isEligibleRepo(repo, login, config.sync)) continue;
    projects.push(draftFromRepo(repo));
  }

  const prevIds = new Set((previous?.projects ?? []).map((p) => p.id));
  for (const p of projects) p.isNew = Boolean(previous) && config.sync.newBadge && !prevIds.has(p.id);

  projects.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      Number(a.status === 'draft') - Number(b.status === 'draft') ||
      projectSortKey(b).localeCompare(projectSortKey(a)),
  );

  // ---- Skills: "usage %" from real language bytes across own (non-fork) repos ----
  const ownRepos = repos.filter((r) => !r.fork);
  const weights = config.sync.languageWeights ?? {};
  const languageTotals = {};
  for (const r of ownRepos) {
    for (const [lang, bytes] of Object.entries(r.languages)) {
      languageTotals[lang] = (languageTotals[lang] ?? 0) + Math.round(bytes * (weights[lang] ?? 1));
    }
  }
  const skills = computeSkills(
    base.skillLists,
    languageTotals,
    ownRepos.map((r) => r.languages),
  );

  const visible = (list) => list.filter((x) => !x.hidden);

  const portfolio = {
    meta: {
      generatedAt,
      sample: Boolean(parsedVault.meta?.sample),
      sources: {
        vault: { status: 'ok', at: parsedVault.meta?.exported_at ?? null, message: null, ...sources.vault },
        github: snapshot
          ? { status: 'ok', at: snapshot.fetchedAt, message: null, ...sources.github }
          : { status: 'never', at: null, message: 'No GitHub snapshot yet', ...sources.github },
        linkedin: {
          status: parsedVault.meta?.linkedin_imported_at ? 'ok' : 'never',
          at: parsedVault.meta?.linkedin_imported_at ?? null,
          message: 'Imported through the jstMyRB vault',
          ...sources.linkedin,
        },
      },
    },
    profile: { ...base.profile, avatar: snapshot?.user.avatarUrl ?? null },
    education: visible(base.education),
    coursework: base.coursework,
    skills,
    experiences: visible(base.experiences).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')),
    projects,
    achievements: visible(base.achievements),
    testimonials: base.testimonials,
    github: snapshot
      ? {
          login: snapshot.user.login,
          name: snapshot.user.name,
          avatarUrl: snapshot.user.avatarUrl,
          url: snapshot.user.url,
          bio: snapshot.user.bio,
          publicRepos: snapshot.user.publicRepos,
          followers: snapshot.user.followers,
          totalStars: ownRepos.reduce((sum, r) => sum + r.stars, 0),
          languageTotals,
          knownRepos: repos.map((r) => r.fullName),
          contributions: snapshot.contributions ?? null,
        }
      : null,
  };

  const validated = validateOrThrow(Portfolio, portfolio, 'Merged portfolio');
  return { portfolio: validated, changes: diffPortfolios(previous, validated) };
}
