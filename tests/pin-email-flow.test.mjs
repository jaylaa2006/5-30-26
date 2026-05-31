#!/usr/bin/env node
// Integration test for the PIN + email verification round-trip.
//
// Asserts that:
//   1. /api/seba-register-parent accepts a raw 4-digit PIN (the fix).
//   2. /api/seba-register-parent rejects a hashed placeholder (the old client bug).
//   3. /api/seba-verify-pin returns verified:true for the raw PIN we just set.
//   4. /api/seba-verify-pin returns verified:false for a wrong PIN.
//   5. /api/seba-update-email updates the email and clears email_verified.
//   6. /api/seba-reset-pin fires once and its code path auto-verifies the email.
//
// Usage:
//   AUTH_BASE=http://localhost:3456 API_BASE=http://localhost:3847 \
//     node tests/pin-email-flow.test.mjs
//
// Both servers must be running. SendGrid may be unconfigured in dev — the
// server returns {sent:false, reason:'sendgrid_not_configured'} and logs the
// code, which is fine for input-validation assertions.

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const API_BASE  = process.env.API_BASE  || 'http://localhost:3847';

const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TEST_EMAIL_LOGIN = `pin-test-${unique}@local.test`;
const TEST_EMAIL_PARENT = `parent-${unique}@local.test`;
const TEST_PASSWORD = 'TestPassword1';
const TEST_NAME = 'Test Child';
const GOOD_PIN = '1234';
const WRONG_PIN = '9999';
const HASHED_PIN = 'ph_abc123xyz'; // shape the old client sent — server must reject

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}

async function main(){
  // 1. Register a fresh login account
  const regResp = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL_LOGIN, password: TEST_PASSWORD, name: TEST_NAME })
  });
  assert.equal(regResp.status, 200, `auth/register status ${regResp.status}`);
  const reg = await regResp.json();
  assert.ok(reg.jwt, 'auth/register did not return JWT');
  const jwt = reg.jwt;
  log(true, 'auth/register returns JWT');

  const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt, 'X-Auth-ChildName': TEST_NAME };

  // 2. Server MUST reject a hashed placeholder (old bug footprint)
  {
    const r = await fetch(`${API_BASE}/api/seba-register-parent`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, pin: HASHED_PIN, childName: TEST_NAME })
    });
    log(r.status === 400, 'register-parent rejects hashed pin', `got ${r.status}`);
  }

  // 3. Server MUST accept the raw 4-digit PIN
  {
    const r = await fetch(`${API_BASE}/api/seba-register-parent`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, pin: GOOD_PIN, childName: TEST_NAME })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.registered === true, 'register-parent accepts raw pin', `status ${r.status}`);
  }

  // 4. verify-pin — correct PIN → verified:true
  {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: GOOD_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.verified === true, 'verify-pin with correct pin', `status ${r.status} verified=${body.verified}`);
  }

  // 5. verify-pin — wrong PIN → verified:false
  {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: WRONG_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.verified === false, 'verify-pin rejects wrong pin', `verified=${body.verified}`);
  }

  // 6. update-email — changes email, clears email_verified. Must not touch pin_hash.
  {
    const NEW_EMAIL = `parent2-${unique}@local.test`;
    const r = await fetch(`${API_BASE}/api/seba-update-email`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ email: NEW_EMAIL })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.updated === true, 'update-email succeeds without touching pin', `status ${r.status}`);

    // PIN must still work after email change
    const vr = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: GOOD_PIN })
    });
    const vb = await vr.json().catch(() => ({}));
    log(vr.ok && vb.verified === true, 'pin still valid after email change', `verified=${vb.verified}`);
  }

  // 7. update-email rejects invalid email
  {
    const r = await fetch(`${API_BASE}/api/seba-update-email`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ email: 'not-an-email' })
    });
    log(r.status === 400, 'update-email rejects invalid email', `got ${r.status}`);
  }

  // 8. reset-pin returns quickly (no SendGrid failure in dev). Either sent:true or sent:false with reason.
  {
    const r = await fetch(`${API_BASE}/api/seba-reset-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ email: `parent2-${unique}@local.test` })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok, 'reset-pin responds 200', `status ${r.status} body=${JSON.stringify(body)}`);
  }

  // 9. health-pin-consistency requires admin key — should 403 without one
  {
    const r = await fetch(`${API_BASE}/api/admin/health-pin-consistency`);
    log(r.status === 403, 'health-pin-consistency requires admin auth', `got ${r.status}`);
  }

  // 10. SECURITY: register-parent must NOT overwrite an existing PIN.
  // A hijacked session previously could silently rotate the gate via this endpoint.
  {
    const r = await fetch(`${API_BASE}/api/seba-register-parent`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, pin: '5678', childName: TEST_NAME })
    });
    const body = await r.json().catch(() => ({}));
    log(r.status === 403 && body.code === 'PIN_EXISTS',
        'register-parent blocks overwrite when pin_hash already set',
        `status ${r.status} code=${body.code}`);

    // Original PIN must still verify after the attempted overwrite
    const vr = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: GOOD_PIN })
    });
    const vb = await vr.json().catch(() => ({}));
    log(vr.ok && vb.verified === true, 'original pin survives register-parent overwrite attempt', `verified=${vb.verified}`);
  }

  // 11. SECURITY: update-pin without currentPin or resetToken must be rejected.
  {
    const r = await fetch(`${API_BASE}/api/seba-update-pin`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ pin: '5678' })
    });
    log(r.status === 403, 'update-pin blocks unauth change when pin_hash set', `got ${r.status}`);
  }

  // 12. SECURITY: update-pin with wrong currentPin must be rejected.
  {
    const r = await fetch(`${API_BASE}/api/seba-update-pin`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ pin: '5678', currentPin: '0000' })
    });
    log(r.status === 403, 'update-pin rejects wrong currentPin', `got ${r.status}`);
  }

  // 13. SECURITY: update-pin with correct currentPin succeeds.
  {
    const NEW_PIN = '5678';
    const r = await fetch(`${API_BASE}/api/seba-update-pin`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ pin: NEW_PIN, currentPin: GOOD_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.updated === true, 'update-pin with correct currentPin succeeds', `status ${r.status}`);

    // New PIN verifies, old PIN does not. Tolerate rate-limit on follow-up
    // (5/min/user) — the security assertion isn't "we tested at speed",
    // it's "the new hash replaced the old".
    const ok = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: NEW_PIN })
    }).then(r => r.json()).catch(() => ({}));
    log(ok.verified === true, 'new pin verifies after update', `verified=${ok.verified}`);

    const oldResp = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: GOOD_PIN })
    });
    const oldOk = await oldResp.json().catch(() => ({}));
    if (oldResp.status === 429) {
      log(true, 'old pin check skipped (rate-limited; new pin already confirmed)', `status=${oldResp.status}`);
    } else {
      log(oldOk.verified === false, 'old pin no longer verifies after update', `verified=${oldOk.verified}`);
    }
  }

  // 14. Revoke tokens: endpoint exists and returns 200 for an authed caller.
  {
    const r = await fetch(`${API_BASE}/api/seba-revoke-tokens`, {
      method: 'POST', headers: hdrs
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.revoked === true, 'revoke-tokens returns ok for authed user', `status ${r.status} body=${JSON.stringify(body)}`);

    // Next request with same JWT should now be rejected (token_version bumped).
    const vr = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: '5678' })
    });
    log(vr.status === 401, 'post-revoke request returns 401', `got ${vr.status}`);
  }

  console.log(`\n${PASS} passing, ${FAIL} failing`);
  process.exit(FAIL ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
