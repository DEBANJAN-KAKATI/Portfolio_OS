#!/usr/bin/env node
/**
 * Import a jstMyRB vault (data/profile_store.json or a GET /api/profile/export
 * download) as data/vault.public.json, applying the public allow-list.
 *
 *   npm run import-vault -- "D:/path/to/jstMyRB/data/profile_store.json"
 *
 * Until jstMyRB's "Publish to Portfolio" button exists, this is how the real
 * vault gets into the portfolio. Run `npm run build:data` afterwards.
 */
import { pathToFileURL } from 'node:url';
import config from '../portfolio.config.js';
import { parseVault, toPublicVault, isTemplateBullet } from '../src/data/adapters/jstmyrb.js';
import { PATHS, readJson, writeJson, rel } from './lib/io.mjs';

export function importVault(raw, { now = new Date().toISOString() } = {}) {
  const vault = parseVault(raw);
  const pub = toPublicVault(vault, config.privacy);

  // Report what the allow-list removed so nothing disappears silently.
  const report = { templateBullets: 0, droppedProjects: [], privateItems: 0 };
  for (const item of [...vault.projects, ...vault.experiences]) {
    const all = new Set([...(item.bullets ?? []), ...Object.values(item.points_tier ?? {}).flat()]);
    report.templateBullets += [...all].filter(isTemplateBullet).length;
  }
  const kept = new Set(pub.projects.map((p) => p.id));
  report.droppedProjects = vault.projects.filter((p) => !kept.has(p.id)).map((p) => p.title);
  for (const key of ['education', 'experiences', 'projects', 'patents_certifications', 'pors_achievements', 'awards_medals']) {
    report.privateItems += vault[key].filter((i) => i.visibility === 'private').length;
  }

  pub.meta = { ...(pub.meta ?? {}), source: 'jstMyRB', schema_version: 1, exported_at: now, sample: false };
  return { vault: pub, report };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: npm run import-vault -- <path to profile_store.json or vault export>');
    process.exit(1);
  }
  try {
    const { vault, report } = importVault(await readJson(src));
    await writeJson(PATHS.vault, vault);
    console.log(`✔ ${rel(PATHS.vault)} written from ${src}`);
    console.log(`  ${vault.projects.length} projects, ${vault.experiences.length} experiences, ${vault.education.length} education`);
    console.log(`  removed: ${report.templateBullets} template bullets, ${report.privateItems} private items; phone and unlisted fields never exported`);
    if (report.droppedProjects.length) console.log(`  dropped (no real text, no repo): ${report.droppedProjects.join('; ')}`);
    console.log('  next: npm run build:data');
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  }
}
