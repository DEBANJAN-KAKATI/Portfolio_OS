/**
 * The whole OS: boot flow, desktop, windows, taskbar and flyouts.
 */
import { useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useData, selectUpdatesSince } from '@/data/store.js';
import { useSystem, BOOT_PHASES } from './store/system.js';
import { useWindows } from './store/windows.js';
import { useMenu } from './ui/ContextMenu.jsx';
import ContextMenuHost from './ui/ContextMenu.jsx';
import { useResolvedTheme } from './lib/hooks.js';
import { contrastText, firstName } from './lib/format.js';
import { load, save, KEYS } from './lib/storage.js';
import { playSound } from './lib/sound.js';
import BootSequence from './boot/BootSequence.jsx';
import { ShuttingDown, PoweredOff, Screensaver } from './boot/PowerScreens.jsx';
import Desktop from './desktop/Desktop.jsx';
import WindowLayer from './window/WindowLayer.jsx';
import WindowSwitcher from './window/WindowSwitcher.jsx';
import Taskbar from './taskbar/Taskbar.jsx';
import StartMenu, { SearchPanel } from './taskbar/StartMenu.jsx';
import { QuickSettings, CalendarFlyout, NotificationCenter } from './taskbar/Flyouts.jsx';
import WidgetsPanel from './widgets/WidgetsPanel.jsx';
import Toasts from './ui/Toasts.jsx';
import Assistant from './ui/Assistant.jsx';
import RecruiterMode, { RecruiterButton } from './RecruiterMode.jsx';
import { useDev } from './devmode.js';

const IDLE_MS = 60_000;

// Dev-only handle for debugging and automated checks; stripped from production builds.
if (import.meta.env.DEV) window.__os = { windows: useWindows, system: useSystem, data: useData };

function useThemeTokens() {
  const theme = useResolvedTheme();
  const accent = useSystem((s) => s.settings.accent);
  const retro = useSystem((s) => s.settings.retro);
  useEffect(() => {
    const root = document.documentElement;
    // Retro skins have their own fixed palettes (light, with a navy/blue accent).
    root.dataset.theme = retro === 'off' ? theme : 'light';
    if (retro === 'off') delete root.dataset.retro;
    else root.dataset.retro = retro;
    const effectiveAccent = retro === '95' ? '#000080' : retro === 'xp' ? '#316ac5' : accent;
    root.style.setProperty('--accent', effectiveAccent);
    root.style.setProperty('--accent-text', contrastText(effectiveAccent));
  }, [theme, accent, retro]);
}

/** Alt+S Start, Alt+` window switcher, Alt+T Task Manager, Esc closes popups. */
function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e) => {
      const sys = useSystem.getState();
      if (sys.phase !== 'desktop') return;
      if (e.altKey && !e.ctrlKey && e.code === 'KeyS') {
        e.preventDefault();
        sys.togglePanel('start');
      } else if (e.altKey && e.code === 'Backquote') {
        e.preventDefault();
        sys.setSwitcher(sys.switcher === false ? 1 : sys.switcher + (e.shiftKey ? -1 : 1));
      } else if (e.altKey && !e.ctrlKey && e.code === 'KeyT') {
        e.preventDefault();
        sys.closePanels();
        useWindows.getState().open('skills');
      } else if (e.key === 'Escape') {
        if (sys.switcher !== false) sys.setSwitcher(false);
        else if (useMenu.getState().menu) useMenu.getState().close();
        else if (sys.panel) sys.closePanels();
      }
    };
    const onKeyUp = (e) => {
      const sys = useSystem.getState();
      if (e.key === 'Alt' && sys.switcher !== false) {
        const ordered = useWindows.getState().byRecency();
        if (ordered.length) useWindows.getState().focus(ordered[((sys.switcher % ordered.length) + ordered.length) % ordered.length].id);
        sys.setSwitcher(false);
      }
    };
    // Releasing Alt while another window has focus would otherwise leave the switcher open.
    const onBlur = () => useSystem.getState().setSwitcher(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
}

function useIdleScreensaver() {
  useEffect(() => {
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => useSystem.getState().startScreensaver(), IDLE_MS);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, []);
}

let greetedThisSession = false;

/** Startup sound + welcome toasts the first time the desktop appears in a session. */
function useDesktopGreeting(phase) {
  const name = useData((s) => s.portfolio.profile.name);
  useEffect(() => {
    if (phase !== 'desktop' || greetedThisSession) return;
    greetedThisSession = true;
    playSound('startup');
    const { notify } = useSystem.getState();
    const lastVisit = load(KEYS.lastVisit, null);
    save(KEYS.lastVisit, new Date().toISOString());
    // Fire-and-forget: the greeting must survive StrictMode's effect re-run, which would
    // otherwise cancel these timers and then skip because greetedThisSession is already set.
    const timers = [
      setTimeout(() => notify({ title: `Welcome to ${firstName(name)}'s PC`, body: 'Double-click an icon to open it, or press Alt+S for Start.', sound: null }), 900),
      setTimeout(
        () =>
          notify({
            title: `New message from ${firstName(name)}`,
            body: 'Thanks for stopping by! 👋',
            appId: 'mail',
            action: { appId: 'mail' },
          }),
        2600,
      ),
    ];
    const updates = lastVisit ? selectUpdatesSince(useData.getState(), lastVisit) : [];
    const added = updates.flatMap((u) => u.added.filter((a) => a.section === 'projects'));
    if (added.length) {
      timers.push(
        setTimeout(
          () =>
            notify({
              title: `${added.length} new project${added.length > 1 ? 's were' : ' was'} installed since your last visit`,
              body: added.slice(0, 3).map((a) => a.title).join(', '),
              appId: 'update',
              action: { appId: 'update' },
            }),
          4200,
        ),
      );
    }
  }, [phase, name]);
}

export default function Shell() {
  const phase = useSystem((s) => s.phase);
  const screensaver = useSystem((s) => s.screensaver);
  const reducedMotion = useSystem((s) => s.settings.reducedMotion);
  useThemeTokens();
  useShortcuts();
  useIdleScreensaver();
  useDesktopGreeting(phase);
  const DevRoot = useDev((s) => (s.active ? s.module.DevRoot : null));
  useEffect(() => {
    useDev.getState().check();
  }, []);

  // Restart / power-on: start from a clean desktop.
  useEffect(() => {
    if (phase === 'bios') {
      useWindows.getState().closeAll();
      greetedThisSession = false;
    }
  }, [phase]);

  const booting = BOOT_PHASES.includes(phase);
  const desktopVisible = phase === 'desktop' || booting; // keep windows mounted behind the lock screen

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div className="fixed inset-0 overflow-hidden bg-[var(--bg)]" onContextMenu={(e) => e.preventDefault()}>
        {desktopVisible && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <Desktop />
            <RecruiterButton />
            <WindowLayer />
            <Taskbar />
            <StartMenu />
            <SearchPanel />
            <WidgetsPanel />
            <QuickSettings />
            <CalendarFlyout />
            <NotificationCenter />
            <Toasts />
            <WindowSwitcher />
            <Assistant />
            {DevRoot && phase === 'desktop' && <DevRoot />}
          </motion.div>
        )}
        <RecruiterMode />
        <ContextMenuHost />
        <AnimatePresence>{booting && <BootSequence key="boot" />}</AnimatePresence>
        {phase === 'shutting-down' && <ShuttingDown />}
        {phase === 'off' && <PoweredOff />}
        <AnimatePresence>{screensaver && <Screensaver key="saver" />}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}
