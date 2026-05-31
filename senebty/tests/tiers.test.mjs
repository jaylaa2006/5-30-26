#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const SRC = fs.readFileSync(new URL('../lib/tiers.js', import.meta.url), 'utf8');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(SRC, ctx);

const tiers = ctx.window.Senebty.tiers;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

const EXPECTED_KEYS = ['hem-sba','seba-en-seneb','sesh-en-per-ankh','wabau','sunu-sba','shemes-imhotep'];

check('tiers is an array of length 6', () => {
  assert.ok(Array.isArray(tiers), 'tiers not an array');
  assert.equal(tiers.length, 6);
});

for (let i = 0; i < EXPECTED_KEYS.length; i++){
  const key = EXPECTED_KEYS[i];
  check(`tier[${i}].key === '${key}'`, () => assert.equal(tiers[i].key, key));
}

for (const t of tiers){
  check(`${t.key} has displayName / translation / mdwNtr-or-null / gate / advancementCopy`, () => {
    assert.ok(typeof t.displayName === 'string' && t.displayName.length > 0);
    assert.ok(typeof t.translation === 'string' && t.translation.length > 0);
    assert.ok(t.mdwNtr === null || typeof t.mdwNtr === 'string');
    assert.ok(t.gate && typeof t.gate.type === 'string');
    assert.ok(typeof t.advancementCopy === 'string' && t.advancementCopy.length > 0);
  });
  check(`${t.key} advancementCopy passes tone-canon (no celebratory mascot voice)`, () => {
    const banned = /(great job|amazing|awesome|way to go|you did it|keep going|perfect!|don't give up|try again, friend|nice work|\bbuddy\b|\bchampion\b|\bscholar\b|continue!|🎉|✨|🌟)/i;
    assert.ok(!banned.test(t.advancementCopy), 'tone-canon violation: ' + t.advancementCopy);
  });
}

// Phase 1.1 Cultural Consensus Panel — tier 6 rename + retranslation assertions
check('tier[5].key === "shemes-imhotep" (renamed from sa-imhotep, Phase 1.1)', () => {
  assert.equal(tiers[5].key, 'shemes-imhotep');
});
check('tier[5].translation === "Disciple of Imhotep" (Phase 1.1 correction)', () => {
  assert.equal(tiers[5].translation, 'Disciple of Imhotep');
});
// Phase 1.1 — tier 4 wabau displayName plural
check('tier[3].displayName === "Pure Ones" (plural, Phase 1.1 correction)', () => {
  assert.equal(tiers[3].displayName, 'Pure Ones');
});

// Phase 1.3 — sigilSrc field on confidence:'none' tiers (T0/T1/T4/T5).
// Project-coined compounds dropped their mdw nṯr; sigil art restores visual identity.
const SIGIL_TIER_INDICES = [0, 1, 4, 5];
for (const i of SIGIL_TIER_INDICES){
  check(`tier[${i}] (${tiers[i].key}) has sigilSrc field`, () => {
    assert.ok('sigilSrc' in tiers[i], 'sigilSrc field missing');
    assert.ok(tiers[i].sigilSrc === null || typeof tiers[i].sigilSrc === 'string', 'sigilSrc must be null or string');
  });
  check(`tier[${i}] (${tiers[i].key}) has confidence:'none' (sanity — sigilSrc only on dropped-glyph tiers)`, () => {
    assert.equal(tiers[i].mdwNtrConfidence, 'none');
    assert.equal(tiers[i].mdwNtr, null);
  });
}

// Inverse — T2/T3 (attested glyphs) MUST NOT carry sigilSrc.
for (const i of [2, 3]){
  check(`tier[${i}] (${tiers[i].key}) MUST NOT have sigilSrc (attested glyph, no sigil needed)`, () => {
    assert.ok(!('sigilSrc' in tiers[i]), 'attested-glyph tier must not declare sigilSrc field at all');
  });
}

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
