import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, ArrowUpDown, RefreshCw, Plus, ImagePlay, Monitor, Palette, RotateCcw, ExternalLink, Copy } from 'lucide-react';
import { useDesktop, getDesktopItems, resolvePositions, GRID, GRID_PAD } from '../store/desktop.js';
import { useDev } from '../devmode.js';
import GuestGiftDialog from './GuestGiftDialog.jsx';
import { useSystem } from '../store/system.js';
import { useWindows } from '../store/windows.js';
import { useData } from '@/data/store.js';
import { useMenu } from '../ui/ContextMenu.jsx';
import { useViewport, useMotionPrefs } from '../lib/hooks.js';
import { useWallpaper } from '../lib/wallpaper.js';
import { fromDomRect, intersects } from '../lib/geometry.js';
import AppIcon from '../ui/AppIcon.jsx';

function Wallpaper() {
  const wp = useWallpaper();
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={wp.id}
        className="os-wallpaper absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${wp.src}")` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2 }}
        aria-hidden="true"
      />
    </AnimatePresence>
  );
}

export function openItem(item, originEl) {
  if (item.kind === 'shortcut') {
    window.open(item.shortcut.url, '_blank', 'noopener,noreferrer');
    return;
  }
  useWindows.getState().open(item.appId, { origin: originEl ? fromDomRect(originEl.getBoundingClientRect()) : null });
}

function DesktopIcon({ item, pos, cell, selected, dragOffset, bounceIndex, refreshTick, onPointerDown, onOpen, onContextMenu }) {
  const { reduced } = useMotionPrefs();
  const ref = useRef(null);
  return (
    <motion.button
      ref={ref}
      data-icon={item.id}
      aria-label={item.title}
      aria-pressed={selected}
      onPointerDown={(e) => onPointerDown(e, item)}
      onDoubleClick={() => onOpen(item, ref.current)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(item, ref.current)}
      onContextMenu={(e) => onContextMenu(e, item, ref.current)}
      // Refresh makes every icon do a small hop.
      animate={refreshTick && !reduced ? { y: [0, -10, 0] } : { y: 0 }}
      transition={{ duration: 0.35, delay: bounceIndex * 0.015 }}
      key={refreshTick}
      className={`group absolute flex flex-col items-center gap-1 rounded-md border px-1 pt-2 text-center outline-none focus-visible:outline-offset-[-2px] ${
        selected ? 'border-white/40 bg-white/25' : 'border-transparent hover:bg-white/10'
      }`}
      style={{
        left: GRID_PAD + pos.col * cell.w + (dragOffset?.x ?? 0),
        top: GRID_PAD + pos.row * cell.h + (dragOffset?.y ?? 0),
        width: cell.w - 4,
        height: cell.h - 4,
        zIndex: dragOffset ? 5 : 1,
        opacity: dragOffset ? 0.8 : 1,
      }}
    >
      <AppIcon appId={item.appId} shortcut={item.shortcut} size={cell.icon} className="pointer-events-none drop-shadow-md" />
      <span
        className={`pointer-events-none line-clamp-2 text-xs leading-tight text-white ${selected ? '' : 'line-clamp-2'}`}
        style={{ textShadow: '0 1px 2px rgb(0 0 0 / 0.85), 0 0 6px rgb(0 0 0 / 0.5)' }}
      >
        {item.title}
      </span>
    </motion.button>
  );
}

export default function Desktop() {
  const vp = useViewport();
  const iconSize = useSystem((s) => s.settings.iconSize);
  const updateSettings = useSystem((s) => s.updateSettings);
  const wallpapers = useData((s) => s.media.wallpapers);
  const wallpaperChoice = useSystem((s) => s.settings.wallpaper);
  const { positions, selected, refreshTick, select, toggleSelect, clearSelection, moveIcons, sortBy, refresh, resetLayout } = useDesktop();
  const openMenu = useMenu((s) => s.open);
  const open = useWindows((s) => s.open);
  const [marquee, setMarquee] = useState(null);
  const [drag, setDrag] = useState(null); // { ids, x, y }
  const [guestGift, setGuestGift] = useState(false);
  const surfaceRef = useRef(null);
  const dev = useDev((s) => (s.active ? s.module : null));
  const layout = useData((s) => s.layout);
  const desktopItems = getDesktopItems(layout);

  const cell = GRID[iconSize] ?? GRID.medium;
  const rows = Math.max(1, Math.floor((vp.h - GRID_PAD * 2) / cell.h));
  const cols = Math.max(1, Math.floor((vp.w - GRID_PAD * 2) / cell.w));
  const resolved = useMemo(() => resolvePositions(positions, rows, desktopItems), [positions, rows, desktopItems]);

  const iconRect = (id) => ({ x: GRID_PAD + resolved[id].col * cell.w, y: GRID_PAD + resolved[id].row * cell.h, w: cell.w - 4, h: cell.h - 4 });

  // ---- Rubber-band selection on empty desktop ----
  const onSurfacePointerDown = (e) => {
    if (e.button !== 0 || e.target !== surfaceRef.current) return;
    const base = e.ctrlKey ? selected : [];
    if (!e.ctrlKey) clearSelection();
    const start = { x: e.clientX, y: e.clientY };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = { x: Math.min(start.x, ev.clientX), y: Math.min(start.y, ev.clientY), w: Math.abs(ev.clientX - start.x), h: Math.abs(ev.clientY - start.y) };
      setMarquee(r);
      const hit = desktopItems.filter((i) => intersects(r, iconRect(i.id))).map((i) => i.id);
      select([...new Set([...base, ...hit])]);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      setMarquee(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  // ---- Icon click / drag (snaps to the grid on drop) ----
  const onIconPointerDown = (e, item) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    let ids = selected;
    if (e.ctrlKey) {
      toggleSelect(item.id);
      return;
    }
    if (!selected.includes(item.id)) {
      ids = [item.id];
      select(ids);
    }
    const start = { x: e.clientX, y: e.clientY };
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let dragging = false;
    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 5) return;
      dragging = true;
      setDrag({ ids, x: dx, y: dy });
    };
    const up = (ev) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      if (dragging) {
        const dCol = Math.round((ev.clientX - start.x) / cell.w);
        const dRow = Math.round((ev.clientY - start.y) / cell.h);
        // Dev Mode: shortcuts dropped onto the Recycle Bin are deleted.
        const bin = resolved.recycle;
        const p = resolved[item.id];
        if (dev && bin && p && p.col + dCol === bin.col && p.row + dRow === bin.row && ids.every((id) => desktopItems.find((i) => i.id === id)?.kind === 'shortcut')) {
          dev.deleteShortcuts(ids);
        } else moveIcons(ids, dCol, dRow, rows, cols);
      }
      setDrag(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const onIconContextMenu = (e, item, el) => {
    if (!selected.includes(item.id)) select([item.id]);
    const items = [
      { label: 'Open', icon: ExternalLink, onSelect: () => openItem(item, el) },
      ...(item.kind === 'shortcut'
        ? [{ label: 'Copy link', icon: Copy, onSelect: () => navigator.clipboard?.writeText(item.shortcut.url) }]
        : []),
    ];
    openMenu(e, dev ? dev.iconMenu(items, item) : items);
  };

  const onDesktopContextMenu = (e) => {
    if (e.target !== surfaceRef.current) return;
    clearSelection();
    const items = [
      {
        label: 'View',
        icon: LayoutGrid,
        items: [
          ...['large', 'medium', 'small'].map((s) => ({ label: `${s[0].toUpperCase()}${s.slice(1)} icons`, checked: iconSize === s, onSelect: () => updateSettings({ iconSize: s }) })),
          { separator: true },
          { label: 'Reset icon layout', icon: RotateCcw, onSelect: resetLayout },
        ],
      },
      {
        label: 'Sort by',
        icon: ArrowUpDown,
        items: [
          { label: 'Name', onSelect: () => sortBy('title', rows) },
          { label: 'Item type', onSelect: () => sortBy('type', rows) },
        ],
      },
      { label: 'Refresh', icon: RefreshCw, onSelect: refresh },
      { separator: true },
      {
        label: 'New',
        icon: Plus,
        items: [{ label: 'Message to me', icon: Plus, onSelect: () => open('mail', { origin: { x: e.clientX, y: e.clientY, w: 0, h: 0 }, props: { compose: 'hello' } }) }],
      },
      { separator: true },
      {
        label: 'Change wallpaper',
        icon: ImagePlay,
        items: [
          { label: 'Automatic (time of day)', checked: wallpaperChoice === 'auto', onSelect: () => updateSettings({ wallpaper: 'auto' }) },
          { separator: true },
          ...wallpapers.map((w) => ({ label: w.name, checked: wallpaperChoice === w.id, onSelect: () => updateSettings({ wallpaper: w.id }) })),
        ],
      },
      { label: 'Display settings', icon: Monitor, onSelect: () => open('settings', { props: { page: 'display' } }) },
      { label: 'Personalize', icon: Palette, onSelect: () => open('settings', { props: { page: 'personalization' } }) },
    ];
    // Dev Mode replaces "New" with real content types and adds layout tools.
    openMenu(e, dev ? dev.desktopMenu(items, { positions: resolved, items: desktopItems, at: { x: e.clientX, y: e.clientY } }) : items);
  };

  // ---- Files dropped on the desktop ----
  const onDragOver = (e) => {
    if (![...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/uri-list')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (e) => {
    if (![...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/uri-list')) return;
    e.preventDefault();
    if (dev) dev.handleDrop(e.dataTransfer, { target: 'desktop' });
    else setGuestGift(true);
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ bottom: 'var(--taskbar-h)' }} onDragOver={onDragOver} onDrop={onDrop}>
      <GuestGiftDialog open={guestGift} onClose={() => setGuestGift(false)} />
      <Wallpaper />
      <div
        ref={surfaceRef}
        role="application"
        aria-label="Desktop"
        className="absolute inset-0"
        onPointerDown={onSurfacePointerDown}
        onContextMenu={onDesktopContextMenu}
        onKeyDown={(e) => {
          if (e.key === 'a' && e.ctrlKey) {
            e.preventDefault();
            select(desktopItems.map((i) => i.id));
          }
        }}
      >
        {desktopItems.map((item, i) => (
          <DesktopIcon
            key={item.id}
            item={item}
            pos={resolved[item.id]}
            cell={cell}
            selected={selected.includes(item.id)}
            dragOffset={drag?.ids.includes(item.id) ? drag : null}
            bounceIndex={i}
            refreshTick={refreshTick}
            onPointerDown={onIconPointerDown}
            onOpen={openItem}
            onContextMenu={onIconContextMenu}
          />
        ))}
        {marquee && (
          <div
            className="pointer-events-none absolute border"
            style={{
              left: marquee.x,
              top: marquee.y,
              width: marquee.w,
              height: marquee.h,
              borderColor: 'var(--accent)',
              background: 'color-mix(in srgb, var(--accent) 25%, transparent)',
            }}
          />
        )}
      </div>
    </div>
  );
}
