// tests/senebty-foundation-mu-data.test.mjs — v3.51.44 task 1
// Asserts the F1 Mu dailyFoundation override for the doing-Veo URL is wired,
// so the generic default in daily-foundation-screen.js doesn't break F1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const storySrc = fs.readFileSync('senebty/data/foundations/01-mu/story.js', 'utf8');
const screenSrc = fs.readFileSync('senebty/lib/daily-foundation-screen.js', 'utf8');

test('daily-foundation-screen default doing-Veo URL is generic (not F1-specific)', () => {
  // The default must use {slug}-doing.mp4, NOT {slug}-drink.mp4 (which was F1-Mu-specific)
  assert.match(
    screenSrc,
    /doingVeo\s*\|\|\s*\(['"]\/videos\/senebty-foundations\/['"]\s*\+\s*slug\s*\+\s*['"]-doing\.mp4['"]\)/,
    'default doing-Veo URL must be {slug}-doing.mp4 (generic for F2-F8)'
  );
  assert.doesNotMatch(
    screenSrc,
    /['"]-drink\.mp4['"]/,
    'F1-Mu-specific -drink.mp4 must NOT appear as a fallback default'
  );
});

test('F1 Mu data carries explicit doingVeo override', () => {
  // Without this override, F1 would fetch mu-doing.mp4 (which does not exist on prod).
  assert.match(
    storySrc,
    /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/mu-drink\.mp4['"]/,
    'F1 Mu dailyFoundation.doingVeo must override the generic default with mu-drink.mp4'
  );
});
