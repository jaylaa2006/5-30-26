// tests/senebty-daily-foundation-data-shape.test.mjs — v3.51.41
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/data/foundations/01-mu/story.js', 'utf8');

test('F1 Mu has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F1 Mu story.js must export a top-level dailyFoundation: {...} block');
});

test('F1 Mu dailyFoundation has greeting object', () => {
  assert.match(src, /greeting\s*:\s*\{[^}]*title\s*:\s*['"][^'"]+['"][^}]*subtitle\s*:\s*['"][^'"]+['"][^}]*powerWord\s*:\s*['"]MU['"]/);
});

test('F1 Mu dailyFoundation has blessingLine string', () => {
  assert.match(src, /blessingLine\s*:\s*['"`][^'"`]+\{name\}[^'"`]+['"`]/, 'blessingLine must contain {name} placeholder');
});

test('F1 Mu dailyFoundation has dailyGesture string', () => {
  assert.match(src, /dailyGesture\s*:\s*['"`][^'"`]+['"`]/);
});

test('F1 Mu microTeachings array has at least 21 entries', () => {
  const mtMatch = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  assert.ok(mtMatch, 'microTeachings: [...] array required');
  // Stage-2 Coach C2: count by the object-start anchor `{ quartetTag:` rather
  // than `\bscholar:`. The F2/F3 Coach refactor (2026-05-19) made every entry
  // start `{ quartetTag:, scholar:, quote:, ... }`, so `{ quartetTag:` is now
  // the most stable per-entry anchor. `\bscholar:` (the prior fix) is correct
  // today but latently fragile: a future microTeaching whose `quote` string
  // contains the literal text "scholar:" would inflate the count. Anchoring on
  // the structural object-open key avoids counting any in-string occurrence.
  // (Verified 2026-05-20: scholar/quote/quartetTag keys all == 21, aligned.)
  const entries = (mtMatch[1].match(/\{\s*quartetTag\s*:/g) || []).length;
  assert.ok(entries >= 21, `microTeachings needs ≥21 entries, got ${entries}`);
});

test('F1 Mu microTeachings entries cite real Africana scholars', () => {
  const mtMatch = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  const scholars = [...mtMatch[1].matchAll(/scholar\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const allowed = new Set(['Diop', 'Karenga', 'Carruthers', 'Obenga', 'Finch', 'Hilliard', 'Bekerie', 'Acholonu', 'Ngũgĩ', 'Ben-Jochannan', 'Konadu', 'Imani', 'Emecheta']);
  const offenders = scholars.filter(s => !allowed.has(s));
  assert.equal(offenders.length, 0, `unauthorized scholars: ${offenders.join(', ')} (Africana-source-precedence binding)`);
});
