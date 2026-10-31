import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../portfolio.config.js';
import { readmeExcerpt, sameSnapshot } from '../scripts/lib/github.mjs';
import { isEligibleRepo } from '../src/data/merge.js';

test('readmeExcerpt skips headings, badges, lists and nav rows', () => {
  const md = [
    '# Title',
    '[![CI](https://x/badge.svg)](https://x)',
    '📥 [Download](a) • ✨ [Features](b) • 🛠️ [Stack](c)',
    '- a list item that is long enough to otherwise count as prose text',
    '```bash\nnpm install something long enough to be mistaken for a paragraph\n```',
    'Chat with your **documents**. Get grounded answers with [clickable citations](https://x).',
  ].join('\n\n');
  assert.equal(readmeExcerpt(md), 'Chat with your documents. Get grounded answers with clickable citations.');
  assert.equal(readmeExcerpt(null), null);
  assert.ok(readmeExcerpt(`Word ${'word '.repeat(200)}`, 50).length <= 50);
});

test('sameSnapshot ignores fetch time only', () => {
  const a = { fetchedAt: '1', repos: [{ name: 'x', stars: 1 }] };
  assert.ok(sameSnapshot(a, { ...a, fetchedAt: '2' }));
  assert.ok(!sameSnapshot(a, { fetchedAt: '2', repos: [{ name: 'x', stars: 2 }] }));
  assert.ok(!sameSnapshot(a, null));
});

test('draft eligibility: forks, archived, profile repo and empty repos are skipped; topic opts in', () => {
  const base = { name: 'thing', fork: false, archived: false, topics: [], languages: { Python: 1 }, description: 'd', readmeExcerpt: null, overrides: null };
  const ok = (r) => isEligibleRepo({ ...base, ...r }, 'me', config.sync);
  assert.ok(ok({}));
  assert.ok(!ok({ fork: true }));
  assert.ok(!ok({ archived: true }));
  assert.ok(!ok({ name: 'me' }));
  assert.ok(!ok({ languages: {}, description: null }));
  assert.ok(!ok({ overrides: { hidden: true } }));
  assert.ok(!isEligibleRepo({ ...base, name: 'excluded' }, 'me', { ...config.sync, excludeRepos: ['excluded'] }));
  assert.ok(isEligibleRepo({ ...base, name: 'excluded', topics: ['portfolio'] }, 'me', { ...config.sync, excludeRepos: ['excluded'] }));
});
