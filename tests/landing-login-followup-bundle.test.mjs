// v3.51.77 — Audit follow-up bundle from the v3.51.75 / v3.51.76 cycle.
//
// Five fixes locked here:
//   U5.1 — Error text contrast: #introEmailError + #emailAuthError now use
//          a brighter carnelian shade that hits WCAG AA (4.5:1) against
//          the dark-chocolate background. Was var(--carnelian) #B8412B at
//          3.53:1 — failed AA for normal text.
//   U5.2 — Forgot Password link no longer carries opacity:.65 (which
//          dropped gold #C4A347 to 3.73:1). Now full-opacity gold = 8:1
//          AAA.
//   R2  — _handleEmailAuth stores data.jwt to sessionStorage immediately
//          on email-auth success. Was missing — every subsequent
//          requireAuth call had to silently _ensureJWT-refresh first.
//   M2  — GSI-blocked fallback hint: if #introGoogleBtn stays empty for
//          ~3s after initGoogleAuth (ad blocker / blocked script), reveal
//          #introGoogleFallbackHint with the explanatory text.
//   P3  — "Read a sample story →" teaser link in the landing intro
//          (points at /stories/imhotep-first-genius — already prerendered
//          + SEO-indexed). Try-before-sign-up.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

// ── U5.1 — error text contrast (AA) ─────────────────────────────────────

test('U5.1 — #introEmailError uses a brighter carnelian (≥4.5:1 on dark choc)', () => {
  const tag = html.match(/<div[^>]*id=["']introEmailError["'][^>]*>/);
  assert.ok(tag, '#introEmailError must exist');
  // Either an explicit color override or a CSS-variable bump. Detect the
  // override pattern: color:#E?[5-9F] (high-luminance reds).
  assert.match(tag[0], /color:\s*#[EF][0-9A-F][3-9A-F][0-9A-F]{3}/i,
    '#introEmailError must declare a brighter color (var(--carnelian) #B8412B fails WCAG AA at 3.53:1)');
});

test('U5.1 — #emailAuthError uses a brighter carnelian (≥4.5:1 on dark choc)', () => {
  const tag = html.match(/<div[^>]*id=["']emailAuthError["'][^>]*>/);
  assert.ok(tag, '#emailAuthError must exist');
  assert.match(tag[0], /color:\s*#[EF][0-9A-F][3-9A-F][0-9A-F]{3}/i,
    '#emailAuthError must declare a brighter color (WCAG AA)');
});

// ── U5.2 — Forgot Password link contrast ────────────────────────────────

test('U5.2 — Forgot Password buttons drop opacity:.65 (gold at full opacity = AAA)', () => {
  // The two Forgot Password buttons on the intro + welcome panels.
  const forgotBtns = [...html.matchAll(/<button[^>]*id=["'](intro|email)ForgotPassword["'][^>]*>/g)];
  assert.ok(forgotBtns.length >= 2, 'must find intro + welcome Forgot Password buttons');
  for (const m of forgotBtns) {
    assert.doesNotMatch(m[0], /opacity\s*:\s*\.6\d/,
      `Forgot Password button must not have opacity .6x (drops gold to ~3.7:1 — fails WCAG AA): ${m[0].slice(0,150)}`);
  }
});

// ── R2 — _handleEmailAuth stores JWT ────────────────────────────────────

test('R2 — _handleEmailAuth stores data.jwt to sessionStorage on success', () => {
  const idx = html.indexOf('_handleEmailAuth(data){');
  assert.ok(idx > 0, '_handleEmailAuth(data){ definition must exist');
  const body = html.slice(idx, idx + 2000);
  assert.match(body, /sessionStorage\.setItem\(['"]perankh_jwt['"]/,
    '_handleEmailAuth must persist data.jwt to sessionStorage["perankh_jwt"] — without it, every subsequent requireAuth call has to silently _ensureJWT-refresh');
  assert.match(body, /data\.jwt/,
    '_handleEmailAuth must reference data.jwt explicitly');
});

// ── M2 — GSI-blocked fallback hint ──────────────────────────────────────

test('M2 — GSI script-blocked detection wires the existing #introGoogleFallbackHint after a grace window', () => {
  // The detection must check whether #introGoogleBtn rendered any children
  // after a grace window (typical ad-blocker scenario: script never loads).
  // Look for a method that grace-checks the container then shows the hint.
  assert.match(html, /introGoogleBtn[\s\S]{0,200}children\.length\s*===?\s*0|introGoogleBtn[\s\S]{0,200}!\s*\w+\.children\.length/,
    'must include a check for #introGoogleBtn.children.length === 0 (GSI script blocked = empty container)');
  // And the existing fallback hint must be shown.
  assert.match(html, /introGoogleFallbackHint[\s\S]{0,400}style\.display\s*=\s*['"]block['"]/,
    'must reveal #introGoogleFallbackHint (style.display = "block") when GSI never rendered');
});

// ── P3 — "Read a sample story" teaser link ──────────────────────────────

test('P3 — landing intro includes a "Read a sample story" link to a prerendered story', () => {
  // The link should appear in the intro (anywhere in #intro), point to one
  // of the prerendered /stories/<slug> pages, and open in a new tab so the
  // visitor doesn't lose the sign-in flow they were on.
  const introStart = html.indexOf('<div id="intro"');
  assert.ok(introStart > 0, '#intro screen must exist');
  const introEnd = html.indexOf('<!-- ═══════════ WELCOME', introStart);
  const intro = html.slice(introStart, introEnd > 0 ? introEnd : introStart + 80000);
  // Must include an anchor pointing at /stories/<slug> AND visible text
  // mentioning sample/read/preview (either order — the <a> attribute order
  // varies between href-first and content-first).
  assert.match(intro, /\/stories\/[a-z0-9-]+/i,
    'landing #intro must link at least one /stories/<slug> page');
  assert.match(intro, /(sample\s*story|read\s*a\s*(sample|story)|preview\s*a?\s*story)/i,
    'landing #intro must include the visible "sample story" / "Read a sample" teaser text');
  // Must open in a new tab to preserve the sign-in flow.
  assert.match(intro, /\/stories\/[a-z0-9-]+[\s\S]{0,300}target=["']_blank["']/,
    'sample story link must target="_blank" so the visitor keeps their place');
  // rel="noopener" for security on new-tab links.
  assert.match(intro, /target=["']_blank["'][\s\S]{0,200}rel=["'][^"']*noopener/,
    'sample story link must rel="noopener" (security)');
});
