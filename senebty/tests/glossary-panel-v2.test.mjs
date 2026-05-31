#!/usr/bin/env node
// senebty/tests/glossary-panel-v2.test.mjs
// Asserts search + chip filter + recent-lookups + telemetry payload shape.

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const NS  = fs.readFileSync(new URL('../lib/namespace.js', import.meta.url), 'utf8');
const ENT = fs.readFileSync(new URL('../lib/glossary-entries.js', import.meta.url), 'utf8');
const PANEL = fs.readFileSync(new URL('../lib/glossary-panel.js', import.meta.url), 'utf8');

// Stub localStorage + sessionStorage + matchMedia + navigator
function makeStore(){
  const m = {};
  return {
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; }
  };
}
const ctx = {
  window: {},
  Object, String, Array, JSON, Math, Date,
  document: { addEventListener(){}, getElementById(){ return null; } },
  localStorage: makeStore(),
  sessionStorage: makeStore(),
  navigator: { sendBeacon: () => true, userAgent: 'Mozilla/5.0 Chrome/120' },
  matchMedia: () => ({ matches: false })
};
vm.createContext(ctx);
vm.runInContext(NS, ctx);
vm.runInContext(ENT, ctx);
vm.runInContext(PANEL, ctx);

const P = ctx.window.Senebty.glossaryPanel;

let PASS = 0, FAIL = 0;
function check(name, fn){ try { fn(); console.log('PASS ' + name); PASS++; } catch(e){ console.error('FAIL ' + name + ' — ' + e.message); FAIL++; } }

// ── filterEntries — pure function ───────────────────────────────────────
check('filterEntries(query="", chip="all") returns all 12 entries', () => {
  const r = P.filterEntries({ query: '', chip: 'all' });
  assert.equal(r.length, 12);
});

check('filterEntries(chip="treasure") returns 6 entries', () => {
  const r = P.filterEntries({ query: '', chip: 'treasure' });
  assert.equal(r.length, 6);
  for (const e of r) assert.equal(e.category, 'treasure');
});

check('filterEntries(query="mu") returns Mu', () => {
  const r = P.filterEntries({ query: 'mu', chip: 'all' });
  const keys = r.map(e => e.key);
  assert.ok(keys.includes('mu'), 'expected mu in: ' + keys.join(','));
});

check('filterEntries(query="HTEP") is case-insensitive', () => {
  const r = P.filterEntries({ query: 'HTEP', chip: 'all' });
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'htep');
});

check('filterEntries(query="brea") matches Tjau via brief substring', () => {
  // tjau brief: "Breath" — first treasure
  const r = P.filterEntries({ query: 'brea', chip: 'all' });
  const keys = r.map(e => e.key);
  assert.ok(keys.includes('tjau'), 'expected tjau matched on "brea"');
});

check('filterEntries(query="iri", chip="role") returns zero (iri is verb-only, no role entry mentions it)', () => {
  const r = P.filterEntries({ query: 'iri', chip: 'role' });
  assert.equal(r.length, 0);
});

// ── recent-lookups buffer ───────────────────────────────────────────────
check('recordLookup pushes to recent', () => {
  P.clearRecent();
  P.recordLookup('mu', 'search');
  const r = P.getRecent();
  assert.deepEqual(r, ['mu']);
});

check('recordLookup dedupes — same key twice = one entry, most-recent-first', () => {
  P.clearRecent();
  P.recordLookup('mu', 'search');
  P.recordLookup('iri', 'search');
  P.recordLookup('mu', 'chip');
  const r = P.getRecent();
  assert.deepEqual(r, ['mu', 'iri']);
});

check('recordLookup caps at 8', () => {
  P.clearRecent();
  for (let i = 0; i < 12; i++) P.recordLookup('term' + i, 'search');
  const r = P.getRecent();
  assert.equal(r.length, 8);
  assert.equal(r[0], 'term11', 'newest first');
});

// Length-only check: vm.runInContext yields a different Array realm; assert.deepEqual against [] rejects across realms.
check('clearRecent empties the buffer (account-delete contract)', () => {
  P.recordLookup('mu', 'search');
  P.clearRecent();
  assert.equal(P.getRecent().length, 0);
});

// ── telemetry payload ───────────────────────────────────────────────────
check('buildTelemetryPayload returns v1 schema with required fields', () => {
  const p = P.buildTelemetryPayload({ term: 'mu', source: 'search', level: 1 });
  assert.equal(p.schema, 'v1');
  assert.equal(p.term, 'mu');
  assert.equal(p.source, 'search');
  assert.equal(p.level, 1);
  assert.ok(typeof p.session_id === 'string' && p.session_id.length > 0);
  assert.ok(['chrome','firefox','safari','edge','other'].includes(p.ua_family));
  assert.equal(typeof p.reduced_motion, 'boolean');
});

check('buildTelemetryPayload coerces unknown source to "other" (defensive)', () => {
  const p = P.buildTelemetryPayload({ term: 'mu', source: 'eviltype', level: 0 });
  assert.equal(p.source, 'other');
});

check('buildTelemetryPayload clamps level to [0..6]', () => {
  assert.equal(P.buildTelemetryPayload({ term: 'mu', source: 'search', level: 99 }).level, 6);
  assert.equal(P.buildTelemetryPayload({ term: 'mu', source: 'search', level: -3 }).level, 0);
});

console.log(`\n${PASS} passing, ${FAIL} failing`);
process.exit(FAIL ? 1 : 0);
