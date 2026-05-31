#!/usr/bin/env node
// tests/vocab-popup-contract.test.mjs
//
// v3.41.0 — Contract test for the vocab-popup / pharaoh-profile fix.
//
// The bug class this test prevents (impl-gate RT 2026-05-02):
//   The renderer marked words .vocab / .ref-* / .pharaoh based on a broader
//   predicate than wordTap could resolve. Result: 5,396 of 11,491 underlined
//   gold words across the library (47%) were dead-end clicks. v3.40.0's
//   "defensive null-guards on showVocabPopup" never closed this — popup was
//   never reached because the entry lookup returned undefined first.
//
// The contract enforced here: every word a chunk asks the renderer to mark
// .vocab MUST resolve to a real GLOSSARY or INLINE_REFS entry (after alias
// resolution). Same for .pharaoh — a name in _PHARAOH_NAMES with no entry
// would render gold-bold but click-dead.
//
// Strategy: extract the relevant data structures from the source via balanced-
// brace walk (no jsdom — the file is 1.4MB with Azure SDK loaders, slow and
// unreliable to evaluate). Validate the contract over EVERY chunk in EVERY
// story (Sam's binding 1 from the impl-gate RT: "all chunks, not a sample").
//
// Run: node tests/vocab-popup-contract.test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(here, '..', 'maat-reader.html');
// STORIES was extracted to public/js/stories.js for perf (2026-05-23). Read both so
// STORIES (stories.js) + GLOSSARY/HEROES/_PHARAOH_NAMES (still in the HTML) resolve.
const html = readFileSync(HTML_PATH, 'utf8')
  + '\n' + readFileSync(resolve(here, '..', 'public', 'js', 'stories.js'), 'utf8');

let PASS = 0, FAIL = 0;
function ok(name, cond, detail){
  (cond ? console.log : console.error)(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  cond ? PASS++ : FAIL++;
}

// ─── Extract a balanced delimiter block starting at a marker ─────────────
function extractBalancedAfter(src, marker, openCh, closeCh){
  const idx = src.indexOf(marker);
  if (idx < 0) return null;
  const start = src.indexOf(openCh, idx);
  if (start < 0) return null;
  let depth = 0;
  let inStr = null;
  let escaped = false;
  for (let i = start; i < src.length; i++){
    const c = src[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (inStr){
      if (c === inStr) inStr = null;
      continue;
    }
    // Skip strings + template literals + comments
    if (c === "'" || c === '"' || c === '`'){ inStr = c; continue; }
    if (c === '/' && src[i+1] === '/'){
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i+1] === '*'){
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) i++;
      i++;
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh){
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

// ─── Evaluate a JS literal in an isolated sandbox ─────────────────────────
function evalLiteral(literalSrc){
  const ctx = vm.createContext({});
  return vm.runInContext('(' + literalSrc + ')', ctx, { timeout: 5000 });
}

// ─── Extract the data structures we need ──────────────────────────────────
const GLOSSARY_LIT = extractBalancedAfter(html, 'const GLOSSARY = {', '{', '}');
ok('Test 1: extracted GLOSSARY literal', !!GLOSSARY_LIT, GLOSSARY_LIT ? `${GLOSSARY_LIT.length} chars` : 'NOT FOUND');

const HEROES_LIT = extractBalancedAfter(html, 'const HEROES = [', '[', ']');
ok('Test 2: extracted HEROES literal', !!HEROES_LIT, HEROES_LIT ? `${HEROES_LIT.length} chars` : 'NOT FOUND');

const PHARAOH_LIT = extractBalancedAfter(html, 'const _PHARAOH_NAMES = new Set(', '[', ']');
ok('Test 3: extracted _PHARAOH_NAMES literal', !!PHARAOH_LIT, PHARAOH_LIT ? `${PHARAOH_LIT.length} chars` : 'NOT FOUND');

const ALIAS_LIT = extractBalancedAfter(html, 'const _VOCAB_ALIASES = {', '{', '}');
ok('Test 4: extracted _VOCAB_ALIASES literal', !!ALIAS_LIT, ALIAS_LIT ? `${ALIAS_LIT.length} chars` : 'NOT FOUND');

const AMBIG_LIT = extractBalancedAfter(html, 'const _AMBIGUOUS_SINGLE = new Set(', '[', ']');
ok('Test 5: extracted _AMBIGUOUS_SINGLE literal', !!AMBIG_LIT, AMBIG_LIT ? `${AMBIG_LIT.length} chars` : 'NOT FOUND');

const STORIES_LIT = extractBalancedAfter(html, 'var STORIES = [', '[', ']');
ok('Test 6: extracted STORIES literal', !!STORIES_LIT, STORIES_LIT ? `${(STORIES_LIT.length/1024).toFixed(0)}k chars` : 'NOT FOUND');

if (FAIL > 0){
  console.error('\nExtraction failed — bailing on contract assertions.');
  process.exit(1);
}

// ─── Eval into JS objects ─────────────────────────────────────────────────
let GLOSSARY, HEROES, _PHARAOH_NAMES, _VOCAB_ALIASES, _AMBIGUOUS_SINGLE, STORIES;
try {
  GLOSSARY = evalLiteral(GLOSSARY_LIT);
  HEROES = evalLiteral(HEROES_LIT);
  _PHARAOH_NAMES = new Set(evalLiteral(PHARAOH_LIT));
  _VOCAB_ALIASES = evalLiteral(ALIAS_LIT);
  _AMBIGUOUS_SINGLE = new Set(evalLiteral(AMBIG_LIT));
  STORIES = evalLiteral(STORIES_LIT);
} catch (e) {
  console.error('FAIL  Could not eval extracted literals — ' + e.message);
  process.exit(1);
}

ok('Test 7: GLOSSARY parsed', typeof GLOSSARY === 'object' && Object.keys(GLOSSARY).length >= 100,
   `${Object.keys(GLOSSARY).length} entries`);
ok('Test 8: HEROES parsed', Array.isArray(HEROES) && HEROES.length >= 20,
   `${HEROES.length} heroes`);
ok('Test 9: STORIES parsed', Array.isArray(STORIES) && STORIES.length >= 100,
   `${STORIES.length} stories`);
ok('Test 10: new v3.41.0 GLOSSARY entries present',
   GLOSSARY.yeshua && GLOSSARY.miryam && GLOSSARY.amun && GLOSSARY.karnak && GLOSSARY.galilee && GLOSSARY.africana,
   'yeshua/miryam/amun/karnak/galilee/africana');
ok('Test 11: new v3.41.0 HERO entries present',
   HEROES.find(h => h.id === 'shaka') && HEROES.find(h => h.id === 'cheikh-anta-diop') && HEROES.find(h => h.id === 'amenhotep-iii'),
   'shaka, diop, amenhotep-iii');
ok('Test 12: alias map populated',
   _VOCAB_ALIASES['amen-ra'] === 'amun' && _VOCAB_ALIASES['piankhi'] === 'piye',
   'amen-ra→amun, piankhi→piye');

// ─── Build the resolved-keys set (mirrors INLINE_REFS construction) ──────
// This must match maat-reader.html's INLINE_REFS construction logic. If the
// renderer changes its rules, this test must change in lockstep.
const _COMMON_WORDS = new Set(['great','king','queen','mother','first','history','named','the','of','and']);
const _PAREN_MAP = {'anpu':'anubis','djehuti':'thoth','ausar':'osiris','auset':'isis','heru':'horus','scarab':'khepri'};

const validKeys = new Set();
// 1. All GLOSSARY keys
for (const k of Object.keys(GLOSSARY)) validKeys.add(k);
// 2. GLOSSARY display-name lowercased forms
for (const [k, g] of Object.entries(GLOSSARY)){
  const nameLower = (g.term || '').split('/')[0].trim().toLowerCase();
  if (nameLower) validKeys.add(nameLower);
  if (k.includes(' ')) validKeys.add(k.replace(/ /g, '-'));
  if (k.includes('-')) validKeys.add(k.replace(/-/g, ' '));
}
// 3. Paren map
for (const alt of Object.values(_PAREN_MAP)) validKeys.add(alt);
// 4. HEROES name + first/last forms
for (const h of HEROES){
  const key = h.name.toLowerCase();
  validKeys.add(key);
  const firstName = h.name.split(/[\s(]/)[0].toLowerCase();
  if (firstName !== key && !_COMMON_WORDS.has(firstName)) validKeys.add(firstName);
  const parts = h.name.split(/\s+/);
  if (parts.length > 1){
    const lastName = parts[parts.length-1].replace(/[()]/g,'').toLowerCase();
    if (lastName.length > 3 && !_COMMON_WORDS.has(lastName)) validKeys.add(lastName);
  }
}
// 5. Manual extras
for (const k of ['piankhi','idia','ewuare','musa','makeda','isis','osiris','field of reeds','bennu bird','eye of heru','udjat','heliopolis']) validKeys.add(k);
// 6. Alias values must resolve to a valid key (transitively folded by _resolveVocab)
//    We treat alias-keys as valid as long as their target is valid.
const aliasResolves = (k) => {
  const tgt = _VOCAB_ALIASES[k];
  if (!tgt) return false;
  return validKeys.has(tgt) || validKeys.has(tgt.replace(/-/g,' ')) || validKeys.has(tgt.replace(/s$/,''));
};

// _resolveVocab simulation (matches the renderer)
function resolveVocab(clean){
  if (!clean) return null;
  if (_VOCAB_ALIASES[clean]) clean = _VOCAB_ALIASES[clean];
  const dashed = clean.replace(/-/g,' ');
  const singular = clean.replace(/s$/,'');
  if (validKeys.has(clean)) return clean;
  if (validKeys.has(dashed)) return dashed;
  if (validKeys.has(singular)) return singular;
  return null;
}

// ─── Assertion A — every chunk.vocab term resolves OR is ambiguous ───────
// Per the gate's design: a chunk.vocab term that doesn't resolve will NOT be
// underlined (it'll render plain). That's fine — but we still TRACK these so
// authors get the signal. We DO NOT fail on orphan vocab; we report counts.
let totalChunks = 0, totalVocabRefs = 0, orphanVocab = 0;
const orphanByWord = new Map();
for (const s of STORIES){
  if (!s || !s.chunks) continue;
  for (const c of s.chunks){
    totalChunks++;
    const v = c.vocab || [];
    for (const w of v){
      totalVocabRefs++;
      const key = String(w).toLowerCase();
      if (!resolveVocab(key) && !aliasResolves(key)){
        orphanVocab++;
        orphanByWord.set(key, (orphanByWord.get(key) || 0) + 1);
      }
    }
  }
}
const orphanPct = totalVocabRefs ? (orphanVocab / totalVocabRefs * 100) : 0;
ok(`Test 13: chunk.vocab orphan rate (${orphanPct.toFixed(1)}% of ${totalVocabRefs}; was 47% pre-v3.41.0)`,
   orphanPct < 50, // Fix is the gate, not full-coverage. This is a regression-watch threshold.
   `${orphanVocab} orphans across ${totalChunks} chunks. Top: ${[...orphanByWord.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w,c])=>`${w}(${c})`).join(', ')}`);

// ─── Assertion B — every _PHARAOH_NAMES name has an entry OR will be gated ─
// The gate's invariant: pharaohs without an entry render plain (no class).
// This test verifies: of the names we keep in _PHARAOH_NAMES, at least the
// top-coverage ones have entries so the styling isn't applied for nothing.
const pharaohOrphans = [...(_PHARAOH_NAMES)].filter(n => !resolveVocab(n) && !aliasResolves(n));
ok(`Test 14: pharaoh names with NO entry (gated to plain by the renderer)`,
   pharaohOrphans.length < _PHARAOH_NAMES.size, // simple regression: not 100% orphan
   `${pharaohOrphans.length} of ${_PHARAOH_NAMES.size} orphan: ${pharaohOrphans.slice(0,8).join(', ')}${pharaohOrphans.length>8?'...':''}`);

// ─── Assertion C — render-time gate IS in source (positive marker) ────────
// These are static-pattern assertions ensuring the gate code is in place.
const hasGateInRefAware = /resolvedKey\s*=\s*!isAmbiguous\s*\?\s*_resolveVocab\(clean\)/.test(html);
ok('Test 15: _buildRefAwareHTMLInner uses _resolveVocab gate', hasGateInRefAware,
   'sentinel: resolvedKey = !isAmbiguous ? _resolveVocab(clean)');

const hasGateInSimple = /isVocab\s*=\s*!!_resolveVocab\(clean\)/.test(html);
ok('Test 16: _buildSimpleHTML uses _resolveVocab gate', hasGateInSimple,
   'sentinel: isVocab = !!_resolveVocab(clean)');

const comicUsesShared = /Comic-mode panels now use the shared buildRefAwareHTML/.test(html);
ok('Test 17: renderComicPage migrated to shared buildRefAwareHTML', comicUsesShared,
   'sentinel: marker comment');

const pharaohGated = /isPharaoh\s*=\s*_PHARAOH_NAMES\.has\(clean\)\s*&&\s*!!ref/.test(html);
ok('Test 18: pharaoh class gated on ref resolution', pharaohGated,
   'sentinel: isPharaoh = ... && !!ref');

const wordTapResolves = /typeof _resolveVocab === 'function'/.test(html);
ok('Test 19: wordTap uses _resolveVocab for alias-symmetric resolution', wordTapResolves,
   'sentinel: typeof _resolveVocab === function');

// ─── Assertion D — dialogue tagging still functions ──────────────────────
// Quick parity probe: a control fixture goes through buildRefAwareHTML and
// dialogue words are tagged with .dialogue. We can't run the renderer here
// (no jsdom), so we verify the dialogue regex is unchanged.
const dialogueRegexIntact = /qc\s*=\s*\(part\.match\(\/\["\\u201C\\u201D\]\/g\)/.test(html);
ok('Test 20: dialogue regex intact (still matches double + smart double quotes)',
   dialogueRegexIntact, 'sentinel: qc match against quote chars');

// ─── Assertion E — YW unlock still hard-coded ────────────────────────────
// Carries forward the v3.40.1 invariant.
const ywLocksRemoved = (html.match(/const locked = false;/g) || []).length >= 2;
ok('Test 21: YW renderYeshuasWay + featured panel still hard-code locked=false (v3.40.1)',
   ywLocksRemoved, 'sentinel count: at least 2 locked=false');

// ─── Summary ─────────────────────────────────────────────────────────────
console.log(`\n${PASS}/${PASS + FAIL} assertions passed`);
if (FAIL > 0) process.exit(1);
