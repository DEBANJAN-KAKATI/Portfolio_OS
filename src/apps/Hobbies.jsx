/** Hobbies: a folder of hobby icons, each opening a fun popup. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clapperboard, Heart, ExternalLink, FolderGit2 } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useWindows } from '@/os/store/windows.js';
import { devItemMenu } from '@/os/devmode.js';
import { useMotionPrefs } from '@/os/lib/hooks.js';
import Dialog from './kit/Dialog.jsx';
import { Badge, Button, EmptyState, LinkButton } from './kit/ui.jsx';

function Burst({ emoji }) {
  const { reduced } = useMotionPrefs();
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-10 text-xl"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: Math.cos(angle) * 120, y: Math.sin(angle) * 70, opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            {emoji}
          </motion.span>
        );
      })}
    </div>
  );
}

const isEmoji = (icon) => !icon.startsWith('/');

export default function Hobbies() {
  const all = useData((s) => s.extras.hobbies);
  const playlist = useData((s) => s.extras.playlist);
  const hobbies = useMemo(() => all.filter((h) => !h.hidden), [all]);
  const [openId, setOpenId] = useState(null);
  const current = hobbies.find((h) => h.id === openId);

  if (!hobbies.length) return <EmptyState icon={Heart} title="No hobbies listed yet" />;
  return (
    <div className="relative h-full overflow-y-auto">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2 p-5">
        {hobbies.map((h, i) => (
          <motion.button
            key={h.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4, rotate: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpenId(h.id)}
            onContextMenu={(e) => devItemMenu(e, 'hobbies', h)}
            className="flex flex-col items-center gap-2 rounded-xl p-4 hover:bg-[var(--surface-hover)]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-solid)] text-4xl shadow-sm">
              {isEmoji(h.icon) ? h.icon : <img src={h.icon} alt="" className="h-10 w-10" />}
            </span>
            <span className="text-[13px] font-medium">{h.name}</span>
          </motion.button>
        ))}
        {playlist.length > 0 && (
          <motion.button whileHover={{ y: -4 }} onClick={() => useWindows.getState().open('videos', { props: { tab: 'music' } })} className="flex flex-col items-center gap-2 rounded-xl p-4 hover:bg-[var(--surface-hover)]">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: 'linear-gradient(145deg,#ff6b6b,#c92a2a)' }}>
              <Clapperboard size={30} />
            </span>
            <span className="text-[13px] font-medium">Lofi player</span>
          </motion.button>
        )}
      </div>

      <Dialog open={!!current} onClose={() => setOpenId(null)} title={current ? `${isEmoji(current.icon) ? current.icon + ' ' : ''}${current.name}` : ''} footer={<Button variant="primary" onClick={() => setOpenId(null)}>Nice!</Button>}>
        {current && (
          <div className="relative">
            {isEmoji(current.icon) && <Burst key={current.id} emoji={current.icon} />}
            <p className="selectable text-[14px] leading-relaxed">{current.blurb}</p>
            {current.funFact && (
              <p className="mt-3 flex gap-2 rounded-md bg-[var(--surface-hover)] p-3 text-[13px]">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <span><b>Fun fact:</b> {current.funFact}</span>
              </p>
            )}
            {(current.projects?.length > 0 || current.projectsNote) && (
              <div className="mt-3 rounded-md border border-[var(--border)] p-3">
                <p className="mb-1 flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                  <FolderGit2 size={15} /> Projects {current.projectsNote && <Badge tone="amber">{current.projectsNote}</Badge>}
                </p>
                {current.projects?.length > 0 && (
                  <ul className="list-disc pl-5 text-[13px]">
                    {current.projects.map((pr) => <li key={pr}>{pr}</li>)}
                  </ul>
                )}
              </div>
            )}
            {current.url && (
              <LinkButton href={current.url} variant="primary" icon={ExternalLink} className="mt-3 inline-block">
                {current.urlLabel || 'Open link'}
              </LinkButton>
            )}
            {current.images.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {current.images.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" className="aspect-square rounded-md object-cover" />
                ))}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
