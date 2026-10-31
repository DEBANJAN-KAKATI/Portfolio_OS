import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTransition } from '@/os/lib/hooks.js';
import { playSound } from '@/os/lib/sound.js';

/** Dialog that lives inside an app window (dims only that window). */
export default function Dialog({ open, onClose, title, children, footer, width = 420 }) {
  const ref = useRef(null);
  const transition = useTransition();
  useEffect(() => {
    if (!open) return;
    playSound('menu');
    const prev = document.activeElement;
    ref.current?.querySelector('button, [href], input, textarea, [tabindex]')?.focus();
    return () => prev?.focus?.();
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition(0.15)}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onClose();
            }
          }}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={transition(0.22)}
            className="flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-solid)]"
            style={{ maxWidth: width, boxShadow: 'var(--shadow-window)' }}
          >
            <div className="flex items-center justify-between gap-2 px-5 pt-4">
              <h2 className="text-base font-semibold">{title}</h2>
              <button aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-[var(--surface-hover)]">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-3">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-alt)] px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
