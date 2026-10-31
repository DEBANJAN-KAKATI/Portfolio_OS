/** Recycle Bin: abandoned ideas and squashed bugs. Emptying it crumples them into paper balls. */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, Bug, Trash2, RotateCcw } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useMotionPrefs } from '@/os/lib/hooks.js';
import { playSound } from '@/os/lib/sound.js';
import Dialog from './kit/Dialog.jsx';
import { Button, EmptyState } from './kit/ui.jsx';

const ROW = 'grid grid-cols-1 sm:grid-cols-[1fr_160px] md:grid-cols-[1fr_160px_160px]';

const TYPES = { idea: { label: 'Abandoned idea', icon: Lightbulb, color: '#f59e0b' }, bug: { label: 'Squashed bug', icon: Bug, color: '#ef4444' } };

export default function RecycleBin() {
  const items = useData((s) => s.extras.recycleBin);
  const { reduced } = useMotionPrefs();
  const [state, setState] = useState('full'); // 'full' | 'crumpling' | 'empty'
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState(null);

  const empty = () => {
    setConfirm(false);
    setSelected(null);
    playSound('crumple');
    setState('crumpling');
    setTimeout(() => setState('empty'), reduced ? 0 : 1100 + items.length * 90);
  };

  const sel = items.find((i) => i.id === selected);
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <Button icon={Trash2} onClick={() => setConfirm(true)} disabled={state !== 'full' || !items.length}>Empty Recycle Bin</Button>
        <Button icon={RotateCcw} variant="ghost" onClick={() => setState('full')} disabled={state !== 'empty'}>Restore all items</Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {state === 'empty' || !items.length ? (
          <EmptyState icon={Trash2} title="Recycle Bin is empty">Every bad idea has been responsibly recycled into a better one.</EmptyState>
        ) : (
          <div role="table" className="relative text-[13px]">
            <div role="row" className={`${ROW} text-xs text-[var(--text-dim)]`}>
              <span role="columnheader" className="px-3 py-2">Name</span>
              <span role="columnheader" className="hidden px-3 py-2 sm:block">Item type</span>
              <span role="columnheader" className="hidden px-3 py-2 md:block">Original location</span>
            </div>
            <div role="rowgroup">
              <AnimatePresence>
                {items.map((it, i) => {
                  const T = TYPES[it.kind];
                  const crumpling = state === 'crumpling';
                  return (
                    <motion.div
                      role="row"
                      key={it.id}
                      tabIndex={0}
                      onClick={() => setSelected(it.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelected(it.id)}
                      animate={crumpling && !reduced ? { opacity: 0, scaleY: 0.4 } : { opacity: 1, scaleY: 1 }}
                      transition={{ duration: 0.25, delay: crumpling ? i * 0.09 : 0 }}
                      className={`${ROW} cursor-default border-t border-[var(--border)] hover:bg-[var(--surface-hover)] ${selected === it.id ? 'bg-[var(--surface-hover)]' : ''}`}
                      style={{ transformOrigin: 'center' }}
                    >
                      <span role="cell" className="flex min-w-0 items-center gap-2 px-3 py-2">
                        <T.icon size={15} style={{ color: T.color }} className="shrink-0" />
                        <span className="truncate">{it.name}</span>
                      </span>
                      <span role="cell" className="hidden px-3 py-2 text-[var(--text-dim)] sm:block">{T.label}</span>
                      <span role="cell" className="hidden px-3 py-2 text-[var(--text-dim)] md:block">C:\Brain\{it.kind === 'idea' ? 'Ideas' : 'Bugs'}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {/* Each row balls up into crumpled paper and drops into the bin. */}
            {state === 'crumpling' &&
              !reduced &&
              items.map((it, i) => (
                <motion.span
                  key={`ball-${it.id}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/3 h-8 w-8 rounded-full"
                  style={{
                    top: 36 + i * 37,
                    background:
                      'conic-gradient(from 30deg, rgb(0 0 0 / 0.12), transparent 20%, rgb(0 0 0 / 0.1) 35%, transparent 55%, rgb(0 0 0 / 0.12) 75%, transparent), radial-gradient(circle at 35% 30%, #fffdf5, #d8d0b8)',
                    boxShadow: 'inset -3px -4px 6px rgb(0 0 0 / 0.25), 0 2px 4px rgb(0 0 0 / 0.3)',
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.15, 1, 0.9], opacity: [0, 1, 1, 0], rotate: [0, 120, 300, 560], x: [0, 0, 60, 140 + i * 25], y: [0, -6, -24, 380] }}
                  transition={{ duration: 1.1, delay: 0.1 + i * 0.09, times: [0, 0.25, 0.5, 1], ease: 'easeIn' }}
                />
              ))}
          </div>
        )}
      </div>

      {sel && state === 'full' && (
        <div className="flex gap-3 border-t border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-[13px]">
          {(() => {
            const T = TYPES[sel.kind];
            return <T.icon size={28} style={{ color: T.color }} className="shrink-0" />;
          })()}
          <div>
            <p className="font-semibold">{sel.name}</p>
            <p className="selectable text-[var(--text-dim)]">{sel.note}</p>
          </div>
        </div>
      )}
      <footer className="border-t border-[var(--border)] px-3 py-1 text-xs text-[var(--text-dim)]">{state === 'empty' ? '0 items' : `${items.length} items`}</footer>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete multiple items"
        footer={
          <>
            <Button variant="primary" onClick={empty}>Yes</Button>
            <Button onClick={() => setConfirm(false)}>No</Button>
          </>
        }
      >
        <p className="text-[13px]">Are you sure you want to permanently delete these {items.length} items? They were bad ideas anyway.</p>
      </Dialog>
    </div>
  );
}
