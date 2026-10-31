/**
 * Every content type Dev Mode can add/edit, described once:
 *  - owner 'vault': goes to data/vault.inbox.json (jstMyRB stays the source of truth)
 *  - owner 'doc':   goes straight into content/<doc>.json
 * Forms, quick-add dialogs, menus and drag-and-drop all read from here.
 */
import { slugify } from '@/data/adapters/jstmyrb.js';

const now = () => new Date().toISOString();
const rand = () => Math.random().toString(36).slice(2, 6);
export const newId = (prefix, title) => `${prefix}_${slugify(title || 'item').slice(0, 40)}_${rand()}`;

const ACH_KIND = { patents_certifications: ['patent', 'certification'], pors_achievements: ['por'], awards_medals: ['award'] };

/** Sanitized bullet HTML → editable text: entities decoded, <b> kept. */
export const editable = (html) => String(html ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const tiersOf = (b) => ({ 1: (b?.[1] ?? []).map(editable), 2: (b?.[2] ?? []).map(editable), 3: (b?.[3] ?? []).map(editable) });
const tierItem = (tiers) => {
  const t = { 1: tiers[1].filter(Boolean), 2: tiers[2].filter(Boolean), 3: tiers[3].filter(Boolean) };
  return { bullets: t[2].length ? t[2] : t[3].length ? t[3] : t[1], points_tier: t, selected_tier: '2' };
};
const visibility = (hidden) => (hidden ? 'private' : 'public');

/** Field types: text, textarea, markdown, tags, tiers, url, image, images, select, toggle, list, model, video */
export const SECTIONS = {
  projects: {
    label: 'Projects',
    one: 'Project',
    owner: 'vault',
    vault: 'projects',
    appId: 'projects',
    idPrefix: 'proj_dm',
    mediaDir: 'projects',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, quick: true },
      { key: 'context', label: 'Subtitle / context', type: 'text', quick: true, placeholder: 'e.g. Flood early-warning · SIH 2025' },
      { key: 'tiers', label: 'Bullets (1 / 2 / 3 points, like jstMyRB)', type: 'tiers', required: true, quick: true },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'github_url', label: 'GitHub URL', type: 'url', quick: true },
      { key: 'repo_hint', label: 'Planned repo name (not pushed yet)', type: 'text' },
      { key: 'demo_url', label: 'Live demo URL', type: 'url' },
      { key: 'video_url', label: 'Demo video URL', type: 'url' },
      { key: 'model_url', label: '3D model URL (.glb)', type: 'url' },
      { key: 'thumbnail', label: 'Thumbnail', type: 'image', aspect: 16 / 9 },
      { key: 'images', label: 'Screenshots', type: 'images' },
      { key: 'start_date', label: 'Start (YYYY-MM)', type: 'text' },
      { key: 'end_date', label: 'End (YYYY-MM)', type: 'text' },
      { key: 'featured', label: 'Featured', type: 'toggle' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    list: (s) => s.portfolio.projects,
    titleOf: (p) => p.title,
    subtitleOf: (p) => (p.status === 'draft' ? 'GitHub draft' : p.context),
    toForm: (p) => ({
      title: p.title,
      context: p.context,
      tiers: tiersOf(p.bullets),
      tags: [...p.tags],
      github_url: p.github?.url ?? '',
      repo_hint: p.plannedRepo ?? '',
      demo_url: p.demoUrl ?? '',
      video_url: p.videoUrl ?? '',
      model_url: p.modelUrl ?? '',
      thumbnail: p.thumbnail && !p.thumbnail.includes('opengraph') ? p.thumbnail : '',
      images: [...p.images],
      start_date: p.startDate ?? '',
      end_date: p.endDate ?? '',
      featured: p.featured,
      hidden: p.hidden,
    }),
    fromForm: (f, id) => ({
      id,
      title: f.title.trim(),
      context: f.context ?? '',
      tags: f.tags ?? [],
      ...tierItem(f.tiers),
      ...(f.github_url ? { github_url: f.github_url } : {}),
      ...(f.repo_hint ? { repo_hint: f.repo_hint } : {}),
      ...(f.demo_url ? { demo_url: f.demo_url } : {}),
      ...(f.video_url ? { video_url: f.video_url } : {}),
      ...(f.model_url ? { model_url: f.model_url } : {}),
      ...(f.thumbnail ? { thumbnail: f.thumbnail } : {}),
      images: f.images ?? [],
      ...(f.start_date ? { start_date: f.start_date } : {}),
      ...(f.end_date ? { end_date: f.end_date } : {}),
      featured: Boolean(f.featured),
      visibility: visibility(f.hidden),
      updated_at: now(),
    }),
    blank: () => ({ title: '', context: '', tiers: { 1: [''], 2: ['', ''], 3: ['', '', ''] }, tags: [], images: [], featured: false, hidden: false }),
  },

  experiences: {
    label: 'Work experience',
    one: 'Work experience',
    owner: 'vault',
    vault: 'experiences',
    appId: 'experience',
    idPrefix: 'exp_dm',
    fields: [
      { key: 'role', label: 'Role', type: 'text', required: true, quick: true },
      { key: 'company', label: 'Company', type: 'text', required: true, quick: true },
      { key: 'duration', label: 'Duration', type: 'text', required: true, quick: true, placeholder: 'May 2026 – Jul 2026' },
      { key: 'location', label: 'Location', type: 'text', quick: true },
      { key: 'tiers', label: 'Bullets (1 / 2 / 3 points)', type: 'tiers', required: true },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'featured', label: 'Featured', type: 'toggle' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    list: (s) => s.portfolio.experiences,
    titleOf: (e) => `${e.role} @ ${e.company}`,
    subtitleOf: (e) => e.duration,
    toForm: (e) => ({ role: e.role, company: e.company, duration: e.duration, location: e.location ?? '', tiers: tiersOf(e.bullets), tags: [...e.tags], featured: e.featured, hidden: e.hidden }),
    fromForm: (f, id) => ({ id, role: f.role.trim(), company: f.company.trim(), duration: f.duration, location: f.location ?? '', tags: f.tags ?? [], ...tierItem(f.tiers), featured: Boolean(f.featured), visibility: visibility(f.hidden), updated_at: now() }),
    blank: () => ({ role: '', company: '', duration: '', location: '', tiers: { 1: [''], 2: ['', ''], 3: ['', '', ''] }, tags: [], featured: false, hidden: false }),
  },

  skills: {
    label: 'Skills',
    one: 'Skill category',
    owner: 'vault',
    vault: 'skills',
    appId: 'skills',
    fields: [
      { key: 'category', label: 'Category id', type: 'text', required: true, quick: true, placeholder: 'e.g. ai_ml' },
      { key: 'skills', label: 'Skills', type: 'list', required: true, quick: true, placeholder: 'Add a skill' },
    ],
    list: (s) => s.portfolio.skills.map((g) => ({ ...g, id: g.category })),
    titleOf: (g) => g.label,
    subtitleOf: (g) => `${g.skills.length} skills`,
    toForm: (g) => ({ category: g.category, skills: g.skills.map((s) => s.name) }),
    fromForm: (f) => ({ category: f.category.trim(), skills: (f.skills ?? []).map((s) => s.trim()).filter(Boolean) }),
    idOf: (f) => f.category.trim(),
    blank: () => ({ category: '', skills: [''] }),
  },

  education: {
    label: 'Education',
    one: 'Education',
    owner: 'vault',
    vault: 'education',
    appId: 'education',
    idPrefix: 'edu_dm',
    fields: [
      { key: 'institution', label: 'Institution', type: 'text', required: true, quick: true },
      { key: 'degree', label: 'Degree', type: 'text', required: true, quick: true },
      { key: 'duration', label: 'Duration', type: 'text', quick: true },
      { key: 'gpa', label: 'GPA', type: 'text' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    list: (s) => s.portfolio.education,
    titleOf: (e) => e.institution,
    subtitleOf: (e) => e.degree,
    toForm: (e) => ({ institution: e.institution, degree: e.degree, duration: e.duration, gpa: e.gpa ?? '', location: e.location ?? '', hidden: e.hidden }),
    fromForm: (f, id) => ({ id, institution: f.institution.trim(), degree: f.degree, duration: f.duration ?? '', gpa: f.gpa || null, location: f.location || null, visibility: visibility(f.hidden), updated_at: now() }),
    blank: () => ({ institution: '', degree: '', duration: '', gpa: '', location: '', hidden: false }),
  },

  achievements: {
    label: 'Achievements',
    one: 'Achievement',
    owner: 'vault',
    appId: 'achievements',
    idPrefix: 'ach_dm',
    mediaDir: 'achievements',
    // the vault section depends on the kind picked in the form
    vaultOf: (f) => (f.kind === 'por' ? 'pors_achievements' : f.kind === 'award' ? 'awards_medals' : 'patents_certifications'),
    fields: [
      { key: 'kind', label: 'Kind', type: 'select', required: true, quick: true, options: [['certification', 'Certification'], ['patent', 'Patent'], ['award', 'Award / medal'], ['por', 'Position of responsibility']] },
      { key: 'title', label: 'Title', type: 'text', required: true, quick: true },
      { key: 'details', label: 'Details', type: 'textarea', quick: true },
      { key: 'url', label: 'Link (verify)', type: 'url' },
      { key: 'image', label: 'Certificate image', type: 'image', aspect: 4 / 3 },
      { key: 'date', label: 'Date', type: 'text' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    list: (s) => s.portfolio.achievements,
    titleOf: (a) => a.title,
    subtitleOf: (a) => a.label,
    toForm: (a) => ({ kind: a.kind, title: a.title, details: editable(a.details), url: a.url ?? '', image: a.image ?? '', date: a.date ?? '', hidden: a.hidden }),
    fromForm: (f, id) => ({
      id,
      ...(f.kind === 'patent' || f.kind === 'certification' ? { type: f.kind === 'patent' ? 'Patent' : 'Certification' } : {}),
      title: f.title.trim(),
      details: f.details ?? '',
      ...(f.url ? { url: f.url } : {}),
      ...(f.image ? { image: f.image } : {}),
      ...(f.date ? { date: f.date } : {}),
      visibility: visibility(f.hidden),
      updated_at: now(),
    }),
    blank: () => ({ kind: 'certification', title: '', details: '', hidden: false }),
  },

  hobbies: {
    label: 'Hobbies',
    one: 'Hobby',
    owner: 'doc',
    doc: 'extras',
    listKey: 'hobbies',
    appId: 'hobbies',
    idPrefix: 'hobby',
    mediaDir: 'hobbies',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, quick: true },
      { key: 'icon', label: 'Icon (emoji)', type: 'text', required: true, quick: true, placeholder: '🎸' },
      { key: 'blurb', label: 'Blurb', type: 'textarea', required: true, quick: true },
      { key: 'funFact', label: 'Fun fact', type: 'text' },
      { key: 'url', label: 'Link (e.g. Spotify)', type: 'url' },
      { key: 'urlLabel', label: 'Link button text', type: 'text', placeholder: 'Open my Spotify' },
      { key: 'projects', label: 'Projects', type: 'list', placeholder: 'Add a project' },
      { key: 'projectsNote', label: 'Projects note', type: 'text', placeholder: 'Coming soon' },
      { key: 'images', label: 'Images', type: 'images' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    blank: () => ({ name: '', icon: '✨', blurb: '', funFact: '', url: '', urlLabel: '', projects: [], projectsNote: '', images: [], hidden: false }),
  },

  casualWorks: {
    label: 'Casual works',
    one: 'Casual work',
    owner: 'doc',
    doc: 'extras',
    listKey: 'casualWorks',
    appId: 'casual',
    idPrefix: 'cw',
    mediaDir: 'casual',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, quick: true },
      { key: 'kind', label: 'Kind', type: 'select', required: true, quick: true, options: [['experiment', 'Experiment'], ['blog', 'Blog post'], ['doodle', 'Doodle'], ['build', 'Side build']] },
      { key: 'description', label: 'Short description', type: 'textarea', required: true, quick: true },
      { key: 'body', label: 'Post (markdown)', type: 'markdown' },
      { key: 'url', label: 'Link', type: 'url' },
      { key: 'image', label: 'Cover image', type: 'image', aspect: 4 / 3 },
      { key: 'date', label: 'Date (YYYY-MM-DD)', type: 'text' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    blank: () => ({ title: '', kind: 'experiment', description: '', body: '', url: null, image: null, date: new Date().toISOString().slice(0, 10), hidden: false }),
  },

  photos: {
    label: 'Photos',
    one: 'Photo',
    owner: 'doc',
    doc: 'media',
    listKey: 'photos',
    appId: 'photos',
    idPrefix: 'ph',
    mediaDir: 'photos',
    fields: [
      { key: 'src', label: 'Photo', type: 'image', required: true, quick: true, withThumb: true },
      { key: 'caption', label: 'Caption', type: 'text', quick: true },
      { key: 'album', label: 'Album', type: 'text', quick: true },
      { key: 'date', label: 'Date (YYYY-MM-DD)', type: 'text' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    titleOf: (p) => p.caption || p.src.split('/').pop(),
    subtitleOf: (p) => p.album,
    blank: () => ({ src: '', thumb: null, caption: '', album: 'General', date: new Date().toISOString().slice(0, 10), hidden: false }),
  },

  videos: {
    label: 'Videos',
    one: 'Video',
    owner: 'doc',
    doc: 'media',
    listKey: 'videos',
    appId: 'videos',
    idPrefix: 'vid',
    mediaDir: 'videos',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, quick: true },
      { key: 'type', label: 'Source', type: 'select', required: true, quick: true, options: [['youtube', 'YouTube'], ['vimeo', 'Vimeo'], ['mp4', 'Video file (mp4/webm)']] },
      { key: 'src', label: 'URL or file', type: 'video', required: true, quick: true },
      { key: 'poster', label: 'Poster image', type: 'image', aspect: 16 / 9 },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    blank: () => ({ title: '', type: 'youtube', src: '', poster: null, description: '', duration: null, hidden: false }),
  },

  models: {
    label: '3D models',
    one: '3D model',
    owner: 'doc',
    doc: 'media',
    listKey: 'models',
    appId: 'viewer3d',
    idPrefix: 'model',
    mediaDir: 'models',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, quick: true },
      { key: 'src', label: '.glb file', type: 'model', required: true, quick: true },
      { key: 'poster', label: 'Thumbnail', type: 'image', aspect: 16 / 9 },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    blank: () => ({ title: '', src: '', poster: null, description: '', hidden: false }),
  },

  renders: {
    label: '3D renders',
    one: '3D render',
    owner: 'doc',
    doc: 'media',
    listKey: 'renders',
    appId: 'viewer3d',
    idPrefix: 'render',
    mediaDir: 'renders',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, quick: true },
      { key: 'src', label: 'Image', type: 'image', required: true, quick: true },
      { key: 'hidden', label: 'Hidden from visitors', type: 'toggle' },
    ],
    blank: () => ({ title: '', src: '', hidden: false }),
  },

  wallpapers: {
    label: 'Wallpapers',
    one: 'Wallpaper',
    owner: 'doc',
    doc: 'media',
    listKey: 'wallpapers',
    idPrefix: 'wp',
    mediaDir: 'wallpapers',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, quick: true },
      { key: 'src', label: 'Image', type: 'image', required: true, quick: true },
      { key: 'timeOfDay', label: 'Used for (automatic mode)', type: 'select', options: [['', 'Not automatic'], ['morning', 'Morning'], ['evening', 'Evening'], ['night', 'Night']] },
    ],
    titleOf: (w) => w.name,
    blank: () => ({ name: '', src: '', timeOfDay: null }),
  },

  shortcuts: {
    label: 'Desktop shortcuts',
    one: 'Desktop shortcut',
    owner: 'doc',
    doc: 'layout',
    listKey: 'shortcuts',
    idPrefix: 'sc',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, quick: true },
      { key: 'url', label: 'URL', type: 'url', required: true, quick: true },
      { key: 'icon', label: 'Icon', type: 'select', quick: true, options: [['link', 'Link'], ['github', 'GitHub'], ['linkedin', 'LinkedIn']] },
    ],
    titleOf: (s) => s.name,
    subtitleOf: (s) => s.url,
    blank: () => ({ name: '', url: 'https://', icon: 'link' }),
  },
};

// Defaults for doc sections.
for (const [key, sec] of Object.entries(SECTIONS)) {
  sec.key = key;
  if (sec.owner === 'doc') {
    sec.list ??= (s) => s[sec.doc][sec.listKey];
    sec.titleOf ??= (i) => i.title ?? i.name ?? i.id;
    sec.subtitleOf ??= (i) => i.description ?? i.kind ?? '';
    sec.toForm ??= (i) => {
      const { id, ...rest } = i;
      return structuredClone(rest);
    };
    sec.fromForm ??= (f, id) => {
      const out = { id, ...f };
      for (const k of Object.keys(out)) {
        if (out[k] === '' && !['caption', 'description', 'funFact', 'body'].includes(k)) out[k] = null;
        else if (Array.isArray(out[k])) out[k] = out[k].filter((x) => typeof x !== 'string' || x.trim());
      }
      if ('timeOfDay' in out && !out.timeOfDay) out.timeOfDay = null;
      return out;
    };
  }
}

export const vaultSectionOf = (sec, form, item) => sec.vault ?? sec.vaultOf?.(form ?? { kind: item?.kind });

/** Which section a normalized achievement kind maps to. */
export const achievementVault = (kind) => Object.entries(ACH_KIND).find(([, kinds]) => kinds.includes(kind))?.[0];

/** Check required fields; returns a list of problems. */
export function validateForm(sec, form) {
  const problems = [];
  for (const f of sec.fields) {
    if (!f.required) continue;
    const v = form[f.key];
    const empty = f.type === 'tiers' ? !(v?.[1]?.some((x) => x?.trim()) || v?.[3]?.some((x) => x?.trim())) : Array.isArray(v) ? !v.some((x) => String(x ?? '').trim()) : !String(v ?? '').trim();
    if (empty) problems.push(`${f.label} is required`);
  }
  for (const f of sec.fields) {
    if (f.type === 'url' && form[f.key] && !/^https?:\/\/\S+$/i.test(form[f.key])) problems.push(`${f.label} must start with http(s)://`);
  }
  return problems;
}
