import { test } from 'node:test';
import assert from 'node:assert/strict';

const { hostAllowed, isPrivateAddress, assertRelayTarget, relayRequest, RELAY_USER_AGENT } = await import('../api/_lib/relay.js');

const HOSTS = ['app.example.com', '*.mysite.dev'];
const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const privateDns = async () => [{ address: '10.0.0.5', family: 4 }];

test('allow-list: exact hosts and wildcard subdomains only', () => {
  assert.equal(hostAllowed('app.example.com', HOSTS), true);
  assert.equal(hostAllowed('APP.example.com.', HOSTS), true);
  assert.equal(hostAllowed('evil.example.com', HOSTS), false);
  assert.equal(hostAllowed('api.mysite.dev', HOSTS), true);
  assert.equal(hostAllowed('mysite.dev', HOSTS), false);
  assert.equal(hostAllowed('notmysite.dev', HOSTS), false);
  assert.equal(hostAllowed('app.example.com.attacker.io', HOSTS), false);
});

test('private, loopback, link-local and metadata addresses are refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('targets: scheme, credentials, ports, raw IPs, allow-list and DNS are checked', async () => {
  const ok = (u, dns = publicDns) => assertRelayTarget(u, { lookup: dns, hosts: HOSTS });
  assert.equal((await ok('https://app.example.com/path')).hostname, 'app.example.com');
  await assert.rejects(ok('file:///etc/passwd'), /http and https/);
  await assert.rejects(ok('https://user:pw@app.example.com/'), /credentials/);
  await assert.rejects(ok('https://app.example.com:8080/'), /standard ports/);
  await assert.rejects(ok('http://127.0.0.1/'), /raw IP/);
  await assert.rejects(ok('https://other.com/'), /allow-list/);
  await assert.rejects(ok('https://app.example.com/', privateDns), /private address/);
});

test('relay: strips cookies both ways, sets a neutral user agent, reports status', async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init };
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'sid=1' } });
  };
  const r = await relayRequest(
    { url: 'https://app.example.com/api', headers: { Cookie: 'mine=1', 'X-Forwarded-For': '1.2.3.4', Authorization: 'Bearer t' } },
    { fetchImpl, lookup: publicDns, hosts: HOSTS },
  );
  assert.equal(r.status, 200);
  assert.equal(r.body, '{"ok":true}');
  assert.equal(r.encoding, 'text');
  assert.equal(r.headers.some(([k]) => k === 'set-cookie'), false);
  assert.equal(sent.init.headers.cookie, undefined);
  assert.equal(sent.init.headers['x-forwarded-for'], undefined);
  assert.equal(sent.init.headers.authorization, 'Bearer t');
  assert.equal(sent.init.headers['user-agent'], RELAY_USER_AGENT);
});

test('relay: every redirect hop is re-checked', async () => {
  const fetchImpl = async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
  await assert.rejects(relayRequest({ url: 'https://app.example.com/' }, { fetchImpl, lookup: publicDns, hosts: HOSTS }), /raw IP/);
  const offList = async () => new Response(null, { status: 301, headers: { location: 'https://elsewhere.com/' } });
  await assert.rejects(relayRequest({ url: 'https://app.example.com/' }, { fetchImpl: offList, lookup: publicDns, hosts: HOSTS }), /allow-list/);
});

test('relay: unknown methods and oversized bodies are refused', async () => {
  const fetchImpl = async () => new Response('x');
  await assert.rejects(relayRequest({ url: 'https://app.example.com/', method: 'CONNECT' }, { fetchImpl, lookup: publicDns, hosts: HOSTS }), /not supported/);
  await assert.rejects(relayRequest({ url: 'https://app.example.com/', method: 'POST', body: 'x'.repeat(100_001) }, { fetchImpl, lookup: publicDns, hosts: HOSTS }), /too large/);
});
