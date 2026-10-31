/**
 * Environment-neutral sanitizing (runs in Node during sync and in the browser).
 * Vault bullets may only keep <b>…</b>; everything else is escaped. Components
 * additionally pass the result through DOMPurify (see src/data/safeHtml.js).
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Keep only bare <b> / </b> (also accepts <strong>), escape the rest, balance stray tags. */
export function sanitizeInline(html) {
  const marked = String(html ?? '')
    .replace(/<\s*(b|strong)\s*>/gi, '\u0001')
    .replace(/<\s*\/\s*(b|strong)\s*>/gi, '\u0002');
  let open = 0;
  let out = '';
  for (const ch of escapeHtml(marked)) {
    if (ch === '\u0001') {
      if (open === 0) out += '<b>';
      open++;
    } else if (ch === '\u0002') {
      if (open === 1) out += '</b>';
      if (open > 0) open--;
    } else {
      out += ch;
    }
  }
  if (open > 0) out += '</b>';
  return out;
}

export function stripTags(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Text inside <b> tags, e.g. ["Python", "65%", "FastAPI"]. */
export function boldSegments(html) {
  return [...String(html ?? '').matchAll(/<b>(.*?)<\/b>/gi)].map((m) => stripTags(m[1]).trim()).filter(Boolean);
}
