#!/usr/bin/env node
// tests/auth-stop-the-bleed.test.mjs
// 2026-05-15 — auth subsystem 2nd-eyes RT bindings, Phase 1 stop-the-bleed:
// G2 (verify-email send-failure surfacing), G4 (PIN_EXISTS recovery hint),
// G6 (spam-folder + support contact in verify-code overlay), G7 (Seba-voice
// tone-canon on the verification email).
//
// Source-grep tests — assert the contract is locked, no runtime needed.
//
// Run: node --test tests/auth-stop-the-bleed.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiSrc = fs.readFileSync('seba-story-api.mjs', 'utf8');
const html   = fs.readFileSync('maat-reader.html', 'utf8');

// Extract the /api/seba-verify-email handler block (between its app.post and the next app.post).
function routeBlock(src, route) {
  const idx = src.indexOf(`app.post('${route}'`);
  if (idx < 0) throw new Error('route not found: ' + route);
  const next = src.indexOf('app.post(', idx + 50);
  return src.slice(idx, next > 0 ? next : idx + 6000);
}

// ─── G7 — Seba-voice tone-canon on the verify email ───────────────────────

test('G7: verify-email subject + from-name are Seba-voice (not generic "Per Ankh Reader")', () => {
  const block = routeBlock(apiSrc, '/api/seba-verify-email');
  assert.match(block, /from:\s*\{\s*name:\s*['"]Seba Khafre[^'"]*['"]/,
    'from-name must be Seba Khafre, not "Per Ankh Reader"');
  assert.match(block, /subject:\s*['"]Seba Khafre — Your access code['"]/,
    'subject must be "Seba Khafre — Your access code"');
  assert.doesNotMatch(block, /from:\s*\{\s*name:\s*['"]Per Ankh Reader['"]/,
    'must NOT use the generic "Per Ankh Reader" from-name');
});

test('G7: email body uses Africana declarative register (Senebty greeting, no celebration)', () => {
  const block = routeBlock(apiSrc, '/api/seba-verify-email');
  assert.match(block, />Senebty\./, 'body must open with the Kemetic greeting "Senebty."');
  assert.match(block, /The path opens with this code/, 'body must use Seba\'s declarative register');
  // No celebration patter — tone-canon binding.
  assert.doesNotMatch(block, /(?:congrats|congratulations|amazing|woohoo|great job|🎉|✨|🌟)/i,
    'body must not contain celebration patter or exclamation emojis');
});

// ─── G2 — verify-email send-failure surfacing ─────────────────────────────

test('G2 (server): SendGrid-not-configured returns 502 (not 200) with structured reason', () => {
  const block = routeBlock(apiSrc, '/api/seba-verify-email');
  // The not-configured branch must 502, not silently 200. Widened window —
  // the structured AUTH-FUNNEL log line between guard and return is ~400 chars.
  assert.match(block,
    /!process\.env\.SENDGRID_API_KEY[\s\S]{0,1500}res\.status\(502\)[\s\S]{0,400}reason:\s*['"]sendgrid_not_configured['"]/,
    'sendgrid-not-configured path must return 502 with reason="sendgrid_not_configured"');
});

test('G2 (server): SendGrid non-2xx response is detected (not just thrown errors)', () => {
  const block = routeBlock(apiSrc, '/api/seba-verify-email');
  // v3.51.x DEMETRIS remediation: the once-inline statusCode inspection moved
  // INTO the bounded-retry helper (lib/email-retry.mjs — exhaustively unit-
  // tested in tests/email-retry.test.mjs). The call site now delegates to
  // sendEmailWithRetry and branches on the structured outcome. Non-2xx is still
  // detected + distinguished from throws, and still surfaces as a 502.
  assert.match(block, /sendEmailWithRetry\(/,
    'must delegate the send to the bounded-retry helper');
  assert.match(block, /sendOutcome\.reason\s*===\s*['"]sendgrid_non2xx['"]/,
    'must still distinguish non-2xx response from throw (via the structured outcome)');
  assert.match(block, /sendgrid_non2xx/,
    'non-2xx reason must still drive the failure response');
  assert.match(block, /res\.status\(502\)/,
    'a send failure (throw OR non-2xx) must still return 502, never a silent 200');
});

test('G2 (server): structured [AUTH-FUNNEL] events emitted for both success and failure paths', () => {
  const block = routeBlock(apiSrc, '/api/seba-verify-email');
  assert.match(block, /\[AUTH-FUNNEL\][\s\S]{0,200}event:\s*['"]verify_send_ok['"]/,
    'success path must emit [AUTH-FUNNEL] verify_send_ok');
  assert.match(block, /\[AUTH-FUNNEL\][\s\S]{0,400}event:\s*['"]verify_send_failed['"]/,
    'failure path must emit [AUTH-FUNNEL] verify_send_failed');
  // Privacy: email is hashed before logging, never raw.
  assert.match(block, /email_hash[\s\S]{0,100}createHash\(['"]sha256/,
    'email must be hashed (sha256) for telemetry — never raw');
});

test('G2 (client): client inspects data.sent before opening verify-code overlay', () => {
  // The verify-email POST in the PIN-creation flow must check data.sent === true.
  assert.match(html, /seba-verify-email[\s\S]{0,1200}verifyData\.sent\s*===\s*true/,
    'client must check verifyData.sent === true before opening overlay');
  // Failure path surfaces an actionable error in the overlay.
  assert.match(html, /verifyCodeError[\s\S]{0,400}seba@osiriscare\.net/,
    'send-failure path must surface seba@osiriscare.net contact in verifyCodeError');
});

// ─── G4 — PIN_EXISTS recovery hint ────────────────────────────────────────

test('G4 (client): PIN_EXISTS 403 from register-parent auto-routes to forgot-PIN', () => {
  // The client must detect errData.code === 'PIN_EXISTS' and trigger forgotPin().
  assert.match(html, /errData\.code\s*===\s*['"]PIN_EXISTS['"]/,
    'client must detect PIN_EXISTS code on register-parent failure');
  assert.match(html,
    /errData\.code\s*===\s*['"]PIN_EXISTS['"][\s\S]{0,600}forgotPin\(\)/,
    'PIN_EXISTS branch must call forgotPin() to recover');
});

// ─── G6 — spam-folder + support contact hint in verify-code overlay ───────

test('G6: verifyCodeOverlay HTML includes spam-folder + support-contact hint', () => {
  // Find the overlay block.
  const idx = html.indexOf('id="verifyCodeOverlay"');
  assert.ok(idx > 0, 'verifyCodeOverlay must exist');
  const end = html.indexOf('</div>\n\n', idx);
  const overlay = html.slice(idx, end > 0 ? end + 50 : idx + 3000);
  assert.match(overlay, /spam folder/i, 'overlay must mention "spam folder"');
  assert.match(overlay, /mailto:seba@osiriscare\.net/,
    'overlay must link to seba@osiriscare.net for support');
});

console.log('[auth-stop-the-bleed] all assertions passed');
