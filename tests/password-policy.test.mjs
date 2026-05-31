#!/usr/bin/env node
// Integration test for Fix #6: NIST SP 800-63B rev 4 password policy.
//
// Asserts:
//   1. /api/auth/register rejects passwords < 12 chars.
//   2. /api/auth/register rejects passwords > 128 chars.
//   3. /api/auth/register accepts a 12-char all-lowercase password
//      (no uppercase, no digit) — composition requirements were dropped.
//   4. /api/auth/login still accepts any length that matches the stored hash.
//
// Usage:
//   AUTH_BASE=http://localhost:3456 node tests/password-policy.test.mjs

import assert from 'node:assert/strict';

const AUTH_BASE = process.env.AUTH_BASE || 'http://localhost:3456';
const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let PASS = 0, FAIL = 0;
function log(ok, name, detail) {
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  ok ? PASS++ : FAIL++;
}

async function register(password, suffix = '') {
  const email = `pw-${suffix}-${unique}@local.test`;
  const resp = await fetch(`${AUTH_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Test User' })
  });
  const body = await resp.json().catch(() => ({}));
  return { resp, body, email };
}

async function login(email, password) {
  const resp = await fetch(`${AUTH_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const body = await resp.json().catch(() => ({}));
  return { resp, body };
}

async function main(){
  // 1. Short password rejected
  {
    const { resp, body } = await register('Short1A', 'short');
    log(resp.status === 400 && /12 characters/.test(body.error || ''),
        'register rejects password < 12 chars',
        `status ${resp.status} err="${body.error}"`);
  }

  // 2. Oversized password rejected
  {
    const { resp } = await register('x'.repeat(129), 'long');
    log(resp.status === 400, 'register rejects password > 128 chars',
        `status ${resp.status}`);
  }

  // 3. 12-char all-lowercase passphrase accepted — composition dropped.
  //    "zebrabananas" is all lowercase, no digits, no special chars.
  {
    const pw = 'zebrabananas';
    assert.equal(pw.length, 12);
    const { resp, email } = await register(pw, 'lower');
    log(resp.ok, 'register accepts 12-char all-lowercase passphrase',
        `status ${resp.status}`);

    // 4. Login with the same pw works.
    const lg = await login(email, pw);
    log(lg.resp.ok && lg.body.jwt, 'login succeeds with all-lowercase pw',
        `status ${lg.resp.status}`);
  }

  // 5. 12-char mixed passphrase (no composition enforcement, but still valid)
  {
    const pw = 'correct-horse-battery-staple';
    const { resp } = await register(pw, 'phrase');
    log(resp.ok, 'register accepts long passphrase with hyphens',
        `status ${resp.status}`);
  }

  console.log(`\n${PASS} passing, ${FAIL} failing`);
  process.exit(FAIL ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
