// Google-email auto-capture into parent_email (v3.51.x).
// Locks the enterprise fix that backfills users whose row has no email:
//   - server.js carries email + normalized ev in the JWT
//   - seba-api fills parent_email ONLY when null (never overwrites), sets
//     email_verified=1 only when Google verified, wired into BOTH auth paths,
//     and never throws into auth (Rule 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.js', 'utf8');
const api = fs.readFileSync('seba-story-api.mjs', 'utf8');

test('server.js JWT carries email + normalized ev (R1/C2)', () => {
  // The /api/auth/google JWT must include email + ev.
  assert.match(server, /jwt\.sign\(\{\s*googleId:\s*payload\.sub,\s*email:\s*payload\.email[^}]*ev:\s*_ev/,
    'JWT must include email + ev');
  // ev normalized from tokeninfo string "true" → 1/0.
  assert.match(server, /payload\.email_verified === true \|\| payload\.email_verified === ['"]true['"]/,
    'email_verified must be normalized (string "true" or boolean)');
});

test('seba-api capture statement fills parent_email ONLY when null (R2/C5)', () => {
  assert.match(api, /captureEmailIfNull:\s*db\.prepare\(`[\s\S]*?WHERE google_id = @gid AND parent_email IS NULL/,
    'capture must be gated on parent_email IS NULL (never overwrite)');
});

test('seba-api sets email_verified=1 only when Google verified (R3)', () => {
  assert.match(api, /email_verified = CASE WHEN @ev = 1 THEN 1 ELSE email_verified END/,
    'email_verified must only be set when ev=1, else preserved');
});

test('capture helper is best-effort (Rule 1: try/catch + warn, never throws)', () => {
  const fn = api.match(/function captureParentEmailFromJwt\([\s\S]*?\n\}/);
  assert.ok(fn, 'captureParentEmailFromJwt must exist');
  assert.match(fn[0], /try\s*\{[\s\S]*\}\s*catch/, 'must wrap in try/catch');
  assert.match(fn[0], /console\.warn\(['"]\[EMAIL-CAPTURE\]/, 'catch must log (Rule 1, no silent catch)');
  // Must validate the email shape before writing.
  assert.match(fn[0], /indexOf\(['"]@['"]\)\s*<\s*1/, 'must validate email contains @');
});

test('capture is wired into BOTH requireAuth and optionalAuth (C4)', () => {
  const calls = (api.match(/captureParentEmailFromJwt\(req\.authId, decoded\)/g) || []).length;
  assert.ok(calls >= 2, `expected capture call in both auth paths, found ${calls}`);
});

test('capture lowercases the email (token-match parity with unsub + dedupe)', () => {
  const fn = api.match(/function captureParentEmailFromJwt\([\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /email\.toLowerCase\(\)/, 'email must be lowercased on capture');
});
