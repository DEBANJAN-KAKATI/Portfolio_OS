import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../portfolio.config.js';
import { mergePortfolio, applyInbox } from '../src/data/merge.js';
import { bulletTiers, extractTech, parseDuration, humanizeKey, isTemplateBullet, toPublicVault, parseVault } from '../src/data/adapters/jstmyrb.js';
import { sanitizeInline } from '../src/data/sanitize.js';

const NOW = '2026-10-28T12:00:00.000Z';

const vault = () => ({
  personal_info: { name: 'Test User', email: 'me@example.com', phone: '+91 99999 99999', github: 'https://github.com/u', location: 'X' },
  education: [{ institution: 'Uni', degree: 'B.Tech', duration: '2023 – 2027', gpa: '9.1' }],
  skills: { programming: ['Python', 'Rust'] },
  experiences: [
    { id: 'e1', role: 'Intern', company: 'Acme', duration: 'May 2024 – Present', tags: [], bullets: ['Used <b>Python</b> for <b>40%</b> faster runs.'] },
    { id: 'e2', role: 'Ghost', company: 'Hidden Co', tags: [], bullets: ['x'], visibility: 'private' },
  ],
  projects: [
    { id: 'p1', title: 'Repo One', tags: ['ai_ml'], bullets: ['<b>FastAPI</b> app <script>alert(1)</script>'], github_url: 'https://github.com/u/repo-one.git' },
    { id: 'p2', title: 'Templated', tags: [], bullets: ['99.9% uptime'], bullets_source: 'template' },
  ],
  testimonials: [
    { id: 't1', author: 'A', text: 'great', approved: true },
    { id: 't2', author: 'B', text: 'meh', approved: false },
  ],
  tracker: [{ company: 'secret' }],
});

const repo = (name, extra = {}) => ({
  name,
  fullName: `u/${name}`,
  url: `https://github.com/u/${name}`,
  description: `${name} description`,
  stars: 3,
  languages: { Python: 1000, Batchfile: 10 },
  pushedAt: '2026-10-01T00:00:00Z',
  ...extra,
});

const snapshot = (repos) => ({
  fetchedAt: NOW,
  user: { login: 'u', avatarUrl: 'https://avatars.example/u', url: 'https://github.com/u' },
  repos,
});

test('public filter drops phone, email (by default), private items, template bullets and unapproved testimonials', () => {
  const { portfolio } = mergePortfolio({ vault: vault(), config, now: NOW });
  const json = JSON.stringify(portfolio);
  assert.ok(!json.includes('99999'), 'phone leaked');
  assert.equal(portfolio.profile.email, null);
  assert.ok(!json.includes('Hidden Co'), 'private experience leaked');
  assert.ok(!json.includes('99.9% uptime'), 'template bullets leaked');
  assert.ok(!json.includes('secret'), 'tracker leaked');
  assert.deepEqual(portfolio.testimonials.map((t) => t.id), ['t1']);
});

test('bullets keep only <b> and escape everything else', () => {
  assert.equal(sanitizeInline('<b>ok</b> <script>x</script> <i>y</i>'), '<b>ok</b> &lt;script&gt;x&lt;/script&gt; &lt;i&gt;y&lt;/i&gt;');
  // attributes make it not-a-<b>, so it's escaped and the stray </b> is dropped
  assert.equal(sanitizeInline('<b onclick="x">a</b>'), '&lt;b onclick=&quot;x&quot;&gt;a');
  assert.equal(sanitizeInline('<b>unclosed'), '<b>unclosed</b>');
});

test('GitHub merge: match by url, vault wins text, GitHub wins stats; drafts for new repos', () => {
  const { portfolio } = mergePortfolio({
    vault: vault(),
    github: snapshot([repo('repo-one'), repo('brand-new'), repo('forked', { fork: true }), repo('u')]),
    config,
    now: NOW,
  });
  const p1 = portfolio.projects.find((p) => p.id === 'p1');
  assert.equal(p1.title, 'Repo One');
  assert.equal(p1.github.stars, 3);
  assert.deepEqual(p1.tech, ['FastAPI', 'Python']); // Batchfile filtered as noise
  const draft = portfolio.projects.find((p) => p.id === 'proj_gh_brand_new');
  assert.equal(draft.status, 'draft');
  assert.deepEqual(draft.bullets[1], ['brand-new description']);
  assert.ok(!portfolio.projects.some((p) => p.id === 'proj_gh_forked'), 'fork imported');
  assert.ok(!portfolio.projects.some((p) => p.id === 'proj_gh_u'), 'profile repo imported');
});

test('.portfolio.json hidden override removes a matched project', () => {
  const { portfolio } = mergePortfolio({ vault: vault(), github: snapshot([repo('repo-one', { overrides: { hidden: true } })]), config, now: NOW });
  assert.ok(!portfolio.projects.some((p) => p.id === 'p1'));
});

test('NEW badge only for projects absent from the previous build', () => {
  const first = mergePortfolio({ vault: vault(), github: snapshot([repo('repo-one')]), config, now: NOW }).portfolio;
  assert.ok(first.projects.every((p) => !p.isNew));
  const second = mergePortfolio({ vault: vault(), github: snapshot([repo('repo-one'), repo('fresh')]), config, previous: first, now: NOW });
  assert.deepEqual(second.portfolio.projects.filter((p) => p.isNew).map((p) => p.id), ['proj_gh_fresh']);
  assert.deepEqual(second.changes.added.map((c) => c.id), ['proj_gh_fresh']);
});

test('inbox edits apply on top and are marked pending; inbox cannot publish private items', () => {
  const inbox = {
    version: 1,
    items: [
      { op: 'edit', section: 'projects', id: 'p1', data: { title: 'Renamed' }, edited_at: NOW },
      { op: 'add', section: 'projects', id: 'p9', data: { title: 'Added in Dev Mode', tags: [], bullets: ['hi'] }, edited_at: NOW },
      { op: 'add', section: 'projects', id: 'p10', data: { title: 'Secret', tags: [], bullets: ['x'], visibility: 'private' }, edited_at: NOW },
    ],
  };
  const { portfolio } = mergePortfolio({ vault: vault(), inbox, config, now: NOW });
  const p1 = portfolio.projects.find((p) => p.id === 'p1');
  assert.equal(p1.title, 'Renamed');
  assert.equal(p1.status, 'pending');
  assert.equal(portfolio.projects.find((p) => p.id === 'p9').source, 'inbox');
  assert.ok(!portfolio.projects.some((p) => p.id === 'p10'));
});

test('applyInbox does not mutate its input', () => {
  const v = { projects: [{ id: 'a', title: 'A' }], skills: {} };
  applyInbox(v, { version: 1, items: [{ op: 'delete', section: 'projects', id: 'a', data: {}, edited_at: NOW }] });
  assert.equal(v.projects.length, 1);
});

test('adapter helpers', () => {
  const tiers = bulletTiers({ bullets: ['a', 'b', 'c'] });
  assert.deepEqual(tiers, { 1: ['a'], 2: ['a', 'b'], 3: ['a', 'b', 'c'] });
  assert.deepEqual(extractTech(['<b>C++20</b> with <b>65%</b> less <b>Assam</b> and <b>CNNs</b>']), ['C++', 'CNN']);
  assert.deepEqual(parseDuration('May 2024 – Present'), { start: '2024-05', end: null });
  assert.equal(humanizeKey('frameworks_web'), 'Frameworks & Web');
  assert.equal(humanizeKey('data_systems'), 'Data Systems');
});

test('jstMyRB template bullets are dropped one by one; real bullets survive', () => {
  assert.ok(isTemplateBullet('Engineered an enterprise-grade Python system for <b>X</b>, achieving <b>99.9% uptime</b> and sub-second processing latency.'));
  assert.ok(isTemplateBullet('Implemented optimized data structures and asynchronous pipelines in HTML, reducing computational overhead by <b>~35%</b> across stress tests.'));
  assert.ok(isTemplateBullet('Engineered production deployment pipeline with continuous benchmarking.'));
  // hand-written bullets that merely mention uptime are kept
  assert.ok(!isTemplateBullet('Built resilient rate-limit governors guaranteeing 99.9% query uptime under heavy token loads.'));

  const v = vault();
  v.projects.push({
    id: 'p3', title: 'Mixed', tags: [], bullets: [],
    points_tier: { 1: ['Real one.'], 2: ['Real one.', 'Real two.'], 3: ['Real one.', 'Real two.', 'Engineered production deployment pipeline with continuous benchmarking.'] },
  });
  const pub = toPublicVault(parseVault(v));
  assert.deepEqual(pub.projects.find((p) => p.id === 'p3').points_tier[3], ['Real one.', 'Real two.']);
});

test('github_url is inferred from "GitHub: repo" in the context', () => {
  const v = vault();
  v.projects = [{ id: 'q', title: 'Q', context: 'Open Source System | GitHub: QR-Chat', tags: [], bullets: ['x'] }];
  assert.equal(toPublicVault(parseVault(v)).projects[0].github_url, 'https://github.com/u/QR-Chat');
});

test('template-only project is described by its repo, and loses to a hand-written duplicate', () => {
  const v = vault();
  v.projects = [
    { id: 'auto', title: 'Rag', context: 'GitHub: rag', tags: [], bullets: ['Engineered production deployment pipeline with continuous benchmarking.'] },
    { id: 'hand', title: 'Local RAG Engine', context: 'Production System | GitHub: rag', tags: [], bullets: ['Hybrid <b>BM25</b> + dense retrieval.'] },
    { id: 'solo', title: 'Solo', context: 'GitHub: solo', tags: [], bullets: ['Engineered production deployment pipeline with continuous benchmarking.'] },
    { id: 'gone', title: 'No repo, no text', tags: [], bullets: ['Engineered production deployment pipeline with continuous benchmarking.'] },
  ];
  const { portfolio } = mergePortfolio({ vault: v, github: snapshot([repo('rag'), repo('solo')]), config, now: NOW });
  const ids = portfolio.projects.map((p) => p.id);
  assert.ok(ids.includes('hand') && !ids.includes('auto'), 'duplicate not resolved');
  assert.deepEqual(portfolio.projects.find((p) => p.id === 'solo').bullets[1], ['solo description']);
  assert.ok(!ids.includes('gone'));
  assert.ok(!ids.includes('proj_gh_rag'), 'matched repo became a draft');
});

test('several projects can live in sub-folders of one repo; repo_hint links a local project once pushed', () => {
  const v = vault();
  v.projects = [
    { id: 'a', title: 'A', tags: [], bullets: ['a'], github_url: 'https://github.com/u/mono/tree/main/A' },
    { id: 'b', title: 'B', tags: [], bullets: ['b'], github_url: 'https://github.com/u/mono/tree/main/B' },
    { id: 'l', title: 'Local Thing', tags: [], bullets: ['l'], repo_hint: 'local-thing' },
  ];
  const before = mergePortfolio({ vault: v, github: snapshot([repo('mono')]), config, now: NOW }).portfolio;
  assert.equal(before.projects.find((p) => p.id === 'a').github.url, 'https://github.com/u/mono/tree/main/A');
  assert.ok(before.projects.find((p) => p.id === 'b').github);
  assert.ok(!before.projects.some((p) => p.id === 'proj_gh_mono'));
  const local = before.projects.find((p) => p.id === 'l');
  assert.equal(local.github, null);
  assert.equal(local.plannedRepo, 'local-thing');

  const after = mergePortfolio({ vault: v, github: snapshot([repo('mono'), repo('local-thing')]), config, now: NOW }).portfolio;
  const pushed = after.projects.find((p) => p.id === 'l');
  assert.equal(pushed.github.fullName, 'u/local-thing');
  assert.equal(pushed.plannedRepo, null);
  assert.ok(!after.projects.some((p) => p.id === 'proj_gh_local_thing'));
});

test('skills usage: GitHub-measured languages lead, vault-only skills fall back to order', () => {
  const { portfolio } = mergePortfolio({ vault: vault(), github: snapshot([repo('repo-one')]), config, now: NOW });
  const [python, rust] = portfolio.skills[0].skills;
  assert.equal(python.usageSource, 'github');
  assert.equal(python.usage, 100);
  assert.equal(rust.usageSource, 'vault');
  assert.ok(rust.usage < python.usage);
});
