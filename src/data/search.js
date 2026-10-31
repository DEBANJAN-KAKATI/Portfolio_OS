/**
 * Start-menu / taskbar search. Typing "react" finds every project, experience
 * and skill that mentions React, plus matching apps.
 */
import { stripTags } from './sanitize.js';
import { selectProjects } from './store.js';

const norm = (s) => String(s ?? '').toLowerCase();

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word hits ("React") rank well above word-prefix hits ("Reactor").
function score(query, fields) {
  const word = new RegExp(`(^|[^a-z0-9])${escapeRx(query)}($|[^a-z0-9])`);
  const prefix = new RegExp(`(^|[^a-z0-9])${escapeRx(query)}`);
  let best = 0;
  for (const [text, weight] of fields) {
    const t = norm(text);
    if (!t) continue;
    if (t === query) best = Math.max(best, 100 * weight);
    else if (word.test(t)) best = Math.max(best, 60 * weight);
    else if (prefix.test(t)) best = Math.max(best, 20 * weight);
    else if (t.includes(query)) best = Math.max(best, 10 * weight);
  }
  return best;
}

/**
 * @param {object} state  useData.getState()
 * @param {Array<{id:string,title:string,keywords?:string[]}>} apps  app registry entries
 */
export function buildSearchIndex(state, apps = []) {
  const docs = [];
  for (const a of apps) docs.push({ kind: 'app', id: a.id, title: a.title, subtitle: 'App', fields: [[a.title, 1.2], [(a.keywords ?? []).join(' '), 0.8]] });
  for (const p of selectProjects(state)) {
    const bullets = stripTags(p.bullets[3].join(' '));
    docs.push({
      kind: 'project',
      id: p.id,
      title: p.title,
      subtitle: p.context || 'Project',
      fields: [[p.title, 1.1], [p.tech.join(' '), 1], [p.tags.join(' '), 0.9], [(p.github?.topics ?? []).join(' '), 0.9], [Object.keys(p.github?.languages ?? {}).join(' '), 0.8], [bullets, 0.6], [p.description, 0.6]],
    });
  }
  for (const e of state.portfolio.experiences.filter((x) => !x.hidden)) {
    docs.push({
      kind: 'experience',
      id: e.id,
      title: `${e.role} · ${e.company}`,
      subtitle: e.duration,
      fields: [[e.company, 1.1], [e.role, 1], [e.tech.join(' '), 1], [e.tags.join(' '), 0.8], [stripTags(e.bullets[3].join(' ')), 0.6]],
    });
  }
  for (const g of state.portfolio.skills) {
    for (const s of g.skills) docs.push({ kind: 'skill', id: `${g.category}:${s.name}`, title: s.name, subtitle: g.label, fields: [[s.name, 1.2], [g.label, 0.5]] });
  }
  for (const w of state.extras.casualWorks.filter((x) => !x.hidden)) {
    docs.push({ kind: 'casual', id: w.id, title: w.title, subtitle: 'Casual work', fields: [[w.title, 1], [w.description, 0.6]] });
  }
  return docs;
}

export function search(index, rawQuery, limit = 20) {
  const query = norm(rawQuery).trim();
  if (!query) return [];
  return index
    .map((doc) => ({ doc, s: score(query, doc.fields) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ doc, s }) => ({ kind: doc.kind, id: doc.id, title: doc.title, subtitle: doc.subtitle, score: s }));
}
