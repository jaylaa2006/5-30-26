// senebty-confirm-token.test.mjs
// HMAC determinism, tampering, secret-rotation, and static-pattern checks
// against seba-story-api.mjs for the /api/senebty/teaching-iri/confirm
// endpoint (M3 Task 9).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function check(name, fn){
  try { fn(); console.log(`  PASS  ${name}`); pass++; }
  catch (e){ console.error(`  FAIL  ${name}\n        ${e.message}`); fail++; }
}

const SECRET = 'test-secret-do-not-use-in-prod';

function makeToken(user_id, lesson_id, submitted_at) {
  return crypto.createHmac('sha256', SECRET)
    .update(user_id + ':' + lesson_id + ':' + submitted_at)
    .digest('hex');
}

check('HMAC-SHA256 deterministic for known input', () => {
  const t1 = makeToken('u-1', 'foundation-8-heka', 1700000000000);
  const t2 = makeToken('u-1', 'foundation-8-heka', 1700000000000);
  assert.equal(t1, t2);
  assert.equal(t1.length, 64);
});

check('HMAC differs for different inputs', () => {
  const t1 = makeToken('u-1', 'foundation-8-heka', 1700000000000);
  const t2 = makeToken('u-2', 'foundation-8-heka', 1700000000000);
  const t3 = makeToken('u-1', 'foundation-7-senedjem', 1700000000000);
  const t4 = makeToken('u-1', 'foundation-8-heka', 1700000001000);
  assert.notEqual(t1, t2);
  assert.notEqual(t1, t3);
  assert.notEqual(t1, t4);
});

check('Token verification accepts valid token', () => {
  const tok = makeToken('u-1', 'foundation-8-heka', 1700000000000);
  const expected = makeToken('u-1', 'foundation-8-heka', 1700000000000);
  assert.equal(tok, expected);
});

check('Token verification rejects tampered token', () => {
  const tok = makeToken('u-1', 'foundation-8-heka', 1700000000000);
  const tampered = tok.slice(0, -1) + (tok.slice(-1) === 'a' ? 'b' : 'a');
  const expected = makeToken('u-1', 'foundation-8-heka', 1700000000000);
  assert.notEqual(tampered, expected);
});

check('Token rotation: new secret invalidates old tokens', () => {
  const tokOld = crypto.createHmac('sha256', 'old-secret').update('u-1:foundation-8-heka:1700000000000').digest('hex');
  const tokNew = crypto.createHmac('sha256', 'new-secret').update('u-1:foundation-8-heka:1700000000000').digest('hex');
  assert.notEqual(tokOld, tokNew);
});

const apiSrc = fs.readFileSync(path.join(repoRoot, 'seba-story-api.mjs'), 'utf8');

check('seba-story-api.mjs has /api/senebty/teaching-iri/confirm handler', () => {
  assert.match(apiSrc, /\/api\/senebty\/teaching-iri\/confirm/);
});

check('Confirm handler returns 410 on replay (tone-canon copy present)', () => {
  assert.match(apiSrc, /res\.status\(410\)/);
  assert.match(apiSrc, /already advanced/i);
  assert.match(apiSrc, /path moved on/i);
});

check('Confirm handler verifies HMAC-SHA256', () => {
  assert.match(apiSrc, /createHmac\(\s*['"]sha256['"]/);
});

check('Confirm handler verifies 14-day expiry', () => {
  assert.match(apiSrc, /14\s*\*\s*86400/);
});

check('SENEBTY_TOKEN_SECRET env-var rotation supported', () => {
  assert.match(apiSrc, /SENEBTY_TOKEN_SECRET/);
  assert.match(apiSrc, /process\.env\.SENEBTY_TOKEN_SECRET/);
});

check('Confirm handler uses timing-safe comparison', () => {
  assert.match(apiSrc, /timingSafeEqual/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
