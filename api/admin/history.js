/**
 * GET /api/admin/history?path=content/media.json        → recent commits touching the file
 * GET /api/admin/history?path=…&ref=<sha>               → the file's content at that commit
 * Used by Properties → Version history to restore an earlier version of an item.
 */
import { route, send, query, HttpError } from '../_lib/http.js';
import { requireSession } from '../_lib/session.js';
import { JSON_FILES, INBOX_PATH } from '../_lib/files.js';
import { getRepo } from '../_lib/repo.js';

export default route(['GET'], async (req, res) => {
  requireSession(req, { write: false });
  const q = query(req);
  const path = q.get('path');
  if (!(path in JSON_FILES) && path !== INBOX_PATH && path !== 'src/data/generated/portfolio.json') throw new HttpError(400, 'Unknown file.');
  const repo = getRepo();
  const ref = q.get('ref');
  if (ref) {
    if (!/^[a-f0-9]{7,40}$/.test(ref)) throw new HttpError(400, 'Bad commit id.');
    const text = await repo.readAt(path, ref);
    if (text == null) throw new HttpError(404, 'That version was not found.');
    return send(res, 200, { path, ref, content: JSON.parse(text) });
  }
  send(res, 200, { path, commits: await repo.history(path) });
});
