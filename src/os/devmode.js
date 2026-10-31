/**
 * Dev Mode gate (the only Dev Mode code in the main bundle).
 *
 * Visitors never trigger a request: the session is checked only in a browser
 * that has logged in before (a localStorage hint), or right after
 * `sudo devmode` succeeds. Everything else lives in the lazily loaded
 * src/dev chunk. The UI hint is cosmetic; every write is authorized on the
 * server by the session cookie + CSRF token.
 */
import { create } from 'zustand';
import { load, save, remove } from './lib/storage.js';

const HINT = 'os.devHint';

export const useDev = create((set, get) => ({
  active: false,
  session: null,
  module: null, // the lazily imported src/dev/index.js

  async check({ force = false } = {}) {
    if (!force && !load(HINT, false)) return;
    let s;
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      if (!res.ok) throw new Error();
      s = await res.json();
    } catch {
      return; // no backend (static hosting)
    }
    if (!s.authenticated) {
      remove(HINT);
      if (get().active) get().module?.stop();
      set({ active: false, session: null });
      return;
    }
    const module = get().module ?? (await import('../dev/index.js'));
    save(HINT, true);
    set({ active: true, session: s, module });
    module.start(s);
  },

  async logout() {
    const { module, session } = get();
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': session?.csrf ?? '' } });
    } catch {
      /* cookie expires anyway */
    }
    remove(HINT);
    module?.stop();
    set({ active: false, session: null });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('devmode:login', () => useDev.getState().check({ force: true }));
}

export const useDevActive = () => useDev((s) => s.active);

/**
 * Dev Mode sign-in, used by the lock screen and `sudo devmode`. Only the server
 * checks the password. Resolves to { ok: true } or { ok: false, reason, attemptsLeft? }
 * with reason 'wrong' | 'locked' | 'unavailable'.
 */
export async function devLogin(password) {
  let res;
  try {
    res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ password }) });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if ([404, 405, 503].includes(res.status)) return { ok: false, reason: 'unavailable' };
  if (res.status === 429) return { ok: false, reason: 'locked' };
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: 'wrong', attemptsLeft: body.attemptsLeft };
  }
  window.dispatchEvent(new CustomEvent('devmode:login'));
  return { ok: true };
}

/** Right-click handler for content items; returns true when Dev Mode handled it. */
export function devItemMenu(e, section, item) {
  const { active, module } = useDev.getState();
  if (!active || !module) return false;
  module.openItemMenu(e, section, item);
  return true;
}
