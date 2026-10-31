/**
 * POST /api/admin/publish
 * {
 *   message, mode: 'commit' | 'pr',
 *   documents: { 'content/extras.json': '<json text>', … },   // validated with zod
 *   inboxOps:  [ { op, section, id, data, base_updated_at, edited_at } ],  // merged into data/vault.inbox.json
 *   media:     { 'public/media/photos/x.webp': '<ref from /api/admin/upload>' },
 *   deletes:   [ 'public/media/…' ]
 * }
 * Everything lands in one commit (or one pull request).
 */
import { route, send, readJson, ipTag, HttpError } from '../_lib/http.js';
import { requireSession } from '../_lib/session.js';
import { hit } from '../_lib/ratelimit.js';
import { assertMediaPath, checkJson, mergeInbox, INBOX_PATH } from '../_lib/files.js';
import { getRepo } from '../_lib/repo.js';
import config from '../../portfolio.config.js';

export default route(['POST'], async (req, res) => {
  requireSession(req);
  const rl = await hit(`publish:${ipTag(req)}`, 30, 600);
  if (rl.limited) throw new HttpError(429, 'Too many publishes. Wait a few minutes.');

  const body = await readJson(req, 4 * 1024 * 1024);
  const repo = getRepo();
  const texts = {};
  for (const [path, text] of Object.entries(body.documents ?? {})) {
    if (typeof text !== 'string') throw new HttpError(400, `${path}: expected JSON text.`);
    texts[path] = checkJson(path, text);
  }
  if (Array.isArray(body.inboxOps) && body.inboxOps.length) {
    texts[INBOX_PATH] = mergeInbox(await repo.readText(INBOX_PATH), body.inboxOps);
  }
  const media = {};
  for (const [path, ref] of Object.entries(body.media ?? {})) {
    assertMediaPath(path);
    if (typeof ref !== 'string' || !/^(sha:[a-f0-9]{40}|local:[a-f0-9]{64})$/.test(ref)) throw new HttpError(400, `Bad upload reference for ${path}.`);
    media[path] = ref;
  }
  const deletes = (body.deletes ?? []).map(assertMediaPath);
  if (!Object.keys(texts).length && !Object.keys(media).length && !deletes.length) throw new HttpError(400, 'Nothing to publish.');

  const mode = body.mode === 'pr' || (body.mode == null && config.sync.reviewMode === 'pr') ? 'pr' : 'commit';
  const message = String(body.message || 'Update portfolio from Dev Mode').slice(0, 200);
  const result = await repo.commit({ texts, blobs: media, deletes, message, mode });
  console.info(`[publish] ${repo.mode} ${mode} files=${Object.keys(texts).length + Object.keys(media).length} deletes=${deletes.length}`);
  // Local mode: regenerate portfolio.json right away (on GitHub the sync Action does this).
  if (repo.mode === 'local' && (texts[INBOX_PATH] || texts['data/vault.public.json'])) {
    const { buildData } = await import('../../scripts/build-data.mjs');
    await buildData();
  }
  send(res, 200, { ok: true, target: repo.mode, mode, ...result, files: [...Object.keys(texts), ...Object.keys(media)] });
});
