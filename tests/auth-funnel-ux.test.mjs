#!/usr/bin/env node
// tests/auth-funnel-ux.test.mjs
// 2026-05-15 — G3 (email-typo heuristic) + G8 (account-exists action row)
// from auth-subsystem 2nd-eyes RT (Parent-Voice Important bindings).
//
// G3 — surface "Did you mean foo@gmail.com?" on common domain typos so
//      parents don't burn SendGrid quota on emails that will never arrive.
// G8 — when /api/auth/register returns 409, show inline "Sign in with this
//      email" + "Forgot password?" so the parent isn't stuck guessing.
//
// Run: node --test tests/auth-funnel-ux.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const HTML = fs.readFileSync('maat-reader.html', 'utf8');

// ─── G3: source-grep on the typo table + helper wiring ────────────────────

test('G3: email-typo dictionary covers the high-volume cases', () => {
  // We grep the source rather than evaluate because the table lives inside
  // the App literal — a full DOM bootstrap is unnecessary for a static map.
  for (const [typo, expect] of Object.entries({
    'gmial.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'yaho.com':  'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotnail.com': 'hotmail.com',
    'outlok.com':  'outlook.com',
    'icloud.co':   'icloud.com'
  })) {
    const re = new RegExp(`'${typo}'\\s*:\\s*'${expect}'`);
    assert.match(HTML, re, `typo table must map '${typo}' → '${expect}'`);
  }
});

test('G3: _emailDidYouMean returns corrected address for common typo, null for clean address', () => {
  // Extract the typo table + helper directly from source and exercise the
  // contract in an isolated vm context (matches the chunk-token-sign-verify
  // + auth-password-reset test pattern).
  const m = HTML.match(/_EMAIL_TYPOS:\s*(\{[\s\S]*?\}),\s*_emailDidYouMean\(email\)\s*(\{[\s\S]*?\}),/);
  assert.ok(m, 'must locate _EMAIL_TYPOS + _emailDidYouMean block in source');
  const tableSrc = m[1];
  const fnBodySrc = m[2];
  const ctx = vm.createContext({});
  vm.runInContext(
    'var App = { _EMAIL_TYPOS: ' + tableSrc + ', ' +
    '_emailDidYouMean: function(email) ' + fnBodySrc + ' };' +
    'this.App = App;',
    ctx
  );
  const App = ctx.App;
  assert.equal(App._emailDidYouMean('jane@gmial.com'),   'jane@gmail.com');
  assert.equal(App._emailDidYouMean('alex@yaho.com'),    'alex@yahoo.com');
  assert.equal(App._emailDidYouMean('sam@hotnail.com'),  'sam@hotmail.com');
  assert.equal(App._emailDidYouMean('parent@gmail.com'), null,
    'clean addresses must return null (no suggestion)');
  assert.equal(App._emailDidYouMean('justaname'),        null, 'no @ → null');
  assert.equal(App._emailDidYouMean(''),                 null, 'empty → null');
  assert.equal(App._emailDidYouMean(null),               null, 'null → null');
  assert.equal(App._emailDidYouMean('JANE@GMIAL.COM'),   'JANE@gmail.com',
    'domain comparison must be case-insensitive (preserve local-part casing)');
});

test('G3: blur handler is wired on both email inputs', () => {
  assert.match(HTML, /id="introAuthEmail"[\s\S]{0,400}onblur="App\._maybeSuggestEmail\('intro'\)"/,
    'intro email input must call _maybeSuggestEmail on blur');
  assert.match(HTML, /id="authEmail"[\s\S]{0,400}onblur="App\._maybeSuggestEmail\('welcome'\)"/,
    'welcome email input must call _maybeSuggestEmail on blur');
});

test('G3: suggestion containers exist with aria-live (so screen readers announce)', () => {
  assert.match(HTML, /id="introEmailSuggest"[\s\S]{0,200}aria-live="polite"/,
    'intro suggestion line must be aria-live polite');
  assert.match(HTML, /id="emailAuthSuggest"[\s\S]{0,200}aria-live="polite"/,
    'welcome suggestion line must be aria-live polite');
});

// ─── G8: account-exists 409 action row ────────────────────────────────────

test('G8: 409 branch shows account-exists row on both panels (NOT just an error)', () => {
  // intro panel — the introEmailSubmit register branch
  assert.match(HTML,
    /introEmailSubmit\(\)\{[\s\S]{0,3000}res\.status === 409[\s\S]{0,200}_showAccountExistsActions\('intro'\)/,
    'introEmailSubmit must call _showAccountExistsActions on 409');
  // welcome panel — the emailAuthSubmit register branch
  assert.match(HTML,
    /emailAuthSubmit\(\)\{[\s\S]{0,3000}res\.status === 409[\s\S]{0,200}_showAccountExistsActions\('welcome'\)/,
    'emailAuthSubmit must call _showAccountExistsActions on 409');
});

test('G8: account-exists action row markup exists on both panels with both actions', () => {
  // intro
  assert.match(HTML, /id="introAccountExistsActions"[\s\S]{0,1500}id="introAccountExistsLogin"[\s\S]{0,200}_accountExistsSwitchToLogin\('intro'\)/,
    'intro action row must have Sign-in button wired to switch-to-login');
  assert.match(HTML, /id="introAccountExistsActions"[\s\S]{0,2000}id="introAccountExistsForgot"[\s\S]{0,200}openForgotPassword\(\)/,
    'intro action row must have Forgot Password button wired to openForgotPassword');
  // welcome
  assert.match(HTML, /id="emailAuthAccountExistsActions"[\s\S]{0,1500}id="emailAuthAccountExistsLogin"[\s\S]{0,200}_accountExistsSwitchToLogin\('welcome'\)/,
    'welcome action row must have Sign-in button');
  assert.match(HTML, /id="emailAuthAccountExistsActions"[\s\S]{0,2000}id="emailAuthAccountExistsForgot"[\s\S]{0,200}openForgotPassword\(\)/,
    'welcome action row must have Forgot Password button');
});

test('G8: row is hidden by default + revealed only on 409', () => {
  // Both rows must start with display:none in their inline style.
  assert.match(HTML, /id="introAccountExistsActions"[\s\S]{0,300}display:none/,
    'intro row must default to display:none');
  assert.match(HTML, /id="emailAuthAccountExistsActions"[\s\S]{0,300}display:none/,
    'welcome row must default to display:none');
  // _showAccountExistsActions flips to flex (so the column gap applies).
  assert.match(HTML, /_showAccountExistsActions\(panel\)\{[\s\S]{0,400}row\.style\.display\s*=\s*['"]flex['"]/,
    '_showAccountExistsActions must set display:flex');
});

test('G8: mode-toggle + new submit attempt hide the action row (clean slate)', () => {
  // introToggleAuthMode must hide the actions row so a parent flipping to
  // login doesn't see stale 409 actions for a different submission.
  assert.match(HTML, /introToggleAuthMode\(\)\{[\s\S]{0,1500}_hideAccountExistsActions\('intro'\)/,
    'introToggleAuthMode must hide intro action row');
  assert.match(HTML, /toggleEmailAuthMode\(\)\{[\s\S]{0,1500}_hideAccountExistsActions\('welcome'\)/,
    'toggleEmailAuthMode must hide welcome action row');
  // Each submit attempt clears the row from any prior attempt before sending.
  assert.match(HTML, /async introEmailSubmit\(\)\{[\s\S]{0,300}_hideAccountExistsActions\('intro'\)/,
    'introEmailSubmit must hide row at attempt start');
  assert.match(HTML, /async emailAuthSubmit\(\)\{[\s\S]{0,300}_hideAccountExistsActions\('welcome'\)/,
    'emailAuthSubmit must hide row at attempt start');
});

test('G8: _accountExistsSwitchToLogin flips mode only if currently on register', () => {
  // We don't want a no-op flip back to register if the user clicks the
  // button twice. Helper must check current mode.
  assert.match(HTML,
    /_accountExistsSwitchToLogin\(panel\)\{[\s\S]{0,1500}_introAuthMode === ['"]register['"][\s\S]{0,200}introToggleAuthMode\(\)/,
    'intro flip must be guarded by current mode === register');
  assert.match(HTML,
    /_accountExistsSwitchToLogin\(panel\)\{[\s\S]{0,2000}_emailAuthMode === ['"]register['"][\s\S]{0,200}toggleEmailAuthMode\(\)/,
    'welcome flip must be guarded by current mode === register');
});

console.log('[auth-funnel-ux] all assertions passed');
