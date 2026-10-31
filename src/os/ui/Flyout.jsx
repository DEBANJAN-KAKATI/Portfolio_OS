import { useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSystem } from '../store/system.js';
import { useOutsideClick, useTransition } from '../lib/hooks.js';

/**
 * A panel that slides up from the taskbar. Only the panel named in
 * useSystem.panel is open; clicking outside closes it (its own toggle button,
 * marked data-toggle="<name>", is ignored so it can close it instead).
 */
export default function Flyout({ name, className = '', style, from = 'bottom', children, label }) {
  const open = useSystem((s) => s.panel === name);
  const closePanels = useSystem((s) => s.closePanels);
  const ref = useRef(null);
  const transition = useTransition();
  const onOutside = useCallback(
    (e) => {
      if (e.target.closest?.(`[data-toggle="${name}"]`) || e.target.closest?.('[role="menu"]')) return;
      closePanels();
    },
    [name, closePanels],
  );
  useOutsideClick(ref, onOutside, open);

  const offset = from === 'left' ? { x: -40, y: 0 } : { x: 0, y: 40 };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label={label ?? name}
          initial={{ opacity: 0, ...offset }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, ...offset, transition: transition(0.12) }}
          transition={transition(0.24)}
          onKeyDown={(e) => e.key === 'Escape' && closePanels()}
          className={`acrylic fixed z-[50000] overflow-hidden rounded-lg border border-[var(--border)] text-[var(--text)] ${className}`}
          style={{ boxShadow: 'var(--shadow-flyout)', ...style }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
