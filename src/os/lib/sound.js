/**
 * Synthesised UI sounds (Web Audio, no audio files). Browsers block audio until
 * the visitor interacts, so everything stays silent until the first pointer or
 * key press, then the context is created and sounds play normally.
 */
let ctx = null;
let master = null;
let unlocked = false;
let settings = { enabled: true, volume: 0.6 };

function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = settings.volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { once: true, capture: true });
}

export function configureSound({ enabled, volume }) {
  settings = { enabled, volume };
  if (master) master.gain.value = volume;
}

export const soundReady = () => unlocked && !!ctx;

function tone(freq, start, dur, { type = 'sine', gain = 0.2, glide } = {}) {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(start, dur, gain = 0.08) {
  const t = ctx.currentTime + start;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(3000, t + dur);
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

const SOUNDS = {
  startup: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.9 - i * 0.1, { gain: 0.14, type: 'triangle' })),
  shutdown: () => [783.99, 659.25, 523.25, 392].forEach((f, i) => tone(f, i * 0.12, 0.7, { gain: 0.12, type: 'triangle' })),
  click: () => tone(1400, 0, 0.04, { gain: 0.05, type: 'square' }),
  open: () => tone(520, 0, 0.12, { gain: 0.07, glide: 880 }),
  close: () => tone(700, 0, 0.1, { gain: 0.06, glide: 380 }),
  minimize: () => tone(600, 0, 0.14, { gain: 0.06, glide: 300 }),
  menu: () => tone(900, 0, 0.05, { gain: 0.04 }),
  notify: () => {
    tone(880, 0, 0.18, { gain: 0.1 });
    tone(1318.5, 0.09, 0.3, { gain: 0.09 });
  },
  error: () => {
    tone(220, 0, 0.18, { gain: 0.12, type: 'square' });
    tone(196, 0.12, 0.22, { gain: 0.12, type: 'square' });
  },
  whoosh: () => noise(0, 0.35, 0.12),
  crumple: () => [0, 0.06, 0.13, 0.2].forEach((s) => noise(s, 0.08, 0.08)),
};

export function playSound(name) {
  if (!settings.enabled || !unlocked || !ctx || !SOUNDS[name]) return;
  if (ctx.state === 'suspended') ctx.resume();
  try {
    SOUNDS[name]();
  } catch {
    /* audio is best effort */
  }
}
