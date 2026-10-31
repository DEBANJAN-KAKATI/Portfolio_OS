/**
 * Builds what the site shows in Dev Mode: published data + changes already
 * published (waiting for deploy) + staged changes. Vault edits are normalized
 * with the same adapter the build uses, so the preview matches the result.
 */
import { normalizeVault } from '@/data/adapters/jstmyrb.js';

const MINI_VAULT = { personal_info: { name: 'x' }, education: [], coursework: {}, skills: {}, experiences: [], projects: [], patents_certifications: [], pors_achievements: [], awards_medals: [], testimonials: [] };

/** Vault-shaped item → the normalized item the apps render. */
export function normalizeOne(vaultSection, data) {
  const vault = { ...MINI_VAULT, [vaultSection]: [{ ...data }] };
  const n = normalizeVault(vault);
  if (vaultSection === 'projects') {
    const { githubUrl, ...p } = n.projects[0];
    return { ...p, _githubUrl: githubUrl };
  }
  if (vaultSection === 'experiences') return n.experiences[0];
  if (vaultSection === 'education') return n.education[0];
  return n.achievements[0];
}

function applyOp(portfolio, op) {
  const p = portfolio;
  const pending = (item) => ({ ...item, status: 'pending', source: op.op === 'add' ? 'inbox' : item.source ?? 'vault' });

  if (op.section === 'skills') {
    const groups = [...p.skills];
    const idx = groups.findIndex((g) => g.category === op.id);
    if (op.op === 'delete') {
      if (idx >= 0) groups.splice(idx, 1);
    } else {
      const old = new Map((groups[idx]?.skills ?? []).map((s) => [s.name, s]));
      const label = groups[idx]?.label ?? op.id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const skills = (op.data.skills ?? []).map((name, i) => old.get(name) ?? { name, usage: Math.max(20, 70 - i * 6), usageSource: 'vault', bytes: null, repos: 0 });
      const group = { category: op.id, label, skills };
      if (idx >= 0) groups[idx] = group;
      else groups.push(group);
    }
    return { ...p, skills: groups };
  }

  const listKey = { projects: 'projects', experiences: 'experiences', education: 'education' }[op.section] ?? 'achievements';
  const list = [...p[listKey]];
  const idx = list.findIndex((x) => x.id === op.id);
  if (op.op === 'delete') {
    if (idx >= 0) list.splice(idx, 1);
    return { ...p, [listKey]: list };
  }
  let item = normalizeOne(op.section, { ...op.data, id: op.id });
  if (listKey === 'projects') {
    const prev = idx >= 0 ? list[idx] : null;
    const { _githubUrl, ...rest } = item;
    // Keep GitHub stats from the build; the next sync refreshes them.
    item = { ...rest, github: prev?.github ?? null, thumbnail: rest.thumbnail ?? prev?.thumbnail ?? null, demoUrl: rest.demoUrl ?? prev?.demoUrl ?? null };
    if (!item.github && _githubUrl) item.description = null;
  }
  item = pending(item);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  return { ...p, [listKey]: list };
}

/** Replace staged media paths (not yet on the server) with local object URLs, everywhere. */
function withPreviewUrls(value, urls) {
  if (!urls.size) return value;
  const walk = (v) => {
    if (typeof v === 'string') {
      const local = urls.get(v);
      return local ?? v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}

/**
 * @param base    baseData from src/data/store.js
 * @param layers  [{ docs, inboxOps, previewUrls }] oldest first (published-awaiting-deploy, then staged)
 */
export function buildOverlay(base, layers) {
  const docs = { extras: base.extras, media: base.media, layout: base.layout, trash: base.trash };
  let portfolio = base.portfolio;
  const urls = new Map();
  for (const layer of layers) {
    for (const k of Object.keys(docs)) if (layer.docs?.[k]) docs[k] = layer.docs[k];
    for (const op of layer.inboxOps ?? []) portfolio = applyOp(portfolio, op);
    for (const [path, url] of Object.entries(layer.previewUrls ?? {})) urls.set(path, url);
  }
  return withPreviewUrls({ portfolio, ...docs }, urls);
}
