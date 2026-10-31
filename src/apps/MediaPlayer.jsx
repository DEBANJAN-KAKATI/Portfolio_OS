/** Media Player: a playlist of YouTube / Vimeo / uploaded videos, plus project demo videos. */
import { useMemo, useState } from 'react';
import { Clapperboard, PlayCircle } from 'lucide-react';
import { useData } from '@/data/store.js';
import { devItemMenu, useDevActive } from '@/os/devmode.js';
import { Badge, EmptyState } from './kit/ui.jsx';

/** YouTube/Vimeo id from a URL or a bare id. */
function embedOf(v) {
  if (v.type === 'mp4') return null;
  let id = v.src;
  try {
    const url = new URL(v.src);
    if (v.type === 'youtube') id = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.match(/\/(shorts|embed)\/([\w-]+)/)?.[2];
    else id = url.pathname.match(/\/(\d+)/)?.[1];
  } catch {
    /* already an id */
  }
  if (!id || !/^[\w-]+$/.test(id)) return null;
  return v.type === 'youtube' ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : `https://player.vimeo.com/video/${id}`;
}

/** Project demo links that point at a playable video. */
function projectVideos(projects) {
  return projects
    .filter((p) => !p.hidden && p.videoUrl)
    .map((p) => {
      const type = /youtu\.?be/.test(p.videoUrl) ? 'youtube' : /vimeo\.com/.test(p.videoUrl) ? 'vimeo' : /\.(mp4|webm)(\?|$)/i.test(p.videoUrl) ? 'mp4' : null;
      return type && { id: `demo_${p.id}`, title: p.title, type, src: p.videoUrl, poster: null, description: 'Project demo', duration: null, demo: true };
    })
    .filter(Boolean);
}

function Player({ video }) {
  if (video.type === 'mp4') {
    return <video key={video.id} src={video.src} poster={video.poster ?? undefined} controls className="h-full w-full bg-black" />;
  }
  const src = embedOf(video);
  if (!src) return <p className="flex h-full items-center justify-center text-sm text-white/70">This video link can't be played here.</p>;
  return <iframe key={video.id} src={src} title={video.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
}

export default function MediaPlayer() {
  const videos = useData((s) => s.media.videos);
  const projects = useData((s) => s.portfolio.projects);
  const dev = useDevActive();
  const list = useMemo(() => [...(dev ? videos : videos.filter((v) => !v.hidden)), ...projectVideos(projects)], [videos, projects, dev]);
  const [currentId, setCurrentId] = useState(null);
  const current = list.find((v) => v.id === currentId) ?? list[0];

  if (!current) return <EmptyState icon={Clapperboard} title="No videos yet" />;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col bg-black">
        <div className="min-h-0 flex-1">
          <Player video={current} />
        </div>
        <div className="border-t border-white/10 bg-[var(--surface-solid)] px-4 py-2">
          <p className="text-sm font-semibold">{current.title}</p>
          {current.description && <p className="text-xs text-[var(--text-dim)]">{current.description}</p>}
        </div>
      </div>
      <ol aria-label="Playlist" className="max-h-48 shrink-0 overflow-y-auto border-[var(--border)] p-1 md:max-h-none md:w-64 md:border-l">
        {list.map((v) => (
          <li key={v.id}>
            <button
              onClick={() => setCurrentId(v.id)}
              onContextMenu={(e) => !v.demo && devItemMenu(e, 'videos', v)}
              aria-current={v.id === current.id ? 'true' : undefined}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--surface-hover)] ${v.id === current.id ? 'bg-[var(--surface-hover)]' : ''}`}
            >
              {v.poster ? <img src={v.poster} alt="" className="h-9 w-16 shrink-0 rounded object-cover" /> : <PlayCircle size={18} className="shrink-0" style={{ color: 'var(--accent)' }} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{v.title}</span>
                <span className="block truncate text-[11px] text-[var(--text-dim)]">{v.demo ? 'Project demo' : v.duration ?? v.type}</span>
              </span>
              {v.hidden && <Badge tone="muted">Hidden</Badge>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
