import { AnimatePresence, motion } from 'framer-motion';
import { useWindows, displayRect } from '../store/windows.js';
import { useViewport, useTransition } from '../lib/hooks.js';
import Window from './Window.jsx';

/** Translucent outline showing where a dragged window will snap. */
function SnapPreview() {
  const zone = useWindows((s) => s.snapPreview);
  const vp = useViewport();
  const transition = useTransition();
  const r = zone ? displayRect({ mode: zone }, vp) : null;
  return (
    <AnimatePresence>
      {r && (
        <motion.div
          key="snap"
          initial={{ opacity: 0, left: r.x + r.w / 2, top: r.y + r.h / 2, width: 0, height: 0 }}
          animate={{ opacity: 1, left: r.x + 8, top: r.y + 8, width: r.w - 16, height: r.h - 16 }}
          exit={{ opacity: 0 }}
          transition={transition(0.18)}
          className="pointer-events-none absolute rounded-lg border border-white/40 backdrop-blur-md"
          style={{ zIndex: 9000, background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }}
        />
      )}
    </AnimatePresence>
  );
}

export default function WindowLayer() {
  const windows = useWindows((s) => s.windows);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0" style={{ bottom: 'var(--taskbar-h)' }}>
      <div className="pointer-events-none relative h-full w-full [&>section]:pointer-events-auto">
        <AnimatePresence>
          {windows.map((w) => (
            <Window key={w.id} win={w} />
          ))}
        </AnimatePresence>
        <SnapPreview />
      </div>
    </div>
  );
}
