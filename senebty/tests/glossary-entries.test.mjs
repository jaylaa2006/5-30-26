#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const SRC = fs.readFileSync(new URL('../lib/glossary-entries.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(SRC, ctx);

const entries = ctx.window.Senebty.glossaryEntries;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

const EXPECTED_KEYS = ['senebty','iri','seneb','tjau','mu','htep','hesi','khepesh','senedjem','khat','wabau','sunu'];

check('exports an object', () => assert.equal(typeof entries, 'object'));

for (const key of EXPECTED_KEYS){
  check(`entry "${key}" exists`, () => assert.ok(entries[key], 'missing key ' + key));
  if (entries[key]){
    const e = entries[key];
    check(`entry "${key}" has both new shape (name/full/brief) AND legacy shape (term/def) for INLINE_REFS compat`, () => {
      assert.ok(typeof e.name === 'string' && e.name.length > 0, 'name missing/empty');
      assert.ok(typeof e.full === 'string' && e.full.length > 0, 'full missing/empty');
      assert.ok(typeof e.term === 'string' && e.term.length > 0, 'term alias missing — INLINE_REFS loop will crash');
      assert.ok(typeof e.def === 'string' && e.def.length > 0, 'def alias missing — INLINE_REFS loop will crash');
    });
  }
}

check('exactly 12 entries with expected keys (webed dropped, wedeha→htep per Phase 1.1)', () => {
  const keys = Object.keys(entries).sort();
  assert.equal(keys.length, 12);
  const expected = ['hesi','htep','iri','khat','khepesh','mu','seneb','senedjem','senebty','sunu','tjau','wabau'].sort();
  assert.deepEqual(keys, expected);
});

for (const k of Object.keys(entries)){
  const e = entries[k];
  check(`entry "${k}" dual-shape consistent`, () => {
    if (e.term !== undefined) assert.equal(e.term, e.name);
    if (e.def !== undefined) assert.equal(e.def, e.full);
  });
}

const VALID_CATEGORIES = new Set(['treasure', 'body', 'role', 'verb']);
const EXPECTED_CATEGORY = {
  senebty:  'verb',      // "be in health" — verb-of-command
  iri:      'verb',
  seneb:    'verb',
  tjau:     'treasure',
  mu:       'treasure',
  htep:     'treasure',
  hesi:     'treasure',
  khepesh:  'treasure',
  senedjem: 'treasure',
  khat:     'body',
  wabau:    'role',
  sunu:     'role'
};

for (const key of EXPECTED_KEYS){
  check(`entry "${key}" has category in valid enum`, () => {
    assert.ok(VALID_CATEGORIES.has(entries[key].category),
      `category for "${key}" is "${entries[key].category}", expected one of: ${[...VALID_CATEGORIES].join(', ')}`);
  });
  check(`entry "${key}" category matches expected (${EXPECTED_CATEGORY[key]})`, () => {
    assert.equal(entries[key].category, EXPECTED_CATEGORY[key]);
  });
}

// Phase 1.2 (2026-04-27) confidence-schema assertions:
// every entry must carry a 'confidence' field of 'high' | 'medium' | 'low' | 'none'.
// Specific Phase 1.2 verdicts (Africana primary + Western secondary, see audit):
//   HIGH:   iri (D4 single ideogram), htep (R4 single ideogram),
//           mu (N35A single ideogram), khepesh (T16 single ideogram),
//           khat (F32 — Karenga's life-bearer reading), wabau (D60 Africana override)
//   MEDIUM: senebty (5-sign s-n-b-t-y), seneb (3-sign s-n-b),
//           tjau, hesi, senedjem, sunu (multi-codepoint phonetic spellings)
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low', 'none']);
// Phase 1.2 closure (2026-05-01) — Africana / ASCAC consultation:
//   CONFIRMED to high  : senebty (Carruthers + Karenga + Beatty)
//                        seneb   (Carruthers + Karenga + Finch)
//   DROPPED to none    : senedjem (Africana primary silent on glyph form)
//   DEFERRED at medium : tjau, hesi, sunu — pending codepoint verification
const EXPECTED_CONFIDENCE = {
  iri:      'high',     htep:     'high',     mu:       'high',
  khepesh:  'high',     khat:     'high',     wabau:    'high',
  senebty:  'high',     seneb:    'high',     senedjem: 'none',
  tjau:     'medium',   hesi:     'medium',   sunu:     'medium'
};

for (const key of EXPECTED_KEYS){
  check(`entry "${key}" has confidence in valid enum`, () => {
    assert.ok(VALID_CONFIDENCE.has(entries[key].confidence),
      `confidence for "${key}" is "${entries[key].confidence}", expected one of: ${[...VALID_CONFIDENCE].join(', ')}`);
  });
  check(`entry "${key}" confidence matches Phase 1.2 verdict (${EXPECTED_CONFIDENCE[key]})`, () => {
    assert.equal(entries[key].confidence, EXPECTED_CONFIDENCE[key]);
  });
}

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
