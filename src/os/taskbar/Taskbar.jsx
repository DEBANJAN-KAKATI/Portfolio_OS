import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Search, X, CloudSun, Pin } from 'lucide-react';
import { useWindows } from '../store/windows.js';
import { useSystem } from '../store/system.js';
import { useData } from '@/data/store.js';
import { getApp } from '../apps/registry.js';
import { registerTaskbarButton, fromDomRect } from '../lib/geometry.js';
import { useTransition } from '../lib/hooks.js';
import { useMenu } from '../ui/ContextMenu.jsx';
import AppIcon from '../ui/AppIcon.jsx';
import { useDevActive } from '../devmode.js';
import Monogram from '../ui/Monogram.jsx';
import SystemTray from './SystemTray.jsx';
import { useWeather } from '../widgets/useWeather.js';

function TaskbarIconButton({ label, toggle, onClick, children, active }) {
  return (
    <button
      aria-label={label}
      title={label}
      data-toggle={toggle}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-hover)] active:scale-95 active:bg-[var(--surface-press)] ${active ? 'bg-[var(--surface-hover)]' : ''}`}
    >
      {children}
    </button>
  );
}

function HoverPreview({ appId, windows, anchor, onClose }) {
  const transition = useTransition();
  const { focus, close } = useWindows.getState();
  if (!anchor) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={transition(0.16)}
      onMouseLeave={onClose}
      className="acrylic fixed z-[40000] flex gap-2 rounded-lg border border-[var(--border)] p-2"
      style={{ left: anchor.x + anchor.w / 2, bottom: 'calc(var(--taskbar-h) + 6px)', x: '-50%', boxShadow: 'var(--shadow-flyout)' }}
    >
      {windows.map((w) => (
        <div key={w.id} className="group w-48 rounded-md p-1.5 hover:bg-[var(--surface-hover)]">
          <div className="mb-1.5 flex items-center gap-2 text-xs">
            <AppIcon appId={appId} size={16} />
            <span className="flex-1 truncate">{w.title}</span>
            <button aria-label={`Close ${w.title}`} onClick={() => close(w.id)} className="rounded p-0.5 opacity-0 hover:bg-[#c42b1c] hover:text-white group-hover:opacity-100">
              <X size={12} />
            </button>
          </div>
          <button
            onClick={() => focus(w.id)}
            className="flex h-24 w-full items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-solid)]"
            aria-label={`Switch to ${w.title}`}
          >
            <AppIcon appId={appId} size={36} />
          </button>
        </div>
      ))}
    </motion.div>
  );
}

function AppButton({ appId, pinned }) {
  const ref = useRef(null);
  const app = getApp(appId);
  const windows = useWindows(useShallow((s) => s.windows.filter((w) => w.appId === appId)));
  const focusedId = useWindows((s) => s.focusedId);
  const openMenu = useMenu((s) => s.open);
  const [preview, setPreview] = useState(null);
  const hoverTimer = useRef(null);
  const transition = useTransition();

  useEffect(() => {
    registerTaskbarButton(appId, ref.current);
    return () => registerTaskbarButton(appId, null);
  }, [appId]);

  const running = windows.length > 0;
  const focused = windows.some((w) => w.id === focusedId && !w.minimized);

  const onClick = () => {
    setPreview(null);
    const { open, focus, minimize } = useWindows.getState();
    if (!running) return open(appId, { origin: fromDomRect(ref.current.getBoundingClientRect()) });
    const top = [...windows].sort((a, b) => b.z - a.z)[0];
    if (top.id === focusedId && !top.minimized) minimize(top.id);
    else focus(top.id);
  };

  const showPreview = () => {
    clearTimeout(hoverTimer.current);
    if (running) hoverTimer.current = setTimeout(() => setPreview(fromDomRect(ref.current.getBoundingClientRect())), 450);
  };
  const hidePreview = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPreview(null), 250);
  };

  return (
    <div className="relative" onMouseEnter={showPreview} onMouseLeave={hidePreview}>
      <motion.button
        ref={ref}
        layout="position"
        initial={pinned ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={transition(0.2)}
        aria-label={`${app.title}${running ? ' (running)' : ''}`}
        title={running ? undefined : app.title}
        onClick={onClick}
        onContextMenu={(e) =>
          openMenu(e, [
            { label: app.title, onSelect: () => useWindows.getState().open(appId) },
            ...(pinned ? [{ label: 'Pinned to taskbar', icon: Pin, disabled: true }] : []),
            ...(running ? [{ separator: true }, { label: windows.length > 1 ? 'Close all windows' : 'Close window', icon: X, onSelect: () => windows.forEach((w) => useWindows.getState().close(w.id)) }] : []),
          ])
        }
        className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-hover)] active:bg-[var(--surface-press)] ${focused ? 'bg-[var(--surface-hover)]' : ''}`}
      >
        <motion.span whileTap={{ scale: 0.85 }} className="flex">
          <AppIcon appId={appId} size={24} />
        </motion.span>
        {/* Running indicator: a dot, wider and accent-coloured when focused. */}
        <motion.span
          className="absolute bottom-0.5 h-[3px] rounded-full"
          animate={{ width: focused ? 16 : running ? 6 : 0, opacity: running ? 1 : 0, backgroundColor: focused ? 'var(--accent)' : 'var(--text-dim)' }}
          transition={transition(0.2)}
        />
      </motion.button>
      <AnimatePresence>{preview && <HoverPreview appId={appId} windows={windows} anchor={preview} onClose={() => setPreview(null)} />}</AnimatePresence>
    </div>
  );
}

function WidgetsButton() {
  const toggle = useSystem((s) => s.togglePanel);
  const weather = useWeather();
  return (
    <button
      data-toggle="widgets"
      aria-label="Widgets"
      onClick={() => toggle('widgets')}
      className="ml-2 flex h-10 items-center gap-2 rounded-md px-2 text-left hover:bg-[var(--surface-hover)]"
    >
      <CloudSun size={22} className="text-amber-400" />
      <span className="hidden text-xs leading-tight sm:block">
        <span className="block font-semibold">{weather ? `${Math.round(weather.temperature)}°C` : '—'}</span>
        <span className="block text-[var(--text-dim)]">{weather?.label ?? 'Weather'}</span>
      </span>
    </button>
  );
}

export default function Taskbar() {
  const pinnedLayout = useData((s) => s.layout.pinnedTaskbar);
  const devActive = useDevActive();
  const pinned = useMemo(() => (devActive ? [...pinnedLayout, 'studio'] : pinnedLayout), [devActive, pinnedLayout]);
  const runningApps = useWindows(useShallow((s) => [...new Set(s.windows.map((w) => w.appId))]));
  const panel = useSystem((s) => s.panel);
  const toggle = useSystem((s) => s.togglePanel);
  const appIds = [...pinned, ...runningApps.filter((id) => !pinned.includes(id))];

  return (
    <nav
      aria-label="Taskbar"
      className="os-taskbar acrylic absolute inset-x-0 bottom-0 z-[45000] flex items-center border-t border-[var(--border)]"
      style={{ height: 'var(--taskbar-h)' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex flex-1 items-center">
        <WidgetsButton />
      </div>
      <div className="flex items-center gap-1">
        <TaskbarIconButton label="Start" toggle="start" active={panel === 'start'} onClick={() => toggle('start')}>
          <motion.span whileTap={{ scale: 0.8 }} className="flex">
            <Monogram size={26} />
          </motion.span>
        </TaskbarIconButton>
        <TaskbarIconButton label="Search" toggle="search" active={panel === 'search'} onClick={() => toggle('search')}>
          <Search size={20} />
        </TaskbarIconButton>
        <AnimatePresence initial={false}>
          {appIds.map((id) => (
            <AppButton key={id} appId={id} pinned={pinned.includes(id)} />
          ))}
        </AnimatePresence>
      </div>
      <div className="flex flex-1 justify-end">
        <SystemTray />
      </div>
    </nav>
  );
}
