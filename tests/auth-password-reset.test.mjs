#!/usr/bin/env node
// tests/auth-password-reset.test.mjs
// 2026-05-15 — G1 magic-link password reset (auth subsystem 2nd-eyes RT,
// Critical binding from Parent-Voice + Security voices). Mirrors the
// chunk-token-sign-verify.test.mjs pattern: extract the sign/verify helpers
// via brace-balanced parse, evaluate in an isolated vm context with crypto +
// AUTH_SECRET, exercise the contract. Plus source-grep on the route + UI
// wiring.
//
// Run: node --test tests/auth-password-reset.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const SERVER_SRC = fs.readFileSync('server.js', 'utf8');
const HTML       = fs.readFileSync('maat-reader.html', 'utf8');

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

const signSrc = extractFn(SERVER_SRC, 'signPasswordResetToken');
const verifySrc = extractFn(SERVER_SRC, 'verifyPasswordResetToken');

const ctx = vm.createContext({
  crypto, Buffer,
  AUTH_SECRET: 'test-auth-secret-deterministic',
  PWRESET_TTL_MS: 60 * 60 * 1000,
  PWRESET_PURPOSE: 'pw-reset',
  console: { warn() {}, error() {}, log() {} },
});
vm.runInContext(
  signSrc + '\n' + verifySrc +
  '\nthis.sign = signPasswordResetToken; this.verify = verifyPasswordResetToken;',
  ctx
);
const sign = ctx.sign;
const verify = ctx.verify;

// ─── Token contract ───────────────────────────────────────────────────────

test('G1: signPasswordResetToken + verifyPasswordResetToken happy-path round-trip', () => {
  const t = sign('email_abcdef0123456789', 'parent@example.com');
  assert.ok(typeof t === 'string' && t.includes('.'), 'token must be body.sig shape');
  const r = verify(t);
  assert.equal(r.ok, true, `verify must succeed: ${r.reason}`);
  assert.equal(r.payload.uid, 'email_abcdef0123456789');
  assert.equal(r.payload.email, 'parent@example.com');
  assert.equal(r.payload.purpose, 'pw-reset');
  assert.ok(r.payload.exp > Date.now(), 'exp must be in the future');
});

test('G1: tampered body rejected (sig_mismatch)', () => {
  const t = sign('u1', 'p@ex.com');
  const [body, sig] = t.split('.');
  const raw = Buffer.from(body, 'base64url').toString('utf8');
  const obj = JSON.parse(raw);
  obj.uid = 'attacker';
  const tamperedBody = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  const r = verify(`${tamperedBody}.${sig}`);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'sig_mismatch');
});

test('G1: tampered signature rejected', () => {
  const t = sign('u1', 'p@ex.com');
  const [body] = t.split('.');
  const r = verify(`${body}.AAAAAAAA`);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'sig_mismatch');
});

test('G1: malformed token rejected', () => {
  for (const bad of [null, '', 'no-dot', '.', 'foo.', '.bar', 42, undefined]) {
    const r = verify(bad);
    assert.equal(r.ok, false, `must reject: ${JSON.stringify(bad)}`);
  }
});

test('G1: expired token rejected with distinct reason', () => {
  const pastPayload = {
    uid: 'u1', email: 'p@ex.com', purpose: 'pw-reset',
    iat: Date.now() - 7200000, exp: Date.now() - 3600000,
  };
  const body = Buffer.from(JSON.stringify(pastPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', 'test-auth-secret-deterministic').update(body).digest('base64url');
  const r = verify(`${body}.${sig}`);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'expired');
});

test('G1: wrong-purpose token rejected (defense against token-class confusion)', () => {
  // A token with a different `purpose` (e.g., a future session-extension token)
  // must NOT be accepted by the reset verifier — distinct reasons per binding.
  const otherPurposePayload = {
    uid: 'u1', email: 'p@ex.com', purpose: 'something-else',
    iat: Date.now(), exp: Date.now() + 3600000,
  };
  const body = Buffer.from(JSON.stringify(otherPurposePayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', 'test-auth-secret-deterministic').update(body).digest('base64url');
  const r = verify(`${body}.${sig}`);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'purpose_mismatch');
});

test('G1: email-mismatch check (optional expectedEmail argument)', () => {
  const t = sign('u1', 'parent@example.com');
  const r1 = verify(t, 'parent@example.com');
  assert.equal(r1.ok, true);
  const r2 = verify(t, 'attacker@example.com');
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'email_mismatch');
});

test('G1: verifyPasswordResetToken uses crypto.timingSafeEqual (defense against timing side-channels)', () => {
  assert.match(verifySrc, /crypto\.timingSafeEqual\(/,
    'verifier must use crypto.timingSafeEqual for HMAC comparison');
});

// ─── Route source-grep — both endpoints + their guarantees ────────────────

test('G1 (server): /api/auth/forgot-password exists with rate limit + anti-enumeration', () => {
  const idx = SERVER_SRC.indexOf("app.post('/api/auth/forgot-password'");
  assert.ok(idx > 0, '/api/auth/forgot-password route must exist');
  const next = SERVER_SRC.indexOf('app.post(', idx + 50);
  const block = SERVER_SRC.slice(idx, next > 0 ? next : idx + 6000);
  assert.match(block, /rateLimit\(req\.ip,/, 'must apply rate limiting');
  // Anti-enumeration: non-existent account path returns 200 sent:true (not 404).
  assert.match(block, /forgot_password_no_account[\s\S]{0,300}res\.json\(\{\s*sent:\s*true/,
    'non-existent account must still return 200 sent:true (anti-enumeration)');
  // Structured telemetry on success.
  assert.match(block, /forgot_password_send_ok/, 'success path must emit [AUTH-FUNNEL] forgot_password_send_ok');
  // SendGrid send-failure surfaces as 502 (matching the verify-email pattern).
  assert.match(block, /forgot_password_send_failed[\s\S]{0,2000}res\.status\(502\)/,
    'SendGrid send-failure must 502 with structured reason');
});

test('G1 (server): /api/auth/reset-password exists with password validation + token verify', () => {
  const idx = SERVER_SRC.indexOf("app.post('/api/auth/reset-password'");
  assert.ok(idx > 0, '/api/auth/reset-password route must exist');
  const next = SERVER_SRC.indexOf('app.post(', idx + 50);
  const block = SERVER_SRC.slice(idx, next > 0 ? next : idx + 6000);
  assert.match(block, /password\.length\s*<\s*12/, 'must reject passwords shorter than 12');
  assert.match(block, /password\.length\s*>\s*128/, 'must reject passwords longer than 128');
  // v3.51.17 — relax regex to accept additional security args. The
  // function legitimately takes (token, expectedEmail?, lastResetAtMs?)
  // for replay-protection (per the verifyPasswordResetToken signature in
  // server.js line ~1378). The security invariant is: verify-call must
  // exist with `token` as the FIRST argument. The regex now allows
  // trailing args.
  assert.match(block, /verifyPasswordResetToken\(\s*token\s*[,)]/,
    'must verify the reset token (token must be the first arg of verifyPasswordResetToken)');
  // On success, the response shape matches register/login so the client logs the parent in directly.
  assert.match(block, /userId:\s*userData\.userId[\s\S]{0,500}token:\s*sessionToken/,
    'success response must carry userId+token (auto-login)');
  // Telemetry on success.
  assert.match(block, /reset_password_ok/, 'success must emit [AUTH-FUNNEL] reset_password_ok');
  // Token-invalid path is logged with the reason.
  assert.match(block, /reset_password_token_invalid/, 'token-invalid path must emit structured telemetry');
});

// ─── Client UI wiring ─────────────────────────────────────────────────────

test('G1 (client): Forgot Password button surfaces in both auth panels', () => {
  assert.match(HTML, /id="introForgotPassword"[\s\S]{0,200}App\.openForgotPassword\(\)/,
    'intro auth panel must have Forgot Password button');
  assert.match(HTML, /id="emailForgotPassword"[\s\S]{0,200}App\.openForgotPassword\(\)/,
    'welcome auth panel must have Forgot Password button');
});

test('G1 (client): Forgot-password + reset-password overlays exist with aria-modal + aria-live', () => {
  assert.match(HTML, /id="forgotPasswordOverlay"[\s\S]{0,2000}role="dialog"[\s\S]{0,200}aria-modal="true"/,
    'forgot-password overlay must be role=dialog aria-modal=true');
  assert.match(HTML, /id="forgotPasswordError"[\s\S]{0,200}aria-live="polite"/,
    'forgot-password error line must be aria-live polite (a11y binding)');
  assert.match(HTML, /id="resetPasswordOverlay"[\s\S]{0,2000}role="dialog"[\s\S]{0,200}aria-modal="true"/,
    'reset-password overlay must be role=dialog aria-modal=true');
  assert.match(HTML, /id="resetPasswordError"[\s\S]{0,200}aria-live="polite"/,
    'reset-password error line must be aria-live polite');
});

test('G1 (client): JS handlers + init wiring exist', () => {
  ['openForgotPassword', 'submitForgotPassword', 'closeForgotPassword',
   '_maybeOpenResetPassword', 'submitResetPassword', 'closeResetPassword'].forEach(fn => {
    assert.match(HTML, new RegExp('\\b' + fn + '\\s*[(:]'),
      'App must expose ' + fn);
  });
  // _maybeOpenResetPassword is called from init() — first thing after a11y settings.
  assert.match(HTML, /async init\(\)[\s\S]{0,500}_maybeOpenResetPassword\(\)/,
    '_maybeOpenResetPassword must be wired into init()');
  // The ?reset= URL param is stripped after read (so reload doesn't re-trigger).
  assert.match(HTML, /searchParams\.delete\(['"]reset['"]\)/,
    'must strip ?reset= from URL after reading the token');
});

console.log('[auth-password-reset] all assertions passed');
