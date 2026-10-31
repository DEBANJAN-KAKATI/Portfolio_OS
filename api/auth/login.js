/**
 * POST /api/auth/login  { password }
 * Compared in constant time against DEV_MODE_PASSWORD_HASH (scrypt). At most
 * 5 attempts per IP per 15 minutes; failures are logged with a hashed IP tag.
 */
import { route, send, readJson, isSameOrigin, ipTag, HttpError } from '../_lib/http.js';
import { verifyPassword } from '../_lib/password.js';
import { createSession, csrfFor } from '../_lib/session.js';
import { hit } from '../_lib/ratelimit.js';

const MAX_ATTEMPTS = 5;
const WINDOW = 15 * 60;

export default route(['POST'], async (req, res) => {
  if (!isSameOrigin(req)) throw new HttpError(403, 'Cross-site request blocked.');
  const hash = process.env.DEV_MODE_PASSWORD_HASH;
  if (!hash || !process.env.SESSION_SECRET) throw new HttpError(503, 'Dev Mode is not configured.');

  const tag = ipTag(req);
  const limit = await hit(`login:${tag}`, MAX_ATTEMPTS, WINDOW);
  if (limit.limited) {
    console.warn(`[auth] login locked out ip=${tag} attempts=${limit.count}`);
    return send(res, 429, { error: 'Too many attempts. Try again later.', retryAfter: limit.retryAfter }, { 'Retry-After': String(limit.retryAfter) });
  }

  const { password } = await readJson(req, 4096);
  const ok = typeof password === 'string' && password.length <= 256 && (await verifyPassword(password, hash));
  if (!ok) {
    console.warn(`[auth] failed login ip=${tag} attempt=${limit.count}/${MAX_ATTEMPTS}`);
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
    return send(res, 401, { error: 'Sorry, try again.', attemptsLeft: Math.max(0, MAX_ATTEMPTS - limit.count) });
  }

  const { session, cookie } = createSession();
  console.info(`[auth] dev mode login ip=${tag}`);
  send(res, 200, { ok: true, csrf: csrfFor(session), expiresAt: session.exp * 1000 }, { 'Set-Cookie': cookie });
});
