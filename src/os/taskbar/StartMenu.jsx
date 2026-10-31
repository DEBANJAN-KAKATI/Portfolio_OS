import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Search, Power, Moon, RotateCcw, FolderGit2, Briefcase, Activity, NotebookPen, ArrowRight, FileText } from 'lucide-react';
import { useRecruiter } from '../RecruiterMode.jsx';
import { useData, selectRecommended } from '@/data/store.js';
import { buildSearchIndex, search } from '@/data/search.js';
import { apps, getApp } from '../apps/registry.js';
import { useSystem } from '../store/system.js';
import { useWindows } from '../store/windows.js';
import { useMenu } from '../ui/ContextMenu.jsx';
import { fromDomRect } from '../lib/geometry.js';
import { displayName } from '../lib/format.js';
import Flyout from '../ui/Flyout.jsx';
import AppIcon from '../ui/AppIcon.jsx';

const KIND_ICON = { project: FolderGit2, experience: Briefcase, skill: Activity, casual: NotebookPen };
const KIND_LABEL = { app: 'Apps', project: 'Projects', experience: 'Experience', skill: 'Skills', casual: 'Casual works' };

/** Where a search result goes when chosen. */
export function openResult(result, origin) {
  const { open } = useWindows.getState();
  useSystem.getState().closePanels();
  switch (result.kind) {
    case 'app':
      return open(result.id, { origin });
    case 'project':
      return open('projects', { origin, props: { projectId: result.id } });
    case 'experience':
      return open('experience', { origin, props: { experienceId: result.id } });
    case 'skill':
      return open('skills', { origin, props: { skill: result.title } });
    case 'casual':
      return open('casual', { origin, props: { itemId: result.id } });
    default:
      return null;
  }
}

function useSearch(query) {
  const state = useData();
  const index = useMemo(() => buildSearchIndex(state, apps), [state]);
  return useMemo(() => search(index, query, 24), [index, query]);
}

export function SearchResults({ query, onPick }) {
  const results = useSearch(query);
  const groups = useMemo(() => {
    const g = new Map();
    for (const r of results) g.set(r.kind, [...(g.get(r.kind) ?? []), r]);
    return [...g.entries()];
  }, [results]);

  if (!results.length) return <p className="px-6 py-10 text-center text-sm text-[var(--text-dim)]">No results for “{query}”</p>;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" role="listbox" aria-label="Search results">
      {groups.map(([kind, items]) => (
        <section key={kind} className="mb-3">
          <h3 className="px-2 pb-1 text-xs font-semibold text-[var(--text-dim)]">{KIND_LABEL[kind] ?? kind}</h3>
          {items.map((r) => {
            const Icon = KIND_ICON[r.kind];
            return (
              <button
                key={`${r.kind}:${r.id}`}
                role="option"
                aria-selected="false"
                onClick={(e) => onPick(r, fromDomRect(e.currentTarget.getBoundingClientRect()))}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]"
              >
                {r.kind === 'app' ? (
                  <AppIcon appId={r.id} size={28} />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--surface-alt)]"><Icon size={16} /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{r.title}</span>
                  <span className="block truncate text-xs text-[var(--text-dim)]">{r.subtitle}</span>
                </span>
                <ArrowRight size={14} className="text-[var(--text-dim)]" />
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Search text that clears whenever its panel opens, like Windows. */
function usePanelQuery(name) {
  const [query, setQuery] = useState('');
  const open = useSystem((s) => s.panel === name);
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  return [query, setQuery];
}

function SearchBox({ value, onChange, autoFocus, onEnter }) {
  return (
    <label className="mx-6 mt-6 mb-4 flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-solid)] px-4 focus-within:border-b-2 focus-within:border-b-[var(--accent)]">
      <Search size={15} className="text-[var(--text-dim)]" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder="Search apps, projects, skills…"
        aria-label="Search"
        className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-dim)]"
      />
    </label>
  );
}

const BOTTOM = { left: 0, right: 0, marginInline: 'auto', bottom: 'calc(var(--taskbar-h) + 12px)' };

export default function StartMenu() {
  const [query, setQuery] = usePanelQuery('start');
  const pinned = useData((s) => s.layout.pinnedStart);
  const profile = useData((s) => s.portfolio.profile);
  const recommended = useData(useShallow((s) => selectRecommended(s, 6)));
  const results = useSearch(query);
  const { sleep, restart, shutDown, closePanels } = useSystem.getState();
  const openMenu = useMenu((s) => s.open);
  const powerRef = useRef(null);

  const openApp = (appId, el) => {
    closePanels();
    useWindows.getState().open(appId, { origin: el ? fromDomRect(el.getBoundingClientRect()) : null });
  };

  return (
    <Flyout name="start" label="Start" className="flex h-[min(720px,calc(100vh-72px))] w-[min(640px,calc(100vw-24px))] flex-col" style={BOTTOM}>
      <SearchBox value={query} onChange={setQuery} autoFocus onEnter={() => results[0] && openResult(results[0])} />
      {query ? (
        <SearchResults query={query} onPick={openResult} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-8">
          <h3 className="mb-2 px-2 text-sm font-semibold">Pinned</h3>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {pinned.filter(getApp).map((id) => (
              <button
                key={id}
                onClick={(e) => openApp(id, e.currentTarget)}
                className="flex flex-col items-center gap-1.5 rounded-md px-1 py-3 text-center hover:bg-[var(--surface-hover)] active:scale-95"
              >
                <AppIcon appId={id} size={32} />
                <span className="line-clamp-1 text-xs">{getApp(id).title}</span>
              </button>
            ))}
          </div>
          <h3 className="mt-5 mb-2 px-2 text-sm font-semibold">Recommended</h3>
          <div className="grid gap-1 pb-4 sm:grid-cols-2">
            {recommended.map((p) => (
              <button
                key={p.id}
                onClick={(e) => openResult({ kind: 'project', id: p.id }, fromDomRect(e.currentTarget.getBoundingClientRect()))}
                className="flex items-center gap-3 rounded-md p-2 text-left hover:bg-[var(--surface-hover)]"
              >
                <AppIcon appId="projects" size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{p.title}</span>
                  <span className="block truncate text-xs text-[var(--text-dim)]">{p.isNew ? 'New · ' : ''}{p.context || p.tech.slice(0, 3).join(' · ')}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <footer className="flex h-16 shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface-alt)] px-10">
        <button onClick={(e) => openApp('about', e.currentTarget)} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--surface-hover)]">
          {profile.avatar ? <img src={profile.avatar} alt="" className="h-8 w-8 rounded-full" /> : <AppIcon appId="about" size={32} />}
          <span className="text-sm">{displayName(profile.name)}</span>
        </button>
        <button
          onClick={() => {
            closePanels();
            useRecruiter.getState().setOpen(true);
          }}
          className="ml-auto mr-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] hover:bg-[var(--surface-hover)]"
        >
          <FileText size={16} style={{ color: 'var(--accent)' }} /> One-page view
        </button>
        <button
          ref={powerRef}
          aria-label="Power"
          className="rounded-md p-2 hover:bg-[var(--surface-hover)]"
          onClick={() => {
            const r = powerRef.current.getBoundingClientRect();
            openMenu({ clientX: r.left - 150, clientY: r.top - 120 }, [
              { label: 'Sleep', icon: Moon, onSelect: sleep },
              { label: 'Shut down', icon: Power, onSelect: shutDown },
              { label: 'Restart', icon: RotateCcw, onSelect: restart },
            ]);
          }}
        >
          <Power size={18} />
        </button>
      </footer>
    </Flyout>
  );
}

export function SearchPanel() {
  const [query, setQuery] = usePanelQuery('search');
  const results = useSearch(query);
  const top = ['projects', 'about', 'resume', 'mail', 'terminal', 'skills'];
  const suggestions = ['Python', 'React', 'FastAPI', 'RAG', 'LSTM', 'finance'];
  return (
    <Flyout name="search" label="Search" className="flex h-[min(640px,calc(100vh-72px))] w-[min(640px,calc(100vw-24px))] flex-col" style={BOTTOM}>
      <SearchBox value={query} onChange={setQuery} autoFocus onEnter={() => results[0] && openResult(results[0])} />
      {query ? (
        <SearchResults query={query} onPick={openResult} />
      ) : (
        <div className="px-8">
          <h3 className="mb-2 text-sm font-semibold">Top apps</h3>
          <div className="mb-6 flex flex-wrap gap-2">
            {top.map((id) => (
              <button key={id} onClick={(e) => openResult({ kind: 'app', id }, fromDomRect(e.currentTarget.getBoundingClientRect()))} className="flex w-24 flex-col items-center gap-1.5 rounded-md p-2 hover:bg-[var(--surface-hover)]">
                <AppIcon appId={id} size={32} />
                <span className="truncate text-xs">{getApp(id).title}</span>
              </button>
            ))}
          </div>
          <h3 className="mb-2 text-sm font-semibold">Quick searches</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setQuery(s)} className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </Flyout>
  );
}
