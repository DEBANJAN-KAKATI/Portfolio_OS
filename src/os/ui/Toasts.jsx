import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';
import { useSystem } from '../store/system.js';
import { useWindows } from '../store/windows.js';
import { useTransition } from '../lib/hooks.js';
import AppIcon from './AppIcon.jsx';
import Monogram from './Monogram.jsx';

const LIFETIME = 6000;

function Toast({ n }) {
  const dismiss = useSystem((s) => s.dismissToast);
  const transition = useTransition();
  useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), LIFETIME);
    return () => clearTimeout(t);
  }, [n.id, dismiss]);
  const act = () => {
    dismiss(n.id);
    if (n.action?.appId) useWindows.getState().open(n.action.appId, { props: n.action.props ?? {} });
  };
  return (
    <motion.div
      layout
      role="status"
      initial={{ opacity: 0, x: 120 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 120 }}
      transition={transition(0.25)}
      className="acrylic pointer-events-auto flex w-[360px] max-w-[calc(100vw-24px)] cursor-default gap-3 rounded-lg border border-[var(--border)] p-4"
      style={{ boxShadow: 'var(--shadow-flyout)' }}
      onClick={act}
    >
      {n.appId ? <AppIcon appId={n.appId} size={24} /> : <Monogram size={24} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{n.title}</p>
        {n.body && <p className="mt-0.5 text-xs text-[var(--text-dim)]">{n.body}</p>}
      </div>
      <button
        aria-label="Dismiss notification"
        className="self-start rounded p-1 hover:bg-[var(--surface-hover)]"
        onClick={(e) => {
          e.stopPropagation();
          dismiss(n.id);
        }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

/** Toasts slide in from the bottom-right, above the taskbar. */
export default function Toasts() {
  const toasts = useSystem(useShallow((s) => s.toasts.map((id) => s.notifications.find((n) => n.id === id)).filter(Boolean)));
  return (
    <div className="pointer-events-none fixed right-3 z-[60000] flex flex-col items-end gap-2" style={{ bottom: 'calc(var(--taskbar-h) + 12px)' }} aria-live="polite">
      <AnimatePresence>
        {toasts.slice(-3).map((n) => (
          <Toast key={n.id} n={n} />
        ))}
      </AnimatePresence>
    </div>
  );
}
