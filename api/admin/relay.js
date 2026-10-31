/**
 * POST /api/admin/relay  { url, method?, headers?, body? }
 * Dev Mode only: performs the request from the server for the Browser app's
 * Relay mode. Allow-listed hosts only; see api/_lib/relay.js.
 */
import config from '../../portfolio.config.js';
import { route, send, readJson, HttpError } from '../_lib/http.js';
import { requireSession } from '../_lib/session.js';
import { hit } from '../_lib/ratelimit.js';
import { relayRequest } from '../_lib/relay.js';

export default route(['POST'], async (req, res) => {
  const session = requireSession(req);
  const perMinute = config.devMode?.relay?.ratePerMinute ?? 30;
  const limit = await hit(`relay:${session.sid}`, perMinute, 60);
  if (limit.limited) throw new HttpError(429, `Relay limit reached (${perMinute} requests a minute). Try again shortly.`);
  const { url, method, headers, body } = await readJson(req, 200_000);
  if (typeof url !== 'string') throw new HttpError(400, 'Missing url.');
  send(res, 200, await relayRequest({ url, method, headers, body }));
});
