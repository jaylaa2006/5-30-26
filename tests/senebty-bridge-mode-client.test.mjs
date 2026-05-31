#!/usr/bin/env node
// tests/senebty-bridge-mode-client.test.mjs
// Client-side unit tests for senebty/lib/bridge-mode.js (Bridge Mode Phase 1).
// Uses jsdom with runScripts: 'dangerously' — the supported jsdom pattern.
// DO NOT use vm.runInContext().
//
// Run: node --test tests/senebty-bridge-mode-client.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/lib/bridge-mode.js', 'utf8');

// Boot a fresh jsdom for all tests (module-scope, shared).
const dom = new JSDOM(
  `<!doctype html><html><body>
     <div id="host"></div>
     <script>window.App = { saveUser: () => {} };</script>
     <script>${src}</script>
   </body></html>`,
  { url: 'http://localhost/', runScripts: 'dangerously' }
);

// ─── Task 4 tests ───────────────────────────────────────────────────────────

test('App.bridgeMode namespace is created on the window', () => {
  assert.equal(typeof dom.window.App.bridgeMode, 'object');
  assert.equal(typeof dom.window.App.bridgeMode.isEnabled, 'function');
  assert.equal(typeof dom.window.App.bridgeMode.attachToTextarea, 'function');
  assert.equal(typeof dom.window.App.bridgeMode.renderToggle, 'function');
});

// v3.43.1 regression — bridge-mode.js MUST expose __InstallBridgeMode__ for
// late-binding install in maat-reader.html (where `window.App = App` runs
// AFTER the bridge-mode.js script in <head>, which would silently overwrite
// any direct attachment otherwise). This was the v3.43.0 production regression.
test('window.__InstallBridgeMode__ is exposed and idempotent', () => {
  assert.equal(typeof dom.window.__InstallBridgeMode__, 'function',
    '__InstallBridgeMode__ MUST be exposed on window');
  // Simulate maat-reader's late install on a fresh App
  const freshApp = { saveUser: () => {} };
  const ok1 = dom.window.__InstallBridgeMode__(freshApp);
  assert.equal(ok1, true, 'first install returns true');
  assert.equal(typeof freshApp.bridgeMode, 'object');
  assert.equal(typeof freshApp.bridgeMode.renderToggle, 'function');
  // Idempotent — second install on same App returns true without duplicate work
  const ok2 = dom.window.__InstallBridgeMode__(freshApp);
  assert.equal(ok2, true, 'idempotent re-install returns true');
});

test('window.__InstallBridgeMode__ rejects invalid target with structured error', () => {
  // Capture console.error
  const origErr = dom.window.console.error;
  const captured = [];
  dom.window.console.error = function(...args){ captured.push(args); };
  const ok = dom.window.__InstallBridgeMode__(null);
  dom.window.console.error = origErr;
  assert.equal(ok, false, 'returns false on invalid target');
  assert.equal(captured.length, 1, 'logs structured error');
  assert.match(captured[0][0], /\[bridge-mode\]/, 'error tagged with module prefix');
});

test('isEnabled returns false by default', () => {
  const user = { name: 'Test', preferences: {} };
  assert.equal(dom.window.App.bridgeMode.isEnabled(user), false);
});

test('isEnabled returns true when preferences.bridgeMode is true', () => {
  const user = { name: 'Test', preferences: { bridgeMode: true } };
  assert.equal(dom.window.App.bridgeMode.isEnabled(user), true);
});

test('renderToggle creates a labeled checkbox bound to user.preferences.bridgeMode', () => {
  const host = dom.window.document.getElementById('host');
  while (host.firstChild) host.removeChild(host.firstChild);
  const user = { name: 'King', preferences: {} };
  dom.window.App.bridgeMode.renderToggle(host, user);
  const cb = host.querySelector('input[type="checkbox"]');
  assert.ok(cb, 'checkbox rendered');
  assert.equal(cb.checked, false);
  cb.checked = true;
  cb.dispatchEvent(new dom.window.Event('change'));
  assert.equal(user.preferences.bridgeMode, true);
});

test('renderToggle hit-area class is present (Tehuti binding — CSS sized in Task 7)', () => {
  const host = dom.window.document.getElementById('host');
  while (host.firstChild) host.removeChild(host.firstChild);
  const user = { name: 'King', preferences: {} };
  dom.window.App.bridgeMode.renderToggle(host, user);
  const label = host.querySelector('label.bridge-toggle-label');
  assert.ok(label, 'toggle label exists with class providing >= 44x44 hit area');
});

// v3.43.4 B2 — explicit label/checkbox association. Older assistive tech
// (NVDA, JAWS profiles) requires <label for="..."> rather than implicit
// label-wraps-input. Locks the a11y fix in.
test('renderToggle establishes explicit label-for / checkbox-id association', () => {
  const host = dom.window.document.getElementById('host');
  while (host.firstChild) host.removeChild(host.firstChild);
  const user = { name: 'King', preferences: {} };
  dom.window.App.bridgeMode.renderToggle(host, user);
  const cb = host.querySelector('input[type="checkbox"]');
  const label = host.querySelector('label.bridge-toggle-label');
  assert.ok(cb.id && cb.id.length > 0, 'checkbox must have a non-empty id');
  assert.equal(label.getAttribute('for'), cb.id,
    'label.for must equal checkbox.id (explicit a11y association)');
});

// ─── Task 5 tests ───────────────────────────────────────────────────────────

test('attachToTextarea is a no-op when bridgeMode is disabled', () => {
  const ta = dom.window.document.createElement('textarea');
  dom.window.document.body.appendChild(ta);
  const user = { preferences: { bridgeMode: false } };
  const handle = dom.window.App.bridgeMode.attachToTextarea(ta, {
    storyId: 'x', storyTitle: 'x', storyPrinciple: 'x',
    questionText: 'q', questionKind: 'maat', level: 3
  }, user);
  assert.equal(handle, null, 'returns null when disabled');
});

test('attachToTextarea returns handle when enabled; affordance fires via _fireIdleTimer', () => {
  const ta = dom.window.document.createElement('textarea');
  dom.window.document.body.appendChild(ta);
  const user = { preferences: { bridgeMode: true } };
  const handle = dom.window.App.bridgeMode.attachToTextarea(ta, {
    storyId: 'x', storyTitle: 'x', storyPrinciple: 'x',
    questionText: 'q', questionKind: 'maat', level: 3
  }, user);
  assert.ok(handle, 'returns handle when enabled');
  handle._fireIdleTimer();
  const aff = dom.window.document.querySelector('.bridge-affordance');
  assert.ok(aff, 'affordance rendered after idle timer fires');
  // Affordance contains the ankh glyph U+132F9 (Imani+Khepri binding)
  const glyph = aff.querySelector('.bridge-affordance-glyph');
  assert.ok(glyph);
  assert.equal(glyph.textContent, '\u{132F9}');
  handle.detach();
});

test('detach() clears timers and removes affordance (Sam binding — cleanup)', () => {
  const ta = dom.window.document.createElement('textarea');
  dom.window.document.body.appendChild(ta);
  const user = { preferences: { bridgeMode: true } };
  const handle = dom.window.App.bridgeMode.attachToTextarea(ta, {
    storyId: 'x', storyTitle: 'x', storyPrinciple: 'x',
    questionText: 'q', questionKind: 'maat', level: 3
  }, user);
  handle._fireIdleTimer();
  handle.detach();
  assert.equal(dom.window.document.querySelectorAll('.bridge-affordance').length, 0);
});

test('fetchHint sequence guard discards out-of-order responses', async () => {
  let resolveFirst;
  const responses = [
    new Promise(r => { resolveFirst = r; }),
    Promise.resolve({ starters: ['a…', 'b…', 'c…'] })
  ];
  let i = 0;
  dom.window.fetch = () => Promise.resolve({
    ok: true,
    json: async () => {
      const idx = i++;
      return await responses[idx];
    }
  });
  const bm = dom.window.App.bridgeMode;
  const ctx = { storyId: 'x', storyTitle: 'x', storyPrinciple: 'x', questionText: 'q', questionKind: 'maat', level: 3, learnerInputSoFar: '' };
  const p1 = bm.fetchHint(ctx, 1);
  const p2 = bm.fetchHint(ctx, 2);
  const r2 = await p2;
  assert.ok(r2 && r2.starters && r2.starters.length === 3);
  resolveFirst({ starters: ['stale…', 'stale…', 'stale…'] });
  const r1 = await p1;
  assert.equal(r1, null, 'stale response is dropped');
});

// ─── Task 6 tests ───────────────────────────────────────────────────────────

test('showHintOverlay renders 3 buttons with starter text via DOM (no innerHTML)', () => {
  const ta = dom.window.document.createElement('textarea');
  dom.window.document.body.appendChild(ta);
  const ctx = { storyId: 'x', storyTitle: 'x', storyPrinciple: 'x', questionText: 'q', questionKind: 'maat', level: 3 };
  const starters = [
    "Yeshua's choice connects to Ma'at because…",
    "Repairing the hinge created order because…",
    "If I had to fix something, I would…"
  ];
  dom.window.App.bridgeMode.showHintOverlay(ta, starters, ctx);
  const buttons = dom.window.document.querySelectorAll('.bridge-hint-overlay .bridge-hint-starter');
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0].textContent, starters[0]);
  const title = dom.window.document.querySelector('.bridge-hint-overlay .bridge-hint-title');
  assert.equal(title.textContent, 'Try starting with one of these:');
});

test('tapping a starter inserts text + dismisses + emits telemetry with starter_idx', () => {
  const ta = dom.window.document.createElement('textarea');
  ta.value = '';
  dom.window.document.body.appendChild(ta);
  ta.focus();
  const ctx = { storyId: 'x', storyTitle: 'x', storyPrinciple: 'x', questionText: 'q', questionKind: 'maat', level: 3 };
  const starters = ['s0…', 's1…', 's2…'];
  const captured = [];
  const orig = dom.window.console.log;
  dom.window.console.log = function (...args) { captured.push(args); orig.apply(dom.window.console, args); };
  dom.window.App.bridgeMode.showHintOverlay(ta, starters, ctx);
  const buttons = dom.window.document.querySelectorAll('.bridge-hint-starter');
  buttons[1].click();
  dom.window.console.log = orig;
  assert.ok(ta.value.includes('s1…'));
  assert.equal(dom.window.document.querySelectorAll('.bridge-hint-overlay').length, 0);
  const pickEvt = captured.find(args => args[0] === '[BRIDGE-HINT]' && JSON.parse(args[1]).event === 'bridge_hint_starter_picked');
  assert.ok(pickEvt, 'starter_picked emitted');
  assert.equal(JSON.parse(pickEvt[1]).starter_idx, 1);
});

test('ESC dismisses overlay + cleans up listener (Tehuti binding)', () => {
  const ta = dom.window.document.createElement('textarea');
  dom.window.document.body.appendChild(ta);
  dom.window.App.bridgeMode.showHintOverlay(ta, ['a…', 'b…', 'c…'], { storyId: 'x', storyTitle: 'x', storyPrinciple: 'x', questionText: 'q', questionKind: 'maat', level: 3 });
  const ev = new dom.window.KeyboardEvent('keydown', { key: 'Escape' });
  dom.window.document.dispatchEvent(ev);
  assert.equal(dom.window.document.querySelectorAll('.bridge-hint-overlay').length, 0);
  // Re-dispatch — handler removed, no exception
  dom.window.document.dispatchEvent(ev);
});

test('focus-trap: TAB on last element wraps to first (Tehuti binding)', () => {
  const ta = dom.window.document.createElement('textarea');
  dom.window.document.body.appendChild(ta);
  dom.window.App.bridgeMode.showHintOverlay(ta, ['a…', 'b…', 'c…'], { storyId: 'x', storyTitle: 'x', storyPrinciple: 'x', questionText: 'q', questionKind: 'maat', level: 3 });
  const focusables = dom.window.document.querySelectorAll('.bridge-hint-overlay .bridge-hint-starter, .bridge-hint-overlay .bridge-hint-close');
  focusables[focusables.length - 1].focus();
  const tabEv = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  focusables[focusables.length - 1].dispatchEvent(tabEv);
  assert.equal(dom.window.document.activeElement, focusables[0]);
});
