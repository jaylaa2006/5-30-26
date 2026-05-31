// Google OAuth audit fixes (v3.51.57).
// Locks the adversarial-audit findings so they can't regress:
//   R1 — init uses auto_select:false (no silent auto re-auth on shared device)
//   R3 — server tokeninfo verification has timeout + retry (no intermittent 500s)
//   R5 — _currentScreen seeded to 'intro' on load (routing guard reflects reality)
//   R4 — self-hosted GSI client carries a staleness/refresh note
//   F6 — Karnak carousel rotation starts only after the section loads
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');

test('R1 — Google init uses auto_select:false (not true)', () => {
  // The init initialize() block must not enable auto_select.
  const initBlock = html.match(/google\.accounts\.id\.initialize\(\{[\s\S]*?callback:[\s\S]*?\}\);/);
  assert.ok(initBlock, 'init initialize() block must exist');
  assert.match(initBlock[0], /auto_select:\s*false/,
    'init must use auto_select:false (silent auto re-auth is suspect on shared devices)');
  // Belt-and-suspenders: no auto_select:true anywhere.
  assert.doesNotMatch(html, /auto_select:\s*true/,
    'no initialize() may use auto_select:true');
});

test('R5 — _currentScreen seeded to "intro" before initGoogleAuth', () => {
  assert.match(html, /if\(!this\._currentScreen\)\s*this\._currentScreen\s*=\s*['"]intro['"]/,
    'must seed _currentScreen to "intro" on load (routing guard fix)');
  // The seed must come before initGoogleAuth so the guard is correct at first auth.
  const seedIdx = html.indexOf("this._currentScreen = 'intro'");
  const initIdx = html.indexOf('this.initGoogleAuth()');
  assert.ok(seedIdx > 0 && initIdx > 0 && seedIdx < initIdx,
    '_currentScreen seed must precede initGoogleAuth()');
});

test('R3 — server tokeninfo verification has AbortController timeout + retry', () => {
  const fn = server.match(/app\.post\(['"]\/api\/auth\/google['"][\s\S]*?\n\}\);/);
  assert.ok(fn, '/api/auth/google handler must exist');
  assert.match(fn[0], /AbortController/, 'must use AbortController timeout');
  assert.match(fn[0], /verifyOnce/, 'must factor verification into a retryable verifyOnce');
  assert.match(fn[0], /retry/i, 'must retry on transient failure');
  // 4xx must NOT be retried (real invalid token) — retry path keys on >=500/network.
  assert.match(fn[0], /status >= 500/, 'retry must trigger on 5xx, not 4xx');
});

test('R4 — self-hosted GSI client carries a refresh/staleness note', () => {
  assert.match(html, /FROZEN[\s\S]{0,40}snapshot/i,
    'GSI script must carry a frozen-snapshot note');
  assert.match(html, /Refresh quarterly[\s\S]{0,120}google-gsi-client\.js/i,
    'GSI note must give the refresh procedure');
  assert.match(html, /google-gsi-client\.js\?v=/,
    'GSI script should have a cache-buster for controlled refresh');
});

test('F6 — Karnak carousel rotation starts only after section loads (no spurious stall)', () => {
  const fn = html.match(/function setupKarnakCarousel\(\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fn, 'setupKarnakCarousel must exist');
  // Rotation is wrapped in startRotation(), invoked from the IntersectionObserver.
  assert.match(fn[0], /function startRotation\(\)/,
    'rotation must be wrapped in startRotation()');
  assert.match(fn[0], /rotationStarted\s*=\s*true;\s*startRotation\(\)/,
    'startRotation must be called from the IO intersection callback');
  // The setInterval must live INSIDE startRotation, not at setup top-level.
  const ioIdx = fn[0].indexOf('new IntersectionObserver');
  const intervalIdx = fn[0].indexOf('setInterval(');
  assert.ok(intervalIdx > ioIdx,
    'setInterval must come after the IO setup (inside startRotation)');
});

test('SW APP_VERSION at v39 for v3.51.83', () => {
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /APP_VERSION\s*=\s*'v39'/,
    'public/sw.js APP_VERSION must be v38 for the v3.51.83 sample-cards badge-style match ship');
});

// ─── v3.51.65 — FedCM opt-in + visible email fallback ───
// Chrome's third-party-cookie deprecation broke the legacy GIS popup credential
// relay: the account picker opens but selecting an account delivers no credential
// to the callback and nothing posts to /api/auth/google (confirmed live on prod).
// Fix: (a) FedCM opt-in on init, (b) a blur→focus watchdog that surfaces the
// always-present email path instead of a silent dead-end.

test('v3.51.65 — Google init opts into FedCM (cookie-free credential channel)', () => {
  const initBlock = html.match(/google\.accounts\.id\.initialize\(\{[\s\S]*?callback:[\s\S]*?\}\);/);
  assert.ok(initBlock, 'init initialize() block must exist');
  assert.match(initBlock[0], /use_fedcm_for_prompt:\s*true/,
    'init must opt into FedCM (legacy 3p-cookie popup relay is dead in current Chrome)');
});

test('v3.51.65 — visible email fallback hint exists in BOTH auth panels, default hidden, a11y-announced', () => {
  const introHint = html.match(/<div id="introGoogleFallbackHint"[^>]*>/);
  const welcomeHint = html.match(/<div id="googleFallbackHint"[^>]*>/);
  assert.ok(introHint, 'intro panel must have a fallback hint element');
  assert.ok(welcomeHint, 'welcome panel must have a fallback hint element');
  for (const h of [introHint[0], welcomeHint[0]]) {
    assert.match(h, /role="status"/, 'fallback hint must be role=status');
    assert.match(h, /aria-live="polite"/, 'fallback hint must be aria-live=polite (screen-reader announced)');
    assert.match(h, /display:none/, 'fallback hint must default hidden (revealed only by the watchdog)');
  }
});

test('v3.51.65 — fallback watchdog is defined, armed after render, idempotent, blur→focus driven', () => {
  assert.match(html, /_armGoogleFallbackWatchdog\(\)\s*\{/, 'watchdog method must be defined');
  assert.match(html, /_showGoogleFallback\(\)\s*\{/, 'fallback-shower method must be defined');
  assert.match(html, /this\._armGoogleFallbackWatchdog\(\);/, 'watchdog must be armed from initGoogleAuth');
  assert.match(html, /if\(this\._googleWatchdogArmed\)\s*return;/, 'arming must be idempotent');
  assert.match(html, /window\.addEventListener\('blur'/, 'must listen for window blur (popup/iframe focus-out)');
  assert.match(html, /window\.addEventListener\('focus'/, 'must listen for window focus (popup close)');
});

test('v3.51.65 — fallback only fires on auth screens, never after credential, no focus-yank (Coach C7)', () => {
  assert.match(html, /_showGoogleFallback\(\)\s*\{[\s\S]*?if\(this\._googleUser\)\s*return;/,
    'must bail if already signed in');
  assert.match(html, /_showGoogleFallback\(\)\s*\{[\s\S]*?sc\s*!==\s*'intro'\s*&&\s*sc\s*!==\s*'welcome'[\s\S]*?return;/,
    'must bail if user has left the auth flow (Coach C7)');
  assert.match(html, /_showGoogleFallback\(\)\s*\{[\s\S]*?!email\.value/,
    'must not yank focus if the user is mid-entry in the email field');
});

test('v3.51.65 — credential success retracts any visible fallback hint', () => {
  assert.match(html,
    /this\._googleUser = data;[\s\S]{0,400}introGoogleFallbackHint[\s\S]{0,160}googleFallbackHint/,
    'the credential-success path must hide both fallback hints right after setting _googleUser');
});
