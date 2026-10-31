import { CloudSun, Sun, Cloud, CloudRain, CloudFog, CloudSnow, CloudLightning, Moon, GitCommitHorizontal, Music2, BookOpen, Droplets, Wind } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useClock } from '../lib/hooks.js';
import Flyout from '../ui/Flyout.jsx';
import { GithubGlyph } from '../ui/AppIcon.jsx';
import { useWeather, describeWeather } from './useWeather.js';
import { useGithubActivity } from './useGithubActivity.js';

function WeatherGlyph({ code, isDay = true, size = 20 }) {
  if (code === 0) return isDay ? <Sun size={size} className="text-amber-400" /> : <Moon size={size} className="text-sky-300" />;
  if (code <= 2) return <CloudSun size={size} className="text-amber-300" />;
  if (code === 3) return <Cloud size={size} className="text-slate-400" />;
  if (code <= 48) return <CloudFog size={size} className="text-slate-400" />;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain size={size} className="text-sky-400" />;
  if (code <= 77) return <CloudSnow size={size} className="text-sky-200" />;
  return <CloudLightning size={size} className="text-yellow-400" />;
}

const Card = ({ title, icon, children, className = '' }) => (
  <section className={`rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-4 ${className}`}>
    {title && (
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-dim)]">
        {icon}
        {title}
      </h3>
    )}
    {children}
  </section>
);

function ClockCard() {
  const now = useClock(1000);
  const h = now.getHours();
  const greeting = h < 5 ? 'Up late?' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <Card>
      <p className="text-sm text-[var(--text-dim)]">{greeting}, visitor</p>
      <p className="font-[family-name:var(--font-display)] text-5xl font-semibold tabular-nums">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-sm text-[var(--text-dim)]">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </Card>
  );
}

function WeatherCard() {
  const w = useWeather();
  if (!w) return <Card title="Weather">Weather is unavailable right now.</Card>;
  return (
    <Card title={`Weather · ${w.label}, where I am`}>
      <div className="flex items-center gap-4">
        <WeatherGlyph code={w.code} isDay={w.isDay} size={44} />
        <div>
          <p className="text-3xl font-semibold">{Math.round(w.temperature)}°C</p>
          <p className="text-sm text-[var(--text-dim)]">{describeWeather(w.code)}</p>
        </div>
        <div className="ml-auto space-y-1 text-xs text-[var(--text-dim)]">
          <p className="flex items-center gap-1"><Droplets size={12} /> {w.humidity}%</p>
          <p className="flex items-center gap-1"><Wind size={12} /> {Math.round(w.wind)} km/h</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
        {w.daily.map((d) => (
          <div key={d.date} className="rounded-md py-1.5 hover:bg-[var(--surface-hover)]">
            <p className="text-[var(--text-dim)]">{new Date(d.date).toLocaleDateString([], { weekday: 'short' })}</p>
            <div className="my-1 flex justify-center"><WeatherGlyph code={d.code} size={18} /></div>
            <p>{Math.round(d.max)}° <span className="text-[var(--text-dim)]">{Math.round(d.min)}°</span></p>
          </div>
        ))}
      </div>
    </Card>
  );
}

const WEEKS = 26;

function ContributionGraph({ days }) {
  const recent = days.slice(-WEEKS * 7);
  // Align to week columns (Sunday first, like GitHub).
  const pad = new Date(recent[0].date).getDay();
  const cells = [...Array(pad).fill(null), ...recent];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const shade = (level) => (level ? `color-mix(in srgb, var(--accent) ${20 + level * 20}%, transparent)` : 'var(--surface-hover)');
  return (
    <div className="flex gap-[3px]" role="img" aria-label="GitHub contributions over the last six months">
      {weeks.map((week, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {week.map((d, j) => (
            <span key={j} className="h-[9px] w-[9px] rounded-[2px]" style={{ background: d ? shade(d.level) : 'transparent' }} title={d ? `${d.count} contributions on ${d.date}` : undefined} />
          ))}
        </div>
      ))}
    </div>
  );
}

function GithubCard() {
  const { data: live, loading } = useGithubActivity();
  const github = useData((s) => s.portfolio.github);
  // Prefer the contribution graph baked in by the sync; the live mirror is the fallback.
  const data = github?.contributions ? { ...live, contributions: github.contributions } : live;
  return (
    <Card title="GitHub activity" icon={<GithubGlyph size={12} />}>
      {data?.contributions?.days?.length ? (
        <>
          <ContributionGraph days={data.contributions.days} />
          {data.contributions.total != null && <p className="mt-2 text-xs text-[var(--text-dim)]">{data.contributions.total} contributions in the last year</p>}
        </>
      ) : (
        <p className="text-xs text-[var(--text-dim)]">{loading ? 'Loading contributions…' : 'Contribution graph unavailable.'}</p>
      )}
      <h4 className="mt-4 mb-1 text-xs font-semibold text-[var(--text-dim)]">Latest pushes</h4>
      <ul className="space-y-1">
        {(data?.pushes ?? []).map((p, i) => (
          <li key={i}>
            <a href={p.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-md p-1.5 text-xs hover:bg-[var(--surface-hover)]">
              <GitCommitHorizontal size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.repo}</span>
                {p.message && <span className="block truncate text-[var(--text-dim)]">{p.message}</span>}
              </span>
              <span className="ml-auto shrink-0 text-[var(--text-dim)]">{new Date(p.at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
            </a>
          </li>
        ))}
        {!loading && !data?.pushes?.length && <li className="text-xs text-[var(--text-dim)]">No recent public pushes.</li>}
      </ul>
      {github && (
        <a href={github.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs hover:underline" style={{ color: 'var(--accent)' }}>
          {github.publicRepos} public repos · {github.totalStars} stars →
        </a>
      )}
    </Card>
  );
}

function NowCard() {
  const learning = useData((s) => s.extras.currentlyLearning);
  const listening = useData((s) => s.extras.currentlyListening);
  return (
    <Card title="Right now">
      {learning.length > 0 && (
        <p className="flex items-start gap-2 text-sm">
          <BookOpen size={16} className="mt-0.5 shrink-0 text-emerald-500" />
          <span><span className="text-[var(--text-dim)]">Learning </span>{learning.join(', ')}</span>
        </p>
      )}
      {listening && (
        <p className="mt-2 flex items-start gap-2 text-sm">
          <Music2 size={16} className="mt-0.5 shrink-0 text-pink-500" />
          <span>
            <span className="text-[var(--text-dim)]">Listening to </span>
            {listening.url ? <a href={listening.url} target="_blank" rel="noreferrer" className="hover:underline">{listening.title}</a> : listening.title}
            <span className="text-[var(--text-dim)]"> · {listening.artist}</span>
          </span>
        </p>
      )}
    </Card>
  );
}

export default function WidgetsPanel() {
  return (
    <Flyout
      name="widgets"
      label="Widgets"
      from="left"
      className="flex w-[min(400px,calc(100vw-24px))] flex-col"
      style={{ left: 12, top: 12, bottom: 'calc(var(--taskbar-h) + 12px)' }}
    >
      <h2 className="px-5 pt-4 pb-2 text-sm font-semibold">Widgets</h2>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        <ClockCard />
        <WeatherCard />
        <GithubCard />
        <NowCard />
      </div>
    </Flyout>
  );
}
