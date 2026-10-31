/**
 * First-visit boot: BIOS → logo → lock screen → login → "Welcome".
 * Plays once (remembered in localStorage), can be skipped, and replays on Restart.
 */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronsRight } from 'lucide-react';
import { useData, selectProjects } from '@/data/store.js';
import { useSystem } from '../store/system.js';
import { useClock, useTransition } from '../lib/hooks.js';
import { useWallpaper } from '../lib/wallpaper.js';
import { displayName } from '../lib/format.js';
import Monogram from '../ui/Monogram.jsx';
import Spinner from '../ui/Spinner.jsx';

function useTimer(ms, fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const t = setTimeout(() => fnRef.current(), ms);
    return () => clearTimeout(t);
  }, [ms]);
}

function Bios() {
  const setPhase = useSystem((s) => s.setPhase);
  const portfolio = useData((s) => s.portfolio);
  const visibleProjects = useData((s) => selectProjects(s).length);
  const name = displayName(portfolio.profile.name);
  const skills = portfolio.skills.reduce((n, g) => n + g.skills.length, 0);
  const lines = [
    `${name.toUpperCase()} SYSTEMS  BIOS v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    'Copyright (C) the curious mind of ' + name,
    '',
    'CPU   : Curiosity Core(TM) i9 @ 4.20 GHz, caffeinated',
    `Memory: ${skills} skills loaded ............ OK`,
    `Drive0: jstMyRB career vault ........... ${visibleProjects} projects`,
    `Drive1: GitHub/${portfolio.github?.login ?? 'unknown'} ........ ${portfolio.github?.publicRepos ?? '?'} repos`,
    `Net   : ${portfolio.profile.location ?? 'Earth'} ..................... connected`,
    '',
    'Booting PortfolioOS…',
  ];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setShown((n) => Math.min(lines.length, n + 1)), 120);
    return () => clearInterval(t);
  }, [lines.length]);
  useTimer(1700, () => setPhase('logo'));
  return (
    <div className="absolute inset-0 bg-black p-8 font-mono text-[13px] leading-6 text-[#c7c7c7]">
      {lines.slice(0, shown).map((l, i) => (
        <p key={i} className={i === 0 ? 'text-white' : ''}>{l || ' '}</p>
      ))}
      <p className="absolute bottom-6 left-8 text-[#8a8a8a]">Press DEL to enter SETUP (just kidding, you can't)</p>
    </div>
  );
}

function Logo() {
  const setPhase = useSystem((s) => s.setPhase);
  useTimer(2200, () => setPhase('lock'));
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-16 bg-black">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
        <Monogram size={120} />
      </motion.div>
      <Spinner size={40} color="#ffffff" label="Starting up" />
    </div>
  );
}

function WallpaperBackdrop({ blur = 0 }) {
  const wp = useWallpaper();
  return (
    <div
      className="absolute inset-0 scale-110 bg-cover bg-center"
      style={{ backgroundImage: `url("${wp.src}")`, filter: blur ? `blur(${blur}px) brightness(0.8)` : 'brightness(0.85)' }}
      aria-hidden="true"
    />
  );
}

function LockScreen() {
  const setPhase = useSystem((s) => s.setPhase);
  const quotes = useData((s) => s.extras.lockScreenQuotes);
  const now = useClock(1000);
  const [q, setQ] = useState(() => Math.floor(Math.random() * quotes.length));
  useEffect(() => {
    const t = setInterval(() => setQ((i) => (i + 1) % quotes.length), 6000);
    return () => clearInterval(t);
  }, [quotes.length]);
  useEffect(() => {
    const go = (e) => {
      if (e.key === 'Tab') return;
      setPhase('login');
    };
    window.addEventListener('keydown', go);
    return () => window.removeEventListener('keydown', go);
  }, [setPhase]);
  return (
    <motion.button
      aria-label="Lock screen. Click or press any key to sign in."
      onClick={() => setPhase('login')}
      className="absolute inset-0 block w-full cursor-default overflow-hidden text-white"
      exit={{ y: '-100%' }}
      transition={{ duration: 0.45, ease: [0.7, 0, 0.84, 0] }}
    >
      <WallpaperBackdrop />
      <div className="relative flex h-full flex-col items-center pt-[14vh]" style={{ textShadow: '0 2px 12px rgb(0 0 0 / 0.4)' }}>
        <p className="font-[family-name:var(--font-display)] text-[clamp(64px,12vw,120px)] font-semibold leading-none tabular-nums">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="mt-2 text-xl">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={q}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-auto mb-24 max-w-xl px-6 text-center text-base italic opacity-90"
          >
            “{quotes[q]}”
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

function Login() {
  const setPhase = useSystem((s) => s.setPhase);
  const profile = useData((s) => s.portfolio.profile);
  const transition = useTransition();
  const [pw, setPw] = useState('');
  const signIn = (e) => {
    e?.preventDefault();
    setPhase('welcome');
  };
  return (
    <motion.div className="absolute inset-0 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition(0.3)}>
      <WallpaperBackdrop blur={40} />
      <form onSubmit={signIn} className="relative flex h-full flex-col items-center justify-center gap-4">
        {profile.avatar ? (
          <img src={profile.avatar} alt="" className="h-40 w-40 rounded-full border-4 border-white/20 object-cover shadow-xl" />
        ) : (
          <Monogram size={160} />
        )}
        <h1 className="text-3xl font-semibold">{displayName(profile.name)}</h1>
        <div className="flex h-9 w-72 items-center overflow-hidden rounded-md border-b-2 border-b-[var(--accent)] bg-black/35 backdrop-blur">
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            aria-label="Password (any password works)"
            className="h-full flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/60"
          />
          <button type="submit" aria-label="Sign in" className="flex h-full w-9 items-center justify-center hover:bg-white/15">
            <ArrowRight size={16} />
          </button>
        </div>
        <p className="text-xs text-white/70">Any password works</p>
        <button
          type="button"
          onClick={signIn}
          className="mt-2 rounded-md bg-white/15 px-5 py-2 text-sm backdrop-blur transition hover:bg-white/25 active:scale-95"
        >
          Sign in as Guest
        </button>
      </form>
    </motion.div>
  );
}

function Welcome() {
  const setPhase = useSystem((s) => s.setPhase);
  useTimer(1500, () => setPhase('desktop'));
  return (
    <motion.div className="absolute inset-0 text-white" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <WallpaperBackdrop blur={40} />
      <div className="relative flex h-full flex-col items-center justify-center gap-6">
        <Spinner size={40} color="#fff" label="Signing in" />
        <p className="text-2xl">Welcome</p>
      </div>
    </motion.div>
  );
}

const SCREENS = { bios: Bios, logo: Logo, lock: LockScreen, login: Login, welcome: Welcome };

export default function BootSequence() {
  const phase = useSystem((s) => s.phase);
  const skipBoot = useSystem((s) => s.skipBoot);
  const Screen = SCREENS[phase];
  return (
    <motion.div className="fixed inset-0 z-[90000] bg-black" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
      <AnimatePresence>{Screen && <Screen key={phase} />}</AnimatePresence>
      {phase !== 'welcome' && (
        <button
          onClick={skipBoot}
          className="absolute right-5 bottom-5 z-10 flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur transition hover:bg-white/20"
        >
          Skip intro <ChevronsRight size={14} />
        </button>
      )}
    </motion.div>
  );
}
