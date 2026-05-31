#!/usr/bin/env node
// v3.43.4 — Parity test for `_selectDilemma`.
//
// Two implementations exist:
//   - lib/virtue-router.mjs::selectDilemma (server-side, used by lib jobs)
//   - App._selectDilemma in maat-reader.html (client-side, used by reader UI)
//
// They must return identical strategy + dilemma text for identical inputs.
// The v3.43.3 reflection-loop bug existed in BOTH; the round-table flagged
// drift risk because they're separately maintained.
//
// This test extracts the inline _selectDilemma from maat-reader.html via
// regex, compiles it in a fresh vm context, and runs it side-by-side with
// the lib export on the same input tuples.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { selectDilemma } from '../lib/virtue-router.mjs';

// Extract the inline _selectDilemma function source from maat-reader.html.
// Match shape: `_selectDilemma(pool, virtueProgress, ...){...},`
function extractInlineSelectDilemma() {
  const html = fs.readFileSync('maat-reader.html', 'utf8');
  // Find the start
  const startMatch = html.match(/_selectDilemma\(pool, virtueProgress, storyPrinciple, checkIdx, recentTexts\)\{/);
  if (!startMatch) throw new Error('inline _selectDilemma not found in maat-reader.html');
  const start = startMatch.index;
  // Walk braces from the opening `{` to find the matching close
  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) throw new Error('failed to balance braces in inline _selectDilemma');
  return html.slice(start, end);  // looks like: _selectDilemma(...){...}
}

// Compile the extracted source as a standalone function in a fresh vm context.
function compileInlineSelectDilemma() {
  const src = extractInlineSelectDilemma();
  // Wrap as a function expression and bind `this` to a stub `App`-like object
  // since the body uses `this._MAAT_DILEMMAS` etc. The selection logic only
  // touches arguments + Math.random + pure helpers — no external state needed.
  const wrapped = '(function(){ var App = { ' + src + ' }; return App._selectDilemma; })()';
  const ctx = vm.createContext({ Math });
  return vm.runInContext(wrapped, ctx);
}

const inlineSelectDilemma = compileInlineSelectDilemma();

// Test fixtures — same shape as tests/virtue-router.test.mjs
const L4_POOL = [
  { virtue:'RighteousOrder', text:'RO1' },
  { virtue:'RighteousOrder', text:'RO2' },
  { virtue:'Balance',        text:'B1' },
  { virtue:'Balance',        text:'B2' },
  { virtue:'Reciprocity',    text:'R1' },
  { virtue:'Reciprocity',    text:'R2' },
];

// Deterministic RNG so the parity comparison is stable. Both impls call
// Math.random; we override it identically across the two paths.
function withSeededRandom(seed, fn) {
  let t = seed >>> 0;
  const rng = () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const orig = Math.random;
  Math.random = rng;
  try { return fn(rng); }
  finally { Math.random = orig; }
}

// Run both impls with the same RNG state by reseeding before each call.
function bothPaths(seed, pool, vp, principle, checkIdx, recent) {
  const inlineRes = withSeededRandom(seed, () => inlineSelectDilemma.call({}, pool, vp, principle, checkIdx, recent));
  // The lib accepts an explicit `rng` parameter; pass a deterministic one
  // matching the same seed. Both should now traverse identical branches.
  let t = seed >>> 0;
  const rng = () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const libRes = selectDilemma(pool, vp, principle, checkIdx, rng, recent);
  return { inlineRes, libRes };
}

test('parity: untested branch picks same strategy + virtue (with same rng)', () => {
  const { inlineRes, libRes } = bothPaths(42, L4_POOL, {}, null, 0, []);
  assert.equal(inlineRes.strategy, libRes.strategy);
  assert.equal(inlineRes.targetVirtue, libRes.targetVirtue);
});

test('parity: weakest branch when all untested progress > 0', () => {
  const vp = { RighteousOrder: 1, Balance: 1, Reciprocity: 1 };
  const { inlineRes, libRes } = bothPaths(123, L4_POOL, vp, null, 0, []);
  assert.equal(inlineRes.strategy, libRes.strategy);
  assert.equal(inlineRes.targetVirtue, libRes.targetVirtue);
});

test('parity: single-virtue-exhausted (Reciprocity recent) — both pick alternative', () => {
  // R1 + R2 both in recent; Reciprocity exhausted. Both impls should fall
  // through to a different virtue rather than re-show R1 or R2.
  const vp = {};
  const recent = ['R1','R2'];
  const { inlineRes, libRes } = bothPaths(7, L4_POOL, vp, null, 0, recent);
  assert.notEqual(inlineRes.targetVirtue, 'Reciprocity', 'inline must not re-show recent');
  assert.notEqual(libRes.targetVirtue, 'Reciprocity', 'lib must not re-show recent');
  // Both should land on the same virtue with the same RNG seed
  assert.equal(inlineRes.strategy, libRes.strategy);
});

test('parity: empty pool returns empty strategy', () => {
  const { inlineRes, libRes } = bothPaths(1, [], {}, null, 0, []);
  assert.equal(inlineRes.strategy, 'empty');
  assert.equal(libRes.strategy, 'empty');
});

test('parity: fully-exhausted pool falls to rotation', () => {
  const allRecent = L4_POOL.map(d => d.text);
  // Force rng > 0.3 on BOTH paths so story-principle override is suppressed.
  // The inline impl reads Math.random; we override globally via a fixed-high rng.
  const origRandom = Math.random;
  Math.random = () => 0.95;
  let inlineRes;
  try { inlineRes = inlineSelectDilemma.call({}, L4_POOL, {}, 'Balance', 2, allRecent); }
  finally { Math.random = origRandom; }
  const libRes = selectDilemma(L4_POOL, {}, 'Balance', 2, () => 0.95, allRecent);
  assert.equal(inlineRes.strategy, 'rotation');
  assert.equal(libRes.strategy, 'rotation');
  assert.equal(inlineRes.dilemma.text, libRes.dilemma.text, 'rotation index parity');
});
