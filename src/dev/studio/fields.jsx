/** Form inputs for Portfolio Studio and quick-add dialogs (one per field type in sections.js). */
import { useMemo, useRef, useState } from 'react';
import { X, Plus, Upload, Crop, ArrowUp, ArrowDown, Eye, Pencil, Loader2 } from 'lucide-react';
import { useData } from '@/data/store.js';
import { useDev } from '@/os/devmode.js';
import { previewFor } from '../store.js';
import { stageImage, stageBlob } from '../actions.js';
import { cropImage, processVideo, processModel, fileSlug } from '../processing.js';
import { renderMarkdown } from '@/apps/kit/markdown.js';
import { tagLabel } from '@/apps/kit/format.js';
import { Button, Chip } from '@/apps/kit/ui.jsx';
import Dialog from '@/apps/kit/Dialog.jsx';

export const inputCls =
  'h-8 w-full rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2.5 text-[13px] outline-none focus:border-b-2 focus:border-b-[var(--accent)]';

function Label({ field, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--text-dim)]">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function TagsInput({ value = [], onChange }) {
  const [draft, setDraft] = useState('');
  const projects = useData((s) => s.portfolio.projects);
  const suggestions = useMemo(() => [...new Set(projects.flatMap((p) => p.tags))].filter((t) => !value.includes(t)), [projects, value]);
  const add = (t) => {
    const tag = t.trim().toLowerCase().replace(/\s+/g, '_');
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] p-1">
        {value.map((t) => (
          <Chip key={t}>
            {tagLabel(t)}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><X size={11} /></button>
          </Chip>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
          placeholder="Add tag…"
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-[13px] outline-none"
          aria-label="Add tag"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestions.slice(0, 10).map((t) => (
            <button type="button" key={t} onClick={() => add(t)} className="rounded-full border border-dashed border-[var(--border-strong)] px-2 py-0.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text)]">
              + {tagLabel(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StringList({ value = [], onChange, placeholder, multiline }) {
  const list = value.length ? value : [''];
  const set = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)));
  const move = (i, d) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1">
      {list.map((v, i) => (
        <div key={i} className="flex items-start gap-1">
          {multiline ? (
            <textarea value={v} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} rows={2} className={`${inputCls} h-auto py-1.5`} />
          ) : (
            <input value={v} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} className={inputCls} />
          )}
          <div className="flex shrink-0">
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-[var(--surface-hover)] disabled:opacity-30"><ArrowUp size={13} /></button>
            <button type="button" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-[var(--surface-hover)] disabled:opacity-30"><ArrowDown size={13} /></button>
            <button type="button" aria-label="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-[var(--surface-hover)]"><X size={13} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, ''])} className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)' }}>
        <Plus size={12} /> Add
      </button>
    </div>
  );
}

/** jstMyRB-style 1 / 2 / 3-point bullets. <b>…</b> highlights tech and metrics. */
function TiersEditor({ value, onChange }) {
  const v = value ?? { 1: [''], 2: ['', ''], 3: ['', '', ''] };
  const [tab, setTab] = useState('3');
  const fillFrom3 = () => onChange({ 1: v[3].slice(0, 1), 2: v[3].slice(0, 2), 3: v[3] });
  return (
    <div className="rounded-md border border-[var(--border)] p-2">
      <div className="mb-2 flex items-center gap-1">
        {['1', '2', '3'].map((t) => (
          <Chip key={t} active={tab === t} onClick={() => setTab(t)}>{t}-point ({(v[t] ?? []).filter(Boolean).length})</Chip>
        ))}
        <button type="button" onClick={fillFrom3} className="ml-auto text-[11px] hover:underline" style={{ color: 'var(--accent)' }}>Fill 1 & 2 from the 3-point list</button>
      </div>
      <StringList multiline value={v[tab]} onChange={(list) => onChange({ ...v, [tab]: list })} placeholder="Wrap tech or numbers in <b>…</b>" />
      <p className="mt-1 text-[11px] text-[var(--text-dim)]">Cards show the 1-point bullet; project pages show the 3-point list.</p>
    </div>
  );
}

function MarkdownField({ value = '', onChange }) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="rounded-md border border-[var(--border)]">
      <div className="flex gap-1 border-b border-[var(--border)] p-1">
        <Chip active={!preview} onClick={() => setPreview(false)}><Pencil size={11} /> Write</Chip>
        <Chip active={preview} onClick={() => setPreview(true)}><Eye size={11} /> Preview</Chip>
      </div>
      {preview ? (
        <div className="min-h-32 space-y-2 p-3 text-[13px] [&_a]:text-[var(--accent)] [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_li]:ml-5 [&_ul]:list-disc" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={10} className="w-full resize-y bg-transparent p-2 font-mono text-[12px] outline-none" placeholder="# Title&#10;&#10;Write in markdown…" />
      )}
    </div>
  );
}

/** Pan/zoom crop to a fixed aspect ratio. */
function CropDialog({ file, aspect, onDone, onCancel }) {
  const [state, setState] = useState({ cx: 0.5, cy: 0.5, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const boxRef = useRef(null);
  const drag = (e) => {
    const box = boxRef.current.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, ...state };
    const move = (ev) =>
      setState((s) => ({
        ...s,
        cx: Math.min(1, Math.max(0, start.cx - (ev.clientX - start.x) / box.width / s.zoom)),
        cy: Math.min(1, Math.max(0, start.cy - (ev.clientY - start.y) / box.height / s.zoom)),
      }));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <Dialog
      open
      onClose={onCancel}
      title="Crop image"
      width={560}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              onDone(await cropImage(file, { aspect, ...state }));
            }}
          >
            {busy ? 'Cropping…' : 'Use this crop'}
          </Button>
        </>
      }
    >
      <div ref={boxRef} onPointerDown={drag} className="relative w-full cursor-move overflow-hidden rounded-md bg-black" style={{ aspectRatio: aspect }}>
        <img
          src={url}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ width: `${100 * state.zoom}%`, left: `${50 - state.cx * 100 * state.zoom}%`, top: '50%', transform: `translateY(-${state.cy * 100}%)` }}
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs">
        Zoom
        <input type="range" min={1} max={3} step={0.05} value={state.zoom} onChange={(e) => setState((s) => ({ ...s, zoom: Number(e.target.value) }))} className="flex-1" style={{ accentColor: 'var(--accent)' }} />
      </label>
    </Dialog>
  );
}

function ImageField({ value, onChange, field, dir, onThumb }) {
  const ref = useRef(null);
  const [cropFile, setCropFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const handle = async (file) => {
    setError(null);
    if (field.aspect) return setCropFile(file);
    setBusy(true);
    try {
      const r = await stageImage(file, dir, { withThumb: Boolean(field.withThumb) });
      onChange(r.src);
      onThumb?.(r.thumb);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  const preview = previewUrl(value);
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-hover)]">
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="text-[11px] text-[var(--text-dim)]">No image</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" icon={busy ? Loader2 : field.aspect ? Crop : Upload} disabled={busy} onClick={() => ref.current?.click()}>{value ? 'Replace' : 'Upload'}</Button>
          {value && <button type="button" className="text-left text-[11px] hover:underline" onClick={() => onChange('')}>Remove</button>}
        </div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      </div>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
      {cropFile && (
        <CropDialog
          file={cropFile}
          aspect={field.aspect}
          onCancel={() => setCropFile(null)}
          onDone={(blob) => {
            onChange(stageBlob(blob, dir, cropFile.name));
            setCropFile(null);
          }}
        />
      )}
    </div>
  );
}

const previewUrl = previewFor;

function ImagesField({ value = [], onChange, dir }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((src, i) => (
          <div key={src + i} className="group relative h-16 w-24 overflow-hidden rounded-md border border-[var(--border)]">
            <img src={previewUrl(src)} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="Remove image" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"><X size={11} /></button>
          </div>
        ))}
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)]">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        </button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          setBusy(true);
          setError(null);
          const added = [];
          for (const file of e.target.files ?? []) {
            try {
              added.push((await stageImage(file, dir, { withThumb: false })).src);
            } catch (err) {
              setError(`${file.name}: ${err.message}`);
            }
          }
          onChange([...value, ...added]);
          setBusy(false);
        }}
      />
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

/** URL, or upload a file (videos/models) staged for publish. */
function FileOrUrl({ value, onChange, kind, dir, onPoster }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const session = useDev((s) => s.session);
  const upload = async (file) => {
    setBusy(true);
    setError(null);
    try {
      const meta = kind === 'video' ? await processVideo(file) : await processModel(file);
      const ext = kind === 'video' ? meta.ext : 'glb';
      if (session?.largeMedia === 'vercel-blob') {
        const { uploadLarge } = await import('../largeUpload.js');
        onChange(await uploadLarge(file, `${kind === 'video' ? 'videos' : 'models'}/${fileSlug(file.name)}.${ext}`));
      } else if (session?.largeMedia === 'repo' || file.size <= 4 * 1024 * 1024) {
        onChange(stageBlob(file, dir, file.name, ext));
      } else {
        throw new Error('Large files need Vercel Blob storage (BLOB_READ_WRITE_TOKEN). Use a link instead.');
      }
      onPoster?.(stageBlob(meta.poster, 'thumbs', file.name));
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };
  return (
    <div>
      <div className="flex gap-1">
        <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={kind === 'video' ? 'https://youtu.be/… or upload a file' : 'https://…/model.glb or upload'} className={inputCls} />
        <Button type="button" icon={busy ? Loader2 : Upload} disabled={busy} onClick={() => ref.current?.click()}>File</Button>
        <input ref={ref} type="file" accept={kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : '.glb'} className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

export function Field({ field, value, onChange, section, form, setForm }) {
  const dir = section.mediaDir ?? 'photos';
  let input;
  switch (field.type) {
    case 'textarea':
      input = <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inputCls} h-auto py-1.5`} placeholder={field.placeholder} />;
      break;
    case 'markdown':
      input = <MarkdownField value={value} onChange={onChange} />;
      break;
    case 'tags':
      input = <TagsInput value={value} onChange={onChange} />;
      break;
    case 'tiers':
      input = <TiersEditor value={value} onChange={onChange} />;
      break;
    case 'list':
      input = <StringList value={value} onChange={onChange} placeholder={field.placeholder} />;
      break;
    case 'toggle':
      return (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          {field.label}
        </label>
      );
    case 'select':
      input = (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {field.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      );
      break;
    case 'image':
      input = <ImageField value={value} onChange={onChange} field={field} dir={dir} onThumb={field.withThumb ? (thumb) => setForm((f) => ({ ...f, thumb })) : undefined} />;
      break;
    case 'images':
      input = <ImagesField value={value} onChange={onChange} dir={dir} />;
      break;
    case 'video':
      input = <FileOrUrl kind="video" value={value} dir="videos" onChange={(src) => setForm((f) => ({ ...f, src, type: /youtu/.test(src) ? 'youtube' : /vimeo/.test(src) ? 'vimeo' : src.startsWith('/') || /\.(mp4|webm)(\?|$)/.test(src) ? 'mp4' : f.type }))} onPoster={(poster) => setForm((f) => ({ ...f, poster }))} />;
      break;
    case 'model':
      input = <FileOrUrl kind="model" value={value} dir="models" onChange={onChange} onPoster={(poster) => setForm((f) => ({ ...f, poster }))} />;
      break;
    default:
      input = <input type={field.type === 'url' ? 'url' : 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={inputCls} />;
  }
  return <Label field={field}>{input}</Label>;
}
