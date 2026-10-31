import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Power } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useSystem } from '../store/system.js';
import { displayName } from '../lib/format.js';
import Spinner from '../ui/Spinner.jsx';
import Monogram from '../ui/Monogram.jsx';

export function ShuttingDown() {
  const setPhase = useSystem((s) => s.setPhase);
  useEffect(() => {
    const t = setTimeout(() => setPhase('off'), 2200);
    return () => clearTimeout(t);
  }, [setPhase]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[90000] flex flex-col items-center justify-center gap-6 bg-[#0b1a33] text-white">
      <Spinner size={40} color="#fff" label="Shutting down" />
      <p className="text-xl">Shutting down</p>
    </motion.div>
  );
}

export function PoweredOff() {
  const restart = useSystem((s) => s.restart);
  return (
    <div className="fixed inset-0 z-[90000] flex items-center justify-center bg-black">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        onClick={restart}
        aria-label="Power on"
        className="group flex h-20 w-20 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-[var(--accent)] hover:text-white hover:shadow-[0_0_40px_var(--accent)]"
        autoFocus
      >
        <Power size={32} />
      </motion.button>
    </div>
  );
}

/** Bouncing logo + name; any input ends it (Sleep wakes to the lock screen). */
export function Screensaver() {
  const wake = useSystem((s) => s.wake);
  const name = useData((s) => displayName(s.portfolio.profile.name));
  const ref = useRef(null);
  const [hue, setHue] = useState(200);

  useEffect(() => {
    const el = ref.current;
    let x = Math.random() * (window.innerWidth - 300);
    let y = Math.random() * (window.innerHeight - 120);
    let dx = 2.2;
    let dy = 1.8;
    let raf;
    const tick = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      x += dx;
      y += dy;
      if (x <= 0 || x + w >= window.innerWidth) {
        dx = -dx;
        setHue((v) => (v + 67) % 360);
      }
      if (y <= 0 || y + h >= window.innerHeight) {
        dy = -dy;
        setHue((v) => (v + 67) % 360);
      }
      el.style.transform = `translate(${x}px, ${y}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // Small grace period so the click that started Sleep doesn't end it.
    const armed = setTimeout(() => {
      for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, wake, { once: true });
    }, 600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(armed);
      for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.removeEventListener(ev, wake);
    };
  }, [wake]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95000] cursor-none bg-black" aria-label="Screensaver">
      <div ref={ref} className="absolute left-0 top-0 flex items-center gap-3" style={{ filter: `hue-rotate(${hue}deg)` }}>
        <Monogram size={64} />
        <span className="text-2xl font-semibold text-[#5fb2ff]">{name}</span>
      </div>
    </motion.div>
  );
}
