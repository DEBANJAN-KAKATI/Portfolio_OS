/**
 * src/data/generated/portfolio.json — the merged, normalized data every app reads.
 * Produced by mergePortfolio() (scripts/build-data.mjs now, scripts/sync.mjs in CI).
 */
import { z } from 'zod';
import { BulletTiers, InlineHtml, OptionalHref } from './common.js';
import { Contributions } from './github.js';

export const ItemStatus = z.enum(['published', 'draft', 'pending']);
export const ItemSource = z.enum(['vault', 'github', 'inbox']);

const ItemFlags = {
  status: ItemStatus.default('published'),
  source: ItemSource.default('vault'),
  featured: z.boolean().default(false),
  hidden: z.boolean().default(false),
  // the vault item's updated_at, sent with Dev Mode edits so jstMyRB can spot conflicts
  vaultUpdatedAt: z.string().nullable().default(null),
};

export const Profile = z.object({
  name: z.string(),
  email: z.string().nullable(),
  location: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  avatar: z.string().nullable(),
});

export const Education = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  duration: z.string(),
  gpa: z.string().nullable(),
  location: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  ...ItemFlags,
});

export const CourseworkGroup = z.object({
  category: z.string(),
  label: z.string(),
  courses: z.array(z.string()),
});

export const Skill = z.object({
  name: z.string(),
  // 0-100. From GitHub language bytes when the skill is a language, otherwise vault order.
  usage: z.number().min(0).max(100),
  usageSource: z.enum(['github', 'vault']),
  bytes: z.number().nullable(),
  repos: z.number().int().nonnegative(),
});

export const SkillGroup = z.object({
  category: z.string(),
  label: z.string(),
  skills: z.array(Skill),
});

export const Experience = z.object({
  id: z.string(),
  role: z.string(),
  company: z.string(),
  duration: z.string(),
  location: z.string().nullable(),
  tags: z.array(z.string()),
  bullets: BulletTiers,
  tech: z.array(z.string()),
  thumbnail: OptionalHref,
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  ...ItemFlags,
});

export const ProjectGithub = z.object({
  url: z.string(), // repo URL, or the sub-folder URL for projects that live inside a bigger repo
  fullName: z.string(),
  stars: z.number(),
  forks: z.number(),
  languages: z.record(z.string(), z.number()),
  primaryLanguage: z.string().nullable(),
  topics: z.array(z.string()),
  homepage: z.string().nullable(),
  pushedAt: z.string().nullable(),
  readmeExcerpt: z.string().nullable(),
  socialImage: z.string().nullable(),
  pinned: z.boolean(),
});

export const Project = z.object({
  id: z.string(),
  title: z.string(),
  context: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  bullets: BulletTiers,
  tech: z.array(z.string()),
  github: ProjectGithub.nullable(),
  plannedRepo: z.string().nullable().default(null), // set while the project is local-only
  thumbnail: z.string().nullable(),
  images: z.array(z.string()),
  demoUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  modelUrl: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  updatedAt: z.string().nullable(),
  isNew: z.boolean().default(false),
  ...ItemFlags,
});

export const AchievementKind = z.enum(['patent', 'certification', 'por', 'award']);

export const Achievement = z.object({
  id: z.string(),
  kind: AchievementKind,
  label: z.string(), // "Patent", "Certification", "Position of Responsibility", ...
  title: z.string(),
  details: InlineHtml,
  url: z.string().nullable(),
  image: z.string().nullable(),
  date: z.string().nullable(),
  ...ItemFlags,
});

export const Testimonial = z.object({
  id: z.string(),
  author: z.string(),
  headline: z.string().nullable(),
  relationship: z.string().nullable(),
  text: z.string(),
  date: z.string().nullable(),
});

export const SourceStatus = z.object({
  status: z.enum(['ok', 'stale', 'error', 'never']),
  at: z.string().nullable(),
  message: z.string().nullable().default(null),
});

export const Portfolio = z.object({
  meta: z.object({
    generatedAt: z.string(),
    sample: z.boolean(),
    sources: z.object({
      vault: SourceStatus,
      github: SourceStatus,
      linkedin: SourceStatus,
    }),
  }),
  profile: Profile,
  education: z.array(Education),
  coursework: z.array(CourseworkGroup),
  skills: z.array(SkillGroup),
  experiences: z.array(Experience),
  projects: z.array(Project),
  achievements: z.array(Achievement),
  testimonials: z.array(Testimonial),
  github: z
    .object({
      login: z.string(),
      name: z.string().nullable(),
      avatarUrl: z.string(),
      url: z.string(),
      bio: z.string().nullable(),
      publicRepos: z.number(),
      followers: z.number(),
      totalStars: z.number(),
      languageTotals: z.record(z.string(), z.number()),
      knownRepos: z.array(z.string()), // full names, used by the live "Check for updates"
      contributions: Contributions.nullable().default(null),
    })
    .nullable(),
});

export const ChangelogEntry = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  added: z.array(z.object({ id: z.string(), title: z.string(), section: z.string() })),
  updated: z.array(z.object({ id: z.string(), title: z.string(), section: z.string() })),
  removed: z.array(z.object({ id: z.string(), title: z.string(), section: z.string() })),
  sources: z.array(z.string()).default([]),
});

export const Changelog = z.object({
  entries: z.array(ChangelogEntry),
});
