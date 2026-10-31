/**
 * Mail (Outlook style). The contact form posts to Formspree or EmailJS
 * (portfolio.config.js → contact). Both are public, client-side endpoints;
 * no secrets are involved.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Inbox, Send, PenSquare, Quote, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import config from '@config';
import { useData } from '@/data/store.js';
import { useSystem } from '@/os/store/system.js';
import { playSound } from '@/os/lib/sound.js';
import { displayName, firstName } from '@/os/lib/format.js';
import { GithubGlyph } from '@/os/ui/AppIcon.jsx';
import { Button, Card } from './kit/ui.jsx';

const SUBJECTS = {
  hello: 'Hello from your portfolio',
};

const configured = () => {
  const c = config.contact;
  if (c.provider === 'emailjs') return Boolean(c.emailjs.serviceId && c.emailjs.templateId && c.emailjs.publicKey);
  return Boolean(c.formspreeId) && c.formspreeId !== 'your-form-id';
};

async function sendMessage({ name, email, subject, message }) {
  const c = config.contact;
  if (c.provider === 'emailjs') {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: c.emailjs.serviceId, template_id: c.emailjs.templateId, user_id: c.emailjs.publicKey, template_params: { name, email, subject, message } }),
    });
    if (!res.ok) throw new Error(await res.text());
    return;
  }
  const res = await fetch(`https://formspree.io/f/${encodeURIComponent(c.formspreeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ name, email, _replyto: email, _subject: subject, message }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.errors?.map((e) => e.message).join(', ') || `HTTP ${res.status}`);
  }
}

function LinkedInMark({ size = 16 }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[3px] bg-[#0a66c2] font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.62, fontFamily: 'Arial, sans-serif' }}>
      in
    </span>
  );
}

function ContactCards() {
  const profile = useData((s) => s.portfolio.profile);
  const github = useData((s) => s.portfolio.github);
  const testimonials = useData((s) => s.portfolio.testimonials);
  return (
    <div className="space-y-3">
      {profile.linkedin && (
        <a href={profile.linkedin} target="_blank" rel="noreferrer" className="block">
          <Card className="flex items-center gap-3 p-3 transition hover:shadow-md">
            <LinkedInMark size={28} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">Connect on LinkedIn</p>
              <p className="truncate text-xs text-[var(--text-dim)]">{profile.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</p>
            </div>
          </Card>
        </a>
      )}
      {profile.github && (
        <a href={profile.github} target="_blank" rel="noreferrer" className="block">
          <Card className="flex items-center gap-3 p-3 transition hover:shadow-md">
            {github?.avatarUrl ? <img src={github.avatarUrl} alt="" className="h-7 w-7 rounded-full" /> : <GithubGlyph size={28} />}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold"><GithubGlyph size={13} /> Follow on GitHub</p>
              <p className="truncate text-xs text-[var(--text-dim)]">{github ? `${github.publicRepos} repos · ${github.followers} followers` : profile.github}</p>
            </div>
          </Card>
        </a>
      )}
      {profile.email && (
        <Card className="p-3 text-[13px]">
          <p className="text-xs text-[var(--text-dim)]">Email</p>
          <a className="selectable hover:underline" href={`mailto:${profile.email}`}>{profile.email}</a>
        </Card>
      )}
      {testimonials.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Testimonials</p>
          {testimonials.map((t) => (
            <Card key={t.id} className="p-3">
              <Quote size={14} className="mb-1 text-[var(--accent)]" />
              <p className="selectable text-[13px] italic leading-relaxed">{t.text}</p>
              <p className="mt-2 text-xs font-semibold">{t.author}</p>
              {(t.headline || t.relationship) && <p className="text-[11px] text-[var(--text-dim)]">{[t.headline, t.relationship].filter(Boolean).join(' · ')}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Compose({ initialSubject, onSent }) {
  const owner = useData((s) => displayName(s.portfolio.profile.name));
  const notify = useSystem((s) => s.notify);
  const [form, setForm] = useState({ name: '', email: '', subject: initialSubject ?? '', message: '', company: '' });
  const [status, setStatus] = useState({ state: 'idle', error: null });
  useEffect(() => setForm((f) => ({ ...f, subject: initialSubject ?? f.subject })), [initialSubject]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && form.message.trim().length >= 10;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || status.state === 'sending') return;
    if (form.company) return; // honeypot: bots fill hidden fields
    if (!configured()) {
      setStatus({ state: 'error', error: 'The contact form isn’t connected yet. Please reach out on LinkedIn instead.' });
      playSound('error');
      return;
    }
    setStatus({ state: 'sending', error: null });
    try {
      await sendMessage(form);
      playSound('whoosh');
      notify({ title: 'Message sent', body: `${firstName(owner)} will get back to you soon.`, appId: 'mail', sound: null });
      onSent({ ...form, at: Date.now() });
      setForm({ name: '', email: '', subject: '', message: '', company: '' });
      setStatus({ state: 'sent', error: null });
    } catch (err) {
      playSound('error');
      setStatus({ state: 'error', error: `Couldn’t send: ${err.message}` });
    }
  };

  const field = 'h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-3 text-[13px] outline-none focus:border-b-2 focus:border-b-[var(--accent)]';
  return (
    <form onSubmit={submit} className="flex h-full flex-col gap-3 p-5" noValidate>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="w-16 text-[var(--text-dim)]">To</span>
        <span className="rounded-full bg-[var(--surface-hover)] px-2.5 py-0.5">{owner}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Your name" aria-label="Your name" value={form.name} onChange={set('name')} autoComplete="name" required />
        <input className={field} placeholder="Your email" aria-label="Your email" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
      </div>
      <input className={field} placeholder="Subject" aria-label="Subject" value={form.subject} onChange={set('subject')} />
      {/* Honeypot, hidden from people and assistive tech */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.company} onChange={set('company')} name="company" />
      <textarea
        className={`${field} min-h-40 flex-1 resize-none py-2`}
        placeholder="Write your message… (at least 10 characters)"
        aria-label="Message"
        value={form.message}
        onChange={set('message')}
        required
      />
      {status.state === 'error' && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-red-500/10 p-2 text-xs text-red-500">
          <AlertTriangle size={14} className="mt-px shrink-0" /> {status.error}
        </p>
      )}
      {status.state === 'sent' && (
        <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} role="status" className="flex items-center gap-2 text-xs text-emerald-500">
          <CheckCircle2 size={14} /> Sent! Thanks for reaching out.
        </motion.p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" icon={status.state === 'sending' ? Loader2 : Send} disabled={!valid || status.state === 'sending'} className={status.state === 'sending' ? '[&_svg]:animate-spin' : ''}>
          {status.state === 'sending' ? 'Sending…' : 'Send'}
        </Button>
        {!valid && <span className="text-[11px] text-[var(--text-dim)]">Name, a valid email and a message are needed.</span>}
      </div>
    </form>
  );
}

export default function Mail({ compose }) {
  const profile = useData((s) => s.portfolio.profile);
  const openToWork = useData((s) => s.extras.openToWork);
  const owner = displayName(profile.name);
  const [folder, setFolder] = useState(compose ? 'compose' : 'inbox');
  const [sent, setSent] = useState([]);
  const [composeKey, setComposeKey] = useState(0);

  useEffect(() => {
    if (compose) {
      setFolder('compose');
      setComposeKey((k) => k + 1);
    }
  }, [compose]);

  const welcome = useMemo(
    () => ({
      from: owner,
      subject: 'Thanks for stopping by 👋',
      preview: 'Here’s how to reach me…',
      body: [
        `Hi there, I’m ${firstName(owner)}. Thanks for exploring my little OS!`,
        openToWork.enabled ? openToWork.text : null,
        'The quickest way to reach me is a message from this app (New message, top left), or LinkedIn. I read everything.',
      ].filter(Boolean),
    }),
    [owner, openToWork],
  );

  const navItem = (id, label, Icon, count) => (
    <button
      onClick={() => setFolder(id)}
      aria-current={folder === id ? 'page' : undefined}
      className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-[var(--surface-hover)] ${folder === id ? 'bg-[var(--surface-hover)] font-medium' : ''}`}
    >
      <Icon size={15} /> <span className="flex-1 text-left">{label}</span>
      {count ? <span className="text-xs" style={{ color: 'var(--accent)' }}>{count}</span> : null}
    </button>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-48 shrink-0 flex-col gap-1 border-r border-[var(--border)] p-2 sm:flex">
        <Button variant="primary" icon={PenSquare} className="mb-2 w-full" onClick={() => { setFolder('compose'); setComposeKey((k) => k + 1); }}>
          New message
        </Button>
        {navItem('inbox', 'Inbox', Inbox, 1)}
        {navItem('sent', 'Sent', Send, sent.length)}
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="flex gap-1 border-b border-[var(--border)] p-2 sm:hidden">
          <Button variant="primary" icon={PenSquare} onClick={() => setFolder('compose')}>New</Button>
          <Button onClick={() => setFolder('inbox')}>Inbox</Button>
        </div>
        {folder === 'compose' && <Compose key={composeKey} initialSubject={SUBJECTS[compose] ?? ''} onSent={(m) => { setSent((s) => [m, ...s]); setFolder('sent'); }} />}
        {folder === 'inbox' && (
          <article className="p-5">
            <h1 className="text-lg font-semibold">{welcome.subject}</h1>
            <div className="mt-3 flex items-center gap-3">
              {profile.avatar && <img src={profile.avatar} alt="" className="h-9 w-9 rounded-full" />}
              <div className="text-[13px]">
                <p className="font-semibold">{welcome.from}</p>
                <p className="text-xs text-[var(--text-dim)]">to you · just now</p>
              </div>
            </div>
            <div className="selectable mt-4 space-y-3 text-[14px] leading-relaxed">
              {welcome.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="primary" icon={PenSquare} onClick={() => setFolder('compose')}>Reply</Button>
            </div>
          </article>
        )}
        {folder === 'sent' && (
          <div className="p-5">
            <h1 className="mb-3 text-lg font-semibold">Sent</h1>
            {sent.length === 0 ? (
              <p className="text-[13px] text-[var(--text-dim)]">Nothing sent yet.</p>
            ) : (
              sent.map((m) => (
                <Card key={m.at} className="mb-2 p-3 text-[13px]">
                  <p className="font-semibold">{m.subject || '(no subject)'}</p>
                  <p className="line-clamp-2 text-[var(--text-dim)]">{m.message}</p>
                </Card>
              ))
            )}
          </div>
        )}
      </main>

      <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-[var(--border)] p-3 lg:block">
        <ContactCards />
      </aside>
    </div>
  );
}
