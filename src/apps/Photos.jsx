/** Photos: albums, a thumbnail grid and a lightbox with slideshow. */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause, X, Images } from 'lucide-react';
import { useData } from '@/data/store.js';
import { devItemMenu, useDevActive } from '@/os/devmode.js';
import { useTransition } from '@/os/lib/hooks.js';
import { Badge, EmptyState } from './kit/ui.jsx';
import { formatDate } from './kit/format.js';

const SLIDE_MS = 4000;

function Lightbox({ photos, index, onIndex, onClose }) {
  const [playing, setPlaying] = useState(false);
  const transition = useTransition();
  const photo = photos[index];
  const step = (d) => onIndex((index + d + photos.length) % photos.length);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => step(1), SLIDE_MS);
    return () => clearTimeout(t);
  });

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-black/95 text-white outline-none"
      role="dialog"
      aria-label={photo.caption || 'Photo'}
      tabIndex={-1}
      ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === ' ') {
          e.preventDefault();
          setPlaying((p) => !p);
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 text-[13px]">
        <span className="min-w-0 flex-1 truncate">{photo.caption}</span>
        <span className="text-white/60">{index + 1} / {photos.length}</span>
        <button aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} onClick={() => setPlaying((p) => !p)} className="rounded p-1.5 hover:bg-white/10">
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button aria-label="Close" onClick={onClose} className="rounded p-1.5 hover:bg-white/10"><X size={16} /></button>
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={photo.id}
            src={photo.src}
            alt={photo.caption}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition(0.25)}
          />
        </AnimatePresence>
        {photos.length > 1 && (
          <>
            <button aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/70"><ChevronLeft size={22} /></button>
            <button aria-label="Next photo" onClick={() => step(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 hover:bg-black/70"><ChevronRight size={22} /></button>
          </>
        )}
      </div>
      <p className="px-3 py-2 text-center text-xs text-white/60">{[photo.album, photo.date && formatDate(photo.date)].filter(Boolean).join(' · ')}</p>
    </div>
  );
}

export default function Photos() {
  const all = useData((s) => s.media.photos);
  const dev = useDevActive();
  const photos = useMemo(() => (dev ? all : all.filter((p) => !p.hidden)), [all, dev]);
  const albums = useMemo(() => [...new Set(photos.map((p) => p.album))], [photos]);
  const [album, setAlbum] = useState(null);
  const [open, setOpen] = useState(null);
  const shown = album ? photos.filter((p) => p.album === album) : photos;

  return (
    <div className="relative flex h-full">
      <nav aria-label="Albums" className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-[var(--border)] p-2 sm:flex">
        {[null, ...albums].map((a) => (
          <button
            key={a ?? 'all'}
            onClick={() => setAlbum(a)}
            aria-current={album === a ? 'page' : undefined}
            className={`flex h-8 items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-[var(--surface-hover)] ${album === a ? 'bg-[var(--surface-hover)]' : ''}`}
          >
            <Images size={14} className="shrink-0" />
            <span className="flex-1 truncate">{a ?? 'All photos'}</span>
            <span className="text-[11px] text-[var(--text-dim)]">{a ? photos.filter((p) => p.album === a).length : photos.length}</span>
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto p-3">
        <select value={album ?? ''} onChange={(e) => setAlbum(e.target.value || null)} className="mb-2 h-8 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2 text-[13px] sm:hidden" aria-label="Album">
          <option value="">All photos</option>
          {albums.map((a) => <option key={a}>{a}</option>)}
        </select>
        {shown.length === 0 ? (
          <EmptyState icon={Images} title="No photos yet" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
            {shown.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setOpen(i)}
                onContextMenu={(e) => devItemMenu(e, 'photos', p)}
                className="group relative aspect-square overflow-hidden rounded-md bg-[var(--surface-alt)]"
                aria-label={p.caption || `Photo ${i + 1}`}
              >
                <img src={p.thumb ?? p.src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                {p.hidden && <span className="absolute left-1 top-1"><Badge tone="muted">Hidden</Badge></span>}
                {p.caption && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">{p.caption}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {open !== null && shown[open] && <Lightbox photos={shown} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
