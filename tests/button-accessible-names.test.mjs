#!/usr/bin/env node
// v3.44.1 — Regression test for accessible-name coverage on nav/back buttons.
// Triggered by user-reported "blank top-right button" screenshot. Live sweep
// found no DOM blanks at desktop, but the bug was likely either a font-load
// race or a stale-cache pre-v3.44.0. Defense-in-depth fix:
//   1. white-space:nowrap + flex-shrink:0 on .btn-small (CSS)
//   2. App._auditButtons() runtime diagnostic
//   3. aria-label on every nav/back button so screen readers always have a
//      label even if text rendering is mid-flight.
//
// This test source-pattern-locks rule #3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('v3.44.1 — every screen-back nav button has aria-label', () => {
  // Match every <button class="screen-back" onclick="App.nav(...)"...>
  // and assert aria-label is present (in any attribute order).
  const matches = html.match(/<button[^>]*class="screen-back"[^>]*onclick="App\.nav\([^)]+\)"[^>]*>/g) || [];
  assert.ok(matches.length >= 6, `expected ≥6 screen-back nav buttons, found ${matches.length}`);
  const offenders = matches.filter(m => !/aria-label\s*=\s*"[^"]+"/.test(m));
  assert.equal(offenders.length, 0,
    `screen-back nav buttons missing aria-label:\n` + offenders.join('\n'));
});

test('v3.44.1 — every reader-back nav button has aria-label', () => {
  const matches = html.match(/<button[^>]*class="reader-back"[^>]*>/g) || [];
  assert.ok(matches.length >= 1, `expected ≥1 reader-back, found ${matches.length}`);
  const offenders = matches.filter(m => !/aria-label\s*=\s*"[^"]+"/.test(m));
  assert.equal(offenders.length, 0,
    `reader-back missing aria-label:\n` + offenders.join('\n'));
});

test('v3.44.1 — every btn btn-small with App.nav() has aria-label', () => {
  // class can be in any order
  const matches = html.match(/<button[^>]*class="(btn btn-small|btn-small btn)"[^>]*onclick="App\.nav\([^)]+\)"[^>]*>/g) || [];
  assert.ok(matches.length >= 5, `expected ≥5 nav btn-small buttons, found ${matches.length}`);
  const offenders = matches.filter(m => !/aria-label\s*=\s*"[^"]+"/.test(m));
  assert.equal(offenders.length, 0,
    `btn btn-small with App.nav() missing aria-label:\n` + offenders.join('\n'));
});

test('v3.44.1 — App._auditButtons diagnostic helper is exposed', () => {
  // Verify the helper definition exists with the expected behavior (walks
  // visible buttons, returns issues list, structured-logs to console).
  assert.match(html, /_auditButtons\s*\(\)\s*\{/, '_auditButtons method defined');
  // Body must check text + aria-label + aria-labelledby + title + media
  const m = html.match(/_auditButtons\(\)\s*\{[\s\S]+?\n  \},/);
  assert.ok(m, '_auditButtons body matched');
  const body = m[0];
  assert.match(body, /aria-label/, 'checks aria-label');
  assert.match(body, /aria-labelledby/, 'checks aria-labelledby');
  assert.match(body, /title/, 'checks title attribute');
  assert.match(body, /textContent/, 'checks textContent');
  assert.match(body, /console\.warn/, 'logs warn when issues found');
});

test('v3.44.1 — .btn-small CSS has white-space:nowrap + flex-shrink:0 (no clipping)', () => {
  const m = html.match(/\.btn-small\s*\{[^}]+\}/);
  assert.ok(m, '.btn-small rule found');
  assert.match(m[0], /white-space:\s*nowrap/, 'white-space:nowrap present');
  assert.match(m[0], /flex-shrink:\s*0/, 'flex-shrink:0 present');
});
