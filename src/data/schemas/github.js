/**
 * data/github.snapshot.json — what scripts/sync.mjs stores from the GitHub API.
 * Kept small: only fields the portfolio actually renders.
 */
import { z } from 'zod';
import { OptionalHref } from './common.js';

// Optional .portfolio.json in a repo root (section 11C step 2)
export const PortfolioRepoOverrides = z
  .object({
    title: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    category: z.string(),
    featured: z.boolean(),
    hidden: z.boolean(),
    demoVideo: z.string(),
    model: z.string(),
  })
  .partial();

export const GithubRepo = z.object({
  name: z.string(),
  fullName: z.string(),
  url: z.string(),
  description: z.string().nullable().default(null),
  fork: z.boolean().default(false),
  archived: z.boolean().default(false),
  stars: z.number().int().nonnegative().default(0),
  forks: z.number().int().nonnegative().default(0),
  topics: z.array(z.string()).default([]),
  homepage: OptionalHref,
  primaryLanguage: z.string().nullable().default(null),
  // language -> bytes
  languages: z.record(z.string(), z.number()).default({}),
  pushedAt: z.string().nullable().default(null),
  createdAt: z.string().nullable().default(null),
  readmeExcerpt: z.string().nullable().default(null),
  socialImage: OptionalHref,
  pinned: z.boolean().default(false),
  overrides: PortfolioRepoOverrides.nullable().default(null),
});

export const GithubUser = z.object({
  login: z.string(),
  name: z.string().nullable().default(null),
  avatarUrl: z.string(),
  url: z.string(),
  bio: z.string().nullable().default(null),
  publicRepos: z.number().int().default(0),
  followers: z.number().int().default(0),
});

// Contribution calendar (GraphQL, token required). level 0-4 like GitHub's graph.
export const Contributions = z.object({
  total: z.number().int().nonnegative(),
  days: z.array(z.object({ date: z.string(), count: z.number().int().nonnegative(), level: z.number().int().min(0).max(4) })),
});

export const GithubSnapshot = z.object({
  fetchedAt: z.string(),
  user: GithubUser,
  repos: z.array(GithubRepo),
  contributions: Contributions.nullable().default(null),
});
