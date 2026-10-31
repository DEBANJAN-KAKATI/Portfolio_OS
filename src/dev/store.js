/**
 * Staged Dev Mode changes. Nothing reaches the site until Publish:
 *   docs      full edited copies of content/extras|media|layout|trash.json
 *   inboxOps  edits to vault-owned items (→ data/vault.inbox.json)
 *   files     new media (Blobs) keyed by repo path, e.g. public/media/photos/x.webp
 *   vaultPublic  a dropped jstMyRB vault export (→ data/vault.public.json)
 * Everything is kept in IndexedDB so a refresh doesn't lose work.
 */
import { create } from 'zustand';
import { baseData, useData } from '@/data/store.js';
import { useSystem } from '@/os/store/system.js';
import { idbGet, idbSet, idbDel } from './idb.js';
import { buildOverlay } from './overlay.js';
import { api, blobToBase64 } from './api.js';

const STAGED = 'staged-v1';
const PUBLISHED = 'published-v1';
const IN_FLIGHT = 'publishing-v1';

const empty = () => ({ docs: {}, inboxOps: [], files: {}, vaultPublic: null, log: [] });
let logSeq = 0;

// sitePath ("/media/photos/x.webp") → object URL, for previews before upload
const objectUrls = new Map();
function previewsFor(files) {
  const out = {};
  for (const [repoPath, f] of Object.entries(files ?? {})) {
    if (!f?.blob) continue;
    const site = repoPath.replace(/^public/, '');
    if (!objectUrls.has(site)) objectUrls.set(site, URL.createObjectURL(f.blob));
    out[site] = objectUrls.get(site);
  }
  return out;
}

/** Displayable URL for a site path: the staged local Blob if it isn't uploaded yet. */
export function previewFor(src) {
  if (!src) return null;
  if (objectUrls.has(src)) return objectUrls.get(src);
  const f = useStaging.getState().staged.files[`public${src}`];
  if (!f?.blob) return src;
  const url = URL.createObjectURL(f.blob);
  objectUrls.set(src, url);
  return url;
}

function mergeOps(ops, op) {
  const out = [...ops];
  const i = out.findIndex((x) => x.section === op.section && x.id === op.id);
  if (i < 0) return [...out, op];
  if (out[i].op === 'add' && op.op === 'delete') out.splice(i, 1);
  else out[i] = out[i].op === 'add' && op.op === 'edit' ? { ...op, op: 'add' } : op;
  return out;
}

export const useStaging = create((set, get) => ({
  staged: empty(),
  published: null, // { docs, inboxOps, files, sha, mode, prUrl, publishedAt, baseDeploySha }
  loaded: false,
  publishing: null, // { step, done, total, error }

  async load() {
    const [staged, published, inFlight] = await Promise.all([idbGet(STAGED), idbGet(PUBLISHED), idbGet(IN_FLIGHT)]);
    // A local publish rewrites files and the dev server reloads the page mid-request.
    if (inFlight?.target === 'local') await idbDel(IN_FLIGHT);
    else if (inFlight) await idbSet(STAGED, inFlight.staged);
    set({ staged: inFlight && inFlight.target !== 'local' ? inFlight.staged : staged ?? empty(), published: published ?? null, loaded: true });
    if (inFlight && inFlight.target !== 'local') await idbDel(IN_FLIGHT);
    get().recompute();
    get().watchDeploy();
  },

  recompute() {
    const { staged, published } = get();
    const layers = [published, staged].filter(Boolean).map((l) => ({ docs: l.docs, inboxOps: l.inboxOps, previewUrls: previewsFor(l.files) }));
    useData.getState().applyOverlay(buildOverlay(baseData, layers));
  },

  persist() {
    idbSet(STAGED, get().staged);
  },

  /** Current value of a document including staged edits. */
  doc(name) {
    const { staged, published } = get();
    return staged.docs[name] ?? published?.docs?.[name] ?? baseData[name];
  },

  log(target, label) {
    set((s) => ({ staged: { ...s.staged, log: [...s.staged.log, { id: `${Date.now()}-${++logSeq}`, target, label, at: new Date().toISOString() }] } }));
  },

  editDoc(name, recipe, label) {
    const next = structuredClone(get().doc(name));
    recipe(next);
    set((s) => ({ staged: { ...s.staged, docs: { ...s.staged.docs, [name]: next } } }));
    if (label) get().log(`doc:${name}`, label);
    get().persist();
    get().recompute();
  },

  inbox(op, label) {
    const full = { data: {}, edited_at: new Date().toISOString(), base_updated_at: null, ...op };
    set((s) => ({ staged: { ...s.staged, inboxOps: mergeOps(s.staged.inboxOps, full) } }));
    get().log(`inbox:${op.section}:${op.id}`, label);
    get().persist();
    get().recompute();
  },

  addFile(repoPath, blob, label) {
    set((s) => ({ staged: { ...s.staged, files: { ...s.staged.files, [repoPath]: { blob, type: blob.type, size: blob.size } } } }));
    if (label) get().log(`file:${repoPath}`, label);
    get().persist();
    get().recompute();
  },

  stageVault(text, label) {
    set((s) => ({ staged: { ...s.staged, vaultPublic: text } }));
    get().log('vault', label);
    get().persist();
  },

  trash(section, item, label) {
    get().editDoc('trash', (t) => {
      t.items = [{ id: item.id ?? `${section}:${Date.now()}`, section, label, data: item, deletedAt: new Date().toISOString() }, ...(t.items ?? [])];
    });
  },

  /** Undo every staged change to one target (a document, a vault item, a file). */
  discard(target) {
    set((s) => {
      const st = structuredClone({ ...s.staged, files: {} });
      st.files = { ...s.staged.files };
      if (target.startsWith('doc:')) delete st.docs[target.slice(4)];
      else if (target.startsWith('inbox:')) {
        const [, section, ...id] = target.split(':');
        st.inboxOps = st.inboxOps.filter((o) => !(o.section === section && o.id === id.join(':')));
      } else if (target.startsWith('file:')) delete st.files[target.slice(5)];
      else if (target === 'vault') st.vaultPublic = null;
      st.log = st.log.filter((l) => l.target !== target);
      // Media staged for the discarded edit would otherwise still be uploaded.
      const refs = JSON.stringify([st.docs, st.inboxOps]);
      for (const path of Object.keys(st.files)) if (!refs.includes(path.replace(/^public/, ''))) delete st.files[path];
      return { staged: st };
    });
    get().persist();
    get().recompute();
  },

  discardAll() {
    set({ staged: empty() });
    get().persist();
    get().recompute();
  },

  async publish({ message, mode, target }) {
    const { staged } = get();
    const files = Object.entries(staged.files);
    const total = files.length + 1;
    set({ publishing: { step: 'Uploading media…', done: 0, total, error: null } });
    try {
      const media = {};
      for (const [i, [path, f]] of files.entries()) {
        set({ publishing: { step: `Uploading ${path.split('/').pop()}…`, done: i, total, error: null } });
        const r = await api('/api/admin/upload', { method: 'POST', body: { path, dataBase64: await blobToBase64(f.blob) } });
        media[path] = r.ref;
      }
      const documents = Object.fromEntries(Object.entries(staged.docs).map(([name, doc]) => [`content/${name}.json`, JSON.stringify(doc, null, 2)]));
      if (staged.vaultPublic) documents['data/vault.public.json'] = staged.vaultPublic;
      set({ publishing: { step: target === 'local' ? 'Saving to this folder…' : mode === 'pr' ? 'Opening a pull request…' : 'Committing…', done: files.length, total, error: null } });

      let baseDeploySha = null;
      try {
        baseDeploySha = (await (await fetch('/deploy.json', { cache: 'no-store' })).json()).sha ?? null;
      } catch {
        /* dev server has no deploy.json */
      }
      await idbSet(IN_FLIGHT, { staged, target });
      const result = await api('/api/admin/publish', { method: 'POST', body: { message, mode, documents, inboxOps: staged.inboxOps, media, deletes: [] } });
      await idbDel(IN_FLIGHT);

      const published = result.local
        ? null
        : { docs: staged.docs, inboxOps: staged.inboxOps, files: staged.files, sha: result.sha, mode: result.mode, prUrl: result.prUrl, commitUrl: result.commitUrl, publishedAt: new Date().toISOString(), baseDeploySha };
      if (published && get().published) {
        // stack on an earlier publish that hasn't deployed yet
        published.docs = { ...get().published.docs, ...published.docs };
        published.inboxOps = [...get().published.inboxOps, ...published.inboxOps];
        published.files = { ...get().published.files, ...published.files };
      }
      set({ staged: empty(), published, publishing: { step: 'Done', done: total, total, error: null, result } });
      await idbSet(STAGED, empty());
      if (published) await idbSet(PUBLISHED, published);
      get().recompute();
      get().watchDeploy();
      return result;
    } catch (err) {
      await idbDel(IN_FLIGHT);
      set({ publishing: { step: 'Failed', done: 0, total, error: err.message, issues: err.issues } });
      throw err;
    }
  },

  /** After a GitHub publish, tell the owner when the new deploy is live. */
  watchDeploy() {
    const pub = get().published;
    if (!pub || get()._watching) return;
    set({ _watching: true });
    const started = Date.now();
    const tick = async () => {
      const p = get().published;
      if (!p || Date.now() - started > 30 * 60_000) return set({ _watching: false });
      try {
        const { sha } = await (await fetch('/deploy.json', { cache: 'no-store' })).json();
        const live = sha && (sha === p.sha || (p.mode === 'pr' ? false : sha !== p.baseDeploySha));
        if (live) {
          set({ _watching: false });
          useSystem.getState().notify({ title: 'Your changes are live', body: 'Reload to see the deployed version.', action: null });
          await idbDel(PUBLISHED);
          return;
        }
      } catch {
        /* keep waiting */
      }
      setTimeout(tick, 20_000);
    };
    setTimeout(tick, 20_000);
  },

  clearPublished() {
    idbDel(PUBLISHED);
    set({ published: null });
    get().recompute();
  },
}));

export const useStagedCount = () => useStaging((s) => s.staged.log.length);
