import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('CSS link present', () => {
  assert.match(html, /<link[^>]+href=["']senebty\/styles\/daily-foundation\.css\?v=[\w\-]+["']/, 'daily-foundation.css link missing or no cache-buster');
});

test('daily-foundation-gate script tag present with cache-buster', () => {
  assert.match(html, /<script[^>]+src=["']\/?senebty\/lib\/daily-foundation-gate\.js\?v=[\w\-]+["']/);
});

test('daily-foundation-screen script tag present with cache-buster', () => {
  assert.match(html, /<script[^>]+src=["']\/?senebty\/lib\/daily-foundation-screen\.js\?v=[\w\-]+["']/);
});

// v3.51.43 — Enterprise Rule 6: late-binding installer scripts must NOT use
// `defer` or `async`. The inline installer block at the end of the body
// script runs synchronously during parse and would find the installer
// functions undefined if these scripts were deferred (root cause of the
// v3.51.41/42 prod breakage).
test('daily-foundation-gate script tag has NO defer or async attribute (Rule 6)', () => {
  const m = html.match(/<script[^>]+src=["'][^"']*daily-foundation-gate\.js[^"']*["'][^>]*>/);
  assert.ok(m, 'daily-foundation-gate script tag must exist');
  assert.doesNotMatch(m[0], /\bdefer\b/, 'gate script must NOT have defer (Rule 6)');
  assert.doesNotMatch(m[0], /\basync\b/, 'gate script must NOT have async (Rule 6)');
});

test('daily-foundation-screen script tag has NO defer or async attribute (Rule 6)', () => {
  const m = html.match(/<script[^>]+src=["'][^"']*daily-foundation-screen\.js[^"']*["'][^>]*>/);
  assert.ok(m, 'daily-foundation-screen script tag must exist');
  assert.doesNotMatch(m[0], /\bdefer\b/, 'screen script must NOT have defer (Rule 6)');
  assert.doesNotMatch(m[0], /\basync\b/, 'screen script must NOT have async (Rule 6)');
});

test('screen container present in body', () => {
  assert.match(html, /<div\s+id=["']senebtyDailyFoundation["'][^>]*class=["']screen["'][^>]*>/);
});

test('installer calls present', () => {
  assert.match(html, /window\.__InstallDailyFoundationGate__\(App\)/);
  assert.match(html, /window\.__InstallDailyFoundationScreen__\(App\)/);
});

test('installer calls appear AFTER window.App = App (late-binding Rule 2)', () => {
  const appBindIdx = html.indexOf('window.App = App');
  assert.ok(appBindIdx > 0, '"window.App = App" must exist');
  const installGateIdx = html.indexOf('__InstallDailyFoundationGate__(App)');
  const installScreenIdx = html.indexOf('__InstallDailyFoundationScreen__(App)');
  assert.ok(installGateIdx > appBindIdx, 'gate installer must come AFTER window.App = App');
  assert.ok(installScreenIdx > appBindIdx, 'screen installer must come AFTER window.App = App');
});
