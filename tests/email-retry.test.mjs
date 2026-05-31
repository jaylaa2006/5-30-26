#!/usr/bin/env node
// tests/email-retry.test.mjs
// 2026-05-23 — functional unit tests for lib/email-retry.mjs (the "DEMETRIS"
// remediation). Unlike the source-grep email tests, these exercise the real
// retry logic with an injected fake sendFn + fake sleep (no delays, no network).
//
// Run: node --test tests/email-retry.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sendEmailWithRetry,
  isRetryableSend,
  statusFromError,
  EMAIL_SEND_MAX_ATTEMPTS,
  EMAIL_RETRYABLE_STATUS,
} from '../lib/email-retry.mjs';

const noSleep = () => Promise.resolve();
const ok2xx = { statusCode: 202 };

// A SendGrid-style ResponseError: numeric `.code` carries the HTTP status.
function sgError(status, message) {
  const e = new Error(message || 'send failed');
  e.code = status;
  return e;
}

// ─── statusFromError ──────────────────────────────────────────────────────

test('statusFromError reads numeric .code (SendGrid ResponseError)', () => {
  assert.equal(statusFromError(sgError(401, 'Unauthorized')), 401);
});

test('statusFromError reads err.response.statusCode fallback', () => {
  assert.equal(statusFromError({ response: { statusCode: 503 } }), 503);
});

test('statusFromError returns null for network throw (string code)', () => {
  const e = new Error('socket hang up'); e.code = 'ECONNRESET';
  assert.equal(statusFromError(e), null);
});

// ─── isRetryableSend classification ───────────────────────────────────────

test('transient 401 IS retryable (the DEMETRIS case)', () => {
  assert.equal(isRetryableSend({ thrown: true, statusCode: 401 }), true);
  assert.ok(EMAIL_RETRYABLE_STATUS.has(401), '401 must be in the retryable set');
});

test('network throw (no status) IS retryable', () => {
  assert.equal(isRetryableSend({ thrown: true, statusCode: null }), true);
});

test('permanent 400/413 are NOT retryable', () => {
  assert.equal(isRetryableSend({ thrown: true, statusCode: 400 }), false);
  assert.equal(isRetryableSend({ thrown: false, statusCode: 413 }), false);
});

test('non-2xx with no status is NOT retryable (resolved, not thrown)', () => {
  assert.equal(isRetryableSend({ thrown: false, statusCode: null }), false);
});

// ─── sendEmailWithRetry behavior ──────────────────────────────────────────

test('success on first attempt — no retry, attempts=1', async () => {
  let calls = 0;
  const out = await sendEmailWithRetry(async () => { calls++; return [ok2xx, {}]; }, {}, { sleep: noSleep });
  assert.deepEqual(out, { ok: true, statusCode: 202, attempts: 1 });
  assert.equal(calls, 1);
});

test('transient 401 throw heals on retry (DEMETRIS would NOT have been stranded)', async () => {
  let calls = 0;
  const out = await sendEmailWithRetry(async () => {
    calls++;
    if (calls === 1) throw sgError(401, 'Unauthorized');
    return [ok2xx, {}];
  }, {}, { sleep: noSleep });
  assert.equal(out.ok, true);
  assert.equal(out.attempts, 2, 'should succeed on the 2nd attempt');
  assert.equal(calls, 2);
});

test('persistent throw exhausts attempts then returns structured failure', async () => {
  let calls = 0;
  const retries = [];
  const out = await sendEmailWithRetry(async () => { calls++; throw sgError(503, 'Service Unavailable'); }, {}, {
    sleep: noSleep,
    onRetry: (info) => retries.push(info),
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'sendgrid_throw');
  assert.equal(out.statusCode, 503);
  assert.equal(out.attempts, EMAIL_SEND_MAX_ATTEMPTS);
  assert.equal(calls, EMAIL_SEND_MAX_ATTEMPTS, 'must try exactly max attempts');
  assert.equal(retries.length, EMAIL_SEND_MAX_ATTEMPTS - 1, 'onRetry fires once per retry (not on the final give-up)');
});

test('permanent 400 throw fails fast — NO retry', async () => {
  let calls = 0;
  const out = await sendEmailWithRetry(async () => { calls++; throw sgError(400, 'Bad Request'); }, {}, { sleep: noSleep });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'sendgrid_throw');
  assert.equal(out.attempts, 1, 'permanent error must not retry');
  assert.equal(calls, 1);
});

test('retryable non-2xx response (429) retries then succeeds', async () => {
  let calls = 0;
  const out = await sendEmailWithRetry(async () => {
    calls++;
    return calls === 1 ? [{ statusCode: 429 }, {}] : [ok2xx, {}];
  }, {}, { sleep: noSleep });
  assert.equal(out.ok, true);
  assert.equal(out.attempts, 2);
});

test('non-retryable non-2xx response (413) fails fast', async () => {
  let calls = 0;
  const out = await sendEmailWithRetry(async () => { calls++; return [{ statusCode: 413 }, {}]; }, {}, { sleep: noSleep });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'sendgrid_non2xx');
  assert.equal(out.statusCode, 413);
  assert.equal(out.attempts, 1);
  assert.equal(calls, 1);
});

test('wrapper never throws even if sendFn throws a non-Error', async () => {
  const out = await sendEmailWithRetry(async () => { throw 'string failure'; }, {}, { sleep: noSleep });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'sendgrid_throw');
});

test('handles bare response object (not array) form', async () => {
  const out = await sendEmailWithRetry(async () => ({ statusCode: 200 }), {}, { sleep: noSleep });
  assert.equal(out.ok, true);
  assert.equal(out.statusCode, 200);
});

// ─── Coach C1: per-attempt timeout (hung SendGrid must not block forever) ──

test('a hung send times out per-attempt and is treated as retryable, then heals', async () => {
  let calls = 0;
  const out = await sendEmailWithRetry((/* msg */) => {
    calls++;
    if (calls === 1) return new Promise(() => {}); // never resolves → must time out
    return Promise.resolve([ok2xx, {}]);
  }, {}, { sleep: noSleep, attemptTimeoutMs: 10 });
  assert.equal(out.ok, true, 'should recover on the 2nd attempt after the 1st hangs');
  assert.equal(out.attempts, 2);
  assert.equal(calls, 2);
});

test('a fully-hung send exhausts attempts then fails (never hangs the caller)', async () => {
  const out = await sendEmailWithRetry(() => new Promise(() => {}), {}, {
    sleep: noSleep, attemptTimeoutMs: 10,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'sendgrid_throw');
  assert.equal(out.attempts, EMAIL_SEND_MAX_ATTEMPTS);
});

test('attemptTimeoutMs=0 disables the timeout (no premature failure)', async () => {
  const out = await sendEmailWithRetry(
    () => new Promise((r) => setTimeout(() => r([ok2xx, {}]), 5)),
    {}, { sleep: noSleep, attemptTimeoutMs: 0 });
  assert.equal(out.ok, true);
});

console.log('[email-retry] all assertions passed');
