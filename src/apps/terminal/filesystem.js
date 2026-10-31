/**
 * A read-only fake file system that mirrors the portfolio data, for dir/cd/tree/type.
 * Folders are { type: 'dir', children: { name: node } }, files { type: 'file', content: () => string[] }.
 */
import { stripTags } from '@/data/sanitize.js';
import { selectProjects } from '@/data/store.js';
import { displayName } from '@/os/lib/format.js';
import { scoreLabel } from '../kit/format.js';

const dir = (children) => ({ type: 'dir', children });
const file = (content) => ({ type: 'file', content });
const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);

export const HOME = ['C:', 'Users', 'Guest'];

export function buildFileSystem(state) {
  const p = state.portfolio;
  const extras = state.extras;
  const name = displayName(p.profile.name);

  const projects = Object.fromEntries(
    selectProjects(state).map((pr) => [
      `${safeName(pr.title)}.md`,
      file(() => [
        `# ${pr.title}`,
        pr.context.replace(/\s*\|\s*GitHub:.*$/, ''),
        '',
        ...pr.bullets[3].map((b) => `- ${stripTags(b)}`),
        '',
        pr.tech.length ? `Tech: ${pr.tech.join(', ')}` : '',
        pr.github ? `GitHub: ${pr.github.url}` : 'GitHub: not published yet',
      ]),
    ]),
  );
  const experience = Object.fromEntries(
    p.experiences.map((e) => [
      `${safeName(e.company)}.txt`,
      file(() => [`${e.role} @ ${e.company}`, `${e.duration}${e.location ? ` · ${e.location}` : ''}`, '', ...e.bullets[3].map((b) => `- ${stripTags(b)}`)]),
    ]),
  );
  const skills = Object.fromEntries(p.skills.map((g) => [`${safeName(g.label)}.txt`, file(() => g.skills.map((s) => `${s.name.padEnd(42)} ${String(s.usage).padStart(3)}%`))]));
  const education = Object.fromEntries(
    p.education.map((e) => [`${safeName(e.institution)}${p.education.filter((x) => x.institution === e.institution).length > 1 ? ` - ${safeName(e.degree)}` : ''}.txt`, file(() => [e.institution, e.degree, e.duration, e.gpa ? `${scoreLabel(e.gpa)} ${e.gpa}` : ''].filter(Boolean))]),
  );
  const achievements = Object.fromEntries(p.achievements.map((a) => [`${safeName(a.title)}.txt`, file(() => [`[${a.label}] ${a.title}`, stripTags(a.details)])]));
  const hobbies = Object.fromEntries(extras.hobbies.filter((h) => !h.hidden).map((h) => [`${safeName(h.name)}.txt`, file(() => [`${h.icon} ${h.name}`, h.blurb, h.funFact ? `Fun fact: ${h.funFact}` : ''].filter(Boolean))]));

  return dir({
    Users: dir({
      Guest: dir({
        Projects: dir(projects),
        Experience: dir(experience),
        Skills: dir(skills),
        Education: dir(education),
        Achievements: dir(achievements),
        Hobbies: dir(hobbies),
        'About.txt': file(() => [name, extras.tagline, '', extras.intro]),
        'Contact.txt': file(() => [p.profile.linkedin && `LinkedIn: ${p.profile.linkedin}`, p.profile.github && `GitHub:   ${p.profile.github}`, p.profile.email && `Email:    ${p.profile.email}`, '', 'Or run: open mail'].filter((x) => x !== null && x !== undefined && x !== false)),
        'Resume.pdf': file(() => ['%PDF-1.4 … (binary). Run "resume" to download it.']),
      }),
    }),
    Windows: dir({ System32: dir({ 'definitely-not-important.dll': file(() => ['Nice try.']) }) }),
  });
}

/** Resolve a path (absolute "C:\…", relative, "..", ".") against cwd segments. */
export function resolvePath(cwd, input) {
  if (!input) return [...cwd];
  let segs = input.replace(/"/g, '').replace(/\//g, '\\').trim();
  let out;
  if (/^[a-z]:/i.test(segs)) {
    out = ['C:'];
    segs = segs.slice(2);
  } else if (segs.startsWith('\\')) {
    out = ['C:'];
  } else out = [...cwd];
  for (const part of segs.split('\\').filter(Boolean)) {
    if (part === '.') continue;
    if (part === '..') {
      if (out.length > 1) out.pop();
    } else out.push(part);
  }
  return out;
}

/** Case-insensitive lookup like Windows. Returns { node, path } with the real casing, or null. */
export function lookup(root, segs) {
  let node = root;
  const path = ['C:'];
  for (const seg of segs.slice(1)) {
    if (node.type !== 'dir') return null;
    const key = Object.keys(node.children).find((k) => k.toLowerCase() === seg.toLowerCase());
    if (!key) return null;
    node = node.children[key];
    path.push(key);
  }
  return { node, path };
}

export const formatPath = (segs) => (segs.length === 1 ? 'C:\\' : segs.join('\\'));
