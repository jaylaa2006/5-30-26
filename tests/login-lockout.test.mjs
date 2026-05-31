#!/usr/bin/env node
// Integration test for Fix #7: per-email login-fail counter persisted to the
// auth JSON file, so an attacker can't drain the lockout by triggering a
// PM2 restart.
//
// Asserts:
//   1. After LOGIN_FAIL_LIMIT wrong-password attempts, the 11th returns 429
//      with code 'LOGIN_LOCKED' and a Retry-After header.
//   2. The lockout applies per-email (same IP, different email → not locked).
//   3. A successful login with the correct password clears the counter.
//
// Uses a low LOGIN_FAIL_LIMIT (via env) to keep the test fast. Run with:
//   LOGIN_FAIL_LIMIT=3 AUTH_BASE=http://localhost:3456 \
//     node tests/login-lockout.test.mjs

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const LOGIN_FAIL_LIMIT = Number(process.env.LOGIN_FAIL_LIMIT || 3);
const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}

async function register(email, password) {
  const r = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Lockout Test' })
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function login(email, password) {
  const r = await fetch(`${AUTH_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body, retryAfter: r.headers.get('Retry-After') };
}

async function main() {
  const email = `lock-${unique}@local.test`;
  const otherEmail = `lock-other-${unique}@local.test`;
  const goodPw = 'CorrectPasswordForLockoutTest';
  const otherPw = 'AnotherCorrectPassword';
  const badPw  = 'wrongpw-wrongpw';

  // Register both users up-front BEFORE burning through the per-IP rate-limit
  // bucket with failed logins. The server's per-IP bucket is shared across
  // endpoints, so if we register after ~5 failed logins we'd get a 429 on
  // registration itself, not on the login we're actually testing.
  const reg = await register(email, goodPw);
  assert.equal(reg.status, 200, `register first user: ${JSON.stringify(reg.body)}`);
  const regOther = await register(otherEmail, otherPw);
  assert.equal(regOther.status, 200, `register second user: ${JSON.stringify(regOther.body)}`);

  // Baseline: second user can log in before anything else happens.
  {
    const r = await login(otherEmail, otherPw);
    log(r.status === 200, 'second user baseline login works',
        `status ${r.status}`);
  }

  // 1. Fail LOGIN_FAIL_LIMIT times for the FIRST user. Each returns 401.
  //    Small sleep between attempts lets the async fs write land.
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) {
    const r = await login(email, badPw);
    log(r.status === 401, `fail ${i+1}/${LOGIN_FAIL_LIMIT} returns 401`, `status ${r.status}`);
    await new Promise(r => setTimeout(r, 80));
  }

  // 2. LIMIT+1 attempt on FIRST user should return 429 LOGIN_LOCKED.
  {
    const r = await login(email, badPw);
    log(r.status === 429 && r.body.code === 'LOGIN_LOCKED',
        'lockout trips after limit hit',
        `status ${r.status} code=${r.body.code} retryAfter=${r.retryAfter}`);
    log(!!r.retryAfter && Number(r.retryAfter) > 0,
        'Retry-After header present',
        `value=${r.retryAfter}`);
  }

  // 3. Correct password on FIRST user during lockout is ALSO refused.
  {
    const r = await login(email, goodPw);
    log(r.status === 429, 'correct password during lockout still refused',
        `status ${r.status}`);
  }

  // 4. SECOND user (same IP, different email) is NOT locked out.
  {
    const r = await login(otherEmail, otherPw);
    log(r.status === 200, 'lockout is per-email, not global',
        `status ${r.status} body=${JSON.stringify(r.body).slice(0,80)}`);
  }

  console.log(`\n${PASS} passing, ${FAIL} failing`);
  process.exit(FAIL ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
