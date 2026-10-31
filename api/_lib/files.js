/**
 * What Dev Mode may write, and checks on every file before it is committed:
 *  - JSON documents are validated with the same zod schemas the site uses
 *  - media paths are allow-listed; file type is sniffed from the bytes, not the name
 *  - GPS/EXIF metadata is stripped from photos; markdown is sanitized
 */
import { Extras, Media, Layout, Trash } from '../../src/data/schemas/content.js';
import { VaultInbox, Vault } from '../../src/data/schemas/vault.js';
import { toPublicVault, parseVault } from '../../src/data/adapters/jstmyrb.js';
import config from '../../portfolio.config.js';
import { HttpError } from './http.js';

export const JSON_FILES = {
  'content/extras.json': Extras,
  'content/media.json': Media,
  'content/layout.json': Layout,
  'content/trash.json': Trash,
  'data/vault.public.json': Vault,
};
export const INBOX_PATH = 'data/vault.inbox.json';

const MEDIA_RX = /^public\/media\/(photos|projects|hobbies|wallpapers|casual|achievements|renders|docs|videos|models|thumbs|avatar)\/[a-z0-9][a-z0-9._-]{0,120}\.(webp|png|jpe?g|gif|pdf|mp4|webm|glb)$/;
const RESUME_PATH = 'public/resume.pdf';
const TRASH_DAYS = 30;

const MB = 1024 * 1024;
export const LIMITS = { image: config.devMode.maxImageBytes ?? 5 * MB, pdf: 10 * MB, video: 200 * MB, model: 100 * MB };

const KIND = { webp: 'image', png: 'image', jpeg: 'image', gif: 'image', pdf: 'pdf', mp4: 'video', webm: 'video', glb: 'model' };
const EXT_TYPES = { webp: ['webp'], png: ['png'], jpg: ['jpeg'], jpeg: ['jpeg'], gif: ['gif'], pdf: ['pdf'], mp4: ['mp4'], webm: ['webm'], glb: ['glb'] };

export function assertMediaPath(path) {
  if (typeof path !== 'string' || path.includes('..') || path.includes('\\') || !(MEDIA_RX.test(path) || path === RESUME_PATH)) {
    throw new HttpError(400, `Path not allowed: ${String(path).slice(0, 120)}`);
  }
  return path;
}

/** Identify a file from its first bytes. */
export function sniff(buf) {
  const ascii = (start, len) => buf.subarray(start, start + len).toString('latin1');
  if (buf.length < 12) return null;
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (buf[0] === 0x89 && ascii(1, 3) === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (ascii(0, 4) === 'GIF8') return 'gif';
  if (ascii(0, 5) === '%PDF-') return 'pdf';
  if (ascii(4, 4) === 'ftyp') return 'mp4';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (ascii(0, 4) === 'glTF') return 'glb';
  return null;
}

/** Remove EXIF (which carries GPS) from JPEG (APP1 "Exif"), PNG (eXIf) and WebP (EXIF chunk). */
export function stripMetadata(buf, type) {
  if (type === 'jpeg') {
    const out = [buf.subarray(0, 2)];
    let i = 2;
    while (i + 4 <= buf.length && buf[i] === 0xff) {
      const marker = buf[i + 1];
      if (marker === 0xda || marker === 0xd9) break; // start of scan: rest is image data
      const len = buf.readUInt16BE(i + 2);
      const isExif = marker === 0xe1 && buf.subarray(i + 4, i + 10).toString('latin1') === 'Exif\0\0';
      if (!isExif) out.push(buf.subarray(i, i + 2 + len));
      i += 2 + len;
    }
    out.push(buf.subarray(i));
    return Buffer.concat(out);
  }
  if (type === 'png') {
    const out = [buf.subarray(0, 8)];
    let i = 8;
    while (i + 12 <= buf.length) {
      const len = buf.readUInt32BE(i);
      const kind = buf.subarray(i + 4, i + 8).toString('latin1');
      const end = i + 12 + len;
      if (kind !== 'eXIf') out.push(buf.subarray(i, end));
      i = end;
    }
    return Buffer.concat(out);
  }
  if (type === 'webp') {
    const chunks = [];
    let i = 12;
    while (i + 8 <= buf.length) {
      const kind = buf.subarray(i, i + 4).toString('latin1');
      const len = buf.readUInt32LE(i + 4);
      const end = i + 8 + len + (len % 2);
      if (kind !== 'EXIF') chunks.push(Buffer.from(buf.subarray(i, end)));
      i = end;
    }
    const vp8x = chunks.find((c) => c.subarray(0, 4).toString('latin1') === 'VP8X');
    if (vp8x) vp8x[8] &= ~0x08; // clear the "has EXIF" flag
    const body = Buffer.concat(chunks);
    const header = Buffer.from('RIFF0000WEBP', 'latin1');
    header.writeUInt32LE(body.length + 4, 4);
    return Buffer.concat([header, body]);
  }
  return buf;
}

/** Validate a binary upload for `path`; returns the cleaned bytes. */
export function checkMedia(path, buf, { maxOverride } = {}) {
  assertMediaPath(path);
  const type = sniff(buf);
  const ext = path.split('.').pop().toLowerCase();
  if (!type || !EXT_TYPES[ext]?.includes(type)) throw new HttpError(415, `File content doesn't match ${ext} (looks like ${type ?? 'unknown'}).`);
  const kind = KIND[type];
  const limit = maxOverride ?? LIMITS[kind];
  if (buf.length > limit) throw new HttpError(413, `${kind} is larger than ${Math.round(limit / MB)} MB.`);
  return { bytes: kind === 'image' ? stripMetadata(buf, type) : buf, type, kind };
}

/** Defence in depth for markdown (the browser also sanitizes when rendering). */
export function sanitizeMarkdown(md) {
  return String(md ?? '')
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, '$1=$2#$2')
    .replace(/\]\(\s*(javascript|vbscript|data):[^)]*\)/gi, '](#)');
}

/** Parse + validate a JSON document; returns pretty-printed text to commit. */
export function checkJson(path, text) {
  const schema = JSON_FILES[path];
  if (!schema) throw new HttpError(400, `Path not allowed: ${path}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, `${path} is not valid JSON.`);
  }
  if (path === 'content/extras.json' && Array.isArray(data.casualWorks)) {
    data.casualWorks = data.casualWorks.map((w) => (w && typeof w.body === 'string' ? { ...w, body: sanitizeMarkdown(w.body) } : w));
  }
  if (path === 'content/trash.json' && Array.isArray(data.items)) {
    const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
    data.items = data.items.filter((i) => Date.parse(i?.deletedAt) > cutoff);
  }
  if (path === 'data/vault.public.json') {
    // Only the public allow-list may be committed, whatever was uploaded.
    try {
      data = { ...toPublicVault(parseVault(data), config.privacy), meta: { ...(data.meta ?? {}), source: 'jstMyRB' } };
    } catch (err) {
      throw new HttpError(400, err.message.slice(0, 500));
    }
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new HttpError(400, `${path} failed validation`, { issues });
  }
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Merge staged inbox operations into the current data/vault.inbox.json (one entry per section+id). */
export function mergeInbox(currentText, ops) {
  let current = { version: 1, items: [] };
  if (currentText) {
    try {
      current = JSON.parse(currentText);
    } catch {
      /* start fresh */
    }
  }
  const items = [...(current.items ?? [])];
  for (const op of ops) {
    const idx = items.findIndex((i) => i.section === op.section && i.id === op.id);
    if (idx >= 0) {
      // An add followed by edits stays an "add"; an add followed by delete disappears.
      if (items[idx].op === 'add' && op.op === 'delete') items.splice(idx, 1);
      else items[idx] = items[idx].op === 'add' && op.op === 'edit' ? { ...op, op: 'add' } : op;
    } else items.push(op);
  }
  const next = { version: 1, items };
  const result = VaultInbox.safeParse(next);
  if (!result.success) throw new HttpError(400, 'Inbox changes failed validation', { issues: result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) });
  return `${JSON.stringify(result.data, null, 2)}\n`;
}
