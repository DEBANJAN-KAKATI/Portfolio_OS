/**
 * Server-side request relay for the Browser app's "Relay" mode.
 *
 * The owner's test requests leave from the server, so the tested app sees the
 * server's IP and the owner's network only sees HTTPS to the portfolio. To keep
 * this from becoming an open proxy it only reaches hosts on the allow-list in
 * portfolio.config.js (devMode.relay.hosts), never private or loopback
 * addresses (checked again on every redirect), with size, time and rate limits.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import config from '../../portfolio.config.js';
import { HttpError } from './http.js';

export const RELAY_LIMITS = { bodyBytes: 100_000, responseBytes: 2_000_000, timeoutMs: 15_000, redirects: 5 };
const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
// Request headers the owner may set; everything else (cookies from this site,
// forwarding headers, host) is never sent.
const BLOCKED_REQUEST_HEADERS = /^(host|cookie|connection|content-length|transfer-encoding|upgrade|te|trailer|keep-alive|proxy-.*|forwarded|x-forwarded-.*|x-real-ip|via)$/i;
const DROPPED_RESPONSE_HEADERS = /^(set-cookie|set-cookie2)$/i;
export const RELAY_USER_AGENT = 'Mozilla/5.0 (compatible; PortfolioRelay/1.0)';

export const relayHosts = () => (config.devMode?.relay?.hosts ?? []).map((h) => h.toLowerCase());

/** "app.example.com" matches itself; "*.example.com" matches any subdomain. */
export function hostAllowed(host, list = relayHosts()) {
  const h = String(host).toLowerCase().replace(/\.$/, '');
  return list.some((p) => (p.startsWith('*.') ? h.endsWith(p.slice(1)) && h.length > p.length - 1 : h === p));
}

/** Loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return s === '::' || s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith('ff');
  }
  return true; // not an IP at all
}

/** Throws unless the URL is an allowed public http(s) target. */
export async function assertRelayTarget(raw, { lookup = dnsLookup, hosts = relayHosts() } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'That is not a valid URL.');
  }
  if (!/^https?:$/.test(url.protocol)) throw new HttpError(400, 'Only http and https URLs can be relayed.');
  if (url.username || url.password) throw new HttpError(400, 'URLs with credentials are not relayed.');
  if (url.port && !['80', '443'].includes(url.port)) throw new HttpError(400, 'Only the standard ports 80 and 443 are relayed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) throw new HttpError(403, 'Relay works with host names on the allow-list, not raw IP addresses.');
  if (!hostAllowed(host, hosts)) throw new HttpError(403, `${host} is not on the relay allow-list (portfolio.config.js → devMode.relay.hosts).`);
  let addresses;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new HttpError(502, `Could not resolve ${host}.`);
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new HttpError(403, `${host} resolves to a private address.`);
  return url;
}

function cleanRequestHeaders(headers) {
  const out = { 'user-agent': RELAY_USER_AGENT, accept: '*/*' };
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (typeof v !== 'string' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(k) || BLOCKED_REQUEST_HEADERS.test(k)) continue;
    out[k.toLowerCase()] = v.slice(0, 4000);
  }
  return out;
}

async function readCapped(res, limit) {
  const reader = res.body?.getReader();
  if (!reader) return { buf: Buffer.alloc(0), truncated: false };
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      chunks.push(Buffer.from(value.subarray(0, value.length - (size - limit))));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(Buffer.from(value));
  }
  return { buf: Buffer.concat(chunks), truncated };
}

const isText = (type) => /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded|ld\+json|manifest\+json)|image\/svg\+xml)/i.test(type ?? '');

/**
 * Perform one relayed request (following redirects manually so each hop is checked).
 * @returns {{ url, finalUrl, status, statusText, headers, body, encoding, truncated, timeMs, redirects }}
 */
export async function relayRequest({ url, method = 'GET', headers = {}, body = null }, { fetchImpl = fetch, lookup = dnsLookup, hosts = relayHosts() } = {}) {
  method = String(method).toUpperCase();
  if (!METHODS.includes(method)) throw new HttpError(400, `Method ${method} is not supported.`);
  if (body != null && typeof body !== 'string') throw new HttpError(400, 'Request body must be text.');
  if (body && Buffer.byteLength(body) > RELAY_LIMITS.bodyBytes) throw new HttpError(413, 'Request body is too large (100 KB max).');

  const started = Date.now();
  const hops = [];
  let target = await assertRelayTarget(url, { lookup, hosts });
  let currentMethod = method;
  let currentBody = ['GET', 'HEAD'].includes(method) ? undefined : body ?? undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELAY_LIMITS.timeoutMs);
  try {
    for (let i = 0; ; i++) {
      let res;
      try {
        res = await fetchImpl(target.href, { method: currentMethod, headers: cleanRequestHeaders(headers), body: currentBody, redirect: 'manual', signal: controller.signal });
      } catch (err) {
        throw new HttpError(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'The site took longer than 15 s to answer.' : `Could not connect: ${err.cause?.code ?? err.message}`);
      }
      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        if (i >= RELAY_LIMITS.redirects) throw new HttpError(508, 'Too many redirects.');
        hops.push({ status: res.status, url: target.href });
        target = await assertRelayTarget(new URL(location, target).href, { lookup, hosts });
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && currentMethod === 'POST')) {
          currentMethod = 'GET';
          currentBody = undefined;
        }
        continue;
      }
      const type = res.headers.get('content-type') ?? '';
      const { buf, truncated } = currentMethod === 'HEAD' ? { buf: Buffer.alloc(0), truncated: false } : await readCapped(res, RELAY_LIMITS.responseBytes);
      const headersOut = [...res.headers.entries()].filter(([k]) => !DROPPED_RESPONSE_HEADERS.test(k));
      return {
        url,
        finalUrl: target.href,
        status: res.status,
        statusText: res.statusText,
        headers: headersOut,
        body: isText(type) ? buf.toString('utf8') : buf.toString('base64'),
        encoding: isText(type) ? 'text' : 'base64',
        contentType: type,
        size: buf.length,
        truncated,
        timeMs: Date.now() - started,
        redirects: hops,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}
