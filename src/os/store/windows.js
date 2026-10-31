/**
 * Window manager state. A window's "normal" rect is kept while it is maximised
 * or snapped, so restoring returns it to exactly where it was.
 */
import { create } from 'zustand';
import { getApp } from '../apps/registry.js';
import { viewport, clamp } from '../lib/geometry.js';
import { playSound } from '../lib/sound.js';

let seq = 0;

/** Rect actually shown on screen for a window, given its mode. */
export function displayRect(win, vp = viewport()) {
  switch (win.mode) {
    case 'maximized':
      return { x: 0, y: 0, w: vp.w, h: vp.h };
    case 'left':
      return { x: 0, y: 0, w: Math.round(vp.w / 2), h: vp.h };
    case 'right':
      return { x: Math.round(vp.w / 2), y: 0, w: vp.w - Math.round(vp.w / 2), h: vp.h };
    default:
      return win.rect;
  }
}

const topmostVisible = (windows, excludeId) =>
  windows.filter((w) => !w.minimized && w.id !== excludeId).sort((a, b) => b.z - a.z)[0]?.id ?? null;

export const useWindows = create((set, get) => ({
  windows: [],
  focusedId: null,
  zTop: 10,
  snapPreview: null, // null | 'left' | 'right' | 'maximized'

  /**
   * Open an app. `origin` is the rect of whatever launched it (desktop icon,
   * taskbar button, Start tile) so the window can spring out of it.
   */
  open: (appId, { origin = null, props = {} } = {}) => {
    const app = getApp(appId);
    if (!app) return null;
    const { windows, zTop } = get();
    if (app.single) {
      const existing = windows.find((w) => w.appId === appId);
      if (existing) {
        set({
          windows: windows.map((w) => (w.id === existing.id ? { ...w, minimized: false, z: zTop + 1, props: { ...w.props, ...props } } : w)),
          zTop: zTop + 1,
          focusedId: existing.id,
        });
        return existing.id;
      }
    }
    const vp = viewport();
    const w = Math.min(app.size.w, vp.w - 24);
    const h = Math.min(app.size.h, vp.h - 24);
    // Cascade so new windows never sit exactly on top of each other.
    const step = (windows.length % 7) * 28;
    const x = clamp(Math.round((vp.w - w) / 2) - 84 + step, 0, Math.max(0, vp.w - w));
    const y = clamp(Math.round((vp.h - h) / 2) - 56 + step, 0, Math.max(0, vp.h - h));
    const id = `${appId}-${++seq}`;
    playSound('open');
    set({
      windows: [
        ...windows,
        { id, appId, title: app.title, rect: { x, y, w, h }, mode: 'normal', minimized: false, z: zTop + 1, origin, props },
      ],
      zTop: zTop + 1,
      focusedId: id,
    });
    return id;
  },

  close: (id) => {
    playSound('close');
    set((s) => {
      const windows = s.windows.filter((w) => w.id !== id);
      return { windows, focusedId: s.focusedId === id ? topmostVisible(windows) : s.focusedId };
    });
  },

  closeAll: () => set({ windows: [], focusedId: null }),

  focus: (id) =>
    set((s) => {
      const win = s.windows.find((w) => w.id === id);
      if (!win || (s.focusedId === id && !win.minimized && win.z === s.zTop)) return s;
      return {
        windows: s.windows.map((w) => (w.id === id ? { ...w, z: s.zTop + 1, minimized: false } : w)),
        zTop: s.zTop + 1,
        focusedId: id,
      };
    }),

  minimize: (id) => {
    playSound('minimize');
    set((s) => ({
      windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)),
      focusedId: s.focusedId === id ? topmostVisible(s.windows, id) : s.focusedId,
    }));
  },

  restore: (id) => {
    playSound('open');
    get().focus(id);
  },

  toggleMaximize: (id) =>
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, mode: w.mode === 'normal' ? 'maximized' : 'normal' } : w)) })),

  setMode: (id, mode) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, mode } : w)) })),

  /** Commit a new normal-mode rect (after a drag or resize). */
  setRect: (id, rect) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, rect, mode: 'normal' } : w)) })),

  setTitle: (id, title) => set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, title } : w)) })),

  setSnapPreview: (snapPreview) => set((s) => (s.snapPreview === snapPreview ? s : { snapPreview })),

  /** Windows ordered most-recently-focused first (for Alt+` and the taskbar). */
  byRecency: () => [...get().windows].sort((a, b) => b.z - a.z),
}));
