/** Projects: File Explorer in large-thumbnail view, plus a page per project. */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderGit2, Star, GitFork, Clock, ExternalLink, Globe, PlayCircle, ChevronLeft, ChevronRight, Sparkles, CloudOff, Layers, Tag as TagIcon, FolderSearch } from 'lucide-react';
import { useData, selectProjects, selectProjectTags } from '@/data/store.js';
import { useWindows } from '@/os/store/windows.js';
import { devItemMenu } from '@/os/devmode.js';
import { GithubGlyph } from '@/os/ui/AppIcon.jsx';
import Explorer, { useHistoryStack } from './kit/Explorer.jsx';
import ProjectThumb from './kit/ProjectThumb.jsx';
import { Badge, Bullets, Button, Card, Chip, EmptyState, LinkButton, Section, TagChip } from './kit/ui.jsx';
import { tagLabel, relativeTime, langColor, formatDate } from './kit/format.js';
import { stripTags } from '@/data/sanitize.js';
import { safeHtml } from '@/data/safeHtml.js';

const SORTS = {
  recent: (a, b) => (b.updatedAt ?? b.github?.pushedAt ?? '').localeCompare(a.updatedAt ?? a.github?.pushedAt ?? ''),
  name: (a, b) => a.title.localeCompare(b.title),
  stars: (a, b) => (b.github?.stars ?? -1) - (a.github?.stars ?? -1),
};

function matches(p, q) {
  if (!q) return true;
  const hay = [p.title, p.context, p.description, ...p.tech, ...p.tags.map(tagLabel), ...(p.github?.topics ?? []), stripTags(p.bullets[3].join(' '))]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export function ProjectCard({ p, onOpen }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={{ y: -2 }}
      onClick={onOpen}
      onContextMenu={(e) => devItemMenu(e, 'projects', p)}
      className="group flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] text-left transition-shadow hover:shadow-lg focus-visible:outline-offset-0"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        <ProjectThumb project={p} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex gap-1">
          {p.isNew && <Badge>New</Badge>}
          {p.featured && <Badge tone="amber">Featured</Badge>}
        </div>
        {p.github && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white backdrop-blur">
            <Star size={11} /> {p.github.stars}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{p.title}</h3>
        <p className="line-clamp-1 text-[11px] text-[var(--text-dim)]">{p.context.replace(/\s*\|\s*GitHub:.*$/, '')}</p>
        <p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-dim)] [&_b]:font-semibold [&_b]:text-[var(--text)]" dangerouslySetInnerHTML={safeHtml(p.bullets[1][0])} />
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {p.tech.slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-[var(--surface-hover)] px-1.5 py-px text-[10px]">{t}</span>
          ))}
        </div>
      </div>
    </motion.button>
  );
}

function DetailsTable({ projects, onOpen }) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead className="sticky top-0 bg-[var(--surface-solid)] text-xs text-[var(--text-dim)]">
        <tr>
          <th className="px-3 py-2 font-normal">Name</th>
          <th className="hidden px-3 py-2 font-normal lg:table-cell">Type</th>
          <th className="hidden px-3 py-2 font-normal sm:table-cell">Tech</th>
          <th className="px-3 py-2 font-normal">Stars</th>
          <th className="hidden px-3 py-2 font-normal md:table-cell">Updated</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((p) => (
          <tr key={p.id} tabIndex={0} onClick={() => onOpen(p)} onContextMenu={(e) => devItemMenu(e, 'projects', p)} onKeyDown={(e) => e.key === 'Enter' && onOpen(p)} className="cursor-default border-t border-[var(--border)] hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)]">
            <td className="px-3 py-1.5">
              <span className="flex items-center gap-2">
                <FolderGit2 size={15} className="shrink-0 text-amber-500" />
                <span className="truncate">{p.title}</span>
                {p.isNew && <Badge>New</Badge>}
              </span>
            </td>
            <td className="hidden max-w-48 truncate px-3 py-1.5 text-[var(--text-dim)] lg:table-cell">{p.context.replace(/\s*\|\s*GitHub:.*$/, '')}</td>
            <td className="hidden max-w-56 truncate px-3 py-1.5 text-[var(--text-dim)] sm:table-cell">{p.tech.slice(0, 4).join(', ')}</td>
            <td className="px-3 py-1.5 tabular-nums">{p.github ? p.github.stars : '—'}</td>
            <td className="hidden px-3 py-1.5 text-[var(--text-dim)] md:table-cell">{relativeTime(p.updatedAt ?? p.github?.pushedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Carousel({ project }) {
  const images = [...new Set([...project.images, ...(project.thumbnail && !project.thumbnail.includes('opengraph') ? [project.thumbnail] : [])])];
  const [i, setI] = useState(0);
  if (images.length === 0) return <ProjectThumb project={project} large className="aspect-[16/7] w-full rounded-lg" />;
  const go = (d) => setI((v) => (v + d + images.length) % images.length);
  return (
    <div className="group relative aspect-[16/7] w-full overflow-hidden rounded-lg bg-black">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.img key={images[i]} src={images[i]} alt={`${project.title} screenshot ${i + 1}`} className="absolute inset-0 h-full w-full object-contain" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} />
      </AnimatePresence>
      {images.length > 1 && (
        <>
          <button aria-label="Previous image" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100"><ChevronLeft size={18} /></button>
          <button aria-label="Next image" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100"><ChevronRight size={18} /></button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, k) => (
              <button key={k} aria-label={`Image ${k + 1}`} onClick={() => setI(k)} className="h-1.5 w-1.5 rounded-full" style={{ background: k === i ? 'white' : 'rgb(255 255 255 / 0.45)' }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LanguageBar({ languages }) {
  const entries = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) return null;
  const pct = (v) => (v / total) * 100;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full" role="img" aria-label={entries.map(([l, v]) => `${l} ${pct(v).toFixed(1)}%`).join(', ')}>
        {entries.map(([lang, v]) => (
          <span key={lang} style={{ width: `${pct(v)}%`, background: langColor(lang) }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {entries.slice(0, 6).map(([lang, v]) => (
          <li key={lang} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: langColor(lang) }} />
            {lang} <span className="text-[var(--text-dim)]">{pct(v).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectPage({ p }) {
  const gh = p.github;
  const range = [formatDate(p.startDate), formatDate(p.endDate)].filter(Boolean).join(' – ');
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl p-5">
      <Carousel project={p} />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="selectable font-[family-name:var(--font-display)] text-2xl font-semibold">{p.title}</h1>
            {p.isNew && <Badge>New</Badge>}
            {p.featured && <Badge tone="amber">Featured</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">{p.context.replace(/\s*\|\s*GitHub:.*$/, '')}{range && ` · ${range}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {gh && <LinkButton href={gh.url} variant="primary" icon={() => <GithubGlyph size={15} />}>GitHub</LinkButton>}
          {p.demoUrl && <LinkButton href={p.demoUrl} icon={Globe}>Live demo</LinkButton>}
          {p.videoUrl && <LinkButton href={p.videoUrl} icon={PlayCircle}>Video</LinkButton>}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Section title="What I built">
            <Bullets items={p.bullets[3]} />
          </Section>
          {p.tech.length > 0 && (
            <Section title="Tech used">
              <div className="flex flex-wrap gap-1.5">{p.tech.map((t) => <Chip key={t}>{t}</Chip>)}</div>
            </Section>
          )}
          {gh?.readmeExcerpt && (
            <Section title="From the README">
              <blockquote className="selectable border-l-[3px] pl-3 text-[13px] italic leading-relaxed text-[var(--text-dim)]" style={{ borderColor: 'var(--accent)' }}>
                {gh.readmeExcerpt}
              </blockquote>
            </Section>
          )}
        </div>

        <aside className="space-y-4">
          {gh ? (
            <Card className="space-y-4 p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="flex items-center justify-center gap-1 text-lg font-semibold"><Star size={15} className="text-amber-400" />{gh.stars}</p><p className="text-[11px] text-[var(--text-dim)]">stars</p></div>
                <div><p className="flex items-center justify-center gap-1 text-lg font-semibold"><GitFork size={15} />{gh.forks}</p><p className="text-[11px] text-[var(--text-dim)]">forks</p></div>
                <div><p className="flex items-center justify-center gap-1 text-sm font-semibold"><Clock size={14} />{relativeTime(gh.pushedAt) || '—'}</p><p className="text-[11px] text-[var(--text-dim)]">updated</p></div>
              </div>
              <LanguageBar languages={gh.languages} />
              {gh.topics.length > 0 && (
                <div className="flex flex-wrap gap-1">{gh.topics.map((t) => <Chip key={t}>#{t}</Chip>)}</div>
              )}
              <a href={gh.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                {gh.url.replace('https://github.com/', '')} <ExternalLink size={11} />
              </a>
            </Card>
          ) : (
            <Card className="flex gap-3 p-4 text-[13px]">
              <CloudOff size={18} className="shrink-0 text-[var(--text-dim)]" />
              <p className="text-[var(--text-dim)]">
                {p.plannedRepo ? 'Not on GitHub yet; the code is being cleaned up for release.' : 'This project has no public repository.'}
              </p>
            </Card>
          )}
          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold text-[var(--text-dim)]">Tags</p>
            <div className="flex flex-wrap gap-1.5">{p.tags.map((t) => <TagChip key={t} tag={t} />)}</div>
          </Card>
        </aside>
      </div>
    </motion.article>
  );
}

export default function Projects({ windowId, projectId }) {
  // Derive from the stable array; selectors that build new objects would re-render forever.
  const portfolio = useData((s) => s.portfolio);
  const projects = useMemo(() => selectProjects({ portfolio }), [portfolio]);
  const tags = useMemo(() => selectProjectTags({ portfolio }), [portfolio]);
  const setTitle = useWindows((s) => s.setTitle);
  const history = useHistoryStack(projectId ? { id: projectId } : { filter: 'all' });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('grid');
  const loc = history.location;

  // Opening from search/Start while the window is already open navigates to that project.
  useEffect(() => {
    if (projectId) history.go({ id: projectId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const current = loc.id ? projects.find((p) => p.id === loc.id) : null;
  useEffect(() => {
    setTitle(windowId, current ? `${current.title} - Projects` : 'Projects');
  }, [current, windowId, setTitle]);

  const filter = loc.filter ?? 'all';
  const filtered = useMemo(() => {
    const byFilter = {
      all: () => true,
      featured: (p) => p.featured,
      new: (p) => p.isNew,
      github: (p) => p.github,
      local: (p) => !p.github,
    };
    const fn = byFilter[filter] ?? ((p) => p.tags.includes(filter.replace(/^tag:/, '')));
    return projects.filter(fn).filter((p) => matches(p, query)).sort(SORTS[sort]);
  }, [projects, filter, query, sort]);

  const count = (fn) => projects.filter(fn).length;
  const nav = [
    { id: 'all', label: 'All projects', icon: Layers, count: projects.length },
    ...(count((p) => p.featured) ? [{ id: 'featured', label: 'Featured', icon: Star, count: count((p) => p.featured), color: '#f59e0b' }] : []),
    ...(count((p) => p.isNew) ? [{ id: 'new', label: 'New', icon: Sparkles, count: count((p) => p.isNew) }] : []),
    { id: 'github', label: 'On GitHub', icon: () => <GithubGlyph size={14} />, count: count((p) => p.github) },
    { id: 'local', label: 'Coming to GitHub', icon: CloudOff, count: count((p) => !p.github) },
    { id: 'h-tags', heading: true, label: 'Tags' },
    ...tags.map(({ tag, count: c }) => ({ id: `tag:${tag}`, label: tagLabel(tag), icon: TagIcon, count: c })),
  ];
  const filterLabel = nav.find((n) => n.id === filter)?.label ?? 'All projects';

  const openProject = (p) => history.go({ id: p.id, from: filter });

  const crumbs = [
    { label: 'Projects', onClick: () => history.go({ filter: 'all' }) },
    ...(current ? [{ label: current.title }] : filter !== 'all' ? [{ label: filterLabel }] : []),
  ];

  return (
    <Explorer
      history={history}
      crumbs={crumbs}
      onUp={current ? () => history.go({ filter: loc.from ?? 'all' }) : filter !== 'all' ? () => history.go({ filter: 'all' }) : null}
      search={query}
      onSearch={(q) => {
        setQuery(q);
        if (current) history.go({ filter });
      }}
      searchPlaceholder="Search projects"
      nav={nav}
      navActive={current ? null : filter}
      onNav={(id) => history.go({ filter: id })}
      view={current ? undefined : view}
      onView={current ? undefined : setView}
      toolbar={
        !current && (
          <>
            <span className="mr-1 text-xs text-[var(--text-dim)]">Sort</span>
            {[
              ['recent', 'Recent'],
              ['name', 'Name'],
              ['stars', 'Stars'],
            ].map(([id, label]) => (
              <Chip key={id} active={sort === id} onClick={() => setSort(id)}>{label}</Chip>
            ))}
            <span className="mx-2 h-4 w-px bg-[var(--border)] md:hidden" />
            <select
              aria-label="Filter"
              value={filter}
              onChange={(e) => history.go({ filter: e.target.value })}
              className="h-7 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2 text-xs md:hidden"
            >
              {nav.filter((n) => !n.heading).map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </>
        )
      }
      status={current ? `${current.title} · ${current.tech.slice(0, 5).join(', ')}` : `${filtered.length} item${filtered.length === 1 ? '' : 's'}`}
    >
      {current ? (
        <ProjectPage key={current.id} p={current} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderSearch} title="No projects match">
          <Button onClick={() => { setQuery(''); history.go({ filter: 'all' }); }}>Clear filters</Button>
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4">
          <AnimatePresence initial={false}>
            {filtered.map((p) => (
              <ProjectCard key={p.id} p={p} onOpen={() => openProject(p)} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <DetailsTable projects={filtered} onOpen={openProject} />
      )}
    </Explorer>
  );
}
