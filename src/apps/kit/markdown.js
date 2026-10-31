import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Links in posts open in a new tab and never get access to window.opener.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Markdown -> sanitized HTML (scripts, event handlers, iframes and styles are stripped). */
export function renderMarkdown(md = '') {
  const html = marked.parse(md, { gfm: true, breaks: false });
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'iframe', 'form', 'input'], FORBID_ATTR: ['style'] });
}
