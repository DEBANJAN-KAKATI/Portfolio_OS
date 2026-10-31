import { humanizeKey } from '@/data/adapters/jstmyrb.js';

const TAG_LABELS = { sde: 'SDE', quant: 'Quant', finance: 'Finance', chemical: 'Chemical', product: 'Product', systems: 'Systems' };

export const tagLabel = (tag) => TAG_LABELS[tag] ?? humanizeKey(tag);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-05" -> "May 2024", "2024" -> "2024", ISO -> "12 Oct 2026" */
export function formatDate(value) {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  if (/^\d{4}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d) ? value : d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(iso) {
  if (!iso) return '';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} month${days >= 45 ? 's' : ''} ago`;
  return `${Math.round(days / 365)} year${days >= 548 ? 's' : ''} ago`;
}

// GitHub linguist colours for the languages that appear in the repos.
const LANG_COLORS = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c', 'Jupyter Notebook': '#DA5B0B',
  MATLAB: '#e16737', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Rust: '#dea584', Go: '#00ADD8', Shell: '#89e051',
  Batchfile: '#C1F12E', PowerShell: '#012456', Dockerfile: '#384d54', Mako: '#7e858d', R: '#198CE7',
};
export const langColor = (lang) => LANG_COLORS[lang] ?? '#8b949e';

/** Stable pseudo-random number in [0,1) from a string (for generated thumbnails). */
export function hashUnit(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}
