// tests/senebty-photo-signed-url.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signPhotoUrl, verifyPhotoUrl } from '../senebty/photo-store.js';

const SECRET = 'test-signing-secret-32-bytes-long-xxxxxxx';

test('signPhotoUrl returns a verifiable URL with t/u/e query', () => {
  const url = signPhotoUrl('user-123', 'photo-abc', { ttlSec: 300, secret: SECRET });
  assert.match(url, /^\/api\/senebty\/photo\/photo-abc\?/);
  assert.match(url, /[?&]t=[a-f0-9]{64}/);
  assert.match(url, /[?&]u=user-123/);
  assert.match(url, /[?&]e=\d+/);
});

test('verifyPhotoUrl accepts within TTL', () => {
  const url = signPhotoUrl('user-x', 'pid-y', { ttlSec: 300, secret: SECRET });
  const u = new URL('https://example.test' + url);
  const v = verifyPhotoUrl({
    photoId: 'pid-y',
    t: u.searchParams.get('t'),
    u: u.searchParams.get('u'),
    e: u.searchParams.get('e'),
  }, { secret: SECRET });
  assert.equal(v.valid, true);
  assert.equal(v.userId, 'user-x');
});

test('verifyPhotoUrl rejects after expiry', () => {
  const url = signPhotoUrl('user-x', 'pid-y', { ttlSec: -1, secret: SECRET });
  const u = new URL('https://example.test' + url);
  const v = verifyPhotoUrl({
    photoId: 'pid-y',
    t: u.searchParams.get('t'),
    u: u.searchParams.get('u'),
    e: u.searchParams.get('e'),
  }, { secret: SECRET });
  assert.equal(v.valid, false);
  assert.equal(v.reason, 'expired');
});

test('verifyPhotoUrl rejects tampered photoId', () => {
  const url = signPhotoUrl('user-x', 'pid-y', { ttlSec: 300, secret: SECRET });
  const u = new URL('https://example.test' + url);
  const v = verifyPhotoUrl({
    photoId: 'pid-DIFFERENT',
    t: u.searchParams.get('t'),
    u: u.searchParams.get('u'),
    e: u.searchParams.get('e'),
  }, { secret: SECRET });
  assert.equal(v.valid, false);
  assert.equal(v.reason, 'bad_signature');
});

test('verifyPhotoUrl rejects wrong user', () => {
  const url = signPhotoUrl('user-x', 'pid-y', { ttlSec: 300, secret: SECRET });
  const u = new URL('https://example.test' + url);
  const v = verifyPhotoUrl({
    photoId: 'pid-y',
    t: u.searchParams.get('t'),
    u: 'user-DIFFERENT',
    e: u.searchParams.get('e'),
  }, { secret: SECRET });
  assert.equal(v.valid, false);
  assert.equal(v.reason, 'bad_signature');
});
