#!/usr/bin/env node
// Asserts every mdw ntr glyph in senebty/lib/tiers.js + glossary-entries.js is a valid Egyptian Hieroglyphs Unicode codepoint (U+13000 — U+1342F).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const TIERS = fs.readFileSync(new URL('../lib/tiers.js', import.meta.url), 'utf8');
const GLOSS = fs.readFileSync(new URL('../lib/glossary-entries.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(TIERS, ctx);
vm.runInContext(GLOSS, ctx);

const tiers = ctx.window.Senebty.tiers;
const entries = ctx.window.Senebty.glossaryEntries;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

function isHieroglyph(cp){ return cp >= 0x13000 && cp <= 0x1342F; }

function auditString(label, s){
  if (s === null || s === '' || s === undefined) return; // null mdwNtr is allowed (T10 audit-pending marker)
  for (const ch of s){
    const cp = ch.codePointAt(0);
    if (cp >= 0x13000 && cp <= 0x1342F) {
      // Valid hieroglyph block — no assertion needed (range check IS the assertion)
    } else if (cp > 0x7F) {
      // Non-ASCII outside hieroglyph block: allowed only for em-dash, smart quotes, etc. Flag others.
      const allowedNonAscii = new Set([0x2014, 0x2013, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026]);
      assert.ok(allowedNonAscii.has(cp), `${label}: unexpected non-hieroglyph non-ASCII codepoint U+${cp.toString(16)}`);
    }
  }
}

for (const t of tiers){
  check(`tier "${t.key}" mdwNtr passes glyph audit`, () => auditString(`tier ${t.key}`, t.mdwNtr));
}
for (const k of Object.keys(entries)){
  const e = entries[k];
  if (e.symbol) check(`entry "${k}" symbol passes glyph audit`, () => auditString(`entry ${k} symbol`, e.symbol));
  if (e.term !== undefined) check(`entry "${k}" term passes glyph audit`, () => auditString(`entry ${k} term`, e.term));
  if (e.name !== undefined) check(`entry "${k}" name passes glyph audit`, () => auditString(`entry ${k} name`, e.name));
}

// ─── Phase 1.2 Confidence Schema Assertions (hard — was deferred soft-check) ──
// Phase 1.2 closed 2026-04-27: all 12 glossary entries + 6 tier titles now
// carry an explicit `confidence` value in the 4-level schema. The DEFERRED set
// is empty; the soft "Phase 1.2 comment in source" check is replaced with a
// per-entry confidence-enum assertion (mirrors glossary-entries.test.mjs).
const VALID_MDW_NTR_CONFIDENCE = new Set(['high', 'medium', 'low', 'none']);

const GLOSS_SRC = fs.readFileSync(new URL('../lib/glossary-entries.js', import.meta.url), 'utf8');
const TIERS_SRC = fs.readFileSync(new URL('../lib/tiers.js', import.meta.url), 'utf8');

for (const k of Object.keys(entries)){
  const e = entries[k];
  check(`entry "${k}" has confidence in valid 4-level enum`, () => {
    assert.ok(VALID_MDW_NTR_CONFIDENCE.has(e.confidence),
      `confidence for "${k}" is "${e.confidence}", expected one of: ${[...VALID_MDW_NTR_CONFIDENCE].join(', ')}`);
  });
  // Symbol-presence ↔ confidence consistency: NONE → symbol must be null/empty;
  // any other confidence → symbol must be non-empty.
  check(`entry "${k}" symbol-presence matches confidence (${e.confidence})`, () => {
    if (e.confidence === 'none'){
      assert.ok(!e.symbol, `entry "${k}" has confidence:'none' but symbol is "${e.symbol}" — should be null/empty`);
    } else {
      assert.ok(e.symbol && e.symbol.length > 0, `entry "${k}" has confidence:'${e.confidence}' but symbol is missing`);
    }
  });
}

for (const t of tiers){
  check(`tier "${t.key}" has mdwNtrConfidence in valid 4-level enum`, () => {
    assert.ok(VALID_MDW_NTR_CONFIDENCE.has(t.mdwNtrConfidence),
      `mdwNtrConfidence for tier "${t.key}" is "${t.mdwNtrConfidence}", expected one of: ${[...VALID_MDW_NTR_CONFIDENCE].join(', ')}`);
  });
  check(`tier "${t.key}" mdwNtr-presence matches mdwNtrConfidence (${t.mdwNtrConfidence})`, () => {
    if (t.mdwNtrConfidence === 'none'){
      assert.ok(!t.mdwNtr, `tier "${t.key}" has mdwNtrConfidence:'none' but mdwNtr is "${t.mdwNtr}" — should be null/empty`);
    } else {
      assert.ok(t.mdwNtr && t.mdwNtr.length > 0, `tier "${t.key}" has mdwNtrConfidence:'${t.mdwNtrConfidence}' but mdwNtr is missing`);
    }
  });
}

check('glossary-entries.js top-of-file comment block mentions "Cultural Consensus Panel" and "Phase 1.2"', () => {
  assert.ok(GLOSS_SRC.includes('Cultural Consensus Panel'), 'glossary-entries.js missing "Cultural Consensus Panel" in header comment');
  assert.ok(GLOSS_SRC.includes('Phase 1.2'), 'glossary-entries.js missing "Phase 1.2" in header comment');
});

check('Africana primary sources cited in glossary-entries.js header (Karenga + Carruthers + Obenga)', () => {
  assert.ok(GLOSS_SRC.includes('Karenga'), 'glossary-entries.js header should cite Karenga');
  assert.ok(GLOSS_SRC.includes('Carruthers'), 'glossary-entries.js header should cite Carruthers');
  assert.ok(GLOSS_SRC.includes('Obenga'), 'glossary-entries.js header should cite Obenga');
});

// Phase 1.3 — sigil-bearing tiers (confidence:'none' + sigilSrc) are valid.
// Locks in the invariant: a tier with confidence:'none' has mdwNtr=null AND
// sigilSrc is either null (pre-asset) or a string path. Attested-glyph tiers
// (confidence !== 'none') must NOT carry sigilSrc.
const droppedGlyphTiers = tiers.filter(t => t.mdwNtrConfidence === 'none');
const attestedGlyphTiers = tiers.filter(t => t.mdwNtrConfidence !== 'none');

for (const t of droppedGlyphTiers){
  check(`tier ${t.key} (confidence:none) — mdwNtr is null AND sigilSrc is null-or-string`, () => {
    assert.equal(t.mdwNtr, null);
    assert.ok(t.sigilSrc === null || typeof t.sigilSrc === 'string');
  });
}
for (const t of attestedGlyphTiers){
  check(`tier ${t.key} (confidence !== none) — must NOT declare sigilSrc field`, () => {
    assert.ok(!('sigilSrc' in t), 'attested-glyph tier should not declare sigilSrc');
  });
}

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
