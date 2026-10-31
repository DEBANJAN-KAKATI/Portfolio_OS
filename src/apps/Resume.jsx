/**
 * Resume in a browser-style window. The PDF is drawn with pdf.js instead of an
 * <iframe>, because many browsers (most phones, some embedded webviews) have no
 * built-in PDF viewer and would show a blank frame.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ArrowLeft, ArrowRight, RotateCw, Lock, Download, ExternalLink, FileText, X, Plus, ZoomIn, ZoomOut, MoveHorizontal, AlertTriangle } from 'lucide-react';
import { useData } from '@/data/store.js';
import { displayName } from '@/os/lib/format.js';
import Spinner from '@/os/ui/Spinner.jsx';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function PdfPages({ url, zoom, reloadKey, onInfo }) {
  const wrapRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    const task = pdfjs.getDocument({ url });
    task.promise.then(
      (d) => !cancelled && (setDoc(d), onInfo({ pages: d.numPages })),
      (err) => !cancelled && setError(err?.message ?? 'Could not open the PDF'),
    );
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [url, reloadKey, onInfo]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="mx-auto flex w-full flex-col items-center gap-4 py-4">
      {error && (
        <p className="mt-10 flex items-center gap-2 rounded-md bg-black/40 px-4 py-3 text-sm text-white">
          <AlertTriangle size={16} className="text-amber-400" /> {error}
        </p>
      )}
      {!doc && !error && (
        <div className="mt-16 text-white">
          <Spinner size={32} color="#ffffff" label="Loading resume" />
        </div>
      )}
      {doc && width > 0 && Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={`${i}-${reloadKey}`} doc={doc} index={i + 1} fitWidth={Math.min(width - 32, 1000)} zoom={zoom} />)}
    </div>
  );
}

function PdfPage({ doc, index, fitWidth, zoom }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    let task;
    let cancelled = false;
    doc.getPage(index).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const cssScale = (fitWidth / base.width) * zoom;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: cssScale * dpr });
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      setSize({ w: viewport.width / dpr, h: viewport.height / dpr });
      task = page.render({ canvas, viewport });
      task.promise.catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, index, fitWidth, zoom]);
  return (
    <canvas
      ref={canvasRef}
      aria-label={`Resume page ${index}`}
      className="max-w-none bg-white shadow-lg"
      style={size ? { width: size.w, height: size.h } : { width: fitWidth * zoom, aspectRatio: '1 / 1.414' }}
    />
  );
}

export default function Resume() {
  const resume = useData((s) => s.extras.resume);
  const name = useData((s) => displayName(s.portfolio.profile.name));
  const [reloadKey, setReloadKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [info, setInfo] = useState(null);
  const onInfo = useCallback((i) => setInfo(i), []);
  const url = new URL(resume.url, window.location.origin).href;
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--surface-hover)] disabled:opacity-30';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end gap-1 bg-[var(--surface-hover)] px-2 pt-1.5">
        <div className="flex h-8 max-w-60 items-center gap-2 rounded-t-lg bg-[var(--surface-solid)] px-3 text-xs">
          <FileText size={13} className="shrink-0 text-red-500" />
          <span className="truncate">{name} — Resume</span>
          <X size={12} className="shrink-0 text-[var(--text-dim)]" aria-hidden="true" />
        </div>
        <Plus size={14} className="mb-2 ml-1 text-[var(--text-dim)]" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-solid)] px-2 py-1.5">
        <button className={icon} disabled aria-label="Back"><ArrowLeft size={15} /></button>
        <button className={icon} disabled aria-label="Forward"><ArrowRight size={15} /></button>
        <button className={icon} aria-label="Reload" onClick={() => setReloadKey((k) => k + 1)}><RotateCw size={14} /></button>
        <div className="mx-1 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--surface-hover)] px-3 text-[13px]">
          <Lock size={12} className="shrink-0 text-[var(--text-dim)]" />
          <span className="selectable truncate">{url}</span>
        </div>
        <a href={resume.url} download={resume.fileName} className={icon} aria-label="Download resume" title="Download"><Download size={15} /></a>
        <a href={resume.url} target="_blank" rel="noreferrer" className={icon} aria-label="Open in a new tab" title="Open in new tab"><ExternalLink size={15} /></a>
      </div>
      <div className="flex items-center justify-center gap-1 border-b border-black/20 bg-[#3c3f43] px-2 py-1 text-xs text-white">
        <button className="rounded p-1 hover:bg-white/10" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}><ZoomOut size={14} /></button>
        <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className="rounded p-1 hover:bg-white/10" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}><ZoomIn size={14} /></button>
        <button className="ml-1 rounded p-1 hover:bg-white/10" aria-label="Fit to width" title="Fit to width" onClick={() => setZoom(1)}><MoveHorizontal size={14} /></button>
        {info && <span className="ml-3 text-white/70">{info.pages} page{info.pages > 1 ? 's' : ''}</span>}
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-[#525659]">
        <PdfPages url={resume.url} zoom={zoom} reloadKey={reloadKey} onInfo={onInfo} />
      </div>
    </div>
  );
}
