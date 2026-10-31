/**
 * GET /api/auth/session: is this browser in Dev Mode? Returns the CSRF token
 * for writes, plus which storage the server will use.
 */
import { route, send } from '../_lib/http.js';
import { readSession, csrfFor } from '../_lib/session.js';
import { isLocalMode } from '../_lib/repo.js';
import config from '../../portfolio.config.js';

export default route(['GET'], async (req, res) => {
  const configured = Boolean(process.env.DEV_MODE_PASSWORD_HASH && (process.env.SESSION_SECRET ?? '').length >= 32);
  const session = configured ? readSession(req) : null;
  if (!session) return send(res, 200, { authenticated: false, configured });
  const local = isLocalMode();
  send(res, 200, {
    authenticated: true,
    csrf: csrfFor(session),
    expiresAt: session.exp * 1000,
    target: local ? 'local' : process.env.GITHUB_WRITE_TOKEN ? 'github' : 'none',
    reviewMode: config.sync.reviewMode,
    largeMedia: process.env.BLOB_READ_WRITE_TOKEN && !local ? 'vercel-blob' : local ? 'repo' : 'none',
  });
});
