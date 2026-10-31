/**
 * POST /api/admin/upload  { path, dataBase64 }
 * Stores one media file for the next publish and returns a reference to it.
 * Type is checked from the bytes, size is capped, photo metadata (GPS) is removed.
 * Requests are limited to ~4.5 MB on Vercel; larger videos/models go to Blob storage
 * through /api/admin/upload-token instead.
 */
import { route, send, readJson, ipTag, HttpError } from '../_lib/http.js';
import { requireSession } from '../_lib/session.js';
import { hit } from '../_lib/ratelimit.js';
import { checkMedia } from '../_lib/files.js';
import { getRepo, isLocalMode } from '../_lib/repo.js';

export default route(['POST'], async (req, res) => {
  requireSession(req);
  const rl = await hit(`write:${ipTag(req)}`, 300, 600);
  if (rl.limited) throw new HttpError(429, 'Too many uploads. Wait a few minutes.');

  const local = isLocalMode();
  const { path, dataBase64 } = await readJson(req, local ? 300 * 1024 * 1024 : 6 * 1024 * 1024);
  if (typeof dataBase64 !== 'string') throw new HttpError(400, 'Missing file data.');
  const { bytes, type, kind } = checkMedia(path, Buffer.from(dataBase64, 'base64'));
  const ref = await getRepo().putBlob(bytes);
  send(res, 200, { ref, path, type, kind, size: bytes.length });
});
