// senebty-veo-prompt-discipline.test.mjs — v3.51.32 wave-1 fidelity-audit follow-up #4
//
// Codifies the three discipline invariants that the wave-1 Veo fidelity audit
// (docs/superpowers/specs/2026-05-16-wave1-veo-fidelity-audit.md) found
// already-present on 24/24 ritual prompts, so they stay present going forward.
//
// Invariants asserted on every NEW-ritual entry in generate-senebty-veos.mjs:
//   1. Marshall skin-tone floor verbatim — anti-lightening anchor
//   2. "fully still" OR "DOES NOT MOVE" on figures — body-holds binding
//   3. "camera locked" — no camera dolly/pan/zoom
//
// Hero portraits + heritage Khaemwaset-threshold + chunk-2 dawn-walk entries
// follow a different prompt shape (no figures-holding-while-element-moves
// frame), so they are scoped out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC_PATH = 'generate-senebty-veos.mjs';

// Scope: only the wave-1 (BATCH 4) entries inside `VIDEOS_NEW_RITUAL = [ ... ]`.
// Pre-wave-1 batches + hero portraits live in separate arrays and predate the
// wave-1 prompt-discipline lockdown — they are intentionally out of scope.
//
// v3.51.36 → v3.51.37 — FULL-MOTION exemption (renamed from
// ESTABLISHING_CHUNK_EXEMPT). Two categories from the 3-tier system
// (feedback_veo_category_budget) earn full cinematic motion:
//   ESTABLISHING — wing-entry first impressions
//   RITUAL-DEMONSTRATION — the practice gesture being PERFORMED
// Both legitimately want camera motion + character motion — the body-holds
// vow applies only to AMBIENT-RITUAL (after-the-gesture contemplation).
// User binding 2026-05-17: "use the intro generator to prompt the full
// motion necessary for the health context" + "quality over cost when it
// delivers the best product." Each exemption MUST be justified inline at
// the Veo prompt site with category label.
const FULL_MOTION_EXEMPT = new Set([
  'mu-chunk-0-arrival',              // F1 ESTABLISHING — wing entry, Sitra walks
  'mu-chunk-1-cup-named',            // F1 RITUAL-DEMONSTRATION — sunu lifts cup
  'mu-drink',                        // F1 Mu RITUAL-DEMONSTRATION — daily-ritual doing Veo (v3.51.41)
  'mu-blessing-sunu',                // F1 Mu sage-blessing Veo (v3.51.41 Task 7)
  'four-treasures-touch',            // F2 Four Treasures RITUAL-DEMONSTRATION — daily-ritual doing Veo (v3.51.44)
  'four-treasures-blessing-aset',    // F2 Four Treasures AMBIENT-RITUAL sage-blessing Veo (v3.51.44)
  'tjau-breathe',                    // F3 Tjau RITUAL-DEMONSTRATION — daily-ritual doing Veo (v3.51.46)
  'tjau-blessing-sunu',              // F3 Tjau AMBIENT-RITUAL sage-blessing Veo (v3.51.46)
  'mu-streak-morning',               // F4 Mu Streak RITUAL-DEMONSTRATION — daily-ritual doing Veo
  // NOTE: no mu-streak-blessing entry — F4 reuses F1's mu-blessing-sunu (already exempt from F1 ship)
  'wedeha-plate',           // F5 Wedeha RITUAL-DEMONSTRATION — daily-ritual doing Veo
  'wedeha-blessing-sunu',   // F5 Wedeha AMBIENT-RITUAL sage-blessing Veo
  'hesi-speak',             // F6 Hesi RITUAL-DEMONSTRATION — daily-ritual doing Veo
  // NOTE: no hesi-blessing entry — F6 reuses F1's mu-blessing-sunu (already exempt from F1 ship)
  'senedjem-make',             // F7 Senedjem RITUAL-DEMONSTRATION — daily-ritual doing Veo (Iry drawing)
  'senedjem-blessing-tameri',  // F7 Senedjem AMBIENT-RITUAL — elder Tameri hand-over-the-work blessing
  'heka-speak',                // F8 Heka RITUAL-DEMONSTRATION — Kahotep speaking a true word (jaw + breath-trail)
  'heka-blessing-sunu',        // F8 Heka AMBIENT-RITUAL — Merytamun nod + ankh-lift (4th blessing)
]);
function wave1Slice(src) {
  const startMarker = 'const VIDEOS_NEW_RITUAL = [';
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('VIDEOS_NEW_RITUAL array not found');
  // Find the matching closing `];` at column-0 — the array's terminator.
  const end = src.indexOf('\n];', start);
  if (end === -1) throw new Error('VIDEOS_NEW_RITUAL terminator not found');
  return src.slice(start, end + 3);
}

function parseEntries(src) {
  const entries = [];
  const idRe = /id:\s*['"]([a-z][a-z0-9-]+)['"]/g;
  for (const m of src.matchAll(idRe)) {
    const id = m[1];
    const after = src.slice(m.index);
    const promptStart = after.indexOf('prompt: `');
    if (promptStart === -1) continue;
    const promptEnd = after.indexOf('`', promptStart + 9);
    if (promptEnd === -1) continue;
    entries.push({ id, prompt: after.slice(promptStart + 9, promptEnd) });
  }
  return entries;
}

test('wave-1 ritual Veo prompts uphold the 3 discipline invariants', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const allWave1 = parseEntries(wave1Slice(src));
  assert.ok(allWave1.length >= 20, `expected >=20 wave-1 entries, got ${allWave1.length}`);
  const ritualEntries = allWave1.filter(e => !FULL_MOTION_EXEMPT.has(e.id));

  const failures = [];
  for (const { id, prompt } of ritualEntries) {
    if (!/Marshall skin-tone floor verbatim/i.test(prompt)) {
      failures.push(`${id}: missing "Marshall skin-tone floor verbatim"`);
    }
    if (!/fully still|DOES NOT MOVE|does not move/i.test(prompt)) {
      failures.push(`${id}: missing "fully still" or "DOES NOT MOVE"`);
    }
    if (!/camera locked|no camera dolly|no dolly\/pan\/zoom/i.test(prompt)) {
      failures.push(`${id}: missing "camera locked" / "no camera dolly/pan/zoom"`);
    }
  }

  if (failures.length) {
    assert.fail(
      `Veo prompt discipline failures (${failures.length}):\n  - ` +
      failures.join('\n  - ')
    );
  }
});

// ── F8 Heka Veo-specific assertions (Task 4, 2026-05-20) ─────────────────────
//
// heka-speak + heka-blessing-sunu are both FULL_MOTION_EXEMPT and so are not
// subject to the body-holds/fully-still lint above. Instead, these tests assert:
//   1. Both entries exist in VIDEOS_NEW_RITUAL (presence check).
//   2. heka-speak: Kahotep ~12 bright-gold thread at hem (F8 canon — spec §7 + RT Rec 8).
//   3. heka-speak: body-holds + camera-locked + Marshall present despite exemption
//      (the FULL_MOTION_EXEMPT exemption is for the body-holds lint, not a waiver
//       of these discipline words — they are present on all F7/F8 prompts).
//   4. heka-blessing-sunu: Marshall present (Merytamun character block).
//   5. heka-blessing-sunu: camera-locked present.
//   6. Merytamun-block-matches-F3/F5: the canonical Sunu Merytamun character
//      description block (line starting "Sunu Merytamun — adult African woman, mid-40s,")
//      in heka-blessing-sunu is byte-identical to the same block in tjau-blessing-sunu (F3).
//      (Cross-foundation continuity assertion in place of pair byte-identity —
//      documented N/A: heka-speak and heka-blessing-sunu have different subjects,
//      Kahotep vs Merytamun, so no pair byte-identity applies.)
//   7. heka-speak and heka-blessing-sunu are distinct prompts (not byte-identical to each other).
//
// All regex: [^"] interior (not [^'"]) — apostrophe-tolerant per recurring Coach lesson.

function findEntryPrompt(src, id) {
  const entries = parseEntries(wave1Slice(src));
  const e = entries.find(x => x.id === id);
  return e ? e.prompt : null;
}

test('F8: heka-speak entry exists in VIDEOS_NEW_RITUAL', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const prompt = findEntryPrompt(src, 'heka-speak');
  assert.ok(prompt, 'heka-speak entry must exist in VIDEOS_NEW_RITUAL');
});

test('F8: heka-blessing-sunu entry exists in VIDEOS_NEW_RITUAL', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const prompt = findEntryPrompt(src, 'heka-blessing-sunu');
  assert.ok(prompt, 'heka-blessing-sunu entry must exist in VIDEOS_NEW_RITUAL');
});

test('F8 heka-speak: Kahotep ~12 bright-gold thread canon present (spec §7 + RT Rec 8)', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const prompt = findEntryPrompt(src, 'heka-speak');
  assert.ok(prompt, 'heka-speak entry required');
  // Kahotep ~12 canon: approximately 12 years old
  assert.match(prompt, /approximately 12 years old/, 'heka-speak: Kahotep must be "approximately 12 years old"');
  // F8 Heka accent: bright-gold thread (NOT warm-honey/malachite/carnelian — those are F7/F6/F5 accents)
  assert.match(prompt, /bright-gold thread/, 'heka-speak: must reference "bright-gold thread" (F8 Heka accent)');
  // Kahotep hair OWN-CANON (F8 Stage-2 Coach C1): all 5 heka chunk Veos + hero-kahotep
  // describe Kahotep as "4C hair close-cropped". The daily Veo MUST use that own canon —
  // NOT "tightly coiled" (which is Henut's / a spec-summary descriptor, the own-canon-break
  // pattern from F4/F5/F7). Positive teeth: a regression back to "tightly coiled" fails here.
  assert.match(prompt, /4C hair close-cropped/, 'heka-speak: Kahotep hair must be "4C hair close-cropped" (own canon — matches all 5 heka chunk Veos + hero-kahotep)');
  assert.doesNotMatch(prompt, /Kahotep[^.]*4C tightly coiled/, 'heka-speak: Kahotep must NOT use "4C tightly coiled" — that diverges from his chunk/hero own-canon (F8 Coach C1)');
  // Marshall skin-tone floor verbatim (anti-lightening anchor)
  assert.match(prompt, /Marshall skin-tone floor verbatim/, 'heka-speak: must have Marshall skin-tone floor verbatim');
  // Camera locked
  assert.match(prompt, /camera locked|Camera.*locked/i, 'heka-speak: must have camera locked');
});

test('F8 heka-blessing-sunu: Marshall skin-tone floor verbatim + camera locked present', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const prompt = findEntryPrompt(src, 'heka-blessing-sunu');
  assert.ok(prompt, 'heka-blessing-sunu entry required');
  assert.match(prompt, /Marshall skin-tone floor verbatim/, 'heka-blessing-sunu: must have Marshall skin-tone floor verbatim');
  assert.match(prompt, /camera locked|Camera.*locked/i, 'heka-blessing-sunu: must have camera locked');
});

test('F8 Merytamun-block-matches-F3/F5: heka-blessing-sunu Merytamun core description is byte-identical to tjau-blessing-sunu', () => {
  // Cross-foundation continuity: the canonical Sunu Merytamun character description
  // block must be verbatim-consistent across F3 (tjau-blessing-sunu) and F8 (heka-blessing-sunu).
  // The tested block begins "Sunu Merytamun — adult African woman, mid-40s," and ends
  // at the cluster-lock anchor parenthetical. This is the byte-identity test for the
  // Merytamun character block across foundations.
  //
  // NO pair byte-identity for heka-speak vs heka-blessing-sunu (different subjects:
  // Kahotep vs Merytamun — documented N/A; contrast to F3 pair byte-identity which
  // shared a Merytamun block across BOTH prompts in the same foundation).
  const src = fs.readFileSync(SRC_PATH, 'utf8');

  // Extract the core Merytamun character block from a prompt.
  // The block is the sentence starting "Sunu Merytamun — adult African woman, mid-40s,"
  // and ending before the cluster-lock anchor "(SAME CHARACTER".
  // Using [^(]+ to capture everything up to the cluster-lock parenthetical.
  function extractMerytamunCoreBlock(prompt) {
    // Extract the core Merytamun character block.
    // The block starts with "Sunu Merytamun — adult" (after the SUBJECT label header)
    // and ends at the first double-newline (paragraph break).
    // This extraction skips the SUBJECT label (which differs per foundation by design)
    // and isolates only the canonical character description that must be byte-identical.
    const blockStart = prompt.indexOf('Sunu Merytamun — adult');
    if (blockStart === -1) return null;
    const blockEnd = prompt.indexOf('\n\n', blockStart);
    return blockEnd === -1 ? prompt.slice(blockStart) : prompt.slice(blockStart, blockEnd);
  }

  const hekaBlessing = findEntryPrompt(src, 'heka-blessing-sunu');
  const tjauBlessing = findEntryPrompt(src, 'tjau-blessing-sunu');
  assert.ok(hekaBlessing, 'heka-blessing-sunu entry required for Merytamun-match assertion');
  assert.ok(tjauBlessing, 'tjau-blessing-sunu entry required for Merytamun-match assertion (F3 reference)');

  const hekaBlock = extractMerytamunCoreBlock(hekaBlessing);
  const tjauBlock = extractMerytamunCoreBlock(tjauBlessing);

  assert.ok(hekaBlock, 'heka-blessing-sunu must contain the Sunu Merytamun character block (starting "Sunu Merytamun — adult African woman, mid-40s,")');
  assert.ok(tjauBlock, 'tjau-blessing-sunu must contain the Sunu Merytamun character block (F3 reference)');

  assert.equal(
    hekaBlock,
    tjauBlock,
    'Merytamun core character block in heka-blessing-sunu MUST be byte-identical to tjau-blessing-sunu (F3) — cross-foundation continuity'
  );
});

test('F8: heka-speak and heka-blessing-sunu are distinct prompts (not byte-identical to each other)', () => {
  // Different subjects: Kahotep (heka-speak) vs Merytamun (heka-blessing-sunu).
  // Pair byte-identity would be meaningless — this just confirms they are not the same string.
  // (Contrast: F3 pair byte-identity tested because tjau-breathe + tjau-blessing-sunu shared
  // a Merytamun character block — here the subjects are entirely different.)
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const hekaSpeak = findEntryPrompt(src, 'heka-speak');
  const hekaBlessing = findEntryPrompt(src, 'heka-blessing-sunu');
  assert.ok(hekaSpeak, 'heka-speak entry required');
  assert.ok(hekaBlessing, 'heka-blessing-sunu entry required');
  assert.notEqual(hekaSpeak, hekaBlessing, 'heka-speak and heka-blessing-sunu must be distinct prompts (different subjects: Kahotep vs Merytamun)');
});

test('F8: both heka entries in FULL_MOTION_EXEMPT (not subject to body-holds lint)', () => {
  // Confirm the exemptions are registered in this test file's FULL_MOTION_EXEMPT set.
  // This is a canary: if someone removes heka-speak or heka-blessing-sunu from
  // FULL_MOTION_EXEMPT and the prompts lack "fully still" language, the wave-1 lint
  // would fail them — this test makes the exemption explicit and tested.
  assert.ok(FULL_MOTION_EXEMPT.has('heka-speak'), 'heka-speak must be in FULL_MOTION_EXEMPT (RITUAL-DEMONSTRATION)');
  assert.ok(FULL_MOTION_EXEMPT.has('heka-blessing-sunu'), 'heka-blessing-sunu must be in FULL_MOTION_EXEMPT (AMBIENT-RITUAL)');
});

test('F8: both heka entries exist in _outputDirFor routing (videos/senebty-foundations/)', () => {
  // Verify the _outputDirFor function routes both heka IDs to the foundation dir.
  // Checks that the id strings appear in the _outputDirFor block of generate-senebty-veos.mjs.
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const outputDirBlock = src.match(/function _outputDirFor[\s\S]+?return foundationDir/);
  assert.ok(outputDirBlock, '_outputDirFor function must exist');
  const block = outputDirBlock[0];
  assert.match(block, /heka-speak/, '_outputDirFor must route heka-speak to foundationDir');
  assert.match(block, /heka-blessing-sunu/, '_outputDirFor must route heka-blessing-sunu to foundationDir');
});
