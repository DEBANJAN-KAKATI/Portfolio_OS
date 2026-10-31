/**
 * "Byte", a small original helper character (not Clippy) that appears once per
 * session with tips. Can be dismissed, or turned off for good.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useData, selectProjects } from '@/data/store.js';
import { useSystem } from '../store/system.js';
import { useWindows } from '../store/windows.js';
import { load, save } from '../lib/storage.js';
import { playSound } from '../lib/sound.js';
import { useMotionPrefs } from '../lib/hooks.js';

const OFF_KEY = 'os.assistantOff';
const DELAY_MS = 25_000;
let shownThisSession = false;

function Byte({ reduced }) {
  return (
    <motion.svg
      viewBox="0 0 64 72"
      width="64"
      height="72"
      animate={reduced ? undefined : { y: [0, -5, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      <line x1="32" y1="4" x2="32" y2="14" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <motion.circle cx="32" cy="5" r="4" fill="#ffd25a" animate={reduced ? undefined : { opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
      <rect x="6" y="14" width="52" height="44" rx="16" fill="var(--accent)" />
      <rect x="12" y="22" width="40" height="26" rx="10" fill="#0b1020" />
      <motion.g animate={reduced ? undefined : { scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.9, 0.95, 1] }} style={{ originY: '35px' }}>
        <circle cx="24" cy="35" r="4.5" fill="#7ee3ff" />
        <circle cx="40" cy="35" r="4.5" fill="#7ee3ff" />
      </motion.g>
      <path d="M26 43 q6 4 12 0" stroke="#7ee3ff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="18" y="58" width="8" height="8" rx="3" fill="var(--accent)" />
      <rect x="38" y="58" width="8" height="8" rx="3" fill="var(--accent)" />
    </motion.svg>
  );
}

export default function Assistant() {
  const tips = useData((s) => s.extras.assistantTips);
  const phase = useSystem((s) => s.phase);
  const { reduced } = useMotionPrefs();
  const [visible, setVisible] = useState(false);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    if (phase !== 'desktop' || shownThisSession || load(OFF_KEY, false) || !tips.length) return;
    const t = setTimeout(() => {
      shownThisSession = true;
      playSound('notify');
      setVisible(true);
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, tips.length]);

  const showBest = () => {
    const best = selectProjects(useData.getState())[0];
    setVisible(false);
    useWindows.getState().open('projects', { props: best ? { projectId: best.id } : {} });
  };

  return (
    <AnimatePresence>
      {visible && phase === 'desktop' && (
        <motion.aside
          aria-label="Assistant"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          className="fixed left-4 z-[44000] flex items-end gap-2"
          style={{ bottom: 'calc(var(--taskbar-h) + 16px)' }}
        >
          <Byte reduced={reduced} />
          <div className="relative mb-10 w-64 rounded-lg border border-[var(--border)] bg-[#fffbe6] p-3 text-[13px] text-black shadow-lg">
            <span className="absolute -left-2 bottom-4 h-4 w-4 rotate-45 border-b border-l border-[var(--border)] bg-[#fffbe6]" aria-hidden="true" />
            <button aria-label="Dismiss assistant" onClick={() => setVisible(false)} className="absolute right-1.5 top-1.5 rounded p-0.5 hover:bg-black/10">
              <X size={13} />
            </button>
            <AnimatePresence mode="wait">
              <motion.p key={tip} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pr-4" role="status">
                {tips[tip]}
              </motion.p>
            </AnimatePresence>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tip === 0 && (
                <button onClick={showBest} className="rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-[var(--accent-text)]">
                  Show me
                </button>
              )}
              {tips.length > 1 && (
                <button onClick={() => setTip((t) => (t + 1) % tips.length)} className="rounded border border-black/20 px-2 py-1 text-xs hover:bg-black/5">
                  Next tip
                </button>
              )}
              <button
                onClick={() => {
                  save(OFF_KEY, true);
                  setVisible(false);
                }}
                className="ml-auto px-1 py-1 text-[11px] text-black/60 hover:underline"
              >
                Don't show again
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
