// tests/senebty-foundation-senedjem-data.test.mjs
// F7 Senedjem dailyFoundation data assertions.
// Shape tests + NO-PHOTO assertion + both-Veo-path assertions here (Task 2).
// microTeachings + quartetTag tests appended in Task 3.
// Veo-prompt discipline tests (body-holds, camera-locked, Marshall,
// warm-honey-thread, Tameri-cluster-lock, no-ankh, no pair byte-identity)
// appended in Task 4.
//
// SIGNATURE F7 TEST — NO-PHOTO ASSERTION (spec §4 + Stage-1 RT Rec 1):
// F7's deep iri (CREATION_IRI) has evidenceShape { text, dataURL } — NOT photo-based
// (no COPPA photo stack). The daily honor is a button press only. The dailyFoundation
// block MUST NOT reference photoId, upload, CREATION_IRI, dataURL, canvas, or
// getUserMedia. The deep CREATION_IRI stays in the chunk-reading iriCheckpoint.
//
// SCOPING NOTE: The assertion is scoped to the dailyFoundation block ONLY.
// The chunk-reading iriCheckpoint legitimately references CREATION_IRI and dataURL —
// that is correct and untouched. The test extracts the dailyFoundation block and
// checks only that extracted substring. Do NOT run the check against the full file
// (false positive risk).
//
// BOTH-VEO-PATH NOTE (spec §3 + Stage-1 RT Rec 10):
// F7 is a 2-new-Veo foundation (Iry making + Tameri blessing — different subjects).
// No pair byte-identity test applies (documented as N/A: different subjects).
// Instead: both Veo paths are distinct new paths (not reuse).
//   doingVeo    → senedjem-make.mp4
//   blessingVeo → senedjem-blessing-tameri.mp4

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/data/foundations/07-senedjem/story.js', 'utf8');

// ── SHAPE TESTS ───────────────────────────────────────────────────────────────

test('F7 has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F7 story.js must have a dailyFoundation: {...} block');
});

test('F7 dailyFoundation has exactly 7 top-level fields (doingVeo, blessingVeo, greeting, dailyGesture, blessingLine, honorCheckLabel, microTeachings)', () => {
  // Extract the dailyFoundation block and count its direct keys.
  // We verify all 7 are present rather than asserting field order
  // (per feedback_daily_foundation_field_order.md — assert presence, not order).
  const fields = [
    'doingVeo',
    'blessingVeo',
    'greeting',
    'dailyGesture',
    'blessingLine',
    'honorCheckLabel',
    'microTeachings',
  ];
  for (const field of fields) {
    assert.match(
      src,
      new RegExp(`\\b${field}\\s*:`),
      `F7 dailyFoundation must have a "${field}" field`
    );
  }
});

// ── NO-PHOTO ASSERTION (spec §4 + Stage-1 RT Rec 1) ─────────────────────────

test('F7 dailyFoundation block is NO-PHOTO — no photoId/upload/CREATION_IRI/dataURL/canvas/getUserMedia reference', () => {
  // Extract the dailyFoundation block from the opening key through end of file.
  // Scoped to the dailyFoundation block ONLY — the chunk-reading iriCheckpoint
  // legitimately has CREATION_IRI/dataURL; do NOT false-positive against that block.
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required for no-photo assertion');
  const dfBlock = dfMatch[1];

  assert.doesNotMatch(dfBlock, /photoId/i, 'dailyFoundation MUST NOT reference photoId (no photo stack in daily)');
  assert.doesNotMatch(dfBlock, /\bupload\b/i, 'dailyFoundation MUST NOT reference upload');
  assert.doesNotMatch(dfBlock, /CREATION_IRI/, 'dailyFoundation MUST NOT reference CREATION_IRI (stays in chunk iriCheckpoint)');
  assert.doesNotMatch(dfBlock, /dataURL/i, 'dailyFoundation MUST NOT reference dataURL (stays in chunk iriCheckpoint)');
  assert.doesNotMatch(dfBlock, /getUserMedia/i, 'dailyFoundation MUST NOT reference getUserMedia');
});

// ── VEO PATH ASSERTIONS (spec §3 + Stage-1 RT Recs 8-10) ─────────────────────

test('F7 dailyFoundation has doingVeo pointing to senedjem-make.mp4 (new Veo — Iry making)', () => {
  assert.match(
    src,
    /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/senedjem-make\.mp4['"]/,
    'doingVeo must point to senedjem-make.mp4 (new F7 Veo — Iry drawing at the lamp-lit table)'
  );
});

test('F7 dailyFoundation has blessingVeo pointing to senedjem-blessing-tameri.mp4 (new Veo — elder Tameri)', () => {
  assert.match(
    src,
    /blessingVeo\s*:\s*['"]\/videos\/senebty-foundations\/senedjem-blessing-tameri\.mp4['"]/,
    'blessingVeo must point to senedjem-blessing-tameri.mp4 (new F7 Veo — elder Tameri blessing)'
  );
});

test('F7 doingVeo and blessingVeo are distinct new paths (not same file, not reused from F1-F6)', () => {
  // Both paths are NEW for F7. Neither is a reuse from an earlier foundation.
  // (No pair byte-identity test: different subjects — Iry vs Tameri — documented N/A.)
  // [^"] interior (not [^'"]) — apostrophe-tolerant; recurring F2/F4/F5/F6 Coach
  // lesson (feedback_test_gating_can_null_assertions.md). Paths are double-quoted;
  // a future path with an apostrophe must not truncate the capture. Swept per the
  // F6 M3 meta-note ("sweep ALL [^'"] interiors when copying a prior test file").
  const doingMatch = src.match(/doingVeo\s*:\s*"([^"]+)"/);
  const blessingMatch = src.match(/blessingVeo\s*:\s*"([^"]+)"/);
  assert.ok(doingMatch, 'doingVeo field required');
  assert.ok(blessingMatch, 'blessingVeo field required');
  const doingPath = doingMatch[1];
  const blessingPath = blessingMatch[1];
  assert.notEqual(doingPath, blessingPath, 'doingVeo and blessingVeo must be different paths (different subjects)');
  // Both must be senedjem-specific (new, not F1-F6 reuse)
  assert.match(doingPath, /senedjem/, 'doingVeo must be a senedjem-specific path (not reused from F1-F6)');
  assert.match(blessingPath, /senedjem/, 'blessingVeo must be a senedjem-specific path (not reused from F1-F6)');
});

// ── GREETING ASSERTIONS ───────────────────────────────────────────────────────

test('F7 dailyFoundation has greeting object with title/subtitle/powerWord SENEDJEM', () => {
  assert.match(
    src,
    // [^"] interior (not [^'"]) — apostrophe-tolerant; recurring Coach lesson
    // (feedback_daily_foundation_field_order.md — assert presence, not order).
    /greeting\s*:\s*\{[\s\S]*?title\s*:\s*"[^"]+"[\s\S]*?subtitle\s*:\s*"[^"]+"[\s\S]*?powerWord\s*:\s*"SENEDJEM"/,
    'greeting must have title, subtitle, and powerWord SENEDJEM'
  );
});

test('F7 dailyFoundation greeting title is "Today is Senedjem"', () => {
  assert.match(
    src,
    /title\s*:\s*['"]Today is Senedjem['"]/,
    'greeting title must be "Today is Senedjem"'
  );
});

// ── DAILY GESTURE ASSERTIONS ──────────────────────────────────────────────────

test('F7 dailyFoundation has dailyGesture mentioning make, sweet, hands, and "Not bought. Not given. Made."', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*blessingLine)/);
  assert.ok(m, 'dailyGesture field required');
  const text = m[1];
  assert.match(text, /make/i, 'dailyGesture must mention "make"');
  assert.match(text, /sweet/i, 'dailyGesture must mention "sweet"');
  assert.match(text, /hands/i, 'dailyGesture must mention "hands"');
  // Spec §4 exact language (spec + Karenga frame — the making is the iri):
  assert.match(text, /Not bought\.\s*Not given\.\s*Made\./, 'dailyGesture must contain "Not bought. Not given. Made."');
});

// ── BLESSING LINE ASSERTIONS ──────────────────────────────────────────────────

test('F7 dailyFoundation has blessingLine with {name} placeholder', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`][^'"`]*\{name\}[^'"`]*['"`]/,
    'blessingLine must contain {name} placeholder'
  );
});

test('F7 blessingLine is "Seneb, {name}. Your hands made something sweet today."', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`]Seneb,\s*\{name\}\.\s*Your hands made something sweet today\.['"`]/,
    'blessingLine must be "Seneb, {name}. Your hands made something sweet today."'
  );
});

// ── HONOR CHECK LABEL ASSERTIONS ──────────────────────────────────────────────

test('F7 dailyFoundation has honorCheckLabel field', () => {
  assert.match(
    src,
    // [^"] interior (not [^'"]) — apostrophe-tolerant
    /honorCheckLabel\s*:\s*"[^"]+"/,
    'honorCheckLabel field required'
  );
});

test('F7 honorCheckLabel is "Yes — I made one sweet thing tonight" (apostrophe-free, teeth: [^"]+)', () => {
  // TEETH: capture the full double-quoted value with [^"]+ (not [^'"]+).
  // The old [^'"]+ capture stops at a straight apostrophe, making the
  // apostrophe-free assertion toothless. [^"]+ captures the apostrophe so
  // the doesNotMatch check fires if one is present.
  // (Recurring F5/F6 Coach lesson — carry-forward enforced.)
  const m = src.match(/honorCheckLabel\s*:\s*"([^"]+)"/);
  assert.ok(m, 'honorCheckLabel field required');
  const label = m[1];
  assert.doesNotMatch(label, /[''']/, 'honorCheckLabel must be apostrophe-free');
  assert.match(label, /made/i, 'honorCheckLabel should reference making');
  assert.match(label, /sweet/i, 'honorCheckLabel should reference sweet');
  // Exact value check (spec §4 + Stage-1 RT Rec 7):
  assert.equal(label, 'Yes — I made one sweet thing tonight',
    'honorCheckLabel must be exactly "Yes — I made one sweet thing tonight"');
});

// ── MICRO TEACHINGS ASSERTIONS (Task 3 — 21 entries, quartet 5+5+5+5+1) ─────

test('F7 dailyFoundation has microTeachings array', () => {
  assert.match(src, /microTeachings\s*:\s*\[/, 'microTeachings: [...] field required');
});

test('F7 microTeachings count === 21', () => {
  // Count quartetTag occurrences in the dailyFoundation block (each entry has exactly one).
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required');
  const dfBlock = dfMatch[1];
  const tagMatches = dfBlock.match(/quartetTag\s*:/g);
  assert.ok(tagMatches, 'microTeachings entries required');
  assert.equal(tagMatches.length, 21, `expected 21 microTeachings, got ${tagMatches.length}`);
});

test('F7 microTeachings structure is 5+5+5+5+1 by quartetTag', () => {
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required');
  const dfBlock = dfMatch[1];

  // Count entries per tag
  const counts = { making: 0, sweetness: 0, hands: 0, evening: 0, closer: 0 };
  const tagRe = /quartetTag\s*:\s*"([^"]+)"/g;
  for (const m of dfBlock.matchAll(tagRe)) {
    const tag = m[1];
    assert.ok(Object.prototype.hasOwnProperty.call(counts, tag),
      `unknown quartetTag "${tag}" — must be one of: making, sweetness, hands, evening, closer`);
    counts[tag]++;
  }
  assert.equal(counts.making,    5, `making quartet must have 5 entries, got ${counts.making}`);
  assert.equal(counts.sweetness, 5, `sweetness quartet must have 5 entries, got ${counts.sweetness}`);
  assert.equal(counts.hands,     5, `hands quartet must have 5 entries, got ${counts.hands}`);
  assert.equal(counts.evening,   5, `evening quartet must have 5 entries, got ${counts.evening}`);
  assert.equal(counts.closer,    1, `closer must have 1 entry, got ${counts.closer}`);
});

test('F7 microTeachings scholar allow-list (9 scholars, each with exact count per spec §6)', () => {
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required');
  const dfBlock = dfMatch[1];

  const ALLOWED = new Set(['Karenga', 'Carruthers', 'Hilliard', 'Diop', 'Obenga', 'Acholonu', 'Bekerie', 'Finch', 'Konadu']);
  const scholarRe = /scholar\s*:\s*"([^"]+)"/g;
  const counts = {};
  for (const m of dfBlock.matchAll(scholarRe)) {
    const s = m[1];
    assert.ok(ALLOWED.has(s), `scholar "${s}" is not in the F7 allow-list`);
    counts[s] = (counts[s] || 0) + 1;
  }
  // Exact counts from spec §6 (with Stage-2 Coach correction).
  // STAGE-2 COACH NOTE: spec §6 total-count row lists Hilliard×4 but the
  // per-quartet rows sum to Hilliard×3 + a total of 22 scholars for 21 entries —
  // arithmetic error of 1. Resolution: honor Hilliard×4 (explicitly required by
  // the task) and reduce Bekerie from the spec's stated ×2 to ×1 (one Bekerie
  // evening entry replaced with the 4th Hilliard entry, evening-close theme).
  // Total: 4+3+4+2+3+2+1+1+1 = 21 ✓. Flagged for user review post-ship.
  assert.equal(counts['Karenga'],   4, `Karenga must appear exactly 4 times, got ${counts['Karenga']}`);
  assert.equal(counts['Carruthers'],3, `Carruthers must appear exactly 3 times, got ${counts['Carruthers']}`);
  assert.equal(counts['Hilliard'],  4, `Hilliard must appear exactly 4 times, got ${counts['Hilliard']}`);
  assert.equal(counts['Diop'],      2, `Diop must appear exactly 2 times, got ${counts['Diop']}`);
  assert.equal(counts['Obenga'],    3, `Obenga must appear exactly 3 times, got ${counts['Obenga']}`);
  assert.equal(counts['Acholonu'],  2, `Acholonu must appear exactly 2 times, got ${counts['Acholonu']}`);
  // Bekerie×1 (not ×2 as listed in spec §6 total row — see Coach note above)
  assert.equal(counts['Bekerie'],   1, `Bekerie must appear exactly 1 time (spec had arithmetic error — see Coach note), got ${counts['Bekerie']}`);
  assert.equal(counts['Finch'],     1, `Finch must appear exactly 1 time, got ${counts['Finch']}`);
  assert.equal(counts['Konadu'],    1, `Konadu must appear exactly 1 time, got ${counts['Konadu']}`);
});

test('F7 microTeachings Karenga count >= 4 (spec §6 anchor)', () => {
  // Redundant with exact-count test above but explicit per task spec.
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required');
  const dfBlock = dfMatch[1];
  const karengaCount = (dfBlock.match(/scholar\s*:\s*"Karenga"/g) || []).length;
  assert.ok(karengaCount >= 4, `Karenga must appear >=4 times in microTeachings, got ${karengaCount}`);
});

test('F7 microTeachings each entry has quartetTag, scholar, and quote fields', () => {
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required');
  const dfBlock = dfMatch[1];

  // Each entry object must have all 3 fields. We check that the counts of each field match 21.
  const tagCount    = (dfBlock.match(/quartetTag\s*:/g) || []).length;
  const scholarCount = (dfBlock.match(/scholar\s*:/g) || []).length;
  const quoteCount   = (dfBlock.match(/quote\s*:/g) || []).length;
  assert.equal(tagCount,     21, `expected 21 quartetTag fields, got ${tagCount}`);
  assert.equal(scholarCount, 21, `expected 21 scholar fields, got ${scholarCount}`);
  assert.equal(quoteCount,   21, `expected 21 quote fields, got ${quoteCount}`);
});

test('F7 microTeachings closer entry is attributed to Karenga (spec §6)', () => {
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required');
  const dfBlock = dfMatch[1];

  // Find the closer entry block
  const closerMatch = dfBlock.match(/quartetTag\s*:\s*"closer"[\s\S]*?scholar\s*:\s*"([^"]+)"/);
  assert.ok(closerMatch, 'closer entry required');
  assert.equal(closerMatch[1], 'Karenga', `closer entry must be attributed to Karenga, got "${closerMatch[1]}"`);
});

// ── VEO PROMPT ASSERTIONS (Task 4 — senedjem-make + senedjem-blessing-tameri) ─

const VEO_SRC_PATH = 'generate-senebty-veos.mjs';

// Helper: extract a named entry's prompt from generate-senebty-veos.mjs
function extractVeoPrompt(veoSrc, id) {
  // Find `id: 'senedjem-make'` or `id: 'senedjem-blessing-tameri'`
  const idRe = new RegExp(`id:\\s*['"]${id}['"]`);
  const idIdx = veoSrc.search(idRe);
  if (idIdx === -1) return null;
  const after = veoSrc.slice(idIdx);
  const promptStart = after.indexOf('prompt: `');
  if (promptStart === -1) return null;
  const promptEnd = after.indexOf('`', promptStart + 9);
  if (promptEnd === -1) return null;
  return after.slice(promptStart + 9, promptEnd);
}

test('F7 senedjem-make prompt exists in generate-senebty-veos.mjs', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-make');
  assert.ok(prompt, 'senedjem-make entry must exist in generate-senebty-veos.mjs');
  assert.ok(prompt.length > 100, 'senedjem-make prompt must have substantive content');
});

test('F7 senedjem-blessing-tameri prompt exists in generate-senebty-veos.mjs', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-blessing-tameri');
  assert.ok(prompt, 'senedjem-blessing-tameri entry must exist in generate-senebty-veos.mjs');
  assert.ok(prompt.length > 100, 'senedjem-blessing-tameri prompt must have substantive content');
});

test('F7 senedjem-make and senedjem-blessing-tameri are in _outputDirFor (routed to foundationDir)', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  assert.match(
    veoSrc,
    /vid\.id\s*===\s*['"]senedjem-make['"]/,
    'senedjem-make must be in _outputDirFor function'
  );
  assert.match(
    veoSrc,
    /vid\.id\s*===\s*['"]senedjem-blessing-tameri['"]/,
    'senedjem-blessing-tameri must be in _outputDirFor function'
  );
});

// ── BODY-HOLDS / CAMERA-LOCKED / MARSHALL LINT (spec §9) ───────────────────

test('F7 senedjem-make: body-holds binding present (FULL_MOTION_EXEMPT but verifies the holding pattern)', () => {
  // senedjem-make is RITUAL-DEMONSTRATION (FULL_MOTION_EXEMPT). The body-holds
  // binding applies to Iry's torso/head (only the right hand moves). Verify that
  // the prompt describes the body-holds restriction on Iry's torso.
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-make');
  assert.ok(prompt, 'senedjem-make prompt required');
  assert.match(
    prompt,
    /fully still|FULLY STILL|does not move|DOES NOT MOVE/i,
    'senedjem-make: body-holds language required (torso/head/eyes locked while only hand moves)'
  );
});

test('F7 senedjem-make: camera locked', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-make');
  assert.ok(prompt, 'senedjem-make prompt required');
  assert.match(
    prompt,
    /camera locked|no pan.*tilt.*zoom|camera.*locked/i,
    'senedjem-make: camera locked required'
  );
});

test('F7 senedjem-make: Marshall skin-tone floor verbatim (anti-lightening anchor)', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-make');
  assert.ok(prompt, 'senedjem-make prompt required');
  assert.match(
    prompt,
    /Marshall skin-tone floor verbatim/i,
    'senedjem-make: Marshall skin-tone floor verbatim required'
  );
});

test('F7 senedjem-blessing-tameri: body-holds binding present', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-blessing-tameri');
  assert.ok(prompt, 'senedjem-blessing-tameri prompt required');
  assert.match(
    prompt,
    /fully still|FULLY STILL|does not move|DOES NOT MOVE/i,
    'senedjem-blessing-tameri: body-holds language required'
  );
});

test('F7 senedjem-blessing-tameri: camera locked', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-blessing-tameri');
  assert.ok(prompt, 'senedjem-blessing-tameri prompt required');
  assert.match(
    prompt,
    /camera locked|no pan.*tilt.*zoom|camera.*locked/i,
    'senedjem-blessing-tameri: camera locked required'
  );
});

test('F7 senedjem-blessing-tameri: Marshall skin-tone floor verbatim (anti-lightening anchor)', () => {
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-blessing-tameri');
  assert.ok(prompt, 'senedjem-blessing-tameri prompt required');
  assert.match(
    prompt,
    /Marshall skin-tone floor verbatim/i,
    'senedjem-blessing-tameri: Marshall skin-tone floor verbatim required'
  );
});

// ── TAMERI CLUSTER-LOCK ASSERTION (spec §9) ────────────────────────────────

test('F7 senedjem-blessing-tameri: Tameri cluster-lock — references elder teacher Tameri / deep mahogany canon', () => {
  // The blessing block must cluster-lock to elder teacher Tameri's chunk-Veo appearance.
  // Spec: "deep mahogany elder, lamp-lit home" — same character as the senedjem chunk Veos.
  // NO pair byte-identity (different subjects — Iry vs Tameri); instead this cluster-lock
  // assertion verifies the blessing block references the correct Tameri canon.
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-blessing-tameri');
  assert.ok(prompt, 'senedjem-blessing-tameri prompt required');
  // Must mention Tameri by name
  assert.match(
    prompt,
    /Tameri/,
    'senedjem-blessing-tameri: must reference Tameri (cluster-lock to her chunk-Veo canon)'
  );
  // Must reference deep mahogany (Marshall floor — anti-lightening cluster-lock)
  assert.match(
    prompt,
    /deep mahogany/i,
    'senedjem-blessing-tameri: must reference "deep mahogany" (Tameri Marshall floor cluster-lock)'
  );
  // Must reference lamp-lit home (home elder, not Per Ankh)
  assert.match(
    prompt,
    /lamp-lit|home.*interior|home.*evening|evening.*interior/i,
    'senedjem-blessing-tameri: must reference lamp-lit home interior (cluster-lock to home elder, not Per Ankh)'
  );
  // Stage-2 Coach C1: the chunk Veos describe Tameri verbatim as "adult woman"
  // (NOT "older African woman"). The daily blessing block must use the chunk-Veo
  // descriptor to preserve cluster-lock; a regression back to "older African woman"
  // (an attribute the chunk Veos never establish) re-breaks the own-canon-at-
  // cluster-lock discipline (the F4/F5 lesson). Assert the chunk-canon descriptor.
  assert.match(
    prompt,
    /adult woman/i,
    'senedjem-blessing-tameri: must describe Tameri as "adult woman" (chunk-Veo verbatim) — not "older African woman" (cluster-lock to chunk canon)'
  );
});

// ── NO-ANKH ASSERTION (spec §9 — Tameri is a home elder, NOT a Per Ankh sunu) ─

test('F7 senedjem-blessing-tameri: does NOT contain "ankh" as a gesture object (home elder, hand-over-work only)', () => {
  // Tameri is a home elder — her gesture is hand-over-the-work (blessing the made thing).
  // She does NOT lift an ankh (that is the sunu Merytamun's gesture at the Per Ankh).
  // This assertion verifies the no-ankh binding from the spec and Stage-1 RT.
  // APOSTROPHE-SAFE: uses [^"] regex interior.
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-blessing-tameri');
  assert.ok(prompt, 'senedjem-blessing-tameri prompt required');
  // The prompt must NOT contain "ankh" as the blessing object.
  // "no ankh" (in ABSOLUTE NEGATIVE) is allowed; "holds a small gold ankh" or
  // "lifts the ankh" would be a violation. We assert "ankh" does not appear
  // EXCEPT in the "no ankh" negative context. Simplest check: scan for
  // "ankh" and verify it only appears after "no" (as a prohibition).
  // Implementation: assert the prompt does NOT contain "gold ankh" or
  // "lifts.*ankh" or "raised.*ankh" or "holding.*ankh" (the positive uses).
  // The prompt must NOT reference a gold ankh or ankh-lift as a POSITIVE gesture
  // (e.g. "holds a small gold ankh", "lifts the ankh", "gold ankh" as a prop).
  // The prohibitive uses in the prompt ("no ankh", "not an ankh-lift") are fine and
  // expected — they explicitly forbid the ankh. We check for affirmative ankh-object usage.
  // Regex: "gold ankh" or "lifts.*ankh" or "raised.*ankh" or "holds a.*ankh" (positive props).
  // "not an ankh-lift" and "no ankh" do NOT match these patterns.
  assert.doesNotMatch(
    prompt,
    /gold ankh|lifts\s+the\s+ankh|raised\s+the\s+ankh|holds\s+a\s+.*ankh|holding\s+a\s+.*ankh/i,
    'senedjem-blessing-tameri: must NOT reference a gold ankh as a prop or affirmative ankh-lift gesture (Tameri is home elder — hand-over-work only, not sunu ritual object)'
  );
  // POSITIVE TEETH (Stage-2 Coach C2): the no-ankh assertion alone is satisfied by
  // an EMPTY gesture. Assert the prompt actually specifies the hand-over-the-work
  // blessing gesture so a future edit that strips the gesture (leaving nothing) fails.
  assert.match(
    prompt,
    /hand-over-the-work|palm-open[\s\S]*toward the[\s\S]*made/i,
    'senedjem-blessing-tameri: must positively specify the hand-over-the-work / palm-open-toward-the-made-thing blessing gesture (home elder, not ankh-lift)'
  );
});

// ── HOME-SETTING PER ANKH EXCLUSION (spec §9 / Stage-2 Coach) ─────────────

test('F7 senedjem-make: does NOT contain Per Ankh elements (home interior, not courtyard)', () => {
  // senedjem-make is set in the home-evening interior. Must NOT reference Per Ankh
  // elements: no basalt courtyard, no sycamore-fig, no papyrus-basin.
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-make');
  assert.ok(prompt, 'senedjem-make prompt required');
  // The ABSOLUTE NEGATIVE section explicitly lists these exclusions — verify they appear.
  assert.match(
    prompt,
    /NOT Per Ankh|no basalt courtyard|no Per Ankh/i,
    'senedjem-make: must explicitly exclude Per Ankh elements in prompt (home interior, not courtyard)'
  );
});

test('F7 senedjem-make: references Iry canon (~12 years old, warm-honey thread)', () => {
  // Iry is ~12 (dominant canon from 4 chunk Veos) with warm-honey thread at hem.
  const veoSrc = fs.readFileSync(VEO_SRC_PATH, 'utf8');
  const prompt = extractVeoPrompt(veoSrc, 'senedjem-make');
  assert.ok(prompt, 'senedjem-make prompt required');
  assert.match(
    prompt,
    /12 years old|approximately 12/i,
    'senedjem-make: must reference Iry as approximately 12 years old (dominant chunk-Veo canon)'
  );
  assert.match(
    prompt,
    /warm-honey thread/i,
    'senedjem-make: must reference warm-honey thread at hem (F7 Senedjem accent, Iry canon)'
  );
});

// ── NO PAIR BYTE-IDENTITY (documented N/A — different subjects) ────────────
// NOTE: No pair byte-identity test for F7. The spec explicitly documents that
// senedjem-make (Iry) and senedjem-blessing-tameri (Tameri) are different subjects
// — a byte-identity test between two unrelated character blocks would be
// meaningless and fragile. Instead, the Tameri-cluster-lock assertion above
// (cluster-locked to her chunk-Veo appearance) and the home-setting exclusion
// serve as the integrity checks for both prompts.
// (Contrast: F3 pair byte-identity tested because tjau-breathe + tjau-blessing-sunu
//  share a Merytamun character block that was cluster-locked across both prompts.)
