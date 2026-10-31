/** Trophy cabinet: patents, certifications, positions of responsibility and awards. Cards flip on click. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, Award, Users, Medal, ExternalLink, Image as ImageIcon, RotateCcw, Trophy } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useWindows } from '@/os/store/windows.js';
import { devItemMenu } from '@/os/devmode.js';
import { useMotionPrefs } from '@/os/lib/hooks.js';
import { safeHtml } from '@/data/safeHtml.js';
import { EmptyState } from './kit/ui.jsx';

const KINDS = [
  { kind: 'patent', title: 'Patents', icon: ScrollText, colors: ['#ffd25a', '#d68a00'] },
  { kind: 'award', title: 'Awards & Medals', icon: Medal, colors: ['#ffcf4d', '#c27c0e'] },
  { kind: 'certification', title: 'Certifications', icon: Award, colors: ['#7cc4ff', '#2563eb'] },
  { kind: 'por', title: 'Positions of Responsibility', icon: Users, colors: ['#b18cff', '#6f3fd8'] },
];

function TrophyCard({ a, meta, index }) {
  const [flipped, setFlipped] = useState(false);
  const { reduced } = useMotionPrefs();
  const Icon = meta.icon;
  const face = 'absolute inset-0 flex flex-col rounded-xl border border-[var(--border)] p-4 [backface-visibility:hidden]';
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="h-48 [perspective:1000px]">
      <motion.div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`${a.title}. ${flipped ? 'Showing details' : 'Press to show details'}`}
        onClick={() => setFlipped((f) => !f)}
        onContextMenu={(e) => devItemMenu(e, 'achievements', a)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped((f) => !f))}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
        className="relative h-full w-full cursor-pointer outline-none [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl"
      >
        {/* Front */}
        <div className={`${face} items-center justify-center gap-3 text-center`} style={{ background: 'linear-gradient(180deg, var(--surface-solid), var(--surface-alt))' }}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg" style={{ background: `radial-gradient(circle at 30% 30%, ${meta.colors[0]}, ${meta.colors[1]})` }}>
            <Icon size={26} />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{a.label}</p>
          <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{a.title}</h3>
        </div>
        {/* Back */}
        <div className={`${face} gap-2 [transform:rotateY(180deg)]`} style={{ background: 'var(--surface-solid)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: meta.colors[1] }}>{a.label}</p>
          <h3 className="line-clamp-2 text-[13px] font-semibold">{a.title}</h3>
          <p className="selectable line-clamp-5 text-xs leading-relaxed text-[var(--text-dim)]" dangerouslySetInnerHTML={safeHtml(a.details || 'No further details.')} />
          <div className="mt-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {a.image && (
              <button onClick={() => useWindows.getState().open('photos', { props: { src: a.image, caption: a.title } })} className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                <ImageIcon size={12} /> View certificate
              </button>
            )}
            {a.url && (
              <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                <ExternalLink size={12} /> Verify
              </a>
            )}
            <RotateCcw size={12} className="ml-auto text-[var(--text-dim)]" aria-hidden="true" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Achievements() {
  const items = useData((s) => s.portfolio.achievements);
  if (!items.length) return <EmptyState icon={Trophy} title="The cabinet is empty (for now)" />;
  let index = 0;
  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%)' }}>
      <header className="mb-5 flex items-center gap-3">
        <Trophy size={28} className="text-amber-400" />
        <div>
          <h1 className="text-xl font-semibold">Trophy cabinet</h1>
          <p className="text-xs text-[var(--text-dim)]">{items.length} items · click a card to flip it</p>
        </div>
      </header>
      {KINDS.map((meta) => {
        const list = items.filter((a) => a.kind === meta.kind);
        if (!list.length) return null;
        return (
          <section key={meta.kind} className="mb-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">{meta.title}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 border-b-4 border-[var(--border-strong)] pb-4">
              {list.map((a) => (
                <TrophyCard key={a.id} a={a} meta={meta} index={index++} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
