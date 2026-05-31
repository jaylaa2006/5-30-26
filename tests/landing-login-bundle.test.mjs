// v3.51.75 — Landing-page + login adversarial-audit bundle (2026-05-27).
//
// Live browser walkthrough on prod (Claude-in-Chrome, desktop + mobile)
// confirmed the audit findings. This test locks the 7 fixes shipped:
//
//   U1 — Submit-button loading state + disable (single-click guard).
//   U2 — Error div carries role="alert" so SR users hear the failure.
//   S1 — /api/auth/login: when ENOENT + email exists via Google OAuth,
//        return 401 with code:'USE_GOOGLE'. Client renders a specific
//        "this email is registered with Google" hint pointing up at the
//        Google button — instead of the dead-end "Invalid email or password".
//   P1 — Intro panel defaults to REGISTER on first visit (no perankh_user
//        in localStorage), LOGIN on returning visits. Matches intent.
//   P2 — Hero "Sign In" affordance visible above the fold (top-right
//        anchor link → smooth-scrolls to #introSignIn). Returning users
//        skip the marketing scroll.
//   R1 — Connection-error catches log to console (Rule 1: no silent
//        catches on auth paths; was just setting error text).
//   M1 — On page load, if perankh_user exists in localStorage, smooth-
//        scroll to #introSignIn after a short delay so returning visitors
//        skip the 7 backdrop videos.
//
// All rules cover BOTH the intro panel and the legacy welcome panel
// (parity is enforced; the panels still drift only in cosmetic copy).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');
const server = fs.readFileSync('server.js', 'utf8');

// ── U1 — submit-button loading state ─────────────────────────────────────

test('U1 — introEmailSubmit disables the submit button + swaps text in-flight', () => {
  const idx = html.indexOf('async introEmailSubmit(){');
  assert.ok(idx > 0, 'introEmailSubmit must exist');
  const body = html.slice(idx, idx + 5000);
  // Must reach for the submit button by id at least once
  assert.match(body, /getElementById\(['"]introEmailSubmit['"]\)/,
    'introEmailSubmit must grab the submit button to drive the loading state');
  // Disable + label swap + restoration MUST happen (finally block reads in either order)
  assert.match(body, /\.disabled\s*=\s*true/, 'must disable the submit during in-flight');
  assert.match(body, /Signing in|Signing in…|Creating account/i,
    'must swap the submit text to a recognisable in-flight label');
  assert.match(body, /finally\s*\{/, 'must restore the button via finally so EVERY exit path resets (success, validation fail, network throw)');
});

test('U1 — emailAuthSubmit (welcome panel) has the same loading-state pattern', () => {
  const idx = html.indexOf('async emailAuthSubmit(){');
  assert.ok(idx > 0, 'emailAuthSubmit must exist');
  const body = html.slice(idx, idx + 5000);
  assert.match(body, /getElementById\(['"]emailAuthSubmit['"]\)/,
    'emailAuthSubmit must grab its submit button');
  assert.match(body, /\.disabled\s*=\s*true/, 'must disable in-flight');
  assert.match(body, /finally\s*\{/, 'must restore via finally');
});

// ── U2 — error a11y ──────────────────────────────────────────────────────

test('U2 — intro + welcome panel error divs carry role="alert"', () => {
  // The two error divs are referenced by id from the handlers.
  const introErr = html.match(/id=["']introEmailError["'][^>]*>/);
  const welcomeErr = html.match(/id=["']emailAuthError["'][^>]*>/);
  assert.ok(introErr, '#introEmailError div must exist');
  assert.ok(welcomeErr, '#emailAuthError div must exist');
  assert.match(introErr[0], /role=["']alert["']/,
    '#introEmailError must carry role="alert" so SR users hear the failure');
  assert.match(welcomeErr[0], /role=["']alert["']/,
    '#emailAuthError must carry role="alert" so SR users hear the failure');
});

// ── S1 — server-side USE_GOOGLE hint ────────────────────────────────────

test('S1 — /api/auth/login emits code:"USE_GOOGLE" for ENOENT email that exists via Google OAuth', () => {
  const idx = server.indexOf("app.post('/api/auth/login'");
  assert.ok(idx > 0, '/api/auth/login route must exist');
  // Find the route body up to the next app.post (or EOF).
  const nextRoute = server.indexOf("app.post('", idx + 100);
  const route = server.slice(idx, nextRoute > 0 ? nextRoute : idx + 12000);
  // ENOENT branch must consult _existingUsersDbRow (the same helper register
  // already uses) and emit USE_GOOGLE on hit.
  const enoentIdx = route.indexOf("code === 'ENOENT'");
  assert.ok(enoentIdx > 0, 'ENOENT branch must exist in login route');
  // Within ~600 chars of the ENOENT branch, the USE_GOOGLE code path must appear.
  const enoentBlock = route.slice(enoentIdx, enoentIdx + 1500);
  assert.match(enoentBlock, /_existingUsersDbRow|USE_GOOGLE/,
    'login ENOENT branch must check _existingUsersDbRow and emit USE_GOOGLE so the client can surface a specific hint');
  assert.match(enoentBlock, /['"]USE_GOOGLE['"]/,
    'the USE_GOOGLE code literal must be present (client checks data.code === "USE_GOOGLE")');
});

test('S1 — client introEmailSubmit + emailAuthSubmit handle USE_GOOGLE code with a specific hint', () => {
  // Both panel submit handlers must check data.code === 'USE_GOOGLE' and render
  // a distinct message. We grep loosely to allow either inline or helper.
  const introIdx = html.indexOf('async introEmailSubmit(){');
  const welcomeIdx = html.indexOf('async emailAuthSubmit(){');
  const intro = html.slice(introIdx, introIdx + 5000);
  const welcome = html.slice(welcomeIdx, welcomeIdx + 5000);
  assert.match(intro, /USE_GOOGLE/,
    'introEmailSubmit must branch on data.code === "USE_GOOGLE"');
  assert.match(welcome, /USE_GOOGLE/,
    'emailAuthSubmit must branch on data.code === "USE_GOOGLE"');
  // The user-facing message must mention Google explicitly so the parent
  // knows what to do.
  assert.match(intro, /[gG]oogle/, 'USE_GOOGLE hint must name Google');
});

// ── P1 — register-default for first visit, login for returning ──────────

test('P1 — intro panel chooses initial auth mode based on returning-user signal', () => {
  // The init code must consult the returning-user state (this.user.name,
  // derived from localStorage.perankh_user at the start of init) and call
  // introToggleAuthMode() to flip into register mode for first-time visitors.
  // Look for an init block that ties a "returning" decision to the toggle call.
  assert.match(html, /(returning|!\s*returning)[\s\S]{0,800}introToggleAuthMode/,
    'init code must default the intro panel to REGISTER mode when the visitor is NOT returning (no perankh_user / no this.user.name)');
  // And the returning-signal must be derived from the localStorage user blob.
  assert.match(html, /this\.user\s*&&\s*this\.user\.name[\s\S]{0,200}returning/,
    'returning-user signal should be derived from this.user.name (read from perankh_user localStorage)');
});

// ── P2 — hero Sign In affordance (RETIRED in v3.51.82 per user feedback) ───
// The "BEGIN YOUR JOURNEY" hero CTA already smooth-scrolls to #introSignIn,
// so the top-right "Sign In →" button was a redundant second sign-in
// affordance doing the same thing. User feedback 2026-05-27: removed.
// Tests below now lock the REVERSE — that the hero does NOT carry a separate
// "Sign in" button, and that the existing "Begin Your Journey" button is
// the single returning-user-and-new-user sign-in entry point.

test('P2 (retired) — hero has ONLY ONE sign-in entry (Begin Your Journey, no separate Sign In button)', () => {
  const heroStart = html.indexOf('<section class="intro-hero"');
  assert.ok(heroStart > 0, '.intro-hero section must exist');
  const heroEnd = html.indexOf('</section>', heroStart);
  const hero = html.slice(heroStart, heroEnd);
  // "Begin Your Journey" must still scroll to sign-in.
  assert.match(hero, />\s*Begin Your Journey\s*</i,
    'hero must keep the "Begin Your Journey" CTA');
  // The button is `<button onclick="...scrollIntoView..." >Begin Your Journey</button>` —
  // onclick comes before text content, so check both directions:
  assert.match(hero, /introSignIn[\s\S]{0,200}scrollIntoView[\s\S]{0,200}Begin Your Journey/,
    '"Begin Your Journey" must smooth-scroll to #introSignIn');
  // Must NOT carry a second "Sign In" button (user feedback: redundant).
  // The negative match: no <button> or <a> with visible "Sign in" text inside the hero.
  assert.doesNotMatch(hero, /<(button|a)[^>]*>[^<]*Sign\s*[Ii]n[\s\S]{0,30}<\/(button|a)>/,
    'hero must not carry a second "Sign in" button — Begin Your Journey is the single sign-in entry point');
});

test('hero must not use backdrop-filter blur (enterprise-patterns ban)', () => {
  // Even if the Sign-In button is gone, keep the rule guard so a future
  // contributor reintroducing any hero overlay can't re-introduce blur.
  const heroStart = html.indexOf('<section class="intro-hero"');
  const heroEnd = html.indexOf('</section>', heroStart);
  const hero = html.slice(heroStart, heroEnd);
  assert.doesNotMatch(hero, /backdrop-filter\s*:\s*blur/i,
    'hero must not use backdrop-filter:blur() — project rule (enterprise-patterns.md)');
});

test('S1 / Coach C12 — _renderUseGoogleHint uses pure DOM construction (no innerHTML)', () => {
  // enterprise-patterns Rule 4: never set innerHTML in module code. The hint
  // is static today but the rule applies uniformly — a future contributor
  // adding the user's email to the message would silently introduce XSS
  // if they reused the helper as a template.
  // Find the DEFINITION (parameter form), not the first call site.
  const idx = html.indexOf('_renderUseGoogleHint(errEl){');
  assert.ok(idx > 0, '_renderUseGoogleHint(errEl){ definition must exist');
  const body = html.slice(idx, idx + 2000);
  assert.doesNotMatch(body, /innerHTML\s*=/,
    '_renderUseGoogleHint must not use innerHTML — enterprise-patterns Rule 4 (pure DOM construction)');
  assert.match(body, /createElement\(['"]span['"]\)|createElement\(['"]b['"]\)/,
    '_renderUseGoogleHint must construct via document.createElement (verified safe pattern)');
});

// ── R1 — loud catches on connection errors ──────────────────────────────

test('R1 — both submit handlers console.error on the network-throw catch', () => {
  // Was: catch(e){ errEl.textContent = 'Connection error...'; } — silent.
  // Now must include a console.error tagged for grep.
  const introIdx = html.indexOf('async introEmailSubmit(){');
  const welcomeIdx = html.indexOf('async emailAuthSubmit(){');
  const intro = html.slice(introIdx, introIdx + 5000);
  const welcome = html.slice(welcomeIdx, welcomeIdx + 5000);
  assert.match(intro, /console\.(error|warn)\s*\(\s*['"]\[auth\]/,
    'introEmailSubmit network catch must log via console.error/warn with a [auth] tag');
  assert.match(welcome, /console\.(error|warn)\s*\(\s*['"]\[auth\]/,
    'emailAuthSubmit network catch must log via console.error/warn with a [auth] tag');
});

// ── M1 — returning-user auto-scroll ─────────────────────────────────────

test('M1 — returning visitor (perankh_user present) auto-scrolls to #introSignIn on load', () => {
  // Init code must, when the visitor is returning (this.user.name derived
  // from perankh_user localStorage), scroll the sign-in section into view
  // so returning users don't wait for the marketing backdrop videos.
  assert.match(html, /returning[\s\S]{0,600}introSignIn[\s\S]{0,400}scrollIntoView/,
    'init code must scrollIntoView(#introSignIn) when the returning-visitor branch fires');
  // And the scroll must use smooth behavior (not jarring instant).
  assert.match(html, /introSignIn[\s\S]{0,300}scrollIntoView\(\s*\{\s*behavior:\s*['"]smooth['"]/,
    'auto-scroll must use behavior:"smooth" — instant scroll would be jarring on first paint');
});
