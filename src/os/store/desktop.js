/**
 * Desktop icons: grid positions (column-major like Windows), selection, and
 * the visitor's own arrangement saved in localStorage.
 */
import { create } from 'zustand';
import { useData } from '@/data/store.js';
import { getApp } from '../apps/registry.js';
import { load, save, KEYS } from '../lib/storage.js';

export const GRID = {
  small: { w: 76, h: 84, icon: 32 },
  medium: { w: 88, h: 100, icon: 44 },
  large: { w: 112, h: 128, icon: 60 },
};
export const GRID_PAD = 8;

/**
 * Everything that can sit on the desktop: apps from content/layout.json plus
 * link shortcuts. Read from the data store so Dev Mode edits show up live.
 */
let cache = { layout: null, items: [] };
export function getDesktopItems(layout = useData.getState().layout) {
  if (cache.layout !== layout) {
    cache = {
      layout,
      items: [
        ...layout.desktopIcons
          .filter((i) => getApp(i.app))
          .map((i) => ({ id: i.app, kind: 'app', title: getApp(i.app).title, appId: i.app, type: 'Application' })),
        ...layout.shortcuts.map((s) => ({ id: s.id, kind: 'shortcut', title: s.name, shortcut: s, type: 'Shortcut' })),
      ],
    };
  }
  return cache.items;
}

const defaultPositions = () => Object.fromEntries(useData.getState().layout.desktopIcons.map((i) => [i.app, { col: i.col, row: i.row }]));

const key = (p) => `${p.col}:${p.row}`;

function firstFree(occupied, rows, from = { col: 0, row: 0 }) {
  for (let i = from.col * rows + from.row; i < 10_000; i++) {
    const cell = { col: Math.floor(i / rows), row: i % rows };
    if (!occupied.has(key(cell))) return cell;
  }
  return from;
}

/**
 * Fit saved positions onto the current grid: keep valid, non-overlapping
 * cells; anything off-screen or colliding moves to the next free cell.
 */
export function resolvePositions(saved, rows, items = getDesktopItems()) {
  // The visitor's own arrangement wins over the published default layout.
  const positions = { ...defaultPositions(), ...saved };
  const out = {};
  const occupied = new Set();
  const pending = [];
  for (const item of items) {
    const p = positions[item.id];
    if (p && p.row < rows && !occupied.has(key(p))) {
      out[item.id] = p;
      occupied.add(key(p));
    } else pending.push(item.id);
  }
  for (const id of pending) {
    const cell = firstFree(occupied, rows);
    out[id] = cell;
    occupied.add(key(cell));
  }
  return out;
}

export const useDesktop = create((set, get) => ({
  positions: load(KEYS.icons, {}), // the visitor's own moves; defaults come from layout.json
  selected: [],
  refreshTick: 0,

  select: (ids) => set({ selected: ids }),
  toggleSelect: (id) => set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] })),
  clearSelection: () => set((s) => (s.selected.length ? { selected: [] } : s)),
  refresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

  /** Move a group of icons by a whole number of cells, avoiding the others. */
  moveIcons: (ids, dCol, dRow, rows, cols) => {
    if (!dCol && !dRow) return;
    const current = resolvePositions(get().positions, rows);
    const moving = new Set(ids);
    const occupied = new Set(getDesktopItems().filter((i) => !moving.has(i.id)).map((i) => key(current[i.id])));
    const next = { ...current };
    for (const id of ids) {
      const p = current[id];
      let target = { col: Math.max(0, Math.min(cols - 1, p.col + dCol)), row: Math.max(0, Math.min(rows - 1, p.row + dRow)) };
      if (occupied.has(key(target))) target = firstFree(occupied, rows, target);
      next[id] = target;
      occupied.add(key(target));
    }
    save(KEYS.icons, next);
    set({ positions: next });
  },

  /** "Sort by" from the context menu: re-flow icons in the given order. */
  sortBy: (field, rows) => {
    const sorted = [...getDesktopItems()].sort((a, b) => (a[field] ?? '').localeCompare(b[field] ?? '') || a.title.localeCompare(b.title));
    const next = Object.fromEntries(sorted.map((item, i) => [item.id, { col: Math.floor(i / rows), row: i % rows }]));
    save(KEYS.icons, next);
    set({ positions: next });
  },

  resetLayout: () => {
    save(KEYS.icons, {});
    set({ positions: {} });
  },
}));
