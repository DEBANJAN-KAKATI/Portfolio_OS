/** Settings: theme, accent, wallpaper, retro skins, sound, motion, accounts. */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Palette, Volume2, Accessibility, UserRound, Info, Check, RefreshCw, Sun, Moon, SunMoon } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useSystem } from '@/os/store/system.js';
import { useWindows } from '@/os/store/windows.js';
import { playSound } from '@/os/lib/sound.js';
import { displayName } from '@/os/lib/format.js';
import { GithubGlyph } from '@/os/ui/AppIcon.jsx';
import { Button, Card } from './kit/ui.jsx';
import { relativeTime } from './kit/format.js';

const PAGES = [
  { id: 'display', label: 'Display', icon: Monitor },
  { id: 'personalization', label: 'Personalization', icon: Palette },
  { id: 'sound', label: 'Sound', icon: Volume2 },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { id: 'accounts', label: 'Accounts', icon: UserRound },
  { id: 'about', label: 'About', icon: Info },
];

const ACCENTS = ['#0078D4', '#0099BC', '#00B294', '#10893E', '#7A7574', '#CA5010', '#E81123', '#C30052', '#B146C2', '#744DA9', '#8764B8', '#FFB900'];

function Row({ title, description, children }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">{title}</p>
        {description && <p className="text-xs text-[var(--text-dim)]">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="flex items-center gap-2 text-[13px]">
      <span className="text-[var(--text-dim)]">{checked ? 'On' : 'Off'}</span>
      <span className="relative h-5 w-10 rounded-full border transition-colors" style={checked ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : { borderColor: 'var(--text-dim)' }}>
        <motion.span layout className="absolute top-[3px] h-3 w-3 rounded-full" style={{ left: checked ? 23 : 3, background: checked ? 'var(--accent-text)' : 'var(--text-dim)' }} />
      </span>
    </button>
  );
}

function Choice({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-md border border-[var(--border)] p-0.5">
      {options.map(([v, text, Icon]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs" style={value === v ? { background: 'var(--accent)', color: 'var(--accent-text)' } : undefined}>
          {Icon && <Icon size={13} />}
          {text}
        </button>
      ))}
    </div>
  );
}

function Display() {
  const { settings, updateSettings } = useSystem();
  const defaultAccent = useData((s) => s.extras.accentColor);
  return (
    <div className="space-y-2">
      <Row title="Mode" description="Light, dark, or follow your device">
        <Choice label="Theme" value={settings.theme} onChange={(theme) => updateSettings({ theme })} options={[['system', 'System', SunMoon], ['light', 'Light', Sun], ['dark', 'Dark', Moon]]} />
      </Row>
      <Card className="px-4 py-3">
        <p className="text-[13px]">Accent colour</p>
        <p className="mb-3 text-xs text-[var(--text-dim)]">Used for highlights, focus rings and the active taskbar indicator</p>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((c) => (
            <button key={c} role="radio" aria-checked={settings.accent.toLowerCase() === c.toLowerCase()} aria-label={c} onClick={() => updateSettings({ accent: c })} className="flex h-8 w-8 items-center justify-center rounded-md" style={{ background: c }}>
              {settings.accent.toLowerCase() === c.toLowerCase() && <Check size={16} color="#fff" />}
            </button>
          ))}
          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-2 text-xs">
            <input type="color" value={settings.accent} onChange={(e) => updateSettings({ accent: e.target.value })} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label="Custom accent colour" />
            Custom
          </label>
          <Button variant="ghost" onClick={() => updateSettings({ accent: defaultAccent })}>Reset</Button>
        </div>
      </Card>
    </div>
  );
}

function Personalization() {
  const { settings, updateSettings } = useSystem();
  const wallpapers = useData((s) => s.media.wallpapers);
  const tile = (id, label, style) => (
    <button key={id} onClick={() => updateSettings({ wallpaper: id })} aria-pressed={settings.wallpaper === id} className="group text-left">
      <span className="block aspect-video overflow-hidden rounded-md bg-cover bg-center ring-offset-2 ring-offset-[var(--surface-solid)]" style={{ ...style, boxShadow: settings.wallpaper === id ? '0 0 0 3px var(--accent)' : undefined }} />
      <span className="mt-1 block truncate text-xs">{label}</span>
    </button>
  );
  return (
    <div className="space-y-2">
      <Card className="px-4 py-3">
        <p className="mb-3 text-[13px]">Background</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tile('auto', 'Automatic (time of day)', { background: 'linear-gradient(90deg,#cfe6ff,#ffcfa8 50%,#18264a)' })}
          {wallpapers.map((w) => tile(w.id, w.name, { backgroundImage: `url("${w.src}")` }))}
        </div>
      </Card>
      <Row title="Desktop icon size">
        <Choice label="Icon size" value={settings.iconSize} onChange={(iconSize) => updateSettings({ iconSize })} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} />
      </Row>
      <Row title="Retro mode" description="Re-skin the whole OS as a classic">
        <Choice label="Retro mode" value={settings.retro} onChange={(retro) => { playSound('startup'); updateSettings({ retro }); }} options={[['off', 'Off'], ['95', 'Windows 95'], ['xp', 'XP']]} />
      </Row>
    </div>
  );
}

function Sound() {
  const { settings, updateSettings } = useSystem();
  return (
    <div className="space-y-2">
      <Row title="System sounds" description="Clicks, window sounds and notifications (synthesised, no downloads)">
        <Toggle label="System sounds" checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
      </Row>
      <Row title="Volume">
        <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} className="w-48" style={{ accentColor: 'var(--accent)' }} aria-label="Volume" />
        <span className="w-8 text-right text-xs tabular-nums">{Math.round(settings.volume * 100)}</span>
        <Button onClick={() => playSound('notify')}>Test</Button>
      </Row>
    </div>
  );
}

function AccessibilityPage() {
  const { settings, updateSettings } = useSystem();
  return (
    <div className="space-y-2">
      <Row title="Animation effects" description="Turn off to remove motion (your device's reduced-motion setting is always respected)">
        <Toggle label="Animation effects" checked={!settings.reducedMotion} onChange={(on) => updateSettings({ reducedMotion: !on })} />
      </Row>
      <Row title="Animation speed" description={`${settings.animationSpeed}× duration`}>
        <span className="text-xs text-[var(--text-dim)]">Faster</span>
        <input type="range" min={0.5} max={2} step={0.25} value={settings.animationSpeed} onChange={(e) => updateSettings({ animationSpeed: Number(e.target.value) })} className="w-40" style={{ accentColor: 'var(--accent)' }} aria-label="Animation speed" />
        <span className="text-xs text-[var(--text-dim)]">Slower</span>
      </Row>
    </div>
  );
}

const SOURCE_LABEL = { vault: 'jstMyRB career vault', github: 'GitHub', linkedin: 'LinkedIn (via the vault)' };

function Accounts() {
  const profile = useData((s) => s.portfolio.profile);
  const github = useData((s) => s.portfolio.github);
  const sources = useData((s) => s.portfolio.meta.sources);
  return (
    <div className="space-y-2">
      <Card className="flex items-center gap-4 px-4 py-3">
        {github?.avatarUrl ? <img src={github.avatarUrl} alt="" className="h-12 w-12 rounded-full" /> : <GithubGlyph size={40} />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold"><GithubGlyph size={13} /> GitHub</p>
          <p className="text-xs text-[var(--text-dim)]">{github ? `@${github.login} · ${github.publicRepos} repos · ${github.followers} followers · ${github.totalStars} stars` : 'Not connected'}</p>
        </div>
        <span className="text-xs text-emerald-500">Connected</span>
        {profile.github && <a href={profile.github} target="_blank" rel="noreferrer"><Button>View profile</Button></a>}
      </Card>
      <Card className="flex items-center gap-4 px-4 py-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#0a66c2] text-xl font-bold text-white" style={{ fontFamily: 'Arial, sans-serif' }}>in</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">LinkedIn</p>
          <p className="truncate text-xs text-[var(--text-dim)]">{profile.linkedin?.replace(/^https?:\/\/(www\.)?/, '') ?? 'Not connected'}</p>
        </div>
        <span className="text-xs text-emerald-500">Connected</span>
        {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer"><Button>View profile</Button></a>}
      </Card>
      <Card className="px-4 py-3">
        <p className="mb-2 text-[13px]">Data sources</p>
        <ul className="space-y-1.5 text-xs">
          {Object.entries(sources).map(([k, s]) => (
            <li key={k} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.status === 'ok' ? '#22c55e' : s.status === 'never' ? '#9ca3af' : '#f59e0b' }} />
              <span className="flex-1">{SOURCE_LABEL[k] ?? k}</span>
              <span className="text-[var(--text-dim)]">{s.at ? `synced ${relativeTime(s.at)}` : s.status === 'never' ? 'not imported yet' : s.status}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-3" icon={RefreshCw} onClick={() => useWindows.getState().open('update')}>Open Windows Update</Button>
      </Card>
    </div>
  );
}

function About() {
  const portfolio = useData((s) => s.portfolio);
  const name = displayName(portfolio.profile.name);
  const rows = [
    ['Device name', `${name.split(' ')[0]}-PC`],
    ['Edition', 'PortfolioOS'],
    ['Built with', 'React, Vite, Tailwind CSS, Framer Motion, Zustand, zod'],
    ['Data generated', new Date(portfolio.meta.generatedAt).toLocaleString()],
    ['Projects / skills', `${portfolio.projects.length} / ${portfolio.skills.reduce((n, g) => n + g.skills.length, 0)}`],
  ];
  return (
    <Card className="px-4 py-3">
      <dl className="selectable grid grid-cols-[140px_1fr] gap-y-2 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--text-dim)]">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-[var(--text-dim)]">App icons: Microsoft Fluent UI System Icons and Fluent Emoji (MIT). UI glyphs: Lucide (ISC) and Simple Icons (CC0). Original logo and artwork; not affiliated with Microsoft.</p>
    </Card>
  );
}

const COMPONENTS = { display: Display, personalization: Personalization, sound: Sound, accessibility: AccessibilityPage, accounts: Accounts, about: About };

export default function Settings({ page: initialPage }) {
  const profile = useData((s) => s.portfolio.profile);
  const [page, setPage] = useState(initialPage ?? 'display');
  useEffect(() => {
    if (initialPage) setPage(initialPage);
  }, [initialPage]);
  const Page = COMPONENTS[page] ?? Display;
  const meta = PAGES.find((p) => p.id === page);

  return (
    <div className="flex h-full">
      <nav aria-label="Settings" className="hidden w-60 shrink-0 flex-col gap-0.5 overflow-y-auto p-3 sm:flex">
        <div className="mb-3 flex items-center gap-3 px-2">
          {profile.avatar && <img src={profile.avatar} alt="" className="h-12 w-12 rounded-full" />}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">Guest</p>
            <p className="truncate text-xs text-[var(--text-dim)]">Visiting {displayName(profile.name)}'s PC</p>
          </div>
        </div>
        {PAGES.map((p) => (
          <button
            key={p.id}
            aria-current={page === p.id ? 'page' : undefined}
            onClick={() => setPage(p.id)}
            className={`relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] hover:bg-[var(--surface-hover)] ${page === p.id ? 'bg-[var(--surface-hover)]' : ''}`}
          >
            {page === p.id && <motion.span layoutId="settings-pill" className="absolute left-0 h-4 w-[3px] rounded-full" style={{ background: 'var(--accent)' }} />}
            <p.icon size={16} /> {p.label}
          </button>
        ))}
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto p-5">
        <select value={page} onChange={(e) => setPage(e.target.value)} className="mb-3 h-8 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2 text-[13px] sm:hidden" aria-label="Settings page">
          {PAGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <h1 className="mb-4 font-[family-name:var(--font-display)] text-2xl font-semibold">{meta.label}</h1>
        <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Page />
        </motion.div>
      </main>
    </div>
  );
}
