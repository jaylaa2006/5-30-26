#!/usr/bin/env node
// tests/email-send-retry-wiring.test.mjs
// 2026-05-23 — "DEMETRIS" remediation wiring contract.
//
// Pins that the bounded-retry helper + failure visibility are actually wired
// into seba-story-api.mjs (the functional behavior of the helper itself lives
// in tests/email-retry.test.mjs). This guards against a future edit that
// re-introduces a bare `await sgMail.send(msg)` on a transactional send and
// re-opens the silent-single-failure hole.
//
// Run: node --test tests/email-send-retry-wiring.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync('seba-story-api.mjs', 'utf8');

function routeBlock(src, route) {
  const start = src.indexOf(route);
  assert.ok(start > 0, `route ${route} must exist`);
  // From the route string back up to the enclosing app.METHOD(, then forward to
  // the next top-level `app.` registration.
  const open = src.lastIndexOf('app.', start);
  const next = src.indexOf('\napp.', start);
  return src.slice(open, next > 0 ? next : open + 6000);
}

function fnBody(src, sig) {
  const i = src.indexOf(sig);
  assert.ok(i > 0, `${sig} must exist`);
  let depth = 0, end = -1;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) { end = j; break; }
  }
  return src.slice(i, end + 1);
}

// ─── Helper is imported ───────────────────────────────────────────────────

test('imports sendEmailWithRetry from lib/email-retry.mjs', () => {
  assert.match(SRC, /import\s*\{\s*sendEmailWithRetry\s*\}\s*from\s*['"]\.\/lib\/email-retry\.mjs['"]/,
    'must import the bounded-retry helper');
  assert.ok(fs.existsSync('lib/email-retry.mjs'), 'lib/email-retry.mjs must exist');
});

// ─── All three transactional sends use the helper ─────────────────────────

test('access-code send (/api/seba-verify-email) uses sendEmailWithRetry', () => {
  const block = routeBlock(SRC, "'/api/seba-verify-email'");
  assert.match(block, /sendEmailWithRetry\(\(m\)\s*=>\s*sgMail\.send\(m\)/,
    'access-code send must route through the retry helper');
  assert.doesNotMatch(block, /\n\s*sgResponse\s*=\s*Array\.isArray/,
    'the old bare single-send + inline inspection must be gone');
});

test('PIN-reset send uses sendEmailWithRetry (no bare await sgMail.send)', () => {
  // The reset send lives in the seba-reset-pin / seba-request-reset handler.
  const i = SRC.indexOf('[RESET] PIN reset code sent');
  assert.ok(i > 0, 'reset send log line must exist');
  const block = SRC.slice(Math.max(0, i - 1400), i + 200);
  assert.match(block, /sendEmailWithRetry\(\(m\)\s*=>\s*sgMail\.send\(m\)/,
    'reset-code send must route through the retry helper');
  assert.doesNotMatch(block, /\n\s*await sgMail\.send\(msg\);\n\s*console\.log\(`\[RESET\]/,
    'the old bare await sgMail.send(msg) on the reset path must be gone');
});

test('sendWelcomeEmail uses sendEmailWithRetry', () => {
  const body = fnBody(SRC, 'async function sendWelcomeEmail(');
  assert.match(body, /sendEmailWithRetry\(\(m\)\s*=>\s*sgMail\.send\(m\)/,
    'welcome email must route through the retry helper');
});

// ─── Failure visibility: counter + [ALERT] + stats ────────────────────────

test('emailSendFailures counter + recordEmailSendFailure with [ALERT] log exist', () => {
  assert.match(SRC, /const emailSendFailures\s*=\s*\{\s*total:\s*0/,
    'must declare the live emailSendFailures counter');
  assert.match(SRC, /function recordEmailSendFailure\(/,
    'must declare recordEmailSendFailure');
  const fn = fnBody(SRC, 'function recordEmailSendFailure(');
  assert.match(fn, /\[ALERT\] email send failed after retries/,
    'a final (post-retry) failure must emit a loud [ALERT] line');
  assert.match(fn, /emailSendFailures\.total\s*\+=\s*1/,
    'must increment the total counter');
});

test('each transactional failure path records the email-send failure', () => {
  for (const route of ['verify_send', 'welcome_send', 'reset_send']) {
    const re = new RegExp(`recordEmailSendFailure\\(['"]${route}['"]`);
    assert.match(SRC, re, `must call recordEmailSendFailure('${route}', ...)`);
  }
});

test('/api/admin/stats exposes emailSendFailures', () => {
  const block = routeBlock(SRC, "'/api/admin/stats'");
  assert.match(block, /emailSendFailures/,
    'admin stats must surface the live email-send failure counter');
});

// ─── Stranded-users recovery endpoint ─────────────────────────────────────

test('GET /api/admin/stranded-users exists, requireAdmin, read-only', () => {
  assert.match(SRC,
    /app\.get\(['"]\/api\/admin\/stranded-users['"]\s*,\s*requireAdmin/,
    'stranded-users endpoint must exist and be admin-gated');
  const block = routeBlock(SRC, "'/api/admin/stranded-users'");
  assert.match(block, /email_verified === 0/,
    'must select unverified (stranded) users');
  assert.match(block, /neverReturned/,
    'must flag users who registered and never returned');
  // Read-only: it must not send email or mutate state.
  assert.doesNotMatch(block, /sgMail\.send|sendEmailWithRetry|\.run\(/,
    'stranded-users must be strictly read-only (no send, no DB write)');
});

console.log('[email-send-retry-wiring] all assertions passed');
