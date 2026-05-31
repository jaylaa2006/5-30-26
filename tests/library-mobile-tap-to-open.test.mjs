#!/usr/bin/env node
// v3.43.8 — Regression test for mobile library single-tap-to-open.
// v3.43.9 — Extended for the App._tapWithDebounce helper extraction +
// keyboard a11y (tabindex + Enter/Space) + visible :focus + 250ms threshold +
// touchcancel reset.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('v3.43.8 — card binding routes by matchMedia(max-width:600px)', () => {
  // The arrow body in the renderLibrary card binding must include both
  // branches. v3.46.16 — closure body now contains the library_tile_open
  // telemetry beacon (with nested try/catch + object literal), so a single
  // non-greedy regex window can no longer balance braces reliably. Anchor on
  // the `_tapWithDebounce(card,` call site, then check each required
  // substring exists *somewhere* in the renderLibrary handler body.
  const renderLibIdx = html.indexOf('renderLibrary(){');
  assert.ok(renderLibIdx > 0, 'renderLibrary handler found');
  // renderLibrary is finite; a 16k window comfortably covers it.
  const renderLibBody = html.slice(renderLibIdx, renderLibIdx + 16000);
  assert.match(renderLibBody, /App\._tapWithDebounce\(card,\s*\(\)\s*=>/,
    'card binding uses App._tapWithDebounce');
  assert.match(renderLibBody, /window\.matchMedia\(['"]\(max-width:600px\)['"]\)\.matches/,
    'mobile breakpoint check present');
  assert.match(renderLibBody, /App\.openStory\(i\)/,
    'mobile branch calls App.openStory(i) directly');
  assert.match(renderLibBody, /App\.featureStory\(i\)/,
    'desktop branch retains featureStory(i)');
});

test('v3.43.9 — App._tapWithDebounce helper exists with full surface', () => {
  // Helper definition includes touchstart, touchend (passive:false), touchcancel,
  // click, AND keydown (a11y). 250ms default threshold.
  assert.match(html, /_tapWithDebounce\s*\(el,\s*onTap,\s*opts\)\s*\{/,
    'helper signature present');
  // touchstart, touchend, touchcancel, click, keydown — all 5 listeners
  const helperMatch = html.match(/_tapWithDebounce\s*\(el,\s*onTap,\s*opts\)\s*\{[\s\S]+?\n  \},/);
  assert.ok(helperMatch, 'helper body matched');
  const body = helperMatch[0];
  assert.match(body, /el\.addEventListener\(['"]touchstart['"]/, 'touchstart listener');
  assert.match(body, /el\.addEventListener\(['"]touchend['"][\s\S]+?passive:\s*false/,
    'touchend listener with passive:false');
  assert.match(body, /el\.addEventListener\(['"]touchcancel['"]/, 'touchcancel reset');
  assert.match(body, /el\.addEventListener\(['"]click['"]/, 'click listener');
  assert.match(body, /el\.addEventListener\(['"]keydown['"]/, 'keydown listener');
  // Default threshold 250ms (was 180ms in v3.43.8)
  assert.match(body, /thresholdMs.*?250|ms\s*=.*?250/,
    'default threshold 250ms (child-finger tolerance)');
});

test('v3.43.9 — keyboard activation: Enter or Space triggers tap', () => {
  const helperMatch = html.match(/_tapWithDebounce\s*\(el,\s*onTap,\s*opts\)\s*\{[\s\S]+?\n  \},/);
  assert.ok(helperMatch, 'helper body matched');
  const body = helperMatch[0];
  assert.match(body, /ev\.key\s*===\s*['"]Enter['"]\s*\|\|\s*ev\.key\s*===\s*['"]\s['"]/,
    'keydown handler activates on Enter or Space');
  assert.match(body, /ev\.preventDefault\(\)\s*;\s*onTap\(\)/,
    'keydown prevents default + invokes onTap');
});

test('v3.43.9 — story-card has tabindex + role + aria-label for keyboard nav', () => {
  // Look for the renderLibrary card setup with the new a11y attributes.
  assert.match(html, /card\.setAttribute\(['"]tabindex['"],\s*['"]0['"]\)/,
    'card.setAttribute("tabindex", "0") for keyboard reachability');
  assert.match(html, /card\.setAttribute\(['"]role['"],\s*['"]button['"]\)/,
    'card.setAttribute("role", "button") for assistive tech');
  assert.match(html, /card\.setAttribute\(['"]aria-label['"]/,
    'card has descriptive aria-label');
});

test('v3.43.9 — .story-card:focus-visible visible focus indicator', () => {
  assert.match(html, /\.story-card:focus-visible\s*\{[^}]*outline:\s*2px\s*solid/,
    '.story-card:focus-visible has visible 2px outline');
});

test('v3.43.8 — CSS touch-flow polish on .library-story-list (mobile breakpoint)', () => {
  const m = html.match(/@media\s*\(\s*max-width:\s*600px\s*\)\s*\{[\s\S]{0,2000}?\.library-story-list\s*\{([^}]+)\}/);
  assert.ok(m, 'mobile breakpoint .library-story-list rule found');
  const rule = m[1];
  assert.match(rule, /touch-action:\s*pan-x/, 'touch-action:pan-x lets vertical swipes pass to page');
  assert.match(rule, /overscroll-behavior-x:\s*contain/, 'overscroll-behavior-x:contain prevents rubber-band into page');
  assert.match(rule, /scroll-snap-type:\s*x\s+proximity/,
    'scroll-snap-type changed from mandatory to proximity (less greedy on iOS)');
});

test('v3.43.8 — desktop branch behavior preserved (no matchMedia regression)', () => {
  const m = html.match(/App\.featureStory\(i\)/g);
  assert.ok(m && m.length >= 1,
    'App.featureStory(i) still bound for desktop branch');
});
