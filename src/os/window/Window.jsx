import { Component, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Square, Copy, X } from 'lucide-react';
import { getApp } from '../apps/registry.js';
import { useWindows, displayRect } from '../store/windows.js';
import { clamp, taskbarButtonRect, centerOf } from '../lib/geometry.js';
import { useViewport, useTransition } from '../lib/hooks.js';
import AppIcon from '../ui/AppIcon.jsx';
import Spinner from '../ui/Spinner.jsx';

const SNAP_EDGE = 8;
const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const RESIZE_CLASS = {
  n: 'top-0 left-2 right-2 h-1.5 cursor-ns-resize',
  s: 'bottom-0 left-2 right-2 h-1.5 cursor-ns-resize',
  e: 'right-0 top-2 bottom-2 w-1.5 cursor-ew-resize',
  w: 'left-0 top-2 bottom-2 w-1.5 cursor-ew-resize',
  ne: 'right-0 top-0 h-3 w-3 cursor-nesw-resize',
  sw: 'left-0 bottom-0 h-3 w-3 cursor-nesw-resize',
  nw: 'left-0 top-0 h-3 w-3 cursor-nwse-resize',
  se: 'right-0 bottom-0 h-3 w-3 cursor-nwse-resize',
};

class AppErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error.message ?? this.state.error);
    // The page outlived its code: a new deploy, or the dev server was stopped.
    const stale = /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold">{stale ? "This app couldn't load" : 'This app stopped working'}</p>
        <p className="selectable max-w-md text-xs text-[var(--text-dim)]">
          {stale ? 'The site was updated or the server is offline. Reload the page to get the latest version.' : message}
        </p>
        {stale && (
          <button onClick={() => location.reload()} className="mt-2 rounded-md px-3 py-1.5 text-[13px]" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
            Reload
          </button>
        )}
      </div>
    );
  }
}

/** Follow the pointer until release; works for mouse, pen and touch. */
function trackPointer(e, onMove, onEnd) {
  const el = e.currentTarget;
  el.setPointerCapture?.(e.pointerId);
  const move = (ev) => onMove(ev);
  const end = (ev) => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', end);
    el.removeEventListener('pointercancel', end);
    onEnd(ev);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

export default function Window({ win }) {
  const app = getApp(win.appId);
  const focused = useWindows((s) => s.focusedId === win.id);
  const { focus, close, minimize, toggleMaximize, setRect, setMode, setSnapPreview } = useWindows.getState();
  const vp = useViewport();
  const transition = useTransition();
  const [live, setLive] = useState(null); // rect while dragging/resizing

  const shown = live ?? displayRect(win, vp);
  const geometry = { left: shown.x, top: shown.y, width: shown.w, height: shown.h };
  const center = centerOf(shown);

  // Minimised windows shrink into their taskbar button; restoring reverses it.
  let animate = { ...geometry, x: 0, y: 0, scale: 1, opacity: 1 };
  if (win.minimized) {
    const target = centerOf(taskbarButtonRect(win.appId));
    animate = { ...geometry, x: target.x - center.x, y: target.y - center.y, scale: 0.1, opacity: 0 };
  }

  // Opening springs out of whatever launched the window (framer only reads `initial` on mount).
  const o = win.origin ? centerOf(win.origin) : null;
  const initial = o ? { ...geometry, x: o.x - center.x, y: o.y - center.y, scale: 0.2, opacity: 0 } : { ...geometry, scale: 0.94, opacity: 0 };

  const startDrag = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const start = { px: e.clientX, py: e.clientY, rect: displayRect(win, vp) };
    let current = null;
    trackPointer(
      e,
      (ev) => {
        const dx = ev.clientX - start.px;
        const dy = ev.clientY - start.py;
        if (!current && Math.hypot(dx, dy) < 4) return;
        if (!current && win.mode !== 'normal') {
          // Dragging a maximised/snapped window restores its size under the cursor.
          const rel = (start.px - start.rect.x) / start.rect.w;
          start.rect = { x: start.px - rel * win.rect.w, y: start.rect.y, w: win.rect.w, h: win.rect.h };
        }
        current = { ...start.rect, x: start.rect.x + dx, y: clamp(start.rect.y + dy, 0, vp.h - 32) };
        setLive(current);
        const zone =
          ev.clientY <= SNAP_EDGE ? 'maximized' : ev.clientX <= SNAP_EDGE ? 'left' : ev.clientX >= window.innerWidth - SNAP_EDGE ? 'right' : null;
        setSnapPreview(zone);
      },
      () => {
        const zone = useWindows.getState().snapPreview;
        setSnapPreview(null);
        if (current) {
          setRect(win.id, { ...current, y: Math.max(0, current.y) });
          if (zone) setMode(win.id, zone);
        }
        setLive(null);
      },
    );
  };

  const startResize = (dir) => (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    focus(win.id);
    const start = { px: e.clientX, py: e.clientY, rect: displayRect(win, vp) };
    const min = app.minSize;
    let current = null;
    trackPointer(
      e,
      (ev) => {
        const dx = ev.clientX - start.px;
        const dy = ev.clientY - start.py;
        const r = { ...start.rect };
        if (dir.includes('e')) r.w = clamp(start.rect.w + dx, min.w, vp.w - r.x);
        if (dir.includes('s')) r.h = clamp(start.rect.h + dy, min.h, vp.h - r.y);
        if (dir.includes('w')) {
          r.w = clamp(start.rect.w - dx, min.w, start.rect.x + start.rect.w);
          r.x = start.rect.x + start.rect.w - r.w;
        }
        if (dir.includes('n')) {
          r.h = clamp(start.rect.h - dy, min.h, start.rect.y + start.rect.h);
          r.y = start.rect.y + start.rect.h - r.h;
        }
        current = r;
        setLive(r);
      },
      () => {
        if (current) setRect(win.id, current);
        setLive(null);
      },
    );
  };

  const AppComponent = app.component;
  const isMax = win.mode === 'maximized';
  const square = win.mode !== 'normal' && !live;

  return (
    <motion.section
      role="dialog"
      aria-label={win.title}
      aria-hidden={win.minimized || undefined}
      initial={initial}
      animate={animate}
      exit={{ scale: 0.94, opacity: 0, transition: transition(0.14) }}
      transition={live ? { duration: 0 } : transition(0.26)}
      onPointerDownCapture={() => !win.minimized && focus(win.id)}
      className="os-window mica absolute flex flex-col overflow-hidden border border-[var(--border)]"
      data-focused={focused || undefined}
      style={{
        zIndex: win.z,
        borderRadius: square ? 0 : 8,
        boxShadow: focused ? 'var(--shadow-window)' : 'var(--shadow-flyout)',
        pointerEvents: win.minimized ? 'none' : 'auto',
      }}
    >
      <header
        onPointerDown={startDrag}
        onDoubleClick={(e) => !e.target.closest('button') && toggleMaximize(win.id)}
        className="os-titlebar flex h-8 shrink-0 items-center gap-2 pl-3 transition-opacity"
        style={{ opacity: focused ? 1 : 'var(--titlebar-inactive)' }}
      >
        <AppIcon appId={win.appId} size={16} />
        <h2 className="min-w-0 flex-1 truncate text-xs">{win.title}</h2>
        <div className="os-captions flex h-full">
          <button aria-label="Minimize" onClick={() => minimize(win.id)} className="flex h-full w-[46px] items-center justify-center hover:bg-[var(--surface-hover)] active:bg-[var(--surface-press)]">
            <Minus size={16} strokeWidth={1.25} />
          </button>
          <button aria-label={isMax ? 'Restore' : 'Maximize'} onClick={() => toggleMaximize(win.id)} className="flex h-full w-[46px] items-center justify-center hover:bg-[var(--surface-hover)] active:bg-[var(--surface-press)]">
            {isMax ? <Copy size={13} strokeWidth={1.25} className="-scale-x-100" /> : <Square size={12} strokeWidth={1.25} />}
          </button>
          <button aria-label="Close" onClick={() => close(win.id)} className="os-close flex h-full w-[46px] items-center justify-center hover:bg-[#c42b1c] hover:text-white active:bg-[#c42b1c]/80">
            <X size={16} strokeWidth={1.25} />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-auto bg-[var(--surface-alt)]">
        <AppErrorBoundary>
          <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner /></div>}>
            <AppComponent app={app} windowId={win.id} {...win.props} />
          </Suspense>
        </AppErrorBoundary>
        {/* Keep iframes/canvases from swallowing pointer events mid-drag. */}
        {live && <div className="absolute inset-0" />}
      </div>

      {!isMax && RESIZE_DIRS.map((d) => <div key={d} onPointerDown={startResize(d)} className={`absolute z-10 ${RESIZE_CLASS[d]}`} />)}
    </motion.section>
  );
}
