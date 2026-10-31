/** Casual Works as "My Documents": experiments, posts, doodles and small builds. */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, FileText, PenTool, Hammer, FolderOpen, ExternalLink, FileSearch } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useWindows } from '@/os/store/windows.js';
import { devItemMenu } from '@/os/devmode.js';
import Explorer, { useHistoryStack } from './kit/Explorer.jsx';
import { EmptyState, LinkButton } from './kit/ui.jsx';
import { formatDate } from './kit/format.js';
import { renderMarkdown } from './kit/markdown.js';

const KINDS = {
  experiment: { label: 'Experiments', one: 'Experiment', icon: FlaskConical, color: '#10b981' },
  blog: { label: 'Blog posts', one: 'Blog post', icon: FileText, color: '#3b82f6' },
  doodle: { label: 'Doodles', one: 'Doodle', icon: PenTool, color: '#f59e0b' },
  build: { label: 'Side builds', one: 'Side build', icon: Hammer, color: '#8b5cf6' },
};

function Document({ item }) {
  const kind = KINDS[item.kind];
  const html = useMemo(() => (item.body ? renderMarkdown(item.body) : null), [item.body]);
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl p-6">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: kind.color }}>
        <kind.icon size={13} /> {kind.one}
        {item.date && <span className="font-normal normal-case text-[var(--text-dim)]">· {formatDate(item.date)}</span>}
      </p>
      <h1 className="selectable mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">{item.title}</h1>
      {item.image && <img src={item.image} alt="" className="mt-4 max-h-72 w-full rounded-lg object-cover" />}
      <p className="selectable mt-4 text-[14px] leading-relaxed">{item.description}</p>
      {html && (
        <div
          className="selectable prose-sm mt-5 space-y-3 text-[14px] leading-relaxed [&_a]:text-[var(--accent)] [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--surface-hover)] [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-[var(--surface-hover)] [&_pre]:p-3 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {item.url && (
        <div className="mt-5">
          <LinkButton href={item.url} variant="primary" icon={ExternalLink}>Open</LinkButton>
        </div>
      )}
    </motion.article>
  );
}

export default function CasualWorks({ windowId, itemId }) {
  const all = useData((s) => s.extras.casualWorks);
  const items = useMemo(() => all.filter((w) => !w.hidden), [all]);
  const setTitle = useWindows((s) => s.setTitle);
  const history = useHistoryStack(itemId ? { id: itemId } : { filter: 'all' });
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const loc = history.location;
  const current = loc.id ? items.find((w) => w.id === loc.id) : null;

  useEffect(() => {
    if (itemId) history.go({ id: itemId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);
  useEffect(() => {
    setTitle(windowId, current ? `${current.title} - My Documents` : 'Casual Works');
  }, [current, windowId, setTitle]);

  const filter = loc.filter ?? 'all';
  const q = query.toLowerCase();
  const shown = items.filter((w) => (filter === 'all' || w.kind === filter) && (!q || `${w.title} ${w.description}`.toLowerCase().includes(q)));
  const kindsPresent = Object.keys(KINDS).filter((k) => items.some((w) => w.kind === k));

  return (
    <Explorer
      history={history}
      crumbs={[
        { label: 'My Documents', onClick: () => history.go({ filter: 'all' }) },
        ...(current ? [{ label: current.title }] : filter !== 'all' ? [{ label: KINDS[filter].label }] : []),
      ]}
      onUp={current || filter !== 'all' ? () => history.go({ filter: current ? filter : 'all' }) : null}
      search={query}
      onSearch={(v) => {
        setQuery(v);
        if (current) history.go({ filter });
      }}
      searchPlaceholder="Search My Documents"
      nav={[
        { id: 'all', label: 'My Documents', icon: FolderOpen, count: items.length, color: '#f0a518' },
        ...kindsPresent.map((k) => ({ id: k, label: KINDS[k].label, icon: KINDS[k].icon, color: KINDS[k].color, count: items.filter((w) => w.kind === k).length })),
      ]}
      navActive={current ? null : filter}
      onNav={(id) => history.go({ filter: id })}
      view={current ? undefined : view}
      onView={current ? undefined : setView}
      status={current ? KINDS[current.kind].one : `${shown.length} items`}
    >
      {current ? (
        <Document key={current.id} item={current} />
      ) : shown.length === 0 ? (
        <EmptyState icon={FileSearch} title="Nothing here yet" />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-4">
          {shown.map((w) => {
            const K = KINDS[w.kind];
            return (
              <motion.button key={w.id} whileHover={{ y: -2 }} onClick={() => history.go({ id: w.id, filter })} onContextMenu={(e) => devItemMenu(e, 'casualWorks', w)} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] text-left hover:shadow-md">
                <div className="flex aspect-[4/3] items-center justify-center" style={{ background: `color-mix(in srgb, ${K.color} 18%, transparent)` }}>
                  {w.image ? <img src={w.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <K.icon size={40} style={{ color: K.color }} />}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-[13px] font-medium">{w.title}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{K.one}{w.date && ` · ${formatDate(w.date)}`}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="text-xs text-[var(--text-dim)]">
            <tr>
              <th className="px-3 py-2 font-normal">Name</th>
              <th className="px-3 py-2 font-normal">Type</th>
              <th className="hidden px-3 py-2 font-normal md:table-cell">Description</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((w) => {
              const K = KINDS[w.kind];
              return (
                <tr key={w.id} tabIndex={0} onClick={() => history.go({ id: w.id, filter })} onContextMenu={(e) => devItemMenu(e, 'casualWorks', w)} onKeyDown={(e) => e.key === 'Enter' && history.go({ id: w.id, filter })} className="cursor-default border-t border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  <td className="px-3 py-1.5"><span className="flex items-center gap-2"><K.icon size={15} style={{ color: K.color }} />{w.title}</span></td>
                  <td className="px-3 py-1.5 text-[var(--text-dim)]">{K.one}</td>
                  <td className="hidden max-w-md truncate px-3 py-1.5 text-[var(--text-dim)] md:table-cell">{w.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Explorer>
  );
}
