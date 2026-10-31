#!/usr/bin/env node
/**
 * Validates every data file with zod and checks the public vault for leaks.
 * Runs before every `npm run build`, so bad JSON never ships.
 */
import { Vault, VaultInbox, GithubSnapshot, Portfolio, Changelog, Extras, Media, Layout, Trash } from '../src/data/schemas/index.js';
import { formatZodError } from '../src/data/validate.js';
import { access } from 'node:fs/promises';
import { PATHS, readJson, rel, path } from './lib/io.mjs';

const checks = [
  [PATHS.vault, Vault, true],
  [PATHS.inbox, VaultInbox, false],
  [PATHS.github, GithubSnapshot, false],
  [PATHS.portfolio, Portfolio, true],
  [PATHS.changelog, Changelog, true],
  [PATHS.extras, Extras, true],
  [PATHS.media, Media, true],
  [PATHS.layout, Layout, true],
  [PATHS.trash, Trash, false],
];

let failed = 0;
const fail = (msg) => {
  failed++;
  console.error(`✖ ${msg}`);
};

const parsed = {};
for (const [file, schema, required] of checks) {
  const data = await readJson(file, required ? undefined : null).catch((err) => (fail(err.message), undefined));
  if (data === undefined) continue;
  if (data === null) {
    console.log(`– ${rel(file)} (optional, missing)`);
    continue;
  }
  const result = schema.safeParse(data);
  if (result.success) {
    parsed[file] = result.data;
    console.log(`✔ ${rel(file)}`);
  } else fail(`${rel(file)}\n${formatZodError(result.error)}`);
}

// ---- Privacy: the committed vault must be the public export, not profile_store.json ----
const vault = parsed[PATHS.vault];
if (vault) {
  if (vault.personal_info.phone) fail('data/vault.public.json contains a phone number. Publish from jstMyRB instead of copying profile_store.json.');
  for (const key of ['tracker', 'applications', 'cover_letters', 'settings', 'vault_versions', 'api_keys']) {
    if (key in vault) fail(`data/vault.public.json contains private section "${key}".`);
  }
  for (const section of ['education', 'experiences', 'projects', 'patents_certifications', 'pors_achievements', 'awards_medals']) {
    for (const item of vault[section]) {
      const name = item.id ?? item.title ?? item.institution;
      if (item.visibility === 'private') fail(`${section} "${name}" is private but present in the public vault.`);
      if (item.bullets_source === 'template') fail(`${section} "${name}" has template bullets (invented metrics) and must not be published.`);
    }
  }
}

// ---- Cross-file references ----
const media = parsed[PATHS.media];
const layout = parsed[PATHS.layout];
if (media && layout && layout.defaultWallpaper !== 'auto' && !media.wallpapers.some((w) => w.id === layout.defaultWallpaper)) {
  fail(`content/layout.json defaultWallpaper "${layout.defaultWallpaper}" is not in content/media.json wallpapers.`);
}
// Local media referenced by content must exist in /public.
const localRefs = [];
if (media) {
  for (const list of [media.photos, media.wallpapers, media.renders, media.models]) for (const m of list) localRefs.push(m.src);
}
const extras = parsed[PATHS.extras];
if (extras) {
  localRefs.push(extras.resume.url);
  for (const w of extras.casualWorks) if (w.image) localRefs.push(w.image);
}
for (const ref of localRefs.filter((r) => r?.startsWith('/'))) {
  await access(path('public', ref.slice(1))).catch(() => fail(`Missing file public${ref} (referenced from content/).`));
}

if (failed) {
  console.error(`\n${failed} problem${failed > 1 ? 's' : ''} found.`);
  process.exit(1);
}
console.log('\nAll data valid.');
