// Browser-only: render-time defence in depth for vault text (only <b> survives).
import DOMPurify from 'dompurify';

export function safeHtml(html) {
  return { __html: DOMPurify.sanitize(String(html ?? ''), { ALLOWED_TAGS: ['b'], ALLOWED_ATTR: [] }) };
}
