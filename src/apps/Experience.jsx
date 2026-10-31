/** Work Experience: one folder per company, or a vertical timeline. */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Folder, CalendarDays, MapPin, Briefcase, FolderOpen } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useWindows } from '@/os/store/windows.js';
import { devItemMenu } from '@/os/devmode.js';
import Explorer, { useHistoryStack } from './kit/Explorer.jsx';
import { Bullets, Chip, EmptyState, Section, TagChip, Badge } from './kit/ui.jsx';
import { formatDate } from './kit/format.js';

const isCurrent = (e) => !e.endDate && /present|current/i.test(e.duration);

function ExperiencePage({ e }) {
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl space-y-5 p-6">
      <header className="flex gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(145deg,#c79565,#8d5b32)' }}>
          <Briefcase size={26} />
        </span>
        <div className="min-w-0">
          <h1 className="selectable font-[family-name:var(--font-display)] text-xl font-semibold">{e.role}</h1>
          <p className="selectable text-sm">{e.company}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-dim)]">
            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {e.duration}</span>
            {e.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {e.location}</span>}
            {isCurrent(e) && <Badge tone="green">Current</Badge>}
          </p>
        </div>
      </header>
      <Section title="What I did">
        <Bullets items={e.bullets[3]} />
      </Section>
      {e.tech.length > 0 && (
        <Section title="Tech used">
          <div className="flex flex-wrap gap-1.5">{e.tech.map((t) => <Chip key={t}>{t}</Chip>)}</div>
        </Section>
      )}
      {e.tags.length > 0 && (
        <Section title="Areas">
          <div className="flex flex-wrap gap-1.5">{e.tags.map((t) => <TagChip key={t} tag={t} />)}</div>
        </Section>
      )}
    </motion.article>
  );
}

function Timeline({ items, onOpen }) {
  return (
    <ol className="relative mx-auto max-w-3xl p-6">
      <span className="absolute bottom-6 left-[31px] top-6 w-0.5 bg-[var(--border-strong)]" aria-hidden="true" />
      {items.map((e, i) => (
        <motion.li key={e.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative mb-5 pl-10">
          <span className="absolute left-0 top-3 flex h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: 'var(--accent)', background: isCurrent(e) ? 'var(--accent)' : 'var(--surface-solid)' }} />
          <button onClick={() => onOpen(e)} onContextMenu={(ev) => devItemMenu(ev, 'experiences', e)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-4 text-left transition hover:shadow-md">
            <p className="text-xs text-[var(--text-dim)]">
              {[formatDate(e.startDate), e.endDate ? formatDate(e.endDate) : isCurrent(e) ? 'Present' : ''].filter(Boolean).join(' – ') || e.duration}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold">{e.role}</h3>
            <p className="text-[13px] text-[var(--text-dim)]">{e.company}{e.location && ` · ${e.location}`}</p>
            <Bullets items={e.bullets[2]} className="mt-2" />
          </button>
        </motion.li>
      ))}
    </ol>
  );
}

export default function Experience({ windowId, experienceId }) {
  const items = useData((s) => s.portfolio.experiences);
  const setTitle = useWindows((s) => s.setTitle);
  const history = useHistoryStack(experienceId ? { id: experienceId } : {});
  const [mode, setMode] = useState('folders');
  const current = history.location.id ? items.find((e) => e.id === history.location.id) : null;

  useEffect(() => {
    if (experienceId) history.go({ id: experienceId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceId]);
  useEffect(() => {
    setTitle(windowId, current ? `${current.company} - Work Experience` : 'Work Experience');
  }, [current, windowId, setTitle]);

  const open = (e) => history.go({ id: e.id });

  return (
    <Explorer
      history={history}
      crumbs={[{ label: 'Work Experience', onClick: () => history.go({}) }, ...(current ? [{ label: current.company }] : [])]}
      onUp={current ? () => history.go({}) : null}
      nav={[
        { id: 'all', label: 'All companies', icon: FolderOpen, count: items.length },
        { id: 'h', heading: true, label: 'Companies' },
        ...items.map((e) => ({ id: e.id, label: e.company, icon: Folder, color: '#f0a518' })),
      ]}
      navActive={current?.id ?? 'all'}
      onNav={(id) => history.go(id === 'all' ? {} : { id })}
      toolbar={
        !current && (
          <>
            <Chip active={mode === 'folders'} onClick={() => setMode('folders')}>Folders</Chip>
            <Chip active={mode === 'timeline'} onClick={() => setMode('timeline')}>Timeline</Chip>
          </>
        )
      }
      status={current ? `${current.role} · ${current.duration}` : `${items.length} items`}
    >
      {current ? (
        <ExperiencePage key={current.id} e={current} />
      ) : items.length === 0 ? (
        <EmptyState icon={Briefcase} title="No experience yet" />
      ) : mode === 'timeline' ? (
        <Timeline items={items} onOpen={open} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 p-4">
          {items.map((e) => (
            <motion.button
              key={e.id}
              whileHover={{ y: -2 }}
              onClick={() => open(e)}
              onDoubleClick={() => open(e)}
              className="flex flex-col items-center gap-2 rounded-lg p-3 text-center hover:bg-[var(--surface-hover)]"
            >
              <Folder size={64} strokeWidth={1.2} className="fill-amber-300/90 text-amber-500" />
              <span className="line-clamp-2 text-[13px] font-medium">{e.company}</span>
              <span className="line-clamp-2 text-[11px] text-[var(--text-dim)]">{e.role}</span>
              <span className="text-[11px] text-[var(--text-dim)]">{e.duration}</span>
            </motion.button>
          ))}
        </div>
      )}
    </Explorer>
  );
}
