// localStorage that never throws (private mode, blocked storage, quota).
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  booted: 'os.booted',
  settings: 'os.settings',
  icons: 'os.desktopIcons',
  iconsBase: 'os.desktopIconsBase', // fingerprint of the default layout the saved icons were moved from
  lastVisit: 'os.lastVisit',
};
