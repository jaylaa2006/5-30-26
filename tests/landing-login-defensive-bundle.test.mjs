// v3.51.76 — Defensive UX + security follow-ups from the v3.51.75 audit.
//
// Four fixes locked here:
//   U3 — Show/hide password toggle on BOTH intro and welcome panels.
//        Parents typing 12+ char passwords on mobile need to verify what
//        they typed without exposing the password if a screen is shared.
//        Button defaults to type='password' (hidden), toggle reveals.
//   U4 — Caps-lock indicator on password fields. The mobile→laptop bounce
//        ("my password is right!" while CAPS is on) is a real silent-fail
//        before the lockout ladder ever kicks in.
//   S2 — Reject email with strippable characters server-side. The
//        register endpoint silently stripped `[^a-z0-9@._-]` from the
//        email, so `john+kid@example.com` registered as
//        `johnkid@example.com` — a different account than the visitor
//        thought. Now: 400 with explicit "Email contains unsupported
//        characters" if the safe-email != the input.
//   S3 — Cap `name` length server-side (client maxlength=20; server was
//        accepting raw). Trim to 40 chars defensively.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');

// ── U3 — show/hide password toggle ──────────────────────────────────────

test('U3 — intro password field has a show/hide toggle button', () => {
  // Look for a button with id 'introAuthPasswordToggle' (or similar)
  // adjacent to the introAuthPassword input.
  assert.match(html, /id=["']introAuthPasswordToggle["']/,
    'intro panel must include a password-visibility toggle button (id introAuthPasswordToggle)');
  // The toggle must wire to a real handler — not a window.alert / dead onclick.
  assert.match(html, /introAuthPasswordToggle[\s\S]{0,400}onclick=["'][^"']*togglePasswordVisibility/,
    'intro toggle must call App.togglePasswordVisibility (or equivalent handler)');
});

test('U3 — welcome panel password field has a show/hide toggle button', () => {
  assert.match(html, /id=["']authPasswordToggle["']/,
    'welcome panel must include a password-visibility toggle button (id authPasswordToggle)');
  assert.match(html, /authPasswordToggle[\s\S]{0,400}onclick=["'][^"']*togglePasswordVisibility/,
    'welcome toggle must call App.togglePasswordVisibility (or equivalent handler)');
});

test('U3 / Coach C7 — password inputs have padding-right so toggle button does not overlap typed chars', () => {
  // The toggle button is position:absolute right:6px; the input needs
  // padding-right ≥ ~48px so the typed dots don't slide under the button.
  // Both panels.
  const introInput = html.match(/<input[^>]*id=["']introAuthPassword["'][^>]*>/);
  const welcomeInput = html.match(/<input[^>]*id=["']authPassword["'][^>]*>/);
  assert.ok(introInput, '#introAuthPassword input must exist');
  assert.ok(welcomeInput, '#authPassword input must exist');
  for (const tag of [introInput[0], welcomeInput[0]]) {
    const m = tag.match(/padding-right\s*:\s*(\d+)px/);
    assert.ok(m, `password input must declare padding-right (room for the show/hide toggle): ${tag.slice(0, 200)}`);
    assert.ok(parseInt(m[1], 10) >= 44,
      `password input padding-right=${m[1]}px is too small for the ≥44px toggle button — typed chars will slide under: ${tag.slice(0, 200)}`);
  }
});

test('U3 — togglePasswordVisibility handler exists and flips type attribute', () => {
  // Find the DEFINITION (parameter form: togglePasswordVisibility(inputId, btnId){)
  const def = html.indexOf('togglePasswordVisibility(inputId, btnId){');
  assert.ok(def > 0, 'togglePasswordVisibility(inputId, btnId){ definition must exist');
  const body = html.slice(def, def + 1200);
  // Must read input.type, flip between 'password' and 'text'.
  assert.match(body, /\.type\s*=\s*\w+\s*\?\s*['"]text['"]\s*:\s*['"]password['"]|\.type\s*=\s*['"](?:password|text)['"]/,
    'togglePasswordVisibility must set input.type between password and text');
  // a11y: must update aria-pressed or aria-label so SR announces state change.
  assert.match(body, /aria-(pressed|label)/i,
    'togglePasswordVisibility must update aria-pressed/aria-label for SR announcement');
});

// ── U4 — caps-lock indicator ────────────────────────────────────────────

test('U4 — caps-lock indicator wired to password fields', () => {
  // Need a small visible indicator that appears when caps-lock is on while
  // the password field has focus. Either inline or via a helper.
  // Look for the event-listener pattern: getModifierState('CapsLock').
  assert.match(html, /getModifierState\(['"]CapsLock['"]\)/,
    'must use KeyboardEvent.getModifierState("CapsLock") to detect caps-lock state');
  // And a wired DOM hook (element id) so the indicator can show.
  assert.match(html, /id=["'](introCapsLockHint|capsLockHint|authCapsLockHint)["']/,
    'must include a caps-lock hint element (id introCapsLockHint / authCapsLockHint / capsLockHint)');
});

// ── S2 — reject email with strippable characters ────────────────────────

test('S2 — /api/auth/register rejects emails that contain unsupported characters', () => {
  const idx = server.indexOf("app.post('/api/auth/register'");
  assert.ok(idx > 0, '/api/auth/register route must exist');
  const next = server.indexOf("app.post('/api/", idx + 100);
  const route = server.slice(idx, next > 0 ? next : idx + 8000);
  // The route already computes `safeEmail` via [^a-z0-9@._-] strip. Now it
  // must compare against a normalized input and reject mismatch with 400.
  assert.match(route, /unsupported\s*characters|invalid\s*characters|email\s*format/i,
    'register must surface a specific error when email contains strippable characters (not silently strip)');
  // Must do the actual mismatch comparison.
  assert.match(route, /safeEmail\s*!==?\s*\w+|\w+\s*!==?\s*safeEmail/,
    'register must compare normalized email to a baseline (lowercased+trimmed input) and reject on mismatch');
});

// ── S3 — name length cap server-side ────────────────────────────────────

test('S3 — /api/auth/register caps `name` length server-side', () => {
  const idx = server.indexOf("app.post('/api/auth/register'");
  assert.ok(idx > 0, '/api/auth/register route must exist');
  const next = server.indexOf("app.post('/api/", idx + 100);
  const route = server.slice(idx, next > 0 ? next : idx + 8000);
  // Must cap the name before persisting. Look for .slice(0, NN) on a name-ish
  // var, or an explicit length check that rejects >NN.
  const hasCap = /name\.trim\(\)\.slice\(0,\s*\d{1,3}\)/.test(route) ||
                 /name\.slice\(0,\s*\d{1,3}\)/.test(route) ||
                 /name.{0,40}length\s*>\s*\d{1,3}/.test(route) ||
                 // Defensive String(name || '').trim().slice(...) pattern
                 /String\s*\(\s*name[\s\S]{0,30}\)\.trim\(\)\.slice\(\s*0\s*,\s*\d{1,3}\s*\)/.test(route);
  assert.ok(hasCap,
    'register must cap or reject overlong `name` server-side (client maxlength=20 is a hint, not a contract; >100 chars accepted before this fix)');
});
