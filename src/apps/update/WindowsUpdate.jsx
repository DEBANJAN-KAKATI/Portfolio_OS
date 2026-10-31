/** Windows Update: sync status, "Installed updates" (the changelog) and a live check against GitHub. */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, CheckCircle2, AlertTriangle, Download, ChevronDown, ChevronRight, History, Database, Plus, Pencil, Minus, ExternalLink } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useSystem } from '@/os/store/system.js';
import { GithubGlyph } from '@/os/ui/AppIcon.jsx';
import { useTransition } from '@/os/lib/hooks.js';
import { Button, Card } from '../kit/ui.jsx';
import { relativeTime } from '../kit/format.js';
import { checkForUpdates } from './liveCheck.js';

const SOURCES = {
  vault: { label: 'jstMyRB career vault', icon: Database },
  github: { label: 'GitHub', icon: () => <GithubGlyph size={16} /> },
  linkedin: { label: 'LinkedIn (imported via the vault)', icon: () => <span className="text-xs font-bold">in</span> },
};
const STATUS = {
  ok: ['#22c55e', 'Synced'],
  stale: ['#f59e0b', 'Using last good data'],
  error: ['#ef4444', 'Failed'],
  never: ['#9ca3af', 'Not imported yet'],
};
const STEPS = ['Checking for updates…', 'Contacting GitHub…', 'Comparing with the installed version…'];

function Progress({ step }) {
  const transition = useTransition();
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs text-[var(--text-dim)]">{STEPS[step]}</p>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <motion.div className="h-full rounded-full" style={{ background: 'var(--accent)' }} initial={{ width: '0%' }} animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={transition(0.5)} />
      </div>
    </div>
  );
}

function HistoryEntry({ e, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const rows = [
    ...e.added.map((c) => [Plus, '#22c55e', c]),
    ...e.updated.map((c) => [Pencil, '#3b82f6', c]),
    ...e.removed.map((c) => [Minus, '#ef4444', c]),
  ];
  return (
    <li className="border-t border-[var(--border)] first:border-t-0">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--surface-hover)]">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="flex-1 text-[13px]">{e.title}</span>
        <span className="text-xs text-[var(--text-dim)]">Successfully installed on {new Date(e.date).toLocaleDateString()}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-11 pb-3 text-xs">
            {rows.slice(0, 40).map(([Icon, color, c], i) => (
              <li key={i} className="flex items-center gap-2 py-0.5">
                <Icon size={12} style={{ color }} />
                <span className="truncate">{c.title}</span>
                <span className="text-[var(--text-dim)]">· {c.section}</span>
              </li>
            ))}
            {rows.length > 40 && <li className="py-0.5 text-[var(--text-dim)]">…and {rows.length - 40} more</li>}
            {rows.length === 0 && <li className="text-[var(--text-dim)]">Data refresh, no item changes</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function WindowsUpdate() {
  const portfolio = useData((s) => s.portfolio);
  const changelog = useData((s) => s.changelog);
  const notify = useSystem((s) => s.notify);
  const [state, setState] = useState({ phase: 'idle', step: 0, result: null, error: null });

  const run = async () => {
    setState({ phase: 'checking', step: 0, result: null, error: null });
    const tick = (step) => new Promise((r) => setTimeout(() => (setState((s) => ({ ...s, step })), r()), 600));
    try {
      await tick(1);
      const result = await checkForUpdates(portfolio, { force: false });
      await tick(2);
      await new Promise((r) => setTimeout(r, 500));
      setState({ phase: 'done', step: 2, result, error: null });
      if (result.newRepos.length) {
        notify({ title: `${result.newRepos.length} new project${result.newRepos.length > 1 ? 's' : ''} available`, body: 'They will be installed in the next sync.', appId: 'update', sound: 'notify' });
      }
    } catch (err) {
      setState({ phase: 'error', step: 0, result: null, error: err.message });
    }
  };

  const r = state.result;
  const pending = r ? r.newRepos.length + r.updatedRepos.length : 0;
  const lastSync = portfolio.meta.generatedAt;

  let headline = "You're up to date";
  let Icon = CheckCircle2;
  let iconColor = '#22c55e';
  if (state.phase === 'checking') {
    headline = 'Checking for updates…';
    Icon = RefreshCw;
    iconColor = 'var(--accent)';
  } else if (state.phase === 'error') {
    headline = "Couldn't check for updates";
    Icon = AlertTriangle;
    iconColor = '#f59e0b';
  } else if (r && r.newRepos.length) {
    headline = `${r.newRepos.length} new project${r.newRepos.length > 1 ? 's' : ''} available`;
    Icon = Download;
    iconColor = 'var(--accent)';
  } else if (r && r.updatedRepos.length) {
    headline = `${r.updatedRepos.length} update${r.updatedRepos.length > 1 ? 's' : ''} available`;
    Icon = Download;
    iconColor = 'var(--accent)';
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl font-semibold">Windows Update</h1>

      <Card className="flex flex-wrap items-start gap-4 p-5">
        <motion.span animate={state.phase === 'checking' ? { rotate: 360 } : { rotate: 0 }} transition={state.phase === 'checking' ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : { duration: 0 }} className="mt-0.5">
          <Icon size={40} style={{ color: iconColor }} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold" role="status">{headline}</p>
          <p className="text-xs text-[var(--text-dim)]">
            Last sync: {new Date(lastSync).toLocaleString()} ({relativeTime(lastSync)})
            {r && ` · Last checked: ${new Date(r.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </p>
          {state.phase === 'checking' && <Progress step={state.step} />}
          {state.phase === 'error' && <p className="mt-2 text-xs text-amber-500">{state.error}</p>}
          {r && pending > 0 && (
            <ul className="mt-3 space-y-1 text-[13px]">
              {r.newRepos.map((repo) => (
                <li key={repo.fullName} className="flex items-center gap-2">
                  <Plus size={13} className="text-emerald-500" />
                  <a href={repo.url} target="_blank" rel="noreferrer" className="hover:underline">{repo.name}</a>
                  <span className="truncate text-xs text-[var(--text-dim)]">{repo.description ?? 'New repository'}</span>
                </li>
              ))}
              {r.updatedRepos.map((repo) => (
                <li key={repo.fullName} className="flex items-center gap-2">
                  <RefreshCw size={12} className="text-[var(--accent)]" />
                  <a href={repo.url} target="_blank" rel="noreferrer" className="hover:underline">{repo.name}</a>
                  <span className="text-xs text-[var(--text-dim)]">new commits {relativeTime(repo.pushedAt)}</span>
                </li>
              ))}
              <li className="pt-1 text-xs text-[var(--text-dim)]">These will be installed automatically in the next daily sync.</li>
            </ul>
          )}
          {r && (
            <p className="mt-2 text-[11px] text-[var(--text-dim)]">
              {r.source === 'cache' ? 'Result from the last few minutes (cached).' : r.source === 'not-modified' ? 'GitHub confirmed nothing changed (free check).' : 'Fetched live from GitHub.'}
              {r.remaining != null && ` ${r.remaining} checks left this hour.`}
            </p>
          )}
        </div>
        <Button variant="primary" icon={RefreshCw} onClick={run} disabled={state.phase === 'checking'}>
          {state.phase === 'checking' ? 'Checking…' : 'Check for updates'}
        </Button>
      </Card>

      <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold"><Database size={15} /> Sync status</h2>
      <Card>
        <ul>
          {Object.entries(portfolio.meta.sources).map(([key, s]) => {
            const meta = SOURCES[key] ?? { label: key, icon: Database };
            const [color, label] = STATUS[s.status] ?? STATUS.never;
            return (
              <li key={key} className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-3 first:border-t-0">
                <span className="flex w-5 justify-center"><meta.icon size={16} /></span>
                <span className="flex-1 text-[13px]">{meta.label}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
                <span className="w-28 text-right text-xs text-[var(--text-dim)]">{s.at ? relativeTime(s.at) : '—'}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold"><History size={15} /> Update history</h2>
      <Card>
        {changelog.entries.length === 0 ? (
          <p className="p-4 text-[13px] text-[var(--text-dim)]">No updates installed yet.</p>
        ) : (
          <ul>
            {changelog.entries.map((e, i) => (
              <HistoryEntry key={e.id} e={e} defaultOpen={i === 0} />
            ))}
          </ul>
        )}
      </Card>
      {portfolio.github?.url && (
        <a href={`${portfolio.github.url}?tab=repositories`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}>
          Browse all repositories <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}
