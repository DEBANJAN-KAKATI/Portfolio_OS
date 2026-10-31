/**
 * Fluent context menu with submenus and full keyboard support.
 * Open one from anywhere with useMenu.getState().open(event, items).
 *
 * item: { label, icon?, onSelect?, items? (submenu), checked?, disabled?, shortcut? } | { separator: true }
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { useTransition } from '../lib/hooks.js';
import { playSound } from '../lib/sound.js';

export const useMenu = create((set) => ({
  menu: null,
  open: (e, items) => {
    e.preventDefault?.();
    e.stopPropagation?.();
    playSound('menu');
    const x = e.clientX ?? e.x ?? 0;
    const y = e.clientY ?? e.y ?? 0;
    set({ menu: { x, y, items, key: Date.now() } });
  },
  close: () => set({ menu: null }),
}));

const MENU_W = 240;

function MenuList({ items, onDone, x, y, sub = false, onBack }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y });
  const [active, setActive] = useState(-1);
  const [openSub, setOpenSub] = useState(-1);
  const itemRefs = useRef([]);
  const transition = useTransition();

  // Keep the menu on screen.
  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (nx + r.width > window.innerWidth - 4) nx = sub ? x - r.width - MENU_W + 8 : window.innerWidth - r.width - 4;
    if (ny + r.height > window.innerHeight - 4) ny = Math.max(4, window.innerHeight - r.height - 4);
    setPos({ x: Math.max(4, nx), y: ny });
  }, [x, y, sub]);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const enabled = items.map((it, i) => (!it.separator && !it.disabled ? i : -1)).filter((i) => i >= 0);
  const move = (dir) => {
    const idx = enabled.indexOf(active);
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    setActive(next);
    itemRefs.current[next]?.focus();
  };

  const choose = (item, i) => {
    if (item.disabled) return;
    if (item.items) {
      setOpenSub(i);
      return;
    }
    playSound('click');
    onDone();
    item.onSelect?.();
  };

  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'ArrowRight' && items[active]?.items) setOpenSub(active);
    else if (e.key === 'ArrowLeft' && sub) onBack();
    else if (e.key === 'Escape') (sub ? onBack : onDone)();
    else if ((e.key === 'Enter' || e.key === ' ') && active >= 0) choose(items[active], active);
    else return;
    e.preventDefault();
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={transition(0.14)}
      className="acrylic fixed rounded-lg border border-[var(--border)] p-1 text-[13px] outline-none"
      style={{ left: pos.x, top: pos.y, width: MENU_W, zIndex: 100_000, boxShadow: 'var(--shadow-flyout)', transformOrigin: 'top left' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} role="separator" className="mx-1 my-1 h-px bg-[var(--border)]" />
        ) : (
          <div key={i} className="relative" onMouseEnter={() => { setActive(i); setOpenSub(item.items ? i : -1); }}>
            <button
              ref={(el) => (itemRefs.current[i] = el)}
              role={item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={item.checked}
              aria-haspopup={item.items ? 'menu' : undefined}
              aria-expanded={item.items ? openSub === i : undefined}
              disabled={item.disabled}
              onClick={() => choose(item, i)}
              className={`flex h-8 w-full items-center gap-3 rounded px-2 text-left outline-none disabled:opacity-40 ${active === i ? 'bg-[var(--surface-hover)]' : ''}`}
            >
              <span className="flex w-4 justify-center text-[var(--text-dim)]">
                {item.checked ? <Check size={14} /> : item.icon ? <item.icon size={15} /> : null}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.shortcut && <span className="text-xs text-[var(--text-dim)]">{item.shortcut}</span>}
              {item.items && <ChevronRight size={14} className="text-[var(--text-dim)]" />}
            </button>
            {/* Portal: the parent's scale animation would otherwise offset a fixed child. */}
            {item.items &&
              openSub === i &&
              createPortal(
                <MenuList
                  items={item.items}
                  onDone={onDone}
                  sub
                  x={pos.x + MENU_W - 4}
                  y={(itemRefs.current[i]?.getBoundingClientRect().top ?? pos.y) - 4}
                  onBack={() => {
                    setOpenSub(-1);
                    itemRefs.current[i]?.focus();
                  }}
                />,
                document.body,
              )}
          </div>
        ),
      )}
    </motion.div>
  );
}

export default function ContextMenuHost() {
  const menu = useMenu((s) => s.menu);
  const close = useMenu((s) => s.close);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e) => {
      if (!e.target.closest?.('[role="menu"]')) close();
    };
    const onBlur = () => close();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
    };
  }, [menu, close]);

  return <AnimatePresence>{menu && <MenuList key={menu.key} items={menu.items} x={menu.x} y={menu.y} onDone={close} />}</AnimatePresence>;
}
