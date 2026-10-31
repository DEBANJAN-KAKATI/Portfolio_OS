/** Paint: "Leave me a doodle". Brush, colours, eraser, undo, clear, save as PNG. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Paintbrush, Eraser, Undo2, Trash2, Save } from 'lucide-react';
import { useSystem } from '@/os/store/system.js';
import { Button } from './kit/ui.jsx';

const COLORS = ['#000000', '#7f7f7f', '#ffffff', '#c3c3c3', '#e81123', '#ff8c00', '#fff100', '#16c60c', '#00b7c3', '#0078d4', '#886ce4', '#e3008c', '#8e562e', '#ffb4c8'];
const SIZES = [2, 5, 10, 20];
const MAX_UNDO = 30;

export default function Paint() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const undoRef = useRef([]);
  const drawing = useRef(null);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#0078d4');
  const [size, setSize] = useState(5);
  const [canUndo, setCanUndo] = useState(false);
  const notify = useSystem((s) => s.notify);

  const ctx = () => canvasRef.current.getContext('2d');

  // Size the canvas to its container (device-pixel aware) and keep the drawing on resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    const fit = () => {
      const { width, height } = wrapRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(width * dpr));
      const h = Math.max(1, Math.floor(height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      const old = document.createElement('canvas');
      old.width = canvas.width;
      old.height = canvas.height;
      if (canvas.width) old.getContext('2d').drawImage(canvas, 0, 0);
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      c.drawImage(old, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const pushUndo = () => {
    const c = canvasRef.current;
    undoRef.current.push(ctx().getImageData(0, 0, c.width, c.height));
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    setCanUndo(true);
  };

  const undo = useCallback(() => {
    const img = undoRef.current.pop();
    if (img) ctx().putImageData(img, 0, 0);
    setCanUndo(undoRef.current.length > 0);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && wrapRef.current?.closest('section')?.contains(document.activeElement)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const dpr = canvasRef.current.width / r.width;
    return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr, dpr };
  };

  const stroke = (from, to) => {
    const c = ctx();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    c.lineWidth = (tool === 'eraser' ? size * 3 : size) * to.dpr;
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
  };

  const onDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pushUndo();
    const p = point(e);
    drawing.current = p;
    stroke(p, { ...p, x: p.x + 0.01 });
  };
  const onMove = (e) => {
    if (!drawing.current) return;
    const p = point(e);
    stroke(drawing.current, p);
    drawing.current = p;
  };
  const onUp = () => {
    drawing.current = null;
  };

  const clear = () => {
    pushUndo();
    const c = canvasRef.current;
    const x = ctx();
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
  };

  const save = () => {
    const a = document.createElement('a');
    a.download = `doodle-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvasRef.current.toDataURL('image/png');
    a.click();
    notify({ title: 'Doodle saved', body: 'Thanks for the art! 🎨', appId: 'paint', sound: null });
  };

  const toolBtn = (id, Icon, label) => (
    <button aria-label={label} title={label} aria-pressed={tool === id} onClick={() => setTool(id)} className={`flex h-8 w-8 items-center justify-center rounded-md ${tool === id ? 'bg-[var(--surface-press)] ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--surface-hover)]'}`}>
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-3 py-2">
        <p className="text-[13px] font-semibold">Leave me a doodle ✏️</p>
        <div className="flex gap-1" role="group" aria-label="Tools">
          {toolBtn('brush', Paintbrush, 'Brush')}
          {toolBtn('eraser', Eraser, 'Eraser')}
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Brush size">
          {SIZES.map((s) => (
            <button key={s} role="radio" aria-checked={size === s} aria-label={`Size ${s}`} onClick={() => setSize(s)} className={`flex h-8 w-8 items-center justify-center rounded-md ${size === s ? 'bg-[var(--surface-press)]' : 'hover:bg-[var(--surface-hover)]'}`}>
              <span className="rounded-full bg-[var(--text)]" style={{ width: Math.min(18, s + 2), height: Math.min(18, s + 2) }} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Colour">
          {COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={color === c}
              aria-label={`Colour ${c}`}
              onClick={() => {
                setColor(c);
                setTool('brush');
              }}
              className="h-6 w-6 rounded-full border border-[var(--border-strong)]"
              style={{ background: c, boxShadow: color === c ? '0 0 0 2px var(--surface-solid), 0 0 0 4px var(--accent)' : undefined }}
            />
          ))}
          <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-[var(--border-strong)]" title="Custom colour" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setTool('brush'); }} className="absolute inset-0 opacity-0" aria-label="Custom colour" />
          </label>
        </div>
        <div className="ml-auto flex gap-1">
          <Button icon={Undo2} onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" />
          <Button icon={Trash2} onClick={clear}>Clear</Button>
          <Button variant="primary" icon={Save} onClick={save}>Save PNG</Button>
        </div>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 bg-[#c8ccd2] p-0">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          aria-label="Drawing canvas"
          role="img"
        />
      </div>
    </div>
  );
}
