export const TASKBAR_H = 48;

export const viewport = () => ({ w: window.innerWidth, h: window.innerHeight - TASKBAR_H });

export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** DOMRect -> {x,y,w,h} */
export const fromDomRect = (r) => (r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);

export const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Taskbar buttons register their element here so windows can minimise into
 * (and restore out of) the right icon.
 */
const taskbarButtons = new Map();
export const registerTaskbarButton = (appId, el) => {
  if (el) taskbarButtons.set(appId, el);
  else taskbarButtons.delete(appId);
};
export const taskbarButtonRect = (appId) => {
  const el = taskbarButtons.get(appId);
  if (el) return fromDomRect(el.getBoundingClientRect());
  const vp = viewport();
  return { x: vp.w / 2 - 20, y: vp.h + 4, w: 40, h: 40 }; // fallback: taskbar centre
};
