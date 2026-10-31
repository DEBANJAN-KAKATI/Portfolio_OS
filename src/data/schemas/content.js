/**
 * Portfolio-owned content in /content/*.json (not in the vault). Plain JSON so
 * Dev Mode can edit it; every field is validated here.
 */
import { z } from 'zod';
import { Href, OptionalHref } from './common.js';

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #rrggbb color');

export const CasualWork = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['doodle', 'experiment', 'blog', 'build']),
  description: z.string(),
  date: z.string().nullable().default(null),
  url: OptionalHref,
  image: OptionalHref,
  body: z.string().optional(), // markdown, sanitized on render
  hidden: z.boolean().default(false),
});

export const Hobby = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(), // emoji or /path to an icon
  blurb: z.string(),
  funFact: z.string().optional(),
  images: z.array(Href).default([]),
  // Optional link, e.g. a Spotify profile for Music.
  url: Href.nullable().optional(),
  urlLabel: z.string().nullable().optional(),
  // Projects tied to the hobby; projectsNote is shown beside them, e.g. "Coming soon".
  projects: z.array(z.string()).default([]),
  projectsNote: z.string().nullable().optional(),
  hidden: z.boolean().default(false),
});

export const Track = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  src: Href,
  cover: OptionalHref,
});

export const Extras = z.object({
  tagline: z.string(),
  intro: z.string(),
  accentColor: HexColor,
  avatar: OptionalHref,
  quickFacts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  openToWork: z.object({ enabled: z.boolean(), text: z.string() }),
  currentlyLearning: z.array(z.string()).default([]),
  currentlyListening: z.object({ title: z.string(), artist: z.string(), url: OptionalHref }).nullable().default(null),
  // Task Manager → "Startup apps"
  learningNext: z
    .array(z.object({ name: z.string(), publisher: z.string().default(''), impact: z.enum(['High', 'Medium', 'Low']) }))
    .default([]),
  casualWorks: z.array(CasualWork).default([]),
  hobbies: z.array(Hobby).default([]),
  playlist: z.array(Track).default([]),
  resume: z.object({ url: Href, fileName: z.string() }),
  lockScreenQuotes: z.array(z.string()).min(1),
  recycleBin: z
    .array(z.object({ id: z.string(), name: z.string(), kind: z.enum(['idea', 'bug']), note: z.string() }))
    .default([]),
  assistantTips: z.array(z.string()).default([]),
});

export const Photo = z.object({
  id: z.string(),
  src: Href,
  thumb: OptionalHref,
  caption: z.string().default(''),
  album: z.string().default('General'),
  date: z.string().nullable().default(null),
  width: z.number().optional(),
  height: z.number().optional(),
  hidden: z.boolean().default(false),
});

export const Video = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['youtube', 'vimeo', 'mp4']),
  src: z.string(), // YouTube/Vimeo id or URL, or an mp4 href
  poster: OptionalHref,
  description: z.string().default(''),
  duration: z.string().nullable().default(null),
  hidden: z.boolean().default(false),
});

export const Model3D = z.object({
  id: z.string(),
  title: z.string(),
  src: Href, // .glb / .gltf
  poster: OptionalHref,
  description: z.string().default(''),
  hidden: z.boolean().default(false),
});

export const Render = z.object({
  id: z.string(),
  title: z.string(),
  src: Href,
  hidden: z.boolean().default(false),
});

export const Wallpaper = z.object({
  id: z.string(),
  name: z.string(),
  src: Href,
  // Used by the "auto" wallpaper that follows time of day.
  timeOfDay: z.enum(['morning', 'evening', 'night']).nullable().default(null),
});

export const Media = z.object({
  photos: z.array(Photo).default([]),
  videos: z.array(Video).default([]),
  models: z.array(Model3D).default([]),
  renders: z.array(Render).default([]),
  wallpapers: z.array(Wallpaper).min(1),
});

export const DesktopIcon = z.object({
  app: z.string(), // app id from the app registry, or a shortcut id
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
});

export const Shortcut = z.object({
  id: z.string(),
  name: z.string(),
  url: Href,
  icon: z.string().default('link'),
});

/**
 * content/trash.json: items deleted in Dev Mode, restorable from the Recycle
 * Bin for 30 days (older entries are purged on publish).
 */
export const TrashItem = z.object({
  id: z.string(),
  section: z.string(), // e.g. "media.photos", "extras.hobbies", "vault.projects"
  label: z.string(),
  data: z.record(z.string(), z.any()),
  deletedAt: z.string(),
});
export const Trash = z.object({ items: z.array(TrashItem).default([]) });

export const Layout = z.object({
  desktopIcons: z.array(DesktopIcon),
  pinnedTaskbar: z.array(z.string()),
  pinnedStart: z.array(z.string()),
  defaultWallpaper: z.string(), // "auto" or a wallpaper id from media.json
  shortcuts: z.array(Shortcut).default([]),
});
