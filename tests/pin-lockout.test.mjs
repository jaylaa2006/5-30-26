#!/usr/bin/env node
// Integration test for Fix #5: hard PIN lockout with self-recovery.
//
// Asserts that:
//   1. After PIN_FAIL_LIMIT failed attempts in the window, /api/seba-verify-pin
//      returns 429 with code:'EMAIL_VERIFY_REQUIRED' (not a soft rate limit).
//   2. A successful /api/seba-verify-code (any type) clears the lockout —
//      inbox possession is our non-OAuth ground truth for "this is the owner."
//   3. After clearance, PIN verify works again AND failures accumulate from 0
//      (counter was truly reset, not just the threshold check).
//
// Requires the server to be started with a low PIN_FAIL_LIMIT so we can
// trigger the wall inside the 5/min soft rate limit, and ALLOW_TEST_ENDPOINTS
// so /api/seba-reset-pin returns debugCode in dev:
//
//   PIN_FAIL_LIMIT=3 PIN_FAIL_WINDOW_MS=3600000 ALLOW_TEST_ENDPOINTS=true \
//     JWT_SECRET=... node seba-story-api.mjs
//
//   AUTH_BASE=http://localhost:3456 API_BASE=http://localhost:3847 \
//     PIN_FAIL_LIMIT=3 node tests/pin-lockout.test.mjs

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const API_BASE  = process.env.API_BASE  || 'http://localhost:3847';
const PIN_FAIL_LIMIT = Number(process.env.PIN_FAIL_LIMIT || 3);

const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TEST_EMAIL_LOGIN = `lockout-${unique}@local.test`;
const TEST_EMAIL_PARENT = `lockout-parent-${unique}@local.test`;
const TEST_PASSWORD = 'TestPassword1';
const TEST_NAME = 'Lockout Child';
const GOOD_PIN = '1234';
const WRONG_PIN = '9999';

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}

async function main(){
  // Fresh user for a clean rate-limit bucket and pinFailures counter.
  const regResp = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL_LOGIN, password: TEST_PASSWORD, name: TEST_NAME })
  });
  assert.equal(regResp.status, 200, `auth/register status ${regResp.status}`);
  const reg = await regResp.json();
  const jwt = reg.jwt;
  assert.ok(jwt, 'auth/register did not return JWT');

  const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt, 'X-Auth-ChildName': TEST_NAME };

  // Register parent with PIN so /api/seba-verify-pin has something to check
  {
    const r = await fetch(`${API_BASE}/api/seba-register-parent`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, pin: GOOD_PIN, childName: TEST_NAME })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.registered === true, 'register-parent for lockout test user', `status ${r.status}`);
  }

  // 1. Fail PIN_FAIL_LIMIT times — each call returns 200 {verified:false}.
  //    The Nth failure tips the counter over the threshold.
  for (let i = 1; i <= PIN_FAIL_LIMIT; i++) {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: WRONG_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.status === 200 && body.verified === false,
        `failure ${i}/${PIN_FAIL_LIMIT} recorded without lockout yet`,
        `status ${r.status} verified=${body.verified}`);
  }

  // 2. Next attempt must hit the hard lockout, returning code:EMAIL_VERIFY_REQUIRED.
  //    This distinguishes it from the 5/min soft rate limit (which has no code).
  let lockoutTripped = false;
  {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: WRONG_PIN })
    });
    const body = await r.json().catch(() => ({}));
    lockoutTripped = r.status === 429 && body.code === 'EMAIL_VERIFY_REQUIRED';
    log(lockoutTripped, 'hard lockout triggers after PIN_FAIL_LIMIT failures',
        `status ${r.status} code=${body.code}`);
  }

  // 3. Even the CORRECT PIN is refused while lockout is active — the server
  //    short-circuits before the scrypt compare. Otherwise a brute-forcer who
  //    lucked into the right PIN on attempt 51 would still win.
  {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: GOOD_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.status === 429 && body.code === 'EMAIL_VERIFY_REQUIRED',
        'correct PIN also refused while locked out',
        `status ${r.status} code=${body.code}`);
  }

  // 4. Request a reset code, then verify it to clear the lockout. Requires
  //    ALLOW_TEST_ENDPOINTS=true so the server returns the code in the body.
  let debugCode = null;
  {
    const r = await fetch(`${API_BASE}/api/seba-reset-pin`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, childName: TEST_NAME })
    });
    const body = await r.json().catch(() => ({}));
    debugCode = body.debugCode;
    log(r.ok && typeof debugCode === 'string' && /^\d{6}$/.test(debugCode),
        'reset-pin returns debugCode under ALLOW_TEST_ENDPOINTS',
        `status ${r.status} codePresent=${!!debugCode}`);
  }

  // 5. Submit the code via /api/seba-verify-code type:'reset'. On success the
  //    server issues a resetToken AND clears pinFailures — the self-recovery
  //    path that makes the system survive without customer-service intervention.
  if (debugCode) {
    const r = await fetch(`${API_BASE}/api/seba-verify-code`, {
      method: 'POST', headers: hdrs,
      body: JSON.stringify({ email: TEST_EMAIL_PARENT, code: debugCode, type: 'reset' })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.verified === true && typeof body.resetToken === 'string',
        'verify-code accepts debug code and issues resetToken',
        `status ${r.status} verified=${body.verified} tokenPresent=${!!body.resetToken}`);
  } else {
    log(false, 'verify-code step skipped — no debug code received');
  }

  // 6. PIN verify with the CORRECT pin now works — lockout cleared.
  {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: GOOD_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.ok && body.verified === true,
        'PIN verify works after email-verify clears lockout',
        `status ${r.status} verified=${body.verified}`);
  }

  // 7. Counter truly reset: failures accumulate again from 0. Record
  //    PIN_FAIL_LIMIT-1 failures and assert we're NOT locked out yet.
  for (let i = 1; i < PIN_FAIL_LIMIT; i++) {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: WRONG_PIN })
    });
    const body = await r.json().catch(() => ({}));
    // Soft rate limit may trip here if we've done many calls this minute.
    // That's 429 without a code — still acceptable evidence that we're NOT
    // in the EMAIL_VERIFY_REQUIRED state. Only fail if the lockout fires early.
    if (r.status === 429 && body.code === 'EMAIL_VERIFY_REQUIRED') {
      log(false, `counter reset check failed at attempt ${i} — lockout tripped early`,
          `code=${body.code}`);
    } else {
      log(true, `attempt ${i}/${PIN_FAIL_LIMIT-1} post-clear — no lockout yet`,
          `status ${r.status}`);
    }
  }

  console.log(`\n${PASS} passing, ${FAIL} failing`);
  process.exit(FAIL ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
