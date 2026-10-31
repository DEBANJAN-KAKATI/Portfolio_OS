/** Studio pages that aren't plain item lists. */
import { useEffect, useMemo, useState } from 'react';
import { Upload, RefreshCw, Rocket, Trash2, ExternalLink, Check, X, Loader2, LayoutGrid, Undo2 } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useDev } from '@/os/devmode.js';
import { useDesktop, getDesktopItems, resolvePositions } from '@/os/store/desktop.js';
import { apps } from '@/os/apps/registry.js';
import { useSystem } from '@/os/store/system.js';
import AppIcon from '@/os/ui/AppIcon.jsx';
import { Button, Card, Chip, EmptyState } from '@/apps/kit/ui.jsx';
import Dialog from '@/apps/kit/Dialog.jsx';
import { relativeTime } from '@/apps/kit/format.js';
import { useStaging } from '../store.js';
import { api } from '../api.js';
import { SECTIONS } from '../sections.js';
import { saveItem, saveDesktopLayout, stageBlob, setResume, restoreFromTrash } from '../actions.js';
import { processPdf } from '../processing.js';
import { Field, inputCls } from './fields.jsx';
import { StatusBadges } from './SectionView.jsx';

const H = ({ children }) => <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold">{children}</h2>;

// ------------------------------------------------------------------ Dashboard
export function Dashboard({ go }) {
  const state = useData();
  const staged = useStaging((s) => s.staged);
  const published = useStaging((s) => s.published);
  const session = useDev((s) => s.session);
  const drafts = state.portfolio.projects.filter((p) => p.status === 'draft');
  const pending = [...state.portfolio.projects, ...state.portfolio.experiences, ...state.portfolio.education, ...state.portfolio.achievements].filter((i) => i.status === 'pending');
  const counts = Object.values(SECTIONS).map((s) => [s, s.list(state).length]);

  const approve = (p) => saveItem('projects', { ...SECTIONS.projects.toForm(p), hidden: false }, p);
  const reject = (p) => saveItem('projects', { ...SECTIONS.projects.toForm(p), hidden: true }, p);

  return (
    <div className="space-y-5 p-5">
      <H>Dashboard</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-[var(--text-dim)]">Unpublished changes</p>
          <p className="text-3xl font-semibold">{staged.log.length}</p>
          <Button className="mt-2" variant="primary" icon={Rocket} disabled={!staged.log.length} onClick={() => go('pending')}>Review & publish</Button>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-dim)]">Publishing to</p>
          <p className="text-lg font-semibold">{session?.target === 'local' ? 'This folder (local dev)' : session?.target === 'github' ? `GitHub (${session.reviewMode === 'pr' ? 'pull request' : 'direct commit'})` : 'Not configured'}</p>
          {published && <p className="mt-1 text-xs text-[var(--text-dim)]">Last publish {relativeTime(published.publishedAt)} · waiting for deploy</p>}
        </Card>
        <Card className="p-4">
          <p className="mb-1 text-xs text-[var(--text-dim)]">Last sync</p>
          {Object.entries(state.portfolio.meta.sources).map(([k, s]) => (
            <p key={k} className="flex justify-between text-xs">
              <span>{k}</span>
              <span className="text-[var(--text-dim)]">{s.at ? relativeTime(s.at) : s.status}</span>
            </p>
          ))}
        </Card>
      </div>
      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">Content</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {counts.map(([s, n]) => (
            <button key={s.key} onClick={() => go(s.key)} className="rounded-md border border-[var(--border)] p-2 text-left hover:bg-[var(--surface-hover)]">
              <p className="text-lg font-semibold">{n}</p>
              <p className="text-xs text-[var(--text-dim)]">{s.label}</p>
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">GitHub drafts <span className="font-normal text-[var(--text-dim)]">· new repos found by the sync, hidden from visitors</span></p>
        {drafts.length === 0 ? <p className="text-xs text-[var(--text-dim)]">No drafts waiting.</p> : (
          <ul className="space-y-1">
            {drafts.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{p.title} <span className="text-[var(--text-dim)]">· {p.description ?? 'no description'}</span></span>
                <Button icon={Check} onClick={() => approve(p)}>Approve</Button>
                <Button variant="ghost" icon={X} onClick={() => reject(p)}>Reject</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-4">
        <p className="mb-2 text-sm font-semibold">Pending in vault <span className="font-normal text-[var(--text-dim)]">· added or edited here, not yet pulled into jstMyRB</span></p>
        {pending.length === 0 ? <p className="text-xs text-[var(--text-dim)]">Nothing pending.</p> : (
          <ul className="space-y-1">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{i.title ?? `${i.role} @ ${i.company}` ?? i.institution}</span>
                <StatusBadges item={i} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Profile & text
const PROFILE_FIELDS = [
  { key: 'tagline', label: 'Tagline', type: 'text', required: true },
  { key: 'intro', label: 'Intro (typed out in About Me)', type: 'textarea', required: true },
  { key: 'openToWorkText', label: 'Contact line', type: 'text' },
  { key: 'openToWork', label: 'Show the contact line', type: 'toggle' },
  { key: 'currentlyLearning', label: 'Currently learning', type: 'list' },
  { key: 'lockScreenQuotes', label: 'Lock-screen quotes', type: 'list' },
  { key: 'assistantTips', label: 'Assistant tips', type: 'list' },
  { key: 'avatar', label: 'Avatar (optional; GitHub avatar otherwise)', type: 'image', aspect: 1 },
];

export function ProfileView() {
  const extras = useData((s) => s.extras);
  const toForm = (e) => ({ tagline: e.tagline, intro: e.intro, openToWork: e.openToWork.enabled, openToWorkText: e.openToWork.text, currentlyLearning: [...e.currentlyLearning], lockScreenQuotes: [...e.lockScreenQuotes], assistantTips: [...e.assistantTips], avatar: e.avatar ?? '', quickFacts: e.quickFacts.map((q) => ({ ...q })), learningNext: e.learningNext.map((l) => ({ ...l })), listening: { ...(e.currentlyListening ?? { title: '', artist: '', url: '' }) } });
  const [form, setForm] = useState(() => toForm(extras));
  const [saved, setSaved] = useState(false);
  const [resumeMsg, setResumeMsg] = useState(null);
  const sec = { mediaDir: 'avatar' };

  const save = () => {
    useStaging.getState().editDoc('extras', (e) => {
      e.tagline = form.tagline.trim();
      e.intro = form.intro.trim();
      e.openToWork = { enabled: Boolean(form.openToWork), text: form.openToWorkText };
      e.currentlyLearning = form.currentlyLearning.filter(Boolean);
      e.lockScreenQuotes = form.lockScreenQuotes.filter(Boolean).length ? form.lockScreenQuotes.filter(Boolean) : e.lockScreenQuotes;
      e.assistantTips = form.assistantTips.filter(Boolean);
      e.avatar = form.avatar || null;
      e.quickFacts = form.quickFacts.filter((q) => q.label && q.value);
      e.learningNext = form.learningNext.filter((l) => l.name);
      e.currentlyListening = form.listening.title ? { title: form.listening.title, artist: form.listening.artist ?? '', url: form.listening.url || null } : null;
    }, 'Edit profile & text');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const uploadResume = async (file) => {
    setResumeMsg('Checking PDF…');
    try {
      const { pages } = await processPdf(file);
      const src = stageBlob(file, 'docs', file.name, 'pdf');
      setResume(src, file.name);
      setResumeMsg(`Staged ${file.name} (${pages} page${pages > 1 ? 's' : ''}). Make sure it doesn't contain your phone number.`);
    } catch (err) {
      setResumeMsg(err.message);
    }
  };

  const rowList = (key, cols) => (
    <div className="space-y-1">
      {form[key].map((row, i) => (
        <div key={i} className="flex gap-1">
          {cols.map(([k, ph]) =>
            k === 'impact' ? (
              <select key={k} value={row[k] ?? 'Medium'} onChange={(e) => setForm((f) => ({ ...f, [key]: f[key].map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)) }))} className={`${inputCls} w-28`}>
                {['High', 'Medium', 'Low'].map((v) => <option key={v}>{v}</option>)}
              </select>
            ) : (
              <input key={k} value={row[k] ?? ''} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [key]: f[key].map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)) }))} className={inputCls} />
            ),
          )}
          <button aria-label="Remove" onClick={() => setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) }))} className="rounded p-1 hover:bg-[var(--surface-hover)]"><X size={13} /></button>
        </div>
      ))}
      <button onClick={() => setForm((f) => ({ ...f, [key]: [...f[key], Object.fromEntries(cols.map(([k]) => [k, k === 'impact' ? 'Medium' : '']))] }))} className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>+ Add</button>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-3 p-5">
      <H>Profile & text</H>
      {PROFILE_FIELDS.map((f) => (
        <Field key={f.key} field={f} section={sec} value={form[f.key]} form={form} setForm={setForm} onChange={(v) => setForm((x) => ({ ...x, [f.key]: v }))} />
      ))}
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--text-dim)]">Quick facts (About Me)</p>
        {rowList('quickFacts', [['label', 'Label'], ['value', 'Value']])}
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--text-dim)]">Learning next (Task Manager → Startup apps)</p>
        {rowList('learningNext', [['name', 'Name'], ['publisher', 'Publisher'], ['impact', 'Impact']])}
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--text-dim)]">Currently listening (widgets)</p>
        <div className="flex gap-1">
          {[['title', 'Title'], ['artist', 'Artist'], ['url', 'https://… (optional)']].map(([k, ph]) => (
            <input key={k} value={form.listening[k] ?? ''} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, listening: { ...f.listening, [k]: e.target.value } }))} className={inputCls} />
          ))}
        </div>
      </div>
      <Card className="p-3">
        <p className="mb-1 text-xs font-medium text-[var(--text-dim)]">Resume PDF</p>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
          <Upload size={14} /> <span className="underline">Choose a PDF</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} />
        </label>
        {resumeMsg && <p className="mt-1 text-xs text-[var(--text-dim)]">{resumeMsg}</p>}
      </Card>
      <Button variant="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</Button>
    </div>
  );
}

// ------------------------------------------------------------------ Desktop & Start layout
export function LayoutView() {
  const layout = useData((s) => s.layout);
  const wallpapers = useData((s) => s.media.wallpapers);
  const positions = useDesktop((s) => s.positions);
  const visible = apps.filter((a) => !a.devOnly);
  const toggle = (key, id) =>
    useStaging.getState().editDoc('layout', (l) => {
      l[key] = l[key].includes(id) ? l[key].filter((x) => x !== id) : [...l[key], id];
    }, `${key === 'pinnedStart' ? 'Start' : 'Taskbar'} pins changed`);
  const onDesktop = (id) => layout.desktopIcons.some((i) => i.app === id);
  const toggleDesktop = (id) =>
    useStaging.getState().editDoc('layout', (l) => {
      if (l.desktopIcons.some((i) => i.app === id)) l.desktopIcons = l.desktopIcons.filter((i) => i.app !== id);
      else l.desktopIcons.push({ app: id, col: 0, row: 99 });
    }, 'Desktop icons changed');

  return (
    <div className="space-y-4 p-5">
      <H>Desktop & Start layout</H>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <LayoutGrid size={20} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Default icon positions</p>
          <p className="text-xs text-[var(--text-dim)]">Arrange the icons on your desktop, then save that arrangement as what visitors see first.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            const rows = Math.max(1, Math.floor((window.innerHeight - 48 - 16) / 100));
            const items = getDesktopItems(layout);
            saveDesktopLayout(resolvePositions(positions, rows, items), items);
          }}
        >
          Use my current arrangement
        </Button>
      </Card>
      <Card className="p-4">
        <p className="mb-2 text-[13px] font-medium">Default wallpaper for visitors</p>
        <select value={layout.defaultWallpaper} onChange={(e) => useStaging.getState().editDoc('layout', (l) => (l.defaultWallpaper = e.target.value), 'Default wallpaper changed')} className={`${inputCls} max-w-xs`}>
          <option value="auto">Automatic (time of day)</option>
          {wallpapers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-[13px]">
          <thead className="text-xs text-[var(--text-dim)]">
            <tr>
              <th className="px-4 py-2 font-normal">App</th>
              <th className="px-2 py-2 text-center font-normal">Desktop</th>
              <th className="px-2 py-2 text-center font-normal">Taskbar</th>
              <th className="px-2 py-2 text-center font-normal">Start</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id} className="border-t border-[var(--border)]">
                <td className="flex items-center gap-2 px-4 py-1.5"><AppIcon appId={a.id} size={18} /> {a.title}</td>
                {[
                  [onDesktop(a.id), () => toggleDesktop(a.id)],
                  [layout.pinnedTaskbar.includes(a.id), () => toggle('pinnedTaskbar', a.id)],
                  [layout.pinnedStart.includes(a.id), () => toggle('pinnedStart', a.id)],
                ].map(([on, fn], i) => (
                  <td key={i} className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={on} onChange={fn} aria-label={`${a.title} ${['desktop', 'taskbar', 'start'][i]}`} style={{ accentColor: 'var(--accent)' }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Sync
export function SyncView() {
  const meta = useData((s) => s.portfolio.meta);
  const session = useDev((s) => s.session);
  const [msg, setMsg] = useState(null);
  return (
    <div className="max-w-2xl space-y-4 p-5">
      <H>Sync</H>
      <Card className="p-4">
        {Object.entries(meta.sources).map(([k, s]) => (
          <p key={k} className="flex items-center justify-between border-b border-[var(--border)] py-1.5 text-[13px] last:border-0">
            <span>{k}</span>
            <span className="text-xs text-[var(--text-dim)]">{s.status} · {s.at ? relativeTime(s.at) : 'never'}</span>
          </p>
        ))}
        <p className="mt-2 text-xs text-[var(--text-dim)]">Data built {relativeTime(meta.generatedAt)}.</p>
      </Card>
      <Card className="space-y-2 p-4 text-[13px]">
        <p>The GitHub Action syncs daily, whenever jstMyRB publishes the vault, and when Dev Mode publishes vault edits.</p>
        <Button
          icon={RefreshCw}
          disabled={session?.target !== 'github'}
          onClick={async () => {
            setMsg('Starting…');
            try {
              await api('/api/admin/sync', { method: 'POST', body: {} });
              setMsg('Sync started. A pull request (or commit) appears in a few minutes.');
            } catch (err) {
              setMsg(err.message);
            }
          }}
        >
          Run sync now
        </Button>
        {session?.target !== 'github' && <p className="text-xs text-[var(--text-dim)]">Locally, run <code>npm run sync</code> instead.</p>}
        {msg && <p className="text-xs">{msg}</p>}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Pending changes + Publish
function describeTarget(target) {
  if (target.startsWith('doc:')) return { kind: 'Content file', label: `content/${target.slice(4)}.json` };
  if (target.startsWith('inbox:')) return { kind: 'Vault inbox', label: target.split(':').slice(1).join(' · ') };
  if (target.startsWith('file:')) return { kind: 'Media', label: target.slice(5) };
  return { kind: 'Vault export', label: 'data/vault.public.json' };
}

export function PendingView() {
  const staged = useStaging((s) => s.staged);
  const publishing = useStaging((s) => s.publishing);
  const session = useDev((s) => s.session);
  const groups = useMemo(() => {
    const map = new Map();
    for (const l of staged.log) map.set(l.target, [...(map.get(l.target) ?? []), l]);
    return [...map.entries()];
  }, [staged.log]);
  const mediaCount = Object.keys(staged.files).length;
  const defaultMsg = useMemo(() => {
    const labels = staged.log.map((l) => l.label);
    return labels.length ? `Dev Mode: ${labels.slice(0, 3).join('; ')}${labels.length > 3 ? ` (+${labels.length - 3} more)` : ''}` : '';
  }, [staged.log]);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState(session?.reviewMode ?? 'pr');
  useEffect(() => setMessage(defaultMsg), [defaultMsg]);

  const publish = async () => {
    try {
      const r = await useStaging.getState().publish({ message: message || defaultMsg, mode, target: session?.target });
      useSystem.getState().notify({
        title: r.local ? 'Saved to your project folder' : r.prUrl ? 'Pull request opened' : 'Published',
        body: r.local ? 'Commit the changed files when you are ready.' : r.prUrl ? 'Merge it to deploy the changes.' : 'The site redeploys in a minute or two.',
        appId: 'studio',
      });
    } catch {
      /* shown below */
    }
  };

  return (
    <div className="max-w-3xl space-y-4 p-5">
      <H>Pending changes</H>
      {groups.length === 0 && !publishing?.result ? (
        <EmptyState title="Nothing to publish">Changes you make in Dev Mode collect here.</EmptyState>
      ) : (
        <>
          <Card>
            <ul>
              {groups.map(([target, entries]) => {
                const d = describeTarget(target);
                return (
                  <li key={target} className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]">{entries.at(-1).label}{entries.length > 1 && <span className="text-[var(--text-dim)]"> (+{entries.length - 1} earlier edit{entries.length > 2 ? 's' : ''})</span>}</p>
                      <p className="truncate text-[11px] text-[var(--text-dim)]">{d.kind} · {d.label}</p>
                    </div>
                    <Button variant="ghost" icon={Undo2} onClick={() => useStaging.getState().discard(target)}>Discard</Button>
                  </li>
                );
              })}
            </ul>
          </Card>
          {groups.length > 0 && (
            <Card className="space-y-3 p-4">
              <p className="text-sm font-semibold">Publish {staged.log.length} change{staged.log.length > 1 ? 's' : ''}{mediaCount ? ` and ${mediaCount} file${mediaCount > 1 ? 's' : ''}` : ''}</p>
              <input value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} aria-label="Commit message" />
              {session?.target === 'github' && (
                <div className="flex gap-1">
                  <Chip active={mode === 'pr'} onClick={() => setMode('pr')}>Open a pull request</Chip>
                  <Chip active={mode === 'commit'} onClick={() => setMode('commit')}>Commit directly</Chip>
                </div>
              )}
              {session?.target === 'local' && <p className="text-xs text-[var(--text-dim)]">Local dev: files are written into this project folder (no GitHub token configured).</p>}
              {session?.target === 'none' && <p className="text-xs text-red-500">Publishing isn't configured on this server (GITHUB_WRITE_TOKEN).</p>}
              <div className="flex gap-2">
                <Button variant="primary" icon={publishing && !publishing.error && publishing.step !== 'Done' ? Loader2 : Rocket} disabled={session?.target === 'none' || (publishing && !publishing.error && publishing.step !== 'Done')} onClick={publish}>
                  Publish
                </Button>
                <Button variant="ghost" icon={Trash2} onClick={() => confirm('Discard every unpublished change?') && useStaging.getState().discardAll()}>Discard all</Button>
              </div>
            </Card>
          )}
          {publishing && (
            <Card className="p-4 text-[13px]" role="status">
              <p className="font-medium">{publishing.step}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <div className="h-full transition-all" style={{ width: `${(publishing.done / Math.max(1, publishing.total)) * 100}%`, background: publishing.error ? '#ef4444' : 'var(--accent)' }} />
              </div>
              {publishing.error && (
                <div className="mt-2 text-xs text-red-500">
                  <p>{publishing.error}</p>
                  {publishing.issues?.map((i) => <p key={i}>• {i}</p>)}
                </div>
              )}
              {publishing.result?.prUrl && <a href={publishing.result.prUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}>View pull request <ExternalLink size={11} /></a>}
              {publishing.result?.commitUrl && !publishing.result.prUrl && <a href={publishing.result.commitUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}>View commit <ExternalLink size={11} /></a>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Recycle bin (Dev Mode view)
export function TrashView() {
  const trash = useData((s) => s.trash);
  return (
    <div className="max-w-3xl space-y-3 p-5">
      <H>Deleted items</H>
      <p className="text-xs text-[var(--text-dim)]">Kept for 30 days, then removed for good on the next publish.</p>
      {trash.items.length === 0 ? (
        <EmptyState title="Nothing deleted" />
      ) : (
        <Card>
          <ul>
            {trash.items.map((t) => (
              <li key={`${t.id}-${t.deletedAt}`} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{t.label}</p>
                  <p className="text-[11px] text-[var(--text-dim)]">{t.section} · deleted {relativeTime(t.deletedAt)}</p>
                </div>
                <Button icon={Undo2} onClick={() => restoreFromTrash(t)}>Restore</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Version history
const DOC_OF = { doc: (sec) => `content/${sec.doc}.json` };

export function HistoryDialog({ target, onClose }) {
  const { sec, item } = target ?? {};
  const file = sec ? (sec.owner === 'doc' ? DOC_OF.doc(sec) : 'data/vault.inbox.json') : null;
  const [state, setState] = useState({ loading: true, commits: [], error: null });
  useEffect(() => {
    if (!file) return;
    setState({ loading: true, commits: [], error: null });
    api(`/api/admin/history?path=${encodeURIComponent(file)}`)
      .then((r) => setState({ loading: false, commits: r.commits, error: null }))
      .catch((err) => setState({ loading: false, commits: [], error: err.message }));
  }, [file]);

  const restore = async (sha) => {
    try {
      const { content } = await api(`/api/admin/history?path=${encodeURIComponent(file)}&ref=${sha}`);
      const old = sec.owner === 'doc' ? content[sec.listKey]?.find((x) => x.id === item.id) : content.items?.find((x) => x.id === item.id)?.data;
      if (!old) throw new Error('This item did not exist in that version.');
      if (sec.owner === 'doc') {
        useStaging.getState().editDoc(sec.doc, (d) => {
          const i = d[sec.listKey].findIndex((x) => x.id === item.id);
          if (i >= 0) d[sec.listKey][i] = old;
          else d[sec.listKey].unshift(old);
        }, `Restore ${sec.titleOf(old)} from ${sha.slice(0, 7)}`);
      } else {
        useStaging.getState().inbox({ op: 'edit', section: sec.vault ?? 'projects', id: item.id, data: old }, `Restore ${item.id} from ${sha.slice(0, 7)}`);
      }
      onClose();
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    }
  };

  return (
    <Dialog open={Boolean(target)} onClose={onClose} title={`Version history${item ? ` · ${sec.titleOf(item)}` : ''}`} width={520}>
      {state.loading && <p className="text-[13px] text-[var(--text-dim)]">Loading…</p>}
      {state.error && <p className="text-[13px] text-red-500">{state.error}</p>}
      {!state.loading && !state.commits.length && !state.error && <p className="text-[13px] text-[var(--text-dim)]">No earlier versions of {file} yet.</p>}
      <ul className="space-y-1">
        {state.commits.map((c) => (
          <li key={c.sha} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[var(--surface-hover)]">
            <div className="min-w-0 flex-1">
              <p className="truncate">{c.message}</p>
              <p className="text-[11px] text-[var(--text-dim)]">{c.sha.slice(0, 7)} · {c.author} · {relativeTime(c.date)}</p>
            </div>
            <Button onClick={() => restore(c.sha)}>Restore</Button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
