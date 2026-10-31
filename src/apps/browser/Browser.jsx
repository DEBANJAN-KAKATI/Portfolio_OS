/**
 * Browser: a small Edge-style browser for testing my apps.
 *
 *  - Direct: the page loads in a sandboxed frame from the visitor's own browser
 *    (no referrer, no stored cookies). Not anonymous.
 *  - Relay (Dev Mode only): the request leaves from the server via
 *    /api/admin/relay, so the tested app sees the server's IP and the local
 *    network only sees HTTPS to this site. The preview loads nothing from the
 *    target (no scripts, images or styles fetched), so nothing leaks around it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ArrowLeft, ArrowRight, RotateCw, Home, Plus, X, Globe, ShieldCheck, Lock, ExternalLink, Send, Loader2 } from 'lucide-react';
import config from '@config';
import { useData } from '@/data/store.js';
import { useDev, useDevActive } from '@/os/devmode.js';
import { useWindows } from '@/os/store/windows.js';
import { Badge, Chip } from '../kit/ui.jsx';

const HOME = 'about:home';
let tabSeq = 0;
const newTab = (url = HOME) => ({ id: ++tabSeq, history: [url], index: 0, mode: 'direct', result: null, loading: false, error: null, reloadKey: 0 });
const urlOf = (tab) => tab.history[tab.index];

/** Turn what was typed into a URL (adds https://). */
function normalize(input) {
  const s = input.trim();
  if (!s || s === HOME) return HOME;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}
const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};
const allowedForRelay = (url) => {
  const h = hostOf(url).toLowerCase();
  return (config.devMode?.relay?.hosts ?? []).some((p) => (p.startsWith('*.') ? h.endsWith(p.slice(1)) : h === p));
};

async function relay(body) {
  const csrf = useDev.getState().session?.csrf ?? '';
  const res = await fetch('/api/admin/relay', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Relay failed (HTTP ${res.status})`);
  return data;
}

/**
 * Relay preview: sanitized HTML in a script-less frame whose CSP blocks every
 * network fetch. Link clicks are caught here and sent through the relay too.
 */
function RelayPreview({ result, onNavigate }) {
  const ref = useRef(null);
  const html = useMemo(() => {
    const clean = DOMPurify.sanitize(result.body, {
      WHOLE_DOCUMENT: true,
      FORBID_TAGS: ['script', 'iframe', 'frame', 'object', 'embed', 'form', 'meta', 'link', 'base', 'video', 'audio', 'source', 'track'],
      FORBID_ATTR: ['srcset', 'action', 'formaction', 'ping', 'background', 'poster', 'target'],
    });
    const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:12px}img{max-width:100%;background:#8882;min-height:16px}</style></head><body>${clean}</body></html>`;
  }, [result.body]);

  useEffect(() => {
    const frame = ref.current;
    const onLoad = () => {
      frame.contentDocument?.addEventListener('click', (e) => {
        const a = e.target.closest?.('a[href]');
        if (!a) return;
        e.preventDefault();
        const href = a.getAttribute('href');
        if (href.startsWith('#')) return;
        try {
          onNavigate(new URL(href, result.finalUrl).href);
        } catch {
          /* not a URL */
        }
      });
    };
    frame.addEventListener('load', onLoad);
    return () => frame.removeEventListener('load', onLoad);
  }, [result.finalUrl, onNavigate]);

  // A JavaScript app ships an almost empty page that its scripts fill in.
  const emptyShell = useMemo(() => new DOMParser().parseFromString(html, 'text/html').body.textContent.trim().length < 40, [html]);

  // allow-same-origin without allow-scripts: the page can't run code, and this
  // component can read its clicks to keep navigation inside the relay.
  return (
    <div className="relative h-full">
      <iframe ref={ref} title="Relay preview" sandbox="allow-same-origin" srcDoc={html} className="h-full w-full bg-white" />
      {emptyShell && (
        <div className="absolute inset-0 flex items-center justify-center bg-white p-6 text-center text-[13px] text-neutral-700">
          <p className="max-w-sm">
            <b className="block text-neutral-900">This is a JavaScript app.</b>
            Its page is built by scripts, which the relay preview doesn't run (that would let the site reach your device). Check <b>Body</b> and <b>Headers</b>, or relay its API endpoints directly.
          </p>
        </div>
      )}
    </div>
  );
}

function RelayResult({ result, onNavigate }) {
  const isHtml = /html/i.test(result.contentType) && result.encoding === 'text';
  const [view, setView] = useState(isHtml ? 'preview' : 'body');
  const pretty = useMemo(() => {
    if (result.encoding !== 'text') return `(binary, ${result.size.toLocaleString()} bytes)`;
    if (/json/i.test(result.contentType)) {
      try {
        return JSON.stringify(JSON.parse(result.body), null, 2);
      } catch {
        /* not JSON after all */
      }
    }
    return result.body;
  }, [result]);
  const ok = result.status < 400;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-1.5 text-xs">
        <span className="rounded px-1.5 py-0.5 font-semibold text-white" style={{ background: ok ? '#16a34a' : '#dc2626' }}>
          {result.status} {result.statusText}
        </span>
        <span className="text-[var(--text-dim)]">{result.timeMs} ms · {(result.size / 1024).toFixed(1)} KB{result.truncated ? ' (truncated)' : ''}</span>
        {result.redirects.length > 0 && <span className="text-[var(--text-dim)]">· {result.redirects.length} redirect{result.redirects.length > 1 ? 's' : ''}</span>}
        <span className="flex-1" />
        {isHtml && <Chip active={view === 'preview'} onClick={() => setView('preview')}>Preview</Chip>}
        <Chip active={view === 'body'} onClick={() => setView('body')}>Body</Chip>
        <Chip active={view === 'headers'} onClick={() => setView('headers')}>Headers</Chip>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view === 'preview' && <RelayPreview result={result} onNavigate={onNavigate} />}
        {view === 'body' && <pre className="selectable whitespace-pre-wrap break-all p-3 font-mono text-[12px]">{pretty}</pre>}
        {view === 'headers' && (
          <table className="selectable w-full text-left text-[12px]">
            <tbody>
              {result.headers.map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--border)]">
                  <td className="w-56 px-3 py-1 align-top font-mono text-[var(--text-dim)]">{k}</td>
                  <td className="break-all px-3 py-1 font-mono">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {view === 'preview' && <p className="border-t border-[var(--border)] px-3 py-1 text-[11px] text-[var(--text-dim)]">Relay preview: images, styles and scripts from the site aren't loaded, so nothing reaches it from your device. Links open through the relay.</p>}
    </div>
  );
}

/** Direct mode: the site in a sandboxed, cookie-less frame, with a loading cue for slow apps. */
function DirectFrame({ url }) {
  const [loading, setLoading] = useState(true);
  return (
    <>
      <iframe
        title={hostOf(url)}
        src={url}
        onLoad={() => setLoading(false)}
        className="h-full w-full bg-white"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        credentialless="true"
        allow="clipboard-write"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-[13px] text-neutral-600">
          <Loader2 size={16} className="animate-spin" /> Loading {hostOf(url)}…
        </div>
      )}
      <p className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-[var(--surface-solid)]/90 px-3 py-1 text-[11px] text-[var(--text-dim)] backdrop-blur">
        <Badge tone="muted">Direct</Badge> Loaded from your own browser. Blank page? Some sites refuse to be shown inside other pages; use the ↗ button.
      </p>
    </>
  );
}

function HomePage({ onOpen }) {
  const projects = useData((s) => s.portfolio.projects);
  const links = projects
    .filter((p) => !p.hidden && (p.demoUrl || p.github?.homepage))
    .map((p) => ({ title: p.title, url: p.demoUrl || p.github.homepage }));
  const relayHosts = config.devMode?.relay?.hosts ?? [];
  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <Globe size={36} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-xl font-semibold">Test Browser</h1>
          <p className="text-[13px] text-[var(--text-dim)]">Open and test my live apps. Type an address above, or pick one below.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <button key={l.url} onClick={() => onOpen(l.url)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-3 text-left hover:bg-[var(--surface-hover)]">
            <p className="truncate text-[13px] font-medium">{l.title}</p>
            <p className="truncate text-[11px] text-[var(--text-dim)]">{hostOf(l.url)}</p>
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-2 rounded-lg border border-[var(--border)] p-4 text-[12px] text-[var(--text-dim)]">
        <p><b className="text-[var(--text)]">Direct</b> loads the page from your own browser in a sandbox, with no referrer and no stored cookies. It is private, not anonymous.</p>
        <p><b className="text-[var(--text)]">Relay</b> (owner only) sends the request from the server: the app sees the server's IP, and your network only sees an encrypted connection to this site. Allowed hosts: {relayHosts.join(', ') || 'none configured'}.</p>
        <p>For anonymous browsing of any site, use Tor Browser or a VPN; no web page can hide your traffic on its own.</p>
      </div>
    </div>
  );
}

export default function Browser({ windowId, url: initialUrl }) {
  const dev = useDevActive();
  const setTitle = useWindows((s) => s.setTitle);
  const [tabs, setTabs] = useState(() => [newTab(initialUrl ? normalize(initialUrl) : HOME)]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const tab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const current = urlOf(tab);
  const [address, setAddress] = useState(current === HOME ? '' : current);
  const [method, setMethod] = useState('GET');
  const [reqBody, setReqBody] = useState('');

  const patch = (id, fn) => setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)));

  useEffect(() => {
    setAddress(current === HOME ? '' : current);
    setTitle(windowId, current === HOME ? 'Browser' : `${hostOf(current)} - Browser`);
  }, [current, windowId, setTitle]);

  const runRelay = async (id, url) => {
    patch(id, () => ({ loading: true, error: null }));
    try {
      const result = await relay({ url, method, body: ['GET', 'HEAD'].includes(method) ? null : reqBody });
      patch(id, () => ({ loading: false, result }));
    } catch (err) {
      patch(id, () => ({ loading: false, error: err.message, result: null }));
    }
  };

  const navigate = (raw, { push = true } = {}) => {
    const url = normalize(raw);
    patch(tab.id, (t) => {
      const history = push ? [...t.history.slice(0, t.index + 1), url] : t.history;
      return { history, index: push ? history.length - 1 : t.index, result: null, error: null };
    });
    if (tab.mode === 'relay' && url !== HOME && allowedForRelay(url)) runRelay(tab.id, url);
  };

  const go = (delta) => {
    const index = Math.max(0, Math.min(tab.history.length - 1, tab.index + delta));
    if (index === tab.index) return;
    const url = tab.history[index];
    patch(tab.id, () => ({ index, result: null, error: null }));
    if (tab.mode === 'relay' && url !== HOME && allowedForRelay(url)) runRelay(tab.id, url);
  };

  const reload = () => {
    if (current === HOME) return;
    if (tab.mode === 'relay') allowedForRelay(current) && runRelay(tab.id, current);
    else patch(tab.id, (t) => ({ reloadKey: t.reloadKey + 1 }));
  };

  const setMode = (mode) => {
    if (mode === 'relay' && !dev) return;
    patch(tab.id, () => ({ mode, result: null, error: null }));
    if (mode === 'relay' && current !== HOME && allowedForRelay(current)) runRelay(tab.id, current);
  };

  // Relay is owner-only: leaving Dev Mode drops tabs back to Direct.
  useEffect(() => {
    if (!dev) setTabs((ts) => ts.map((t) => (t.mode === 'relay' ? { ...t, mode: 'direct', result: null } : t)));
  }, [dev]);

  const addTab = () => {
    const t = newTab();
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };
  const closeTab = (id) => {
    setTabs((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (!next.length) {
        const t = newTab();
        setActiveId(t.id);
        return [t];
      }
      if (id === activeId) setActiveId(next[Math.max(0, ts.findIndex((t) => t.id === id) - 1)].id);
      return next;
    });
  };

  const relayBlocked = tab.mode === 'relay' && current !== HOME && !allowedForRelay(current);

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex items-end gap-1 overflow-x-auto bg-[var(--surface-alt)] px-2 pt-1.5">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`group flex h-8 max-w-[200px] min-w-[120px] items-center gap-1.5 rounded-t-md px-2.5 text-[12px] ${t.id === tab.id ? 'bg-[var(--surface-solid)]' : 'hover:bg-[var(--surface-hover)]'}`}
          >
            <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => setActiveId(t.id)}>
              {t.mode === 'relay' ? <ShieldCheck size={13} className="shrink-0 text-green-500" /> : <Globe size={13} className="shrink-0" />}
              <span className="truncate">{urlOf(t) === HOME ? 'New tab' : hostOf(urlOf(t))}</span>
            </button>
            <button aria-label="Close tab" onClick={() => closeTab(t.id)} className="rounded p-0.5 opacity-60 hover:bg-[var(--surface-hover)] hover:opacity-100"><X size={12} /></button>
          </div>
        ))}
        <button aria-label="New tab" onClick={addTab} className="mb-1 rounded p-1 hover:bg-[var(--surface-hover)]"><Plus size={14} /></button>
      </div>

      {/* Toolbar */}
      <form
        className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-solid)] px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(address);
        }}
      >
        <button type="button" aria-label="Back" disabled={tab.index === 0} onClick={() => go(-1)} className="rounded p-1.5 hover:bg-[var(--surface-hover)] disabled:opacity-40"><ArrowLeft size={15} /></button>
        <button type="button" aria-label="Forward" disabled={tab.index >= tab.history.length - 1} onClick={() => go(1)} className="rounded p-1.5 hover:bg-[var(--surface-hover)] disabled:opacity-40"><ArrowRight size={15} /></button>
        <button type="button" aria-label="Reload" onClick={reload} className="rounded p-1.5 hover:bg-[var(--surface-hover)]">{tab.loading ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />}</button>
        <button type="button" aria-label="Home" onClick={() => navigate(HOME)} className="rounded p-1.5 hover:bg-[var(--surface-hover)]"><Home size={15} /></button>
        {tab.mode === 'relay' && (
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method" className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-1 text-[12px]">
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3">
          {tab.mode === 'relay' ? <ShieldCheck size={13} className="shrink-0 text-green-500" /> : <Lock size={12} className="shrink-0 text-[var(--text-dim)]" />}
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Type an address, e.g. jalproloy.vercel.app" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" aria-label="Address" spellCheck={false} />
          {tab.mode === 'relay' && <button type="submit" aria-label="Send" className="rounded p-0.5 hover:bg-[var(--surface-hover)]"><Send size={13} /></button>}
        </label>
        <div className="flex gap-1">
          <Chip active={tab.mode === 'direct'} onClick={() => setMode('direct')}>Direct</Chip>
          <span title={dev ? 'Send requests from the server' : 'Relay is available to the site owner in Dev Mode'}>
            <Chip active={tab.mode === 'relay'} onClick={() => setMode('relay')} className={dev ? '' : 'cursor-not-allowed opacity-50'}>
              <ShieldCheck size={11} /> Relay
            </Chip>
          </span>
        </div>
        {current !== HOME && (
          <a href={current} target="_blank" rel="noreferrer noopener" aria-label="Open in a new browser tab" className="rounded p-1.5 hover:bg-[var(--surface-hover)]"><ExternalLink size={15} /></a>
        )}
      </form>
      {tab.mode === 'relay' && !['GET', 'HEAD', 'OPTIONS'].includes(method) && (
        <textarea value={reqBody} onChange={(e) => setReqBody(e.target.value)} placeholder='Request body, e.g. {"query": "test"}' rows={3} className="border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 font-mono text-[12px] outline-none" aria-label="Request body" />
      )}

      {/* Page */}
      <div className="relative min-h-0 flex-1 bg-[var(--surface-solid)]">
        {current === HOME ? (
          <div className="h-full overflow-y-auto"><HomePage onOpen={(u) => navigate(u)} /></div>
        ) : tab.mode === 'direct' ? (
          <DirectFrame key={`${tab.id}:${tab.index}:${tab.reloadKey}`} url={current} />
        ) : relayBlocked ? (
          <div className="p-6 text-[13px]">
            <p className="font-semibold">{hostOf(current)} isn't on the relay allow-list.</p>
            <p className="mt-1 text-[var(--text-dim)]">Relay only reaches your own apps. Add the host to <code>devMode.relay.hosts</code> in portfolio.config.js and publish.</p>
          </div>
        ) : tab.error ? (
          <div className="p-6 text-[13px] text-red-500">{tab.error}</div>
        ) : tab.result ? (
          <RelayResult result={tab.result} onNavigate={(u) => navigate(u)} />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-dim)]">{tab.loading ? 'Sending through the relay…' : 'Press Enter to send.'}</div>
        )}
      </div>
    </div>
  );
}
