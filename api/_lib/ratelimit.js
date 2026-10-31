/**
 * Fixed-window counters in Upstash Redis / Vercel KV (REST API). Without them
 * (local dev) an in-memory map is used, which on serverless only limits per
 * instance, so configure Upstash/KV in production.
 */
const memory = new Map();
let warned = false;

function backend() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

/** Count one hit for `key`; returns { count, limited, retryAfter }. */
export async function hit(key, limit, windowSeconds) {
  const be = backend();
  if (!be) {
    if (!warned && process.env.VERCEL) {
      console.warn('[ratelimit] No Upstash/KV configured; falling back to per-instance memory.');
      warned = true;
    }
    const now = Date.now();
    let entry = memory.get(key);
    if (!entry || entry.resetAt < now) entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    entry.count++;
    memory.set(key, entry);
    return { count: entry.count, limited: entry.count > limit, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  const k = `pf:rl:${key}`;
  const res = await fetch(`${be.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${be.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', k],
      ['EXPIRE', k, String(windowSeconds), 'NX'],
      ['TTL', k],
    ]),
  });
  if (!res.ok) throw new Error(`Rate limit store HTTP ${res.status}`);
  const [incr, , ttl] = await res.json();
  const count = Number(incr.result);
  return { count, limited: count > limit, retryAfter: Math.max(1, Number(ttl.result)) };
}

export function _resetMemory() {
  memory.clear();
}
