import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_SECRET = 'test-secret-'.repeat(4);
process.env.DEVMODE_INSECURE_COOKIE = '1';

const { hashPassword, verifyPassword } = await import('../api/_lib/password.js');
const { createSession, readSession, requireSession, csrfFor } = await import('../api/_lib/session.js');
const { checkMedia, sniff, stripMetadata, sanitizeMarkdown, checkJson, mergeInbox, assertMediaPath } = await import('../api/_lib/files.js');
const { hit, _resetMemory } = await import('../api/_lib/ratelimit.js');

const reqWith = (headers) => ({ headers: { host: 'site.test', ...headers } });

test('scrypt hash verifies only the right password; malformed hashes fail', async () => {
  const h = await hashPassword('correct horse battery');
  assert.match(h, /^scrypt\$32768\$8\$1\$/);
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('wrong', h), false);
  assert.equal(await verifyPassword('x', 'garbage'), false);
  assert.notEqual(await hashPassword('same'), await hashPassword('same')); // salted
});

test('session cookie: valid, tampered, expired', () => {
  const { session, cookie } = createSession();
  const value = cookie.split(';')[0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.deepEqual(readSession(reqWith({ cookie: value })).sid, session.sid);
  const [name, rest] = value.split('=');
  const [data, sig] = rest.split('.');
  const forged = Buffer.from(JSON.stringify({ sid: 'x', exp: 9999999999 })).toString('base64url');
  assert.equal(readSession(reqWith({ cookie: `${name}=${forged}.${sig}` })), null);
  assert.equal(readSession(reqWith({ cookie: `${name}=${data}.AAAA` })), null);
});

test('writes need same-origin + CSRF token', () => {
  const { session, cookie } = createSession();
  const c = cookie.split(';')[0];
  assert.throws(() => requireSession(reqWith({})), /Not signed in/);
  assert.throws(() => requireSession(reqWith({ cookie: c, origin: 'https://evil.test' })), /Cross-site/);
  assert.throws(() => requireSession(reqWith({ cookie: c, origin: 'https://site.test' })), /CSRF/);
  assert.equal(requireSession(reqWith({ cookie: c, origin: 'https://site.test', 'x-csrf-token': csrfFor(session) })).sid, session.sid);
  assert.equal(requireSession(reqWith({ cookie: c }), { write: false }).sid, session.sid);
});

test('media paths are allow-listed', () => {
  assert.equal(assertMediaPath('public/media/photos/a-1.webp'), 'public/media/photos/a-1.webp');
  for (const bad of ['public/media/../../api/x.webp', 'public/media/photos/a.exe', 'src/App.jsx', 'public/media/photos/A B.webp', 'public\\media\\photos\\a.webp']) {
    assert.throws(() => assertMediaPath(bad), /not allowed/);
  }
});

test('file type comes from the bytes, not the extension', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
  assert.equal(sniff(png), 'png');
  assert.throws(() => checkMedia('public/media/photos/x.webp', png), /doesn't match/);
  assert.throws(() => checkMedia('public/media/photos/x.png', Buffer.from('<script>alert(1)</script>')), /doesn't match/);
});

test('EXIF (GPS) is stripped from JPEG and WebP', () => {
  const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x10]), Buffer.from('Exif\0\0GPSDATA!!', 'latin1')]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), exif, Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9])]);
  const clean = stripMetadata(jpeg, 'jpeg');
  assert.ok(!clean.toString('latin1').includes('GPSDATA'));
  assert.ok(clean.toString('latin1').startsWith('\xff\xd8'));

  const chunk = (id, data) => {
    const h = Buffer.alloc(8);
    h.write(id, 0, 'latin1');
    h.writeUInt32LE(data.length, 4);
    return Buffer.concat([h, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const vp8x = chunk('VP8X', Buffer.from([0x08, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
  const body = Buffer.concat([vp8x, chunk('VP8 ', Buffer.alloc(10)), chunk('EXIF', Buffer.from('GPS-SECRET', 'latin1'))]);
  const webp = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBP', 'latin1'), body]);
  webp.writeUInt32LE(body.length + 4, 4);
  const out = stripMetadata(webp, 'webp');
  assert.ok(!out.toString('latin1').includes('GPS-SECRET'));
  assert.equal(out.readUInt32LE(4), out.length - 8);
  assert.equal(out[20] & 0x08, 0); // EXIF flag cleared
});

test('markdown sanitizer removes scripts, handlers and javascript: links', () => {
  const md = 'Hi <script>alert(1)</script> <img src=x onerror="steal()"> [x](javascript:alert(1)) <a href="javascript:bad()">y</a>';
  const out = sanitizeMarkdown(md);
  assert.ok(!/script|onerror|javascript:/i.test(out), out);
});

test('JSON documents are schema-validated; trash older than 30 days is purged', () => {
  assert.throws(() => checkJson('content/media.json', '{"photos":[{"id":1}]}'), /failed validation/);
  assert.throws(() => checkJson('src/App.jsx', '{}'), /not allowed/);
  const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const now = new Date().toISOString();
  const out = JSON.parse(checkJson('content/trash.json', JSON.stringify({ items: [{ id: 'a', section: 's', label: 'A', data: {}, deletedAt: old }, { id: 'b', section: 's', label: 'B', data: {}, deletedAt: now }] })));
  assert.deepEqual(out.items.map((i) => i.id), ['b']);
});

test('a dropped full vault is reduced to the public allow-list before commit', () => {
  const vault = { personal_info: { name: 'N', phone: '+91 999', email: 'e@x.com' }, projects: [{ id: 'p', title: 'P', bullets: ['ok'], visibility: 'private' }], tracker: [{ x: 1 }] };
  const out = checkJson('data/vault.public.json', JSON.stringify(vault));
  assert.ok(!/999|e@x\.com|tracker|"p"/.test(out), out);
});

test('inbox merge: one entry per item; add then edit stays add; add then delete disappears', () => {
  const at = new Date().toISOString();
  const cur = JSON.stringify({ version: 1, items: [{ op: 'add', section: 'projects', id: 'a', data: { title: 'A' }, edited_at: at }] });
  let out = JSON.parse(mergeInbox(cur, [{ op: 'edit', section: 'projects', id: 'a', data: { title: 'A2' }, edited_at: at }]));
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].op, 'add');
  assert.equal(out.items[0].data.title, 'A2');
  out = JSON.parse(mergeInbox(JSON.stringify(out), [{ op: 'delete', section: 'projects', id: 'a', data: {}, edited_at: at }]));
  assert.equal(out.items.length, 0);
});

test('rate limiter locks out after the limit', async () => {
  _resetMemory();
  for (let i = 1; i <= 5; i++) assert.equal((await hit('t', 5, 60)).limited, false);
  assert.equal((await hit('t', 5, 60)).limited, true);
});
