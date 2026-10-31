/** POST /api/admin/sync: runs the GitHub Action "sync" now (workflow_dispatch). */
import { route, send } from '../_lib/http.js';
import { requireSession } from '../_lib/session.js';
import { getRepo } from '../_lib/repo.js';

export default route(['POST'], async (req, res) => {
  requireSession(req);
  await getRepo().dispatchSync();
  send(res, 200, { ok: true });
});
