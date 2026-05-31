// tests/senebty-foundation-four-treasures-data.test.mjs — v3.51.44
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/data/foundations/02-four-treasures/story.js', 'utf8');

test('F2 has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F2 story.js must export a top-level dailyFoundation: {...} block');
});

test('F2 dailyFoundation has greeting object with title/subtitle/powerWord', () => {
  const greetingMatch = src.match(/greeting\s*:\s*\{([\s\S]*?)\}/);
  assert.ok(greetingMatch, 'greeting block required');
  const greetingBody = greetingMatch[1];
  // Stage-2 Coach Item 4: quote-class tightened to `[^"]` only (all string
  // literals in this codebase use double quotes; apostrophes inside content
  // would prematurely terminate the `[^'"]` character class — fragility
  // we removed along with the bucketFor heuristic).
  assert.match(greetingBody, /title\s*:\s*"[^"]+"/, 'greeting.title required');
  assert.match(greetingBody, /subtitle\s*:\s*"[^"]+"/, 'greeting.subtitle required');
  assert.match(greetingBody, /powerWord\s*:\s*"KHAT"/, 'greeting.powerWord must be "KHAT"');
});

test('F2 dailyFoundation has dailyGesture mentioning all 4 treasures', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*[a-zA-Z_]+\s*:)/);
  assert.ok(m, 'dailyGesture field required');
  const text = m[1];
  for (const word of ['Khat', 'Ib', 'Ka', 'Ba']) {
    assert.match(text, new RegExp('\\b' + word + '\\b'), `dailyGesture must mention "${word}"`);
  }
});

test('F2 dailyFoundation has doingVeo override pointing to four-treasures-touch.mp4', () => {
  assert.match(src, /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/four-treasures-touch\.mp4['"]/);
});

test('F2 dailyFoundation has blessingVeo override pointing to four-treasures-blessing-aset.mp4', () => {
  assert.match(src, /blessingVeo\s*:\s*['"]\/videos\/senebty-foundations\/four-treasures-blessing-aset\.mp4['"]/);
});

test('F2 dailyFoundation has blessingLine with {name} placeholder', () => {
  // Coach Item 4: tightened — codebase uses double-quote literals only.
  assert.match(src, /blessingLine\s*:\s*"[^"]+\{name\}[^"]+"/, 'blessingLine must contain {name} placeholder');
});

test('F2 dailyFoundation has microTeachings array (count validated in Task 4)', () => {
  assert.match(src, /microTeachings\s*:\s*\[/, 'microTeachings: [...] field required');
});

test('F2 microTeachings array has exactly 21 entries', () => {
  const m = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  assert.ok(m, 'microTeachings array required');
  // Count by `scholar:` field (most stable invariant across schema additions
  // — Stage-2 Coach added quartetTag in v3.51.44; future fields may shift
  // entry shape further). Tolerates fields appearing before `scholar:`.
  const entries = (m[1].match(/\bscholar\s*:/g) || []).length;
  assert.equal(entries, 21, `microTeachings must have exactly 21 entries (5 Khat + 5 Ib + 5 Ka + 5 Ba + 1 closer), got ${entries}`);
});

test('F2 microTeachings entries cite real Africana scholars (allow-list)', () => {
  const m = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  // Coach Item 4: double-quotes only across this codebase.
  const scholars = [...m[1].matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(x => x[1]);
  const allowed = new Set([
    'Diop', 'Karenga', 'Carruthers', 'Obenga', 'Finch', 'Hilliard',
    'Bekerie', 'Acholonu', 'Konadu', 'Ben-Jochannan', 'Welsing',
  ]);
  const offenders = scholars.filter(s => !allowed.has(s));
  assert.equal(offenders.length, 0, `unauthorized scholars in F2: ${offenders.join(', ')}`);
});

test('F2 microTeachings include Welsing at least once (first-time wing voice)', () => {
  const m = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  // Coach Item 4: double-quotes only across this codebase.
  const scholars = [...m[1].matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(x => x[1]);
  assert.ok(scholars.includes('Welsing'), 'Welsing must appear at least once in F2 microTeachings (Stage-1 RT Rec 5)');
});

test('F2 microTeachings entries all carry a quartetTag field (Stage-2 Coach Item 1)', () => {
  const m = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  assert.ok(m, 'microTeachings array required');
  // Count entries with quartetTag vs total scholar entries — must be equal.
  const scholarCount = (m[1].match(/\{\s*(?:quartetTag\s*:[^,]+,\s*)?scholar\s*:/g) || []).length;
  const tagged = [...m[1].matchAll(/quartetTag\s*:\s*['"](khat|ib|ka|ba|closer)['"]/g)].map(x => x[1]);
  assert.equal(tagged.length, scholarCount, `every microTeaching must carry a quartetTag; tagged=${tagged.length} vs scholarCount=${scholarCount}`);
});

test('F2 microTeachings quartet structure: 5 Khat + 5 Ib + 5 Ka + 5 Ba + 1 closer (read from quartetTag — Stage-2 Coach Item 2)', () => {
  const m = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  assert.ok(m, 'microTeachings array required');
  // Read tags directly from the explicit quartetTag field — no keyword
  // heuristic. Robust against spec-verbatim quotes that mix vocabulary
  // across quartets (e.g. "Feed your khat" inside a Ka quote, "in your
  // body" inside an Ib quote). Stage-2 Coach Item 2: heuristic deleted.
  const tags = [...m[1].matchAll(/quartetTag\s*:\s*['"](khat|ib|ka|ba|closer)['"]/g)].map(x => x[1]);
  assert.equal(tags.length, 21, `should read 21 quartetTags, got ${tags.length}`);
  const buckets = { khat: 0, ib: 0, ka: 0, ba: 0, closer: 0 };
  for (const t of tags) buckets[t]++;
  assert.equal(buckets.khat, 5, `khat quartet must have 5 entries, got ${buckets.khat}`);
  assert.equal(buckets.ib, 5, `ib quartet must have 5 entries, got ${buckets.ib}`);
  assert.equal(buckets.ka, 5, `ka quartet must have 5 entries, got ${buckets.ka}`);
  assert.equal(buckets.ba, 5, `ba quartet must have 5 entries, got ${buckets.ba}`);
  assert.equal(buckets.closer, 1, `there must be exactly 1 closer entry, got ${buckets.closer}`);
});

test('F2 microTeachings include "sign IS the gesture" Carruthers binding (Stage-1 RT Rec 4)', () => {
  const m = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\n\s*\]/m);
  // Either verbatim or near-verbatim — Carruthers Ka quote must echo this F2 L2 chunk binding
  assert.match(m[1], /sign\s+is\s+the\s+gesture/i, 'Carruthers Ka quote must echo "sign IS the gesture" per Stage-1 RT Rec 4');
});

test('F2 Veo prompts: Aset character block byte-identical across four-treasures-touch + four-treasures-blessing-aset (Stage-1 RT Rec 10)', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const touchMatch = veoSrc.match(/id:\s*['"]four-treasures-touch['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  const blessingMatch = veoSrc.match(/id:\s*['"]four-treasures-blessing-aset['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(touchMatch, 'four-treasures-touch prompt required');
  assert.ok(blessingMatch, 'four-treasures-blessing-aset prompt required');

  // Both prompts must contain the EXACT same Aset character block (Stage-1 RT Rec 10).
  // The block starts at "Aset — mid-30s Nubian woman" and ends at "Mahlangu discipline."
  const blockRe = /Aset — mid-30s Nubian woman\.[\s\S]*?Nubian-accurate features per Marshall \+ Mahlangu discipline\./;
  const touchBlock = (touchMatch[1].match(blockRe) || [])[0];
  const blessingBlock = (blessingMatch[1].match(blockRe) || [])[0];
  assert.ok(touchBlock, 'four-treasures-touch must contain the Aset character block');
  assert.ok(blessingBlock, 'four-treasures-blessing-aset must contain the Aset character block');
  assert.equal(touchBlock, blessingBlock, 'Aset character block must be byte-identical across both F2 Veo prompts');
});

test('F2 Veo prompts include body-holds + camera-locked discipline (wave-1 lint parity)', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const touchMatch = veoSrc.match(/id:\s*['"]four-treasures-touch['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  const blessingMatch = veoSrc.match(/id:\s*['"]four-treasures-blessing-aset['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  for (const [name, m] of [['touch', touchMatch], ['blessing', blessingMatch]]) {
    assert.match(m[1], /Marshall skin-tone floor verbatim/i, `four-treasures-${name} must include "Marshall skin-tone floor verbatim"`);
    assert.match(m[1], /(body holds|DOES NOT MOVE|fully still|Body holds fully still)/i, `four-treasures-${name} must include body-holds discipline`);
    // Stage-2 Coach Item 5: tightened regex — match either prose form
    // "Camera locked" OR the canonical CAMERA: section header form
    // "CAMERA: locked" (with optional colon + whitespace). Earlier regex
    // missed `CAMERA: locked.` because of the colon between CAMERA and
    // locked. Both Veo prompts have BOTH forms; tightening ensures the
    // canonical header form is what enforces the constraint.
    assert.match(m[1], /Camera\s*:?\s*(LOCKED|locked|camera-locked)|CAMERA\s*:?\s*(LOCKED|locked)/i, `four-treasures-${name} must include camera-locked (prose or CAMERA: section)`);
  }
});
