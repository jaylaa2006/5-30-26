// tests/senebty-foundation-mu-streak-data.test.mjs
// F4 Mu Streak dailyFoundation data assertions.
// Shape tests here (Task 2); microTeachings + quartetTag tests appended in Task 3.
// Veo-prompt discipline tests (body-holds, camera-locked, Marshall) appended in Task 4.
//
// NOTE — blessingVeo REUSE (Stage-1 RT Rec 7 + spec §4):
// F4's blessingLine "Seneb, {name}. The body remembers." matches F1's exactly.
// This is DELIBERATE CONTINUITY: F4's theme is "memory becomes body" and the reused
// blessing Veo is F1's mu-blessing-sunu.mp4 (same sage, same gesture, same ankh-lift).
// The match is intentional; tests assert the exact path and DO NOT flag it as a
// copy-paste error. See spec §4 note on blessingLine + §3 on hybrid-Veo-reuse pattern.
//
// NOTE — NO byte-identity test for F4:
// F4 has only ONE new Veo prompt (mu-streak-morning). Byte-identity assertions are
// for prompt PAIRS (two prompts sharing a character block). With one prompt, the test
// is N/A. This is intentional, not an omission. See spec §9 + F3 plan Task 4 for
// the byte-identity pattern (F3 had two prompts; F4 has one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/data/foundations/04-mu-streak/story.js', 'utf8');

test('F4 has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F4 story.js must have a dailyFoundation: {...} block');
});

test('F4 dailyFoundation has greeting object with title/subtitle/powerWord MU', () => {
  // Stage-2 Coach C2: interior class is [^"] (double-quote-only), NOT [^'"]. These
  // fields are double-quoted literals; a [^'"] class truncates on any apostrophe in the
  // value (the recurring F2 Item 4 / CI Coach C2 apostrophe bug). See coach doc C2.
  assert.match(
    src,
    /greeting\s*:\s*\{[\s\S]*?title\s*:\s*"[^"]+"[\s\S]*?subtitle\s*:\s*"[^"]+"[\s\S]*?powerWord\s*:\s*"MU"/,
    'greeting must have title, subtitle, and powerWord MU'
  );
});

test('F4 dailyFoundation has dailyGesture mentioning twenty-one and memory becomes body', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*[a-zA-Z_]+\s*:)/);
  assert.ok(m, 'dailyGesture field required');
  const text = m[1];
  assert.match(text, /twenty-one/i, 'dailyGesture must mention "twenty-one"');
  assert.match(text, /memory becomes body/i, 'dailyGesture must mention "memory becomes body"');
});

test('F4 dailyFoundation has doingVeo pointing to mu-streak-morning.mp4', () => {
  assert.match(
    src,
    /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/mu-streak-morning\.mp4['"]/,
    'doingVeo must point to mu-streak-morning.mp4'
  );
});

test('F4 dailyFoundation has blessingVeo pointing to F1 reuse: mu-blessing-sunu.mp4', () => {
  // This is the hybrid-reuse assertion (spec §3 + §9).
  // F4 deliberately reuses F1's blessing Veo — assert the EXACT F1 path.
  // The path /videos/senebty-foundations/mu-blessing-sunu.mp4 is NOT a typo;
  // it is the F1 file. Any phantom path like mu-streak-blessing*.mp4 would FAIL this test.
  assert.match(
    src,
    /blessingVeo\s*:\s*['"]\/videos\/senebty-foundations\/mu-blessing-sunu\.mp4['"]/,
    'blessingVeo must point to F1\'s mu-blessing-sunu.mp4 (the hybrid-reuse path — not a new mu-streak-blessing file)'
  );
});

test('F4 blessingVeo is set explicitly (engine slug fallback would synthesize a non-existent mu-streak-blessing-sunu.mp4)', () => {
  // Stage-2 Coach C5: F4 reuses F1's blessing Veo. The engine's slug-derived fallback
  // (daily-foundation-screen.js _renderBlessing) builds '<slug>-blessing-sunu.mp4' when
  // blessingVeo is absent — for slug 'mu-streak' that is the non-existent phantom
  // 'mu-streak-blessing-sunu.mp4'. So F4 MUST set blessingVeo explicitly (it does).
  // This locks the reuse contract: any future edit dropping the field would 404 a
  // phantom instead of failing loud. Carry-forward M2 for all hybrid-reuse foundations.
  const m = src.match(/dailyFoundation\s*:\s*\{[\s\S]*?blessingVeo\s*:\s*"([^"]+)"/);
  assert.ok(m, 'F4 dailyFoundation must set blessingVeo explicitly (reuse foundation — no engine slug fallback)');
  assert.equal(
    m[1],
    '/videos/senebty-foundations/mu-blessing-sunu.mp4',
    'blessingVeo must be F1\'s explicit reuse path, not a slug-synthesized fallback'
  );
});

test('F4 dailyFoundation has blessingLine with {name} placeholder', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`][^'"`]*\{name\}[^'"`]*['"`]/,
    'blessingLine must contain {name} placeholder'
  );
});

test('F4 blessingLine matches F1 exactly (deliberate continuity — see file header comment)', () => {
  // "Seneb, {name}. The body remembers." is F1's blessingLine.
  // F4 reuses it because F4's theme IS "memory becomes body" and the reused
  // blessing Veo is F1's. This test asserts the match is PRESENT and INTENTIONAL.
  assert.match(
    src,
    /blessingLine\s*:\s*['"`]Seneb,\s*\{name\}\.\s*The body remembers\.['"`]/,
    'blessingLine must be "Seneb, {name}. The body remembers." (deliberate F1 continuity — see spec §4 note)'
  );
});

test('F4 dailyFoundation has honorCheckLabel field', () => {
  // Stage-2 Coach C2: [^"] interior class. honorCheckLabel is "...morning's cup" — the
  // apostrophe inside the double-quoted value would truncate a [^'"] class before "cup".
  assert.match(
    src,
    /honorCheckLabel\s*:\s*"[^"]+"/,
    'honorCheckLabel field required'
  );
});

test('F4 honorCheckLabel mentions cup or drinking', () => {
  // Stage-2 Coach C2: capture with [^"] so the apostrophe in "morning's" does NOT
  // truncate the value before "cup". With the old [^'"] class the capture was only
  // "Yes — I drank this morning" and the assertion silently matched "drank", never "cup".
  const m = src.match(/honorCheckLabel\s*:\s*"([^"]+)"/);
  assert.ok(m, 'honorCheckLabel field required');
  assert.match(m[1], /cup/i, 'honorCheckLabel should reference the cup (full value, past the apostrophe in "morning\'s")');
  assert.match(m[1], /drank|drink|water/i, 'honorCheckLabel should reference the drinking action');
});

test('F4 dailyFoundation has microTeachings array', () => {
  assert.match(src, /microTeachings\s*:\s*\[/, 'microTeachings: [...] field required');
});

test('F4 microTeachings array has exactly 21 entries', () => {
  // quartetTag is the authoritative count per feedback_test_discipline_explicit_tags.md.
  // Do NOT use keyword heuristics — read the explicit tag.
  // Stage-2 Coach C3: anchor the count on the OBJECT-START key `{ quartetTag:` per the
  // CI Coach M3 carry-forward (feedback_test_gating_can_null_assertions.md). An
  // interior-key count (`quartetTag:` anywhere) could be inflated by an in-string
  // occurrence; the object-open form is immune. Every entry begins `{ quartetTag:`.
  const entries = [...src.matchAll(/\{\s*quartetTag\s*:/g)];
  assert.equal(
    entries.length,
    21,
    `microTeachings must have exactly 21 entries (5 cup + 5 repetition + 5 memory-body + 5 streak + 1 closer), got ${entries.length}`
  );
});

test('F4 microTeachings every entry has quartetTag field (scholar count === tag count)', () => {
  // Stage-2 Coach C3: anchor on the object-start key `{ quartetTag:` and the
  // immediately-following `scholar:` line. Every entry is shaped
  // `{ quartetTag:, scholar:, quote: }`, so counting the object-open + the scholar key
  // is immune to any in-string occurrence of the key names (CI Coach M3).
  const tagCount = (src.match(/\{\s*quartetTag\s*:/g) || []).length;
  const scholarCount = (src.match(/\n\s*scholar\s*:/g) || []).length;
  assert.equal(
    scholarCount,
    tagCount,
    `every microTeaching must have a quartetTag field (${scholarCount} scholars, ${tagCount} tags)`
  );
});

test('F4 microTeachings quartet structure: 5 cup + 5 repetition + 5 memory-body + 5 streak + 1 closer (explicit quartetTag)', () => {
  // Stage-2 Coach C2/C3: [^"] interior class (double-quote literals; apostrophe-safe).
  const tags = [...src.matchAll(/quartetTag\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const buckets = { cup: 0, repetition: 0, 'memory-body': 0, streak: 0, closer: 0 };
  const unknown = [];
  for (const t of tags) {
    if (buckets[t] !== undefined) buckets[t]++;
    else unknown.push(t);
  }
  assert.equal(unknown.length, 0, `unknown quartetTag values (must be cup/repetition/memory-body/streak/closer): ${unknown.join(', ')}`);
  assert.equal(buckets.cup, 5, `cup quartet must have 5 entries, got ${buckets.cup}`);
  assert.equal(buckets.repetition, 5, `repetition quartet must have 5 entries, got ${buckets.repetition}`);
  assert.equal(buckets['memory-body'], 5, `memory-body quartet must have 5 entries, got ${buckets['memory-body']}`);
  assert.equal(buckets.streak, 5, `streak quartet must have 5 entries, got ${buckets.streak}`);
  assert.equal(buckets.closer, 1, `there must be exactly 1 closer entry, got ${buckets.closer}`);
});

test('F4 microTeachings scholar allow-list (Diop, Karenga, Obenga, Hilliard, Carruthers, Acholonu, Bekerie, Konadu)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);  // Coach C2: [^"] apostrophe-safe
  const allowed = new Set([
    'Diop', 'Karenga', 'Obenga', 'Hilliard', 'Carruthers',
    'Acholonu', 'Bekerie', 'Konadu',
  ]);
  const offenders = scholars.filter(s => !allowed.has(s));
  assert.equal(offenders.length, 0, `unauthorized scholars in F4: ${offenders.join(', ')}`);
});

test('F4 microTeachings: Karenga appears at least 5 times (primary anchor per spec §6)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);  // Coach C2: [^"] apostrophe-safe
  const count = scholars.filter(s => s === 'Karenga').length;
  assert.ok(count >= 5, `Karenga must appear at least 5 times in F4 microTeachings (primary anchor per spec §6), got ${count}`);
});

test('F4 microTeachings: Diop appears at least 3 times (Nile/water cosmology anchor per spec §6)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);  // Coach C2: [^"] apostrophe-safe
  const count = scholars.filter(s => s === 'Diop').length;
  assert.ok(count >= 3, `Diop must appear at least 3 times in F4 microTeachings (Nile/water cosmology per spec §6), got ${count}`);
});

// ── Veo prompt discipline assertions (Task 4) ────────────────────────────────
// NOTE — NO byte-identity test for F4:
// F4 has only ONE new Veo prompt (mu-streak-morning). Byte-identity tests apply to
// prompt PAIRS sharing a character block. With one prompt, the test is N/A and was
// intentionally omitted. This comment prevents future readers from thinking it was
// forgotten. See spec §9 + F3 plan Task 4 for the byte-identity pattern.

test('F4 Veo prompt discipline: mu-streak-morning exists in generate-senebty-veos.mjs', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  assert.match(veoSrc, /id:\s*['"]mu-streak-morning['"]/, 'mu-streak-morning entry required in generate-senebty-veos.mjs');
});

test('F4 Veo prompt discipline: mu-streak-morning includes Marshall skin-tone floor verbatim', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]mu-streak-morning['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(m, 'mu-streak-morning prompt required');
  assert.match(m[1], /Marshall skin-tone floor verbatim/i, 'mu-streak-morning prompt must include "Marshall skin-tone floor verbatim"');
});

test('F4 Veo prompt discipline: mu-streak-morning includes body-holds discipline', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]mu-streak-morning['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(m, 'mu-streak-morning prompt required');
  assert.match(
    m[1],
    /(Body holds FULLY STILL|body holds FULLY STILL|FULLY STILL throughout)/i,
    'mu-streak-morning prompt must include body-holds discipline'
  );
});

test('F4 Veo prompt discipline: mu-streak-morning includes camera-locked', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]mu-streak-morning['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(m, 'mu-streak-morning prompt required');
  assert.match(
    m[1],
    /(CAMERA:\s*locked|camera locked|Camera locked)/i,
    'mu-streak-morning prompt must include camera-locked discipline'
  );
});

test('F4 Veo prompt discipline: mu-streak-morning has streak-tally element in ABSOLUTE NEGATIVE', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]mu-streak-morning['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(m, 'mu-streak-morning prompt required');
  // The streak-tally cups must be in the do-not-move set (Stage-1 RT Rec 10)
  assert.match(
    m[1],
    /streak-tally cups/i,
    'mu-streak-morning ABSOLUTE NEGATIVE must address streak-tally cup movement'
  );
});

test('F4 Veo prompt discipline: mu-streak-morning has water-jade thread (F4 series accent — continuity with hero-nubia + chunk Veos)', () => {
  // Stage-2 Coach C1 CORRECTION of Stage-1 RT Rec 9:
  // Rec 9 set a Nile-blue thread "distinct from F1 Sitra's water-jade." That diagnosis
  // was wrong on cross-check: F4's OWN canonical Nubia (hero-nubia + the 3 chunk Veos)
  // all carry a WATER-JADE thread, explicitly labelled "the F4 Mu Streak series accent."
  // Nubia is already distinguished from F1 Sitra by age (13 vs 6) and aesthetic cluster;
  // the shared water-jade is intentional cross-foundation Mu-water symbolism, not a
  // confusion risk. The new daily Veo must match F4's established Nubia, NOT introduce a
  // Nile-blue contradiction. See 2026-05-20-f4-mu-streak-stage2-coach.md C1.
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]mu-streak-morning['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(m, 'mu-streak-morning prompt required');
  assert.match(
    m[1],
    /water-jade thread/i,
    'mu-streak-morning must name the water-jade thread (Coach C1: the F4 series accent — continuity with hero-nubia + the F4 chunk Veos; NOT Nile-blue)'
  );
  // And must NOT reintroduce the Nile-blue thread (the Stage-1 Rec 9 drift).
  assert.doesNotMatch(
    m[1],
    /Nile-blue thread/i,
    'mu-streak-morning must NOT carry a Nile-blue thread (Coach C1 reverted Stage-1 Rec 9 — water-jade is F4\'s established series accent)'
  );
});

test('F4 Veo prompt discipline: mu-streak-morning Nubia age matches F4 canon (13, not 8-9)', () => {
  // Stage-2 Coach C1: hero-nubia + all 3 F4 chunk Veos place Nubia at "approximately
  // 13 years old." Stage-1 set the daily Veo to 8-9 — a same-character age break within
  // the foundation. Restored to 13 for continuity. See coach doc C1.
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]mu-streak-morning['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(m, 'mu-streak-morning prompt required');
  assert.match(
    m[1],
    /Nubia[^.]*approximately 13 years old/i,
    'mu-streak-morning Nubia must be ~13 (matches hero-nubia + F4 chunk Veos — Coach C1)'
  );
  assert.doesNotMatch(
    m[1],
    /8-9 years old/i,
    'mu-streak-morning must NOT make Nubia 8-9 (Coach C1 reverted the Stage-1 age drift)'
  );
});

test('F4 generator: mu-streak-morning in _outputDirFor foundation branch', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  // The _outputDirFor function must include mu-streak-morning in the foundationDir branch
  assert.match(
    veoSrc,
    /mu-streak-morning/,
    'mu-streak-morning must appear in generate-senebty-veos.mjs _outputDirFor or VIDEOS array'
  );
});

test('F4 no phantom blessing Veo entry (blessingVeo is reused F1 — no new mu-streak-blessing entry)', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  // There must NOT be a mu-streak-blessing entry — F4 reuses F1's mu-blessing-sunu
  const phantomMatch = veoSrc.match(/id:\s*['"]mu-streak-blessing/);
  assert.ok(!phantomMatch, 'F4 must NOT have a mu-streak-blessing Veo entry (reuses F1 mu-blessing-sunu — any phantom entry would indicate a spec deviation)');
});
