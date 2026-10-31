/** Command Prompt: black window, monospace, history, Tab completion, a fake file system. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/data/store.js';
import { useWindows } from '@/os/store/windows.js';
import { useSystem } from '@/os/store/system.js';
import { useMotionPrefs } from '@/os/lib/hooks.js';
import { devLogin } from '@/os/devmode.js';
import { buildFileSystem, formatPath, HOME } from './filesystem.js';
import { runCommand, complete, CMD_COLORS } from './commands.js';

let lineId = 0;
const toSegs = (items) => items.flatMap((it) => (it == null || it === false ? [] : typeof it === 'string' ? [{ t: it }] : [it]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function Segment({ s }) {
  const style = { color: s.c, fontWeight: s.b ? 700 : undefined };
  if (s.href) {
    return (
      <a href={s.href} target="_blank" rel="noreferrer" style={style} className="underline decoration-dotted underline-offset-2">
        {s.t}
      </a>
    );
  }
  return <span style={style}>{s.t}</span>;
}

/** Green code rain on a canvas over the terminal. */
function MatrixRain({ onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const fit = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    fit();
    const size = 14;
    const cols = Math.ceil(canvas.width / size);
    const drops = Array.from({ length: cols }, () => Math.random() * -40);
    const chars = 'アイウエオカキクケコサシスセソ0123456789DEBANJANKAKATI<>/{}';
    let raf;
    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.97 ? '#d8ffd8' : '#16c60c';
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * size, y * size);
        drops[i] = y * size > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const t = setTimeout(onDone, 7000);
    const stop = () => onDone();
    window.addEventListener('keydown', stop, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('keydown', stop);
    };
  }, [onDone]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full bg-black" aria-label="Matrix rain (press any key to stop)" />;
}

export default function Terminal({ windowId }) {
  const state = useData();
  const fs = useMemo(() => buildFileSystem(state), [state]);
  const { reduced } = useMotionPrefs();
  const [lines, setLines] = useState(() => [
    { id: ++lineId, segs: [{ t: 'PortfolioOS [Version 26.10.0]' }] },
    { id: ++lineId, segs: [{ t: `(c) ${new Date().getFullYear()} PortfolioOS. Type "help" to see what you can do.` }] },
    { id: ++lineId, segs: [] },
  ]);
  const [cwd, setCwd] = useState(HOME);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [colors, setColors] = useState({ bg: CMD_COLORS[0], fg: CMD_COLORS[7] });
  const [password, setPassword] = useState(null); // { prompt, resolve, value }
  const [effect, setEffect] = useState(null);
  const effectDone = useRef(null);
  const cancelled = useRef(false);
  const tabState = useRef(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const failedSudo = useRef(0);

  const prompt = `${formatPath(cwd)}>`;

  const print = useCallback((...items) => setLines((l) => [...l.slice(-800), { id: ++lineId, segs: toSegs(items) }]), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, password, busy]);

  const focus = () => inputRef.current?.focus();
  useEffect(focus, []);

  const runEffect = useCallback(
    async (name) => {
      cancelled.current = false;
      if (name === 'matrix') {
        if (reduced) return print('(The Matrix is paused because animations are off.)');
        await new Promise((resolve) => {
          effectDone.current = resolve;
          setEffect('matrix');
        });
        print({ t: 'Wake up, visitor… you were in the portfolio all along.', c: '#16c60c' });
        return;
      }
      const script =
        name === 'hack'
          ? [
              ['Initializing hack.exe v1.337…', 300],
              ['Bypassing mainframe firewall……………', 500],
              ['Downloading more RAM… ██████████ 100%', 600],
              ['Decrypting ' + 'resume.pdf with 4096-bit coffee…', 500],
              ['Injecting SQL into the coffee machine…', 400],
              ['Reversing the polarity of the neutron flow…', 500],
              ['ACCESS GRANTED', 300],
              ['…to a portfolio that was public anyway. 😄', 0],
            ]
          : [
              ['rm: preserving root… just kidding, deleting C:\\', 300],
              ['deleting C:\\Windows\\System32 ………… ', 400],
              ['deleting C:\\Users\\Guest\\Projects …… ', 400],
              ['deleting C:\\Users\\Guest\\Resume.pdf …', 400],
              ['deleting sense_of_humor.dll ……………… FAILED (in use)', 600],
              ['⚠ CRITICAL: Nothing was deleted. Visitors only get read access. Phew.', 0],
            ];
      for (const [text, wait] of script) {
        if (cancelled.current) return print({ t: '^C', c: '#e74856' });
        print({ t: text, c: text.startsWith('ACCESS') ? '#16c60c' : text.startsWith('⚠') ? '#f9f1a5' : name === 'panic' ? '#e74856' : '#16c60c' });
        await sleep(reduced ? 0 : wait);
      }
    },
    [print, reduced],
  );

  const askPassword = (promptText) => new Promise((resolve) => setPassword({ prompt: promptText, resolve, value: '' }));

  /** Hidden "sudo devmode": the password is only ever checked by the server (Dev Mode). */
  const devMode = useCallback(async () => {
    const pw = await askPassword('[sudo] password for guest: ');
    const r = await devLogin(pw);
    if (r.reason === 'unavailable') {
      print({ t: "sudo: Dev Mode isn't set up on this server yet.", c: '#f9f1a5' });
      return;
    }
    if (r.reason === 'locked') {
      print({ t: 'sudo: too many attempts. Try again later.', c: '#e74856' });
      return;
    }
    if (!r.ok) {
      failedSudo.current++;
      if (failedSudo.current >= 3) {
        failedSudo.current = 0;
        print({ t: 'sudo: 3 incorrect password attempts. This incident will be reported.', c: '#e74856' });
        setEffect('glitch');
        setTimeout(() => setEffect(null), 600);
      } else print('Sorry, try again.');
      return;
    }
    failedSudo.current = 0;
    print({ t: 'Access granted. Welcome back.', c: '#16c60c' });
  }, [print]);

  const ctx = {
    print,
    blank: () => print(''),
    clear: () => setLines([]),
    state,
    cwd,
    setCwd,
    fs,
    setColors,
    openApp: (id, props) => useWindows.getState().open(id, { props }),
    closeSelf: () => useWindows.getState().close(windowId),
    runEffect,
    devMode,
    system: useSystem.getState(),
  };

  const submit = async () => {
    const raw = input;
    print({ t: prompt }, { t: raw });
    setInput('');
    setHistIdx(-1);
    tabState.current = null;
    if (raw.trim()) setHistory((h) => [...h.filter((x) => x !== raw), raw].slice(-100));
    setBusy(true);
    try {
      await runCommand(raw, ctx);
    } catch (err) {
      print({ t: `Error: ${err.message}`, c: '#e74856' });
    }
    setBusy(false);
    print('');
    setTimeout(focus, 0);
  };

  const onKeyDown = (e) => {
    if (password) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const { resolve, value, prompt: p } = password;
        print({ t: p });
        setPassword(null);
        resolve(value);
      } else if (e.key === 'Backspace') {
        setPassword((pw) => ({ ...pw, value: pw.value.slice(0, -1) }));
      } else if (e.key.length === 1 && !e.ctrlKey) {
        e.preventDefault();
        setPassword((pw) => ({ ...pw, value: pw.value + e.key }));
      } else if (e.key === 'c' && e.ctrlKey) {
        password.resolve('');
        setPassword(null);
      }
      return;
    }
    if (e.key === 'c' && e.ctrlKey && (busy || !window.getSelection()?.toString())) {
      e.preventDefault();
      cancelled.current = true;
      if (!busy) {
        print({ t: prompt }, { t: input }, { t: '^C', c: '#e74856' });
        setInput('');
      }
      return;
    }
    if (busy) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const i = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setInput(history[i]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx < 0) return;
      const i = histIdx + 1;
      if (i >= history.length) {
        setHistIdx(-1);
        setInput('');
      } else {
        setHistIdx(i);
        setInput(history[i]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Repeated Tab cycles through matches, like cmd.
      if (!tabState.current || tabState.current.shown !== input) {
        const options = complete(input, ctx);
        if (!options.length) return;
        tabState.current = { options, i: 0, shown: options[0] };
      } else {
        const t = tabState.current;
        t.i = (t.i + 1) % t.options.length;
        t.shown = t.options[t.i];
      }
      setInput(tabState.current.shown);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-mono text-[13px] leading-[1.35]"
      style={{ background: colors.bg, color: colors.fg, filter: effect === 'glitch' ? 'hue-rotate(90deg) saturate(3) blur(0.6px)' : undefined }}
      onMouseUp={() => !window.getSelection()?.toString() && focus()}
    >
      <div ref={scrollRef} className="selectable min-h-0 flex-1 overflow-y-auto px-3 py-2" role="log" aria-live="polite" aria-label="Command Prompt output">
        {lines.map((l) => (
          <div key={l.id} className="min-h-[1.35em] whitespace-pre-wrap break-words">
            {l.segs.map((s, i) => (
              <Segment key={i} s={s} />
            ))}
          </div>
        ))}
        {password ? (
          <div className="whitespace-pre-wrap">{password.prompt}</div>
        ) : (
          !busy && (
            <label className="flex whitespace-pre">
              <span>{prompt}</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  tabState.current = null;
                }}
                onKeyDown={onKeyDown}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                aria-label="Command"
                className="min-w-0 flex-1 bg-transparent font-mono outline-none"
                style={{ color: colors.fg, caretColor: colors.fg }}
              />
            </label>
          )
        )}
        {/* Keeps keyboard focus while a command runs or a password is typed. */}
        {(busy || password) && (
          <input
            ref={inputRef}
            onKeyDown={onKeyDown}
            // Paste, password managers and IME arrive as input events, not keydowns.
            onChange={(e) => {
              const text = e.target.value;
              e.target.value = '';
              if (password && text) setPassword((pw) => pw && { ...pw, value: pw.value + text });
            }}
            className="absolute h-0 w-0 opacity-0"
            aria-label={password ? 'Password (hidden)' : 'Busy'}
            autoComplete="off"
            autoFocus
          />
        )}
      </div>
      {effect === 'matrix' && (
        <MatrixRain
          onDone={() => {
            setEffect(null);
            effectDone.current?.();
            setTimeout(focus, 0);
          }}
        />
      )}
    </div>
  );
}
