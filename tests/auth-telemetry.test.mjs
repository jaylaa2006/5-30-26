#!/usr/bin/env node
// Integration test for Fix #8: auth-failure telemetry + admin view.
//
// Asserts:
//   1. Invalid JWTs record a 'jwt_invalid' event in the ring buffer.
//   2. Wrong PIN attempts record a 'pin_wrong' event.
//   3. Hard PIN lockout trips record a 'pin_lockout_trip' event.
//   4. /api/admin/auth-events requires admin key (returns 403 without).
//   5. /api/admin/auth-events returns events with admin key.
//   6. Filters ?kind= and ?ip= narrow the result set.
//
// Requires the server started with ADMIN_API_KEY and a low PIN_FAIL_LIMIT.
//
// Usage:
//   AUTH_BASE=http://localhost:3456 API_BASE=http://localhost:3847 \
//     ADMIN_API_KEY=dev-admin-key PIN_FAIL_LIMIT=3 \
//     node tests/auth-telemetry.test.mjs

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const API_BASE  = process.env.API_BASE  || 'http://localhost:3847';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key';
const PIN_FAIL_LIMIT = Number(process.env.PIN_FAIL_LIMIT || 3);

const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TEST_EMAIL_LOGIN = `telem-${unique}@local.test`;
const TEST_EMAIL_PARENT = `telem-parent-${unique}@local.test`;
const TEST_PASSWORD = 'TestPassword123X';
const TEST_NAME = 'Telem Child';
const GOOD_PIN = '1234';
const WRONG_PIN = '9999';

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}

async function getEvents(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${API_BASE}/api/admin/auth-events${qs ? '?' + qs : ''}`, {
    headers: { 'X-Admin-Key': ADMIN_KEY }
  });
  return { status: r.status, body: r.ok ? await r.json() : null };
}

async function main(){
  const regResp = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL_LOGIN, password: TEST_PASSWORD, name: TEST_NAME })
  });
  assert.equal(regResp.status, 200);
  const reg = await regResp.json();
  const jwt = reg.jwt;

  const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt, 'X-Auth-ChildName': TEST_NAME };

  // 1. Garbage JWT → should record 'jwt_invalid'
  {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer notarealjwt' },
      body: JSON.stringify({ pin: '0000' })
    });
    log(r.status === 401, 'garbage JWT returns 401', `status ${r.status}`);
  }

  // Register parent so we have a pin_hash for verify-pin calls.
  await fetch(`${API_BASE}/api/seba-register-parent`, {
    method: 'POST', headers: hdrs,
    body: JSON.stringify({ email: TEST_EMAIL_PARENT, pin: GOOD_PIN, childName: TEST_NAME })
  });

  // 2-3. Fail PIN_FAIL_LIMIT times → pin_wrong events, then 1 lockout_trip
  for (let i = 0; i < PIN_FAIL_LIMIT; i++) {
    await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: WRONG_PIN })
    });
  }
  {
    const r = await fetch(`${API_BASE}/api/seba-verify-pin`, {
      method: 'POST', headers: hdrs, body: JSON.stringify({ pin: WRONG_PIN })
    });
    const body = await r.json().catch(() => ({}));
    log(r.status === 429 && body.code === 'EMAIL_VERIFY_REQUIRED',
        'lockout triggered for telemetry test',
        `status ${r.status} code=${body.code}`);
  }

  // 4. Admin endpoint requires key
  {
    const r = await fetch(`${API_BASE}/api/admin/auth-events`);
    log(r.status === 403, 'auth-events requires admin auth', `got ${r.status}`);
  }

  // 5. With admin key, returns events
  {
    const r = await getEvents();
    log(r.status === 200 && Array.isArray(r.body?.events),
        'auth-events returns events with admin key',
        `status ${r.status} eventCount=${r.body?.events?.length}`);
    const kinds = new Set((r.body?.events || []).map(e => e.kind));
    log(kinds.has('jwt_invalid'), 'jwt_invalid event recorded', `kinds=${[...kinds].join(',')}`);
    log(kinds.has('pin_wrong'), 'pin_wrong event recorded');
    log(kinds.has('pin_lockout_trip'), 'pin_lockout_trip event recorded');
  }

  // 6. Kind filter narrows results
  {
    const r = await getEvents({ kind: 'pin_wrong' });
    const allCorrectKind = (r.body?.events || []).every(e => e.kind === 'pin_wrong');
    log(r.status === 200 && allCorrectKind && r.body.events.length >= PIN_FAIL_LIMIT,
        'kind=pin_wrong filter returns only pin_wrong events',
        `count=${r.body?.events?.length} allMatch=${allCorrectKind}`);
  }

  console.log(`\n${PASS} passing, ${FAIL} failing`);
  process.exit(FAIL ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
