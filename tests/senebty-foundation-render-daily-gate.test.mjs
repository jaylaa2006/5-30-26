// tests/senebty-foundation-render-daily-gate.test.mjs
// Regression lock for the v3.51.64 prod bug: foundation-render.js run() had an
// early-return `if (story.dailyFoundation) { copy=''; return; }` (added v3.51.41
// when only F1 Mu had a dailyFoundation block). Phase 2 (v3.51.44-63) gave ALL
// EIGHT foundations a dailyFoundation block, so that gate began firing for every
// foundation and blanked the entire legacy chunk-reader (story + comprehension +
// iri) — clicking any foundation in the Eight-Foundations index rendered an empty
// parchment (confirmed via live Chrome audit on prod).
//
// Fix: do NOT early-return on story.dailyFoundation. Instead suppress ONLY the
// pulse+reflection layer (the daily-foundation-screen owns that interaction)
// while letting the chunk-story + comprehension + iri render normally.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/lib/foundation-render.js', 'utf8');

test('run() does NOT early-return-blank on story.dailyFoundation (the v3.51.64 bug)', () => {
  // The lethal pattern: an `if (story.dailyFoundation)` block that sets copy to
  // empty and returns. Assert no such blanking-return survives.
  // Find every `if (story.dailyFoundation)` occurrence and ensure none is
  // immediately followed (within its block) by a bare `return;` after blanking copy.
  const lethal = /if\s*\(\s*story\.dailyFoundation\s*\)\s*\{[^}]*copy\.textContent\s*=\s*''[^}]*return\s*;[^}]*\}/;
  assert.doesNotMatch(
    src,
    lethal,
    'foundation-render.run() must NOT blank copy + return when story.dailyFoundation is present — that blanks the entire legacy reader for all 8 foundations (v3.51.64 regression).',
  );
});

test('pulse+reflection is suppressed for dailyFoundation foundations (narrowed gate)', () => {
  // The fix: reflectionData is forced null when story.dailyFoundation is present,
  // so pulseMode becomes false and the pulse/reflection phases are skipped — but
  // the chunk-story + comprehension + iri still render.
  assert.match(
    src,
    /reflectionData\s*=\s*story\.dailyFoundation\s*\?\s*null\s*:/,
    'reflectionData must be suppressed (null) when story.dailyFoundation is present, so the daily-foundation-screen owns the pulse/reflection interaction.',
  );
});

test('the chunk-story render path is still reached (chunks computed after the gate)', () => {
  // `var chunks = _l1Chunks(story)` must execute on the dailyFoundation path —
  // i.e., it must not be guarded behind a dailyFoundation early-return.
  assert.match(src, /var\s+chunks\s*=\s*_l1Chunks\(story\)/, 'chunk computation must be present');
  // Ensure the dailyFoundation reference that precedes chunks is the NARROWING
  // comment/logic, not an early return. (Belt: chunks index < a return-on-dailyFoundation index would fail above.)
  const chunksIdx = src.indexOf('var chunks = _l1Chunks(story)');
  const reflIdx = src.indexOf('reflectionData = story.dailyFoundation');
  assert.ok(chunksIdx > 0 && reflIdx > chunksIdx, 'reflectionData suppression must come AFTER chunks are computed (reader renders, pulse/reflection suppressed)');
});
