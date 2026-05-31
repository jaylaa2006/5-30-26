// tests/senebty-foundation-wedeha-data.test.mjs
// F5 Wedeha dailyFoundation data assertions.
// Shape tests + PHOTO-FREE assertion here (Task 2).
// microTeachings + quartetTag tests appended in Task 3.
// Veo-prompt discipline tests (body-holds, camera-locked, Marshall,
// Merytamun-matches-F3) appended in Task 4.
//
// SIGNATURE F5 TEST — PHOTO-FREE ASSERTION (spec §2):
// F5's deep iri (WEDEHA_PHOTO_IRI) is a COPPA-gated parent photo upload:
// AES-256-GCM encryption, EXIF strip, signed URLs, per-foundation consent
// dialog, PM2 daily cleanup cron. The daily-ritual MUST NOT touch any of that.
// The photo-free assertion locks this: if any photoId/upload/consent/
// WEDEHA_PHOTO_IRI reference appears in the dailyFoundation block, the test
// fails. This is the test that prevents COPPA-collision regression.
//
// NOTE — NO pair byte-identity test for F5 Veos:
// F5 has TWO new Veo prompts, but they have DIFFERENT subjects (Bener at home
// vs. Merytamun at Per Ankh). Byte-identity is for prompt PAIRS sharing the
// SAME character block. Instead, F5 asserts that the Merytamun blessing block
// in wedeha-blessing-sunu is byte-consistent with F3's tjau-blessing-sunu
// Merytamun block (cross-foundation Merytamun continuity). See Task 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/data/foundations/05-wedeha/story.js', 'utf8');

test('F5 has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F5 story.js must have a dailyFoundation: {...} block');
});

// ── SIGNATURE F5 TEST — PHOTO-FREE (spec §2) ─────────────────────────────────
test('F5 dailyFoundation block is PHOTO-FREE — no photoId/upload/consent/WEDEHA_PHOTO_IRI reference', () => {
  // Extract the dailyFoundation block to scope the check.
  // We look for the block from dailyFoundation: { through the end of microTeachings: [...].
  // Use a broad regex that captures everything after the dailyFoundation key.
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required for photo-free assertion');
  const dfBlock = dfMatch[1];

  // Each of these patterns in the dailyFoundation block is a COPPA-collision.
  assert.doesNotMatch(dfBlock, /photoId/, 'dailyFoundation MUST NOT reference photoId (COPPA-collision)');
  assert.doesNotMatch(dfBlock, /WEDEHA_PHOTO_IRI/, 'dailyFoundation MUST NOT reference WEDEHA_PHOTO_IRI');
  assert.doesNotMatch(dfBlock, /upload/, 'dailyFoundation MUST NOT reference upload (COPPA-collision)');
  assert.doesNotMatch(dfBlock, /consent/, 'dailyFoundation MUST NOT reference consent dialog (COPPA-collision)');
  assert.doesNotMatch(dfBlock, /\/api\/senebty\//, 'dailyFoundation MUST NOT reference /api/senebty/ photo endpoints');
});

test('F5 dailyFoundation has greeting object with title/subtitle/powerWord WEDEHA', () => {
  assert.match(
    src,
    // apostrophe-safe: value char-class is [^"] (not [^'"]) so an apostrophe
    // inside a double-quoted greeting string does not truncate the match
    // (recurring lesson — feedback_test_*; F5 strings are double-quoted).
    /greeting\s*:\s*\{[\s\S]*?title\s*:\s*"[^"]+"[\s\S]*?subtitle\s*:\s*"[^"]+"[\s\S]*?powerWord\s*:\s*"WEDEHA"/,
    'greeting must have title, subtitle, and powerWord WEDEHA'
  );
});

test('F5 dailyFoundation has dailyGesture mentioning proportion and four food categories', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*blessingLine)/);
  assert.ok(m, 'dailyGesture field required');
  const text = m[1];
  assert.match(text, /proportion/i, 'dailyGesture must mention "proportion"');
  assert.match(text, /grain/i, 'dailyGesture must mention "grain" (one of the four food categories)');
  assert.match(text, /vegetable/i, 'dailyGesture must mention "vegetable"');
  assert.match(text, /protein/i, 'dailyGesture must mention "protein"');
  assert.match(text, /fruit/i, 'dailyGesture must mention "fruit"');
  assert.match(text, /name each part/i, 'dailyGesture must mention "name each part"');
});

test('F5 dailyFoundation has doingVeo pointing to wedeha-plate.mp4', () => {
  assert.match(
    src,
    /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/wedeha-plate\.mp4['"]/,
    'doingVeo must point to wedeha-plate.mp4'
  );
});

test('F5 dailyFoundation has blessingVeo pointing to wedeha-blessing-sunu.mp4', () => {
  assert.match(
    src,
    /blessingVeo\s*:\s*['"]\/videos\/senebty-foundations\/wedeha-blessing-sunu\.mp4['"]/,
    'blessingVeo must point to wedeha-blessing-sunu.mp4 (new F5 blessing, not a reused prior-foundation file)'
  );
});

test('F5 dailyFoundation has blessingLine with {name} placeholder', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`][^'"`]*\{name\}[^'"`]*['"`]/,
    'blessingLine must contain {name} placeholder'
  );
});

test('F5 blessingLine is "Seneb, {name}. Your plate holds Maat."', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`]Seneb,\s*\{name\}\.\s*Your plate holds Maat\.['"`]/,
    'blessingLine must be "Seneb, {name}. Your plate holds Maat."'
  );
});

test('F5 dailyFoundation has honorCheckLabel field', () => {
  assert.match(
    src,
    // apostrophe-safe: [^"] not [^'"] (F5 label is double-quoted).
    /honorCheckLabel\s*:\s*"[^"]+"/,
    'honorCheckLabel field required'
  );
});

test('F5 honorCheckLabel is apostrophe-free and mentions plate + Maat', () => {
  // apostrophe-free per recurring lesson (apostrophes in label strings cause
  // JSON-parse issues in some contexts). Use straight double quotes or rephrase.
  // TEETH FIX (Stage-2 Coach 2026-05-20): capture the full DOUBLE-quoted value
  // with [^"]+ (not [^'"]+). The old [^'"]+ capture stopped at a straight
  // apostrophe, so the doesNotMatch(/[']/) check could never fire — the offending
  // char was already excluded from the captured `label`. With [^"]+ a straight
  // apostrophe IS captured, so the apostrophe-free assertion has real teeth.
  const m = src.match(/honorCheckLabel\s*:\s*"([^"]+)"/);
  assert.ok(m, 'honorCheckLabel field required');
  const label = m[1];
  assert.doesNotMatch(label, /['''']/, 'honorCheckLabel must be apostrophe-free (straight or smart)');
  assert.match(label, /plate/i, 'honorCheckLabel should reference the plate action');
  assert.match(label, /Maat/i, 'honorCheckLabel should reference Maat');
});

test('F5 dailyFoundation has microTeachings array', () => {
  assert.match(src, /microTeachings\s*:\s*\[/, 'microTeachings: [...] field required');
});

test('F5 microTeachings array has exactly 21 entries', () => {
  const entries = [...src.matchAll(/quartetTag\s*:\s*"[^"]+"/g)];
  assert.equal(
    entries.length,
    21,
    `microTeachings must have exactly 21 entries (5 plate + 5 proportion + 5 prevention + 5 family + 1 closer), got ${entries.length}`
  );
});

test('F5 microTeachings every entry has quartetTag field (scholar count === tag count)', () => {
  const scholarCount = (src.match(/scholar\s*:/g) || []).length;
  const tagCount = (src.match(/quartetTag\s*:/g) || []).length;
  assert.equal(
    scholarCount,
    tagCount,
    `every microTeaching must have a quartetTag field (${scholarCount} scholars, ${tagCount} tags)`
  );
});

test('F5 microTeachings quartet structure: 5 plate + 5 proportion + 5 prevention + 5 family + 1 closer (explicit quartetTag)', () => {
  const tags = [...src.matchAll(/quartetTag\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const buckets = { plate: 0, proportion: 0, prevention: 0, family: 0, closer: 0 };
  const unknown = [];
  for (const t of tags) {
    if (buckets[t] !== undefined) buckets[t]++;
    else unknown.push(t);
  }
  assert.equal(unknown.length, 0, `unknown quartetTag values (must be plate/proportion/prevention/family/closer): ${unknown.join(', ')}`);
  assert.equal(buckets.plate, 5, `plate quartet must have 5 entries, got ${buckets.plate}`);
  assert.equal(buckets.proportion, 5, `proportion quartet must have 5 entries, got ${buckets.proportion}`);
  assert.equal(buckets.prevention, 5, `prevention quartet must have 5 entries, got ${buckets.prevention}`);
  assert.equal(buckets.family, 5, `family quartet must have 5 entries, got ${buckets.family}`);
  assert.equal(buckets.closer, 1, `there must be exactly 1 closer entry, got ${buckets.closer}`);
});

test('F5 microTeachings scholar allow-list (Diop, Karenga, Finch, Hilliard, Obenga, Carruthers, Acholonu, Bekerie, Konadu)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const allowed = new Set([
    'Diop', 'Karenga', 'Finch', 'Hilliard', 'Obenga',
    'Carruthers', 'Acholonu', 'Bekerie', 'Konadu',
  ]);
  const offenders = scholars.filter(s => !allowed.has(s));
  assert.equal(offenders.length, 0, `unauthorized scholars in F5: ${offenders.join(', ')}`);
});

test('F5 microTeachings: Karenga appears exactly 4 times (spec §7)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const count = scholars.filter(s => s === 'Karenga').length;
  assert.equal(count, 4, `Karenga must appear exactly 4 times in F5 microTeachings (spec §7), got ${count}`);
});

test('F5 microTeachings: Hilliard appears exactly 4 times (spec §7)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const count = scholars.filter(s => s === 'Hilliard').length;
  assert.equal(count, 4, `Hilliard must appear exactly 4 times in F5 microTeachings (spec §7), got ${count}`);
});

test('F5 microTeachings: Diop appears exactly 3 times (spec §7)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const count = scholars.filter(s => s === 'Diop').length;
  assert.equal(count, 3, `Diop must appear exactly 3 times in F5 microTeachings (spec §7), got ${count}`);
});

test('F5 microTeachings: Finch appears exactly 2 times (spec §7)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const count = scholars.filter(s => s === 'Finch').length;
  assert.equal(count, 2, `Finch must appear exactly 2 times in F5 microTeachings (spec §7), got ${count}`);
});

// ── Veo prompt discipline assertions (Task 4) ────────────────────────────────
// NOTE — NO pair byte-identity test for F5:
// F5 has TWO new Veo prompts, but they have DIFFERENT subjects:
//   - wedeha-plate: Bener (girl, ~9yo) at home kitchen
//   - wedeha-blessing-sunu: Merytamun (adult woman) at Per Ankh
// Byte-identity is for prompt PAIRS sharing the SAME character block (e.g., F3's
// tjau-breathe + tjau-blessing-sunu, which both feature Merytamun). Since F5's
// two prompts feature different characters, pair byte-identity is N/A. This is
// intentional, not an omission.
//
// INSTEAD: assert cross-foundation Merytamun continuity — the wedeha-blessing-sunu
// Merytamun character block must be byte-consistent with F3's tjau-blessing-sunu
// Merytamun block (same wing-constant character across F1/F3/F5 blessings).

test('F5 Veo prompts: wedeha-plate exists in generate-senebty-veos.mjs', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  assert.match(veoSrc, /id:\s*['"]wedeha-plate['"]/, 'wedeha-plate entry required in generate-senebty-veos.mjs');
});

test('F5 Veo prompts: wedeha-blessing-sunu exists in generate-senebty-veos.mjs', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  assert.match(veoSrc, /id:\s*['"]wedeha-blessing-sunu['"]/, 'wedeha-blessing-sunu entry required in generate-senebty-veos.mjs');
});

test('F5 wedeha-plate: Marshall skin-tone floor verbatim present', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-plate['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-plate prompt required');
  assert.match(m[1], /Marshall skin-tone floor verbatim/i, 'wedeha-plate must include "Marshall skin-tone floor verbatim"');
});

test('F5 wedeha-plate: body-holds discipline present', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-plate['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-plate prompt required');
  assert.match(m[1], /(body holds FULLY STILL|FULLY STILL throughout|Body holds FULLY STILL)/i, 'wedeha-plate must include body-holds discipline');
});

test('F5 wedeha-plate: camera-locked discipline present', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-plate['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-plate prompt required');
  assert.match(m[1], /(CAMERA:\s*locked|camera locked|Camera LOCKED)/i, 'wedeha-plate must include camera-locked discipline');
});

test('F5 wedeha-plate: warm-honey thread named (F5 character signature — canon-locked to hero-bener + wedeha chunks)', () => {
  // Stage-2 Coach own-canon-first audit (2026-05-20): the Stage-1 RT Rec 10
  // proposed "warm-amber thread" to "distinguish" Bener, but F5's OWN shipped
  // canon (hero-bener + wedeha-chunk-0..3) locks "warm-honey thread (F5 Wedeha
  // series accent)" in 6 places. Per feedback_veo_character_continuity_own_canon_first.md,
  // a character's own canon is the primary authority — the daily Veo was
  // restored to warm-honey. This test now asserts the canon value.
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-plate['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-plate prompt required');
  assert.match(m[1], /warm-honey thread/i, 'wedeha-plate must name "warm-honey thread" (F5 canon — matches hero-bener + wedeha chunks; NOT warm-amber)');
  assert.doesNotMatch(m[1], /warm-amber thread/i, 'wedeha-plate must NOT use "warm-amber thread" — that diverged from F5 canon (own-canon-first)');
});

test('F5 wedeha-plate: home-kitchen setting explicitly excludes Per Ankh elements (Stage-1 RT Rec 9)', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-plate['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-plate prompt required');
  assert.match(
    m[1],
    /no Per Ankh courtyard elements/i,
    'wedeha-plate ABSOLUTE NEGATIVE must explicitly exclude Per Ankh courtyard elements (spec §8 item 7)'
  );
  assert.match(m[1], /no basalt courtyard/i, 'wedeha-plate must explicitly exclude basalt courtyard');
  assert.match(m[1], /no sycamore-fig/i, 'wedeha-plate must explicitly exclude sycamore-fig');
  assert.match(m[1], /no papyrus-basin/i, 'wedeha-plate must explicitly exclude papyrus-basin');
});

test('F5 wedeha-blessing-sunu: Marshall skin-tone floor verbatim present', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-blessing-sunu prompt required');
  assert.match(m[1], /Marshall skin-tone floor verbatim/i, 'wedeha-blessing-sunu must include "Marshall skin-tone floor verbatim"');
});

test('F5 wedeha-blessing-sunu: body-holds discipline present', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-blessing-sunu prompt required');
  assert.match(m[1], /(body holds FULLY STILL|FULLY STILL throughout|Body holds FULLY STILL)/i, 'wedeha-blessing-sunu must include body-holds discipline');
});

test('F5 wedeha-blessing-sunu: camera-locked discipline present', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-blessing-sunu prompt required');
  assert.match(m[1], /(CAMERA:\s*locked|Camera LOCKED|camera LOCKED)/i, 'wedeha-blessing-sunu must include camera-locked discipline');
});

test('F5 wedeha-blessing-sunu: SAME CHARACTER anchor text present (wing-constant Merytamun)', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const m = veoSrc.match(/id:\s*['"]wedeha-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'wedeha-blessing-sunu prompt required');
  assert.match(
    m[1],
    /SAME CHARACTER as mu-blessing-sunu/i,
    'wedeha-blessing-sunu must include the SAME CHARACTER anchor (wing-constant Merytamun continuity)'
  );
});

test('F5 cross-foundation Merytamun continuity: wedeha-blessing-sunu character block byte-consistent with F3 tjau-blessing-sunu (Stage-1 RT Rec 11)', () => {
  // This is the F5 substitute for pair byte-identity.
  // The two F5 Veo prompts have DIFFERENT subjects (Bener vs. Merytamun),
  // so pair byte-identity is N/A. Instead: assert that the Merytamun
  // character block in wedeha-blessing-sunu matches F3's tjau-blessing-sunu
  // Merytamun block byte-for-byte. This locks cross-foundation Merytamun continuity.
  //
  // NOTE on regex design: the block ending uses "cluster-locked continuity[^)]*"
  // (not "across the wing") because the F3 canonical text ends with
  // "cluster-locked continuity across F1 + F3 daily-ritual." — the F5 block
  // is byte-identical to F3 (copied verbatim per spec §4 / Stage-1 RT Rec 11).
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const f5Match = veoSrc.match(/id:\s*['"]wedeha-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  const f3Match = veoSrc.match(/id:\s*['"]tjau-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(f5Match, 'wedeha-blessing-sunu prompt required');
  assert.ok(f3Match, 'tjau-blessing-sunu prompt required (F3 reference for Merytamun continuity)');

  // The Merytamun character block: from "Sunu Merytamun — adult African woman"
  // through "cluster-locked continuity across ... )"
  // Use the distinctive opening + cluster-locked closing anchor:
  const blockRe = /Sunu Merytamun — adult African woman[\s\S]*?Nubian-accurate features per Marshall \+ Mahlangu discipline\. \(SAME CHARACTER as mu-blessing-sunu — cluster-locked continuity[^)]*\)/;
  const f5Block = (f5Match[1].match(blockRe) || [])[0];
  const f3Block = (f3Match[1].match(blockRe) || [])[0];
  assert.ok(f5Block, 'wedeha-blessing-sunu must contain the Merytamun character block');
  assert.ok(f3Block, 'tjau-blessing-sunu must contain the Merytamun character block (F3 reference)');
  assert.equal(
    f5Block,
    f3Block,
    'Merytamun character block in wedeha-blessing-sunu must be byte-identical to F3 tjau-blessing-sunu block (cross-foundation Merytamun continuity)'
  );
});

test('F5 generator: wedeha-plate and wedeha-blessing-sunu both in _outputDirFor foundation branch', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  assert.match(veoSrc, /wedeha-plate/, 'wedeha-plate must appear in generate-senebty-veos.mjs');
  assert.match(veoSrc, /wedeha-blessing-sunu/, 'wedeha-blessing-sunu must appear in generate-senebty-veos.mjs');
});
