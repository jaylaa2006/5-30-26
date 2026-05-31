#!/usr/bin/env node
// Integration test for Fix #3: COPPA Verifiable Parental Consent.
//
// Asserts:
//   1. /api/parental-consent/text returns current version + text + hash.
//   2. /api/parental-consent/status returns consented:false for a new user.
//   3. /api/parental-consent/sign rejects a too-short signature.
//   4. /api/parental-consent/sign requires verified parent email.
//   5. After email verify + register-parent, sign succeeds and returns
//      a revokeToken.
//   6. /api/parental-consent/status then returns consented:true with
//      isCurrentVersion:true.
//   7. /api/parental-consent/revoke-by-token?token=... marks it revoked.
//   8. Subsequent /api/parental-consent/status returns consented:false.
//   9. /api/parental-consent/sign rejects mismatched parent email.
//
// Requires the seba-api started with ALLOW_TEST_ENDPOINTS=true and a fresh DB.
//
// Usage:
//   AUTH_BASE=http://localhost:3456 API_BASE=http://localhost:3847 \
//     SEBA_DB_PATH=/tmp/perankh-consent-test.db ALLOW_TEST_ENDPOINTS=true \
//     node tests/parental-consent.test.mjs

import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const API_BASE  = process.env.API_BASE  || 'http://localhost:3847';
const DB_PATH   = process.env.SEBA_DB_PATH;
if (!DB_PATH) {
  console.error('SEBA_DB_PATH is required so the test can mark email verified directly.');
  process.exit(2);
}
const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}

async function main() {
  const TEST_EMAIL_LOGIN  = `coppa-${unique}@local.test`;
  const TEST_EMAIL_PARENT = `coppa-parent-${unique}@local.test`;
  const TEST_PASSWORD = 'CoppaTestPassword123';
  const TEST_NAME = 'Coppa Child';
  const GOOD_PIN = '7777';
  const SIG_NAME = 'Test Parent Guardian';

  // 1. /text endpoint is public — works without auth.
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/text`);
    const body = await r.json().catch(() => ({}));
    log(r.status === 200 && body.version && body.text && body.textHash,
        'consent/text returns version + text + hash',
        `version=${body.version} textLen=${body.text?.length}`);
  }

  // Register auth account
  const reg = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL_LOGIN, password: TEST_PASSWORD, name: TEST_NAME })
  });
  const regBody = await reg.json();
  assert.equal(reg.status, 200);
  const jwt = regBody.jwt;
  const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt, 'X-Auth-ChildName': TEST_NAME };

  // 2. Status for a brand-new user → consented:false
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/status`, { headers: hdrs });
    const body = await r.json();
    log(r.status === 200 && body.consented === false,
        'status returns consented:false for new user',
        `consented=${body.consented} currentVersion=${body.currentVersion}`);
  }

  // 3. Sign requires parent email registered first → 400
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/sign`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ signatureName: SIG_NAME, parentEmail: TEST_EMAIL_PARENT, childName: TEST_NAME })
    });
    log(r.status === 400, 'sign rejected before parent email registered',
        `status ${r.status}`);
  }

  // Register parent (sets parent_email + PIN)
  {
    const r = await fetch(`${API_BASE}/api/seba-register-parent`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, pin: GOOD_PIN, childName: TEST_NAME })
    });
    assert.equal(r.status, 200);
  }

  // 4. Sign still requires VERIFIED parent email → 400 with EMAIL_VERIFY_REQUIRED
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/sign`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ signatureName: SIG_NAME, parentEmail: TEST_EMAIL_PARENT, childName: TEST_NAME })
    });
    const body = await r.json();
    log(r.status === 400 && body.code === 'EMAIL_VERIFY_REQUIRED',
        'sign blocked when parent email unverified',
        `status ${r.status} code=${body.code}`);
  }

  // Mark parent email as verified directly — the verify flow goes through
  // SendGrid in test-like envs and doesn't expose a debug code. Same pattern
  // as scrypt-v2.test.mjs reaching into SQLite for state not otherwise
  // controllable from the wire.
  {
    const db = new Database(DB_PATH);
    try {
      const r = db.prepare('UPDATE users SET email_verified = 1 WHERE google_id = ?').run(regBody.userId);
      assert.equal(r.changes, 1, 'email_verified update should touch 1 row');
    } finally { db.close(); }
  }

  // 5. Sign with too-short signature → 400
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/sign`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ signatureName: 'Ab', parentEmail: TEST_EMAIL_PARENT, childName: TEST_NAME })
    });
    log(r.status === 400, 'sign rejects signature shorter than 3 chars',
        `status ${r.status}`);
  }

  // 6. Sign with MISMATCHED parent email → 400
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/sign`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ signatureName: SIG_NAME, parentEmail: 'wrong@example.test', childName: TEST_NAME })
    });
    log(r.status === 400, 'sign rejects mismatched parent email',
        `status ${r.status}`);
  }

  // 7. Happy path — valid sign
  let revokeToken;
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/sign`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ signatureName: SIG_NAME, parentEmail: TEST_EMAIL_PARENT, childName: TEST_NAME })
    });
    const body = await r.json();
    revokeToken = body.revokeToken;
    log(r.ok && body.signed === true && body.revokeToken,
        'sign returns signed:true + revokeToken on happy path',
        `status ${r.status} tokenLen=${body.revokeToken?.length}`);
  }

  // 8. Status now returns consented:true + isCurrentVersion:true
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/status`, { headers: hdrs });
    const body = await r.json();
    log(r.status === 200 && body.consented === true && body.isCurrentVersion === true,
        'status returns consented:true after sign',
        `consented=${body.consented} current=${body.isCurrentVersion}`);
  }

  // 9. Public revoke-by-token works (no auth needed)
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/revoke-by-token?token=${revokeToken}`);
    log(r.status === 200, 'revoke-by-token returns 200 HTML',
        `status ${r.status}`);
  }

  // 10. Status now back to consented:false
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/status`, { headers: hdrs });
    const body = await r.json();
    log(r.status === 200 && body.consented === false,
        'status returns consented:false after revoke',
        `consented=${body.consented}`);
  }

  // 11. Revoke-by-token with a bogus token → 400
  {
    const r = await fetch(`${API_BASE}/api/parental-consent/revoke-by-token?token=notrealtoken`);
    log(r.status === 400, 'revoke-by-token rejects malformed token',
        `status ${r.status}`);
  }

  console.log(`\n${PASS} passing, ${FAIL} failing`);
  process.exit(FAIL ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
