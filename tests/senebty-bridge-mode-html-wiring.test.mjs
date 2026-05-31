import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('bridge-mode.js script tag present', () => {
  assert.match(html, /<script src="\/senebty\/lib\/bridge-mode\.js\?v=\d{8}[a-z]?"><\/script>/);
});

test('bridge-mode.css link tag present', () => {
  assert.match(html, /<link rel="stylesheet" href="\/senebty\/styles\/bridge-mode\.css\?v=\d{8}[a-z]?">/);
});

test('attachToTextarea call wired (in _renderMaatReflection)', () => {
  assert.match(html, /App\.bridgeMode\.attachToTextarea\s*\(/);
});

test('Reading Preferences card render method exists', () => {
  assert.match(html, /_renderReadingPreferencesCard\s*\(/);
});

test('Reading Preferences card invokes renderToggle', () => {
  assert.match(html, /App\.bridgeMode\.renderToggle\(/);
});

// v3.43.1 regression — the `window.App = App` reassignment in maat-reader's
// inline script overwrites any auto-attach done by bridge-mode.js in <head>.
// The installer call MUST run AFTER `window.App = App;` to land bridgeMode
// on the post-overwrite App. Lock this in.
test('__InstallBridgeMode__ is called after window.App = App', () => {
  const winAppIdx = html.indexOf('window.App = App;');
  assert.notEqual(winAppIdx, -1, 'window.App = App; assignment present');
  const installerIdx = html.indexOf('__InstallBridgeMode__(App)');
  assert.notEqual(installerIdx, -1, 'installer call present');
  assert.ok(installerIdx > winAppIdx, 'installer call must come AFTER window.App = App');
});

test('Reading Preferences card catch block logs via console.error (no silent failure)', () => {
  // Locate the `_renderReadingPreferencesCard(...)` call site and verify its
  // catch logs (does NOT swallow). Anti-pattern lock from the v3.43.0 regression.
  const callIdx = html.indexOf("_renderReadingPreferencesCard(document.getElementById('parentContent'))");
  assert.notEqual(callIdx, -1, 'render call site present');
  const window = html.slice(callIdx, callIdx + 400);
  assert.match(window, /catch\s*\([^)]*\)\s*\{[^}]*console\.error/,
    'catch block must call console.error — silent catches are prohibited (v3.43.0 regression)');
});
