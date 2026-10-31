/**
 * Skills as Task Manager. "Usage %" comes from real GitHub language bytes where
 * the skill is a language, otherwise from its order in the vault (marked as such).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ListTree, Activity, Rocket, ArrowDown, ArrowUp, Menu } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useMotionPrefs } from '@/os/lib/hooks.js';
import { GithubGlyph } from '@/os/ui/AppIcon.jsx';
import { SearchInput } from './kit/ui.jsx';

const TABS = [
  { id: 'processes', label: 'Processes', icon: ListTree },
  { id: 'performance', label: 'Performance', icon: Activity },
  { id: 'startup', label: 'Startup apps', icon: Rocket },
];

const PALETTE = ['#4cc2ff', '#b18cff', '#4fd18b', '#ffb84d', '#ff7aa8', '#5cc8ff', '#ffd25a'];
const heat = (pct) => `rgb(255 196 0 / ${0.08 + (pct / 100) * 0.5})`;
const avg = (skills) => Math.round(skills.reduce((s, k) => s + k.usage, 0) / Math.max(1, skills.length));

function Processes({ groups, highlight }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'usage', dir: -1 });
  const rowRef = useRef(null);
  const rows = useMemo(() => {
    const all = groups.flatMap((g) => g.skills.map((s) => ({ ...s, category: g.label })));
    const q = query.toLowerCase();
    return all
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
      });
  }, [groups, query, sort]);

  useEffect(() => {
    rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlight]);

  const Th = ({ k, children, className = '' }) => (
    <th className={`px-3 py-2 font-normal ${className}`} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : k === 'usage' || k === 'repos' ? -1 : 1 }))} className="inline-flex items-center gap-1 hover:text-[var(--text)]">
        {children}
        {sort.key === k && (sort.dir > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  const totalUsage = avg(rows);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-3">
        <h2 className="text-lg font-semibold">Processes</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search skills" className="ml-auto w-56" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-[var(--surface-solid)] text-xs text-[var(--text-dim)]">
            <tr>
              <Th k="name">Name</Th>
              <Th k="category" className="hidden sm:table-cell">Category</Th>
              <Th k="usage" className="w-28 text-right">
                <span className="flex flex-col items-end leading-tight"><span className="text-sm text-[var(--text)]">{totalUsage}%</span>Usage</span>
              </Th>
              <Th k="usageSource" className="hidden md:table-cell">Measured by</Th>
              <Th k="repos" className="hidden w-20 text-right lg:table-cell">Repos</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const hit = highlight && s.name.toLowerCase() === highlight.toLowerCase();
              return (
                <tr key={`${s.category}:${s.name}`} ref={hit ? rowRef : undefined} className={`border-t border-[var(--border)] hover:bg-[var(--surface-hover)] ${hit ? 'outline outline-2 -outline-offset-2 outline-[var(--accent)]' : ''}`}>
                  <td className="selectable px-3 py-1.5">{s.name}</td>
                  <td className="hidden px-3 py-1.5 text-[var(--text-dim)] sm:table-cell">{s.category}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums" style={{ background: heat(s.usage) }}>{s.usage}%</td>
                  <td className="hidden px-3 py-1.5 text-xs text-[var(--text-dim)] md:table-cell">
                    {s.usageSource === 'github' ? (
                      <span className="inline-flex items-center gap-1"><GithubGlyph size={11} /> {(s.bytes / 1000).toFixed(0)} KB of code</span>
                    ) : (
                      'Vault ranking'
                    )}
                  </td>
                  <td className="hidden px-3 py-1.5 text-right tabular-nums text-[var(--text-dim)] lg:table-cell">{s.repos || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--border)] px-4 py-1.5 text-[11px] text-[var(--text-dim)]">
        Languages are measured from code bytes across public GitHub repos; other skills are ranked by their order in the career vault.
      </p>
    </div>
  );
}

const POINTS = 60;

/** A wobbling utilisation history around `level`, like Task Manager's live graphs. */
function useLiveSeries(level, live) {
  const [series, setSeries] = useState(() => Array.from({ length: POINTS }, () => level));
  useEffect(() => {
    setSeries(Array.from({ length: POINTS }, (_, i) => Math.max(2, Math.min(100, level + Math.sin(i / 4) * 6))));
    if (!live) return;
    const t = setInterval(
      () =>
        setSeries((s) => {
          const last = s[s.length - 1];
          const next = Math.max(2, Math.min(100, last + (level - last) * 0.25 + (Math.random() - 0.5) * 14));
          return [...s.slice(1), next];
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [level, live]);
  return series;
}

function Graph({ series, color, height = 100, grid = true, className = '' }) {
  const w = 300;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${height - (v / 100) * height}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      {grid &&
        [...Array(10)].map((_, i) => <line key={`v${i}`} x1={(i * w) / 10} x2={(i * w) / 10} y1={0} y2={height} stroke="currentColor" strokeOpacity="0.08" vectorEffect="non-scaling-stroke" />)}
      {grid && [...Array(5)].map((_, i) => <line key={`h${i}`} x1={0} x2={w} y1={(i * height) / 5} y2={(i * height) / 5} stroke="currentColor" strokeOpacity="0.08" vectorEffect="non-scaling-stroke" />)}
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={color} fillOpacity="0.15" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function CategoryTile({ group, color, active, onClick, live }) {
  const level = avg(group.skills);
  const series = useLiveSeries(level, live);
  return (
    <button onClick={onClick} aria-pressed={active} className={`flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-[var(--surface-hover)] ${active ? 'bg-[var(--surface-hover)]' : ''}`}>
      <span className="h-10 w-16 shrink-0 overflow-hidden rounded border" style={{ borderColor: color }}>
        <Graph series={series} color={color} height={40} grid={false} className="h-full w-full" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px]">{group.label}</span>
        <span className="block text-xs text-[var(--text-dim)]">{Math.round(series.at(-1))}%</span>
      </span>
    </button>
  );
}

function Performance({ groups }) {
  const { reduced } = useMotionPrefs();
  const [sel, setSel] = useState(0);
  const group = groups[sel];
  const color = PALETTE[sel % PALETTE.length];
  const series = useLiveSeries(avg(group.skills), !reduced);
  const measured = group.skills.filter((s) => s.usageSource === 'github').length;
  const top = [...group.skills].sort((a, b) => b.usage - a.usage)[0];
  return (
    <div className="flex h-full min-h-0">
      <div className="w-56 shrink-0 space-y-1 overflow-y-auto border-r border-[var(--border)] p-2">
        {groups.map((g, i) => (
          <CategoryTile key={g.category} group={g} color={PALETTE[i % PALETTE.length]} active={i === sel} onClick={() => setSel(i)} live={!reduced} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">{group.label}</h2>
          <span className="text-sm text-[var(--text-dim)]">{group.skills.length} skills</span>
        </div>
        <div className="mt-3 flex justify-between text-xs text-[var(--text-dim)]">
          <span>% Utilization over 60 seconds</span>
          <span>100%</span>
        </div>
        <div className="mt-1 min-h-32 flex-1 border text-[var(--text)]" style={{ borderColor: color }}>
          <Graph series={series} color={color} className="h-full w-full" />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-4">
          <div><dt className="text-xs text-[var(--text-dim)]">Utilization</dt><dd className="text-xl">{Math.round(series.at(-1))}%</dd></div>
          <div><dt className="text-xs text-[var(--text-dim)]">Top process</dt><dd className="truncate text-xl" title={top?.name}>{top?.name.replace(/\s*\(.*\)/, '')}</dd></div>
          <div><dt className="text-xs text-[var(--text-dim)]">Measured on GitHub</dt><dd className="text-xl">{measured}</dd></div>
          <div><dt className="text-xs text-[var(--text-dim)]">Threads</dt><dd className="text-xl">{group.skills.length}</dd></div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {group.skills.map((s) => (
            <span key={s.name} className="rounded border border-[var(--border)] px-2 py-0.5 text-xs">{s.name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StartupApps({ items }) {
  return (
    <div className="p-5">
      <h2 className="mb-1 text-lg font-semibold">Startup apps</h2>
      <p className="mb-4 text-xs text-[var(--text-dim)]">Things I'm learning next. They launch at the next opportunity.</p>
      <table className="w-full text-left text-[13px]">
        <thead className="text-xs text-[var(--text-dim)]">
          <tr>
            <th className="px-3 py-2 font-normal">Name</th>
            <th className="hidden px-3 py-2 font-normal sm:table-cell">Publisher</th>
            <th className="px-3 py-2 font-normal">Status</th>
            <th className="px-3 py-2 font-normal">Startup impact</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.name} className="border-t border-[var(--border)] hover:bg-[var(--surface-hover)]">
              <td className="px-3 py-2">{it.name}</td>
              <td className="hidden px-3 py-2 text-[var(--text-dim)] sm:table-cell">{it.publisher}</td>
              <td className="px-3 py-2">Enabled</td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: it.impact === 'High' ? '#ef4444' : it.impact === 'Medium' ? '#f59e0b' : '#22c55e' }} />
                  {it.impact}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TaskManager({ skill }) {
  const groups = useData((s) => s.portfolio.skills);
  const learningNext = useData((s) => s.extras.learningNext);
  const [tab, setTab] = useState('processes');
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    if (skill) setTab('processes');
  }, [skill]);

  return (
    <div className="flex h-full">
      <nav aria-label="Task Manager pages" className={`flex shrink-0 flex-col gap-1 border-r border-[var(--border)] p-1.5 transition-[width] ${railOpen ? 'w-44' : 'w-12'}`}>
        <button aria-label="Toggle navigation" onClick={() => setRailOpen((v) => !v)} className="flex h-9 items-center gap-3 rounded-md px-2.5 hover:bg-[var(--surface-hover)]">
          <Menu size={16} />
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-label={t.label}
            title={t.label}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={`relative flex h-9 items-center gap-3 overflow-hidden rounded-md px-2.5 text-[13px] hover:bg-[var(--surface-hover)] ${tab === t.id ? 'bg-[var(--surface-hover)]' : ''}`}
          >
            {tab === t.id && <span className="absolute left-0 h-4 w-[3px] rounded-full" style={{ background: 'var(--accent)' }} />}
            <t.icon size={16} className="shrink-0" />
            {railOpen && <span className="truncate">{t.label}</span>}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        {tab === 'processes' && <Processes groups={groups} highlight={skill} />}
        {tab === 'performance' && <Performance groups={groups} />}
        {tab === 'startup' && <StartupApps items={learningNext} />}
      </div>
    </div>
  );
}
