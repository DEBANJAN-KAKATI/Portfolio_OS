/**
 * Recruiter Mode: the same synced data as one clean, printable page, for
 * anyone who wants the facts in ten seconds instead of exploring the OS.
 */
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { X, Printer, Download, MapPin, Globe, Mail, FileText } from 'lucide-react';
import { useData, selectProjects } from '@/data/store.js';
import { safeHtml } from '@/data/safeHtml.js';
import { displayName } from './lib/format.js';
import { scoreLabel } from '@/apps/kit/format.js';
import { GithubGlyph } from './ui/AppIcon.jsx';
import { useWindows } from './store/windows.js';

export const useRecruiter = create((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const PROJECT_LIMIT = 10;

function Heading({ children }) {
  return <h2 className="mb-2 mt-6 border-b border-neutral-300 pb-1 text-[13px] font-bold uppercase tracking-wider text-neutral-500">{children}</h2>;
}

function Html({ html, as: Tag = 'span', className }) {
  return <Tag className={className} dangerouslySetInnerHTML={safeHtml(html)} />;
}

function Page() {
  const p = useData((s) => s.portfolio);
  const extras = useData((s) => s.extras);
  const projects = useData(useShallow((s) => selectProjects(s)));
  const name = displayName(p.profile.name);
  const contacts = [
    p.profile.location && [MapPin, p.profile.location],
    p.profile.email && [Mail, p.profile.email, `mailto:${p.profile.email}`],
    p.profile.linkedin && [Globe, 'LinkedIn', p.profile.linkedin],
    p.profile.github && [() => <GithubGlyph size={12} />, p.profile.github.replace('https://', ''), p.profile.github],
  ].filter(Boolean);

  return (
    <article id="recruiter-print" className="selectable mx-auto max-w-[820px] bg-white px-10 py-10 text-[13px] leading-relaxed text-neutral-900 shadow-2xl print:max-w-none print:px-0 print:py-0 print:shadow-none">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <p className="text-base text-neutral-600">{extras.tagline}</p>
        </div>
      </header>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        {contacts.map(([Icon, label, href]) => (
          <li key={label} className="flex items-center gap-1">
            <Icon size={12} />
            {href ? <a href={href} target="_blank" rel="noreferrer" className="underline decoration-neutral-300 hover:decoration-neutral-700">{label}</a> : label}
          </li>
        ))}
      </ul>
      <p className="mt-4">{extras.intro}</p>

      {p.experiences.length > 0 && (
        <>
          <Heading>Experience</Heading>
          {p.experiences.map((e) => (
            <section key={e.id} className="mb-3 break-inside-avoid">
              <div className="flex flex-wrap justify-between gap-2">
                <p><b>{e.role}</b> · {e.company}</p>
                <p className="text-xs text-neutral-500">{e.duration}{e.location && ` · ${e.location}`}</p>
              </div>
              <ul className="ml-5 list-disc">
                {e.bullets[3].map((b, i) => <Html key={i} as="li" html={b} />)}
              </ul>
            </section>
          ))}
        </>
      )}

      <Heading>Selected projects</Heading>
      {projects.slice(0, PROJECT_LIMIT).map((pr) => (
        <section key={pr.id} className="mb-3 break-inside-avoid">
          <div className="flex flex-wrap justify-between gap-2">
            <p>
              <b>{pr.title}</b>
              {pr.context && <span className="text-neutral-500"> · {pr.context.replace(/\s*\|\s*GitHub:.*$/, '')}</span>}
            </p>
            {pr.github && <a href={pr.github.url} target="_blank" rel="noreferrer" className="text-xs text-neutral-500 underline">{pr.github.url.replace('https://github.com/', '')}</a>}
          </div>
          <ul className="ml-5 list-disc">
            {pr.bullets[2].map((b, i) => <Html key={i} as="li" html={b} />)}
          </ul>
        </section>
      ))}
      {projects.length > PROJECT_LIMIT && <p className="text-xs text-neutral-500">+ {projects.length - PROJECT_LIMIT} more projects in the Projects app.</p>}

      <Heading>Skills</Heading>
      <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-1">
        {p.skills.map((g) => (
          <div key={g.category} className="contents">
            <dt className="font-semibold">{g.label}</dt>
            <dd>{g.skills.map((s) => s.name).join(', ')}</dd>
          </div>
        ))}
      </dl>

      {p.education.length > 0 && (
        <>
          <Heading>Education</Heading>
          {p.education.map((e) => (
            <div key={e.id} className="flex flex-wrap justify-between gap-2">
              <p><b>{e.institution}</b> · {e.degree}{e.gpa && ` · ${scoreLabel(e.gpa)} ${e.gpa}`}</p>
              <p className="text-xs text-neutral-500">{e.duration}</p>
            </div>
          ))}
        </>
      )}

      {p.achievements.length > 0 && (
        <>
          <Heading>Achievements</Heading>
          <ul className="ml-5 list-disc">
            {p.achievements.map((a) => (
              <li key={a.id}>
                <b>{a.title}</b>
                {a.details && <> — <Html html={a.details} /></>}
              </li>
            ))}
          </ul>
        </>
      )}
      {extras.openToWork.enabled && <p className="mt-8 text-center text-[13px] text-neutral-600">{extras.openToWork.text}</p>}
      <p className="mt-4 text-center text-[11px] text-neutral-400">Generated from the same data as the interactive portfolio · {new Date(p.meta.generatedAt).toLocaleDateString()}</p>
    </article>
  );
}

export default function RecruiterMode() {
  const { open, setOpen } = useRecruiter();
  const resume = useData((s) => s.extras.resume);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // Portal to <body> so print CSS can hide the rest of the OS.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          id="recruiter-overlay"
          role="dialog"
          aria-label="One-page view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85000] overflow-y-auto bg-neutral-200 print:static print:overflow-visible print:bg-white"
        >
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-neutral-900/90 px-4 py-2 text-white backdrop-blur print:hidden">
            <FileText size={16} />
            <span className="text-sm font-semibold">One-page view</span>
            <span className="hidden text-xs text-white/60 sm:inline">· everything on one page</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"><Printer size={14} /> Print / PDF</button>
              <a href={resume.url} download={resume.fileName} className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"><Download size={14} /> Resume</a>
              <button
                onClick={() => {
                  setOpen(false);
                  useWindows.getState().open('mail', { props: { compose: 'hello' } });
                }}
                className="flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-[var(--accent-text)]"
              >
                <Mail size={14} /> Contact
              </button>
              <button aria-label="Close one-page view" onClick={() => setOpen(false)} className="rounded-md p-1.5 hover:bg-white/20"><X size={16} /></button>
            </div>
          </div>
          <div className="px-3 py-6 print:p-0">
            <Page />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * The always-visible entry point on the desktop. It lives in the desktop layer
 * (below windows) so it never covers window controls; Start has a copy too.
 */
export function RecruiterButton() {
  const setOpen = useRecruiter((s) => s.setOpen);
  return (
    <motion.button
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => setOpen(true)}
      className="acrylic absolute right-4 top-4 z-[5] flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 text-[13px] font-medium shadow-lg"
      title="See everything on one clean, printable page"
    >
      <FileText size={16} style={{ color: 'var(--accent)' }} /> One-page view
    </motion.button>
  );
}
