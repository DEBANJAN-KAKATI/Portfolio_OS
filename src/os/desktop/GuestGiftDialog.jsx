/** What visitors get when they drop files on the desktop: a UAC-style joke. */
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { playSound } from '../lib/sound.js';
import { useTransition } from '../lib/hooks.js';

export default function GuestGiftDialog({ open, onClose }) {
  const transition = useTransition();
  useEffect(() => {
    if (open) playSound('error');
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70000] flex items-center justify-center bg-black/45"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition(0.15)}
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        >
          <motion.div
            role="alertdialog"
            aria-label="User Account Control"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={transition(0.2)}
            className="w-[420px] max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-solid)]"
            style={{ boxShadow: 'var(--shadow-window)' }}
          >
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: '#0b5cad', color: '#fff' }}>
              <ShieldAlert size={28} />
              <div>
                <p className="text-xs opacity-80">User Account Control</p>
                <p className="text-sm font-semibold">You need administrator permission to give this PC gifts</p>
              </div>
            </div>
            <p className="px-5 py-4 text-[13px] text-[var(--text-dim)]">Thanks for the thought! Visitors can look around, but only the owner can add files. Want to say hi instead? Open Mail.</p>
            <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-alt)] px-5 py-3">
              <button autoFocus onClick={onClose} className="rounded-md px-4 py-1.5 text-[13px] font-medium" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
