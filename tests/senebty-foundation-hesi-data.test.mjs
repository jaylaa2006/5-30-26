// tests/senebty-foundation-hesi-data.test.mjs
// F6 Hesi dailyFoundation data assertions.
// Shape tests + MIC-FREE assertion + rotation-inclusion test here (Task 2).
// microTeachings + quartetTag tests appended in Task 3.
// Veo-prompt discipline tests (body-holds, camera-locked, Marshall,
// breath-trail, no-phantom-blessing) appended in Task 4.
//
// SIGNATURE F6 TEST — MIC-FREE ASSERTION (spec §2):
// F6's deep iri (VOICE_IRI) is an Azure pronunciation score — microphone-required,
// score-only, no recording stored. The daily-ritual MUST NOT touch any of that.
// The mic-free assertion locks this: if any azure/microphone/VOICE_IRI/pronunciation
// reference appears IN THE dailyFoundation BLOCK, the test fails.
//
// SCOPING NOTE: The assertion is scoped to the dailyFoundation block ONLY.
// The chunk-reading irc block legitimately references VOICE_IRI — that is correct
// and untouched. The test extracts the dailyFoundation block and checks only that
// extracted substring. Do NOT run the check against the full file (false positive risk).
//
// ROTATION UN-EXCLUSION FINDING (spec §2 + Stage-1 RT Rec 1):
// Inspection of senebty/lib/daily-foundation-gate.js confirms 'hesi' is at
// FOUNDATION_ORDER[5]. The gate does NOT read powerWordPron. The M1 comment
// "NOT in Daily Ritual rotation" in story.js is a superseded comment with no
// mechanical effect. The rotation-inclusion test below asserts the mechanical truth.
//
// NOTE — HYBRID-REUSE blessingVeo (spec §3 + Stage-1 RT Rec 11):
// F6 reuses F1's mu-blessing-sunu.mp4 as the blessingVeo. This is the F4 precedent.
// The test asserts the EXACT F1 path. Any phantom path like hesi-blessing*.mp4
// would FAIL this test. The no-phantom assertion in Task 4 locks the other side.
//
// NOTE — NO byte-identity test for F6:
// F6 has only ONE new Veo prompt (hesi-speak). Byte-identity is for prompt PAIRS
// sharing a character block. With one new prompt, the test is N/A. Documented here
// and in the Veo test block (Task 4).
//
// F6 STAGE-2 CONSISTENCY COACH HARDENING (2026-05-20):
//   C4 — apostrophe-class: value-capture interior classes hardened from [^'"] to
//        [^"] (recurring F2/F4/F5/system-Coach lesson — a [^'"] interior truncates
//        a double-quoted value at the first apostrophe). F6 values are
//        apostrophe-free today, but the class is locked apostrophe-tolerant.
//   C5 — rotation-inclusion: the "hesi NOT excluded" test was a comment-coupled
//        text-grep (doesNotMatch /exclude[\s\S]*?hesi/) that an ACCURATE doc
//        comment tripped. Replaced with a mechanical BEHAVIOR test (_isComplete +
//        _completeFoundations + a reachability sweep). Tests assert behavior, not
//        comment prose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('senebty/data/foundations/06-hesi/story.js', 'utf8');
const gateSrc = fs.readFileSync('senebty/lib/daily-foundation-gate.js', 'utf8');

// ── Mechanical gate loader (F6 Stage-2 Coach hardening) ──────────────────────
// Loads the REAL F6 story.js + the gate into a sandbox so the rotation-inclusion
// tests assert mechanical BEHAVIOR (does hesi actually rotate?) rather than
// grepping comment prose. The previous text-grep version (doesNotMatch
// /exclude[\s\S]*?hesi/) was tautological/comment-coupled: an accurate doc
// comment that said "senedjem/heka are excluded ... F6 hesi now rotates" tripped
// it. Behavior tests have real teeth and are robust to comment wording.
function _loadGateWithHesi() {
  const senebty = {};
  for (const dir of [
    '01-mu', '02-four-treasures', '03-tjau', '04-mu-streak', '05-wedeha', '06-hesi',
  ]) {
    const storySrc = fs.readFileSync(`senebty/data/foundations/${dir}/story.js`, 'utf8');
    const sb = { window: { Senebty: senebty }, module: { exports: {} }, console };
    vm.createContext(sb);
    vm.runInContext(storySrc, sb);
  }
  const gateBox = { window: { Senebty: senebty }, console };
  vm.createContext(gateBox);
  vm.runInContext(gateSrc, gateBox);
  return gateBox.window;
}

// ── ROTATION INCLUSION TEST (spec §2 + Stage-1 RT Rec 1) ─────────────────────
test('F6 rotation-inclusion: hesi is in FOUNDATION_ORDER in daily-foundation-gate.js', () => {
  // The gate rotates by slug. FOUNDATION_ORDER must include 'hesi'.
  // powerWordPron: null has no effect on the gate — this test confirms the
  // mechanical truth that F6 will rotate.
  assert.match(
    gateSrc,
    /FOUNDATION_ORDER\s*=\s*\[[\s\S]*?['"]hesi['"][\s\S]*?\]/,
    'FOUNDATION_ORDER in daily-foundation-gate.js must include "hesi" (F6 rotation confirmed)'
  );
});

test('F6 rotation-inclusion: hesi MECHANICALLY enters the rotation (behavior, not comment-grep)', () => {
  // BEHAVIOR test (F6 Stage-2 Coach): with F6's 21 microTeachings shipped, the
  // gate's _isComplete('hesi') must be true and hesi must be in the live
  // _completeFoundations() set — i.e. it is reachable by getTodaysFoundation.
  // This replaces the old text-grep (doesNotMatch /exclude.*hesi/) which a correct
  // doc comment could trip. Teeth: if F6's microTeachings were emptied, or if the
  // gate gained a hesi exclusion, _isComplete/_completeFoundations would drop it
  // and these asserts would fail.
  const win = _loadGateWithHesi();
  const App = {};
  assert.ok(win.__InstallDailyFoundationGate__, 'gate installer must exist');
  win.__InstallDailyFoundationGate__(App);
  const gate = App.dailyFoundationGate;

  assert.equal(gate._isComplete('hesi'), true,
    '_isComplete("hesi") must be true now that F6 ships 21 microTeachings');
  assert.ok(gate._completeFoundations().includes('hesi'),
    'hesi must be in the live _completeFoundations() set (reachable by getTodaysFoundation)');

  // And confirm hesi is actually reachable as a pick across many seeds (it is not
  // structurally excluded from selection).
  let sawHesi = false;
  for (let i = 0; i < 200 && !sawHesi; i++) {
    const user = { id: `u-${i}`, senebty: { dailyFoundationLog: {} } };
    // 8+ prior completions push into the practice phase so the weighted picker
    // can land on any complete slug (incl. hesi).
    const order = ['mu', 'four-treasures', 'tjau', 'mu-streak', 'wedeha', 'mu', 'four-treasures', 'tjau'];
    order.forEach((slug, j) => {
      user.senebty.dailyFoundationLog[`2026-04-${String(10 + j).padStart(2, '0')}`] = { slug, completed: true };
    });
    const slug = gate.getTodaysFoundation(user, `2026-05-20:hesi-reach-${i}`);
    if (slug === 'hesi') sawHesi = true;
  }
  assert.ok(sawHesi, 'hesi must be reachable as a getTodaysFoundation pick (not structurally excluded)');
});

test('F6 rotation-inclusion: gate reads slugs only — no powerWordPron special-case', () => {
  // The M1 powerWordPron:null field governs the chunk-reading VOICE_IRI flow, NOT
  // the daily rotation. The gate must never read powerWordPron (it would be the
  // only mechanism that could exclude F6).
  assert.doesNotMatch(
    gateSrc,
    /powerWordPron/,
    'daily-foundation-gate.js must NOT reference powerWordPron (it reads slugs only)'
  );
});

// ── SHAPE TESTS ───────────────────────────────────────────────────────────────
test('F6 has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F6 story.js must have a dailyFoundation: {...} block');
});

// ── MIC-FREE ASSERTION (spec §2 + Stage-1 RT Rec 2) ─────────────────────────
test('F6 dailyFoundation block is MIC-FREE — no azure/microphone/VOICE_IRI/pronunciation reference', () => {
  // Extract the dailyFoundation block from the opening key through the end of the file.
  // The block ends at the closing }; of the FOUNDATION_HESI export — extracting from
  // the dailyFoundation key onward ensures we scope tightly.
  const dfMatch = src.match(/dailyFoundation\s*:\s*\{([\s\S]*)/);
  assert.ok(dfMatch, 'dailyFoundation block required for mic-free assertion');
  const dfBlock = dfMatch[1];

  // Each of these in the dailyFoundation block signals a mic-gated collision.
  assert.doesNotMatch(dfBlock, /azure/i, 'dailyFoundation MUST NOT reference azure (mic-gated)');
  assert.doesNotMatch(dfBlock, /microphone/i, 'dailyFoundation MUST NOT reference microphone');
  assert.doesNotMatch(dfBlock, /VOICE_IRI/, 'dailyFoundation MUST NOT reference VOICE_IRI');
  assert.doesNotMatch(dfBlock, /pronunciation/i, 'dailyFoundation MUST NOT reference pronunciation scoring');
  assert.doesNotMatch(dfBlock, /getUserMedia/i, 'dailyFoundation MUST NOT reference getUserMedia');
});

test('F6 dailyFoundation has greeting object with title/subtitle/powerWord HESI', () => {
  assert.match(
    src,
    // [^"] (not [^'"]) interior: greeting values are double-quoted; the [^"]
    // class tolerates an apostrophe inside the value (recurring F2/F4/F5/system
    // Coach lesson — feedback_test_gating_can_null_assertions.md).
    /greeting\s*:\s*\{[\s\S]*?title\s*:\s*"[^"]+"[\s\S]*?subtitle\s*:\s*"[^"]+"[\s\S]*?powerWord\s*:\s*"HESI"/,
    'greeting must have title, subtitle, and powerWord HESI'
  );
});

test('F6 dailyFoundation greeting title is "Today is Hesi"', () => {
  assert.match(
    src,
    /title\s*:\s*['"]Today is Hesi['"]/,
    'greeting title must be "Today is Hesi"'
  );
});

test('F6 dailyFoundation has dailyGesture mentioning HESI, three times, steady, and the disclosure', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*blessingLine)/);
  assert.ok(m, 'dailyGesture field required');
  const text = m[1];
  assert.match(text, /HESI/i, 'dailyGesture must mention "HESI"');
  assert.match(text, /three times/i, 'dailyGesture must mention "three times"');
  assert.match(text, /steady/i, 'dailyGesture must mention "steady"');
  // Modern-adaptation disclosure (spec §2 + Stage-1 RT Rec 3):
  assert.match(text, /ancient/i, 'dailyGesture must contain the steadiness-ancient disclosure');
  assert.match(text, /modern/i, 'dailyGesture must contain the pitch-modern disclosure');
});

test('F6 dailyFoundation has doingVeo pointing to hesi-speak.mp4', () => {
  assert.match(
    src,
    /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/hesi-speak\.mp4['"]/,
    'doingVeo must point to hesi-speak.mp4'
  );
});

test('F6 dailyFoundation has blessingVeo pointing to F1 reuse: mu-blessing-sunu.mp4', () => {
  // This is the hybrid-reuse assertion (spec §3 + Stage-1 RT Rec 11).
  // F6 deliberately reuses F1's blessing Veo — assert the EXACT F1 path.
  // The path /videos/senebty-foundations/mu-blessing-sunu.mp4 is NOT a typo;
  // it is the F1 file. Any phantom path like hesi-blessing*.mp4 would FAIL this test.
  assert.match(
    src,
    /blessingVeo\s*:\s*['"]\/videos\/senebty-foundations\/mu-blessing-sunu\.mp4['"]/,
    'blessingVeo must point to F1\'s mu-blessing-sunu.mp4 (hybrid-reuse path — not a new hesi-blessing file)'
  );
});

test('F6 dailyFoundation has blessingLine with {name} placeholder', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`][^'"`]*\{name\}[^'"`]*['"`]/,
    'blessingLine must contain {name} placeholder'
  );
});

test('F6 blessingLine is "Seneb, {name}. The voice is in your chest."', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`]Seneb,\s*\{name\}\.\s*The voice is in your chest\.['"`]/,
    'blessingLine must be "Seneb, {name}. The voice is in your chest."'
  );
});

test('F6 dailyFoundation has honorCheckLabel field', () => {
  assert.match(
    src,
    // [^"] interior (not [^'"]) — apostrophe-tolerant; recurring Coach lesson.
    /honorCheckLabel\s*:\s*"[^"]+"/,
    'honorCheckLabel field required'
  );
});

test('F6 honorCheckLabel is "Yes — I spoke HESI from the chest" (apostrophe-free)', () => {
  // TEETH FIX (Consistency Coach system-wide audit 2026-05-20): capture the
  // full DOUBLE-quoted value with [^"]+ (not [^'"]+). The old [^'"]+ capture
  // stopped at a straight apostrophe, so the doesNotMatch(/[']/) check could
  // never fire — the offending char was already excluded from the captured
  // `label`. With [^"]+ a straight apostrophe IS captured, so the
  // apostrophe-free assertion has real teeth. (Same fix the F5 wedeha-data
  // Coach applied; recurred here on F6 — carry-forward enforced.)
  const m = src.match(/honorCheckLabel\s*:\s*"([^"]+)"/);
  assert.ok(m, 'honorCheckLabel field required');
  const label = m[1];
  assert.doesNotMatch(label, /[''']/, 'honorCheckLabel must be apostrophe-free');
  assert.match(label, /HESI/i, 'honorCheckLabel should reference HESI');
  assert.match(label, /chest/i, 'honorCheckLabel should reference the chest/speaking action');
  // Exact value check (spec §6 + Stage-1 RT Rec 7):
  assert.equal(label, 'Yes — I spoke HESI from the chest',
    'honorCheckLabel must be exactly "Yes — I spoke HESI from the chest"');
});

test('F6 dailyFoundation has microTeachings array', () => {
  assert.match(src, /microTeachings\s*:\s*\[/, 'microTeachings: [...] field required');
});

// ── Task 3: quartetTag structure + scholar attribution ────────────────────────

test('F6 microTeachings array has exactly 21 entries', () => {
  const entries = [...src.matchAll(/quartetTag\s*:\s*"[^"]+"/g)];
  assert.equal(
    entries.length,
    21,
    `microTeachings must have exactly 21 entries (5 voice + 5 devotion + 5 order + 5 steadiness + 1 closer), got ${entries.length}`
  );
});

test('F6 microTeachings every entry has quartetTag field (scholar count === tag count)', () => {
  const scholarCount = (src.match(/scholar\s*:/g) || []).length;
  const tagCount = (src.match(/quartetTag\s*:/g) || []).length;
  assert.equal(
    scholarCount,
    tagCount,
    `every microTeaching must have a quartetTag field (${scholarCount} scholars, ${tagCount} tags)`
  );
});

test('F6 microTeachings quartet structure: 5 voice + 5 devotion + 5 order + 5 steadiness + 1 closer (explicit quartetTag)', () => {
  const tags = [...src.matchAll(/quartetTag\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const buckets = { voice: 0, devotion: 0, order: 0, steadiness: 0, closer: 0 };
  const unknown = [];
  for (const t of tags) {
    if (buckets[t] !== undefined) buckets[t]++;
    else unknown.push(t);
  }
  assert.equal(unknown.length, 0, `unknown quartetTag values (must be voice/devotion/order/steadiness/closer): ${unknown.join(', ')}`);
  assert.equal(buckets.voice, 5, `voice quartet must have 5 entries, got ${buckets.voice}`);
  assert.equal(buckets.devotion, 5, `devotion quartet must have 5 entries, got ${buckets.devotion}`);
  assert.equal(buckets.order, 5, `order quartet must have 5 entries, got ${buckets.order}`);
  assert.equal(buckets.steadiness, 5, `steadiness quartet must have 5 entries, got ${buckets.steadiness}`);
  assert.equal(buckets.closer, 1, `there must be exactly 1 closer entry, got ${buckets.closer}`);
});

test('F6 microTeachings scholar allow-list (Finch, Karenga, Obenga, Carruthers, Diop, Hilliard, Acholonu, Bekerie, Konadu)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const allowed = new Set([
    'Finch', 'Karenga', 'Obenga', 'Carruthers', 'Diop',
    'Hilliard', 'Acholonu', 'Bekerie', 'Konadu',
  ]);
  const offenders = scholars.filter(s => !allowed.has(s));
  assert.equal(offenders.length, 0, `unauthorized scholars in F6: ${offenders.join(', ')}`);
});

test('F6 microTeachings: Finch appears exactly 4 times (primary anchor per spec §6)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const count = scholars.filter(s => s === 'Finch').length;
  assert.equal(count, 4, `Finch must appear exactly 4 times in F6 microTeachings (spec §6), got ${count}`);
});

test('F6 microTeachings: Karenga appears exactly 4 times (spec §6)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const count = scholars.filter(s => s === 'Karenga').length;
  assert.equal(count, 4, `Karenga must appear exactly 4 times in F6 microTeachings (spec §6), got ${count}`);
});

test('F6 microTeachings: Obenga appears exactly 3 times (spec §6)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const count = scholars.filter(s => s === 'Obenga').length;
  assert.equal(count, 3, `Obenga must appear exactly 3 times in F6 microTeachings (spec §6), got ${count}`);
});

test('F6 microTeachings steadiness quartet: disclosure present (steadiness-ancient / pitch-modern)', () => {
  // Stage-1 RT Rec 3: at least 2 steadiness entries carry the modern-adaptation disclosure.
  // The disclosure signals: steadiness listening is ancient; pitch-shaping is modern.
  // We check the full microTeachings block for both disclosure markers.
  const mtMatch = src.match(/microTeachings\s*:\s*\[([\s\S]*?)\],?\s*\},\s*\};/);
  assert.ok(mtMatch, 'microTeachings block required for disclosure assertion');
  const mtBlock = mtMatch[1];
  assert.match(mtBlock, /ancient/i, 'steadiness microTeachings must contain "ancient" (steadiness-ancient disclosure)');
  assert.match(mtBlock, /modern/i, 'steadiness microTeachings must contain "modern" (pitch-modern disclosure)');
});

// ── Task 4: Veo prompt discipline assertions ─────────────────────────────────
// NOTE — NO byte-identity test for F6:
// F6 has only ONE new Veo prompt (hesi-speak). Byte-identity tests apply to
// prompt PAIRS sharing a character block (e.g., F3's tjau-breathe + tjau-blessing-sunu).
// With one prompt, the test is N/A and was intentionally omitted.
// See spec §9 + F3 plan Task 4 for the byte-identity pattern.

const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');

test('F6 Veo prompt discipline: hesi-speak exists in generate-senebty-veos.mjs', () => {
  assert.match(veoSrc, /id:\s*['"]hesi-speak['"]/, 'hesi-speak entry required in generate-senebty-veos.mjs');
});

test('F6 Veo prompt discipline: hesi-speak includes Marshall skin-tone floor verbatim', () => {
  const m = veoSrc.match(/id:\s*['"]hesi-speak['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'hesi-speak prompt required');
  assert.match(m[1], /Marshall skin-tone floor verbatim/i, 'hesi-speak must include "Marshall skin-tone floor verbatim"');
});

test('F6 Veo prompt discipline: hesi-speak includes body-holds discipline', () => {
  const m = veoSrc.match(/id:\s*['"]hesi-speak['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'hesi-speak prompt required');
  assert.match(
    m[1],
    /(Body holds FULLY STILL|body holds FULLY STILL|FULLY STILL throughout)/i,
    'hesi-speak prompt must include body-holds discipline'
  );
});

test('F6 Veo prompt discipline: hesi-speak includes camera-locked', () => {
  const m = veoSrc.match(/id:\s*['"]hesi-speak['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'hesi-speak prompt required');
  assert.match(
    m[1],
    /(CAMERA:\s*locked|camera locked|Camera locked)/i,
    'hesi-speak prompt must include camera-locked discipline'
  );
});

test('F6 Veo prompt discipline: hesi-speak has deep-carnelian thread (Stage-1 RT Rec 9 — Ahmose character signature)', () => {
  const m = veoSrc.match(/id:\s*['"]hesi-speak['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'hesi-speak prompt required');
  assert.match(
    m[1],
    /deep-carnelian thread/i,
    'hesi-speak must name the deep-carnelian thread (Ahmose F6 character signature per Stage-1 RT Rec 9)'
  );
});

test('F6 Veo prompt discipline: hesi-speak has breath-trail in prompt body (compound-element exception — Stage-1 RT Rec 10)', () => {
  const m = veoSrc.match(/id:\s*['"]hesi-speak['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'hesi-speak prompt required');
  // The breath-trail must appear as a DESIGNED expressive element in the prompt body,
  // NOT in the ABSOLUTE NEGATIVE. It is the ONE permitted compound-element exception.
  assert.match(
    m[1],
    /breath-trail/i,
    'hesi-speak prompt body must reference the breath-trail glow (the ONE compound-element exception per moving-art-grammar)'
  );
});

test('F6 Veo prompt discipline: hesi-speak has no-audio in ABSOLUTE NEGATIVE', () => {
  const m = veoSrc.match(/id:\s*['"]hesi-speak['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'hesi-speak prompt required');
  assert.match(
    m[1],
    /no audio/i,
    'hesi-speak ABSOLUTE NEGATIVE must include "no audio" (Veo muted in playback)'
  );
});

test('F6 Veo prompt: no exaggerated mouth movement in ABSOLUTE NEGATIVE', () => {
  const m = veoSrc.match(/id:\s*['"]hesi-speak['"][\s\S]*?prompt:\s*`([\s\S]*?)`\s*,/);
  assert.ok(m, 'hesi-speak prompt required');
  assert.match(
    m[1],
    /no exaggerated mouth movement/i,
    'hesi-speak ABSOLUTE NEGATIVE must forbid exaggerated mouth movement'
  );
});

test('F6 generator: hesi-speak in _outputDirFor foundation branch', () => {
  assert.match(
    veoSrc,
    /hesi-speak/,
    'hesi-speak must appear in generate-senebty-veos.mjs (_outputDirFor or VIDEOS array)'
  );
});

test('F6 no phantom hesi-blessing Veo entry (blessingVeo is reused F1 — Stage-1 RT Rec 11)', () => {
  // There must NOT be a hesi-blessing (or hesi-blessing-sunu) id anywhere in the generator.
  // F6 reuses F1's mu-blessing-sunu.mp4. Any phantom hesi-blessing entry would indicate
  // a spec deviation and would waste ~$2-3 regenerating an already-available Veo.
  const phantomMatch = veoSrc.match(/id:\s*['"]hesi-blessing/);
  assert.ok(!phantomMatch, 'F6 must NOT have a hesi-blessing Veo entry (reuses F1 mu-blessing-sunu — any phantom entry signals spec deviation)');
});
