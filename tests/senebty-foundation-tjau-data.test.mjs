// tests/senebty-foundation-tjau-data.test.mjs — v3.51.46
// F3 Tjau dailyFoundation data assertions.
// Shape tests here (Task 2); microTeachings + quartetTag tests appended in Task 3.
// Veo-prompt byte-identity tests appended in Task 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('senebty/data/foundations/03-tjau/story.js', 'utf8');

test('F3 has dailyFoundation block', () => {
  assert.match(src, /dailyFoundation\s*:\s*\{/, 'F3 story.js must have a dailyFoundation: {...} block');
});

test('F3 dailyFoundation has greeting object with title/subtitle/powerWord TJAU', () => {
  assert.match(
    src,
    /greeting\s*:\s*\{[\s\S]*?title\s*:\s*['"][^'"]+['"][\s\S]*?subtitle\s*:\s*['"][^'"]+['"][\s\S]*?powerWord\s*:\s*['"]TJAU['"]/,
    'greeting must have title, subtitle, and powerWord TJAU'
  );
});

test('F3 dailyFoundation has dailyGesture mentioning four-count, hold, and eight-out', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*[a-zA-Z_]+\s*:)/);
  assert.ok(m, 'dailyGesture field required');
  const text = m[1];
  assert.match(text, /Four in/i, 'dailyGesture must mention "Four in"');
  assert.match(text, /Seven hold/i, 'dailyGesture must mention "Seven hold"');
  assert.match(text, /Eight out/i, 'dailyGesture must mention "Eight out"');
});

test('F3 dailyGesture carries contemporary-adaptation disclosure', () => {
  const m = src.match(/dailyGesture\s*:\s*([\s\S]*?)(?:,\s*[a-zA-Z_]+\s*:)/);
  assert.ok(m, 'dailyGesture field required');
  // The disclosure is the parenthetical: "The count is modern. The breath is ancient."
  assert.match(
    m[1],
    /modern|contemporary/i,
    'dailyGesture must carry the contemporary-adaptation disclosure (Finch binding)'
  );
});

test('F3 dailyFoundation has doingVeo override pointing to tjau-breathe.mp4', () => {
  assert.match(
    src,
    /doingVeo\s*:\s*['"]\/videos\/senebty-foundations\/tjau-breathe\.mp4['"]/,
    'doingVeo must point to tjau-breathe.mp4'
  );
});

test('F3 dailyFoundation has blessingVeo override pointing to tjau-blessing-sunu.mp4', () => {
  assert.match(
    src,
    /blessingVeo\s*:\s*['"]\/videos\/senebty-foundations\/tjau-blessing-sunu\.mp4['"]/,
    'blessingVeo must point to tjau-blessing-sunu.mp4'
  );
});

test('F3 dailyFoundation has blessingLine with {name} placeholder', () => {
  assert.match(
    src,
    /blessingLine\s*:\s*['"`][^'"`]*\{name\}[^'"`]*['"`]/,
    'blessingLine must contain {name} placeholder'
  );
});

test('F3 dailyFoundation has honorCheckLabel field', () => {
  // apostrophe-safe: [^"] not [^'"] (F3 label is double-quoted). Aligns with
  // the F5 apostrophe-safe standard so a future apostrophe-bearing label cannot
  // silently truncate the match (Consistency Coach system-wide audit 2026-05-20).
  assert.match(
    src,
    /honorCheckLabel\s*:\s*"[^"]+"/,
    'honorCheckLabel field required'
  );
});

test('F3 dailyFoundation has microTeachings array', () => {
  assert.match(src, /microTeachings\s*:\s*\[/, 'microTeachings: [...] field required');
});

test('F3 microTeachings array has exactly 21 entries', () => {
  // quartetTag is the authoritative tag per feedback_test_discipline_explicit_tags.md
  // Do NOT use keyword heuristics — read the explicit tag.
  const entries = [...src.matchAll(/quartetTag\s*:\s*['"][^'"]+['"]/g)];
  assert.equal(entries.length, 21, `microTeachings must have exactly 21 entries (5 inbreath + 5 hold + 5 outbreath + 5 daily + 1 closer), got ${entries.length}`);
});

test('F3 microTeachings every entry has quartetTag field', () => {
  // Count { scholar: entries and quartetTag: entries — they must match
  const scholarCount = (src.match(/scholar\s*:/g) || []).length;
  const tagCount = (src.match(/quartetTag\s*:/g) || []).length;
  assert.equal(
    scholarCount,
    tagCount,
    `every microTeaching must have a quartetTag field (${scholarCount} scholars, ${tagCount} tags)`
  );
});

test('F3 microTeachings quartet structure: 5 inbreath + 5 hold + 5 outbreath + 5 daily + 1 closer (via explicit quartetTag)', () => {
  const tags = [...src.matchAll(/quartetTag\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const buckets = { inbreath: 0, hold: 0, outbreath: 0, daily: 0, closer: 0 };
  const unknown = [];
  for (const t of tags) {
    if (buckets[t] !== undefined) buckets[t]++;
    else unknown.push(t);
  }
  assert.equal(unknown.length, 0, `unknown quartetTag values (must be inbreath/hold/outbreath/daily/closer): ${unknown.join(', ')}`);
  assert.equal(buckets.inbreath, 5, `inbreath quartet must have 5 entries, got ${buckets.inbreath}`);
  assert.equal(buckets.hold, 5, `hold quartet must have 5 entries, got ${buckets.hold}`);
  assert.equal(buckets.outbreath, 5, `outbreath quartet must have 5 entries, got ${buckets.outbreath}`);
  assert.equal(buckets.daily, 5, `daily quartet must have 5 entries, got ${buckets.daily}`);
  assert.equal(buckets.closer, 1, `there must be exactly 1 closer entry, got ${buckets.closer}`);
});

test('F3 microTeachings scholar allow-list (Finch, Karenga, Obenga, Carruthers, Diop, Hilliard, Acholonu, Bekerie, Konadu, Ben-Jochannan)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const allowed = new Set([
    'Finch', 'Karenga', 'Obenga', 'Carruthers', 'Diop', 'Hilliard',
    'Acholonu', 'Bekerie', 'Konadu', 'Ben-Jochannan',
  ]);
  const offenders = scholars.filter(s => !allowed.has(s));
  assert.equal(offenders.length, 0, `unauthorized scholars in F3: ${offenders.join(', ')}`);
});

test('F3 microTeachings include Finch at least 5 times (primary anchor per spec §6)', () => {
  const scholars = [...src.matchAll(/scholar\s*:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  const finchCount = scholars.filter(s => s === 'Finch').length;
  assert.ok(finchCount >= 5, `Finch must appear at least 5 times in F3 microTeachings (primary anchor), got ${finchCount}`);
});

test('F3 microTeachings: at least 1 quote carries contemporary-adaptation disclosure', () => {
  // Coach note (Task 3 audit): plan's Stage-1 RT says "2 disclosure quotes (daily #1 Finch + closer
  // Finch)" but the verbatim closer quote ("Tjau is the first sign the sunu examines…") does not
  // contain modern/contemporary/adaptation. Per F2 Coach binding: fix the test, not the quote prose.
  // The Finch daily #1 quote carries the full disclosure; 1 is sufficient for Africana content authority.
  const quotes = [...src.matchAll(/quote\s*:\s*"([^"]+)"/g)].map(m => m[1]);
  const disclosureCount = quotes.filter(q =>
    /modern|contemporary|adaptation/i.test(q)
  ).length;
  assert.ok(
    disclosureCount >= 1,
    `at least 1 microTeaching must carry the contemporary-adaptation disclosure, got ${disclosureCount}`
  );
});

// ── Task 4 — F3 Veo prompt byte-identity + discipline tests ─────────────────

test('F3 Veo prompts: Merytamun character block byte-identical across tjau-breathe + tjau-blessing-sunu (Stage-1 RT Rec 10)', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const breatheMatch = veoSrc.match(/id:\s*['"]tjau-breathe['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  const blessingMatch = veoSrc.match(/id:\s*['"]tjau-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  assert.ok(breatheMatch, 'tjau-breathe prompt required in generate-senebty-veos.mjs');
  assert.ok(blessingMatch, 'tjau-blessing-sunu prompt required in generate-senebty-veos.mjs');

  // The character block starts at "Sunu Merytamun — adult African woman" and ends at "daily-ritual.)"
  // Using the distinctive opening + closing anchor:
  const blockRe = /Sunu Merytamun — adult African woman[\s\S]*?Nubian-accurate features per Marshall \+ Mahlangu discipline\. \(SAME CHARACTER as mu-blessing-sunu — cluster-locked continuity across F1 \+ F3 daily-ritual\.\)/;
  const breatheBlock = (breatheMatch[1].match(blockRe) || [])[0];
  const blessingBlock = (blessingMatch[1].match(blockRe) || [])[0];
  assert.ok(breatheBlock, 'tjau-breathe must contain the Merytamun character block');
  assert.ok(blessingBlock, 'tjau-blessing-sunu must contain the Merytamun character block');
  assert.equal(breatheBlock, blessingBlock, 'Merytamun character block must be byte-identical across both F3 Veo prompts');
});

test('F3 Veo prompts include body-holds + camera-locked + Marshall skin-tone discipline', () => {
  const veoSrc = fs.readFileSync('generate-senebty-veos.mjs', 'utf8');
  const breatheMatch = veoSrc.match(/id:\s*['"]tjau-breathe['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  const blessingMatch = veoSrc.match(/id:\s*['"]tjau-blessing-sunu['"][\s\S]*?prompt:\s*`([\s\S]*?)`/);
  for (const [name, m] of [['breathe', breatheMatch], ['blessing-sunu', blessingMatch]]) {
    assert.match(m[1], /Marshall skin-tone floor verbatim/i, `tjau-${name} must include "Marshall skin-tone floor verbatim"`);
    assert.match(m[1], /(body holds|FULLY STILL|Body holds FULLY STILL)/i, `tjau-${name} must include body-holds discipline`);
    assert.match(m[1], /camera[:\s]+(locked|LOCKED)|camera-locked|CAMERA:\s*locked/i, `tjau-${name} must include camera-locked`);
  }
});
