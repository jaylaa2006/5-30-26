// Security audit regression tests (2026-05-23).
// Locks in the fixes for the adversarial audit findings so they can't regress.
//   H1/H2 — teaching-iri pending/export/POST scope to req.authId (no client user_id IDOR)
//   M1    — SendGrid webhook fails CLOSED in production when the key is unset
//   M2    — PIN reset rejects accounts with no registered parent_email
//   L1    — photoPath rejects path-traversal in foundationId/photoId (functional)
//   L3    — SENEBTY_TOKEN_SECRET is boot-blocking in production
//   L4    — SendGrid webhook rejects stale/replayed timestamps
//   L2    — reflected email is escHTML'd in the unsubscribe/confirm pages

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const API = readFileSync(join(ROOT, 'seba-story-api.mjs'), 'utf8');

function region(marker, len) {
  const i = API.indexOf(marker);
  assert.notEqual(i, -1, `marker not found: ${marker}`);
  return API.slice(i, i + len);
}

test('H1: teaching-iri/pending scopes to req.authId, not client user_id', () => {
  const fn = region("app.get('/api/senebty/teaching-iri/pending'", 700);
  assert.match(fn, /const user_id = String\(req\.authId/, 'must use req.authId');
  // the vulnerable CODE line (not a comment mention) must be gone
  assert.doesNotMatch(fn, /const user_id = String\(req\.query\.user_id/, 'must NOT read user_id from the client');
});

test('H1: /export scopes to req.authId, not client user_id', () => {
  const fn = region("app.get('/api/senebty/export'", 700);
  assert.match(fn, /const user_id = String\(req\.authId/);
  assert.doesNotMatch(fn, /const user_id = String\(req\.query\.user_id/);
});

test('H2: teaching-iri POST scopes to req.authId, not body.user_id', () => {
  const fn = region("app.post('/api/senebty/teaching-iri'", 900);
  assert.match(fn, /const user_id = String\(req\.authId/);
  assert.doesNotMatch(fn, /const user_id = String\(body\.user_id/);
});

test('M1: SendGrid webhook verifier fails CLOSED in production when key unset', () => {
  const fn = region('function verifySendgridSignature', 900);
  // when the key is missing, prod returns ok:false
  assert.match(fn, /if \(process\.env\.NODE_ENV === 'production'\) return \{ ok: false/);
});

test('L4: SendGrid webhook rejects stale timestamps (replay window)', () => {
  const fn = region('function verifySendgridSignature', 2000);
  assert.match(fn, /stale_timestamp/);
  assert.match(fn, /> 600/, 'should enforce a ~10-minute window');
});

test('M2: PIN reset rejects accounts with no registered parent_email', () => {
  // the guard must reject when parent_email is null (was: skipped when null)
  assert.match(API, /if \(!user \|\| !user\.parent_email \|\| user\.parent_email !== email\)/);
});

test('L3: SENEBTY_TOKEN_SECRET is boot-blocking in production', () => {
  const fn = region('const SENEBTY_TOKEN_SECRET', 700);
  assert.match(fn, /process\.env\.NODE_ENV === 'production'/);
  assert.match(fn, /process\.exit\(1\)/);
});

test('L2: reflected email is escHTML-escaped in the unsubscribe/confirm pages', () => {
  assert.match(API, /<strong>\$\{escHTML\(decoded\.email\)\}<\/strong>/);
});

test('L1 (functional): photoPath rejects path traversal in foundationId/photoId', () => {
  const require = createRequire(import.meta.url);
  const { photoPath } = require('../senebty/photo-store.js');
  const ok = () => photoPath('/root', 'user1', 'foundation-mu', '123e4567-e89b-12d3-a456-426614174000', 'salt');
  assert.doesNotThrow(ok, 'valid foundationId + uuid photoId should work');
  assert.throws(() => photoPath('/root', 'u', '../../etc', 'x', 's'), /invalid foundationId/);
  assert.throws(() => photoPath('/root', 'u', 'foundation-mu', '../../../etc/passwd', 's'), /invalid photoId/);
  assert.throws(() => photoPath('/root', 'u', 'a/b', 'x', 's'), /invalid foundationId/);
});
