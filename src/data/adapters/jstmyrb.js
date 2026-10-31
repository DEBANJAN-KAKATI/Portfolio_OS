/**
 * Adapter for jstMyRB's "Career Storage Vault" format (data/profile_store.json,
 * GET /api/profile/export and the public GET /api/portfolio/export).
 *
 * parseVault()      raw JSON -> validated Vault (throws a readable error)
 * toPublicVault()   allow-list filter: no phone, no private items, no templated bullets
 * normalizeVault()  Vault -> the vault-owned parts of the Portfolio shape
 */
import { Vault } from '../schemas/vault.js';
import { sanitizeInline, boldSegments, stripTags } from '../sanitize.js';
import { formatZodError } from '../validate.js';

export function parseVault(raw) {
  const result = Vault.safeParse(raw);
  if (!result.success) throw new Error(`Vault data is invalid:\n${formatZodError(result.error)}`);
  return result.data;
}

const isPublic = (item) => item?.visibility !== 'private';
// Whole items flagged by jstMyRB (section 11A step 4) as having generated bullets.
const isTrustworthy = (item) => item?.bullets_source !== 'template';

/**
 * Filler sentences jstMyRB writes when it has nothing real to say
 * (agent/github_tracker.py's rule-based fallback and enrich_store.py's tier
 * padding). They contain invented metrics ("99.9% uptime", "~35%", "2+ weeks"),
 * so they are dropped bullet by bullet, even before the vault flags them.
 */
const TEMPLATE_BULLETS = [
  /^Engineered an enterprise-grade .+ system for /i,
  /reducing computational overhead by ~35% across stress tests/i,
  /accelerating deployment cycle by 2\+ weeks/i,
  /^Engineered production deployment pipeline with continuous benchmarking\.?$/i,
  /^Deployed modular microservices with comprehensive automated testing\.?$/i,
  /^Architected end-to-end system for .+, optimizing latency and throughput\.?$/i,
  /^Led core initiatives at .+, boosting operational speed\.?$/i,
  /^Engineered end-to-end data pipelines for executive analytics\.?$/i,
  /^Automated reporting workflows saving 50%\+ engineering bandwidth\.?$/i,
  /^Engineered an end-to-end \S+ solution for .+, ensuring modular architecture and high test coverage\.?$/i,
  /^Implemented core algorithmic logic integrating \S+, optimizing throughput and runtime performance under production workloads\.?$/i,
];

export const isTemplateBullet = (html) => {
  const text = stripTags(html).trim();
  return TEMPLATE_BULLETS.some((rx) => rx.test(text));
};

function withoutTemplateBullets(item) {
  const real = (list) => (Array.isArray(list) ? list.filter((b) => typeof b === 'string' && !isTemplateBullet(b)) : list);
  const out = { ...item, bullets: real(item.bullets ?? []) };
  if (item.points_tier) out.points_tier = Object.fromEntries(Object.entries(item.points_tier).map(([k, v]) => [k, real(v ?? [])]));
  return out;
}

const hasBullets = (item) => (item.bullets?.length ?? 0) + Object.values(item.points_tier ?? {}).flat().length > 0;

const pick = (item, keys) => Object.fromEntries(keys.filter((k) => item[k] !== undefined).map((k) => [k, item[k]]));

// Per-section allow-lists: only these fields ever leave the vault. "__status"/"__source"
// are internal markers set by applyInbox() for Dev Mode edits.
const ITEM_COMMON = [
  'id', 'tags', 'visibility', 'featured', 'thumbnail', 'images', 'demo_url', 'video_url', 'model_url',
  'start_date', 'end_date', 'updated_at', '__status', '__source',
];
const FIELDS = {
  education: ['institution', 'degree', 'duration', 'gpa', 'location', ...ITEM_COMMON],
  experiences: ['role', 'company', 'duration', 'location', 'bullets', 'points_tier', 'selected_tier', ...ITEM_COMMON],
  projects: ['title', 'context', 'bullets', 'points_tier', 'selected_tier', 'github_url', 'repo_hint', ...ITEM_COMMON],
  patents_certifications: ['type', 'title', 'details', 'url', 'image', 'date', ...ITEM_COMMON],
  pors_achievements: ['title', 'details', 'url', 'image', 'date', ...ITEM_COMMON],
  awards_medals: ['title', 'details', 'url', 'image', 'date', ...ITEM_COMMON],
  testimonials: ['id', 'author', 'headline', 'relationship', 'text', 'date', 'approved'],
};
const META_FIELDS = ['source', 'exported_at', 'schema_version', 'sample', 'linkedin_imported_at', 'note'];

/** "Open Source System | GitHub: QR-Chat" -> https://github.com/<user>/QR-Chat (jstMyRB's own convention) */
function inferGithubUrl(project, githubProfile) {
  if (project.github_url || !githubProfile) return project;
  const name = String(project.context ?? '').match(/GitHub:\s*([A-Za-z0-9._-]+)/)?.[1];
  return name ? { ...project, github_url: `${githubProfile.replace(/\/+$/, '')}/${name}` } : project;
}

/**
 * Builds the public-safe vault from an allow-list. jstMyRB's export applies the
 * same rules, but a raw profile_store.json dropped into the repo must not leak either:
 * no phone, no unlisted fields/sections, no private items, no template bullets.
 */
export function toPublicVault(vault, { showEmail = false, showGpa = true } = {}) {
  const { personal_info: p } = vault;
  const section = (name, list) => list.filter(isPublic).map((item) => pick(item, FIELDS[name]));
  const cleaned = (list) => list.filter(isTrustworthy).map(withoutTemplateBullets);
  return {
    ...(vault.meta ? { meta: pick(vault.meta, META_FIELDS) } : {}),
    personal_info: {
      name: p.name,
      email: showEmail ? (p.email ?? null) : null,
      linkedin: p.linkedin ?? null,
      github: p.github ?? null,
      location: p.location ?? null,
    },
    education: section('education', vault.education).map((e) => ({ ...e, gpa: showGpa && e.gpa ? e.gpa : null })),
    coursework: vault.coursework,
    skills: vault.skills,
    experiences: section('experiences', cleaned(vault.experiences)),
    // A project left with no real bullets survives only if GitHub can describe it.
    projects: section('projects', cleaned(vault.projects).map((pr) => inferGithubUrl(pr, p.github))).filter(
      (pr) => hasBullets(pr) || pr.github_url || pr.repo_hint,
    ),
    patents_certifications: section('patents_certifications', vault.patents_certifications),
    pors_achievements: section('pors_achievements', vault.pors_achievements),
    awards_medals: section('awards_medals', vault.awards_medals),
    testimonials: section('testimonials', vault.testimonials.filter((t) => t.approved)),
  };
}

export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

const ACRONYMS = new Set(['ai', 'ml', 'sde', 'sql', 'api', 'ui', 'ux', 'nlp', 'cv', 'llm', 'rag', 'gpu', 'os']);
const LABELS = { ai_ml: 'AI / ML', full_stack: 'Full Stack', computing_ai: 'Computing & AI', frameworks_web: 'Frameworks & Web' };

/** "frameworks_web" -> "Frameworks & Web", "ai_ml" -> "AI / ML", "data_systems" -> "Data Systems" */
export function humanizeKey(key) {
  if (LABELS[key]) return LABELS[key];
  return String(key)
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Always returns all three tiers. Missing tiers are derived from the richest one available. */
export function bulletTiers(item) {
  const pt = item.points_tier ?? {};
  const richest = pt['3']?.length ? pt['3'] : pt['2']?.length ? pt['2'] : pt['1']?.length ? pt['1'] : item.bullets ?? [];
  const tier = (k, n) => (pt[k]?.length ? pt[k] : richest.slice(0, n));
  const clean = (list) => list.map(sanitizeInline).filter((b) => b.trim().length > 0);
  return { 1: clean(tier('1', 1)), 2: clean(tier('2', 2)), 3: clean(tier('3', richest.length)) };
}

// Technologies recognised in bullets even when they are not listed under vault skills.
const TECH_DICTIONARY = [
  'Python', 'C', 'C++', 'C#', 'Java', 'Kotlin', 'Swift', 'Go', 'Rust', 'R', 'SQL', 'MATLAB', 'Simulink', 'JavaScript', 'TypeScript',
  'HTML', 'CSS', 'Bash', 'FastAPI', 'Flask', 'Django', 'React', 'React Native', 'Next.js', 'Vue', 'Svelte', 'Node.js', 'Express',
  'Tailwind', 'Three.js', 'WebGL', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Vercel', 'Firebase', 'Supabase', 'PostgreSQL',
  'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Kafka', 'GraphQL', 'gRPC', 'Pandas', 'NumPy', 'SciPy', 'scikit-learn', 'PyTorch',
  'TensorFlow', 'Keras', 'OpenCV', 'Hugging Face', 'LangChain', 'Gemini', 'OpenAI', 'Claude', 'LLM', 'RAG', 'BM25', 'CNN', 'Grad-CAM',
  'Transformers', 'XGBoost', 'PWA', 'Jupyter', 'Linux', 'Git', 'Blender', 'Unity', 'Electron',
];

/**
 * Technologies highlighted in bullets: <b>Python</b> and <b>C++20</b> yes;
 * metrics (<b>65%</b>) and non-tech emphasis (<b>Assam</b>) no.
 */
export function extractTech(bullets, knownSkills = []) {
  const known = new Map([...TECH_DICTIONARY, ...knownSkills].map((s) => [s.toLowerCase(), s]));
  const seen = new Map();
  for (const seg of bullets.flatMap(boldSegments)) {
    const k = seg.toLowerCase().replace(/(\+\+)\d+$/, '$1'); // C++20 -> c++
    const canonical = known.get(k) ?? known.get(k.replace(/s$/, '')); // "CNNs" -> CNN
    if (canonical && !seen.has(canonical.toLowerCase())) seen.set(canonical.toLowerCase(), canonical);
  }
  return [...seen.values()];
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function parseMonthYear(text) {
  const t = text.trim().toLowerCase();
  if (/present|current|now|ongoing/.test(t)) return null;
  const m = t.match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MONTHS[m[1]]) return `${m[2]}-${String(MONTHS[m[1]]).padStart(2, '0')}`;
  const y = t.match(/(\d{4})/);
  return y ? y[1] : null;
}

/** "May 2024 – Jul 2024" -> { start: "2024-05", end: "2024-07" }; "2023 – Present" -> end null */
export function parseDuration(duration, startDate, endDate) {
  if (startDate || endDate) return { start: startDate ?? null, end: endDate ?? null };
  const parts = String(duration ?? '').split(/\s*(?:–|—|-|to)\s*/i).filter(Boolean);
  if (!parts.length) return { start: null, end: null };
  return { start: parseMonthYear(parts[0]), end: parts.length > 1 ? parseMonthYear(parts[1]) : null };
}

const flags = (item, status = 'published', source = 'vault') => ({
  status: item.__status ?? status,
  source: item.__source ?? source,
  featured: Boolean(item.featured),
  hidden: item.visibility === 'private',
  vaultUpdatedAt: item.updated_at ?? null,
});

const ACHIEVEMENT_LABELS = { patent: 'Patent', certification: 'Certification', por: 'Position of Responsibility', award: 'Award' };

export function normalizeVault(vault) {
  const p = vault.personal_info;
  const allSkills = Object.values(vault.skills).flat();

  const education = vault.education.map((e) => {
    const d = parseDuration(e.duration, e.start_date, e.end_date);
    return {
      id: e.id ?? `edu_${slugify(e.institution)}`,
      institution: e.institution,
      degree: e.degree,
      duration: e.duration ?? '',
      gpa: e.gpa ?? null,
      location: e.location ?? null,
      startDate: d.start,
      endDate: d.end,
      ...flags(e),
    };
  });

  const experiences = vault.experiences.map((e) => {
    const bullets = bulletTiers(e);
    const d = parseDuration(e.duration, e.start_date, e.end_date);
    return {
      id: e.id,
      role: e.role,
      company: e.company,
      duration: e.duration ?? '',
      location: e.location ?? null,
      tags: e.tags,
      bullets,
      tech: extractTech(bullets[3], allSkills),
      thumbnail: e.thumbnail || null,
      startDate: d.start,
      endDate: d.end,
      ...flags(e),
    };
  });

  const projects = vault.projects.map((pr) => {
    const bullets = bulletTiers(pr);
    const d = parseDuration('', pr.start_date, pr.end_date);
    return {
      id: pr.id,
      title: pr.title,
      context: pr.context ?? '',
      description: null,
      tags: pr.tags,
      category: null,
      bullets,
      tech: extractTech(bullets[3], allSkills),
      github: null,
      thumbnail: pr.thumbnail || null,
      images: Array.isArray(pr.images) ? pr.images.filter((s) => typeof s === 'string') : [],
      demoUrl: pr.demo_url || null,
      videoUrl: pr.video_url || null,
      modelUrl: pr.model_url || null,
      startDate: d.start,
      endDate: d.end,
      updatedAt: pr.updated_at ?? null,
      isNew: false,
      plannedRepo: pr.repo_hint || null, // not on GitHub yet; matched by name once pushed
      githubUrl: pr.github_url || null, // consumed by mergePortfolio, then removed
      ...flags(pr),
    };
  });

  const achievement = (kind) => (a) => ({
    id: a.id ?? `${kind}_${slugify(a.title)}`,
    kind,
    label: kind === 'patent' || kind === 'certification' ? a.type || ACHIEVEMENT_LABELS[kind] : ACHIEVEMENT_LABELS[kind],
    title: a.title,
    details: sanitizeInline(a.details ?? ''),
    url: a.url || null,
    image: a.image || null,
    date: a.date ?? null,
    ...flags(a),
  });

  return {
    profile: {
      name: p.name,
      email: p.email ?? null,
      location: p.location ?? null,
      linkedin: p.linkedin ?? null,
      github: p.github ?? null,
      avatar: null,
    },
    education,
    coursework: Object.entries(vault.coursework).map(([category, courses]) => ({
      category,
      label: humanizeKey(category),
      courses,
    })),
    skillLists: Object.entries(vault.skills).map(([category, skills]) => ({ category, label: humanizeKey(category), skills })),
    experiences,
    projects,
    achievements: [
      ...vault.patents_certifications.map((a) =>
        achievement(/patent/i.test(a.type ?? '') ? 'patent' : 'certification')(a),
      ),
      ...vault.pors_achievements.map(achievement('por')),
      ...vault.awards_medals.map(achievement('award')),
    ],
    testimonials: vault.testimonials
      .filter((t) => t.approved)
      .map((t) => ({
        id: t.id,
        author: t.author,
        headline: t.headline ?? null,
        relationship: t.relationship ?? null,
        text: t.text,
        date: t.date ?? null,
      })),
  };
}
