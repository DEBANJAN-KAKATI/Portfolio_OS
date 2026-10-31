/**
 * Dev Mode chrome that sits on top of the OS: the watermark, the drop/paste
 * flow ("Add to portfolio"), quick-add, rename and Properties dialogs.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { FileWarning, Loader2, Check } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useDev } from '@/os/devmode.js';
import { useWindows } from '@/os/store/windows.js';
import { useSystem } from '@/os/store/system.js';
import { Button } from '@/apps/kit/ui.jsx';
import Dialog from '@/apps/kit/Dialog.jsx';
import { useStaging, useStagedCount } from './store.js';
import { SECTIONS } from './sections.js';
import { saveItem, patchItem, renameItem, stageBlob, setResume } from './actions.js';
import { classify, processImage, processVideo, processModel, processPdf, readMarkdown, readVaultJson, classifyLink, fetchRepo, fileSlug } from './processing.js';
import { Field, inputCls } from './studio/fields.jsx';

/** Which Dev Mode dialog is open. */
export const useDevUi = create((set) => ({
  quickAdd: null, // { secKey, initial }
  drop: null, // { files, links, key }
  rename: null, // { secKey, item }
  props: null, // { secKey, item }
  set: (patch) => set(patch),
}));

export const openStudio = (page, itemId) => useWindows.getState().open('studio', { props: { page, itemId } });
const notify = (title, body) => useSystem.getState().notify({ title, body, sound: null, appId: 'studio' });
const today = () => new Date().toISOString().slice(0, 10);
const titleFromName = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';

/** Dialog component lives inside app windows; this hosts it over the whole screen. */
function Modal({ open, children, ...rest }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70000]">
      <Dialog open onClose={rest.onClose} {...rest}>{children}</Dialog>
    </div>
  );
}

// ------------------------------------------------------------------ quick add
function QuickAdd({ secKey, initial, onClose }) {
  const sec = SECTIONS[secKey];
  const [form, setForm] = useState(() => ({ ...sec.blank(), ...initial }));
  const [error, setError] = useState(null);
  const fields = sec.fields.filter((f) => f.quick);
  const save = (thenStudio) => {
    try {
      const id = saveItem(secKey, form, null);
      onClose();
      if (thenStudio) openStudio(secKey, id);
      else notify(`Added to ${sec.label.toLowerCase()}`, 'Publish from Portfolio Studio when you are ready.');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`New ${sec.one.toLowerCase()}`}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={() => save(true)}>Open in Portfolio Studio</Button>
          <Button variant="primary" onClick={() => save(false)}>Add</Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {fields.map((f) => (
          <Field key={f.key} field={f} section={sec} value={form[f.key]} form={form} setForm={setForm} onChange={(v) => setForm((x) => ({ ...x, [f.key]: v }))} />
        ))}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ rename
function Rename({ secKey, item, onClose }) {
  const sec = SECTIONS[secKey];
  const [name, setName] = useState(sec.titleOf(item));
  const [error, setError] = useState(null);
  const save = () => {
    try {
      renameItem(secKey, item, name.trim());
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Rename" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Rename</Button></>}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} className={inputCls} aria-label="New name" />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </Modal>
  );
}

// ------------------------------------------------------------------ properties
function Properties({ secKey, item, onClose }) {
  const sec = SECTIONS[secKey];
  const where = sec.owner === 'vault' ? 'jstMyRB vault (edits go to data/vault.inbox.json)' : `content/${sec.doc}.json → ${sec.listKey}`;
  const rows = [
    ['Name', sec.titleOf(item)],
    ['Type', sec.one],
    ['ID', item.id],
    ['Stored in', where],
    ['Status', item.status ?? 'published'],
    ['Source', item.source ?? (sec.owner === 'doc' ? 'Dev Mode' : 'vault')],
    ['Visible to visitors', item.hidden ? 'No (hidden)' : 'Yes'],
    ...(item.featured !== undefined ? [['Featured', item.featured ? 'Yes' : 'No']] : []),
    ...(item.vaultUpdatedAt ? [['Vault updated', new Date(item.vaultUpdatedAt).toLocaleString()]] : []),
    ...['src', 'thumb', 'poster', 'image', 'thumbnail'].filter((k) => typeof item[k] === 'string' && item[k]).map((k) => [k, item[k]]),
  ];
  return (
    <Modal open onClose={onClose} title={`${sec.titleOf(item)} Properties`} width={480} footer={<><Button onClick={() => { onClose(); openStudio(secKey, item.id); }}>Edit in Studio</Button><Button variant="primary" onClick={onClose}>OK</Button></>}>
      <table className="w-full text-[13px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-[var(--border)] last:border-0">
              <td className="w-36 py-1.5 pr-3 align-top text-[var(--text-dim)]">{k}</td>
              <td className="break-all py-1.5">{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

// ------------------------------------------------------------------ drop / paste
const OPTIONS = {
  image: [['photos', 'Photo (Photos app)'], ['wallpapers', 'Wallpaper'], ['renders', '3D render'], ['projectShot', 'Screenshot for a project'], ['skip', "Don't add"]],
  video: [['videos', 'Video (Media Player)'], ['skip', "Don't add"]],
  model: [['models', '3D model (3D Viewer)'], ['skip', "Don't add"]],
  pdf: [['resume', 'Replace my resume'], ['skip', "Don't add"]],
  markdown: [['casualWorks', 'Blog post (Casual Works)'], ['skip', "Don't add"]],
  json: [['vault', 'Replace the vault export'], ['skip', "Don't add"]],
  youtube: [['videos', 'Video (Media Player)'], ['shortcuts', 'Desktop shortcut'], ['skip', "Don't add"]],
  vimeo: [['videos', 'Video (Media Player)'], ['shortcuts', 'Desktop shortcut'], ['skip', "Don't add"]],
  github: [['projects', 'Project (GitHub repo)'], ['shortcuts', 'Desktop shortcut'], ['skip', "Don't add"]],
  link: [['shortcuts', 'Desktop shortcut'], ['skip', "Don't add"]],
};
const KIND_LABEL = { image: 'Image', video: 'Video', model: '3D model', pdf: 'PDF', markdown: 'Markdown', json: 'JSON', youtube: 'YouTube link', vimeo: 'Vimeo link', github: 'GitHub repo', link: 'Link' };

async function analyse(entry) {
  const { file, link } = entry;
  if (link) {
    if (link.kind === 'github') {
      const repo = await fetchRepo(link.owner, link.repo);
      return { title: repo.name, result: { repo } };
    }
    return { title: link.kind === 'link' ? link.host : `${KIND_LABEL[link.kind]}`, result: {} };
  }
  switch (entry.kind) {
    case 'image':
    case 'heic':
      return { title: titleFromName(file.name), result: await processImage(file) };
    case 'video':
      return { title: titleFromName(file.name), result: await processVideo(file) };
    case 'model':
      return { title: titleFromName(file.name), result: await processModel(file) };
    case 'pdf':
      return { title: file.name, result: await processPdf(file), note: "Make sure it doesn't contain your phone number." };
    case 'markdown': {
      const md = await readMarkdown(file);
      return { title: md.title, result: md };
    }
    case 'json': {
      const data = await readVaultJson(file);
      return { title: file.name, result: { data } };
    }
    default:
      throw new Error("This file type isn't supported (images, videos, .glb, PDF, Markdown or a vault JSON).");
  }
}

/** Upload a large file now (Vercel Blob) or stage it with the publish. */
async function placeLarge(file, dir, ext) {
  const session = useDev.getState().session;
  if (session?.largeMedia === 'vercel-blob') {
    const { uploadLarge } = await import('./largeUpload.js');
    return uploadLarge(file, `${dir}/${fileSlug(file.name)}.${ext}`);
  }
  if (session?.largeMedia === 'repo' || file.size <= 4 * 1024 * 1024) return stageBlob(file, dir, file.name, ext);
  throw new Error('Large files need Vercel Blob storage (BLOB_READ_WRITE_TOKEN). Use a YouTube link instead.');
}

async function commit(entry, projects) {
  const { dest, title, result, file, link } = entry;
  const S = useStaging.getState();
  const stageImg = (dir, withThumb) => {
    const slug = fileSlug(file.name);
    const src = `/media/${dir}/${slug}.${result.ext}`;
    S.addFile(`public${src}`, result.full);
    let thumb = null;
    if (withThumb) {
      thumb = `/media/thumbs/${slug}.webp`;
      S.addFile(`public${thumb}`, result.thumb);
    }
    return { src, thumb };
  };
  switch (dest) {
    case 'photos': {
      const { src, thumb } = stageImg('photos', true);
      return saveItem('photos', { src, thumb, caption: title, album: 'Uploads', date: today(), width: result.width, height: result.height, hidden: false });
    }
    case 'wallpapers':
      return saveItem('wallpapers', { name: title, src: stageImg('wallpapers', false).src, timeOfDay: null });
    case 'renders':
      return saveItem('renders', { title, src: stageImg('renders', false).src, hidden: false });
    case 'projectShot': {
      const project = projects.find((p) => p.id === entry.projectId);
      if (!project) throw new Error('Pick a project for the screenshot.');
      const { src } = stageImg('projects', false);
      return patchItem('projects', project, { images: [...project.images, src] });
    }
    case 'videos': {
      if (link) return saveItem('videos', { title, type: link.kind === 'link' ? 'youtube' : link.kind, src: link.url, poster: '', description: '', duration: null, hidden: false });
      const src = await placeLarge(file, 'videos', result.ext);
      const poster = stageBlob(result.poster, 'thumbs', file.name);
      return saveItem('videos', { title, type: 'mp4', src, poster, description: '', duration: result.duration, hidden: false });
    }
    case 'models': {
      const src = await placeLarge(file, 'models', 'glb');
      const poster = stageBlob(result.poster, 'thumbs', file.name);
      return saveItem('models', { title, src, poster, description: '', hidden: false });
    }
    case 'resume':
      setResume(stageBlob(file, 'docs', file.name, 'pdf'), file.name);
      return null;
    case 'casualWorks':
      return saveItem('casualWorks', { title, kind: 'blog', description: result.description || title, body: result.body, url: '', image: '', date: today(), hidden: false });
    case 'vault':
      S.stageVault(JSON.stringify(result.data, null, 2), `Replace vault export (${file.name})`);
      return null;
    case 'projects': {
      const { repo } = result;
      const line = repo.description || `${repo.name} on GitHub`;
      return saveItem('projects', { ...SECTIONS.projects.blank(), title, context: repo.language ?? '', tiers: { 1: [line], 2: [line, ''], 3: [line, '', ''] }, tags: repo.topics ?? [], github_url: link.url });
    }
    case 'shortcuts':
      return saveItem('shortcuts', { name: title, url: link?.url ?? '', icon: link?.kind === 'github' ? 'github' : /linkedin\.com/.test(link?.url ?? '') ? 'linkedin' : 'link' });
    default:
      return null;
  }
}

function DropDialog({ drop, onClose }) {
  const projects = useData((s) => s.portfolio.projects);
  const [entries, setEntries] = useState(() => [
    ...drop.files.map((file, i) => ({ key: `f${i}`, file, kind: classify(file), name: file.name, status: 'processing' })),
    ...drop.links.map((link, i) => ({ key: `l${i}`, link, kind: link.kind, name: link.url, status: 'processing' })),
  ]);
  const [adding, setAdding] = useState(false);
  const update = (key, patch) => setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const e of entries) {
        try {
          const r = await analyse(e);
          if (!cancelled) update(e.key, { status: 'ready', ...r, dest: OPTIONS[e.kind]?.[0]?.[0] ?? 'skip', projectId: projects[0]?.id });
        } catch (err) {
          if (!cancelled) update(e.key, { status: 'error', error: err.message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // analyse once per drop
  }, []);

  const processing = entries.filter((e) => e.status === 'processing').length;
  const ready = entries.filter((e) => e.status === 'ready' && e.dest !== 'skip');

  const add = async () => {
    setAdding(true);
    let added = 0;
    let failed = 0;
    for (const e of ready) {
      try {
        await commit(e, projects);
        update(e.key, { status: 'added' });
        added++;
      } catch (err) {
        update(e.key, { status: 'error', error: err.message });
        failed++;
      }
    }
    setAdding(false);
    if (added) notify(`${added} item${added > 1 ? 's' : ''} added`, 'Staged in Dev Mode. Publish from Portfolio Studio.');
    // Keep the dialog open when something failed so the reasons stay visible.
    if (added && !failed) setTimeout(onClose, 300);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={processing ? `Copying ${entries.length} item${entries.length > 1 ? 's' : ''}…` : 'Add to portfolio'}
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={adding ? Loader2 : undefined} disabled={processing > 0 || adding || !ready.length} onClick={add}>
            Add {ready.length || ''} to portfolio
          </Button>
        </>
      }
    >
      {processing > 0 && (
        <div className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]" role="progressbar" aria-valuenow={entries.length - processing} aria-valuemax={entries.length}>
          <div className="h-full transition-all" style={{ width: `${((entries.length - processing) / entries.length) * 100}%`, background: 'var(--accent)' }} />
        </div>
      )}
      <ul className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {entries.map((e) => (
          <li key={e.key} className="rounded-md border border-[var(--border)] p-2.5">
            <div className="flex items-center gap-2">
              {e.status === 'processing' && <Loader2 size={14} className="shrink-0 animate-spin" />}
              {e.status === 'error' && <FileWarning size={14} className="shrink-0 text-red-500" />}
              {e.status === 'added' && <Check size={14} className="shrink-0 text-green-600" />}
              <span className="min-w-0 flex-1 truncate text-[13px]">{e.name}</span>
              <span className="shrink-0 text-[11px] text-[var(--text-dim)]">{KIND_LABEL[e.kind] ?? 'Unknown'}</span>
            </div>
            {e.status === 'error' && <p className="mt-1 text-xs text-red-500">{e.error}</p>}
            {e.status === 'ready' && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select value={e.dest} onChange={(ev) => update(e.key, { dest: ev.target.value })} className={inputCls} aria-label={`Destination for ${e.name}`}>
                  {OPTIONS[e.kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {e.dest === 'projectShot' ? (
                  <select value={e.projectId} onChange={(ev) => update(e.key, { projectId: ev.target.value })} className={inputCls} aria-label="Project">
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                ) : (
                  !['resume', 'vault', 'skip'].includes(e.dest) && <input value={e.title} onChange={(ev) => update(e.key, { title: ev.target.value })} className={inputCls} aria-label={`Title for ${e.name}`} />
                )}
                {e.note && e.dest !== 'skip' && <p className="text-[11px] text-amber-600 sm:col-span-2">{e.note}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Pull files + links out of a DataTransfer / clipboard synchronously (they expire after the event). */
export function readTransfer(dt) {
  const files = [...(dt.files ?? [])];
  const text = [dt.getData?.('text/uri-list'), files.length ? '' : dt.getData?.('text/plain')].filter(Boolean).join('\n');
  const links = [...new Set(text.split(/\s+/).filter((l) => l && !l.startsWith('#')))].map(classifyLink).filter(Boolean);
  return { files, links };
}

// ------------------------------------------------------------------ root
function Watermark() {
  const count = useStagedCount();
  return (
    <button
      onClick={() => openStudio(count ? 'pending' : 'dashboard')}
      className="fixed right-4 z-[44000] select-none rounded px-2 py-1 text-right text-xs text-white/80 hover:text-white"
      style={{ bottom: 'calc(var(--taskbar-h) + 8px)', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}
    >
      <span className="block font-semibold">Developer Mode</span>
      <span className="block">{count ? `${count} unpublished change${count > 1 ? 's' : ''}` : 'All changes published'}</span>
    </button>
  );
}

export default function DevRoot() {
  const ui = useDevUi();
  const close = (k) => () => ui.set({ [k]: null });

  useEffect(() => {
    document.documentElement.dataset.devmode = '';
    const onPaste = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (useSystem.getState().phase !== 'desktop') return;
      const { files, links } = readTransfer(e.clipboardData);
      if (!files.length && !links.length) return;
      e.preventDefault();
      useDevUi.getState().set({ drop: { files, links, key: Date.now() } });
    };
    window.addEventListener('paste', onPaste);
    return () => {
      delete document.documentElement.dataset.devmode;
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  return (
    <>
      <Watermark />
      {ui.quickAdd && <QuickAdd key={ui.quickAdd.secKey} {...ui.quickAdd} onClose={close('quickAdd')} />}
      {ui.drop && <DropDialog key={ui.drop.key} drop={ui.drop} onClose={close('drop')} />}
      {ui.rename && <Rename {...ui.rename} onClose={close('rename')} />}
      {ui.props && <Properties {...ui.props} onClose={close('props')} />}
    </>
  );
}
