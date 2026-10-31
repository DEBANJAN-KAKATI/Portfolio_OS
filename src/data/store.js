/**
 * Browser data layer. Everything the apps render comes from here, never from
 * hard-coded text. Dev Mode layers staged changes on top via applyOverlay();
 * visitors only ever see the validated base data.
 */
import { create } from 'zustand';
import portfolioJson from './generated/portfolio.json';
import changelogJson from './generated/changelog.json';
import extrasJson from '../../content/extras.json';
import mediaJson from '../../content/media.json';
import layoutJson from '../../content/layout.json';
import trashJson from '../../content/trash.json';
import { Portfolio, Changelog, Extras, Media, Layout, Trash } from './schemas/index.js';
import { formatZodError } from './validate.js';

function load(schema, data, label) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  // `npm run build` validates first, so this only fires while editing JSON in dev.
  console.error(`[data] ${label} failed validation:\n${formatZodError(result.error)}`);
  return data;
}

const base = {
  portfolio: load(Portfolio, portfolioJson, 'src/data/generated/portfolio.json'),
  changelog: load(Changelog, changelogJson, 'src/data/generated/changelog.json'),
  extras: load(Extras, extrasJson, 'content/extras.json'),
  media: load(Media, mediaJson, 'content/media.json'),
  layout: load(Layout, layoutJson, 'content/layout.json'),
  trash: load(Trash, trashJson, 'content/trash.json'),
};

/** The published data, untouched by Dev Mode overlays. */
export const baseData = base;

export const useData = create((set) => ({
  ...base,
  /** Replace whole slices, e.g. { extras: {...} } from Dev Mode's staged edits. */
  applyOverlay: (patch) => set((state) => ({ ...state, ...patch })),
  resetOverlay: () => set(base),
}));

// ---- Selectors (visitor view: drafts and hidden items filtered out) ----

export const selectProjects = (s, { includeDrafts = false, includeHidden = false } = {}) =>
  s.portfolio.projects.filter((p) => (includeHidden || !p.hidden) && (includeDrafts || p.status !== 'draft'));

export const selectProjectTags = (s) => {
  const counts = new Map();
  for (const p of selectProjects(s)) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
};

export const selectRecommended = (s, n = 4) =>
  [...selectProjects(s)].sort((a, b) => Number(b.isNew) - Number(a.isNew)).slice(0, n);

export const selectAllSkills = (s) => s.portfolio.skills.flatMap((g) => g.skills.map((sk) => ({ ...sk, category: g.label })));

/** Changelog entries newer than an ISO timestamp (for the "updates since your last visit" toast). */
export const selectUpdatesSince = (s, since) => s.changelog.entries.filter((e) => !since || e.date > since);
