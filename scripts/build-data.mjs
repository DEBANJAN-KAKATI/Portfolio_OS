#!/usr/bin/env node
/**
 * Offline data build: data/vault.public.json + data/github.snapshot.json +
 * data/vault.inbox.json -> src/data/generated/portfolio.json (+ changelog entry).
 *
 * scripts/sync.mjs (phase 4) refreshes the GitHub snapshot first and then runs
 * the same merge. If anything fails, the last good portfolio.json is kept.
 */
import { pathToFileURL } from 'node:url';
import config from '../portfolio.config.js';
import { mergePortfolio } from '../src/data/merge.js';
import { PATHS, readJson, writeJson, rel } from './lib/io.mjs';

export async function buildData({ sources = {}, now } = {}) {
  const [vault, github, inbox, previous, changelog] = await Promise.all([
    readJson(PATHS.vault),
    readJson(PATHS.github, null),
    readJson(PATHS.inbox, { version: 1, items: [] }),
    readJson(PATHS.portfolio, null),
    readJson(PATHS.changelog, { entries: [] }),
  ]);

  const { portfolio, changes } = mergePortfolio({ vault, github, inbox, config, previous, sources, now });

  const visibleProjects = portfolio.projects.filter((p) => p.status !== 'draft');
  if (!visibleProjects.length && previous?.projects?.length) {
    throw new Error('Merged portfolio has no visible projects; refusing to replace the last good data.');
  }

  // Compare content only (skills, profile, testimonials… count too). `meta` (build time,
  // per-source status) is left out so a run where GitHub is down doesn't open a PR just to
  // say so; that is reported in the Action summary instead.
  const comparable = (p) => p && JSON.stringify({ ...p, meta: null });
  const changed = comparable(portfolio) !== comparable(previous);
  const itemChanges = changes.added.length + changes.updated.length + changes.removed.length > 0;
  if (!changed && previous) {
    // Nothing changed: keep the previous file byte-for-byte so no-op syncs open no PR.
    return { portfolio: previous, changes, changed: false };
  }
  // Changelog entries list added/updated/removed items; pure stat or skill refreshes don't get one.
  if (itemChanges) {
    const n = (list, section) => list.filter((c) => c.section === section).length;
    const parts = [];
    if (n(changes.added, 'projects')) parts.push(`${n(changes.added, 'projects')} new project${n(changes.added, 'projects') > 1 ? 's' : ''}`);
    if (changes.updated.length) parts.push(`${changes.updated.length} updated`);
    if (changes.removed.length) parts.push(`${changes.removed.length} removed`);
    const otherAdds = changes.added.length - n(changes.added, 'projects');
    if (otherAdds) parts.push(`${otherAdds} other item${otherAdds > 1 ? 's' : ''} added`);
    changelog.entries.unshift({
      id: `sync_${portfolio.meta.generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`,
      date: portfolio.meta.generatedAt,
      title: previous ? `Sync: ${parts.join(', ')}` : 'Initial install',
      ...changes,
      sources: Object.entries(portfolio.meta.sources)
        .filter(([, s]) => s.status === 'ok')
        .map(([name]) => name),
    });
    changelog.entries = changelog.entries.slice(0, 50);
  }

  await writeJson(PATHS.portfolio, portfolio);
  await writeJson(PATHS.changelog, changelog);
  return { portfolio, changes, changed };
}

// Run directly: `npm run build:data`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { portfolio, changes, changed } = await buildData();
    const drafts = portfolio.projects.filter((p) => p.status === 'draft').length;
    console.log(`✔ ${rel(PATHS.portfolio)} ${changed ? 'written' : 'unchanged'}`);
    console.log(
      `  ${portfolio.projects.length - drafts} projects (+${drafts} GitHub drafts), ${portfolio.experiences.length} experiences, ` +
        `${portfolio.skills.reduce((n, g) => n + g.skills.length, 0)} skills, ${portfolio.achievements.length} achievements`,
    );
    if (changed) console.log(`  changes: +${changes.added.length} ~${changes.updated.length} -${changes.removed.length}`);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  }
}
