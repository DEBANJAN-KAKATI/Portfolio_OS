/**
 * OS-wide state: boot phase, persisted settings, open flyouts and notifications.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import extras from '@content/extras.json';
import layout from '@content/layout.json';
import { load, save, KEYS } from '../lib/storage.js';
import { configureSound, playSound } from '../lib/sound.js';

/**
 * bios → logo → lock → login → welcome → desktop
 * desktop → shutting-down → off → bios      (Shut down, then the power button)
 * desktop → bios                              (Restart)
 */
export const BOOT_PHASES = ['bios', 'logo', 'lock', 'login', 'welcome'];

const DEFAULT_SETTINGS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  accent: extras.accentColor,
  wallpaper: layout.defaultWallpaper, // 'auto' (time of day) or a wallpaper id
  sound: true,
  volume: 0.6,
  animationSpeed: 1, // multiplier: 0.5 = twice as fast
  reducedMotion: false,
  iconSize: 'medium', // 'small' | 'medium' | 'large'
  retro: 'off', // 'off' | '95' | 'xp'
};

let nextNotificationId = 1;

export const useSystem = create(
  persist(
    (set, get) => ({
      phase: load(KEYS.booted, false) ? 'desktop' : 'bios',
      // null | 'idle' (screensaver, any input returns to the desktop) | 'sleep' (wakes to the lock screen)
      screensaver: null,
      settings: DEFAULT_SETTINGS,
      wifi: true,
      // Only one flyout/panel is open at a time.
      panel: null, // 'start' | 'search' | 'widgets' | 'calendar' | 'notifications' | 'quick'
      switcher: false,
      notifications: [],
      toasts: [],

      setPhase: (phase) => {
        if (phase === 'desktop') save(KEYS.booted, true);
        set({ phase, panel: null });
      },
      skipBoot: () => get().setPhase('desktop'),
      restart: () => set({ phase: 'bios', panel: null, screensaver: null }),
      shutDown: () => {
        playSound('shutdown');
        set({ phase: 'shutting-down', panel: null });
      },
      sleep: () => set({ screensaver: 'sleep', panel: null }),
      startScreensaver: () => set((s) => (s.screensaver || s.phase !== 'desktop' ? s : { screensaver: 'idle' })),
      wake: () => {
        const mode = get().screensaver;
        set({ screensaver: null, phase: mode === 'sleep' ? 'lock' : get().phase });
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setWifi: (on) => set({ wifi: on }),

      openPanel: (panel) => {
        playSound('menu');
        set({ panel });
      },
      togglePanel: (panel) => {
        if (get().panel !== panel) playSound('menu');
        set((s) => ({ panel: s.panel === panel ? null : panel }));
      },
      closePanels: () => set({ panel: null }),
      setSwitcher: (on) => set({ switcher: on }),

      /** Adds to the notification center and, unless toast:false, pops a toast. */
      notify: ({ title, body = '', appId = null, toast = true, sound = 'notify', action = null }) => {
        const n = { id: nextNotificationId++, title, body, appId, action, time: Date.now(), read: false };
        if (sound) playSound(sound);
        set((s) => ({
          notifications: [n, ...s.notifications].slice(0, 50),
          toasts: toast ? [...s.toasts, n.id] : s.toasts,
        }));
        return n.id;
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t !== id) })),
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      clearNotifications: () => set({ notifications: [], toasts: [] }),
    }),
    {
      name: KEYS.settings,
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          return undefined;
        }
      }),
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => {
        const settings = { ...DEFAULT_SETTINGS, ...(persisted?.settings ?? {}) };
        if (typeof settings.retro !== 'string') settings.retro = 'off'; // older saved boolean
        return { ...current, settings };
      },
    },
  ),
);

// Keep the sound engine in sync with settings.
configureSound(useSystem.getState().settings);
useSystem.subscribe((s, prev) => {
  if (s.settings.sound !== prev.settings.sound || s.settings.volume !== prev.settings.volume) configureSound(s.settings);
});

/** Scale a duration (seconds) by the Animation speed setting. */
export const dur = (seconds) => seconds * useSystem.getState().settings.animationSpeed;
