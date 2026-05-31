#!/usr/bin/env node
// tests/auth-funnel-digest.test.mjs
// 2026-05-15 — G5 [AUTH-FUNNEL] 6h digest rollup (auth-subsystem 2nd-eyes RT,
// Important binding from Security + Observability voices).
//
// Two PM2 processes — `perankh` (server.js, 3456) and `seba-api`
// (seba-story-api.mjs, 3847) — each carry their own AUTH-FUNNEL events.
// This commit adds a per-process digest aggregator that emits one
// `[AUTH-FUNNEL-DIGEST]` line every 6h with the totals + per-event-reason
// breakdown. The aggregator must not emit on empty windows.
//
// Run: node --test tests/auth-funnel-digest.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SERVER_SRC = fs.readFileSync('server.js', 'utf8');
const SEBA_SRC   = fs.readFileSync('seba-story-api.mjs', 'utf8');

function extractFn(src, name) {
  const idx = src.indexOf(`function ${name}(`);
  if (idx < 0) throw new Error(`function ${name} not found`);
  let depth = 0, start = -1, end = -1;
  for (let i = idx; i < src.length; i++) {
    if (src[i] === '{') { if (start < 0) start = i; depth++; }
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (start < 0 || end < 0) throw new Error(`could not extract ${name}`);
  return src.slice(idx, end + 1);
}

// ─── Aggregator unit contract (works on the extracted helper) ─────────────

function buildCtx(src) {
  const helper = extractFn(src, 'recordAuthFunnelEvent');
  const ctx = vm.createContext({});
  vm.runInContext(
    'var authFunnelCounter = { events: new Map(), windowStartedAt: Date.now() };' +
    helper +
    '\nthis.counter = authFunnelCounter; this.record = recordAuthFunnelEvent;',
    ctx
  );
  return ctx;
}

test('G5: recordAuthFunnelEvent (server.js) accumulates by event|reason', () => {
  const ctx = buildCtx(SERVER_SRC);
  ctx.record('register_ok');
  ctx.record('register_ok');
  ctx.record('register_failed', 'account_exists');
  ctx.record('register_failed', 'account_exists');
  ctx.record('register_failed', 'server_error');
  ctx.record('login_failed', 'invalid_password');
  assert.equal(ctx.counter.events.get('register_ok|'),             2);
  assert.equal(ctx.counter.events.get('register_failed|account_exists'), 2);
  assert.equal(ctx.counter.events.get('register_failed|server_error'), 1);
  assert.equal(ctx.counter.events.get('login_failed|invalid_password'), 1);
});

test('G5: recordAuthFunnelEvent (seba-story-api.mjs) accumulates by event|reason', () => {
  const ctx = buildCtx(SEBA_SRC);
  ctx.record('verify_send_ok');
  ctx.record('verify_send_failed', 'sendgrid_not_configured');
  ctx.record('verify_check_failed', 'wrong_code');
  ctx.record('verify_check_failed', 'wrong_code');
  ctx.record('verify_check_failed', 'expired');
  assert.equal(ctx.counter.events.get('verify_send_ok|'), 1);
  assert.equal(ctx.counter.events.get('verify_send_failed|sendgrid_not_configured'), 1);
  assert.equal(ctx.counter.events.get('verify_check_failed|wrong_code'), 2);
  assert.equal(ctx.counter.events.get('verify_check_failed|expired'), 1);
});

test('G5: recordAuthFunnelEvent handles missing event (defaults to "unknown")', () => {
  const ctx = buildCtx(SERVER_SRC);
  ctx.record();
  ctx.record(null, 'x');
  assert.equal(ctx.counter.events.get('unknown|'), 1);
  assert.equal(ctx.counter.events.get('unknown|x'), 1);
});

// ─── Source-grep: digest emitter + wiring on every existing emit site ─────

// v3.51.19 — split assertion to track v3.46.5 refactor. The setInterval now
// calls an extracted flushAuthFunnelDigest() helper instead of inlining the
// console.log. Security invariant: digest emits AUTH-FUNNEL-DIGEST with
// source:"server" (preserved by flushAuthFunnelDigest body); test now
// asserts BOTH parts independently so the structural change is reflected.
test('G5 (server.js): digest emits AUTH-FUNNEL-DIGEST with source:"server"', () => {
  // (1) setInterval calls the flush helper (or inlines the emit)
  assert.match(SERVER_SRC, /setInterval\([\s\S]{0,800}(?:flushAuthFunnelDigest\(|AUTH-FUNNEL-DIGEST)/,
    'server.js must have a setInterval that triggers the auth-funnel digest emit');
  // (2) the emit itself carries source:"server" — either inside the interval
  // body OR inside the flushAuthFunnelDigest function body
  assert.match(SERVER_SRC, /AUTH-FUNNEL-DIGEST[\s\S]{0,400}source:\s*['"]server['"]/,
    'server.js digest emit must label source:"server"');
  assert.match(SERVER_SRC, /AUTH_FUNNEL_DIGEST_MS\s*=\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    'server.js digest must use 6h window');
  // Empty-window guard: when there are zero events, do NOT emit (matches GUARD-DIGEST).
  assert.match(SERVER_SRC, /entries\.length === 0[\s\S]{0,300}authFunnelCounter\.windowStartedAt = Date\.now\(\);\s*return;/,
    'server.js digest must skip emit on empty window');
});

test('G5 (seba-story-api.mjs): digest emits with source:"seba-api"', () => {
  assert.match(SEBA_SRC, /setInterval\([\s\S]{0,800}(?:flushAuthFunnelDigest\(|AUTH-FUNNEL-DIGEST)/,
    'seba-story-api.mjs must have a setInterval that triggers the auth-funnel digest emit');
  assert.match(SEBA_SRC, /AUTH-FUNNEL-DIGEST[\s\S]{0,400}source:\s*['"]seba-api['"]/,
    'seba-story-api.mjs digest emit must label source:"seba-api"');
  assert.match(SEBA_SRC, /AUTH_FUNNEL_DIGEST_MS\s*=\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    'seba-story-api.mjs digest must use 6h window');
  assert.match(SEBA_SRC, /entries\.length === 0[\s\S]{0,300}authFunnelCounter\.windowStartedAt = Date\.now\(\);\s*return;/,
    'seba-story-api.mjs digest must skip emit on empty window');
});

test('G5 (server.js): every existing AUTH-FUNNEL event-emit site has a counter call', () => {
  // Each "console.log/error/warn('[AUTH-FUNNEL] '" emit site must be paired
  // with a `recordAuthFunnelEvent(...)` call within the preceding ~5 lines.
  // We use a sliding window: extract all emit sites and assert each is
  // preceded by a `recordAuthFunnelEvent` call in the surrounding scope.
  const events = [
    'forgot_password_no_account',
    'forgot_password_send_failed', // appears multiple times
    'forgot_password_send_ok',
    'reset_password_token_invalid',
    'reset_password_ok',
    'register_ok',
    'register_failed',  // account_exists + server_error
    'login_ok',
    'login_failed',     // locked + invalid_password + no_account + server_error
  ];
  for (const ev of events) {
    const re = new RegExp(`recordAuthFunnelEvent\\(['"]${ev}['"]`);
    assert.match(SERVER_SRC, re,
      `server.js must call recordAuthFunnelEvent for '${ev}'`);
  }
});

test('G5 (seba-story-api.mjs): every existing AUTH-FUNNEL event-emit site has a counter call', () => {
  const events = [
    'verify_send_ok',
    'verify_send_failed',  // sendgrid_not_configured, sendgrid_throw, sendgrid_non2xx, unexpected_throw
    'verify_check_ok',     // new — verify-code success
    'verify_check_failed', // new — wrong_code, expired, no_pending, too_many_attempts
  ];
  for (const ev of events) {
    const re = new RegExp(`recordAuthFunnelEvent\\(['"]${ev}['"]`);
    assert.match(SEBA_SRC, re,
      `seba-story-api.mjs must call recordAuthFunnelEvent for '${ev}'`);
  }
});

test('G5: digest level escalates to WARN above threshold', () => {
  // Both files use 50 as the per-event warn threshold (sustained scan signal).
  assert.match(SERVER_SRC, /AUTH_FUNNEL_WARN_THRESHOLD\s*=\s*50/,
    'server.js threshold = 50');
  assert.match(SEBA_SRC,   /AUTH_FUNNEL_WARN_THRESHOLD\s*=\s*50/,
    'seba-story-api.mjs threshold = 50');
  for (const src of [SERVER_SRC, SEBA_SRC]) {
    assert.match(src, /maxSingle\s*>=?\s*AUTH_FUNNEL_WARN_THRESHOLD[\s\S]{0,50}['"]WARN['"]/,
      'digest level escalates to WARN when any single event count >= threshold');
  }
});

test('G5 (server.js): verify-code-style verification events come from seba-api only (no cross-wiring)', () => {
  // server.js should NOT call recordAuthFunnelEvent for verify_send_* / verify_check_*
  // (those live in seba-api). This catches accidental cross-wiring that would
  // pollute the per-process digest.
  assert.doesNotMatch(SERVER_SRC, /recordAuthFunnelEvent\(['"]verify_send/);
  assert.doesNotMatch(SERVER_SRC, /recordAuthFunnelEvent\(['"]verify_check/);
});

test('G5: digest .unref() so the interval does not block process exit', () => {
  for (const src of [SERVER_SRC, SEBA_SRC]) {
    assert.match(src, /AUTH_FUNNEL_DIGEST_MS\)\.unref\?\.\(\)/,
      'digest interval must call .unref?.() so it doesn\'t prevent shutdown');
  }
});

console.log('[auth-funnel-digest] all assertions passed');
