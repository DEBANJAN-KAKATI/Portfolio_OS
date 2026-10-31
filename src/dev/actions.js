/**
 * High-level Dev Mode operations. Every change is staged (src/dev/store.js)
 * and goes live only on Publish.
 */
import { useData } from '@/data/store.js';
import { useSystem } from '@/os/store/system.js';
import { useStaging } from './store.js';
import { SECTIONS, newId, vaultSectionOf, achievementVault, validateForm } from './sections.js';
import { processImage, fileSlug } from './processing.js';

const S = () => useStaging.getState();
const notify = (title, body) => useSystem.getState().notify({ title, body, sound: null, appId: 'studio' });

/** Normalized item (as rendered) → vault section it lives in. */
export function vaultSectionForItem(sec, item) {
  if (sec.key === 'achievements') return achievementVault(item.kind);
  return sec.vault;
}

/**
 * Add or update an item from form values.
 * @param {string} secKey     key in SECTIONS
 * @param {object} form       field values
 * @param {object} [existing] the item being edited (normalized for vault sections)
 * @returns {string} id
 */
export function saveItem(secKey, form, existing) {
  const sec = SECTIONS[secKey];
  const problems = validateForm(sec, form);
  if (problems.length) throw new Error(problems.join(' · '));
  const title = sec.owner === 'vault' ? (form.title ?? form.role ?? form.institution ?? form.category) : (form.title ?? form.name ?? form.caption ?? 'item');

  if (sec.owner === 'vault') {
    const id = sec.idOf ? sec.idOf(form) : existing?.id ?? newId(sec.idPrefix, title);
    const section = vaultSectionOf(sec, form, existing);
    const prevSection = existing ? vaultSectionForItem(sec, existing) : section;
    // An achievement whose kind changed moves between vault sections.
    if (existing && prevSection && prevSection !== section) S().inbox({ op: 'delete', section: prevSection, id: existing.id }, `Move ${title}`);
    const isNew = !existing || existing.status === 'draft' || existing.source === 'github' || prevSection !== section;
    S().inbox(
      { op: isNew ? 'add' : 'edit', section, id, data: sec.fromForm(form, id), base_updated_at: existing?.vaultUpdatedAt ?? null },
      `${isNew ? 'Add' : 'Edit'} ${sec.one.toLowerCase()}: ${title}`,
    );
    return id;
  }

  const id = existing?.id ?? newId(sec.idPrefix, title);
  S().editDoc(
    sec.doc,
    (d) => {
      const list = d[sec.listKey];
      const item = sec.fromForm(form, id);
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) list[i] = { ...list[i], ...item };
      else list.unshift(item);
    },
    `${existing ? 'Edit' : 'Add'} ${sec.one.toLowerCase()}: ${title}`,
  );
  return id;
}

export function deleteItem(secKey, item) {
  const sec = SECTIONS[secKey];
  const title = sec.titleOf(item);
  if (sec.owner === 'vault') {
    const section = vaultSectionForItem(sec, item);
    if (item.status !== 'draft') S().trash(`vault.${section}`, { ...sec.fromForm(sec.toForm(item), item.id), id: item.id }, title);
    S().inbox({ op: 'delete', section, id: item.id }, `Delete ${sec.one.toLowerCase()}: ${title}`);
  } else {
    S().trash(`${sec.doc}.${sec.listKey}`, item, title);
    S().editDoc(sec.doc, (d) => (d[sec.listKey] = d[sec.listKey].filter((x) => x.id !== item.id)), `Delete ${sec.one.toLowerCase()}: ${title}`);
  }
  notify(`${title} moved to the Recycle Bin`, 'Restore it from the Recycle Bin within 30 days.');
}

export function restoreFromTrash(entry) {
  const [owner, key] = entry.section.split('.');
  if (owner === 'vault') {
    S().inbox({ op: 'add', section: key, id: entry.data.id ?? entry.id, data: entry.data }, `Restore ${entry.label}`);
  } else {
    S().editDoc(owner, (d) => {
      d[key] = [entry.data, ...(d[key] ?? []).filter((x) => x.id !== entry.data.id)];
    }, `Restore ${entry.label}`);
  }
  S().editDoc('trash', (t) => (t.items = t.items.filter((i) => !(i.id === entry.id && i.deletedAt === entry.deletedAt))));
}

export function patchItem(secKey, item, patch, label) {
  const sec = SECTIONS[secKey];
  return saveItem(secKey, { ...sec.toForm(item), ...patch }, item, label);
}

export const toggleHidden = (secKey, item) => patchItem(secKey, item, { hidden: !item.hidden });
export const toggleFeatured = (secKey, item) => patchItem(secKey, item, { featured: !item.featured });

export function renameItem(secKey, item, name) {
  const sec = SECTIONS[secKey];
  const key = sec.fields.find((f) => ['title', 'name', 'caption', 'role'].includes(f.key))?.key ?? 'title';
  return patchItem(secKey, item, { [key]: name });
}

export function duplicateItem(secKey, item) {
  const sec = SECTIONS[secKey];
  const form = sec.toForm(item);
  const key = sec.fields.find((f) => ['title', 'name', 'caption', 'role'].includes(f.key))?.key;
  if (key) form[key] = `${form[key]} (copy)`;
  return saveItem(secKey, form, null);
}

/** Find the section + item for a normalized item id (used by menus and inline edits). */
export function findItem(secKey, id) {
  return SECTIONS[secKey].list(useData.getState()).find((x) => x.id === id) ?? null;
}

// ------------------------------------------------------------------ media

/** Process + stage an image; returns { src, thumb } site paths. */
export async function stageImage(file, dir, { withThumb = true } = {}) {
  const img = await processImage(file);
  const slug = fileSlug(file.name);
  const src = `/media/${dir}/${slug}.${img.ext}`;
  S().addFile(`public${src}`, img.full);
  let thumb = null;
  if (withThumb) {
    thumb = `/media/thumbs/${slug}.webp`;
    S().addFile(`public${thumb}`, img.thumb);
  }
  return { src, thumb, width: img.width, height: img.height };
}

/** Stage an already-processed blob (crop result, poster, preview…) and return its site path. */
export function stageBlob(blob, dir, name, ext = 'webp') {
  const src = `/media/${dir}/${fileSlug(name)}.${ext}`;
  S().addFile(`public${src}`, blob);
  return src;
}

// ------------------------------------------------------------------ layout

export function setDefaultWallpaper(id) {
  S().editDoc('layout', (l) => (l.defaultWallpaper = id), `Default wallpaper: ${id}`);
}

export function addWallpaperFrom(src, name) {
  const id = newId('wp', name);
  S().editDoc('media', (m) => m.wallpapers.push({ id, name, src, timeOfDay: null }), `Add wallpaper: ${name}`);
  setDefaultWallpaper(id);
}

export function togglePin(where, appId) {
  const key = where === 'start' ? 'pinnedStart' : 'pinnedTaskbar';
  S().editDoc('layout', (l) => {
    l[key] = l[key].includes(appId) ? l[key].filter((x) => x !== appId) : [...l[key], appId];
  }, `${where === 'start' ? 'Start' : 'Taskbar'} pins changed`);
}

/** Save the current desktop arrangement (this browser's) as the default for visitors. */
export function saveDesktopLayout(positions, items) {
  S().editDoc('layout', (l) => {
    l.desktopIcons = items.filter((i) => i.kind === 'app').map((i) => ({ app: i.id, col: positions[i.id].col, row: positions[i.id].row }));
  }, 'Desktop layout saved as default');
}

export function setResume(src, fileName) {
  S().editDoc('extras', (e) => (e.resume = { url: src, fileName }), 'Replace resume');
}
