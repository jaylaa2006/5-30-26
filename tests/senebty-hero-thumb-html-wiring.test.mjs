// tests/senebty-hero-thumb-html-wiring.test.mjs — v3.51.21
//
// Locks the structural contracts of the hero-thumb late-binding installation:
//   1. hero-thumb.js <script> tag present with valid cache-buster
//   2. __InstallHeroThumb__ called AFTER window.App = App (Rule 2 load-order)
//   3. Installer error-logged on missing (not silent)
//   4. All 9 data-hero-key attributes present on cards + threshold-entry
//   5. Installer call is idempotent-safe (guarded by typeof check)
//
// Pattern mirrors senebty-bridge-mode-html-wiring.test.mjs per project law.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');

test('hero-thumb.js script tag present with cache-buster', () => {
  assert.match(
    html,
    /<script src="\/senebty\/lib\/hero-thumb\.js\?v=\d{8}[a-z]?"><\/script>/,
    'hero-thumb.js <script> tag must be present with ?v=YYYYMMDD[a] cache-buster'
  );
});

// Rule 2 load-order: __InstallHeroThumb__ must be called AFTER window.App = App
test('__InstallHeroThumb__ is called after window.App = App', () => {
  const winAppIdx = html.indexOf('window.App = App;');
  assert.notEqual(winAppIdx, -1, 'window.App = App; assignment must be present');
  const installerIdx = html.indexOf('__InstallHeroThumb__(App)');
  assert.notEqual(installerIdx, -1, '__InstallHeroThumb__(App) call must be present');
  assert.ok(
    installerIdx > winAppIdx,
    '__InstallHeroThumb__ must be called AFTER window.App = App (Rule 2 load-order)'
  );
});

// Installer guarded by typeof check — not called unconditionally
test('__InstallHeroThumb__ is guarded by typeof check', () => {
  assert.match(
    html,
    /typeof window\.__InstallHeroThumb__\s*===\s*['"]function['"]/,
    'typeof guard required — prevents uncaught ReferenceError if script fails to load'
  );
});

// Installer failure must be error-logged (Rule 1 — no silent failure)
test('missing __InstallHeroThumb__ is logged via console.error', () => {
  // Find the else branch of the typeof guard
  const guardIdx = html.indexOf('typeof window.__InstallHeroThumb__');
  assert.notEqual(guardIdx, -1, 'typeof guard must be present');
  const window = html.slice(guardIdx, guardIdx + 500);
  assert.match(
    window,
    /console\.error\([^)]*hero-thumb[^)]*\)/,
    'else branch must console.error when __InstallHeroThumb__ is missing (Rule 1)'
  );
});

// All 9 data-hero-key attributes present
const EXPECTED_KEYS = [
  'khaemwaset',   // threshold-entry
  'mu',           // F1
  'four-treasures', // F2
  'tjau',         // F3
  'mu-streak',    // F4
  'wedeha',       // F5
  'hesi',         // F6
  'senedjem',     // F7
  'heka',         // F8
];

for (const key of EXPECTED_KEYS) {
  test(`data-hero-key="${key}" present in HTML`, () => {
    assert.ok(
      html.includes(`data-hero-key="${key}"`),
      `data-hero-key="${key}" must be present on the corresponding card/threshold element`
    );
  });
}

// Stage-1 RT CRITICAL fix: __num must appear before the hero thumb comment in
// each card (guards against regression of the insertBefore column-order bug).
test('__num div appears before hero thumb comment in F1 card', () => {
  const numIdx = html.indexOf('senebty-foundation-card__num');
  const heroCommentIdx = html.indexOf('hero thumb injected here by hero-thumb.js');
  assert.notEqual(numIdx, -1, '__num div must be present');
  assert.notEqual(heroCommentIdx, -1, 'hero thumb injection comment must be present');
  assert.ok(
    numIdx < heroCommentIdx,
    '__num must come before the hero thumb injection site in DOM order — ' +
    'hero-thumb.js inserts after __num (grid col 1=num, col 2=hero)'
  );
});

// Installer return value checked — false triggers console.error (Rule 1)
test('installer return=false triggers console.error', () => {
  const installerCallIdx = html.indexOf('__InstallHeroThumb__(App)');
  assert.notEqual(installerCallIdx, -1);
  const window = html.slice(installerCallIdx - 50, installerCallIdx + 300);
  assert.match(
    window,
    /console\.error/,
    'installer return=false path must call console.error (Rule 1 no silent failure)'
  );
});
