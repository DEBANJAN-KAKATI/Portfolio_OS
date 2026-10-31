/** POST /api/auth/logout: drops the session cookie. */
import { route, send, isSameOrigin, HttpError } from '../_lib/http.js';
import { clearCookie } from '../_lib/session.js';

export default route(['POST'], async (req, res) => {
  if (!isSameOrigin(req)) throw new HttpError(403, 'Cross-site request blocked.');
  send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
});
