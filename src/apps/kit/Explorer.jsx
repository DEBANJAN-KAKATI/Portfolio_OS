/**
 * File Explorer chrome: back/forward/up, breadcrumb address bar, search,
 * navigation pane and status bar. Apps supply the location and the content.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { SearchInput } from './ui.jsx';

/** Browser-like history of "locations" (any serialisable value). */
export function useHistoryStack(initial) {
  const [state, setState] = useState({ stack: [initial], index: 0 });
  const go = useCallback(
    (loc) =>
      setState((s) => {
        if (JSON.stringify(s.stack[s.index]) === JSON.stringify(loc)) return s;
        const stack = [...s.stack.slice(0, s.index + 1), loc];
        return { stack, index: stack.length - 1 };
      }),
    [],
  );
  return {
    location: state.stack[state.index],
    go,
    back: () => setState((s) => ({ ...s, index: Math.max(0, s.index - 1) })),
    forward: () => setState((s) => ({ ...s, index: Math.min(s.stack.length - 1, s.index + 1) })),
    canBack: state.index > 0,
    canForward: state.index < state.stack.length - 1,
  };
}

const NavButton = ({ label, icon: Icon, onClick, disabled }) => (
  <button aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--surface-hover)] disabled:opacity-30">
    <Icon size={16} />
  </button>
);

/**
 * @param {object} p
 * @param {{label:string,onClick?:()=>void}[]} p.crumbs
 * @param {{id:string,label:string,icon?:any,count?:number,indent?:boolean}[]} [p.nav]
 */
export default function Explorer({
  history,
  crumbs,
  onUp,
  search,
  onSearch,
  searchPlaceholder,
  nav,
  navActive,
  onNav,
  view,
  onView,
  toolbar,
  status,
  children,
}) {
  // Each new location starts at the top, like opening a folder.
  const contentRef = useRef(null);
  const locationKey = JSON.stringify(history.location);
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [locationKey]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
        <NavButton label="Back" icon={ArrowLeft} onClick={history.back} disabled={!history.canBack} />
        <NavButton label="Forward" icon={ArrowRight} onClick={history.forward} disabled={!history.canForward} />
        <NavButton label="Up" icon={ArrowUp} onClick={onUp} disabled={!onUp} />
        <nav aria-label="Address" className="mx-1 flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2 text-[13px]">
          {crumbs.map((c, i) => (
            <span key={i} className="flex min-w-0 items-center gap-0.5">
              {i > 0 && <ChevronRight size={13} className="shrink-0 text-[var(--text-dim)]" />}
              <button onClick={c.onClick} disabled={!c.onClick} className="truncate rounded px-1 py-0.5 hover:bg-[var(--surface-hover)] disabled:hover:bg-transparent">
                {c.label}
              </button>
            </span>
          ))}
        </nav>
        {onSearch && <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder ?? 'Search'} className="w-44 sm:w-56" />}
      </div>

      {(toolbar || onView) && (
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-3 py-1">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">{toolbar}</div>
          {onView && (
            <div className="flex shrink-0 rounded-md border border-[var(--border)] p-0.5" role="group" aria-label="View">
              {[
                ['grid', LayoutGrid, 'Large icons'],
                ['list', List, 'Details'],
              ].map(([id, Icon, label]) => (
                <button key={id} aria-label={label} title={label} aria-pressed={view === id} onClick={() => onView(id)} className={`rounded p-1 ${view === id ? 'bg-[var(--surface-hover)]' : ''}`}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {nav && (
          <aside aria-label="Navigation pane" className="hidden w-48 shrink-0 overflow-y-auto border-r border-[var(--border)] p-1.5 md:block">
            {nav.map((n) =>
              n.heading ? (
                <p key={n.id} className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{n.label}</p>
              ) : (
                <button
                  key={n.id}
                  onClick={() => onNav(n.id)}
                  aria-current={navActive === n.id ? 'page' : undefined}
                  className={`relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-[var(--surface-hover)] ${navActive === n.id ? 'bg-[var(--surface-hover)]' : ''}`}
                >
                  {navActive === n.id && <span className="absolute left-0 h-4 w-[3px] rounded-full" style={{ background: 'var(--accent)' }} />}
                  {n.icon && <n.icon size={15} className="shrink-0" style={{ color: n.color }} />}
                  <span className="flex-1 truncate">{n.label}</span>
                  {n.count != null && <span className="text-xs text-[var(--text-dim)]">{n.count}</span>}
                </button>
              ),
            )}
          </aside>
        )}
        <div ref={contentRef} className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>

      {status && <footer className="shrink-0 border-t border-[var(--border)] px-3 py-1 text-xs text-[var(--text-dim)]">{status}</footer>}
    </div>
  );
}
