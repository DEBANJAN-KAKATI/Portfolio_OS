/** About Me: "System Properties" spec sheet + a Notepad with the intro typed out. */
import { useEffect, useState } from 'react';
import { Download, FolderGit2, Mail, MapPin } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useData, selectProjects } from '@/data/store.js';
import { useWindows } from '@/os/store/windows.js';
import { useMotionPrefs } from '@/os/lib/hooks.js';
import { displayName } from '@/os/lib/format.js';
import Monogram from '@/os/ui/Monogram.jsx';
import { Button, Card } from './kit/ui.jsx';

function useTypewriter(text, speed = 16) {
  const { reduced } = useMotionPrefs();
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) return setN(text.length);
    setN(0);
    const t = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(t), v) : v + 1)), speed);
    return () => clearInterval(t);
  }, [text, speed, reduced]);
  return [text.slice(0, n), n >= text.length, () => setN(text.length)];
}

function Notepad({ text }) {
  const [typed, done, finish] = useTypewriter(text);
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-4 border-b border-[var(--border)] px-3 py-1 text-xs text-[var(--text-dim)]">
        <span className="font-semibold text-[var(--text)]">intro.txt</span>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
      </div>
      <button onClick={finish} className="selectable flex-1 cursor-text p-4 text-left font-mono text-[13px] leading-relaxed" aria-label="Introduction (click to show all)">
        {typed}
        {!done && <span className="ml-px inline-block h-4 w-[2px] translate-y-0.5 animate-pulse" style={{ background: 'var(--accent)' }} />}
      </button>
      <div className="border-t border-[var(--border)] px-3 py-0.5 text-[11px] text-[var(--text-dim)]">
        Ln 1, Col {typed.length + 1} · UTF-8
      </div>
    </Card>
  );
}

export default function About() {
  const profile = useData((s) => s.portfolio.profile);
  const extras = useData((s) => s.extras);
  const education = useData((s) => s.portfolio.education[0]);
  const skillCount = useData((s) => s.portfolio.skills.reduce((n, g) => n + g.skills.length, 0));
  const projects = useData(useShallow((s) => selectProjects(s)));
  const github = useData((s) => s.portfolio.github);
  const open = useWindows((s) => s.open);
  const name = displayName(profile.name);

  const specs = [
    ['Device name', name],
    ['Processor', extras.tagline],
    ['Installed RAM', `${skillCount} skills`],
    ['System type', education ? `${education.degree}` : '—'],
    ['Storage', `${projects.length} projects · ${github?.publicRepos ?? 0} public repos`],
    ...extras.quickFacts.map((f) => [f.label, f.value]),
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5 lg:flex-row">
      <div className="flex shrink-0 flex-col gap-4 lg:w-[46%]">
        <div className="flex items-center gap-4">
          {profile.avatar ? <img src={profile.avatar} alt="" className="h-20 w-20 rounded-full border border-[var(--border)]" /> : <Monogram size={80} />}
          <div className="min-w-0">
            <h1 className="selectable font-[family-name:var(--font-display)] text-2xl font-semibold">{name}</h1>
            <p className="text-sm text-[var(--text-dim)]">{extras.tagline}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
              {profile.location && (
                <span className="inline-flex items-center gap-1"><MapPin size={12} /> {profile.location}</span>
              )}
            </p>
          </div>
        </div>

        <Card>
          <h2 className="border-b border-[var(--border)] px-4 py-2 text-sm font-semibold">Device specifications</h2>
          <dl className="selectable grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 p-4 text-[13px]">
            {specs.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[var(--text-dim)]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* The one quiet "contact me" line (content/extras.json → openToWork). */}
        {extras.openToWork.enabled && <p className="text-[13px] text-[var(--text-dim)]">{extras.openToWork.text}</p>}
        <div className="flex flex-wrap gap-2">
          <a href={extras.resume.url} download={extras.resume.fileName} tabIndex={-1}>
            <Button variant="primary" icon={Download}>Download Resume</Button>
          </a>
          <Button icon={FolderGit2} onClick={() => open('projects')}>View projects</Button>
          <Button icon={Mail} onClick={() => open('mail', { props: { compose: 'hello' } })}>Contact</Button>
        </div>
      </div>
      <Notepad text={extras.intro} />
    </div>
  );
}
