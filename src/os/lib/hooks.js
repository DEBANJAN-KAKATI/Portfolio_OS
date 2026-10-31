import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { viewport } from './geometry.js';
import { useSystem } from '../store/system.js';

export function useViewport() {
  const [vp, setVp] = useState(viewport);
  useEffect(() => {
    const onResize = () => setVp(viewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

/** Current time, re-rendering every `intervalMs`. */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** { reduced, speed } — honours both the OS setting and the in-app Settings toggle. */
export function useMotionPrefs() {
  const osReduced = useReducedMotion();
  const reducedSetting = useSystem((s) => s.settings.reducedMotion);
  const speed = useSystem((s) => s.settings.animationSpeed);
  return { reduced: Boolean(osReduced || reducedSetting), speed };
}

/** Transition helper: a quick tween scaled by Animation speed, instant when motion is reduced. */
export function useTransition() {
  const { reduced, speed } = useMotionPrefs();
  return (seconds = 0.2, extra = {}) => (reduced ? { duration: 0 } : { duration: seconds * speed, ease: [0.16, 1, 0.3, 1], ...extra });
}

/** Resolved 'light' | 'dark' from the theme setting and the OS preference. */
export function useResolvedTheme() {
  const theme = useSystem((s) => s.settings.theme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** Close on outside pointer-down (for flyouts/menus). `ignore` refs don't count as outside. */
export function useOutsideClick(ref, onOutside, active = true, ignore = []) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (ignore.some((r) => r.current?.contains(e.target))) return;
      onOutside(e);
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [ref, onOutside, active, ignore]);
}
