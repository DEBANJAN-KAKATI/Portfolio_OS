/** Searchable, bulk-editable list for one section, with the editor beside it. */
import { useMemo, useState } from 'react';
import { Plus, EyeOff, Eye, Star, Trash2, GripVertical, Search } from 'lucide-react';
import { useData } from '@/data/store.js';
import { Badge, Button, EmptyState } from '@/apps/kit/ui.jsx';
import { useStaging, previewFor } from '../store.js';
import { deleteItem, toggleHidden, toggleFeatured } from '../actions.js';
import ItemEditor from './ItemEditor.jsx';

export function StatusBadges({ item }) {
  return (
    <span className="flex shrink-0 gap-1">
      {item.status === 'draft' && <Badge tone="muted">Draft</Badge>}
      {item.status === 'pending' && <Badge tone="amber">Pending in vault</Badge>}
      {item.hidden && <Badge tone="muted">Hidden</Badge>}
      {item.featured && <Badge>Featured</Badge>}
    </span>
  );
}

export default function SectionView({ sec, onHistory, initialId }) {
  const state = useData();
  const items = useMemo(() => sec.list(state), [sec, state]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(initialId ? { id: initialId } : null); // { id } | { new: true }
  const [dragId, setDragId] = useState(null);
  const canReorder = sec.owner === 'doc' && !query;
  const hasFlags = sec.fields.some((f) => f.key === 'hidden');
  const canFeature = sec.fields.some((f) => f.key === 'featured');

  const q = query.toLowerCase();
  const shown = items.filter((i) => !q || `${sec.titleOf(i)} ${sec.subtitleOf?.(i) ?? ''}`.toLowerCase().includes(q));
  const current = editing?.id ? items.find((i) => i.id === editing.id) : null;
  const pick = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const bulk = (fn) => {
    for (const id of selected) {
      const it = items.find((i) => i.id === id);
      if (it) fn(it);
    }
    setSelected([]);
  };

  const reorder = (fromId, toId) => {
    if (!canReorder || fromId === toId) return;
    useStaging.getState().editDoc(sec.doc, (d) => {
      const list = d[sec.listKey];
      const from = list.findIndex((x) => x.id === fromId);
      const [moved] = list.splice(from, 1);
      list.splice(list.findIndex((x) => x.id === toId), 0, moved);
    }, `Reorder ${sec.label.toLowerCase()}`);
  };

  const thumbOf = (i) => previewFor(i.thumb ?? i.poster ?? (sec.key === 'photos' || sec.key === 'renders' || sec.key === 'wallpapers' ? i.src : null) ?? i.image ?? (sec.key === 'projects' && i.thumbnail && !i.thumbnail.includes('opengraph') ? i.thumbnail : null));

  return (
    <div className="flex h-full min-h-0">
      <div className={`flex min-h-0 flex-col border-r border-[var(--border)] ${editing ? 'hidden w-80 shrink-0 md:flex' : 'flex-1'}`}>
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-2">
          <label className="flex h-8 flex-1 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2">
            <Search size={13} className="text-[var(--text-dim)]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${sec.label.toLowerCase()}`} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" aria-label="Search" />
          </label>
          <Button variant="primary" icon={Plus} onClick={() => setEditing({ new: true })}>New</Button>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-alt)] p-2 text-xs">
            <span className="mr-1">{selected.length} selected</span>
            {hasFlags && <Button variant="ghost" icon={EyeOff} onClick={() => bulk((i) => !i.hidden && toggleHidden(sec.key, i))}>Hide</Button>}
            {hasFlags && <Button variant="ghost" icon={Eye} onClick={() => bulk((i) => i.hidden && toggleHidden(sec.key, i))}>Show</Button>}
            {canFeature && <Button variant="ghost" icon={Star} onClick={() => bulk((i) => toggleFeatured(sec.key, i))}>Feature</Button>}
            <Button variant="ghost" icon={Trash2} onClick={() => bulk((i) => deleteItem(sec.key, i))}>Delete</Button>
          </div>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto p-1" role="listbox" aria-label={sec.label}>
          {shown.length === 0 && <EmptyState title={`No ${sec.label.toLowerCase()} yet`}>Use New, or drop files onto the desktop.</EmptyState>}
          {shown.map((i) => {
            const thumb = thumbOf(i);
            return (
              <li
                key={i.id}
                draggable={canReorder}
                onDragStart={() => setDragId(i.id)}
                onDragOver={(e) => canReorder && e.preventDefault()}
                onDrop={() => reorder(dragId, i.id)}
                className={`group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--surface-hover)] ${editing?.id === i.id ? 'bg-[var(--surface-hover)]' : ''}`}
              >
                {canReorder && <GripVertical size={13} className="shrink-0 cursor-grab text-[var(--text-dim)] opacity-0 group-hover:opacity-100" />}
                <input type="checkbox" checked={selected.includes(i.id)} onChange={() => pick(i.id)} aria-label={`Select ${sec.titleOf(i)}`} style={{ accentColor: 'var(--accent)' }} />
                {thumb && <img src={thumb} alt="" className="h-8 w-12 shrink-0 rounded object-cover" />}
                {sec.key === 'hobbies' && <span className="text-lg">{i.icon}</span>}
                <button onClick={() => setEditing({ id: i.id })} className="min-w-0 flex-1 text-left" role="option" aria-selected={editing?.id === i.id}>
                  <span className="block truncate text-[13px]">{sec.titleOf(i)}</span>
                  <span className="block truncate text-[11px] text-[var(--text-dim)]">{sec.subtitleOf?.(i)}</span>
                </button>
                <StatusBadges item={i} />
              </li>
            );
          })}
        </ul>
        <p className="border-t border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-dim)]">
          {items.length} items{canReorder ? ' · drag to reorder' : ''}
        </p>
      </div>
      {editing && (
        <div className="min-w-0 flex-1">
          <ItemEditor
            key={editing.id ?? 'new'}
            sec={sec}
            item={current}
            onClose={() => setEditing(null)}
            onSaved={(id) => setEditing({ id })}
            onHistory={onHistory}
          />
        </div>
      )}
    </div>
  );
}
