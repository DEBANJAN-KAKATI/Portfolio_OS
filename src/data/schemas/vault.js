/**
 * Raw jstMyRB vault shapes. These accept both the full local profile_store.json
 * and the public-safe GET /api/portfolio/export payload, and they are loose
 * (unknown keys pass through) so new vault fields never break the portfolio.
 */
import { z } from 'zod';
import { ItemExtras, Tags, TierKey, OptionalHref } from './common.js';

const PointsTier = z
  .object({ 1: z.array(z.string()).optional(), 2: z.array(z.string()).optional(), 3: z.array(z.string()).optional() })
  .partial();

export const VaultPersonalInfo = z.looseObject({
  name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  github: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

export const VaultEducation = z.looseObject({
  id: z.string().optional(),
  institution: z.string(),
  degree: z.string(),
  duration: z.string().optional().default(''),
  gpa: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  ...ItemExtras,
});

export const VaultExperience = z.looseObject({
  id: z.string(),
  role: z.string(),
  company: z.string(),
  duration: z.string().optional().default(''),
  location: z.string().optional().nullable(),
  tags: Tags,
  bullets: z.array(z.string()).default([]),
  points_tier: PointsTier.optional(),
  selected_tier: TierKey.optional(),
  bullets_source: z.string().optional(),
  ...ItemExtras,
});

export const VaultProject = z.looseObject({
  id: z.string(),
  title: z.string(),
  context: z.string().optional().default(''),
  tags: Tags,
  bullets: z.array(z.string()).default([]),
  points_tier: PointsTier.optional(),
  selected_tier: TierKey.optional(),
  github_url: OptionalHref,
  // Repo name the project will be pushed as; lets the sync link it once it exists.
  repo_hint: z.string().optional().nullable(),
  bullets_source: z.string().optional(),
  ...ItemExtras,
});

// jstMyRB renders these as "<b>{type}:</b> {title} — {details}"
export const VaultPatentCert = z.looseObject({
  id: z.string().optional(),
  type: z.string().optional().default('Certification'),
  title: z.string(),
  details: z.string().optional().default(''),
  url: OptionalHref,
  image: OptionalHref,
  date: z.string().optional().nullable(),
  ...ItemExtras,
});

// PORs and awards render as "<b>{title}:</b> {details}"
export const VaultTitledItem = z.looseObject({
  id: z.string().optional(),
  title: z.string(),
  details: z.string().optional().default(''),
  url: OptionalHref,
  image: OptionalHref,
  date: z.string().optional().nullable(),
  ...ItemExtras,
});

// LinkedIn recommendations imported through jstMyRB (section 11B). Only approved ones are shown.
export const VaultTestimonial = z.looseObject({
  id: z.string(),
  author: z.string(),
  headline: z.string().optional().nullable(),
  relationship: z.string().optional().nullable(),
  text: z.string(),
  date: z.string().optional().nullable(),
  approved: z.boolean().default(false),
});

export const VaultMeta = z.looseObject({
  source: z.string().optional(),
  exported_at: z.string().optional(),
  schema_version: z.number().optional(),
  sample: z.boolean().optional(),
});

export const Vault = z.looseObject({
  meta: VaultMeta.optional(),
  personal_info: VaultPersonalInfo,
  education: z.array(VaultEducation).default([]),
  coursework: z.record(z.string(), z.array(z.string())).default({}),
  skills: z.record(z.string(), z.array(z.string())).default({}),
  experiences: z.array(VaultExperience).default([]),
  projects: z.array(VaultProject).default([]),
  patents_certifications: z.array(VaultPatentCert).default([]),
  pors_achievements: z.array(VaultTitledItem).default([]),
  awards_medals: z.array(VaultTitledItem).default([]),
  testimonials: z.array(VaultTestimonial).default([]),
});

/**
 * Edits made in Dev Mode that jstMyRB has not pulled yet (data/vault.inbox.json).
 * Each entry targets one vault section; "data" holds raw vault-shaped fields.
 */
export const InboxSection = z.enum([
  'projects',
  'experiences',
  'education',
  'skills',
  'patents_certifications',
  'pors_achievements',
  'awards_medals',
]);

export const InboxEntry = z.object({
  op: z.enum(['add', 'edit', 'delete']),
  section: InboxSection,
  id: z.string(),
  data: z.record(z.string(), z.any()).default({}),
  // vault item's updated_at when the edit was made, so jstMyRB can detect conflicts
  base_updated_at: z.string().optional().nullable(),
  edited_at: z.string(),
});

export const VaultInbox = z.object({
  version: z.literal(1),
  items: z.array(InboxEntry).default([]),
});
