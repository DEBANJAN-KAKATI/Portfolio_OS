import { AnimatePresence, motion } from 'framer-motion';
import { useSystem } from '../store/system.js';
import { useWindows } from '../store/windows.js';
import { useTransition } from '../lib/hooks.js';
import AppIcon from '../ui/AppIcon.jsx';

/** Alt+` overlay. useSystem.switcher holds the highlighted index (or false when hidden). */
export default function WindowSwitcher() {
  const index = useSystem((s) => s.switcher);
  const windows = useWindows((s) => s.windows);
  const transition = useTransition();
  const ordered = [...windows].sort((a, b) => b.z - a.z);
  const active = ordered.length ? ((index % ordered.length) + ordered.length) % ordered.length : -1;

  return (
    <AnimatePresence>
      {index !== false && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition(0.12)}
          className="fixed inset-0 z-[80000] flex items-center justify-center bg-black/20"
          role="listbox"
          aria-label="Switch windows"
        >
          <div className="acrylic flex max-w-[90vw] flex-wrap justify-center gap-2 rounded-xl border border-[var(--border)] p-3" style={{ boxShadow: 'var(--shadow-window)' }}>
            {ordered.length === 0 && <p className="px-8 py-6 text-sm text-[var(--text-dim)]">No open windows</p>}
            {ordered.map((w, i) => (
              <button
                key={w.id}
                role="option"
                aria-selected={i === active}
                onClick={() => {
                  useWindows.getState().focus(w.id);
                  useSystem.getState().setSwitcher(false);
                }}
                className="flex w-40 flex-col items-center gap-2 rounded-lg border-2 p-3"
                style={{ borderColor: i === active ? 'var(--accent)' : 'transparent', background: i === active ? 'var(--surface-hover)' : undefined }}
              >
                <AppIcon appId={w.appId} size={48} />
                <span className="w-full truncate text-center text-xs">{w.title}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
