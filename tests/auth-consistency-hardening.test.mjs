#!/usr/bin/env node
// tests/auth-consistency-hardening.test.mjs
// 2026-05-15 — v3.46.5 Commit E: fixes from the Consistency-Coach
// adversarial audit on v3.45.x–v3.46.4.
//
// Findings addressed here:
//   #1  CRITICAL  — /api/auth/register now consults users.db (split-brain fix)
//   #2  HIGH      — reset tokens are single-use (lastPasswordResetAt gate)
//   #3  MEDIUM    — register writeFile uses 'wx' flag (atomic create-or-fail)
//   #5  MEDIUM    — perankh exposes /api/health (process-level)
//   #7  MEDIUM    — email-typo gate fires on submit + override on re-submit
//   #8  LOW       — recentLoginFailures uses reduce, not Math.min(...spread)
//   #10 LOW       — AUTH-FUNNEL digest flushes on SIGTERM/SIGINT
//   #11 LOW       — reset-password "account_missing" emits AUTH-FUNNEL event
//
// Run: node --test tests/auth-consistency-hardening.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const SERVER_SRC = fs.readFileSync('server.js', 'utf8');
const SEBA_SRC   = fs.readFileSync('seba-story-api.mjs', 'utf8');
const HTML       = fs.readFileSync('maat-reader.html', 'utf8');

function extractFn(src, name) {
  const idx = src.indexOf(`function ${name}(`);
  if (idx < 0) throw new Error(`function ${name} not found`);
  let depth = 0, start = -1, end = -1;
  for (let i = idx; i < src.length; i++) {
    if (src[i] === '{') { if (start < 0) start = i; depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  return src.slice(idx, end + 1);
}

// ─── Finding #1 (CRITICAL) — register checks users.db ────────────────────

test('#1 (CRITICAL): /api/auth/register consults users.db before .auth-data', () => {
  // The split-brain register hole: register only checked .auth-data, so
  // anyone could squat a Google-OAuth parent's email. The fix opens
  // users.db (parent_email column) and 409s on collision.
  assert.match(SERVER_SRC, /_usersDbStmtParentEmail = usersDb\.prepare\([\s\S]{0,200}LOWER\(parent_email\) = LOWER\(\?\)/,
    'must prepare a case-insensitive parent_email lookup against users.db');
  assert.match(SERVER_SRC, /readonly:\s*true/,
    'users.db must be opened read-only (cross-process safety)');
  // The handler must check the DB row BEFORE the .auth-data access check.
  const handlerIdx = SERVER_SRC.indexOf("app.post('/api/auth/register'");
  const next = SERVER_SRC.indexOf('app.post(', handlerIdx + 50);
  const body = SERVER_SRC.slice(handlerIdx, next > 0 ? next : handlerIdx + 5000);
  const dbCheckIdx   = body.indexOf('_existingUsersDbRow(safeEmail)');
  const accessIdx    = body.indexOf('fsPromises.access(authFile)');
  assert.ok(dbCheckIdx > 0 && dbCheckIdx < accessIdx,
    'users.db check must come BEFORE the .auth-data access check');
  assert.match(body, /recordAuthFunnelEvent\('register_failed', 'account_exists_oauth'\)/,
    'OAuth-collision branch emits its own AUTH-FUNNEL reason for telemetry');
});

// ─── Finding #3 (MEDIUM) — atomic register write ─────────────────────────

test("#3 (MEDIUM): register write uses 'wx' flag to close TOCTOU window", () => {
  const handlerIdx = SERVER_SRC.indexOf("app.post('/api/auth/register'");
  const next = SERVER_SRC.indexOf('app.post(', handlerIdx + 50);
  const body = SERVER_SRC.slice(handlerIdx, next > 0 ? next : handlerIdx + 5000);
  assert.match(body, /writeFile\(authFile,[\s\S]{0,200}\{\s*flag:\s*['"]wx['"]\s*\}/,
    "register writeFile must use flag: 'wx' (atomic create-or-fail)");
  assert.match(body, /e\.code === 'EEXIST'[\s\S]{0,400}'account_exists_race'[\s\S]{0,200}status\(409\)/,
    'EEXIST from the race must surface as a 409 account_exists_race, not 500');
});

// ─── Finding #2 (HIGH) — reset tokens single-use ─────────────────────────

const signSrc   = extractFn(SERVER_SRC, 'signPasswordResetToken');
const verifySrc = extractFn(SERVER_SRC, 'verifyPasswordResetToken');

const ctx = vm.createContext({
  crypto, Buffer,
  AUTH_SECRET: 'consistency-coach-test-secret',
  PWRESET_TTL_MS: 60 * 60 * 1000,
  PWRESET_PURPOSE: 'pw-reset',
  console: { warn() {}, error() {}, log() {} },
});
vm.runInContext(
  signSrc + '\n' + verifySrc +
  '\nthis.sign = signPasswordResetToken; this.verify = verifyPasswordResetToken;',
  ctx
);

test('#2 (HIGH): verifyPasswordResetToken accepts lastResetAtMs and rejects already-redeemed tokens', () => {
  const beforeReset = Date.now() - 1000;
  const tokenIssued = ctx.sign('u1', 'parent@example.com');
  // Token issued at time T. User redeems at time T+x. lastPasswordResetAt
  // becomes T+x. A REPLAY of the original token must now fail.
  const justRedeemedAt = Date.now() + 1000;  // slightly in the future
  const r = ctx.verify(tokenIssued, undefined, justRedeemedAt);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'already_redeemed',
    'token whose iat ≤ lastResetAtMs must be rejected as already_redeemed');
  // First redemption (no prior reset) still succeeds.
  const r2 = ctx.verify(tokenIssued, undefined, 0);
  assert.equal(r2.ok, true, 'first redemption must succeed');
  // And a fresh token issued AFTER the last reset succeeds.
  const tokenAfter = ctx.sign('u1', 'parent@example.com');
  const r3 = ctx.verify(tokenAfter, undefined, beforeReset);
  assert.equal(r3.ok, true, 'token issued AFTER last reset must succeed');
});

test('#2 (HIGH): reset-password handler threads lastPasswordResetAt into verifier', () => {
  const idx = SERVER_SRC.indexOf("app.post('/api/auth/reset-password'");
  const next = SERVER_SRC.indexOf('app.post(', idx + 50);
  const body = SERVER_SRC.slice(idx, next > 0 ? next : idx + 5000);
  // The handler does a cheap preparse to fetch lastPasswordResetAt, then
  // passes it to verifyPasswordResetToken.
  assert.match(body, /preUserData[\s\S]{0,500}lastPasswordResetAt/,
    'handler must preparse the user file to read lastPasswordResetAt');
  assert.match(body, /verifyPasswordResetToken\(token, undefined, lastResetAtMs\)/,
    'handler must pass lastResetAtMs to the verifier');
  // After success, lastPasswordResetAt is bumped so the next token replay fails.
  assert.match(body, /userData\.lastPasswordResetAt = Date\.now\(\)/,
    'success path must update lastPasswordResetAt');
});

// ─── Finding #11 (LOW) — telemetry parity on account_missing ─────────────

test('#11 (LOW): reset-password account_missing path emits AUTH-FUNNEL event', () => {
  const idx = SERVER_SRC.indexOf("app.post('/api/auth/reset-password'");
  const next = SERVER_SRC.indexOf('app.post(', idx + 50);
  const body = SERVER_SRC.slice(idx, next > 0 ? next : idx + 5000);
  assert.match(body, /recordAuthFunnelEvent\('reset_password_token_invalid', 'account_missing'\)/,
    'account_missing branch must emit AUTH-FUNNEL (telemetry parity with sibling branches)');
});

// ─── Finding #5 (MEDIUM) — /api/health on perankh ────────────────────────

test('#5 (MEDIUM): perankh exposes /api/health with structured payload', () => {
  assert.match(SERVER_SRC, /app\.get\(['"]\/api\/health['"]/,
    '/api/health route must be registered');
  const idx = SERVER_SRC.indexOf("app.get('/api/health'");
  const next = SERVER_SRC.indexOf('app.get(', idx + 30);
  const body = SERVER_SRC.slice(idx, next > 0 ? next : idx + 1200);
  for (const field of ['status', 'service', 'pid', 'uptimeSec', 'nodeVersion', 'usersDbCheck']) {
    assert.match(body, new RegExp('\\b' + field + ':\\s*'), `/api/health must report ${field}`);
  }
  assert.match(body, /service:\s*['"]perankh['"]/,
    'must self-label as service:"perankh" so on-call can attribute');
});

// ─── Finding #8 (LOW) — login lockout spread safety ──────────────────────

test('#8 (LOW): recentLoginFailures min uses reduce, not Math.min(...spread)', () => {
  // The spread form throws RangeError beyond ~100k elements. We use reduce
  // for unbounded safety even though LOGIN_FAIL_LIMIT is 10 in practice.
  const loginIdx = SERVER_SRC.indexOf("app.post('/api/auth/login'");
  const next = SERVER_SRC.indexOf('app.post(', loginIdx + 50);
  const body = SERVER_SRC.slice(loginIdx, next > 0 ? next : loginIdx + 5000);
  assert.doesNotMatch(body, /Math\.min\(\.\.\.recent\)/,
    'must not use Math.min(...recent) — spread is unsafe at scale');
  assert.match(body, /recent\.reduce\(\(m, t\) => t < m \? t : m, recent\[0\]\)/,
    'must use reduce-based min instead');
});

// ─── Finding #10 (LOW) — digest flushes on SIGTERM/SIGINT ────────────────

test('#10 (LOW): both processes flush AUTH-FUNNEL-DIGEST on SIGTERM and SIGINT', () => {
  for (const [src, label] of [[SERVER_SRC, 'server.js'], [SEBA_SRC, 'seba-story-api.mjs']]) {
    assert.match(src, /function flushAuthFunnelDigest\(reason\)/,
      `${label}: digest emit must be named-function so signal handlers can call it`);
    assert.match(src, /process\.on\(['"]SIGTERM['"][\s\S]{0,200}flushAuthFunnelDigest\(['"]sigterm['"]\)/,
      `${label}: SIGTERM handler must flush the digest`);
    assert.match(src, /process\.on\(['"]SIGINT['"][\s\S]{0,200}flushAuthFunnelDigest\(['"]sigint['"]\)/,
      `${label}: SIGINT handler must flush the digest`);
    // The flush log carries a flush_reason so on-call can tell interval vs
    // shutdown-flush vs whatever future trigger.
    assert.match(src, /flush_reason:\s*reason \|\| ['"]interval['"]/,
      `${label}: emitted line must include flush_reason`);
  }
});

// ─── Finding #7 (MEDIUM) — email-typo submit gate ────────────────────────

test('#7 (MEDIUM): email-typo gate fires on submit (not just blur)', () => {
  // The helper exists.
  assert.match(HTML, /_shouldBlockSubmitForTypo\(panel\)\s*\{/,
    'must define _shouldBlockSubmitForTypo helper');
  // Both submit handlers gate on it.
  assert.match(HTML,
    /introEmailSubmit\(\)\{[\s\S]{0,2000}_shouldBlockSubmitForTypo\('intro'\)\s*\)\s*return/,
    'introEmailSubmit must abort early when typo gate fires');
  assert.match(HTML,
    /emailAuthSubmit\(\)\{[\s\S]{0,2000}_shouldBlockSubmitForTypo\('welcome'\)\s*\)\s*return/,
    'emailAuthSubmit must abort early when typo gate fires');
  // First-submit blocks, second-submit (same email) is an override.
  assert.match(HTML,
    /_emailTypoBypassed\[panel\] === raw[\s\S]{0,200}return false/,
    'gate must allow override when user re-submits the SAME typo (explicit confirm)');
  // The blocked-submit suggestion line tells the user how to override.
  assert.match(HTML, /or submit again to use as typed/,
    'suggestion text must tell the user how to override the gate');
});

console.log('[auth-consistency-hardening] all assertions passed');
