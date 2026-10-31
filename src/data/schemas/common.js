import { z } from 'zod';

// Absolute http(s) URL or a site-relative path such as /media/photo.webp
export const Href = z
  .string()
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith('/'), { message: 'Expected an http(s) URL or a /path' });

export const OptionalHref = z.union([Href, z.literal('')]).optional().nullable();

export const IsoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Expected an ISO date' });

export const Visibility = z.enum(['public', 'private']);

export const TierKey = z.enum(['1', '2', '3']);

// Short text that may contain inline <b> tags (already sanitized by the adapter).
export const InlineHtml = z.string();

export const Tags = z.array(z.string()).default([]);

export const BulletTiers = z.object({
  1: z.array(InlineHtml),
  2: z.array(InlineHtml),
  3: z.array(InlineHtml),
});

// Optional per-item fields jstMyRB can add (section 11A step 2). Items without them still validate.
export const ItemExtras = {
  visibility: Visibility.optional(),
  featured: z.boolean().optional(),
  thumbnail: OptionalHref,
  demo_url: OptionalHref,
  video_url: OptionalHref,
  model_url: OptionalHref,
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
};
