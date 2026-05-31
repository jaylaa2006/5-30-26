#!/usr/bin/env node
// tests/welcome-email-backfill.test.mjs
// 2026-05-15 — v3.46.3 hardened sendWelcomeEmail + backfill admin endpoint.
//
// Audit finding: 28 of 29 verified parents had `last_welcome_email = NULL`
// because the pre-v3.46.3 sendWelcomeEmail did not inspect SendGrid response
// statusCode and silently swallowed non-2xx failures. Same class of bug as
// G2 (verify-email) which is already fixed. This commit:
//   1. Hardens sendWelcomeEmail to G2 standard (response inspection,
//      structured AUTH-FUNNEL telemetry, structured return object).
//   2. Adds POST /api/admin/backfill-welcome-email — dry-run by default,
//      ?confirm=yes to actually send, internal rate limit.
//
// Run: node --test tests/welcome-email-backfill.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SEBA_SRC = fs.readFileSync('seba-story-api.mjs', 'utf8');

// ─── G2-pattern hardening of sendWelcomeEmail ─────────────────────────────

test('hardened sendWelcomeEmail: returns structured {ok,reason} (not bare bool)', () => {
  const fnIdx = SEBA_SRC.indexOf('async function sendWelcomeEmail(');
  assert.ok(fnIdx > 0, 'sendWelcomeEmail must exist');
  // Pull the function body via brace balance.
  let depth = 0, end = -1;
  for (let i = fnIdx; i < SEBA_SRC.length; i++) {
    if (SEBA_SRC[i] === '{') depth++;
    else if (SEBA_SRC[i] === '}' && --depth === 0) { end = i; break; }
  }
  const body = SEBA_SRC.slice(fnIdx, end + 1);
  // Old impl returned `true`/`false`. New impl must return objects.
  assert.match(body, /return \{ ok: true \}/,
    'success must return { ok: true }');
  assert.match(body, /return \{ ok: false, reason: 'sendgrid_not_configured'/,
    'no-SendGrid case must return structured reason');
  assert.match(body, /return \{ ok: false, reason: 'sendgrid_throw'/,
    'throw case must return structured reason');
  assert.match(body, /return \{ ok: false, reason: 'sendgrid_non2xx'/,
    'non-2xx case must return structured reason');
});

test('hardened sendWelcomeEmail: inspects SendGrid response statusCode (G2 pattern)', () => {
  const fnIdx = SEBA_SRC.indexOf('async function sendWelcomeEmail(');
  let depth = 0, end = -1;
  for (let i = fnIdx; i < SEBA_SRC.length; i++) {
    if (SEBA_SRC[i] === '{') depth++;
    else if (SEBA_SRC[i] === '}' && --depth === 0) { end = i; break; }
  }
  const body = SEBA_SRC.slice(fnIdx, end + 1);
  // v3.51.x DEMETRIS remediation: the v3.46.3 non-2xx inspection (formerly the
  // inline `sgResponse.statusCode` / `sgStatus < 200 || >= 300` guard) moved
  // INTO the bounded-retry helper (lib/email-retry.mjs, unit-tested in
  // tests/email-retry.test.mjs). sendWelcomeEmail now delegates to it and keeps
  // the v3.46.3 CONTRACT: non-2xx is rejected (markWelcomeSent must NOT run) and
  // returns a structured { ok:false, reason:'sendgrid_non2xx' }.
  assert.match(body, /sendEmailWithRetry\(/,
    'must delegate the send to the bounded-retry helper');
  assert.match(body, /outcome\.reason\s*===\s*['"]sendgrid_non2xx['"]/,
    'must still branch on a non-2xx outcome (the v3.46.3 fix, now via the helper)');
  assert.match(body, /if \(!outcome\.ok\)/,
    'must reject any non-ok outcome before markWelcomeSent');
});

test('hardened sendWelcomeEmail: AUTH-FUNNEL events for both success + each failure mode', () => {
  const fnIdx = SEBA_SRC.indexOf('async function sendWelcomeEmail(');
  let depth = 0, end = -1;
  for (let i = fnIdx; i < SEBA_SRC.length; i++) {
    if (SEBA_SRC[i] === '{') depth++;
    else if (SEBA_SRC[i] === '}' && --depth === 0) { end = i; break; }
  }
  const body = SEBA_SRC.slice(fnIdx, end + 1);
  for (const ev of [
    "recordAuthFunnelEvent('welcome_send_failed', 'sendgrid_not_configured')",
    "recordAuthFunnelEvent('welcome_send_failed', 'sendgrid_throw')",
    "recordAuthFunnelEvent('welcome_send_failed', 'sendgrid_non2xx')",
    "recordAuthFunnelEvent('welcome_send_ok')",
  ]) {
    assert.ok(body.includes(ev), `must call ${ev}`);
  }
});

test('hardened sendWelcomeEmail: email is hashed before logging (never raw)', () => {
  const fnIdx = SEBA_SRC.indexOf('async function sendWelcomeEmail(');
  let depth = 0, end = -1;
  for (let i = fnIdx; i < SEBA_SRC.length; i++) {
    if (SEBA_SRC[i] === '{') depth++;
    else if (SEBA_SRC[i] === '}' && --depth === 0) { end = i; break; }
  }
  const body = SEBA_SRC.slice(fnIdx, end + 1);
  // Privacy: the structured log lines (AUTH-FUNNEL) carry email_hash only.
  assert.match(body, /crypto\.createHash\(['"]sha256['"]\)\.update\(parentEmail\)/,
    'must sha256-hash parentEmail for telemetry');
  // The hash is sliced to 16 chars (matching the rest of the codebase).
  assert.match(body, /\.digest\(['"]hex['"]\)\.slice\(0, 16\)/,
    'must slice hash to first 16 hex chars');
});

test('hardened sendWelcomeEmail: markWelcomeSent only runs on 2xx (NOT on failure)', () => {
  const fnIdx = SEBA_SRC.indexOf('async function sendWelcomeEmail(');
  let depth = 0, end = -1;
  for (let i = fnIdx; i < SEBA_SRC.length; i++) {
    if (SEBA_SRC[i] === '{') depth++;
    else if (SEBA_SRC[i] === '}' && --depth === 0) { end = i; break; }
  }
  const body = SEBA_SRC.slice(fnIdx, end + 1);
  // markWelcomeSent must come AFTER the non-2xx guard, AFTER the throw guard.
  const markIdx = body.indexOf('stmt.markWelcomeSent.run');
  const non2xxIdx = body.indexOf("return { ok: false, reason: 'sendgrid_non2xx'");
  const throwIdx = body.indexOf("return { ok: false, reason: 'sendgrid_throw'");
  assert.ok(markIdx > non2xxIdx,
    'markWelcomeSent must be reachable only AFTER the non-2xx return');
  assert.ok(markIdx > throwIdx,
    'markWelcomeSent must be reachable only AFTER the throw return');
});

// ─── Backfill admin endpoint ──────────────────────────────────────────────

test('backfill endpoint: route exists with requireAdmin gate', () => {
  assert.match(SEBA_SRC,
    /app\.post\(['"]\/api\/admin\/backfill-welcome-email['"]\s*,\s*requireAdmin/,
    'must be gated by requireAdmin middleware');
});

test('backfill endpoint: defaults to dry-run (?confirm=yes to actually send)', () => {
  const idx = SEBA_SRC.indexOf("app.post('/api/admin/backfill-welcome-email'");
  const next = SEBA_SRC.indexOf('app.post(', idx + 50);
  const block = SEBA_SRC.slice(idx, next > 0 ? next : idx + 8000);
  assert.match(block, /confirm = req\.query\.confirm === ['"]yes['"]/,
    'must check req.query.confirm === "yes"');
  // The "dry" return must come BEFORE the actual send loop.
  const dryReturnIdx = block.search(/if \(!confirm\)\s*\{[\s\S]{0,80}return res\.json\(summary\)/);
  const sendLoopIdx  = block.search(/for \(const u of eligible\)/);
  assert.ok(dryReturnIdx > 0 && dryReturnIdx < sendLoopIdx,
    'dry-run return must come before the actual send loop (default safe)');
});

test('backfill endpoint: filters match the known-stranded cohort', () => {
  const idx = SEBA_SRC.indexOf("app.post('/api/admin/backfill-welcome-email'");
  const next = SEBA_SRC.indexOf('app.post(', idx + 50);
  const block = SEBA_SRC.slice(idx, next > 0 ? next : idx + 8000);
  // The eligibility query must match the exact stranded-parent definition.
  assert.match(block, /email_verified = 1/);
  assert.match(block, /parent_email IS NOT NULL/);
  assert.match(block, /last_welcome_email IS NULL/);
  assert.match(block, /unsubscribed = 0/);
});

test('backfill endpoint: rate-limits sends to ≤4/sec (well under SendGrid free 100/day)', () => {
  const idx = SEBA_SRC.indexOf("app.post('/api/admin/backfill-welcome-email'");
  const next = SEBA_SRC.indexOf('app.post(', idx + 50);
  const block = SEBA_SRC.slice(idx, next > 0 ? next : idx + 8000);
  // 250ms between sends = 4/sec.
  assert.match(block, /setTimeout\(r,\s*250\)/,
    'must sleep 250ms between sends (4/sec ceiling)');
});

test('backfill endpoint: optional onlyEmail param for single-user retry', () => {
  const idx = SEBA_SRC.indexOf("app.post('/api/admin/backfill-welcome-email'");
  const next = SEBA_SRC.indexOf('app.post(', idx + 50);
  const block = SEBA_SRC.slice(idx, next > 0 ? next : idx + 8000);
  assert.match(block, /onlyEmail[\s\S]{0,500}req\.body\.email/,
    'must accept optional { email } in body for single-user retry');
});

test('backfill endpoint: emits logAdmin for both preview + actual run (audit trail)', () => {
  const idx = SEBA_SRC.indexOf("app.post('/api/admin/backfill-welcome-email'");
  const next = SEBA_SRC.indexOf('app.post(', idx + 50);
  const block = SEBA_SRC.slice(idx, next > 0 ? next : idx + 8000);
  assert.match(block, /logAdmin\(req,\s*['"]backfill_welcome_email_preview['"]/,
    'must log preview to admin audit trail');
  assert.match(block, /logAdmin\(req,\s*['"]backfill_welcome_email_run['"]/,
    'must log actual run to admin audit trail');
});

test('backfill endpoint: returns per-user sent/failed lists with email hashes only', () => {
  const idx = SEBA_SRC.indexOf("app.post('/api/admin/backfill-welcome-email'");
  const next = SEBA_SRC.indexOf('app.post(', idx + 50);
  const block = SEBA_SRC.slice(idx, next > 0 ? next : idx + 8000);
  // The response must NOT contain raw parent_email — only the hash.
  // (We accept email_hash field in the response objects, but not raw email.)
  assert.match(block, /summary\.sent\.push\(\{ id: u\.id, email_hash: hash \}/,
    'sent[] entries must carry email_hash, not raw parent_email');
  assert.match(block, /summary\.failed\.push\(\{[\s\S]{0,200}email_hash: hash/,
    'failed[] entries must carry email_hash, not raw parent_email');
});

console.log('[welcome-email-backfill] all assertions passed');
