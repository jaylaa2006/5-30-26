// tests/senebty-foundation-heka-data.test.mjs
// F8 Heka dailyFoundation data assertions.
// Shape tests + SCHEDULER/CRUD-FREE assertion + both-Veo-path assertions here (Task 2).
// microTeachings + quartetTag tests appended in Task 3.
// Veo-prompt discipline tests (body-holds, camera-locked, Marshall,
// bright-gold, Merytamun-match-F3/F5) appended in Task 4.
//
// SIGNATURE F8 TEST — SCHEDULER/CRUD-FREE ASSERTION (spec §2 + Stage-1 RT Rec 1):
// F8's deep iri (TEACHING_IRI) has a 14-day scheduler (pending_teaching_iri SQLite
// table, Web Push + SendGrid, Day-7 reminder + Day-14 auto-advance, confirm-token
// endpoint) and Heka-phrase CRUD (M3). The dailyFoundation block MUST NOT reference
// any of: TEACHING_IRI, pending_teaching_iri, CRUD, confirm-token, push, scheduler.
// The daily honor is a button press (dailyFoundationLog[date]) only.
//
// SCOPING NOTE: The assertion is scoped to the dailyFoundation block ONLY.
// The chunk-reading iriCheckpoint legitimately references TEACHING_IRI — that is
// correct and untouched. The test extracts the dailyFoundation block and checks only
// that extracted substring. Do NOT run the check against the full file
// (false positive risk from the iriCheckpoint block).
//
// BOTH-VEO-PATH NOTE (spec §4 + Stage-1 RT Rec 8-9):
// F8 is a 2-new-Veo foundation (Kahotep speaking + Merytamun blessing — different subjects).
// No pair byte-identity test applies (documented N/A: different subjects — Kahotep vs Merytamun).
// Instead: both Veo paths are distinct new paths (not reuse).
//   doingVeo    → heka-speak.mp4
//   blessingVeo → heka-blessing-sunu.mp4

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('senebty/data/foundations/08-heka/story.js', 'utf8');

// Helper: load the F8 story module into a vm sandbox and return the story object.
// Reused by all microTeachings tests (Task 3) to avoid repeated parse overhead.
function loadF8Story() {
  const mod = { exports: {} };
  const sandbox = { window: { Senebty: {} }, module: mod, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return mod.exports.FOUNDATION_HEKA || sandbox.window.Senebty.foundationHekaStory;
}

// ── SHAPE TESTS ───────────────────────────────────────────────────────────────

test('F8 has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F8 story.js must have a dailyFoundation: {...} block');
});

test('F8 dailyFoundation has exactly 7 top-level fields (doingVeo, blessingVeo, greeting, dailyGesture, blessingLine, honorCheckLabel, microTeachings)', () => {
  // Extract the dailyFoundation block and verify all 7 are present.
  // Per feedback_daily_foundation_field_order.md — assert presence, not order.
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
      `F8 dailyFoundation must have a "${field}" field`
    );
  }
});

// ── SCHEDULER/CRUD-FREE ASSERTION (spec §2 + Stage-1 RT Rec 1) ───────────────

test('F8 dailyFoundation block is SCHEDULER/CRUD-FREE — no TEACHING_IRI/pending_teaching_iri/CRUD/confirm-token/push/scheduler reference', () => {
  // Extract the dailyFoundation block from the opening key through end of file.
  // Scoped to the dailyFoundation block ONLY — the chunk-reading iriCheckpoint
  // legitimately has TEACHING_IRI; do NOT false-positive against that block.
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required for scheduler/CRUD-free assertion');
  const dfBlock = dfMatch[1];

  assert.doesNotMatch(dfBlock, /TEACHING_IRI/, 'dailyFoundation MUST NOT reference TEACHING_IRI (stays in chunk iriCheckpoint)');
  assert.doesNotMatch(dfBlock, /pending_teaching_iri/, 'dailyFoundation MUST NOT reference pending_teaching_iri (scheduler — stays in chunk iriCheckpoint)');
  assert.doesNotMatch(dfBlock, /\bCRUD\b/, 'dailyFoundation MUST NOT reference CRUD (phrase CRUD stays in M3 / heka-phrase.js)');
  assert.doesNotMatch(dfBlock, /confirm.token/i, 'dailyFoundation MUST NOT reference confirm-token (stays in chunk iriCheckpoint)');
  assert.doesNotMatch(dfBlock, /\bscheduler\b/i, 'dailyFoundation MUST NOT reference scheduler (14-day scheduler stays in chunk iriCheckpoint)');
});

// ── VEO PATH ASSERTIONS (spec §4 + Stage-1 RT Recs 8-9) ─────────────────────

test('F8 dailyFoundation has doingVeo pointing to heka-speak.mp4 (new Veo — Kahotep speaking a true word)', () => {
  assert.match(
    src,
    /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/heka-speak\.mp4['"]/,
    'doingVeo must point to heka-speak.mp4 (new F8 Veo — Kahotep speaking at the Per Ankh courtyard)'
  );
});

test('F8 dailyFoundation has blessingVeo pointing to heka-blessing-sunu.mp4 (new Veo — Merytamun 4th blessing)', () => {
  assert.match(
    src,
    /blessingVeo\s*:\s*['"]\/videos\/senebty-foundations\/heka-blessing-sunu\.mp4['"]/,
    'blessingVeo must point to heka-blessing-sunu.mp4 (new F8 Veo — Merytamun nod + ankh-lift, 4th instance)'
  );
});

test('F8 doingVeo and blessingVeo are distinct new paths (not same file, not reused from F1-F7)', () => {
  // Both paths are NEW for F8. Neither is a reuse from an earlier foundation.
  // (No pair byte-identity test: different subjects — Kahotep vs Merytamun — documented N/A.)
  // [^"] interior (not [^'"]) — apostrophe-tolerant; recurring F2/F4/F5/F6/F7 Coach
  // lesson (feedback_daily_foundation_field_order.md). Paths are double-quoted;
  // a future path with an apostrophe must not truncate the capture.
  const doingMatch = src.match(/doingVeo\s*:\s*"([^"]+)"/);
  const blessingMatch = src.match(/blessingVeo\s*:\s*"([^"]+)"/);
  assert.ok(doingMatch, 'doingVeo field required');
  assert.ok(blessingMatch, 'blessingVeo field required');
  const doingPath = doingMatch[1];
  const blessingPath = blessingMatch[1];
  assert.notEqual(doingPath, blessingPath, 'doingVeo and blessingVeo must be different paths (different subjects)');
  // Both must be heka-specific (new, not F1-F7 reuse)
  assert.match(doingPath, /heka/, 'doingVeo must be a heka-specific path (not reused from F1-F7)');
  assert.match(blessingPath, /heka/, 'blessingVeo must be a heka-specific path (not reused from F1-F7)');
});

// ── GREETING ASSERTIONS ───────────────────────────────────────────────────────

test('F8 dailyFoundation has greeting object with title/subtitle/powerWord HEKA', () => {
  assert.match(
    src,
    // [^"] interior (not [^'"]) — apostrophe-tolerant
    /greeting\s*:\s*\{[\s\S]*?title\s*:\s*"[^"]+"[\s\S]*?subtitle\s*:\s*"[^"]+"[\s\S]*?powerWord\s*:\s*"HEKA"/,
    'greeting must have title, subtitle, and powerWord HEKA'
  );
});

test('F8 dailyFoundation greeting title is "Today is Heka"', () => {
  assert.match(
    src,
    /title\s*:\s*['"]Today is Heka['"]/,
    'greeting title must be "Today is Heka"'
  );
});

// ── DAILY GESTURE ASSERTIONS ──────────────────────────────────────────────────

test('F8 dailyFoundation has dailyGesture mentioning "true", "sentence", "house", and "makes the room new"', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*blessingLine)/);
  assert.ok(m, 'dailyGesture field required');
  const text = m[1];
  assert.match(text, /true/i, 'dailyGesture must mention "true"');
  assert.match(text, /sentence/i, 'dailyGesture must mention "sentence"');
  assert.match(text, /house/i, 'dailyGesture must mention "house"');
  // Spec §5 exact language (the sunu's one true sentence that made the room new):
  assert.match(text, /makes the room new/, 'dailyGesture must contain "makes the room new" (spec §5 exact language)');
});

// ── BLESSING LINE ASSERTIONS ──────────────────────────────────────────────────

test('F8 dailyFoundation has blessingLine with {name} placeholder', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`][^'"`]*\{name\}[^'"`]*['"`]/,
    'blessingLine must contain {name} placeholder'
  );
});

test('F8 blessingLine is "Seneb, {name}. Your true word went out into the world."', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`]Seneb,\s*\{name\}\.\s*Your true word went out into the world\.['"`]/,
    'blessingLine must be "Seneb, {name}. Your true word went out into the world."'
  );
});

// ── HONOR CHECK LABEL ASSERTIONS ──────────────────────────────────────────────

test('F8 dailyFoundation has honorCheckLabel field', () => {
  assert.match(
    src,
    // [^"] interior (not [^'"]) — apostrophe-tolerant
    /honorCheckLabel\s*:\s*"[^"]+"/,
    'honorCheckLabel field required'
  );
});

test('F8 honorCheckLabel is "Yes — I spoke one true sentence today" (apostrophe-free, teeth: [^"]+)', () => {
  // TEETH: capture the full double-quoted value with [^"]+ (not [^'"]+).
  // The old [^'"]+ capture stops at a straight apostrophe, making the
  // apostrophe-free assertion toothless. [^"]+ captures any apostrophe so
  // the doesNotMatch check fires if one is present.
  // (Recurring F5/F6/F7 Coach lesson — carry-forward enforced.)
  const m = src.match(/honorCheckLabel\s*:\s*"([^"]+)"/);
  assert.ok(m, 'honorCheckLabel field required');
  const label = m[1];
  assert.doesNotMatch(label, /[''']/, 'honorCheckLabel must be apostrophe-free');
  assert.match(label, /spoke/i, 'honorCheckLabel should reference speaking');
  assert.match(label, /true/i, 'honorCheckLabel should reference true');
  assert.match(label, /sentence/i, 'honorCheckLabel should reference sentence');
  // Exact value check (spec §5 + Stage-1 RT Rec 7):
  assert.equal(label, 'Yes — I spoke one true sentence today',
    'honorCheckLabel must be exactly "Yes — I spoke one true sentence today"');
});

// ── MICRO TEACHINGS ASSERTIONS (Task 3 — 21 entries, quartet 5+5+5+5+1) ──────
//
// SCHOLAR-COUNT RESOLUTION (22→21):
// The spec §6 summary paragraph lists Karenga×4, Obenga×3, Carruthers×3, Hilliard×4,
// Diop×3, Acholonu×2, Bekerie×2, Finch×1 = 22. The spec §6 TABLE gives 21 entries
// with "Konadu" in the teaching quartet (new wing voice excluded per Stage-1 RT).
// Resolution: replace Konadu with Diop in teaching, giving:
//   Karenga×4, Obenga×3, Carruthers×3, Hilliard×3, Diop×3, Acholonu×2, Bekerie×2,
//   Finch×1 = 21. The spec summary's "Hilliard×4" is a typo (table shows Hilliard×3);
//   "Diop×3" is correct once Konadu is replaced with Diop. This resolution drops
//   one entry from Konadu (no anchor) and adjusts Hilliard to ×3. Karenga/Carruthers/Obenga
//   anchor counts are preserved exactly as spec requires. Documented per F7 precedent.

test('F8 dailyFoundation has microTeachings array (stub — filled in Task 3)', () => {
  assert.match(src, /microTeachings\s*:\s*\[/, 'microTeachings: [...] field required');
});

test('F8 microTeachings: exactly 21 entries', () => {
  const story = loadF8Story();
  assert.ok(story, 'FOUNDATION_HEKA must be loadable');
  const mt = story.dailyFoundation.microTeachings;
  assert.equal(mt.length, 21, `microTeachings must have exactly 21 entries; got ${mt.length}`);
});

test('F8 microTeachings: every entry has quartetTag, scholar, and quote (non-empty strings)', () => {
  const story = loadF8Story();
  const mt = story.dailyFoundation.microTeachings;
  for (let i = 0; i < mt.length; i++) {
    assert.ok(mt[i].quartetTag && typeof mt[i].quartetTag === 'string' && mt[i].quartetTag.length > 0,
      `entry ${i} missing quartetTag`);
    assert.ok(mt[i].scholar && typeof mt[i].scholar === 'string' && mt[i].scholar.length > 0,
      `entry ${i} missing scholar`);
    assert.ok(mt[i].quote && typeof mt[i].quote === 'string' && mt[i].quote.length > 0,
      `entry ${i} missing quote`);
  }
});

test('F8 microTeachings: quartet structure 5+5+5+5+1 (speech, teaching, true-word, cosmic-order, closer)', () => {
  const story = loadF8Story();
  const mt = story.dailyFoundation.microTeachings;
  const counts = {};
  for (const e of mt) {
    counts[e.quartetTag] = (counts[e.quartetTag] || 0) + 1;
  }
  assert.equal(counts['speech'], 5, `speech quartet must have 5 entries; got ${counts['speech']}`);
  assert.equal(counts['teaching'], 5, `teaching quartet must have 5 entries; got ${counts['teaching']}`);
  assert.equal(counts['true-word'], 5, `true-word quartet must have 5 entries; got ${counts['true-word']}`);
  assert.equal(counts['cosmic-order'], 5, `cosmic-order quartet must have 5 entries; got ${counts['cosmic-order']}`);
  assert.equal(counts['closer'], 1, `closer quartet must have exactly 1 entry; got ${counts['closer']}`);
});

test('F8 microTeachings: scholar allow-list (no unexpected scholars)', () => {
  // Allow-list: the 8 F8 wing scholars. Konadu is NOT in this allow-list
  // (new wing voice excluded per Stage-1 RT — replaced with Diop in teaching, 22→21 resolution).
  const ALLOWED = new Set([
    'Karenga', 'Obenga', 'Carruthers', 'Hilliard',
    'Diop', 'Acholonu', 'Bekerie', 'Finch',
  ]);
  const story = loadF8Story();
  const mt = story.dailyFoundation.microTeachings;
  for (let i = 0; i < mt.length; i++) {
    assert.ok(ALLOWED.has(mt[i].scholar),
      `entry ${i}: unexpected scholar "${mt[i].scholar}" — not in F8 allow-list [${[...ALLOWED].join(', ')}]`);
  }
});

test('F8 microTeachings: Karenga >= 4 (anchor count)', () => {
  const story = loadF8Story();
  const mt = story.dailyFoundation.microTeachings;
  const karenga = mt.filter(e => e.scholar === 'Karenga').length;
  assert.ok(karenga >= 4, `Karenga must appear >= 4 times (spec anchor); got ${karenga}`);
});

test('F8 microTeachings: closer is attributed to Karenga', () => {
  const story = loadF8Story();
  const mt = story.dailyFoundation.microTeachings;
  const closer = mt.filter(e => e.quartetTag === 'closer');
  assert.equal(closer.length, 1, 'exactly 1 closer entry required');
  assert.equal(closer[0].scholar, 'Karenga', 'closer must be attributed to Karenga (spec §6)');
});

test('F8 microTeachings: no entry references TEACHING_IRI, pending_teaching_iri, CRUD, scheduler, or push (scheduler/CRUD-free in microTeachings too)', () => {
  const story = loadF8Story();
  const mt = story.dailyFoundation.microTeachings;
  for (let i = 0; i < mt.length; i++) {
    const q = mt[i].quote;
    assert.doesNotMatch(q, /TEACHING_IRI/, `entry ${i} quote MUST NOT reference TEACHING_IRI`);
    assert.doesNotMatch(q, /pending_teaching_iri/, `entry ${i} quote MUST NOT reference pending_teaching_iri`);
    assert.doesNotMatch(q, /\bCRUD\b/, `entry ${i} quote MUST NOT reference CRUD`);
    assert.doesNotMatch(q, /\bscheduler\b/i, `entry ${i} quote MUST NOT reference scheduler`);
  }
});

// ── NO PAIR BYTE-IDENTITY (documented N/A — different subjects) ────────────
// NOTE: No pair byte-identity test for F8. The spec explicitly documents that
// heka-speak (Kahotep) and heka-blessing-sunu (Merytamun) are different subjects
// — a byte-identity test between two unrelated character blocks would be
// meaningless and fragile. Instead, the Merytamun-match-F3/F5 assertion (Task 4)
// and the Kahotep canon assertion (Task 4) serve as the integrity checks for both
// prompts. (Contrast: F3 pair byte-identity tested because tjau-breathe +
// tjau-blessing-sunu share a Merytamun character block cluster-locked across both prompts.)
