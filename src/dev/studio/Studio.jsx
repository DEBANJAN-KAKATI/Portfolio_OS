/** Portfolio Studio: the Dev Mode dashboard and editors. */
import { useEffect, useState } from 'react';
import { LayoutDashboard, FolderGit2, Briefcase, Activity, GraduationCap, Trophy, Image, Clapperboard, Box, Images, Heart, NotebookPen, UserRound, LayoutGrid, RefreshCw, Rocket, Wallpaper, Link2, Trash2, LogOut } from 'lucide-react';
import { useDev } from '@/os/devmode.js';
import { useData } from '@/data/store.js';
import { useStagedCount } from '../store.js';
import { SECTIONS } from '../sections.js';
import SectionView from './SectionView.jsx';
import { Dashboard, ProfileView, LayoutView, SyncView, PendingView, TrashView, HistoryDialog } from './panels.jsx';

const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['projects', 'Projects', FolderGit2],
  ['experiences', 'Experience', Briefcase],
  ['skills', 'Skills', Activity],
  ['education', 'Education', GraduationCap],
  ['achievements', 'Achievements', Trophy],
  ['photos', 'Photos', Image],
  ['videos', 'Videos', Clapperboard],
  ['models', '3D models', Box],
  ['renders', '3D renders', Images],
  ['hobbies', 'Hobbies', Heart],
  ['casualWorks', 'Casual works', NotebookPen],
  ['profile', 'Profile & text', UserRound],
  ['wallpapers', 'Wallpapers', Wallpaper],
  ['shortcuts', 'Shortcuts', Link2],
  ['layout', 'Desktop & Start', LayoutGrid],
  ['trash', 'Deleted items', Trash2],
  ['sync', 'Sync', RefreshCw],
  ['pending', 'Pending changes', Rocket],
];

export default function Studio({ page: initialPage, itemId }) {
  const [page, setPage] = useState(initialPage ?? 'dashboard');
  const [history, setHistory] = useState(null);
  const count = useStagedCount();
  const trashCount = useData((s) => s.trash.items.length);
  const session = useDev((s) => s.session);
  useEffect(() => {
    if (initialPage) setPage(initialPage);
  }, [initialPage, itemId]);

  const sec = SECTIONS[page];
  let view;
  if (sec) view = <SectionView key={`${page}:${itemId ?? ''}`} sec={sec} initialId={page === initialPage ? itemId : undefined} onHistory={(item) => setHistory({ sec, item })} />;
  else if (page === 'profile') view = <ProfileView />;
  else if (page === 'layout') view = <LayoutView />;
  else if (page === 'sync') view = <SyncView />;
  else if (page === 'pending') view = <PendingView />;
  else if (page === 'trash') view = <TrashView />;
  else view = <Dashboard go={setPage} />;

  return (
    <div className="flex h-full">
      <nav aria-label="Studio" className="hidden w-52 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] p-2 sm:flex">
        <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Portfolio Studio</p>
        {NAV.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            aria-current={page === id ? 'page' : undefined}
            className={`relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] hover:bg-[var(--surface-hover)] ${page === id ? 'bg-[var(--surface-hover)]' : ''}`}
          >
            {page === id && <span className="absolute left-0 h-4 w-[3px] rounded-full" style={{ background: 'var(--accent)' }} />}
            <Icon size={15} className="shrink-0" />
            <span className="flex-1 truncate text-left">{label}</span>
            {id === 'pending' && count > 0 && <span className="rounded-full px-1.5 text-[11px]" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>{count}</span>}
            {id === 'trash' && trashCount > 0 && <span className="text-[11px] text-[var(--text-dim)]">{trashCount}</span>}
          </button>
        ))}
        <div className="mt-auto border-t border-[var(--border)] pt-2 text-[11px] text-[var(--text-dim)]">
          {session && <p className="px-2 pb-1">Session ends {new Date(session.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
          <button onClick={() => useDev.getState().logout()} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[var(--surface-hover)]">
            <LogOut size={14} /> Exit Dev Mode
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <select value={page} onChange={(e) => setPage(e.target.value)} className="m-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2 text-[13px] sm:hidden" aria-label="Studio page">
          {NAV.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        {view}
      </main>
      <HistoryDialog target={history} onClose={() => setHistory(null)} />
    </div>
  );
}
