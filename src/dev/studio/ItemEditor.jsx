/** Form editor + live preview for one item of any section. */
import { useEffect, useMemo, useState } from 'react';
import { Save, Trash2, Eye, X, History } from 'lucide-react';
import { Button, Chip, Bullets, Badge } from '@/apps/kit/ui.jsx';
import { ProjectCard, ProjectPage } from '@/apps/Projects.jsx';
import { normalizeOne } from '../overlay.js';
import { vaultSectionOf, newId } from '../sections.js';
import { saveItem, deleteItem } from '../actions.js';
import { previewFor } from '../store.js';
import { Field } from './fields.jsx';

function previewItem(sec, form, existing) {
  if (sec.owner !== 'vault' || sec.key === 'skills') return null;
  const id = existing?.id ?? 'preview';
  try {
    const item = normalizeOne(vaultSectionOf(sec, form, existing), sec.fromForm(form, id));
    if (sec.key === 'projects') {
      const { _githubUrl, ...p } = item;
      return { ...p, github: existing?.github ?? null, thumbnail: previewFor(p.thumbnail), images: p.images.map(previewFor) };
    }
    return item;
  } catch {
    return null;
  }
}

function Preview({ sec, form, existing }) {
  const item = useMemo(() => previewItem(sec, form, existing), [sec, form, existing]);
  if (sec.key === 'projects' && item) {
    return (
      <div className="space-y-4">
        <div className="max-w-xs">
          <p className="mb-1 text-[11px] font-semibold uppercase text-[var(--text-dim)]">Card</p>
          <ProjectCard p={item} onOpen={() => {}} />
        </div>
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <p className="border-b border-[var(--border)] px-3 py-1 text-[11px] font-semibold uppercase text-[var(--text-dim)]">Project page</p>
          <div className="origin-top-left scale-[0.85]" style={{ width: '117.6%' }}>
            <ProjectPage p={item} />
          </div>
        </div>
      </div>
    );
  }
  if (item?.bullets) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-4">
        <p className="font-semibold">{sec.titleOf(item)}</p>
        <p className="text-xs text-[var(--text-dim)]">{sec.subtitleOf(item)}</p>
        <Bullets items={item.bullets[3]} className="mt-2" />
      </div>
    );
  }
  const img = form.src && !/^https?:/.test(form.src) ? previewFor(form.src) : form.image ? previewFor(form.image) : form.poster ? previewFor(form.poster) : null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-4">
      {img && <img src={img} alt="" className="mb-3 max-h-56 w-full rounded-md object-cover" />}
      <p className="font-semibold">{form.title ?? form.name ?? form.caption ?? form.institution ?? form.category}</p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--text-dim)]">{form.description ?? form.blurb ?? form.details ?? form.degree ?? (form.skills ?? []).join(', ')}</p>
    </div>
  );
}

export default function ItemEditor({ sec, item, onClose, onSaved, onHistory }) {
  const [form, setForm] = useState(() => (item ? sec.toForm(item) : sec.blank()));
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('edit');
  useEffect(() => {
    setForm(item ? sec.toForm(item) : sec.blank());
    setError(null);
  }, [item, sec]);

  const save = () => {
    try {
      const id = saveItem(sec.key, form, item);
      setError(null);
      onSaved?.(id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{item ? `Edit ${sec.one.toLowerCase()}` : `New ${sec.one.toLowerCase()}`}</h2>
        {item?.status === 'pending' && <Badge tone="amber">Pending in vault</Badge>}
        {item?.status === 'draft' && <Badge tone="muted">GitHub draft</Badge>}
        <div className="flex gap-1 lg:hidden">
          <Chip active={tab === 'edit'} onClick={() => setTab('edit')}>Edit</Chip>
          <Chip active={tab === 'preview'} onClick={() => setTab('preview')}><Eye size={11} /> Preview</Chip>
        </div>
        {onClose && <button aria-label="Close editor" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-hover)]"><X size={15} /></button>}
      </div>
      <div className="flex min-h-0 flex-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className={`min-w-0 flex-1 space-y-3 overflow-y-auto p-4 ${tab === 'preview' ? 'hidden lg:block' : ''}`}
        >
          {sec.fields.map((f) => (
            <Field key={f.key} field={f} section={sec} value={form[f.key]} form={form} setForm={setForm} onChange={(v) => setForm((x) => ({ ...x, [f.key]: v }))} />
          ))}
          {sec.owner === 'vault' && <p className="text-[11px] text-[var(--text-dim)]">Saved to the vault inbox: it shows on the site right away and jstMyRB picks it up with “Pull from Portfolio”.</p>}
        </form>
        <aside className={`w-[46%] shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface-alt)] p-4 ${tab === 'edit' ? 'hidden lg:block' : 'block w-full'}`}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Live preview</p>
          <Preview sec={sec} form={form} existing={item} />
        </aside>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2">
        {error && <p className="min-w-0 flex-1 text-xs text-red-500">{error}</p>}
        {!error && <span className="flex-1" />}
        {item && onHistory && <Button variant="ghost" icon={History} onClick={() => onHistory(item)}>History</Button>}
        {item && (
          <Button
            icon={Trash2}
            onClick={() => {
              deleteItem(sec.key, item);
              onClose?.();
            }}
          >
            Delete
          </Button>
        )}
        <Button variant="primary" icon={Save} onClick={save}>{item ? 'Save' : `Add ${sec.one.toLowerCase()}`}</Button>
      </div>
    </div>
  );
}

export { newId };
