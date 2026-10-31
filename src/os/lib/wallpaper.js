import { useData } from '@/data/store.js';
import { useSystem } from '../store/system.js';
import { useClock } from './hooks.js';

export function timeOfDay(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 16) return 'morning';
  if (h >= 16 && h < 20) return 'evening';
  return 'night';
}

/** The wallpaper to show now: a fixed choice, or "auto" following the time of day. */
export function useWallpaper() {
  const choice = useSystem((s) => s.settings.wallpaper);
  const wallpapers = useData((s) => s.media.wallpapers);
  const now = useClock(60_000);
  if (choice !== 'auto') {
    const fixed = wallpapers.find((w) => w.id === choice);
    if (fixed) return fixed;
  }
  const tod = timeOfDay(now);
  return wallpapers.find((w) => w.timeOfDay === tod) ?? wallpapers[0];
}
