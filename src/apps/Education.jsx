/** Education as "System Information": a category tree and an Item/Value table. */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Monitor, GraduationCap, BookOpen } from 'lucide-react';
import { useData } from '@/data/store.js';
import { formatDate } from './kit/format.js';

export default function Education() {
  const education = useData((s) => s.portfolio.education);
  const coursework = useData((s) => s.portfolio.coursework);
  const [sel, setSel] = useState('summary');
  const [open, setOpen] = useState({ edu: true, course: true });

  const totalCourses = coursework.reduce((n, g) => n + g.courses.length, 0);
  let rows;
  let heading;
  if (sel === 'summary') {
    heading = 'System Summary';
    const e = education[0];
    rows = [
      ['Institution', e?.institution],
      ['Degree', e?.degree],
      ['Duration', e?.duration],
      ['GPA', e?.gpa],
      ['Location', e?.location],
      ['Coursework categories', String(coursework.length)],
      ['Courses completed', String(totalCourses)],
    ].filter(([, v]) => v);
  } else if (sel.startsWith('edu:')) {
    const e = education.find((x) => x.id === sel.slice(4));
    heading = e.institution;
    rows = [
      ['Institution', e.institution],
      ['Degree', e.degree],
      ['Duration', e.duration],
      ['Start', formatDate(e.startDate)],
      ['End', formatDate(e.endDate)],
      ['GPA', e.gpa],
      ['Location', e.location],
    ].filter(([, v]) => v);
  } else {
    const g = coursework.find((x) => x.category === sel.slice(7));
    heading = `Coursework · ${g.label}`;
    rows = g.courses.map((c, i) => [`Course ${i + 1}`, c]);
  }

  const Node = ({ id, icon: Icon, label, depth = 0 }) => (
    <button
      onClick={() => setSel(id)}
      aria-current={sel === id ? 'true' : undefined}
      className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[13px] hover:bg-[var(--surface-hover)] ${sel === id ? 'bg-[var(--surface-hover)] font-medium' : ''}`}
      style={{ paddingLeft: 6 + depth * 16 }}
    >
      {Icon && <Icon size={14} className="shrink-0 text-[var(--text-dim)]" />}
      <span className="truncate">{label}</span>
    </button>
  );
  const Group = ({ k, label, icon: Icon, children }) => (
    <div>
      <button onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} className="flex w-full items-center gap-1 rounded px-1 py-1 text-left text-[13px] hover:bg-[var(--surface-hover)]" aria-expanded={open[k]}>
        {open[k] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Icon size={14} className="text-[var(--text-dim)]" />
        {label}
      </button>
      {open[k] && children}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-4 border-b border-[var(--border)] px-3 py-1 text-xs text-[var(--text-dim)]">
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Help</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="System information categories" className="w-56 shrink-0 overflow-y-auto border-r border-[var(--border)] p-1.5">
          <Node id="summary" icon={Monitor} label="System Summary" />
          <Group k="edu" label="Education" icon={GraduationCap}>
            {education.map((e) => (
              <Node key={e.id} id={`edu:${e.id}`} label={e.institution} depth={1} />
            ))}
          </Group>
          <Group k="course" label="Coursework" icon={BookOpen}>
            {coursework.map((g) => (
              <Node key={g.category} id={`course:${g.category}`} label={g.label} depth={1} />
            ))}
          </Group>
        </nav>
        <div className="min-w-0 flex-1 overflow-auto">
          <table className="selectable w-full text-left text-[13px]">
            <caption className="sr-only">{heading}</caption>
            <thead className="sticky top-0 bg-[var(--surface-solid)] text-xs text-[var(--text-dim)]">
              <tr>
                <th className="w-48 border-r border-[var(--border)] px-3 py-1.5 font-normal">Item</th>
                <th className="px-3 py-1.5 font-normal">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} className="border-t border-[var(--border)] hover:bg-[var(--surface-hover)]">
                  <td className="border-r border-[var(--border)] px-3 py-1.5 text-[var(--text-dim)]">{k}</td>
                  <td className="px-3 py-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="border-t border-[var(--border)] px-3 py-1 text-xs text-[var(--text-dim)]">{heading}</footer>
    </div>
  );
}
