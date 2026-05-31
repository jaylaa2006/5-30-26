// tests/senebty-f5-deferral-integrity.test.mjs
// v3.50.0 — F5 is now SHIPPED. This test was previously asserting deferral
// (F5 card has --coming, no string elsewhere claims F5 completable). Now
// flipped: F5 card MUST NOT have --coming; F5 IS completable; consent gate
// IS enforced server-side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('maat-reader.html', 'utf8');
const server = fs.readFileSync('seba-story-api.mjs', 'utf8');

test('F5 foundation card does NOT carry --coming class anymore', () => {
  // Find the F5 card markup
  const f5Match = html.match(/foundation-card[^<>]*onclick="[^"]*key:\s*'wedeha'[^"]*"[^>]*>/);
  assert.ok(f5Match, 'F5 foundation card markup found');
  assert.doesNotMatch(f5Match[0], /senebty-foundation-card--coming/, 'F5 card must NOT have --coming class');
});

test('foundation-wedeha.js loaded in HTML', () => {
  assert.match(html, /<script src="\/senebty\/lib\/foundation-wedeha\.js\?v=\d{8}[a-z]?"><\/script>/);
});

test('05-wedeha/story.js loaded in HTML', () => {
  assert.match(html, /<script src="\/senebty\/data\/foundations\/05-wedeha\/story\.js\?v=\d{8}[a-z]?"><\/script>/);
});

test('seba-story-api.mjs exposes /api/senebty/photo POST', () => {
  assert.match(server, /app\.post\(['"]\/api\/senebty\/photo['"]/);
});

test('seba-story-api.mjs enforces consent gate on photo upload', () => {
  // The upload handler must reject without consent (the test in
  // tests/senebty-photo-endpoint.test.mjs exercises this; this is a
  // text-grep sanity check that the gate exists in source).
  assert.match(server, /senebty_consents.*withdrawnAt IS NULL/);
});
