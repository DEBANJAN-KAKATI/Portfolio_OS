#!/usr/bin/env node
/**
 * Full sync (section 11C): GitHub → snapshot, then vault + snapshot + inbox →
 * src/data/generated/portfolio.json + changelog. Run by .github/workflows/sync.yml,
 * or locally with `npm run sync` (set GITHUB_TOKEN for GraphQL data and higher limits).
 *
 * If a source fails, the last good data is kept and the failure is reported.
 * It never writes an empty portfolio (buildData refuses).
 *
 * In GitHub Actions it writes the run summary and these step outputs:
 *   changed=true|false, title=<PR / commit title>, review_mode=pr|auto
 * plus .sync-summary.md for the pull request body.
 */
import { appendFile, writeFile } from 'node:fs/promises';
import config from '../portfolio.config.js';
import { fetchGithubSnapshot, sameSnapshot } from './lib/github.mjs';
import { buildData } from './build-data.mjs';
import { PATHS, readJson, writeJson, rel, path } from './lib/io.mjs';

const log = (msg) => console.log(msg);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

async function main() {
  const sources = {};
  const problems = [];

  // ---- Vault must exist (jstMyRB "Publish to Portfolio" writes it) ----
  const vault = await readJson(PATHS.vault, null);
  if (!vault) throw new Error(`${rel(PATHS.vault)} is missing. Publish from jstMyRB first.`);

  // ---- GitHub ----
  const previousSnapshot = await readJson(PATHS.github, null);
  try {
    const snapshot = await fetchGithubSnapshot({ user: config.owner.githubUser, token, config, previous: previousSnapshot, log });
    if (sameSnapshot(snapshot, previousSnapshot)) log('GitHub data unchanged.');
    else await writeJson(PATHS.github, snapshot);
  } catch (err) {
    problems.push(`GitHub: ${err.message}`);
    sources.github = { status: previousSnapshot ? 'stale' : 'error', at: previousSnapshot?.fetchedAt ?? null, message: err.message };
    log(`✖ GitHub fetch failed, keeping the last good snapshot: ${err.message}`);
  }

  // ---- Merge + validate + changelog ----
  const { portfolio, changes, changed } = await buildData({ sources });
  const entry = changed ? (await readJson(PATHS.changelog, { entries: [] })).entries[0] : null;
  const title = changed ? (entry && entry.date === portfolio.meta.generatedAt ? entry.title : 'Sync: data refresh') : 'Sync: no changes';

  // ---- Report ----
  const drafts = portfolio.projects.filter((p) => p.status === 'draft');
  const list = (items) => items.map((c) => `- ${c.title} _(${c.section})_`).join('\n') || '- none';
  const summary = [
    `## ${title}`,
    '',
    '| Source | Status | Last data |',
    '| --- | --- | --- |',
    ...Object.entries(portfolio.meta.sources).map(([k, s]) => `| ${k} | ${s.status}${s.message && s.status !== 'ok' ? ` — ${s.message}` : ''} | ${s.at ?? '—'} |`),
    '',
    problems.length ? `### ⚠ Problems\n${problems.map((p) => `- ${p}`).join('\n')}\n` : '',
    `### Added\n${list(changes.added)}`,
    `### Updated\n${list(changes.updated)}`,
    `### Removed\n${list(changes.removed)}`,
    '',
    drafts.length ? `### GitHub drafts (hidden from visitors until approved)\n${drafts.map((d) => `- ${d.title}`).join('\n')}` : '',
    '',
    `Review mode: \`${config.sync.reviewMode}\` · ${portfolio.projects.length - drafts.length} visible projects`,
  ].join('\n');
  log(`\n${summary}`);

  if (process.env.GITHUB_ACTIONS) {
    await writeFile(path('.sync-summary.md'), summary);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\ntitle=${title.replace(/\n/g, ' ')}\nreview_mode=${config.sync.reviewMode}\n`);
    }
  }
}

main().catch((err) => {
  console.error(`✖ Sync failed: ${err.message}`);
  process.exit(1);
});
