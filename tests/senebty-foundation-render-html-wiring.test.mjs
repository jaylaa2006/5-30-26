import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('foundation-render.js <script> tag present with \\d{8} cache-buster', () => {
  assert.match(html, /<script src="\/senebty\/lib\/foundation-render\.js\?v=\d{8}[a-z]?"><\/script>/);
});

test('foundation-comic.css <link> tag present with \\d{8} cache-buster', () => {
  assert.match(html, /<link rel="stylesheet" href="\/senebty\/styles\/foundation-comic\.css\?v=\d{8}[a-z]?">/);
});

test('__InstallFoundationRender__(App) call exists', () => {
  assert.match(html, /__InstallFoundationRender__\(App\)/);
});

test('installer call comes AFTER `window.App = App;`', () => {
  const appAssign = html.indexOf('window.App = App;');
  const installCall = html.indexOf('__InstallFoundationRender__(App)');
  assert.ok(appAssign > 0, '`window.App = App;` not found');
  assert.ok(installCall > 0, '__InstallFoundationRender__(App) not found');
  assert.ok(installCall > appAssign,
    'installer call MUST come after `window.App = App;` (v3.43.0 regression class)');
});
