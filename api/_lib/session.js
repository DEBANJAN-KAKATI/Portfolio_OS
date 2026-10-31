/**
 * Signed session cookie for Dev Mode (HMAC-SHA256 with SESSION_SECRET).
 * httpOnly, SameSite=Strict, Secure (except plain-http local dev), 12 h.
 * Every write also needs X-CSRF-Token (derived from the session) and a
 * same-origin request.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpError, isSameOrigin } from './http.js';

const COOKIE = 'pf_session';
const TTL_SECONDS = 12 * 60 * 60;

function secret() {
  const s = process.env.SESSION_SECRET ?? '';
  if (s.length < 32) throw new HttpError(503, 'Dev Mode is not configured (SESSION_SECRET).');
  return s;
}

const mac = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Plain-http localhost can't keep Secure cookies in every browser. */
const secureCookies = () => process.env.DEVMODE_INSECURE_COOKIE !== '1';

export function createSession() {
  const session = { sid: randomUUID(), exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(session)).toString('base64url');
  const cookie = [`${COOKIE}=${data}.${mac(data)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${TTL_SECONDS}`, secureCookies() ? 'Secure' : ''].filter(Boolean).join('; ');
  return { session, cookie };
}

export function clearCookie() {
  return [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0', secureCookies() ? 'Secure' : ''].filter(Boolean).join('; ');
}

export const csrfFor = (session) => mac(`csrf:${session.sid}`);

export function readSession(req) {
  const raw = String(req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const value = raw.slice(COOKIE.length + 1);
  const [data, sig] = value.split('.');
  if (!data || !sig || !safeEqual(sig, mac(data))) return null;
  try {
    const session = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!session?.sid || typeof session.exp !== 'number' || session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Throws 401/403 unless the request carries a valid session (and CSRF token for writes). */
export function requireSession(req, { write = true } = {}) {
  const session = readSession(req);
  if (!session) throw new HttpError(401, 'Not signed in to Dev Mode.');
  if (write) {
    if (!isSameOrigin(req)) throw new HttpError(403, 'Cross-site request blocked.');
    if (!safeEqual(req.headers['x-csrf-token'] ?? '', csrfFor(session))) throw new HttpError(403, 'Missing or invalid CSRF token.');
  }
  return session;
}
