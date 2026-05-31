#!/usr/bin/env node
// senebty/tests/threshold-pacing.test.mjs
// Asserts the 1.5s → 4.5s pacing fix from spec 2026-04-25-senebty-glossary-v2-and-foundation-1.md

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const TH = fs.readFileSync(new URL('../lib/threshold.js', import.meta.url), 'utf8');

const ctx = { window: {}, Object };
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(TH, ctx);

const T = ctx.window.Senebty.threshold;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

check('threshold exposes getDismissMs', () => assert.equal(typeof T.getDismissMs, 'function'));

check('default dismiss is 4500ms (full clip + ~1s linger)', () => {
  assert.equal(T.getDismissMs(false), 4500);
});

check('reduced-motion dismiss is 1000ms', () => {
  assert.equal(T.getDismissMs(true), 1000);
});

check('legacy 1500ms is gone — never returned', () => {
  assert.notEqual(T.getDismissMs(false), 1500);
  assert.notEqual(T.getDismissMs(true), 1500);
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
